#!/usr/bin/env node
// cli/test-agent.js
// Non-interactive test script for the agent

import { AgentShell } from '../src/agent-shell.js';
import { initOctokit, loadGitHubFSConfig, saveGitHubFSConfig } from '../src/GitHubFileSystem.js';
import { setApiKey } from '../src/llm-tools.js';
import { initPlatform, getPlatform } from '../src/platform/index.js';

// ANSI colors
const ANSI = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  purple: '\x1b[35m'
};

async function main() {
  const task = process.argv[2] || 'List the files in the root directory';
  
  console.log(`${ANSI.cyan}${ANSI.bold}🧭 Navigator Test${ANSI.reset}\n`);
  console.log(`${ANSI.dim}Task: ${task}${ANSI.reset}\n`);
  
  // Initialize platform
  await initPlatform();
  const platform = await getPlatform();
  
  // Setup from environment
  const envConfig = {
    auth: platform.env.get('GITHUB_TOKEN'),
    owner: platform.env.get('GITHUB_OWNER'),
    repo: platform.env.get('GITHUB_REPO'),
    branch: platform.env.get('GITHUB_BRANCH', 'main'),
    email: platform.env.get('GITHUB_EMAIL', 'agent@localhost')
  };
  
  if (!envConfig.auth || !envConfig.owner || !envConfig.repo) {
    console.log(`${ANSI.red}Missing environment variables${ANSI.reset}`);
    console.log('Required: GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO, GEMINI_API_KEY');
    process.exit(1);
  }
  
  await saveGitHubFSConfig(envConfig);
  await initOctokit();
  
  // Create shell with simple callbacks
  const shell = new AgentShell({
    requireConfirmation: false, // Skip confirmations for testing
    
    onReady: (info) => {
      console.log(`${ANSI.green}✓ Ready (session: ${info.sessionId})${ANSI.reset}\n`);
    },
    
    onMessage: (msg) => {
      if (msg.role === 'user') {
        console.log(`${ANSI.cyan}[User]${ANSI.reset} ${msg.content}`);
      } else if (msg.role === 'system') {
        console.log(`${ANSI.yellow}[System]${ANSI.reset} ${msg.content}`);
      }
    },
    
    onStep: (step) => {
      const content = step.content;
      
      // Parse structured output
      const thoughtMatch = content.match(/<thought>(.*?)<\/thought>/s);
      const actionMatch = content.match(/<action>(.*?)<\/action>/s);
      const finalMatch = content.match(/<final_answer>(.*?)<\/final_answer>/s);
      
      if (thoughtMatch) {
        console.log(`${ANSI.purple}💭 ${thoughtMatch[1]}${ANSI.reset}`);
      }
      if (actionMatch) {
        console.log(`${ANSI.cyan}⚡ Action: ${actionMatch[1]}${ANSI.reset}`);
      }
      if (finalMatch) {
        console.log(`${ANSI.green}${ANSI.bold}✓ ${finalMatch[1]}${ANSI.reset}`);
      }
      if (step.role === 'tool') {
        const preview = content.length > 200 ? content.substring(0, 200) + '...' : content;
        console.log(`${ANSI.dim}[Tool result] ${preview}${ANSI.reset}`);
      }
    },
    
    onThinking: (isThinking) => {
      if (isThinking) {
        process.stdout.write(`${ANSI.dim}Thinking...${ANSI.reset}`);
      } else {
        process.stdout.write('\r\x1b[K'); // Clear line
      }
    },
    
    onComplete: (result) => {
      console.log(`\n${ANSI.green}${ANSI.bold}✓ Task completed${ANSI.reset}\n`);
    },
    
    onError: (error) => {
      console.log(`${ANSI.red}Error: ${error.message}${ANSI.reset}`);
    }
  });
  
  try {
    await shell.initialize();
    console.log(`${ANSI.dim}Sending task to agent...${ANSI.reset}\n`);
    await shell.send(task);
  } catch (error) {
    console.error(`${ANSI.red}Failed: ${error.message}${ANSI.reset}`);
    console.error(error.stack);
    process.exit(1);
  }
  
  process.exit(0);
}

main();
