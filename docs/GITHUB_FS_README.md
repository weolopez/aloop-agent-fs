# GitHub File System Agent

Transform a GitHub repository into a persistent file system for your AI agent. This enables the agent to save notes, store data, search previous work, and maintain state across sessions.

## 🚀 Quick Start

1. **Open the Demo**: Open `github-fs-demo.html` in your browser
2. **Create a GitHub Repo**: Follow the setup wizard to create a new repository
3. **Get API Keys**: Obtain GitHub PAT and Gemini API key
4. **Run Your Agent**: Give it goals that require persistent storage!

## 📁 Project Structure

```
GitHubFileSystem.js      # Core file system abstraction over GitHub API
github-fs-tools.js       # Agent tools for file operations
AgentLoop-GitHub.js      # Enhanced AgentLoop with GitHub persistence
github-fs-demo.html      # Setup wizard and interactive demo
```

## 🔧 Setup Instructions

### Step 1: Create a GitHub Repository

1. Go to https://github.com/new
2. Create a new repository (public or private)
3. Name it something like `agent-workspace` or `ai-agent-storage`
4. Initialize it with a README (optional but recommended)

### Step 2: Generate Personal Access Token

1. Go to https://github.com/settings/tokens/new
2. Description: "Agent File System"
3. Select scope: **repo** (full control of private repositories)
4. Click "Generate token"
5. **Copy the token immediately** (you won't see it again!)

### Step 3: Get Gemini API Key

1. Go to https://aistudio.google.com/app/apikey
2. Click "Create API key"
3. Copy your API key

### Step 4: Configure the Agent

Open `github-fs-demo.html` and fill in:
- GitHub username/organization
- Repository name
- Branch (usually "main")
- Personal Access Token
- Your email (for commit author)
- Gemini API key

## 💡 Usage Examples

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
await fs.writeFile('notes/todo.txt', 'My tasks...');

// Read a file
const file = await fs.readFile('notes/todo.txt');
console.log(file.content);

// List directory
const files = await fs.listDirectory('notes');

// Search code
const results = await fs.searchCode('important', { extension: 'txt' });

// Delete a file
await fs.deleteFile('notes/old.txt');
```

### Using with AgentLoop

```javascript
import AgentLoopGitHub from './AgentLoop-GitHub.js';

const agent = new AgentLoopGitHub(
  'Create a weekly journal and add an entry for today'
);

agent.onStep = (step) => {
  console.log(`${step.role}: ${step.content}`);
};

const result = await agent.run();
console.log('Final result:', result);
```

## 🛠️ Available Tools

The agent has access to these file system operations:

| Tool | Description |
|------|-------------|
| `fs_read_file` | Read file contents |
| `fs_write_file` | Create or update a file |
| `fs_delete_file` | Delete a file |
| `fs_list_directory` | List files and subdirectories |
| `fs_search_code` | Search across all files |
| `fs_file_exists` | Check if path exists |
| `fs_create_directory` | Create a new directory |
| `fs_get_all_files` | Get complete file tree |
| `fs_get_repo_info` | Get repository metadata |

## 🎯 Example Agent Goals

Try these goals with your agent:

- **"Create a todo list and save it as todos.txt"**
- **"Research JavaScript best practices and save notes in research/js-best-practices.md"**
- **"Keep track of daily progress in a journal organized by date"**
- **"Search for existing notes about AI and summarize them"**
- **"Create a knowledge base with categories for different topics"**
- **"Track my coding goals for 2024 in goals/2024.md"**

## 🔒 Security Notes

- **Never commit your tokens to a repository**
- Tokens are stored in `localStorage` (browser-only)
- The PAT needs `repo` scope for full read/write access
- Use private repositories for sensitive data
- Consider using fine-grained tokens for better security

## 📚 API Reference

### GitHubFileSystem Class

#### Constructor
```javascript
new GitHubFileSystem(config)
```

**Config options:**
- `owner` (string): GitHub username or organization
- `repo` (string): Repository name
- `branch` (string): Branch name (default: 'main')
- `auth` (string): GitHub Personal Access Token
- `email` (string): Email for commit author

#### Methods

##### `initialize()`
Verify repository access.
```javascript
await fs.initialize();
```

##### `readFile(path)`
Read a file's contents.
```javascript
const file = await fs.readFile('notes/todo.txt');
// Returns: { path, name, content, sha, type, size }
```

##### `writeFile(path, content, message?)`
Create or update a file.
```javascript
await fs.writeFile('notes/todo.txt', 'My tasks...', 'Update todos');
```

##### `deleteFile(path, message?)`
Delete a file.
```javascript
await fs.deleteFile('notes/old.txt');
```

##### `listDirectory(path?)`
List directory contents.
```javascript
const files = await fs.listDirectory('notes');
```

##### `searchCode(query, options?)`
Search across repository.
```javascript
const results = await fs.searchCode('TODO', {
  extension: 'js',
  path: 'src/',
  limit: 30
});
```

##### `exists(path)`
Check if file/directory exists.
```javascript
const exists = await fs.exists('notes/todo.txt');
```

##### `createDirectory(path)`
Create a directory (with .gitkeep).
```javascript
await fs.createDirectory('notes/archive');
```

##### `getTree(recursive?)`
Get complete file tree.
```javascript
const allFiles = await fs.getTree(true);
```

##### `getRepoInfo()`
Get repository metadata.
```javascript
const info = await fs.getRepoInfo();
```

## 🐛 Troubleshooting

### "Repository not found" Error
- Check that repository exists on GitHub
- Verify owner/repo names are correct
- Ensure the repository is not deleted

### "401 Unauthorized" Error
- Your token may be invalid or expired
- Generate a new Personal Access Token
- Ensure token has `repo` scope

### "Rate limit exceeded"
- GitHub has rate limits for API calls
- Authenticated requests: 5,000/hour
- Search API: 30 requests/minute
- Wait a bit before retrying

### "File not found" Error
- Verify the file path is correct
- Use `fs_list_directory` to see available files
- Check if you're on the correct branch

## 🧪 Testing

Test the file system manually in browser console:

```javascript
// In browser console after opening github-fs-demo.html

import GitHubFileSystem from './GitHubFileSystem.js';
import { loadGitHubFSConfig } from './GitHubFileSystem.js';

const config = loadGitHubFSConfig();
const fs = new GitHubFileSystem(config);

// Test write
await fs.writeFile('test.txt', 'Hello World!');

// Test read
const file = await fs.readFile('test.txt');
console.log(file.content); // "Hello World!"

// Test list
const files = await fs.listDirectory('');
console.log(files);

// Clean up
await fs.deleteFile('test.txt');
```

## 🤝 Contributing

This is part of the Agent Loop project. To contribute:

1. Read `AGENTS.md` for code style guidelines
2. Test changes in browser (no build step needed)
3. Ensure all file operations are properly error-handled
4. Document new tools or features

## 📝 License

See main project license.

## 🔗 Resources

- [GitHub REST API Documentation](https://docs.github.com/en/rest)
- [Personal Access Tokens](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token)
- [Google Gemini API](https://ai.google.dev/)

---

**Note**: This is a browser-based application. All code runs client-side - there is no backend server.
