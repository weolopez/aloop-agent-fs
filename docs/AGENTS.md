# AGENTS.md - Agent Developer Guide

This document provides essential guidelines for agentic coding assistants working in this repository.

## Project Overview

This is a browser-based agentic loop implementation inspired by OpenClaw's "Lobster Shell". It features:
- **AgentLoop.js**: Core recursive agent execution with IndexedDB persistence
- **AgentLoop-GitHub.js**: Enhanced agent with GitHub file system integration
- **GitHubFileSystem.js**: Complete file system abstraction over GitHub API (read/write/search)
- **github-fs-tools.js**: File system tools for agent (9 operations: read, write, delete, list, search, etc.)
- **github-explorer.js**: Web component for GitHub repository browsing/editing
- **llm-tools.js**: Gemini API integration with function calling support
- **index.html**: Demo interface for the agent loop
- **github-fs-demo.html**: Setup wizard and demo for GitHub file system agent

**Tech Stack**: Vanilla JavaScript (ES6+ modules), Web Components, IndexedDB, GitHub API (Octokit), Google Gemini API

**Key Feature**: The agent can use a GitHub repository as persistent storage, enabling it to save notes, store data, search previous work, and maintain state across sessions.

## Build/Test/Run Commands

### Running the Application
```bash
# Serve with any static server, e.g.:
python3 -m http.server 8000
# or
npx serve .
```

Then open:
- `http://localhost:8000/index.html` - Original demo
- `http://localhost:8000/github-fs-demo.html` - GitHub file system agent (recommended)

### Testing
**Note**: This project currently has no formal test suite. Manual testing via browser DevTools is used.

To test the basic agent:
```javascript
// In browser console:
import AgentLoop from './AgentLoop.js';
const agent = new AgentLoop('test goal');
agent.run().then(console.log);
```

To test the GitHub file system:
```javascript
// In browser console (after configuring in github-fs-demo.html):
import GitHubFileSystem, { loadGitHubFSConfig } from './GitHubFileSystem.js';
const config = loadGitHubFSConfig();
const fs = new GitHubFileSystem(config);
await fs.writeFile('test.txt', 'Hello!');
await fs.readFile('test.txt');
await fs.deleteFile('test.txt');
```

### Linting
**Note**: No linter is currently configured. Follow code style guidelines below.

## Code Style Guidelines

### File Organization
- **No build step**: Pure ES6 modules loaded directly in browser
- **One class per file**: Each major component gets its own file
- **Web Components**: Use native Custom Elements API (no framework)

### Import/Export Style
```javascript
// Named exports for utilities
export function utilFunction() { }
export const CONSTANT = 'value';

// Default export for main classes
export default class MainClass { }

// ES6 imports with CDN modules
import { Octokit } from "https://esm.sh/octokit";
```

### Naming Conventions
- **Classes**: PascalCase (`AgentLoop`, `GithubExplorer`)
- **Functions**: camelCase (`buildPrompt`, `saveState`)
- **Constants**: SCREAMING_SNAKE_CASE (`MESSAGES`, `MAX_ITERATIONS`)
- **Private fields**: Prefix with underscore (`_currentFileId`, `_currentFile`)
- **Event handlers**: Prefix with `on` (`onItemClick`, `onClick`)

### Types and Documentation
- Use **JSDoc** for type hints (no TypeScript)
- Document complex objects with `@typedef`
- Document function signatures with `@param` and `@returns`

Example:
```javascript
/**
 * @typedef {Object} AgentState
 * @property {string} goal - The user goal.
 * @property {Array<{role: string, content: string}>} history
 */

/**
 * @param {string} user_goal - The initial user goal.
 * @param {Tool[]} [tools=defaultTools] - Array of tools to register.
 * @returns {Promise<string>} Final answer or error message.
 */
async run(user_goal, tools = defaultTools) { }
```

### Code Formatting
- **Indentation**: 2 spaces (no tabs)
- **Semicolons**: Use them consistently
- **Quotes**: Single quotes `'string'` preferred (double for JSON/HTML attributes)
- **Line length**: Aim for ~100-120 chars, break at logical points
- **Braces**: Same-line opening brace (K&R style)

### Error Handling
```javascript
// Always catch async errors
try {
  const result = await apiCall();
} catch (error) {
  // Log with context
  console.error("Operation failed:", error);
  // Provide user feedback
  throw new Error(`User-friendly message: ${error.message}`);
}

// Handle specific error types
if (error.status === 401) {
  throw new Error(`GitHub 401 Unauthorized. Check your token.`);
}
```

### Async/Await Style
- Prefer `async/await` over `.then()` chains
- Always handle promise rejections
- Mark functions as `async` explicitly

```javascript
// Good
async function fetchData() {
  const response = await fetch(url);
  return await response.json();
}

// Avoid
function fetchData() {
  return fetch(url).then(r => r.json());
}
```

### Web Component Patterns
```javascript
export class MyComponent extends HTMLElement {
  constructor() {
    super();
    // Initialize properties
    this._state = null;
  }

  connectedCallback() {
    // Setup when added to DOM
    this.render();
    this.attachEventListeners();
  }

  render() {
    // Inline styles with theme awareness
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    this.innerHTML = `<style>...</style><div>...</div>`;
  }
}

customElements.define('my-component', MyComponent);
```

### State Management
- **Mutable state**: This codebase uses mutable state patterns
- **Persistence**: Use IndexedDB for agent state (`AgentLoop`)
- **Browser storage**: Use `localStorage` for config (`github-explorer-config`, `github-fs-config`)
- **GitHub file system**: Use GitHub repository for long-term data persistence
- **State mutations**: Document state changes in comments

```javascript
// State mutation: stepsTaken incremented
this.stepsTaken++;

// State mutation: history appended with thought
this.history.push({ role: 'assistant', content: thought });

// Persistent storage in GitHub
await fs.writeFile('state/agent-progress.json', JSON.stringify(data));
```

### Event Handling
```javascript
// Custom events for cross-component communication
window.dispatchEvent(new CustomEvent('file-selected', { 
  detail: { id: fileId },
  bubbles: true,
  composed: true // For shadow DOM
}));

// Event listeners
window.addEventListener('file-selected', (e) => {
  console.log(e.detail.id);
});

// Event bus pattern (if available)
eventBus.publish(MESSAGES.FINDER_FILE_EDITED, { id, content });
```

### Comments
- **File headers**: Explain purpose and architecture at top of each file
- **Inline comments**: Explain "why" not "what"
- **TODOs**: Use `// TODO: description` for future improvements

```javascript
// Good: Explains reasoning
// Use prompt() as fallback when no token configured
token = prompt('Please enter your GitHub Token:');

// Bad: States the obvious  
// Get the token
token = getToken();
```

## Common Patterns in This Codebase

### LLM Response Parsing
```javascript
// Extract structured output from LLM using regex
const thoughtMatch = response.match(/<thought>(.*?)<\/thought>/s);
const actionMatch = response.match(/<action>(.*?)<\/action>/s);
const finalMatch = response.match(/<final_answer>(.*?)<\/final_answer>/s);
```

### GitHub API Integration
```javascript
// Direct API usage with Octokit
const octokit = new Octokit({ auth: token });
const response = await octokit.rest.repos.getContent({
  owner, repo, path, ref: branch
});

// File system abstraction (recommended for agents)
import GitHubFileSystem from './GitHubFileSystem.js';
const fs = new GitHubFileSystem(config);
await fs.writeFile('notes/todo.txt', 'My tasks...');
const file = await fs.readFile('notes/todo.txt');
```

### GitHub File System Operations
```javascript
// Write data (creates or updates file)
await fs.writeFile('data/results.json', JSON.stringify(data));

// Read data
const file = await fs.readFile('data/results.json');
const data = JSON.parse(file.content);

// Search for content
const results = await fs.searchCode('TODO', { extension: 'js' });

// List directory
const files = await fs.listDirectory('notes');

// Check existence before writing
if (await fs.exists('config.json')) {
  const existing = await fs.readFile('config.json');
  // Merge or update...
}
```

### Path Normalization
```javascript
// Always normalize paths to prevent leading slashes causing issues
const cleanPath = normalizePath(filePath);
// Paths should NOT start with / for GitHub API
// Good: "notes/todo.txt"
// Bad: "/notes/todo.txt"
```

### Tool Implementation Pattern
```javascript
// Tools for AgentLoop follow this structure
{
  name: 'tool_name',
  description: 'Clear description of what the tool does',
  schema: {
    type: 'object',
    properties: {
      param1: { type: 'string', description: 'Parameter description' }
    },
    required: ['param1']
  },
  execute: async (params) => {
    try {
      // Tool implementation
      return 'Success message or result';
    } catch (error) {
      return `Error: ${error.message}`;
    }
  }
}
```

## Important Considerations

### Security
- **Never commit tokens**: Store GitHub/API tokens in `localStorage` only
- **User prompts**: Use `prompt()` for missing credentials (browser-only app)
- **Content encoding**: Use `btoa(unescape(encodeURIComponent(content)))` for GitHub API
- **Token scopes**: GitHub PAT needs `repo` scope for file system access
- **Private repos**: Use private repositories for sensitive agent data

### Browser-Only Runtime
- No Node.js APIs available
- Use `fetch()` for HTTP requests
- Use IndexedDB for short-term persistence (agent state)
- Use GitHub repo for long-term persistence (data, notes, files)
- Use `import` with full URLs for CDN modules (e.g., `https://esm.sh/octokit`)

### GitHub API Limits
- **Authenticated requests**: 5,000 per hour
- **Search API**: 30 requests per minute
- **Consider caching**: GitHubFileSystem has built-in read cache
- **Rate limit errors**: Return friendly messages, suggest waiting

### Recursion Management
- Agent loop uses recursion with max iteration limits (default: 25)
- Always include base case to prevent infinite loops

```javascript
if (this.stepsTaken >= this.maxIterations) {
  return 'Error: Max iterations reached';
}
```

### File System Best Practices
- **Organize files**: Use directories (e.g., `notes/`, `data/`, `results/`)
- **Naming**: Use lowercase, hyphens or underscores, clear extensions
- **Search first**: Before creating, check if file exists
- **Atomic operations**: Each write is a git commit, be intentional
- **Error handling**: GitHub operations can fail, always try/catch

## File Locations

```
/AgentLoop.js              # Core agent execution loop (original)
/AgentLoop-GitHub.js       # Enhanced agent with GitHub file system
/GitHubFileSystem.js       # File system abstraction over GitHub API
/github-fs-tools.js        # File system tools for agents
/github-explorer.js        # GitHub file browser web component  
/llm-tools.js              # Gemini API utilities and function calling
/index.html                # Original demo application
/github-fs-demo.html       # GitHub file system setup and demo
/GITHUB_FS_README.md       # Complete GitHub FS documentation
/AGENTS.md                 # This file
```

## GitHub File System Architecture

### Three Layers

1. **GitHubFileSystem.js** - Low-level API wrapper
   - Direct GitHub API interactions
   - Caching layer
   - Error handling
   - All CRUD operations

2. **github-fs-tools.js** - Agent-friendly tools
   - Wraps GitHubFileSystem methods
   - Formats output for LLM consumption
   - 9 tools: read, write, delete, list, search, exists, create_dir, get_all, get_info

3. **AgentLoop-GitHub.js** - Agent with tools integrated
   - Combines file system tools with agent loop
   - Persistent storage for agent goals
   - Can add additional custom tools

### Configuration Storage

```javascript
// GitHub FS config stored in localStorage
{
  "owner": "username",
  "repo": "agent-workspace",
  "branch": "main",
  "auth": "ghp_xxxxx",
  "email": "user@example.com"
}

// Config key: 'github-fs-config'
// Load with: loadGitHubFSConfig()
// Save with: saveGitHubFSConfig(config)
```

## Making Changes

### For GitHub File System Features

1. **Test file operations**: Use github-fs-demo.html setup wizard first
2. **Verify in browser console**:
   ```javascript
   const fs = new GitHubFileSystem(loadGitHubFSConfig());
   await fs.writeFile('test.txt', 'Hello');
   await fs.readFile('test.txt');
   ```
3. **Check GitHub repo**: Verify commits appear on GitHub
4. **Test with agent**: Run AgentLoop-GitHub with file operations
5. **Handle errors**: GitHub API errors should be user-friendly

### General Development

1. **Test in browser**: Open DevTools console, test changes interactively
2. **Check for errors**: Monitor console for runtime errors
3. **Verify state**: Check IndexedDB and localStorage state after changes
4. **Follow patterns**: Match existing code style and patterns
5. **Document**: Add JSDoc comments for new functions/types
6. **No bundling**: Code runs directly in browser, no build step needed

### Adding New Tools

```javascript
// In a new file or github-fs-tools.js
export const myNewTool = {
  name: 'my_tool',
  description: 'What it does (be clear for the LLM)',
  schema: {
    type: 'object',
    properties: {
      param: { type: 'string', description: 'Parameter purpose' }
    },
    required: ['param']
  },
  execute: async (params) => {
    // Implementation
    return 'Result or error message';
  }
};

// Then add to AgentLoop constructor
const agent = new AgentLoopGitHub(goal, [myNewTool]);
```

## Troubleshooting

### GitHub File System Issues

- **401 Errors**: Check `localStorage['github-fs-config']` for valid GitHub token
- **404 Not Found**: Verify repository exists and path is correct (no leading `/`)
- **Rate Limits**: Wait before retrying, consider caching strategy
- **Repository not found**: Ensure owner/repo names are correct, repo exists
- **Permission denied**: Token needs `repo` scope for private repos
- **Search not working**: Repo must be indexed by GitHub (may take time for new repos)

### General Issues

- **CORS Issues**: Serve via http server, not `file://` protocol
- **Import Errors**: Ensure paths start with `/` or `./` for relative imports
- **API Limits**: Gemini/GitHub have rate limits, implement exponential backoff
- **IndexedDB errors**: Check browser compatibility, ensure not in incognito mode

### Testing Checklist

```javascript
// 1. Test GitHub connection
import GitHubFileSystem, { loadGitHubFSConfig } from './GitHubFileSystem.js';
const fs = new GitHubFileSystem(loadGitHubFSConfig());
await fs.initialize(); // Should not throw

// 2. Test write
await fs.writeFile('test.txt', 'Hello World');

// 3. Test read
const file = await fs.readFile('test.txt');
console.assert(file.content === 'Hello World');

// 4. Test search
const results = await fs.searchCode('Hello');
console.assert(results.length > 0);

// 5. Test delete
await fs.deleteFile('test.txt');

// 6. Verify on GitHub
// Go to https://github.com/owner/repo and check commits
```
