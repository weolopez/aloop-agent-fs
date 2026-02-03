# analyzeTaskComplexity

Analyze whether a task should be delegated to Navigator CLI or handled with local reasoning based on complexity indicators.

## Parameters

- **task** (required): The task description to analyze
- **context** (optional): Additional context about the task or codebase
- **factors** (optional): Specific factors to consider (comma-separated: planning, creativity, memory, debugging, architecture, implementation)

## Behavior

- Analyzes task description for complexity indicators
- Considers multiple factors: planning requirements, creativity needed, memory usage, debugging complexity, architecture decisions, implementation scope
- Returns recommendation on whether to use Navigator
- Provides reasoning and confidence score

## Usage Notes

- Use before delegating tasks to make informed decisions
- Higher complexity scores suggest Navigator would be more beneficial
- Consider the recommendation but also use your judgment
- Can override based on user preferences or specific requirements

## Example

Analyze a complex task:

```json
{
  "task": "Design and implement a microservices architecture for an e-commerce platform",
  "context": "The platform needs to handle high traffic, payment processing, and inventory management",
  "factors": "planning,architecture,implementation"
}
```

Result might show:
- Complexity score: 8/10
- Should use Navigator: true
- Reasoning: Task involves multiple complex factors requiring specialized analysis