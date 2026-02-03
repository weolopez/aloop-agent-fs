# askCodie

Ask Codie CLI for advice, analysis, or specialized knowledge on software engineering topics.

## Parameters

- **question** (required): The question or topic to ask Codie about
- **context** (optional): Additional context about the codebase or situation
- **detailLevel** (optional): Level of detail in response ("brief", "normal", "detailed"). Default: "normal"

## Behavior

- Uses Codie CLI's knowledge and reasoning capabilities
- Codie analyzes the question in context of current codebase
- Returns thoughtful analysis and recommendations
- Falls back gracefully if Codie is unavailable

## Usage Notes

- Best for:
  - Design decisions and architecture advice
  - Code review and optimization suggestions
  - Debugging help and problem analysis
  - Best practices and technology recommendations
  - Understanding complex code patterns
- Use `delegateTask` for tasks that require Codie to take actions
- Questions should be specific and actionable

## Example

Ask for architecture advice:

```json
{
  "question": "What's the best way to structure our API endpoints for this e-commerce application?",
  "context": "We have products, orders, users, and payments. Currently using REST but considering GraphQL.",
  "detailLevel": "detailed"
}
```

Ask for debugging help:

```json
{
  "question": "Why is our React component re-rendering on every state change despite using useMemo?",
  "context": "The component is in src/components/ProductList.tsx and receives products array as props"
}
```