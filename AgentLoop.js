// AgentLoop.js
// This class implements the core "Agentic Loop" (inspired by OpenClaw's "Lobster Shell") for an autonomous agent runner.
// It handles the lifecycle of a single user goal through a recursive execution cycle: Observation (input/history) -> Thought (LLM decision) -> Action (tool call) -> Result (tool output) -> Repeat.
// The loop is recursive with a max iteration limit to prevent infinite recursion.
// State is persisted in IndexedDB for durability across sessions or crashes.
// Tools are registered as a map for quick lookup.
// LLM calls are placeholders; in a real implementation, integrate with an API like OpenAI or xAI.
// Parsing assumes LLM outputs in XML-like tags: <thought>...</thought> followed by either <action>{JSON}</action> or <final_answer>...</final_answer>.

// First, define interfaces (using JSDoc for type hints in plain JS).

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
 * @property {Object} schema - JSON Schema for params validation (not enforced here for simplicity).
 */

import { Octokit } from "https://esm.sh/octokit";
import { fetchGemini } from './llm-tools.js';

const getGithubConfig = () => {
    try {
        const item = localStorage.getItem('github-explorer-config');
        if (!item) return null;
        const savedConfig = JSON.parse(item);
        return {
            auth: savedConfig.auth,
            owner: savedConfig.owner || 'weolopez',
            repo: savedConfig.repo || 'weolopez.github.io',
            branch: savedConfig.branch || 'main',
            path: savedConfig.path || ''
        };
    } catch (e) {
        console.error("Error reading github config:", e);
        return null;
    }
};

const defaultTools = [
  {
    name: 'github_search',
    description: 'Search GitHub for repositories matching a query.',
    schema: {
      type: 'object',
      properties: { query: { type: 'string', description: 'Search query' } },
      required: ['query']
    },
    execute: async (params) => {
      try {
        let config = getGithubConfig();
        let token = config ? config.auth : null;
        
        if (!token) {
             console.warn("No GitHub token found in config.");
             // Fallback or error prompt not ideal in automated loop, but let's try
             // In a real agent, we might ask the user for it via the loop.
             // For now, prompt if interactive, else fail.
             token = prompt('Please enter your GitHub Token for search:');
        }
        const octokit = new Octokit({ auth: token });
        const response = await octokit.rest.search.repos({ q: params.query });
        return JSON.stringify(response.data.items.slice(0, 5).map(item => ({
          name: item.full_name,
          description: item.description,
          url: item.html_url
        })), null, 2);
      } catch (error) {
        if (error.status === 401) {
            throw new Error(`GitHub 401 Unauthorized. Check your token in localStorage 'github-explorer-config'.`);
        }
        throw new Error(`GitHub search failed: ${error.message}`);
      }
    }
  },
  {
    name: 'list_repo_files',
    description: 'List files in the configured GitHub repository.',
    schema: {
      type: 'object',
      properties: { 
          path: { type: 'string', description: 'Path to list (optional, defaults to root)' } 
      }
    },
    execute: async (params) => {
      try {
        const config = getGithubConfig();
        if (!config || !config.auth) {
            throw new Error("GitHub config/token not found in localStorage");
        }
        const octokit = new Octokit({ auth: config.auth });
        // Default to root if no path provided
        const path = params.path || '';
        
        console.log(`Listing repo files at: ${path}`);
        const response = await octokit.rest.repos.getContent({
            owner: config.owner,
            repo: config.repo,
            path: path
        });

        // Handle array (directory listing) or object (file content - though we usually want list here)
        const data = Array.isArray(response.data) ? response.data : [response.data];
        
        return JSON.stringify(data.map(item => ({
          name: item.name,
          path: item.path,
          type: item.type
        })), null, 2);
      } catch (error) {
         if (error.status === 401) {
            throw new Error(`GitHub 401 Unauthorized. Check your token.`);
        }
        throw new Error(`List repo files failed: ${error.message}`);
      }
    }
  },
  {
    name: 'read_repo_file',
    description: 'Read the content of a file from the configured GitHub repository.',
    schema: {
      type: 'object',
      properties: { 
          path: { type: 'string', description: 'File path in the repo' } 
      },
      required: ['path']
    },
    execute: async (params) => {
      try {
        const config = getGithubConfig();
        if (!config || !config.auth) throw new Error("GitHub config not found");
        
        const octokit = new Octokit({ auth: config.auth });
        const response = await octokit.rest.repos.getContent({
            owner: config.owner,
            repo: config.repo,
            path: params.path
        });
        
        if (Array.isArray(response.data)) {
            return "Error: Path points to a directory, not a file. Use list_repo_files instead.";
        }
        
        // Content is base64 encoded
        if (response.data.content) {
            return atob(response.data.content.replace(/\n/g, ''));
        }
        return "Error: No content found.";
      } catch (error) {
        if (error.status === 401) {
             throw new Error("GitHub 401 Unauthorized. Check token.");
        }
        throw new Error(`Read repo file failed: ${error.message}`);
      }
    }
  },
  {
    name: 'read_file',
    description: 'Read the contents of a file from the server (path relative to root).',
    schema: {
      type: 'object',
      properties: { path: { type: 'string', description: 'File path' } },
      required: ['path']
    },
    execute: async (params) => {
      try {
        // Fix: Ensure path starts with / to be relative to domain root, preventing duplicate path segments
        let filePath = params.path;
        if (!filePath.startsWith('/')) {
            filePath = '/' + filePath;
        }
        const response = await fetch(filePath);
        if (!response.ok) throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
        return await response.text();
      } catch (error) {
        throw new Error(`Start reading file failed: ${error.message}`);
      }
    }
  }
];

class AgentLoop {
  /**
   * @param {string} user_goal - The initial user goal.
   * @param {Tool[]} [tools=defaultTools] - Array of tools to register.
   * @param {number} [maxIterations=25] - Max loop iterations to prevent runaway.
   */
  constructor(user_goal, tools = defaultTools, maxIterations = 25) {
    this.user_goal = user_goal;
    this.history = [{ role: 'user', content: user_goal }];
    this.stepsTaken = 0;
    this.maxIterations = maxIterations;
    this.tools = new Map(tools.map(tool => [tool.name, tool]));
    this.status = 'running';
    this.db = null;
    this.onStep = null; // Callback for steps
    this.initDB();
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
  // State mutation: Overwrites the entire state object for the goal key.
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
    transaction.oncomplete = () => {
      // console.log('State saved');
    };
  }

  // Build the prompt for the LLM, including history and instructions.
  // Acts as a "scratchpad" to encourage structured output.
  buildPrompt() {
    const toolDescriptions = Array.from(this.tools.values()).map(t => `${t.name}: ${t.description}`).join('\n');
    const config = getGithubConfig();
    const contextInfo = config 
        ? `Current Repository: ${config.owner}/${config.repo}\nBranch: ${config.branch}\nWorking Directory: ${config.path}` 
        : 'Current Repository: Unknown';

    let prompt = `You are a senior autonomous agent. Your goal: ${this.user_goal}.
Context:
${contextInfo}

Guidelines:
- Observe the history.
- Think step-by-step in a <thought> block.
- If you have enough information to achieve the goal, output the final answer in <final_answer> block.
- Otherwise, call exactly one tool in <action> block with JSON: {"tool": "name", "params": {}}.
- Do not output anything else.

Available tools:
${toolDescriptions}

Conversation history:
`;
    this.history.forEach(msg => {
      prompt += `${msg.role.toUpperCase()}: ${msg.content}\n\n`;
    });
    return prompt;
  }

  // Placeholder for calling the LLM. In production, use fetch to an API endpoint (e.g., OpenAI, xAI).
  // Returns the raw LLM response string.
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
  // Throws error if format is invalid, which would be handled in the loop.
  parseResponse(response) {
    const thoughtMatch = response.match(/<thought>(.*?)<\/thought>/s);
    const actionMatch = response.match(/<action>(.*?)<\/action>/s);
    const finalMatch = response.match(/<final_answer>(.*?)<\/final_answer>/s);

    const thought = thoughtMatch ? thoughtMatch[1].trim() : '';

    if (finalMatch) {
      return { thought, isFinal: true, finalAnswer: finalMatch[1].trim(), action: null };
    } else if (actionMatch) {
      // Find the position of the action JSON
      const start = actionMatch[1].indexOf('{');
      const end = actionMatch[1].lastIndexOf('}');
      if (start !== -1 && end !== -1) {
        try {
          // Extract purely the JSON part
          const jsonStr = actionMatch[1].substring(start, end + 1);
          const actionJson = JSON.parse(jsonStr);
          return { thought, isFinal: false, finalAnswer: null, action: actionJson };
        } catch (error) {
          throw new Error(`Invalid action JSON: ${error.message}`);
        }
      } else {
        // Fallback for when regex captured something but it's not valid JSON-like
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

  // The recursive loop function. Returns a Promise resolving to the final answer or error message.
  // State mutations:
  // - Increments stepsTaken at the start of each recursion.
  // - Appends assistant's thought to history.
  // - If final: Appends final answer to history, updates status, saves state.
  // - If action: Executes tool, appends tool output (or error) to history, saves state, recurses.
  async run() {
    if (this.stepsTaken >= this.maxIterations) {
      this.status = 'max_iterations_reached';
      this.saveState();
      return 'Error: Max iterations reached. Goal not achieved.';
    }

    this.stepsTaken++;
    // State mutation: stepsTaken incremented.

    const prompt = this.buildPrompt();
    let response;
    try {
      response = await this.callLLM(prompt);
    } catch (error) {
      this.status = 'error';
      this.saveState();
      return `Error calling LLM: ${error.message}`;
    }

    let parsed;
    try {
      parsed = this.parseResponse(response);
    } catch (error) {
      const errMsg = { role: 'system', content: `Parse error: ${error.message}` };
      this.history.push(errMsg);
      if (this.onStep) this.onStep(errMsg);
      this.saveState();
      return await this.run(); // Recurse to let LLM self-correct on parse error.
    }

    // Append thought to history.
    if (parsed.thought) {
      const msg = { role: 'assistant', content: `<thought>${parsed.thought}</thought>` };
      this.history.push(msg);
      if (this.onStep) this.onStep(msg);
      // State mutation: history appended with thought.
    }

    if (parsed.isFinal) {
      const finalMsg = { role: 'assistant', content: `<final_answer>${parsed.finalAnswer}</final_answer>` };
      this.history.push(finalMsg); 
      if (this.onStep) this.onStep(finalMsg);

      // State mutation: history appended with final answer.
      this.status = 'completed';
      this.saveState();
      return parsed.finalAnswer;
    } else {
      let toolOutput;
      
      const actionMsg = { role: 'assistant', content: `<action>${JSON.stringify(parsed.action)}</action>` };
      this.history.push(actionMsg);
      if (this.onStep) this.onStep(actionMsg);

      try {
        const tool = this.tools.get(parsed.action.tool);
        if (!tool) {
          throw new Error(`Tool not found: ${parsed.action.tool}`);
        }
        // TODO: Validate params against tool.schema using a library like ajv.
        toolOutput = await tool.execute(parsed.action.params);
      } catch (error) {
        toolOutput = `Tool error: ${error.message}`;
      }

      const toolMsg = { role: 'tool', content: toolOutput };
      this.history.push(toolMsg);
      if (this.onStep) this.onStep(toolMsg);
      // State mutation: history appended with tool output or error.

      this.saveState();
      // Recurse with updated state.
      return await this.run();
    }
  }
}

// Export for use.
export default AgentLoop;

// Usage example:
// const agent = new AgentLoop('Find a JavaScript library for AI agents');
// agent.run().then(result => console.log('Final result:', result));