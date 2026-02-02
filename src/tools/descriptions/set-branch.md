Switch the active branch for subsequent operations.

## Parameters

- **name** (required): Branch name to switch to

## Behavior

- Changes the branch used for all file operations
- Clears the file cache (content may differ between branches)
- Does not create the branch (use `createBranch` first)

## Usage Notes

- Always verify branch exists before switching
- File reads after switching will return content from new branch
- Writes will commit to the new branch

## Example

```json
{
  "name": "feature/new-feature"
}
```
