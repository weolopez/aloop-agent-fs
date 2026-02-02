// memory-manager.js
// OpenClaw-inspired memory system with Markdown files stored in GitHub
// Provides persistent long-term memory through SOUL.md, USER.md, MEMORY.md, and daily logs

import { logWithPersona, PERSONA } from './persona.js';

/**
 * @typedef {Object} MemoryConfig
 * @property {string} memoryPath - Base path for memory files (default: '')
 * @property {string} dailyPath - Path for daily logs (default: 'memory')
 * @property {boolean} loadYesterday - Whether to load yesterday's log at startup
 * @property {number} maxDailyEntries - Max entries before suggesting archival
 */

/**
 * Memory types and their file paths
 */
export const MEMORY_FILES = {
  SOUL: 'SOUL.md',      // Agent's personality, tone, boundaries
  USER: 'USER.md',      // Who the user is, preferences
  IDENTITY: 'IDENTITY.md', // Agent's name and customization
  MEMORY: 'MEMORY.md',  // Curated long-term memory
  AGENTS: 'AGENTS.md',  // Workspace guidelines and standards
};

/**
 * Manages agent memory using Markdown files in GitHub
 * Inspired by OpenClaw's memory architecture
 */
export class MemoryManager {
  /**
   * @param {Object} fs - GitHubFileSystem instance
   * @param {MemoryConfig} options - Configuration options
   */
  constructor(fs, options = {}) {
    this.fs = fs;
    this.options = {
      memoryPath: '',
      dailyPath: 'memory',
      loadYesterday: true,
      maxDailyEntries: 50,
      ...options
    };
    
    // In-memory cache for loaded memory files
    this.cache = {
      soul: null,
      user: null,
      identity: null,
      memory: null,
      agents: null,
      today: null,
      yesterday: null
    };
    
    this.initialized = false;
  }

  /**
   * Initialize memory system by loading core memory files
   * Called at session start
   * @returns {Promise<Object>} - Loaded memory context
   */
  async initialize() {
    logWithPersona('Loading memory...', 'exploring');
    
    const results = {
      soul: null,
      user: null,
      identity: null,
      memory: null,
      today: null,
      yesterday: null
    };

    // Load all memory files in parallel
    const loads = [
      this._loadMemoryFile(MEMORY_FILES.SOUL, 'soul'),
      this._loadMemoryFile(MEMORY_FILES.USER, 'user'),
      this._loadMemoryFile(MEMORY_FILES.IDENTITY, 'identity'),
      this._loadMemoryFile(MEMORY_FILES.MEMORY, 'memory'),
      this._loadMemoryFile(MEMORY_FILES.AGENTS, 'agents'),
      this._loadDailyLog('today'),
    ];

    if (this.options.loadYesterday) {
      loads.push(this._loadDailyLog('yesterday'));
    }

    await Promise.all(loads);
    
    this.initialized = true;
    logWithPersona('Memory loaded', 'success');
    
    return this.cache;
  }

  /**
   * Load a memory file from GitHub
   * @private
   */
  async _loadMemoryFile(filename, cacheKey) {
    const path = this.options.memoryPath 
      ? `${this.options.memoryPath}/${filename}`
      : filename;
    try {
      const file = await this.fs.readFile(path);
      this.cache[cacheKey] = file.content;
      return file.content;
    } catch (error) {
      // File doesn't exist yet - that's okay
      this.cache[cacheKey] = null;
      return null;
    }
  }

  /**
   * Load a daily log file
   * @private
   */
  async _loadDailyLog(which = 'today') {
    const date = which === 'today' ? new Date() : this._getYesterday();
    const filename = this._formatDate(date);
    const path = `${this.options.dailyPath}/${filename}.md`;
    
    try {
      const file = await this.fs.readFile(path);
      this.cache[which] = file.content;
      return file.content;
    } catch (error) {
      this.cache[which] = null;
      return null;
    }
  }

  /**
   * Get yesterday's date
   * @private
   */
  _getYesterday() {
    const date = new Date();
    date.setDate(date.getDate() - 1);
    return date;
  }

  /**
   * Format date as YYYY-MM-DD
   * @private
   */
  _formatDate(date) {
    return date.toISOString().split('T')[0];
  }

  /**
   * Format time as HH:MM
   * @private
   */
  _formatTime(date = new Date()) {
    return date.toTimeString().slice(0, 5);
  }

  // ============================================
  // READING MEMORY
  // ============================================

  /**
   * Get the agent's soul/personality from SOUL.md
   * Falls back to built-in persona if no custom soul exists
   * @returns {string} - Soul content or default persona
   */
  getSoul() {
    if (this.cache.soul) {
      return this.cache.soul;
    }
    // Fall back to built-in persona
    return this._getDefaultSoul();
  }

  /**
   * Generate default soul from persona.js
   * @private
   */
  _getDefaultSoul() {
    return `# ${PERSONA.name}

${PERSONA.tagline}

## Identity

${PERSONA.identity}

## Values

${PERSONA.values.map(v => `- ${v}`).join('\n')}

## Boundaries

${PERSONA.boundaries.map(b => `- ${b}`).join('\n')}

## Style

- Emoji usage: ${PERSONA.style.emoji}
- Verbosity: ${PERSONA.style.verbosity}
- Formality: ${PERSONA.style.formality}
- Humor: ${PERSONA.style.humor}
`;
  }

  /**
   * Get user profile from USER.md
   * @returns {string|null}
   */
  getUser() {
    return this.cache.user;
  }

  /**
   * Get agent identity from IDENTITY.md
   * @returns {string|null}
   */
  getIdentity() {
    return this.cache.identity;
  }

  /**
   * Get curated long-term memory from MEMORY.md
   * @returns {string|null}
   */
  getMemory() {
    return this.cache.memory;
  }

  /**
   * Get today's daily log
   * @returns {string|null}
   */
  getToday() {
    return this.cache.today;
  }

  /**
   * Get yesterday's daily log
   * @returns {string|null}
   */
  getYesterday() {
    return this.cache.yesterday;
  }

  /**
   * Build complete memory context for prompt injection
   * @param {Object} options - What to include
   * @returns {string} - Formatted memory context
   */
  buildMemoryContext(options = {}) {
    const {
      includeSoul = true,
      includeUser = true,
      includeIdentity = true,
      includeMemory = true,
      includeAgents = true,
      includeDailyLogs = true
    } = options;

    const sections = [];

    if (includeSoul) {
      const soul = this.getSoul();
      if (soul) {
        sections.push(`## Agent Soul\n\n${soul}`);
      }
    }

    if (includeIdentity && this.cache.identity) {
      sections.push(`## Agent Identity\n\n${this.cache.identity}`);
    }

    if (includeAgents && this.cache.agents) {
      sections.push(`## Workspace Guidelines\n\n${this.cache.agents}`);
    }

    if (includeUser && this.cache.user) {
      sections.push(`## About the User\n\n${this.cache.user}`);
    }

    if (includeMemory && this.cache.memory) {
      sections.push(`## Long-term Memory\n\n${this.cache.memory}`);
    }

    if (includeDailyLogs) {
      const dailyContext = this._buildDailyContext();
      if (dailyContext) {
        sections.push(`## Recent Context\n\n${dailyContext}`);
      }
    }

    return sections.join('\n\n---\n\n');
  }

  /**
   * Build context from daily logs
   * @private
   */
  _buildDailyContext() {
    const parts = [];
    
    if (this.cache.yesterday) {
      parts.push(`### Yesterday\n\n${this._summarizeDailyLog(this.cache.yesterday)}`);
    }
    
    if (this.cache.today) {
      parts.push(`### Today\n\n${this.cache.today}`);
    }
    
    return parts.length > 0 ? parts.join('\n\n') : null;
  }

  /**
   * Summarize a daily log (keep last few entries for yesterday)
   * @private
   */
  _summarizeDailyLog(content) {
    // Keep only the last 5 entries from yesterday
    const lines = content.split('\n');
    const entries = [];
    let currentEntry = [];
    
    for (const line of lines) {
      if (line.startsWith('## ') && currentEntry.length > 0) {
        entries.push(currentEntry.join('\n'));
        currentEntry = [line];
      } else {
        currentEntry.push(line);
      }
    }
    if (currentEntry.length > 0) {
      entries.push(currentEntry.join('\n'));
    }
    
    // Return last 5 entries
    return entries.slice(-5).join('\n\n');
  }

  // ============================================
  // WRITING MEMORY
  // ============================================

  /**
   * Write to today's daily log (append-only)
   * @param {string} entry - The entry to add
   * @param {string} category - Optional category (Task, Note, Learned, etc.)
   * @returns {Promise<void>}
   */
  async writeDailyLog(entry, category = 'Note') {
    const date = new Date();
    const filename = this._formatDate(date);
    const time = this._formatTime(date);
    const path = `${this.options.dailyPath}/${filename}.md`;
    
    // Format the entry
    const formattedEntry = `## ${time} - ${category}\n\n${entry}\n`;
    
    let content;
    if (this.cache.today) {
      // Append to existing
      content = `${this.cache.today}\n${formattedEntry}`;
    } else {
      // Create new daily log
      content = `# Daily Log - ${filename}\n\n${formattedEntry}`;
    }
    
    try {
      await this.fs.writeFile(path, content, `Daily log: ${category}`);
      this.cache.today = content;
      logWithPersona(`Added to daily log: ${category}`, 'success');
    } catch (error) {
      logWithPersona(`Failed to write daily log: ${error.message}`, 'error');
      throw error;
    }
  }

  /**
   * Write to long-term memory (MEMORY.md)
   * @param {string} entry - The memory to save
   * @param {string} category - Optional category
   * @returns {Promise<void>}
   */
  async writeMemory(entry, category = 'General') {
    const filename = MEMORY_FILES.MEMORY;
    const path = this.options.memoryPath 
      ? `${this.options.memoryPath}/${filename}`
      : filename;
    const timestamp = new Date().toISOString().split('T')[0];
    
    const formattedEntry = `### ${category} (${timestamp})\n\n${entry}\n`;
    
    let content;
    if (this.cache.memory) {
      // Append to existing
      content = `${this.cache.memory}\n${formattedEntry}`;
    } else {
      // Create new memory file
      content = `# Long-term Memory\n\nCurated memories and important information.\n\n${formattedEntry}`;
    }
    
    try {
      await this.fs.writeFile(path, content, `Remember: ${category}`);
      this.cache.memory = content;
      logWithPersona(`Saved to long-term memory: ${category}`, 'success');
    } catch (error) {
      logWithPersona(`Failed to save memory: ${error.message}`, 'error');
      throw error;
    }
  }

  /**
   * Update user profile (USER.md)
   * @param {string} content - New user profile content
   * @returns {Promise<void>}
   */
  async writeUser(content) {
    const filename = MEMORY_FILES.USER;
    const path = this.options.memoryPath 
      ? `${this.options.memoryPath}/${filename}`
      : filename;
    
    try {
      await this.fs.writeFile(path, content, 'Update user profile');
      this.cache.user = content;
      logWithPersona('Updated user profile', 'success');
    } catch (error) {
      logWithPersona(`Failed to update user: ${error.message}`, 'error');
      throw error;
    }
  }

  /**
   * Update agent soul (SOUL.md)
   * @param {string} content - New soul content
   * @returns {Promise<void>}
   */
  async writeSoul(content) {
    const filename = MEMORY_FILES.SOUL;
    const path = this.options.memoryPath 
      ? `${this.options.memoryPath}/${filename}`
      : filename;
    
    try {
      await this.fs.writeFile(path, content, 'Update agent soul');
      this.cache.soul = content;
      logWithPersona('Updated soul', 'success');
    } catch (error) {
      logWithPersona(`Failed to update soul: ${error.message}`, 'error');
      throw error;
    }
  }

  /**
   * Update agent identity (IDENTITY.md)
   * @param {string} content - New identity content
   * @returns {Promise<void>}
   */
  async writeIdentity(content) {
    const filename = MEMORY_FILES.IDENTITY;
    const path = this.options.memoryPath 
      ? `${this.options.memoryPath}/${filename}`
      : filename;
    
    try {
      await this.fs.writeFile(path, content, 'Update agent identity');
      this.cache.identity = content;
      logWithPersona('Updated identity', 'success');
    } catch (error) {
      logWithPersona(`Failed to update identity: ${error.message}`, 'error');
      throw error;
    }
  }

  // ============================================
  // MEMORY SEARCH
  // ============================================

  /**
   * Search across all memory files
   * @param {string} query - Search query (simple text search)
   * @returns {Promise<Array<{file: string, matches: string[]}>>}
   */
  async search(query) {
    const results = [];
    const queryLower = query.toLowerCase();
    
    // Search each memory file
    const files = [
      { name: 'SOUL.md', content: this.cache.soul },
      { name: 'USER.md', content: this.cache.user },
      { name: 'IDENTITY.md', content: this.cache.identity },
      { name: 'MEMORY.md', content: this.cache.memory },
      { name: 'Today\'s Log', content: this.cache.today },
      { name: 'Yesterday\'s Log', content: this.cache.yesterday }
    ];
    
    for (const file of files) {
      if (!file.content) continue;
      
      const lines = file.content.split('\n');
      const matches = [];
      
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].toLowerCase().includes(queryLower)) {
          // Include surrounding context
          const start = Math.max(0, i - 1);
          const end = Math.min(lines.length, i + 2);
          matches.push(lines.slice(start, end).join('\n'));
        }
      }
      
      if (matches.length > 0) {
        results.push({ file: file.name, matches });
      }
    }
    
    // Also search historical daily logs
    const historicalMatches = await this._searchDailyLogs(query);
    if (historicalMatches.length > 0) {
      results.push(...historicalMatches);
    }
    
    return results;
  }

  /**
   * Search through historical daily logs
   * @private
   */
  async _searchDailyLogs(query) {
    const results = [];
    const queryLower = query.toLowerCase();
    
    try {
      const files = await this.fs.listDirectory(this.options.dailyPath);
      
      // Search last 7 days of logs (excluding today/yesterday which are cached)
      const today = this._formatDate(new Date());
      const yesterday = this._formatDate(this._getYesterday());
      
      const logsToSearch = files
        .filter(f => f.name.endsWith('.md') && 
                     f.name !== `${today}.md` && 
                     f.name !== `${yesterday}.md`)
        .slice(-7);
      
      for (const file of logsToSearch) {
        try {
          const content = await this.fs.readFile(`${this.options.dailyPath}/${file.name}`);
          const lines = content.content.split('\n');
          const matches = [];
          
          for (let i = 0; i < lines.length; i++) {
            if (lines[i].toLowerCase().includes(queryLower)) {
              const start = Math.max(0, i - 1);
              const end = Math.min(lines.length, i + 2);
              matches.push(lines.slice(start, end).join('\n'));
            }
          }
          
          if (matches.length > 0) {
            results.push({ file: file.name, matches });
          }
        } catch (e) {
          // Skip files that can't be read
        }
      }
    } catch (e) {
      // Daily logs directory might not exist
    }
    
    return results;
  }

  // ============================================
  // MEMORY FLUSH (called before session compaction)
  // ============================================

  /**
   * Flush important context to memory before session ends/compacts
   * This gives the agent a chance to save anything important
   * @param {Array<Object>} recentMessages - Recent conversation messages
   * @param {Function} summarizer - Optional LLM summarizer function
   * @returns {Promise<void>}
   */
  async flushToMemory(recentMessages, summarizer = null) {
    logWithPersona('Flushing memory...', 'action');
    
    // If we have a summarizer, use it to extract important info
    if (summarizer && recentMessages.length > 0) {
      try {
        const summary = await summarizer(recentMessages, {
          prompt: `Review this conversation and extract any important information that should be remembered for future sessions:
- User preferences or dislikes
- Important facts about the user
- Decisions made
- Tasks completed
- Technical details that might be needed again

Format as bullet points. If nothing is worth remembering, say "Nothing to remember."`
        });
        
        if (summary && !summary.toLowerCase().includes('nothing to remember')) {
          await this.writeDailyLog(summary, 'Session Summary');
        }
      } catch (e) {
        logWithPersona(`Summarization failed: ${e.message}`, 'warning');
      }
    }
    
    // Save today's log even if no summarization
    if (this.cache.today) {
      logWithPersona('Memory flushed to daily log', 'success');
    }
  }

  // ============================================
  // INITIALIZATION HELPERS
  // ============================================

  /**
   * Create default memory structure in GitHub
   * @returns {Promise<void>}
   */
  async initializeMemoryStructure() {
    logWithPersona('Creating memory structure...', 'action');
    
    // Create SOUL.md with default persona
    if (!this.cache.soul) {
      await this.writeSoul(this._getDefaultSoul());
    }
    
    // Create USER.md template
    if (!this.cache.user) {
      const userTemplate = `# User Profile

## About

<!-- Navigator will learn about you over time -->

## Preferences

- Communication style: (to be learned)
- Technical level: (to be learned)
- Timezone: (to be learned)

## Notes

<!-- Things Navigator has learned about you -->
`;
      await this.writeUser(userTemplate);
    }
    
    // Create IDENTITY.md template
    if (!this.cache.identity) {
      const identityTemplate = `# Agent Identity

**Name:** Navigator  
**Created:** ${new Date().toISOString().split('T')[0]}

## Customization

You can customize my personality by editing SOUL.md.

## Notes

<!-- Notes about this agent instance -->
`;
      await this.writeIdentity(identityTemplate);
    }
    
    logWithPersona('Memory structure initialized', 'success');
  }

  /**
   * Get memory statistics
   * @returns {Object}
   */
  getStats() {
    return {
      initialized: this.initialized,
      hasSoul: !!this.cache.soul,
      hasUser: !!this.cache.user,
      hasIdentity: !!this.cache.identity,
      hasMemory: !!this.cache.memory,
      hasTodayLog: !!this.cache.today,
      hasYesterdayLog: !!this.cache.yesterday,
      todayLogSize: this.cache.today?.length || 0,
      memorySize: this.cache.memory?.length || 0
    };
  }
}

export default MemoryManager;
