// platform/browser.js
// Browser-specific platform adapter
// Uses localStorage, IndexedDB, and native browser APIs

import { PLATFORM_NAMES } from './types.js';

/**
 * IndexedDB-based storage for browser
 */
class BrowserStorage {
  constructor(dbName = 'AgentDB', storeName = 'keyvalue') {
    this.dbName = dbName;
    this.storeName = storeName;
    this.db = null;
    this._initPromise = this._init();
  }

  async _init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName, { keyPath: 'key' });
        }
      };
      request.onsuccess = (event) => {
        this.db = event.target.result;
        resolve();
      };
      request.onerror = (event) => {
        reject(event.target.error);
      };
    });
  }

  async _ensureReady() {
    await this._initPromise;
  }

  async get(key) {
    await this._ensureReady();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result?.value);
      request.onerror = () => reject(request.error);
    });
  }

  async set(key, value) {
    await this._ensureReady();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.put({ key, value });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async delete(key) {
    await this._ensureReady();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.delete(key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async clear() {
    await this._ensureReady();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}

/**
 * Color definitions for styled console logging
 */
const LOG_COLORS = {
  thought: '#a78bfa',   // purple
  action: '#60a5fa',    // blue
  success: '#34d399',   // green
  error: '#f87171',     // red
  info: '#94a3b8',      // gray
  warning: '#fbbf24',   // yellow
  exploring: '#38bdf8'  // light blue
};

/**
 * Browser platform adapter
 * @type {import('./types.js').PlatformAdapter}
 */
export const browserAdapter = {
  name: PLATFORM_NAMES.BROWSER,

  config: {
    load() {
      const saved = localStorage.getItem('github-fs-config');
      if (!saved) return null;
      try {
        return JSON.parse(saved);
      } catch {
        return null;
      }
    },

    save(config) {
      localStorage.setItem('github-fs-config', JSON.stringify(config));
    },

    clear() {
      localStorage.removeItem('github-fs-config');
    }
  },

  env: {
    get(name, defaultValue) {
      // In browser, we use localStorage as a fallback for "environment" variables
      return localStorage.getItem(name) || defaultValue;
    },

    set(name, value) {
      localStorage.setItem(name, value);
    }
  },

  encoding: {
    base64Encode(str) {
      // Handle Unicode properly
      return btoa(unescape(encodeURIComponent(str)));
    },

    base64Decode(str) {
      // Handle Unicode properly
      return decodeURIComponent(escape(atob(str.replace(/\n/g, ''))));
    }
  },

  storage: new BrowserStorage(),

  log: {
    _log(message, type = 'info') {
      const color = LOG_COLORS[type] || LOG_COLORS.info;
      const style = `color: ${color}; font-weight: bold;`;
      console.log(`%c[Navigator] ${message}`, style);
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
      const result = window.prompt(message, defaultValue);
      return result || '';
    },

    async confirm(message) {
      return window.confirm(message);
    },

    async select(message, options) {
      // Browser doesn't have native select, use prompt with numbered options
      const optionsText = options.map((opt, i) => `${i + 1}. ${opt}`).join('\n');
      const result = window.prompt(`${message}\n\n${optionsText}\n\nEnter number:`);
      const index = parseInt(result, 10) - 1;
      return options[index] || options[0];
    }
  },

  http: {
    async fetch(url, options) {
      return window.fetch(url, options);
    }
  }
};

export default browserAdapter;
