Delete a file from the GitHub repository.

## Parameters

- **path** (required): File path to delete
- **message** (optional): Commit message (defaults to "Delete {path}")

## Behavior

- Removes the file from the repository
- Creates a commit recording the deletion
- Fails if the file doesn't exist

## Usage Notes

- This action is permanent (though recoverable via git history)
- Provide a clear commit message explaining why the file was deleted

## Example

```json
{
  "path": "temp/old-notes.txt",
  "message": "Remove deprecated notes file"
}
```
