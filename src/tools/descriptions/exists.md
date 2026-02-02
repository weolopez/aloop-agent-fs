Check if a file or directory exists in the repository.

## Parameters

- **path** (required): Path to check

## Behavior

- Returns true if the path exists, false otherwise
- Works for both files and directories
- Does not throw an error if path doesn't exist

## Usage Notes

- Use before reading/writing to check if file exists
- Useful for conditional logic in workflows

## Example

```json
{
  "path": "config/settings.json"
}
```
