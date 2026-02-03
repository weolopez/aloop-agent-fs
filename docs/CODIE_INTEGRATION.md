# Codie Integration for OpenCode

This document describes how OpenCode can integrate with Codie CLI to leverage advanced AI capabilities for complex software engineering tasks.

## Overview

Codie is an AI agent with persistent memory that excels at:
- Complex multi-step reasoning
- Creative problem-solving
- Memory and context management
- Long-term knowledge retention

OpenCode can delegate appropriate tasks to Codie while handling simpler tasks locally.

## Integration Architecture

```
OpenCode (Local Reasoning)
    │
    ├── Simple tasks (grep, edit, bash)
    │
    └── Complex tasks → Codie API
        ├── Quick tasks (runQuickTask)
        ├── Memory operations
        └── Persistent sessions
```

## Setup

### 1. Install Codie

```bash
# In your project directory
npm install aloop  # or clone and build locally
```

### 2. Configure Codie

```bash
cd node_modules/aloop
npm run setup
# Or set environment variables:
# GEMINI_API_KEY, GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO
```

### 3. Test Integration

```bash
npm run test:integration
```

## Usage in OpenCode

### Basic Task Delegation

```javascript
import { runQuickTask } from 'aloop/lib/navigator-api.js';

// Simple delegation
const result = await runQuickTask('Design a REST API for a todo app');
console.log(result);
```

### Advanced Integration

```javascript
import { createCodie } from 'aloop/lib/codie-api.js';

const codie = await createCodie({
  geminiApiKey: process.env.GEMINI_API_KEY,
  githubToken: process.env.GITHUB_TOKEN,
  githubOwner: 'myorg',
  githubRepo: 'myrepo'
});

await codie.initialize();

// Complex reasoning task
const result = await codie.runTask(
  'Analyze this codebase and suggest architectural improvements',
  { verbose: true, timeout: 60000 }
);

// Memory operations
await codie.remember('User prefers functional programming style', 'Preference');
const memories = await codie.searchMemory('functional programming');

await codie.cleanup();
```

### Task Analysis Tool

Use the complexity analyzer to determine when to delegate:

```javascript
import { shouldUseCodieTool } from 'aloop/src/tools/codie-integration.js';

const analysis = await shouldUseCodieTool.execute({
  task: 'Refactor this React component to use hooks',
  context: 'User is learning modern React patterns'
});

if (analysis.should_use_navigator) {
  // Delegate to Codie
  const result = await runQuickTask(analysis.task);
} else {
  // Handle locally
  // ... opencode local reasoning
}
```

## Available Tools

### Codie Tool
- **Purpose**: Delegate complex reasoning tasks
- **Parameters**:
  - `task`: The task description
  - `context`: Why this needs Codie
  - `require_memory`: Whether to use persistent memory
  - `timeout`: Timeout in milliseconds

### Memory Tool
- **Purpose**: Access Codie's persistent memory
- **Operations**: remember, recall, search, status

### Complexity Analyzer
- **Purpose**: Determine if a task should use Codie
- **Analyzes**: Multi-step, planning, creative, memory indicators

## Best Practices

### When to Use Codie

✅ **Good candidates:**
- Multi-step refactoring tasks
- Architecture design decisions
- Complex problem analysis
- Tasks requiring memory/context
- Creative coding solutions
- Learning new patterns/frameworks

❌ **Not ideal for:**
- Simple file operations
- Basic syntax questions
- Quick calculations
- Straightforward API calls

### Performance Considerations

- Navigator tasks may take 10-60 seconds
- Use timeouts to prevent hanging
- Consider caching frequent results
- Clean up Navigator instances

### Error Handling

```javascript
try {
  const result = await runQuickTask(task);
} catch (error) {
  if (error.message.includes('timeout')) {
    // Fallback to local reasoning
  } else {
    // Handle other errors
  }
}
```

## Example Use Cases

### 1. Code Review
```javascript
const review = await runQuickTask(`
  Review this React component and suggest improvements:
  \`\`\`jsx
  ${componentCode}
  \`\`\`
`);
```

### 2. Architecture Planning
```javascript
const plan = await runQuickTask(`
  Design a microservices architecture for an e-commerce platform
  with the following requirements: ${requirements}
`);
```

### 3. Learning Assistance
```javascript
await codie.remember('User is learning TypeScript generics', 'Learning');
const explanation = await runQuickTask('Explain TypeScript generics with examples');
```

## Configuration

Create a `.opencode-config.json`:

```json
{
  "codie": {
    "enabled": true,
    "timeout": 30000,
    "auto_delegate_complexity_threshold": 2,
    "memory_enabled": true
  }
}
```

## Troubleshooting

### Codie Not Configured
```
Error: GitHub configuration incomplete
```
**Solution**: Run `npm run setup` in the Codie directory

### Timeout Errors
```
Task timed out after 30000ms
```
**Solution**: Increase timeout or simplify the task

### Memory Operations Fail
```
Codie memory operations not yet implemented
```
**Solution**: Use `require_memory: false` for now

## Future Enhancements

- [ ] Persistent Navigator sessions
- [ ] Real-time streaming responses
- [ ] Batch task processing
- [ ] Integration with version control
- [ ] Custom persona support