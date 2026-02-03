// platform/node.js
// Node.js-specific platform adapter
// Uses environment variables, file system, and Node.js APIs

import { PLATFORM_NAMES } from './types.js';
import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

/**
 * File-based storage for Node.js
 * Stores data in ~/.aloop/storage/
 */
class NodeStorage {
  constructor() {
    this.baseDir = join(homedir(), '.aloop', 'storage');
    this._ensureDir();
  }

  _ensureDir() {
    if (!existsSync(this.baseDir)) {
      mkdirSync(this.baseDir, { recursive: true });
    }
  }

  _getPath(key) {
    // Sanitize key to be filesystem-safe
    const safeKey = key.replace(/[^a-zA-Z0-9_-]/g, '_');
    return join(this.baseDir, `${safeKey}.json`);
  }

  async get(key) {
    const path = this._getPath(key);
    if (!existsSync(path)) return undefined;
    try {
      const data = readFileSync(path, 'utf-8');
      return JSON.parse(data);
    } catch {
      return undefined;
    }
  }

  async set(key, value) {
    const path = this._getPath(key);
    writeFileSync(path, JSON.stringify(value, null, 2), 'utf-8');
  }

  async delete(key) {
    const path = this._getPath(key);
    if (existsSync(path)) {
      unlinkSync(path);
    }
  }

  async clear() {
    // Clear all files in storage directory
    const fs = await import('fs/promises');
    const files = await fs.readdir(this.baseDir);
    for (const file of files) {
      if (file.endsWith('.json')) {
        await fs.unlink(join(this.baseDir, file));
      }
    }
  }
}

/**
 * ANSI color codes for terminal output
 */
const ANSI = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  // Colors
  purple: '\x1b[35m',
  blue: '\x1b[34m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  gray: '\x1b[90m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m'
};

const LOG_STYLES = {
  thought: ANSI.purple,
  action: ANSI.blue,
  success: ANSI.green,
  error: ANSI.red,
  info: ANSI.gray,
  warning: ANSI.yellow,
  exploring: ANSI.cyan
};

/**
 * Configuration file path
 */
const CONFIG_PATH = join(homedir(), '.aloop', 'config.json');

/**
 * Ensure the .aloop directory exists
 */
function ensureConfigDir() {
  const dir = join(homedir(), '.aloop');
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

/**
 * Node.js platform adapter
 * @type {import('./types.js').PlatformAdapter}
 */
export const nodeAdapter = {
  name: PLATFORM_NAMES.NODE,

  config: {
    load() {
      if (!existsSync(CONFIG_PATH)) return null;
      try {
        const data = readFileSync(CONFIG_PATH, 'utf-8');
        return JSON.parse(data);
      } catch {
        return null;
      }
    },

    save(config) {
      ensureConfigDir();
      writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
    },

    clear() {
      if (existsSync(CONFIG_PATH)) {
        unlinkSync(CONFIG_PATH);
      }
    }
  },

  env: {
    get(name, defaultValue) {
      return process.env[name] || defaultValue;
    },

    set(name, value) {
      process.env[name] = value;
    }
  },

  encoding: {
    base64Encode(str) {
      return Buffer.from(str, 'utf-8').toString('base64');
    },

    base64Decode(str) {
      return Buffer.from(str.replace(/\n/g, ''), 'base64').toString('utf-8');
    }
  },

  storage: new NodeStorage(),

  log: {
    _log(message, type = 'info') {
      const style = LOG_STYLES[type] || LOG_STYLES.info;
      console.log(`${style}${ANSI.bold}[Navigator]${ANSI.reset}${style} ${message}${ANSI.reset}`);
    },

    info(message) { this._log(message, 'info'); },
    success(message) { this._log(message, 'success'); },
    error(message) { this._log(message, 'error'); },
    warning(message) { this._log(message, 'warning'); },
    thought(message) { this._log(message, 'thought'); },
    action(message) { this._log(message, 'action'); }
  },

  prompt: {
    async text(message, defaultValue = '') {
      // Lazy import readline for interactive prompts
      const readline = await import('readline');
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });

      return new Promise((resolve) => {
        const prompt = defaultValue ? `${message} [${defaultValue}]: ` : `${message}: `;
        rl.question(prompt, (answer) => {
          rl.close();
          resolve(answer || defaultValue);
        });
      });
    },

    async confirm(message) {
      const answer = await this.text(`${message} (y/n)`, 'n');
      return answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes';
    },

    async select(message, options) {
      console.log(`\n${message}\n`);
      options.forEach((opt, i) => {
        console.log(`  ${i + 1}. ${opt}`);
      });
      const answer = await this.text('\nSelect option', '1');
      const index = parseInt(answer, 10) - 1;
      return options[index] || options[0];
    }
  },

  http: {
    async fetch(url, options) {
      // Node.js 18+ has native fetch, otherwise we need node-fetch
      if (typeof globalThis.fetch === 'function') {
        return globalThis.fetch(url, options);
      }
      // Fallback for older Node.js versions
      const { default: nodeFetch } = await import('node-fetch');
      return nodeFetch(url, options);
    }
  }
};

export default nodeAdapter;
