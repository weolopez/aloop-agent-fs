Delete a branch from the GitHub repository.

## Parameters

- **name** (required): Branch name to delete

## Behavior

- Permanently removes the branch reference
- Does not delete commits (they remain in git history)
- Cannot delete protected branches or the default branch

## Usage Notes

- Use after a pull request has been merged
- Cannot delete the currently active branch
- Branch can be recovered if you know the commit SHA

## Example

```json
{
  "name": "feature/completed-feature"
}
```
