// AgentLoop-GitHub.js
// Enhanced AgentLoop that uses GitHub as persistent file system.
// This version integrates githubFSTools to enable the agent to save/retrieve data from a GitHub repo.
// Now includes Navigator persona for a personality-driven assistant experience.

import { fetchGemini } from './llm-tools.js';
import { githubFSTools, getGitHubFSToolsDescription } from './github-fs-tools.js';
import { getSystemPersona, logWithPersona, PERSONA } from './persona.js';

/**
 * @typedef {Object} AgentState
 * @property {string} goal - The user goal.
 * @property {Array<{role: string, content: string}>} history - Conversation history.
 * @property {number} stepsTaken - Number of iterations completed.
 * @property {string} status - Current status ('running', 'completed', 'max_iterations_reached', 'error').
 */

/**
 * @typedef {Object} Tool
 * @property {string} name - Unique tool name.
 * @property {string} description - Human-readable description.
 * @property {Function} execute - Async function that takes params object and returns output.
 * @property {Object} schema - JSON Schema for params validation.
 */

class AgentLoopGitHub {
  /**
   * @param {string} user_goal - The initial user goal.
   * @param {Tool[]} [additionalTools=[]] - Additional tools beyond GitHub FS tools.
   * @param {Object} [options={}] - Configuration options.
   * @param {number} [options.maxIterations=25] - Max loop iterations to prevent runaway.
   * @param {boolean} [options.verbose=true] - Enable verbose logging.
   * @param {Object} [options.userProfile=null] - User profile for personalization.
   * @param {boolean} [options.skipConfirmation=false] - Skip goal confirmation step.
   */
  constructor(user_goal, additionalTools = [], options = {}) {
    this.user_goal = user_goal;
    this.history = [{ role: 'user', content: user_goal }];
    this.stepsTaken = 0;
    
    // Merge options with defaults
    this.options = {
      maxIterations: 25,
      verbose: true,
      userProfile: null,
      skipConfirmation: false,
      ...options
    };
    this.maxIterations = this.options.maxIterations;
    
    // Combine GitHub FS tools with any additional tools
    const allTools = [...githubFSTools, ...additionalTools];
    this.tools = new Map(allTools.map(tool => [tool.name, tool]));
    
    this.status = 'running';
    this.db = null;
    this.onStep = null; // Callback for steps
    this.onGoalAnalysis = null; // Callback for goal analysis (Phase 2)
    this.initDB();
    
    if (this.options.verbose) {
      logWithPersona(`Initialized with goal: "${user_goal}"`, 'info');
    }
  }

  // Initialize IndexedDB for persisting AgentState.
  initDB() {
    const request = window.indexedDB.open('AgentDB', 1);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('states')) {
        db.createObjectStore('states', { keyPath: 'goal' });
      }
    };
    request.onsuccess = (event) => {
      this.db = event.target.result;
      this.saveState();
    };
    request.onerror = (event) => {
      console.error('IndexedDB error:', event.target.error);
    };
  }

  // Save current state to IndexedDB.
  saveState() {
    if (!this.db) return;
    const transaction = this.db.transaction(['states'], 'readwrite');
    const store = transaction.objectStore('states');
    store.put({
      goal: this.user_goal,
      history: this.history,
      stepsTaken: this.stepsTaken,
      status: this.status
    });
  }

  // Build the prompt for the LLM, including persona, history and instructions.
  buildPrompt() {
    const toolDescriptions = Array.from(this.tools.values())
      .map(t => `${t.name}: ${t.description}`)
      .join('\n');

    const fsDescription = getGitHubFSToolsDescription();
    
    // Get persona with optional user profile
    const persona = getSystemPersona(this.options.userProfile);

    let prompt = `${persona}

---

YOUR CURRENT GOAL: ${this.user_goal}

${fsDescription}

AVAILABLE TOOLS:
${toolDescriptions}

REASONING FRAMEWORK:
1. Understand the goal deeply before acting
2. Check what already exists (search/list) before creating new things
3. Think out loud in <thought> tags - show your reasoning
4. Take exactly ONE action per turn in <action> tags with JSON: {"tool": "tool_name", "params": {...}}
5. When the goal is fully achieved, provide your answer in <final_answer> tags
6. Do not output anything outside of these tags

CONVERSATION HISTORY:
`;
    this.history.forEach(msg => {
      prompt += `${msg.role.toUpperCase()}: ${msg.content}\n\n`;
    });
    
    return prompt;
  }

  // Call the LLM with the built prompt
  async callLLM(prompt) {
    try {
      const msg = await fetchGemini(prompt);
      return msg.candidates[0].content.parts[0].text;
    } catch (e) {
      console.error("LLM Call failed", e);
      throw e;
    }
  }

  // Parse the LLM response to extract thought, action, or final answer.
  parseResponse(response) {
    const thoughtMatch = response.match(/<thought>(.*?)<\/thought>/s);
    const actionMatch = response.match(/<action>(.*?)<\/action>/s);
    const finalMatch = response.match(/<final_answer>(.*?)<\/final_answer>/s);

    const thought = thoughtMatch ? thoughtMatch[1].trim() : '';

    if (finalMatch) {
      return { thought, isFinal: true, finalAnswer: finalMatch[1].trim(), action: null };
    } else if (actionMatch) {
      const start = actionMatch[1].indexOf('{');
      const end = actionMatch[1].lastIndexOf('}');
      if (start !== -1 && end !== -1) {
        try {
          const jsonStr = actionMatch[1].substring(start, end + 1);
          const actionJson = JSON.parse(jsonStr);
          return { thought, isFinal: false, finalAnswer: null, action: actionJson };
        } catch (error) {
          throw new Error(`Invalid action JSON: ${error.message}`);
        }
      } else {
        try {
          const actionJson = JSON.parse(actionMatch[1].trim());
          return { thought, isFinal: false, finalAnswer: null, action: actionJson };
        } catch (error) {
          throw new Error(`Invalid action JSON: ${error.message}`);
        }
      }
    } else {
      throw new Error('Invalid LLM response format: Missing <action> or <final_answer>');
    }
  }

  // The recursive loop function
  async run() {
    if (this.stepsTaken >= this.maxIterations) {
      this.status = 'max_iterations_reached';
      this.saveState();
      logWithPersona(`Max iterations (${this.maxIterations}) reached`, 'warning');
      return 'Error: Max iterations reached. Goal not achieved.';
    }

    this.stepsTaken++;
    
    if (this.options.verbose) {
      logWithPersona(`Step ${this.stepsTaken}/${this.maxIterations}`, 'info');
    }

    const prompt = this.buildPrompt();
    let response;
    try {
      response = await this.callLLM(prompt);
    } catch (error) {
      this.status = 'error';
      this.saveState();
      logWithPersona(`LLM call failed: ${error.message}`, 'error');
      return `Error calling LLM: ${error.message}`;
    }

    let parsed;
    try {
      parsed = this.parseResponse(response);
    } catch (error) {
      const errMsg = { role: 'system', content: `Parse error: ${error.message}` };
      this.history.push(errMsg);
      if (this.onStep) this.onStep(errMsg);
      logWithPersona(`Parse error, retrying: ${error.message}`, 'warning');
      this.saveState();
      return await this.run(); // Recurse to let LLM self-correct
    }

    // Append thought to history
    if (parsed.thought) {
      const msg = { role: 'assistant', content: `<thought>${parsed.thought}</thought>` };
      this.history.push(msg);
      if (this.onStep) this.onStep(msg);
      if (this.options.verbose) {
        logWithPersona(parsed.thought.substring(0, 100) + (parsed.thought.length > 100 ? '...' : ''), 'thought');
      }
    }

    if (parsed.isFinal) {
      const finalMsg = { role: 'assistant', content: `<final_answer>${parsed.finalAnswer}</final_answer>` };
      this.history.push(finalMsg);
      if (this.onStep) this.onStep(finalMsg);
      
      this.status = 'completed';
      this.saveState();
      logWithPersona('Goal completed', 'success');
      return parsed.finalAnswer;
    } else {
      let toolOutput;
      
      const actionMsg = { role: 'assistant', content: `<action>${JSON.stringify(parsed.action)}</action>` };
      this.history.push(actionMsg);
      if (this.onStep) this.onStep(actionMsg);
      
      if (this.options.verbose) {
        logWithPersona(`Executing: ${parsed.action.tool}`, 'action');
      }

      try {
        const tool = this.tools.get(parsed.action.tool);
        if (!tool) {
          throw new Error(`Tool not found: ${parsed.action.tool}`);
        }
        toolOutput = await tool.execute(parsed.action.params);
      } catch (error) {
        toolOutput = `Tool error: ${error.message}`;
        logWithPersona(`Tool error: ${error.message}`, 'error');
      }

      const toolMsg = { role: 'tool', content: toolOutput };
      this.history.push(toolMsg);
      if (this.onStep) this.onStep(toolMsg);

      this.saveState();
      return await this.run();
    }
  }
}

export default AgentLoopGitHub;
