Write or update a file in the GitHub repository.

## Parameters

- **path** (required): File path relative to repository root
- **content** (required): File content to write
- **message** (optional): Commit message (defaults to "Update {path}")

## Behavior

- Creates the file if it doesn't exist
- Updates the file if it already exists
- Each write creates a new commit in the repository
- Automatically handles base64 encoding for GitHub API

## Usage Notes

- Always provide a meaningful commit message for traceability
- For new files, parent directories are created automatically
- Cannot write binary content directly

## Example

```json
{
  "path": "docs/README.md",
  "content": "# My Project\n\nWelcome to the documentation.",
  "message": "Add project documentation"
}
```
