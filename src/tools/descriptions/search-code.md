Search for code in the GitHub repository using GitHub's code search API.

## Parameters

- **query** (required): Search query (supports GitHub search syntax)
- **extension** (optional): Filter by file extension (e.g., "js", "py")
- **path** (optional): Filter by path prefix (e.g., "src/")
- **limit** (optional): Maximum results (default: 30, max: 100)

## Behavior

- Uses GitHub's code search API
- Returns matching file paths and names (not full content)
- Results sorted by relevance

## Usage Notes

- Use this to find files before reading them
- GitHub search has rate limits; use sparingly
- For exact filename matches, use `listDirectory` or `getTree` instead
- Supports GitHub search syntax: `"exact phrase"`, `OR`, `NOT`

## Example

Search for TODO comments in JavaScript files:

```json
{
  "query": "TODO",
  "extension": "js"
}
```

Search in specific directory:

```json
{
  "query": "fetchUser",
  "path": "src/api"
}
```
