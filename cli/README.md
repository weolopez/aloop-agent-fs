# Codie CLI

Command-line interface for the Codie AI agent. Codie uses GitHub as a persistent filesystem and Google Gemini as the LLM, giving you an AI assistant that remembers everything and can manage files across sessions.

## Features

- **Persistent Memory** - Agent remembers conversations, preferences, and learned facts
- **GitHub Storage** - All data stored in a GitHub repository (files, notes, configs)
- **Same Agent, Two Interfaces** - Identical capabilities whether using browser or CLI
- **Interactive Mode** - Full REPL with colored output and thinking indicators
- **Non-interactive Mode** - Run single tasks via command line for scripting
- **OpenCode Integration** - Programmatic API for integration with other tools

## OpenCode Integration

Codie provides a programmatic API for integration with other tools like OpenCode:

```javascript
import { runQuickTask, createCodie } from 'aloop/lib/codie-api.js';

// Quick task execution
const result = await runQuickTask('Design a REST API for user management');

// Advanced integration with persistent memory
const codie = await createCodie();
await codie.initialize();
await codie.remember('User prefers TypeScript', 'Preference');
const advice = await codie.runTask('Suggest TypeScript patterns for this codebase');
await codie.cleanup();
```

See [CODIE_INTEGRATION.md](../docs/CODIE_INTEGRATION.md) for detailed integration documentation.

## Quick Start

### 1. Install Dependencies

```bash
cd /path/to/aloop
npm install
```

### 2. Set Environment Variables

```bash
export GEMINI_API_KEY="your-gemini-api-key"
export GITHUB_TOKEN="your-github-personal-access-token"
export GITHUB_OWNER="your-github-username"
export GITHUB_REPO="your-agent-repo"
export GITHUB_BRANCH="main"  # optional, defaults to 'main'
export GITHUB_EMAIL="your-email@example.com"  # optional, for commits
```

**Getting API Keys:**
- **Gemini API Key**: Get one at [Google AI Studio](https://aistudio.google.com/app/apikey)
- **GitHub Token**: Create at [GitHub Settings > Developer settings > Personal access tokens](https://github.com/settings/tokens). Required scopes: `repo` (full control of private repositories)

### 3. Run the CLI

```bash
# Interactive mode
npm start
# or
node cli/index.js

# With setup wizard
node cli/index.js --setup
```

## Usage

### Interactive Mode

```bash
node cli/index.js
```

This starts an interactive session where you can chat with the agent:

```
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🦞  Codie CLI                                           ║
║   Your persistent companion for the digital frontier      ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝

✓ Connected to session: main
Type /help for commands, or just start chatting.

You> List the files in my repository
```

### Chat Commands

| Command | Description |
|---------|-------------|
| `/help` | Show available commands |
| `/status` | Show session and profile stats |
| `/memory` | Show memory status |
| `/new` | Start a new session |
| `/quit`, `/exit`, `/q` | Exit the CLI |

### Non-Interactive Mode (Single Task)

Use `test-agent.js` to run a single task:

```bash
node cli/test-agent.js "List the files in the root directory"
node cli/test-agent.js "Create a file called hello.txt with the content 'Hello World'"
node cli/test-agent.js "What do you remember about my preferences?"
```

### Test Scenarios

Run comprehensive test scenarios:

```bash
# List all available test scenarios
node cli/test-scenarios.js --list

# Run all tests in a category
node cli/test-scenarios.js "memory"
node cli/test-scenarios.js "data"

# Run a specific test (category + test number)
node cli/test-scenarios.js "memory" 1
```

**Available Test Categories:**
- **Note-taking & Knowledge Base** - Create folders, files, markdown documents
- **Data Management** - JSON configs, file updates, backups
- **Memory & Learning** - Remember preferences, recall information
- **Project Management** - Create project structures, TODOs
- **Search & Discovery** - Find files, search content
- **Multi-step Reasoning** - Complex tasks requiring analysis

## Configuration

Configuration is stored in `~/.aloop/config.json`:

```json
{
  "gemini": {
    "apiKey": "AIza..."
  },
  "github": {
    "auth": "ghp_...",
    "owner": "username",
    "repo": "agent-workspace",
    "branch": "main",
    "email": "user@example.com"
  }
}
```

You can either:
1. Set environment variables (takes precedence)
2. Run `node cli/index.js --setup` to configure interactively
3. Edit `~/.aloop/config.json` directly

## Examples

### File Operations

```
You> Create a folder called "projects" and add a README.md file inside it

You> Read the file at notes/ideas.md

You> List all markdown files in the repository
```

### Memory & Learning

```
You> Remember that I prefer TypeScript over JavaScript

You> What programming languages do I prefer?

You> Log that we completed the API integration today
```

### Data Management

```
You> Create a config.json with default settings for theme, language, and version

You> Update the version in config.json to 2.0.0

You> Create a backup of config.json in a backups folder
```

## Troubleshooting

### "Gemini API key not found"

Make sure `GEMINI_API_KEY` is set:
```bash
export GEMINI_API_KEY="your-key"
# or run setup
node cli/index.js --setup
```

### "GitHub not configured"

Ensure all required GitHub variables are set:
```bash
export GITHUB_TOKEN="ghp_..."
export GITHUB_OWNER="username"
export GITHUB_REPO="repo-name"
```

### Session Conflicts

If you're running both browser and CLI simultaneously with the same session, you may see SHA conflicts when both try to save. Solutions:
- Use different sessions (feature coming soon)
- Run `/compact` to reduce session size
- Use one interface at a time

### "429 Too Many Requests"

The Gemini API has rate limits. Wait a moment and try again, or check your API quota at [Google AI Studio](https://aistudio.google.com/).

## Architecture

The CLI reuses the same core agent code as the browser interface:

```
cli/
  index.js          # Interactive CLI entry point
  test-agent.js     # Non-interactive single-task runner
  test-scenarios.js # Comprehensive test suite

src/
  agent-shell.js    # Core agent orchestration
  AgentLoop-GitHub.js  # Agent loop with GitHub persistence
  GitHubFileSystem.js  # GitHub file operations
  llm-tools.js      # Gemini API integration
  platform/         # Platform abstraction layer
    index.js        # Platform detection
    browser.js      # Browser-specific implementations
    node.js         # Node.js-specific implementations
```

## Development

### Adding New Tests

Edit `cli/test-scenarios.js` and add scenarios to the `SCENARIOS` object:

```javascript
const SCENARIOS = {
  'Your Category': [
    'Task description 1',
    'Task description 2',
  ],
  // ...
};
```

### Platform Adapters

The `src/platform/` directory contains adapters that abstract browser vs Node.js differences:
- Storage (localStorage vs file-based)
- Environment variables (none vs process.env)
- Prompts (window.prompt vs readline)
- Base64 encoding (btoa/atob vs Buffer)

## License

MIT
