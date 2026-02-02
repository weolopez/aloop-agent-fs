# Quick Start Guide: GitHub File System Agent

Get your AI agent running with persistent GitHub storage in 5 minutes!

## Prerequisites

- A GitHub account
- A web browser (Chrome, Firefox, Safari, Edge)
- A Google account (for Gemini API)

## Step-by-Step Setup

### 1️⃣ Create GitHub Repository (2 minutes)

1. Go to https://github.com/new
2. Repository name: `agent-workspace` (or any name you prefer)
3. Description: "AI Agent persistent storage"
4. Choose Public or Private (Private recommended for sensitive data)
5. ✅ Initialize with README
6. Click **Create repository**

### 2️⃣ Get GitHub Token (1 minute)

1. Go to https://github.com/settings/tokens/new
2. Note: "Agent File System Access"
3. Expiration: Choose your preference (90 days recommended)
4. Select scope: ✅ **repo** (full control of private repositories)
5. Click **Generate token**
6. **⚠️ COPY THE TOKEN NOW** (you won't see it again!)

### 3️⃣ Get Gemini API Key (1 minute)

1. Go to https://aistudio.google.com/app/apikey
2. Click **Create API key**
3. Copy your API key

### 4️⃣ Start the Application (1 minute)

In your terminal:

```bash
cd /path/to/aloop
python3 -m http.server 8000
```

Or use any static server:
```bash
npx serve .
```

### 5️⃣ Configure in Browser

1. Open http://localhost:8000/github-fs-demo.html
2. Fill in the configuration form:
   - **GitHub Username**: Your GitHub username
   - **Repository Name**: `agent-workspace` (from step 1)
   - **Branch**: `main`
   - **Access Token**: Paste the token from step 2
   - **Your Email**: Any email for commit author
   - **Gemini API Key**: Paste the key from step 3
3. Click **💾 Save Configuration**
4. Click **🔍 Test Connection** to verify

## 🎉 You're Ready!

Now try these example goals:

### Beginner Examples

```
"Create a file called welcome.txt with a welcome message"
```

```
"Make a todo list and save it as todos.txt"
```

### Intermediate Examples

```
"Research JavaScript best practices and save detailed notes in research/js-practices.md"
```

```
"Create a daily journal entry for today in journal/2024-01-15.md"
```

### Advanced Examples

```
"Search for all existing notes about Python and create a summary document"
```

```
"Organize all files: create directories for notes/, research/, and journal/, then suggest how to reorganize existing files"
```

## 📊 What's Happening Behind the Scenes?

1. **Agent receives your goal** → Thinks about how to achieve it
2. **Decides on actions** → Uses file system tools (read, write, search, etc.)
3. **Interacts with GitHub** → All files are committed to your repository
4. **Remembers context** → Can access previous work in future sessions
5. **Completes goal** → Provides final answer with summary

## 🔍 View Your Results

After the agent runs:

1. Click **📁 View Repository** button in the demo
2. Or go to: `https://github.com/YOUR_USERNAME/agent-workspace`
3. See all files the agent created!
4. Check commit history to see every change

## 💡 Tips for Best Results

### Write Clear Goals
- ❌ "Make a file"
- ✅ "Create a file called notes/ideas.txt with 3 project ideas"

### Use Organization
- Agent can create directories: `notes/`, `data/`, `research/`
- Encourage it: "Save this in the research directory"

### Leverage History
- "Search for my previous notes about X"
- "Find all TODO items across all files"
- "Summarize my journal entries from last week"

### File Naming
- Use descriptive names: `project-ideas.txt` not `file1.txt`
- Include dates: `journal-2024-01-15.md`
- Use extensions: `.txt`, `.md`, `.json`

## 🛠️ Troubleshooting

### "401 Unauthorized" Error
- Your token expired or is invalid
- Go back to step 2 and generate a new token
- Update configuration in the demo

### "Repository not found"
- Check your username and repository name
- Ensure the repository exists on GitHub
- Verify you're using the correct branch name

### "Rate limit exceeded"
- GitHub API has limits (5,000 requests/hour)
- Wait a few minutes before trying again
- This is rare for normal usage

### Agent isn't creating files
- Check browser console for errors (F12)
- Verify Gemini API key is valid
- Try a simpler goal first

## 🎯 Example Session

**You:** "Create a todo list for my project"

**Agent thinks:** 
- I should create a file called todos.txt
- I'll add some common project tasks
- I'll use fs_write_file tool

**Agent acts:**
- Writes `todos.txt` with project tasks
- Verifies the file was created

**Agent responds:** 
"✅ I've created a todo list in todos.txt with 5 project tasks..."

**Result on GitHub:**
- New file: `todos.txt`
- Commit: "Update todos.txt"
- Content visible in your repository

## 🚀 Next Steps

1. **Experiment**: Try different types of goals
2. **Build workflows**: "Every Monday, create a weekly plan file"
3. **Organize data**: Use directories for different projects
4. **Search history**: "What did I work on last week?"
5. **Extend functionality**: Add custom tools (see AGENTS.md)

## 📚 Learn More

- **GITHUB_FS_README.md** - Complete API documentation
- **AGENTS.md** - Developer guide and code patterns
- **GitHubFileSystem.js** - Source code for file system
- **github-fs-tools.js** - Available tools for the agent

## 🤝 Need Help?

Check the documentation or the source code comments for detailed explanations!

---

**Happy agent coding! 🤖✨**
