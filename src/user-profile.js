// user-profile.js
// Remember user preferences across sessions
// Stores profile in GitHub for persistence

import { logWithPersona } from './persona.js';

/**
 * @typedef {Object} UserProfile
 * @property {string|null} name - User's name
 * @property {Object} preferences - User preferences
 * @property {Array<{fact: string, learnedAt: string}>} learned - Things learned about user
 * @property {string[]} dislikes - Things the user doesn't like
 * @property {string[]} commonTasks - Frequently requested tasks
 * @property {Object} stats - Usage statistics
 */

/**
 * Manages persistent user profile stored in GitHub
 */
export class UserProfile {
  /**
   * @param {Object} fs - GitHubFileSystem instance
   * @param {Object} options - Configuration options
   */
  constructor(fs, options = {}) {
    this.fs = fs;
    this.options = {
      profilePath: 'agent/profile.json',
      maxLearned: 100,      // Max learned facts to keep
      maxCommonTasks: 20,   // Max common tasks to track
      ...options
    };
    this.profile = null;
    this.isDirty = false;
  }

  /**
   * Load user profile from GitHub or create default
   * @returns {Promise<UserProfile>}
   */
  async load() {
    try {
      const file = await this.fs.readFile(this.options.profilePath);
      this.profile = JSON.parse(file.content);
      logWithPersona(`Profile loaded: ${this.profile.name || 'Anonymous User'}`, 'info');
    } catch (error) {
      // Create default profile
      this.profile = this._createDefaultProfile();
      logWithPersona('Created new user profile', 'info');
    }
    
    this.isDirty = false;
    return this.profile;
  }

  /**
   * Create default profile structure
   * @private
   */
  _createDefaultProfile() {
    return {
      name: null,
      createdAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      preferences: {
        verbosity: 'adaptive',       // terse | adaptive | verbose
        confirmActions: true,        // Ask before destructive actions
        autoSave: true,              // Auto-save sessions
        timezone: null,              // User's timezone
        codeStyle: null,             // Preferred code style
        language: 'en'               // Preferred language
      },
      learned: [],                   // Facts learned about user
      dislikes: [],                  // Things user doesn't like
      commonTasks: [],               // Frequently requested tasks
      stats: {
        sessionsStarted: 0,
        goalsCompleted: 0,
        totalMessages: 0,
        firstInteraction: new Date().toISOString()
      }
    };
  }

  /**
   * Save profile to GitHub
   * @returns {Promise<void>}
   */
  async save() {
    if (!this.profile) {
      throw new Error('No profile loaded');
    }
    
    this.profile.lastUpdated = new Date().toISOString();
    
    try {
      await this.fs.writeFile(
        this.options.profilePath,
        JSON.stringify(this.profile, null, 2),
        'Update user profile'
      );
      this.isDirty = false;
    } catch (error) {
      logWithPersona(`Failed to save profile: ${error.message}`, 'error');
      throw error;
    }
  }

  /**
   * Set user's name
   * @param {string} name 
   */
  async setName(name) {
    this.profile.name = name;
    this.isDirty = true;
    await this.save();
    logWithPersona(`Nice to meet you, ${name}!`, 'success');
  }

  /**
   * Update a preference
   * @param {string} key - Preference key
   * @param {any} value - Preference value
   */
  async setPreference(key, value) {
    if (!(key in this.profile.preferences)) {
      logWithPersona(`Unknown preference: ${key}`, 'warning');
      return;
    }
    
    this.profile.preferences[key] = value;
    this.isDirty = true;
    await this.save();
  }

  /**
   * Learn a new fact about the user
   * @param {string} fact - The fact to remember
   */
  async learn(fact) {
    // Check for duplicates
    const exists = this.profile.learned.some(l => 
      l.fact.toLowerCase() === fact.toLowerCase()
    );
    
    if (exists) return;
    
    this.profile.learned.push({
      fact,
      learnedAt: new Date().toISOString()
    });
    
    // Trim old facts if needed
    if (this.profile.learned.length > this.options.maxLearned) {
      this.profile.learned = this.profile.learned.slice(-this.options.maxLearned);
    }
    
    this.isDirty = true;
    await this.save();
  }

  /**
   * Record something the user doesn't like
   * @param {string} item - The disliked item
   */
  async addDislike(item) {
    if (!this.profile.dislikes.includes(item)) {
      this.profile.dislikes.push(item);
      this.isDirty = true;
      await this.save();
    }
  }

  /**
   * Track a common task
   * @param {string} task - The task description
   */
  async trackTask(task) {
    // Find existing or add new
    const normalized = task.toLowerCase().trim();
    const existing = this.profile.commonTasks.find(t => 
      t.task.toLowerCase() === normalized
    );
    
    if (existing) {
      existing.count++;
      existing.lastUsed = new Date().toISOString();
    } else {
      this.profile.commonTasks.push({
        task,
        count: 1,
        firstUsed: new Date().toISOString(),
        lastUsed: new Date().toISOString()
      });
    }
    
    // Sort by count and trim
    this.profile.commonTasks.sort((a, b) => b.count - a.count);
    if (this.profile.commonTasks.length > this.options.maxCommonTasks) {
      this.profile.commonTasks = this.profile.commonTasks.slice(0, this.options.maxCommonTasks);
    }
    
    this.isDirty = true;
  }

  /**
   * Increment a stat counter
   * @param {string} stat - Stat key
   * @param {number} amount - Amount to increment
   */
  incrementStat(stat, amount = 1) {
    if (stat in this.profile.stats) {
      this.profile.stats[stat] += amount;
      this.isDirty = true;
    }
  }

  /**
   * Get context for prompt injection
   * @returns {string}
   */
  getContextForPrompt() {
    if (!this.profile) return '';
    
    const parts = [];
    
    if (this.profile.name) {
      parts.push(`User's name: ${this.profile.name}`);
    }
    
    if (this.profile.preferences.verbosity !== 'adaptive') {
      parts.push(`Preferred verbosity: ${this.profile.preferences.verbosity}`);
    }
    
    if (this.profile.preferences.timezone) {
      parts.push(`Timezone: ${this.profile.preferences.timezone}`);
    }
    
    if (this.profile.dislikes.length > 0) {
      parts.push(`Dislikes: ${this.profile.dislikes.join(', ')}`);
    }
    
    // Recent learnings
    if (this.profile.learned.length > 0) {
      const recentFacts = this.profile.learned
        .slice(-5)
        .map(l => l.fact)
        .join('; ');
      parts.push(`Things I know about the user: ${recentFacts}`);
    }
    
    // Top tasks
    if (this.profile.commonTasks.length > 0) {
      const topTasks = this.profile.commonTasks
        .slice(0, 3)
        .map(t => t.task)
        .join(', ');
      parts.push(`Frequently requested: ${topTasks}`);
    }
    
    if (parts.length === 0) return '';
    
    return `**About This User:**\n${parts.map(p => `- ${p}`).join('\n')}`;
  }

  /**
   * Get a greeting appropriate for the user
   * @returns {string}
   */
  getGreeting() {
    if (!this.profile) return 'Hello!';
    
    const hour = new Date().getHours();
    let timeGreeting = 'Hello';
    if (hour < 12) timeGreeting = 'Good morning';
    else if (hour < 17) timeGreeting = 'Good afternoon';
    else timeGreeting = 'Good evening';
    
    if (this.profile.name) {
      return `${timeGreeting}, ${this.profile.name}!`;
    }
    
    return `${timeGreeting}!`;
  }

  /**
   * Get user stats summary
   * @returns {Object}
   */
  getStats() {
    if (!this.profile) return null;
    
    return {
      ...this.profile.stats,
      factsLearned: this.profile.learned.length,
      commonTasksTracked: this.profile.commonTasks.length,
      memberSince: this.profile.createdAt
    };
  }

  /**
   * Clear all learned data (privacy feature)
   */
  async clearLearned() {
    this.profile.learned = [];
    this.profile.dislikes = [];
    this.profile.commonTasks = [];
    this.isDirty = true;
    await this.save();
    logWithPersona('Cleared all learned data', 'success');
  }

  /**
   * Export profile for backup
   * @returns {string}
   */
  exportProfile() {
    return JSON.stringify(this.profile, null, 2);
  }

  /**
   * Import profile from backup
   * @param {string} jsonString 
   */
  async importProfile(jsonString) {
    try {
      const imported = JSON.parse(jsonString);
      // Merge with defaults to ensure structure
      this.profile = {
        ...this._createDefaultProfile(),
        ...imported,
        preferences: {
          ...this._createDefaultProfile().preferences,
          ...(imported.preferences || {})
        }
      };
      await this.save();
      logWithPersona('Profile imported successfully', 'success');
    } catch (error) {
      logWithPersona(`Failed to import profile: ${error.message}`, 'error');
      throw error;
    }
  }
}

export default UserProfile;
