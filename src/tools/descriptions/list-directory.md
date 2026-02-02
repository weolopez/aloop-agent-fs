List contents of a directory in the GitHub repository.

## Parameters

- **path** (optional): Directory path (empty or omit for repository root)

## Behavior

- Returns list of files and subdirectories
- Each entry includes: name, path, type (file/dir), size
- Does not recursively list subdirectories

## Usage Notes

- Use this to explore repository structure
- For full recursive listing, use `getTree` instead
- Useful before reading specific files

## Example

```json
{ "path": "src/components" }
```

Or for root directory:

```json
{}
```
