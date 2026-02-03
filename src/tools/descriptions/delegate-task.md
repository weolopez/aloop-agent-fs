# delegateTask

Delegate a complex or multi-step software engineering task to Navigator CLI for specialized handling.

## Parameters

- **task** (required): Description of the task to delegate. Should be detailed enough for Navigator to understand the requirements and approach.
- **context** (optional): Additional context about the codebase, project state, or constraints.
- **priority** (optional): Task priority level ("low", "medium", "high"). Default: "medium"
- **timeout** (optional): Maximum time in minutes to allow Navigator to work on the task. Default: 30

## Behavior

- Uses Navigator CLI's programmatic API to handle complex tasks
- Navigator will analyze the task, break it down, and execute it step-by-step
- Returns Navigator's findings, actions taken, and results
- Falls back to local reasoning if Navigator is unavailable

## Usage Notes

- Best for complex multi-step tasks like:
  - Refactoring large codebases
  - Implementing complex features
  - Debugging systemic issues
  - Architecture design and planning
  - Code reviews and optimization
- Use `askNavigator` for simpler questions or advice
- Navigator has access to the same codebase and tools as OpenCode

## Example

Delegate a complex feature implementation:

```json
{
  "task": "Implement a user authentication system with JWT tokens, password hashing, and role-based access control",
  "context": "This is a React/Node.js application using Express and MongoDB",
  "priority": "high"
}
```

Delegate a refactoring task:

```json
{
  "task": "Refactor the payment processing module to use async/await instead of callbacks",
  "context": "The module is in src/services/payment.js and affects 5 other files",
  "timeout": 60
}
```