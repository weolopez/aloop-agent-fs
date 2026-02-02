# ALoop Agent FS - AI Agent with GitHub File System

An autonomous AI agent with persistent storage via GitHub repository. Built with vanilla JavaScript, runs entirely in the browser.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![JavaScript](https://img.shields.io/badge/JavaScript-ES6+-yellow.svg)
![Browser](https://img.shields.io/badge/platform-browser-green.svg)

## 🚀 Quick Start

Get your agent running with persistent GitHub storage in 5 minutes:

```bash
# 1. Clone or download this repo
git clone https://github.com/weolopez/aloop-agent-fs.git
cd aloop-agent-fs

# 2. Start a local server
python3 -m http.server 8000

# 3. Open in browser
# http://localhost:8000/github-fs-demo.html
```

Follow the interactive setup wizard to configure your GitHub workspace and API keys.

📖 **See [QUICKSTART.md](QUICKSTART.md) for detailed setup instructions.**

## ✨ Features

- 🤖 **Autonomous Agent Loop** - Recursive execution with thought → action → result cycle
- 💾 **GitHub File System** - Full CRUD operations on GitHub repository
- 🔍 **Code Search** - Find content across all files in the repository
- 📝 **Persistent Memory** - Agent remembers everything across sessions
- 🌐 **Browser-Based** - No backend server needed, runs client-side
- 🔄 **Real-time Sync** - Every change is committed to GitHub
- 🎯 **LLM Integration** - Powered by Google Gemini API

## 🎯 What Can It Do?

Give your agent natural language goals:

```
✅ "Create a todo list and save it as todos.txt"
✅ "Research JavaScript best practices and save detailed notes"
✅ "Keep a daily journal organized by date"
✅ "Search for all my notes about Python and create a summary"
✅ "Organize existing files into categories"
```

The agent will:
1. Think about how to achieve the goal
2. Use file system tools (read, write, search, delete, etc.)
3. Create commits on your GitHub repository
4. Provide a final answer when complete

## 📁 Project Structure

```
├── AgentLoop.js              # Core agent execution loop (original)
├── AgentLoop-GitHub.js       # Enhanced agent with GitHub FS
├── GitHubFileSystem.js       # File system abstraction over GitHub API
├── github-fs-tools.js        # 9 file system tools for agents
├── github-explorer.js        # GitHub browser web component
├── llm-tools.js              # Gemini API integration
├── index.html                # Original demo
├── github-fs-demo.html       # GitHub FS setup and demo
├── AGENTS.md                 # Developer guide for AI agents
├── GITHUB_FS_README.md       # Complete API documentation
└── QUICKSTART.md             # 5-minute setup guide
```

## 🛠️ How It Works

### Architecture

```
┌─────────────┐
│  User Goal  │
└──────┬──────┘
       ↓
┌──────────────────────┐
│  AgentLoop-GitHub    │ ← Recursive execution
│  - Think (LLM)       │
│  - Act (Tools)       │
│  - Observe (Results) │
└──────┬───────────────┘
       ↓
┌──────────────────────┐
│  github-fs-tools     │ ← 9 file operations
│  - Read/Write        │
│  - Search/List       │
│  - Create/Delete     │
└──────┬───────────────┘
       ↓
┌──────────────────────┐
│  GitHubFileSystem    │ ← GitHub API wrapper
│  - Octokit           │
│  - Caching           │
│  - Error handling    │
└──────┬───────────────┘
       ↓
┌──────────────────────┐
│  GitHub Repository   │ ← Persistent storage
│  - All files saved   │
│  - Git history       │
│  - Searchable        │
└──────────────────────┘
```

### File System Tools

| Tool | Description |
|------|-------------|
| `fs_read_file` | Read file contents from GitHub |
| `fs_write_file` | Create or update a file (creates commit) |
| `fs_delete_file` | Delete a file from repository |
| `fs_list_directory` | List files and subdirectories |
| `fs_search_code` | Search across all files |
| `fs_file_exists` | Check if path exists |
| `fs_create_directory` | Create new directory |
| `fs_get_all_files` | Get complete file tree |
| `fs_get_repo_info` | Repository metadata |

## 📚 Documentation

- **[QUICKSTART.md](QUICKSTART.md)** - Get started in 5 minutes
- **[AGENTS.md](AGENTS.md)** - Developer guide for AI coding agents
- **[GITHUB_FS_README.md](GITHUB_FS_README.md)** - Complete API reference

## 🔧 Setup Requirements

### Prerequisites

1. **GitHub Account** - For repository storage
2. **GitHub Personal Access Token** - With `repo` scope
3. **Google Account** - For Gemini API key
4. **Modern Browser** - Chrome, Firefox, Safari, or Edge

### Setup Steps

1. **Create GitHub Repository**
   - Go to https://github.com/new
   - Name it (e.g., `agent-workspace`)
   - Public or Private (your choice)

2. **Generate GitHub Token**
   - Visit https://github.com/settings/tokens/new
   - Select `repo` scope
   - Copy the token

3. **Get Gemini API Key**
   - Visit https://aistudio.google.com/app/apikey
   - Create and copy your API key

4. **Configure Application**
   - Open `github-fs-demo.html`
   - Fill in configuration form
   - Test connection

See [QUICKSTART.md](QUICKSTART.md) for detailed instructions with screenshots.

## 💻 Usage Examples

### Basic File Operations

```javascript
import GitHubFileSystem from './GitHubFileSystem.js';

const fs = new GitHubFileSystem({
  owner: 'your-username',
  repo: 'agent-workspace',
  branch: 'main',
  auth: 'ghp_xxxxx',
  email: 'you@example.com'
});

await fs.initialize();

// Write a file
await fs.writeFile('notes/ideas.txt', 'My brilliant ideas...');

// Read it back
const file = await fs.readFile('notes/ideas.txt');
console.log(file.content);

// Search
const results = await fs.searchCode('brilliant');
```

### Running the Agent

```javascript
import AgentLoopGitHub from './AgentLoop-GitHub.js';

const agent = new AgentLoopGitHub(
  'Create a weekly journal entry for today'
);

agent.onStep = (step) => {
  console.log(`${step.role}: ${step.content}`);
};

const result = await agent.run();
console.log('Done:', result);
```

## 🎨 Demo Screenshots

### Setup Wizard
The interactive setup wizard guides you through configuration:
- GitHub repository settings
- Personal Access Token
- Gemini API key
- Connection testing

### Agent in Action
Watch the agent think, act, and complete goals:
- Real-time thought process display
- Tool execution logs
- Final results

### GitHub Repository
See your agent's work:
- All files committed to GitHub
- Full Git history
- Searchable content

## 🔒 Security Notes

- **Never commit tokens to repositories**
- Tokens stored in browser `localStorage` only
- Use private repos for sensitive data
- Token needs `repo` scope for full access
- Consider fine-grained tokens for better security

## 🐛 Troubleshooting

### Common Issues

**401 Unauthorized**
- Check your GitHub token in localStorage
- Regenerate token if expired

**Repository not found**
- Verify owner/repo names are correct
- Ensure repository exists

**Rate limit exceeded**
- GitHub API: 5,000 requests/hour (authenticated)
- Search API: 30 requests/minute
- Wait before retrying

**CORS errors**
- Must serve via HTTP server (not `file://`)
- Use `python3 -m http.server` or similar

See detailed troubleshooting in [AGENTS.md](AGENTS.md#troubleshooting).

## 🏗️ Architecture Decisions

### Why Browser-Only?

- **No backend required** - Deploy anywhere with static hosting
- **Direct API access** - No proxy server needed
- **Simple deployment** - Just serve HTML/JS files
- **Real-time** - No polling or webhooks

### Why GitHub as File System?

- **Free persistent storage** - GitHub provides unlimited public repos
- **Version control** - Full Git history of all changes
- **Search built-in** - GitHub Code Search API
- **Accessible** - View/edit files on GitHub.com
- **Shareable** - Easy to share with others

### Why ES6 Modules?

- **No build step** - Import directly in browser
- **Modern JavaScript** - Clean syntax
- **CDN support** - Import from esm.sh, unpkg, etc.
- **Fast development** - Edit and reload

## 🤝 Contributing

This is an experimental project exploring autonomous agents with persistent storage. Contributions welcome!

### Development Guidelines

1. Read [AGENTS.md](AGENTS.md) for code style
2. No build step - pure ES6 modules
3. Test in browser console
4. Follow existing patterns
5. Document with JSDoc

### Adding New Tools

```javascript
// Create a new tool
export const myTool = {
  name: 'my_tool',
  description: 'What it does',
  schema: { /* JSON Schema */ },
  execute: async (params) => {
    // Implementation
    return 'Result';
  }
};

// Add to AgentLoop
const agent = new AgentLoopGitHub(goal, [myTool]);
```

## 📄 License

MIT License - See LICENSE file for details

## 🙏 Acknowledgments

- Inspired by [OpenClaw's Lobster Shell](https://github.com/openclaw/)
- Built with [Octokit](https://github.com/octokit/octokit.js)
- Powered by [Google Gemini](https://ai.google.dev/)

## 🔗 Links

- **GitHub Repository**: https://github.com/weolopez/aloop-agent-fs
- **Live Demo**: (Deploy to GitHub Pages or similar)
- **Documentation**: See `/docs` folder
- **Issues**: https://github.com/weolopez/aloop-agent-fs/issues

## 📊 Project Status

🚧 **Experimental** - This is a proof of concept exploring autonomous agents with GitHub-based persistence.

### Roadmap

- [x] Core agent loop implementation
- [x] GitHub file system integration
- [x] Search capabilities
- [x] Interactive setup wizard
- [x] Comprehensive documentation
- [ ] Additional LLM support (OpenAI, Claude, etc.)
- [ ] Enhanced error recovery
- [ ] Batch operations
- [ ] File watchers
- [ ] Collaborative agents

## 💬 Questions?

- Check [GITHUB_FS_README.md](GITHUB_FS_README.md) for API details
- Read [QUICKSTART.md](QUICKSTART.md) for setup help
- See [AGENTS.md](AGENTS.md) for development guide
- Open an issue on GitHub

---

**Built with ❤️ by the ALoop community**

*Transform your AI agent from forgetful to persistent - one commit at a time!* 🚀
