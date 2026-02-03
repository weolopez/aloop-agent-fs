#!/usr/bin/env node
// cli/test-scenarios.js
// Comprehensive test scenarios for the Navigator agent

import { AgentShell } from '../src/agent-shell.js';
import { initOctokit, saveGitHubFSConfig } from '../src/GitHubFileSystem.js';
import { initPlatform, getPlatform } from '../src/platform/index.js';

const ANSI = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  purple: '\x1b[35m',
  blue: '\x1b[34m'
};

// Test scenarios organized by category
const SCENARIOS = {
  'Note-taking & Knowledge Base': [
    'Create a folder called "notes" and add a file called "ideas.md" with some placeholder content about project ideas',
    'Read the file notes/ideas.md and add 3 more bullet points to it',
    'Create a table of contents file in the notes folder that lists all markdown files',
  ],
  
  'Data Management': [
    'Create a JSON config file at config/settings.json with some default application settings (theme: dark, language: en, version: 1.0)',
    'Read the config file and update the version to 1.1',
    'Create a backup of the config file in a backups folder with today\'s date in the filename',
  ],
  
  'Memory & Learning': [
    'Remember that my favorite programming language is TypeScript and I prefer functional programming',
    'What do you remember about my preferences?',
    'Log that we successfully tested the CLI agent today',
  ],
  
  'Project Management': [
    'Create a project structure for a new project called "awesome-app" with folders: src, tests, docs, and a README.md',
    'Add a TODO.md file to the awesome-app folder with 5 tasks for getting started',
    'List all files in the awesome-app project and create a summary',
  ],
  
  'Search & Discovery': [
    'Find all markdown files in the repository',
    'Search for any files containing the word "config"',
    'Give me an overview of the repository structure and what each folder contains',
  ],
  
  'Multi-step Reasoning': [
    'Analyze the repository structure, identify what type of project this is, and write a brief analysis to a file called "repo-analysis.md"',
    'Read all the markdown files in the memory folder and create a summary of what the agent knows',
    'Create a changelog file that documents the test files we created today, organized by category',
  ]
};

async function runScenario(shell, category, task, index) {
  console.log(`\n${ANSI.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${ANSI.reset}`);
  console.log(`${ANSI.cyan}${ANSI.bold}[${category}] Test ${index + 1}${ANSI.reset}`);
  console.log(`${ANSI.dim}Task: ${task}${ANSI.reset}`);
  console.log(`${ANSI.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${ANSI.reset}\n`);
  
  const startTime = Date.now();
  
  try {
    await shell.send(task);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n${ANSI.green}✓ Completed in ${elapsed}s${ANSI.reset}`);
    return { success: true, elapsed };
  } catch (error) {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n${ANSI.red}✗ Failed after ${elapsed}s: ${error.message}${ANSI.reset}`);
    return { success: false, elapsed, error: error.message };
  }
}

async function main() {
  const args = process.argv.slice(2);
  const categoryFilter = args[0]; // Optional: filter to specific category
  const testIndex = args[1] ? parseInt(args[1]) - 1 : null; // Optional: run specific test
  
  console.log(`${ANSI.cyan}${ANSI.bold}`);
  console.log(`╔═══════════════════════════════════════════════════════════╗`);
  console.log(`║   🧭 Navigator Agent - Test Scenarios                     ║`);
  console.log(`╚═══════════════════════════════════════════════════════════╝${ANSI.reset}`);
  
  if (categoryFilter) {
    console.log(`\n${ANSI.yellow}Filter: ${categoryFilter}${ANSI.reset}`);
  }
  
  // Show available categories if --list flag
  if (args.includes('--list')) {
    console.log(`\n${ANSI.bold}Available categories:${ANSI.reset}`);
    Object.entries(SCENARIOS).forEach(([cat, tests], i) => {
      console.log(`  ${i + 1}. ${cat} (${tests.length} tests)`);
      tests.forEach((t, j) => {
        console.log(`     ${ANSI.dim}${j + 1}. ${t.substring(0, 60)}...${ANSI.reset}`);
      });
    });
    console.log(`\n${ANSI.dim}Usage: node cli/test-scenarios.js [category] [test-number]${ANSI.reset}`);
    process.exit(0);
  }
  
  // Initialize
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
    process.exit(1);
  }
  
  await saveGitHubFSConfig(envConfig);
  await initOctokit();
  
  // Create shell
  const shell = new AgentShell({
    requireConfirmation: false,
    onReady: () => {},
    onMessage: (msg) => {
      if (msg.role === 'user') {
        console.log(`${ANSI.cyan}[You]${ANSI.reset} ${msg.content}`);
      }
    },
    onStep: (step) => {
      const content = step.content;
      const thoughtMatch = content.match(/<thought>(.*?)<\/thought>/s);
      const actionMatch = content.match(/<action>(.*?)<\/action>/s);
      const finalMatch = content.match(/<final_answer>(.*?)<\/final_answer>/s);
      
      if (thoughtMatch) {
        const thought = thoughtMatch[1].substring(0, 150);
        console.log(`${ANSI.purple}💭 ${thought}${thoughtMatch[1].length > 150 ? '...' : ''}${ANSI.reset}`);
      }
      if (actionMatch) {
        console.log(`${ANSI.cyan}⚡ ${actionMatch[1]}${ANSI.reset}`);
      }
      if (finalMatch) {
        console.log(`${ANSI.green}${ANSI.bold}✓ ${finalMatch[1]}${ANSI.reset}`);
      }
      if (step.role === 'tool') {
        const preview = content.substring(0, 100);
        console.log(`${ANSI.dim}📦 ${preview}${content.length > 100 ? '...' : ''}${ANSI.reset}`);
      }
    },
    onThinking: () => {},
    onComplete: () => {},
    onError: (err) => console.log(`${ANSI.red}Error: ${err.message}${ANSI.reset}`)
  });
  
  await shell.initialize();
  console.log(`\n${ANSI.green}✓ Agent initialized${ANSI.reset}`);
  
  // Run tests
  const results = [];
  
  for (const [category, tests] of Object.entries(SCENARIOS)) {
    // Skip if category filter doesn't match
    if (categoryFilter && !category.toLowerCase().includes(categoryFilter.toLowerCase())) {
      continue;
    }
    
    console.log(`\n${ANSI.yellow}${ANSI.bold}═══ ${category} ═══${ANSI.reset}`);
    
    for (let i = 0; i < tests.length; i++) {
      // Skip if specific test index requested and doesn't match
      if (testIndex !== null && i !== testIndex) {
        continue;
      }
      
      const result = await runScenario(shell, category, tests[i], i);
      results.push({ category, test: tests[i], ...result });
      
      // Small delay between tests to avoid rate limits
      await new Promise(r => setTimeout(r, 2000));
    }
  }
  
  // Summary
  console.log(`\n${ANSI.cyan}${ANSI.bold}`);
  console.log(`═══════════════════════════════════════════════════════════`);
  console.log(`                    TEST SUMMARY                           `);
  console.log(`═══════════════════════════════════════════════════════════${ANSI.reset}`);
  
  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  const totalTime = results.reduce((sum, r) => sum + parseFloat(r.elapsed), 0).toFixed(1);
  
  console.log(`\n${ANSI.green}Passed: ${passed}${ANSI.reset}`);
  console.log(`${ANSI.red}Failed: ${failed}${ANSI.reset}`);
  console.log(`${ANSI.dim}Total time: ${totalTime}s${ANSI.reset}`);
  
  if (failed > 0) {
    console.log(`\n${ANSI.red}${ANSI.bold}Failed tests:${ANSI.reset}`);
    results.filter(r => !r.success).forEach(r => {
      console.log(`  • ${r.category}: ${r.test.substring(0, 50)}...`);
      console.log(`    ${ANSI.dim}${r.error}${ANSI.reset}`);
    });
  }
  
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error(`${ANSI.red}Fatal: ${err.message}${ANSI.reset}`);
  process.exit(1);
});
