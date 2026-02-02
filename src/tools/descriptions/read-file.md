Read a file from the GitHub repository.

## Parameters

- **path** (required): File path relative to repository root

## Behavior

- Returns file content with line numbers in `cat -n` format
- Results are cached for improved performance
- Automatically decodes base64 content from GitHub API
- Returns file metadata including SHA and size

## Usage Notes

- Use `searchCode` first if you don't know the exact file path
- For large files, content may be truncated
- Cannot read binary files (returns error)

## Example

```json
{ "path": "src/config/settings.json" }
```
