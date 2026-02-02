// session-manager.js
// Persistent session management for continuous assistant mode
// Sessions are stored in GitHub for cross-device persistence
// Integrates with MemoryManager for memory flush before compaction

import { logWithPersona } from './persona.js';

/**
 * @typedef {Object} Session
 * @property {string} id - Unique session identifier
 * @property {string} createdAt - ISO timestamp of creation
 * @property {string} lastActive - ISO timestamp of last activity
 * @property {number} messageCount - Total messages in session
 * @property {Array<{role: string, content: string, timestamp: string}>} messages - Message history
 * @property {Array<{timestamp: string, summary: string, messagesCompacted: number}>} summaries - Compacted history
 * @property {Object} context - Session-specific context data
 */

/**
 * Manages persistent sessions stored in GitHub
 */
export class SessionManager {
  /**
   * @param {Object} fs - GitHubFileSystem instance
   * @param {Object} options - Configuration options
   * @param {string} options.sessionPath - Path for session storage (default: 'agent/sessions')
   * @param {number} options.maxMessagesBeforeCompaction - Trigger compaction after this many messages
   * @param {number} options.autoSaveInterval - Auto-save every N messages
   * @param {Object} options.memoryManager - MemoryManager instance for memory flush
   */
  constructor(fs, options = {}) {
    this.fs = fs;
    this.options = {
      sessionPath: 'agent/sessions',
      maxMessagesBeforeCompaction: 50,
      autoSaveInterval: 5,
      memoryManager: null,
      ...options
    };
    this.currentSession = null;
    this.isDirty = false;
    this.memoryManager = this.options.memoryManager;
  }

  /**
   * Set the memory manager (can be set after construction)
   * @param {Object} memoryManager - MemoryManager instance
   */
  setMemoryManager(memoryManager) {
    this.memoryManager = memoryManager;
  }

  /**
   * Load an existing session or create a new one
   * @param {string} sessionId - Session identifier (default: 'main')
   * @returns {Promise<Session>} - The loaded or created session
   */
  async loadOrCreateSession(sessionId = 'main') {
    const path = `${this.options.sessionPath}/${sessionId}.json`;
    
    try {
      const file = await this.fs.readFile(path);
      this.currentSession = JSON.parse(file.content);
      
      // Ensure messages array exists
      if (!this.currentSession.messages) {
        this.currentSession.messages = [];
      }
      
      logWithPersona(`Resumed session: ${sessionId} (${this.currentSession.messageCount} messages)`, 'info');
    } catch (error) {
      // Session doesn't exist, create new one
      this.currentSession = this._createNewSession(sessionId);
      logWithPersona(`New session: ${sessionId}`, 'info');
    }
    
    this.isDirty = false;
    return this.currentSession;
  }

  /**
   * Create a new session object
   * @private
   */
  _createNewSession(sessionId) {
    return {
      id: sessionId,
      createdAt: new Date().toISOString(),
      lastActive: new Date().toISOString(),
      messageCount: 0,
      messages: [],
      summaries: [],
      context: {}
    };
  }

  /**
   * Save current session to GitHub
   * @param {string} commitMessage - Optional commit message
   * @returns {Promise<void>}
   */
  async saveSession(commitMessage = null) {
    if (!this.currentSession) {
      throw new Error('No active session to save');
    }
    
    this.currentSession.lastActive = new Date().toISOString();
    const path = `${this.options.sessionPath}/${this.currentSession.id}.json`;
    const message = commitMessage || `Update session ${this.currentSession.id}`;
    
    try {
      await this.fs.writeFile(
        path,
        JSON.stringify(this.currentSession, null, 2),
        message
      );
      this.isDirty = false;
      logWithPersona(`Session saved (${this.currentSession.messageCount} messages)`, 'success');
    } catch (error) {
      logWithPersona(`Failed to save session: ${error.message}`, 'error');
      throw error;
    }
  }

  /**
   * Add a message to the current session
   * @param {string} role - Message role (user, assistant, tool, system)
   * @param {string} content - Message content
   * @param {Object} metadata - Optional metadata
   * @returns {Promise<void>}
   */
  async addMessage(role, content, metadata = {}) {
    if (!this.currentSession) {
      throw new Error('No active session. Call loadOrCreateSession first.');
    }
    
    this.currentSession.messageCount++;
    this.currentSession.messages.push({
      role,
      content,
      timestamp: new Date().toISOString(),
      ...metadata
    });
    
    this.isDirty = true;
    
    // Auto-save periodically
    if (this.currentSession.messageCount % this.options.autoSaveInterval === 0) {
      await this.saveSession();
    }
    
    // Check if compaction is needed
    if (this.currentSession.messages.length >= this.options.maxMessagesBeforeCompaction) {
      logWithPersona('Session getting long, consider running /compact', 'warning');
    }
  }

  /**
   * Compact history by summarizing old messages
   * IMPORTANT: Flushes memory before compaction to preserve important context
   * @param {Function} summarizer - Async function that takes messages and returns summary
   * @returns {Promise<void>}
   */
  async compactHistory(summarizer) {
    if (!this.currentSession || this.currentSession.messages.length === 0) {
      return;
    }
    
    // Keep last 10 messages, summarize the rest
    const messagesToCompact = this.currentSession.messages.slice(0, -10);
    const messagesToKeep = this.currentSession.messages.slice(-10);
    
    if (messagesToCompact.length < 10) {
      logWithPersona('Not enough messages to compact', 'info');
      return;
    }
    
    logWithPersona(`Compacting ${messagesToCompact.length} messages...`, 'action');
    
    // MEMORY FLUSH: Before compacting, give the agent a chance to save important info
    if (this.memoryManager) {
      logWithPersona('Flushing memory before compaction...', 'action');
      try {
        await this.memoryManager.flushToMemory(messagesToCompact, summarizer);
      } catch (e) {
        logWithPersona(`Memory flush warning: ${e.message}`, 'warning');
      }
    }
    
    // Generate summary
    let summary;
    if (summarizer) {
      summary = await summarizer(messagesToCompact);
    } else {
      // Default simple summary
      summary = `Conversation covering ${messagesToCompact.length} messages. ` +
                `Topics: ${this._extractTopics(messagesToCompact)}`;
    }
    
    // Store compaction record
    this.currentSession.summaries.push({
      timestamp: new Date().toISOString(),
      summary,
      messagesCompacted: messagesToCompact.length
    });
    
    // Replace messages with kept ones
    this.currentSession.messages = messagesToKeep;
    
    await this.saveSession('Compact session history');
    logWithPersona(`Compacted ${messagesToCompact.length} messages into summary`, 'success');
  }

  /**
   * Extract simple topics from messages for default summarization
   * @private
   */
  _extractTopics(messages) {
    // Simple keyword extraction
    const userMessages = messages
      .filter(m => m.role === 'user')
      .map(m => m.content)
      .join(' ');
    
    // Extract words that might be topics (capitalized, longer than 4 chars)
    const words = userMessages.split(/\s+/);
    const topics = words
      .filter(w => w.length > 4 && /^[A-Z]/.test(w))
      .slice(0, 5);
    
    return topics.length > 0 ? topics.join(', ') : 'general discussion';
  }

  /**
   * Get context from summaries for prompt injection
   * @returns {string} - Formatted context string
   */
  getHistoricalContext() {
    if (!this.currentSession || this.currentSession.summaries.length === 0) {
      return '';
    }
    
    const recentSummaries = this.currentSession.summaries.slice(-3);
    const context = recentSummaries
      .map(s => `[${new Date(s.timestamp).toLocaleDateString()}] ${s.summary}`)
      .join('\n');
    
    return `**Previous Session Context:**\n${context}`;
  }

  /**
   * Get session statistics
   * @returns {Object} - Session stats
   */
  getStats() {
    if (!this.currentSession) {
      return null;
    }
    
    return {
      id: this.currentSession.id,
      messageCount: this.currentSession.messageCount,
      currentMessages: this.currentSession.messages.length,
      compactions: this.currentSession.summaries.length,
      createdAt: this.currentSession.createdAt,
      lastActive: this.currentSession.lastActive,
      isDirty: this.isDirty
    };
  }

  /**
   * List all available sessions
   * @returns {Promise<string[]>} - Array of session IDs
   */
  async listSessions() {
    try {
      const files = await this.fs.listDirectory(this.options.sessionPath);
      return files
        .filter(f => f.name.endsWith('.json'))
        .map(f => f.name.replace('.json', ''));
    } catch (error) {
      // Directory might not exist yet
      return [];
    }
  }

  /**
   * Delete a session
   * @param {string} sessionId - Session to delete
   * @returns {Promise<void>}
   */
  async deleteSession(sessionId) {
    const path = `${this.options.sessionPath}/${sessionId}.json`;
    await this.fs.deleteFile(path, `Delete session ${sessionId}`);
    
    if (this.currentSession && this.currentSession.id === sessionId) {
      this.currentSession = null;
    }
    
    logWithPersona(`Deleted session: ${sessionId}`, 'success');
  }

  /**
   * Start a fresh session (preserves old one in storage)
   * @returns {Promise<Session>}
   */
  async startNewSession() {
    // Save current session if dirty
    if (this.currentSession && this.isDirty) {
      await this.saveSession();
    }
    
    // Create new session with timestamp ID
    const newId = `session-${Date.now()}`;
    return this.loadOrCreateSession(newId);
  }
}

export default SessionManager;
