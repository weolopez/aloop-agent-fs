# Navigator - AI Agent with Persistent Memory

A personality-driven AI assistant with persistent GitHub storage. Browser-based, no backend required.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![JavaScript](https://img.shields.io/badge/JavaScript-ES6+-yellow.svg)
![Browser](https://img.shields.io/badge/platform-browser-green.svg)

## Quick Start

```bash
# Clone the repo
git clone https://github.com/weolopez/aloop-agent-fs.git
cd aloop-agent-fs

# Start a local server
python3 -m http.server 8000

# Open http://localhost:8000 in your browser
```

## Features

- **Persistent Memory** - Sessions and user preferences stored in GitHub
- **Personality-Driven** - Navigator has character, values, and communication style
- **Continuous Conversation** - Chat-based interface with multi-turn support
- **Goal Alignment** - Pre-flight analysis before executing complex tasks
- **Slash Commands** - `/help`, `/status`, `/name`, `/new`, and more
- **GitHub File System** - Full CRUD operations committed to your repository
- **Browser-Based** - No backend, runs entirely client-side

## Project Structure

```
aloop-agent-fs/
├── index.html              # Main application UI
├── src/                    # JavaScript modules
│   ├── agent-shell.js      # Continuous conversation wrapper
│   ├── AgentLoop-GitHub.js # Core agent execution loop
│   ├── GitHubFileSystem.js # GitHub API file system
│   ├── github-fs-tools.js  # 9 file system tools for agents
│   ├── goal-alignment.js   # Pre-flight goal analysis
│   ├── llm-tools.js        # Gemini API integration
│   ├── persona.js          # Navigator's identity & values
│   ├── session-manager.js  # Persistent session storage
│   ├── user-profile.js     # User preferences & learning
│   └── github-explorer.js  # File browser web component
├── docs/                   # Documentation
│   ├── QUICKSTART.md       # Setup guide
│   ├── AGENTS.md           # Developer guide
│   ├── GITHUB_FS_README.md # API reference
│   └── EVOLUTION_ANALYSIS.md
├── README.md
└── LICENSE
```

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                      index.html                         │
│                   (Chat UI + Setup)                     │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│                     AgentShell                          │
│  • Continuous conversation                              │
│  • Slash commands (/help, /status, /name, etc.)         │
│  • Session & Profile integration                        │
└────────────────────────┬────────────────────────────────┘
                         │
        ┌────────────────┼────────────────┐
        ▼                ▼                ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│SessionManager│ │ UserProfile  │ │GoalAlignment │
│  GitHub:     │ │  GitHub:     │ │• Pre-flight  │
│  sessions/   │ │  profile.json│ │• Confirmation│
└──────────────┘ └──────────────┘ └──────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│               AgentLoopGitHub + Persona                 │
│  • Navigator identity (persona.js)                      │
│  • Think → Act → Observe loop                           │
│  • 9 GitHub file system tools                           │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│                  GitHubFileSystem                       │
│              (Persistent Storage in GitHub)             │
└─────────────────────────────────────────────────────────┘
```

## Commands

| Command | Description |
|---------|-------------|
| `/help` | Show all commands |
| `/status` | Session and profile stats |
| `/name <name>` | Set your name |
| `/new` | Start a new session |
| `/verbose <level>` | Set verbosity (terse/adaptive/verbose) |
| `/learn <fact>` | Teach Navigator something |
| `/forget` | Clear learned data |
| `/sessions` | List saved sessions |
| `/load <id>` | Load a saved session |
| `/compact` | Compress old messages |
| `/export` | Export your profile |

## File System Tools

The agent has access to these GitHub operations:

| Tool | Description |
|------|-------------|
| `fs_read_file` | Read file contents |
| `fs_write_file` | Create or update file (creates commit) |
| `fs_delete_file` | Delete a file |
| `fs_list_directory` | List directory contents |
| `fs_search_code` | Search across all files |
| `fs_file_exists` | Check if path exists |
| `fs_create_directory` | Create directory |
| `fs_get_all_files` | Get complete file tree |
| `fs_get_repo_info` | Repository metadata |

## Setup Requirements

1. **GitHub Repository** - For persistent storage
2. **GitHub Personal Access Token** - With `repo` scope
3. **Google Gemini API Key** - For LLM intelligence
4. **Modern Browser** - Chrome, Firefox, Safari, or Edge

## Configuration

All configuration is done through the setup wizard in `index.html`:

1. Create a GitHub repository (e.g., `agent-workspace`)
2. Generate a [GitHub Personal Access Token](https://github.com/settings/tokens/new?scopes=repo)
3. Get a [Gemini API Key](https://aistudio.google.com/app/apikey)
4. Enter credentials in the setup form

Credentials are stored in browser `localStorage` only.

## Usage Example

```javascript
import { AgentShell } from './src/agent-shell.js';

const shell = new AgentShell({
  onReady: (info) => console.log(`Ready: ${info.greeting}`),
  onComplete: (result) => console.log(`Done: ${result}`),
  onThinking: (isThinking) => console.log(isThinking ? 'Thinking...' : 'Done')
});

await shell.initialize();
await shell.send('Create a todo list for my project');
```

## Documentation

- **[docs/QUICKSTART.md](docs/QUICKSTART.md)** - Detailed setup guide
- **[docs/AGENTS.md](docs/AGENTS.md)** - Developer guide for AI coding agents
- **[docs/GITHUB_FS_README.md](docs/GITHUB_FS_README.md)** - Complete API reference

## Security

- Tokens stored in browser `localStorage` only
- Never committed to repositories
- Use private repos for sensitive data
- Consider fine-grained tokens for better security

## License

MIT License - See [LICENSE](LICENSE) for details.

## Links

- **Repository**: https://github.com/weolopez/aloop-agent-fs
- **Issues**: https://github.com/weolopez/aloop-agent-fs/issues

---

*Navigator - Your persistent AI companion for the digital frontier.*
