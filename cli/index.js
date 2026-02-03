#!/usr/bin/env node
// cli/index.js
// Command-line interface for the Navigator agent
// Reuses the same AgentShell that powers the browser UI

import { createInterface } from 'readline';
import { AgentShell } from '../src/agent-shell.js';
import { 
  initOctokit, 
  loadGitHubFSConfig, 
  setupGitHubFS, 
  createFromEnv 
} from '../src/GitHubFileSystem.js';
import { setApiKey, getApiKey } from '../src/llm-tools.js';
import { initPlatform, getPlatform } from '../src/platform/index.js';

// ANSI color codes
const ANSI = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  purple: '\x1b[35m',
  blue: '\x1b[34m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  gray: '\x1b[90m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
};

// Spinner frames for thinking indicator
const SPINNER = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
let spinnerInterval = null;
let spinnerFrame = 0;

function startSpinner(message = 'Thinking') {
  if (spinnerInterval) return;
  process.stdout.write('\n');
  spinnerInterval = setInterval(() => {
    process.stdout.write(`\r${ANSI.cyan}${SPINNER[spinnerFrame]} ${message}...${ANSI.reset}`);
    spinnerFrame = (spinnerFrame + 1) % SPINNER.length;
  }, 80);
}

function stopSpinner() {
  if (spinnerInterval) {
    clearInterval(spinnerInterval);
    spinnerInterval = null;
    process.stdout.write('\r\x1b[K'); // Clear the spinner line
  }
}

/**
 * Format a message for terminal display
 */
function formatMessage(role, content) {
  const roleColors = {
    user: ANSI.blue,
    assistant: ANSI.green,
    system: ANSI.yellow,
    error: ANSI.red,
    tool: ANSI.gray
  };
  
  const color = roleColors[role] || ANSI.white;
  const roleLabel = role.charAt(0).toUpperCase() + role.slice(1);
  
  // Handle structured content with tags
  let formattedContent = content;
  
  // Format thoughts
  formattedContent = formattedContent.replace(
    /<thought>(.*?)<\/thought>/gs,
    `${ANSI.dim}${ANSI.purple}💭 $1${ANSI.reset}`
  );
  
  // Format actions
  formattedContent = formattedContent.replace(
    /<action>(.*?)<\/action>/gs,
    `${ANSI.cyan}⚡ Action: $1${ANSI.reset}`
  );
  
  // Format final answers
  formattedContent = formattedContent.replace(
    /<final_answer>(.*?)<\/final_answer>/gs,
    `${ANSI.green}${ANSI.bold}✓ $1${ANSI.reset}`
  );
  
  return `${color}${ANSI.bold}[${roleLabel}]${ANSI.reset} ${formattedContent}`;
}

/**
 * Print the welcome banner
 */
function printBanner() {
  console.log(`
${ANSI.cyan}${ANSI.bold}╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🧭  Navigator CLI                                       ║
║   Your persistent companion for the digital frontier      ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝${ANSI.reset}
`);
}

/**
 * Print help information
 */
function printHelp() {
  console.log(`
${ANSI.bold}Usage:${ANSI.reset}
  node cli/index.js [options]
  
${ANSI.bold}Options:${ANSI.reset}
  --setup          Run interactive setup for GitHub and Gemini
  --help, -h       Show this help message
  
${ANSI.bold}Environment Variables:${ANSI.reset}
  GEMINI_API_KEY   Your Google Gemini API key
  GITHUB_TOKEN     GitHub Personal Access Token (repo scope)
  GITHUB_OWNER     GitHub username or organization
  GITHUB_REPO      Repository name (default: agent-workspace)
  GITHUB_BRANCH    Branch name (default: main)
  GITHUB_EMAIL     Email for commits
  
${ANSI.bold}Commands (in chat):${ANSI.reset}
  /help            Show available commands
  /status          Show session and profile stats
  /memory          Show memory status
  /new             Start a new session
  /quit, /exit     Exit the CLI
  
${ANSI.bold}Examples:${ANSI.reset}
  # Set up credentials interactively
  node cli/index.js --setup
  
  # Run with environment variables
  GEMINI_API_KEY=xxx GITHUB_TOKEN=xxx node cli/index.js
`);
}

/**
 * Run interactive setup
 */
async function runSetup() {
  console.log(`\n${ANSI.bold}Navigator CLI Setup${ANSI.reset}\n`);
  
  const platform = await getPlatform();
  
  // Set up Gemini API key
  console.log(`${ANSI.yellow}Step 1: Gemini API Key${ANSI.reset}`);
  const geminiKey = await platform.prompt.text(
    'Enter your Gemini API key',
    process.env.GEMINI_API_KEY || ''
  );
  if (geminiKey) {
    await setApiKey(geminiKey);
    console.log(`${ANSI.green}✓ Gemini API key configured${ANSI.reset}\n`);
  }
  
  // Set up GitHub
  console.log(`${ANSI.yellow}Step 2: GitHub Configuration${ANSI.reset}`);
  await setupGitHubFS();
  
  console.log(`\n${ANSI.green}${ANSI.bold}✓ Setup complete!${ANSI.reset}\n`);
}

/**
 * Main CLI loop
 */
async function main() {
  // Parse command line arguments
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    printHelp();
    process.exit(0);
  }
  
  // Initialize platform
  await initPlatform();
  
  if (args.includes('--setup')) {
    await runSetup();
    process.exit(0);
  }
  
  printBanner();
  
  // Check for API key
  try {
    await getApiKey();
  } catch (e) {
    console.log(`${ANSI.yellow}⚠ Gemini API key not found.${ANSI.reset}`);
    console.log(`Set GEMINI_API_KEY environment variable or run: node cli/index.js --setup\n`);
    process.exit(1);
  }
  
  // Initialize Octokit
  await initOctokit();
  
  // Check for GitHub config
  let config = await loadGitHubFSConfig();
  
  if (!config) {
    // Try to create from environment
    const platform = await getPlatform();
    const envConfig = {
      auth: platform.env.get('GITHUB_TOKEN'),
      owner: platform.env.get('GITHUB_OWNER'),
      repo: platform.env.get('GITHUB_REPO'),
      branch: platform.env.get('GITHUB_BRANCH', 'main'),
      email: platform.env.get('GITHUB_EMAIL', 'agent@localhost')
    };
    
    if (envConfig.auth && envConfig.owner && envConfig.repo) {
      // Save the config so AgentShell can load it
      const { saveGitHubFSConfig } = await import('../src/GitHubFileSystem.js');
      await saveGitHubFSConfig(envConfig);
      console.log(`${ANSI.green}✓ Using GitHub config from environment variables${ANSI.reset}\n`);
    } else {
      console.log(`${ANSI.yellow}⚠ GitHub not configured.${ANSI.reset}`);
      console.log(`Set environment variables or run: node cli/index.js --setup\n`);
      process.exit(1);
    }
  }
  
  // Create AgentShell with CLI callbacks
  const shell = new AgentShell({
    requireConfirmation: true,
    
    onReady: (info) => {
      console.log(`${ANSI.green}✓ Connected to session: ${info.sessionId}${ANSI.reset}`);
      if (info.userName) {
        console.log(`${ANSI.dim}Welcome back, ${info.userName}!${ANSI.reset}`);
      }
      console.log(`${ANSI.dim}Type /help for commands, or just start chatting.${ANSI.reset}\n`);
    },
    
    onMessage: (msg) => {
      stopSpinner();
      console.log(formatMessage(msg.role, msg.content));
    },
    
    onStep: (step) => {
      // Steps are shown as messages
    },
    
    onThinking: (isThinking) => {
      if (isThinking) {
        startSpinner('Thinking');
      } else {
        stopSpinner();
      }
    },
    
    onComplete: (result) => {
      stopSpinner();
      // Result is already shown via onMessage
    },
    
    onError: (error) => {
      stopSpinner();
      console.log(`${ANSI.red}${ANSI.bold}Error:${ANSI.reset} ${error.message}`);
    },
    
    onConfirmation: async (analysis) => {
      const platform = await getPlatform();
      console.log(`\n${ANSI.yellow}${ANSI.bold}⚠ This action requires confirmation:${ANSI.reset}`);
      console.log(`${ANSI.dim}Risk level: ${analysis.riskLevel}${ANSI.reset}`);
      if (analysis.potentialIssues?.length > 0) {
        console.log(`${ANSI.dim}Potential issues: ${analysis.potentialIssues.join(', ')}${ANSI.reset}`);
      }
      return await platform.prompt.confirm('Proceed?');
    }
  });
  
  // Initialize the shell
  try {
    await shell.initialize();
  } catch (error) {
    console.log(`${ANSI.red}Failed to initialize: ${error.message}${ANSI.reset}`);
    console.log(`\nRun: node cli/index.js --setup`);
    process.exit(1);
  }
  
  // Create readline interface
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: `${ANSI.cyan}You>${ANSI.reset} `
  });
  
  // Handle input
  rl.prompt();
  
  rl.on('line', async (line) => {
    const input = line.trim();
    
    if (!input) {
      rl.prompt();
      return;
    }
    
    // Handle exit commands
    if (input === '/quit' || input === '/exit' || input === '/q') {
      console.log(`\n${ANSI.dim}Goodbye! 👋${ANSI.reset}\n`);
      rl.close();
      process.exit(0);
    }
    
    try {
      await shell.send(input);
    } catch (error) {
      console.log(`${ANSI.red}Error: ${error.message}${ANSI.reset}`);
    }
    
    console.log(''); // Empty line for readability
    rl.prompt();
  });
  
  rl.on('close', () => {
    stopSpinner();
    process.exit(0);
  });
  
  // Handle Ctrl+C gracefully
  process.on('SIGINT', () => {
    stopSpinner();
    console.log(`\n${ANSI.dim}Interrupted. Goodbye! 👋${ANSI.reset}\n`);
    process.exit(0);
  });
}

// Run the CLI
main().catch(error => {
  console.error(`${ANSI.red}Fatal error: ${error.message}${ANSI.reset}`);
  console.error(error.stack);
  process.exit(1);
});
