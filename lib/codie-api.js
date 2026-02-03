// lib/codie-api.js
// Programmatic API for opencode to use Codie directly
// Provides clean integration without spawning CLI processes

import { AgentShell } from '../src/agent-shell.js';
import { initOctokit, loadGitHubFSConfig, saveGitHubFSConfig } from '../src/GitHubFileSystem.js';
import { getApiKey, setApiKey } from '../src/llm-tools.js';
import { initPlatform, getPlatform } from '../src/platform/index.js';

/**
 * Initialize Codie with configuration
 * @param {Object} config - Configuration options
 * @param {string} config.geminiApiKey - Gemini API key
 * @param {string} config.githubToken - GitHub token
 * @param {string} config.githubOwner - GitHub owner
 * @param {string} config.githubRepo - GitHub repo
 * @param {string} config.githubBranch - GitHub branch (optional)
 * @param {string} config.githubEmail - GitHub email (optional)
 * @returns {Promise<CodieAPI>}
 */
export async function createCodie(config = {}) {
  // Initialize platform
  await initPlatform();
  const platform = await getPlatform();

  // Set up API key
  if (config.geminiApiKey) {
    await setApiKey(config.geminiApiKey);
  }

  // Set up GitHub config
  const githubConfig = {
    auth: config.githubToken || platform.env.get('GITHUB_TOKEN'),
    owner: config.githubOwner || platform.env.get('GITHUB_OWNER'),
    repo: config.githubRepo || platform.env.get('GITHUB_REPO'),
    branch: config.githubBranch || platform.env.get('GITHUB_BRANCH', 'main'),
    email: config.githubEmail || platform.env.get('GITHUB_EMAIL', 'codie@localhost')
  };

  if (!githubConfig.auth || !githubConfig.owner || !githubConfig.repo) {
    throw new Error('GitHub configuration incomplete. Need token, owner, and repo.');
  }

  await saveGitHubFSConfig(githubConfig);
  await initOctokit();

  return new CodieAPI();
}

/**
 * Main Codie API class
 */
export class CodieAPI {
  constructor() {
    this.shell = null;
    this.isInitialized = false;
  }

  /**
   * Initialize the Codie agent
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this.isInitialized) return;

    this.shell = new AgentShell({
      requireConfirmation: false, // Auto-approve for programmatic use
      onReady: () => {},
      onMessage: () => {},
      onStep: () => {},
      onThinking: () => {},
      onComplete: () => {},
      onError: () => {}
    });

    await this.shell.initialize();
    this.isInitialized = true;
  }

  /**
   * Run a task through Codie
   * @param {string} task - The task description
   * @param {Object} options - Options for the task
   * @param {boolean} options.verbose - Whether to return detailed output
   * @param {number} options.timeout - Timeout in milliseconds
   * @returns {Promise<Object>} - Task result
   */
  async runTask(task, options = {}) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const { verbose = false, timeout = 30000 } = options;

    return new Promise(async (resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Task timed out after ${timeout}ms`));
      }, timeout);

      try {
        const result = await this.shell.send(task);
        clearTimeout(timeoutId);

        if (verbose) {
          resolve({
            success: true,
            result,
            task,
            timestamp: new Date().toISOString(),
            workingBranch: this.shell.fs.getCurrentBranch()
          });
        } else {
          resolve(result);
        }
      } catch (error) {
        clearTimeout(timeoutId);
        reject(error);
      }
    });
  }

  /**
   * Run a slash command through Codie
   * @param {string} command - The command (without the /)
   * @returns {Promise<string>} - Command result
   */
  async runCommand(command) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    return await this.shell.command(`/${command}`);
  }

  /**
   * Get current memory status
   * @returns {Promise<Object>} - Memory statistics
   */
  async getMemoryStatus() {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const memStats = this.shell.memory.getStats();
    return {
      hasSoul: memStats.hasSoul,
      hasUser: memStats.hasUser,
      hasIdentity: memStats.hasIdentity,
      hasMemory: memStats.hasMemory,
      memorySize: memStats.memorySize,
      hasTodayLog: memStats.hasTodayLog,
      todayLogSize: memStats.todayLogSize,
      hasYesterdayLog: memStats.hasYesterdayLog
    };
  }

  /**
   * Search memory for content
   * @param {string} query - Search query
   * @returns {Promise<Array>} - Search results
   */
  async searchMemory(query) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    return await this.shell.memory.search(query);
  }

  /**
   * Add something to long-term memory
   * @param {string} content - Content to remember
   * @param {string} category - Category for the memory
   * @returns {Promise<void>}
   */
  async remember(content, category = 'API Request') {
    if (!this.isInitialized) {
      await this.initialize();
    }

    await this.shell.memory.writeMemory(content, category);
  }

  /**
   * Get current working branch
   * @returns {string} - Branch name
   */
  getWorkingBranch() {
    return this.shell?.fs?.getCurrentBranch() || 'unknown';
  }

  /**
   * Clean up resources
   */
  async cleanup() {
    // Currently no cleanup needed, but could be extended
    this.isInitialized = false;
    this.shell = null;
  }
}

  /**
   * Quick task runner - initialize and run a single task
   * @param {string} task - Task description
   * @param {Object} config - Codie configuration
   * @returns {Promise<string>} - Task result
   */
export async function runQuickTask(task, config = {}) {
  const codie = await createCodie(config);
  try {
    return await codie.runTask(task);
  } finally {
    await codie.cleanup();
  }
}

  /**
   * Check if Codie is properly configured
   * @param {Object} config - Configuration to check
   * @returns {Promise<boolean>} - Whether Codie can be used
   */
export async function checkCodieHealth(config = {}) {
  try {
    const codie = await createCodie(config);
    await codie.initialize();
    await codie.cleanup();
    return true;
  } catch (error) {
    console.warn('Codie health check failed:', error.message);
    return false;
  }
}