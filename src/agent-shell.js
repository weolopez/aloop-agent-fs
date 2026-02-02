// agent-shell.js
// Continuous conversation mode for browser
// Provides an interactive shell instead of one-shot execution

import AgentLoopGitHub from './AgentLoop-GitHub.js';
import { GitHubFileSystem, loadGitHubFSConfig } from './GitHubFileSystem.js';
import { SessionManager } from './session-manager.js';
import { UserProfile } from './user-profile.js';
import { analyzeGoal, formatGoalConfirmation, shouldConfirm } from './goal-alignment.js';
import { PERSONA, logWithPersona } from './persona.js';

/**
 * @typedef {Object} ShellOptions
 * @property {Function} onReady - Called when shell is initialized
 * @property {Function} onMessage - Called for each message
 * @property {Function} onStep - Called for each agent step
 * @property {Function} onThinking - Called when thinking state changes
 * @property {Function} onComplete - Called when goal is completed
 * @property {Function} onError - Called on error
 * @property {Function} onConfirmation - Called for goal confirmation
 * @property {boolean} requireConfirmation - Require confirmation for complex tasks
 */

/**
 * Interactive agent shell for continuous conversation
 */
export class AgentShell {
  /**
   * @param {ShellOptions} options - Shell configuration
   */
  constructor(options = {}) {
    this.options = {
      onReady: null,
      onMessage: null,
      onStep: null,
      onThinking: null,
      onComplete: null,
      onError: null,
      onConfirmation: null,
      requireConfirmation: true,
      ...options
    };
    
    this.fs = null;
    this.session = null;
    this.profile = null;
    this.agent = null;
    this.isReady = false;
    this.isThinking = false;
    this.pendingConfirmation = null;
  }

  /**
   * Initialize the shell - connect to GitHub, load session and profile
   * @returns {Promise<AgentShell>}
   */
  async initialize() {
    try {
      logWithPersona('Initializing...', 'info');
      
      // Load GitHub FS configuration
      const config = loadGitHubFSConfig();
      if (!config) {
        throw new Error('GitHub FS not configured. Please set up your GitHub token and repository.');
      }
      
      // Initialize GitHub file system
      this.fs = new GitHubFileSystem(config);
      
      // Initialize session manager
      this.session = new SessionManager(this.fs);
      await this.session.loadOrCreateSession('main');
      
      // Initialize user profile
      this.profile = new UserProfile(this.fs);
      await this.profile.load();
      
      // Update stats
      this.profile.incrementStat('sessionsStarted');
      
      this.isReady = true;
      
      const readyInfo = {
        sessionId: this.session.currentSession.id,
        userName: this.profile.profile.name,
        messageCount: this.session.currentSession.messageCount,
        greeting: this.profile.getGreeting()
      };
      
      this._emit('ready', readyInfo);
      logWithPersona('Ready to help.', 'success');
      
      return this;
    } catch (error) {
      logWithPersona(`Initialization failed: ${error.message}`, 'error');
      this._emit('error', error);
      throw error;
    }
  }

  /**
   * Send a message to the agent
   * @param {string} message - User message
   * @returns {Promise<string>} - Agent response
   */
  async send(message) {
    if (!this.isReady) {
      throw new Error('Shell not initialized. Call initialize() first.');
    }
    
    // Check if this is a command
    if (message.startsWith('/')) {
      return this.command(message);
    }
    
    this._setThinking(true);
    
    try {
      // Add user message to session
      await this.session.addMessage('user', message);
      this._emit('message', { role: 'user', content: message });
      
      // Analyze goal if confirmation is required
      if (this.options.requireConfirmation && this.profile.profile.preferences.confirmActions) {
        const analysis = await analyzeGoal(message);
        
        if (shouldConfirm(analysis)) {
          const confirmation = formatGoalConfirmation(analysis);
          this._emit('message', { role: 'system', content: confirmation });
          
          // If there's a confirmation callback, wait for it
          if (this.options.onConfirmation) {
            const confirmed = await this.options.onConfirmation(analysis);
            if (!confirmed) {
              this._setThinking(false);
              const cancelled = 'Goal cancelled by user.';
              await this.session.addMessage('system', cancelled);
              return cancelled;
            }
          }
          // Otherwise, proceed (UI can handle confirmation separately)
        }
      }
      
      // Track common tasks
      await this.profile.trackTask(message);
      
      // Create agent for this goal
      this.agent = new AgentLoopGitHub(message, [], {
        skipConfirmation: true, // We already confirmed above
        userProfile: this.profile.profile,
        verbose: true
      });
      
      // Hook into agent steps
      this.agent.onStep = async (step) => {
        await this.session.addMessage(step.role, step.content);
        this._emit('step', step);
      };
      
      // Run the agent
      const result = await this.agent.run();
      
      // Update stats
      this.profile.incrementStat('goalsCompleted');
      
      // Save session
      await this.session.saveSession();
      
      this._setThinking(false);
      this._emit('complete', result);
      
      return result;
    } catch (error) {
      this._setThinking(false);
      await this.session.addMessage('error', error.message);
      this._emit('error', error);
      throw error;
    }
  }

  /**
   * Process a slash command
   * @param {string} cmd - Command string (e.g., '/status')
   * @returns {Promise<string>} - Command result
   */
  async command(cmd) {
    const parts = cmd.slice(1).split(/\s+/);
    const action = parts[0].toLowerCase();
    const args = parts.slice(1);
    
    let result;
    
    switch (action) {
      case 'new':
      case 'reset':
        await this.session.startNewSession();
        result = `New session started: ${this.session.currentSession.id}`;
        break;
        
      case 'status':
        const stats = this.session.getStats();
        const profileStats = this.profile.getStats();
        result = `**Session Status**
- ID: ${stats.id}
- Messages: ${stats.messageCount}
- Started: ${new Date(stats.createdAt).toLocaleString()}
- Last Active: ${new Date(stats.lastActive).toLocaleString()}

**Profile Stats**
- Sessions: ${profileStats.sessionsStarted}
- Goals Completed: ${profileStats.goalsCompleted}
- Member Since: ${new Date(profileStats.memberSince).toLocaleDateString()}`;
        break;
        
      case 'name':
        if (args.length === 0) {
          result = this.profile.profile.name 
            ? `Your name is ${this.profile.profile.name}`
            : 'No name set. Use /name <your name> to set it.';
        } else {
          const name = args.join(' ');
          await this.profile.setName(name);
          result = `Nice to meet you, ${name}! I'll remember that.`;
        }
        break;
        
      case 'verbose':
        const level = args[0] || 'adaptive';
        if (['terse', 'adaptive', 'verbose'].includes(level)) {
          await this.profile.setPreference('verbosity', level);
          result = `Verbosity set to: ${level}`;
        } else {
          result = 'Valid levels: terse, adaptive, verbose';
        }
        break;
        
      case 'confirm':
        const confirmSetting = args[0] === 'off' ? false : true;
        await this.profile.setPreference('confirmActions', confirmSetting);
        result = confirmSetting 
          ? 'Will ask for confirmation on complex/destructive actions.'
          : 'Will not ask for confirmation (proceed with caution).';
        break;
        
      case 'learn':
        if (args.length === 0) {
          const facts = this.profile.profile.learned.slice(-5);
          result = facts.length > 0
            ? `**Recent things I've learned:**\n${facts.map(f => `- ${f.fact}`).join('\n')}`
            : "I haven't learned anything yet. I'll remember things as we interact.";
        } else {
          const fact = args.join(' ');
          await this.profile.learn(fact);
          result = `Got it, I'll remember: "${fact}"`;
        }
        break;
        
      case 'forget':
        await this.profile.clearLearned();
        result = 'Cleared all learned data. Starting fresh!';
        break;
        
      case 'compact':
        await this.session.compactHistory();
        result = 'Session history compacted.';
        break;
        
      case 'sessions':
        const sessions = await this.session.listSessions();
        result = sessions.length > 0
          ? `**Available sessions:**\n${sessions.map(s => `- ${s}`).join('\n')}`
          : 'No saved sessions found.';
        break;
        
      case 'load':
        if (args.length === 0) {
          result = 'Usage: /load <session-id>';
        } else {
          await this.session.loadOrCreateSession(args[0]);
          result = `Loaded session: ${args[0]}`;
        }
        break;
        
      case 'export':
        result = `**Profile Export:**\n\`\`\`json\n${this.profile.exportProfile()}\n\`\`\``;
        break;
        
      case 'help':
        result = `**${PERSONA.name} Commands**

**Session Management:**
- \`/new\`, \`/reset\` - Start a new session
- \`/status\` - Show session and profile stats
- \`/sessions\` - List all saved sessions
- \`/load <id>\` - Load a saved session
- \`/compact\` - Compress old messages

**Profile:**
- \`/name <name>\` - Set your name
- \`/verbose <level>\` - Set verbosity (terse/adaptive/verbose)
- \`/confirm <on/off>\` - Toggle action confirmation
- \`/learn <fact>\` - Teach me something
- \`/forget\` - Clear learned data
- \`/export\` - Export your profile

**Help:**
- \`/help\` - Show this message`;
        break;
        
      default:
        result = `Unknown command: /${action}. Type /help for available commands.`;
    }
    
    this._emit('message', { role: 'system', content: result });
    return result;
  }

  /**
   * Set thinking state and emit event
   * @private
   */
  _setThinking(isThinking) {
    this.isThinking = isThinking;
    this._emit('thinking', isThinking);
  }

  /**
   * Emit an event to callbacks
   * @private
   */
  _emit(event, data) {
    const callbackName = `on${event.charAt(0).toUpperCase()}${event.slice(1)}`;
    const callback = this.options[callbackName];
    if (callback && typeof callback === 'function') {
      callback(data);
    }
  }

  /**
   * Get the current session
   * @returns {Object|null}
   */
  getSession() {
    return this.session?.currentSession || null;
  }

  /**
   * Get the current profile
   * @returns {Object|null}
   */
  getProfile() {
    return this.profile?.profile || null;
  }

  /**
   * Check if shell is ready
   * @returns {boolean}
   */
  ready() {
    return this.isReady;
  }

  /**
   * Check if agent is currently thinking
   * @returns {boolean}
   */
  thinking() {
    return this.isThinking;
  }
}

export default AgentShell;
