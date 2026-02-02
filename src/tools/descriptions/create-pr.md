Create a pull request to merge one branch into another.

## Parameters

- **title** (required): PR title
- **head** (required): Branch containing changes (source branch)
- **base** (required): Branch to merge into (target branch)
- **body** (optional): PR description in markdown
- **draft** (optional): Create as draft PR (default: false)

## Behavior

- Creates a new pull request on GitHub
- Returns PR number and URL
- Fails if no commits exist between branches

## Usage Notes

- Ensure you've committed changes to the head branch first
- Use markdown in body for formatting
- Draft PRs are useful for work-in-progress

## Example

```json
{
  "title": "Add user authentication",
  "head": "feature/auth",
  "base": "main",
  "body": "## Summary\n\n- Add login page\n- Add JWT token handling\n\n## Testing\n\nManual testing completed.",
  "draft": false
}
```
