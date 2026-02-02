List pull requests in the GitHub repository.

## Parameters

- **state** (optional): Filter by state - "open", "closed", or "all" (default: "open")
- **base** (optional): Filter by target branch
- **head** (optional): Filter by source branch
- **limit** (optional): Maximum results (default: 30)

## Behavior

- Returns list of pull requests matching filters
- Includes PR number, title, state, URL, and branches

## Usage Notes

- Use to check for existing PRs before creating new ones
- Filter by base branch to see what's targeting a specific branch

## Example

Get all open PRs:

```json
{}
```

Get PRs targeting main:

```json
{
  "base": "main",
  "state": "open"
}
```
