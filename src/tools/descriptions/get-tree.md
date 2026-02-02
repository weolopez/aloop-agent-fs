Get the full tree of all files in the repository.

## Parameters

- **recursive** (optional): Include files in all subdirectories (default: true)

## Behavior

- Returns list of all files in the repository
- More efficient than recursive `listDirectory` calls
- Does not include file content, only paths and metadata

## Usage Notes

- Use for getting a complete view of repository structure
- Helpful for finding files when you don't know exact location
- Large repositories may have many entries

## Example

```json
{
  "recursive": true
}
```
