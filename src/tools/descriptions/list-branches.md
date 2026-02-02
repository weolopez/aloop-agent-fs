List all branches in the GitHub repository.

## Parameters

None required.

## Behavior

- Returns all branches with their names and protection status
- Includes the SHA of each branch's HEAD commit

## Usage Notes

- Use before creating a new branch to check if name exists
- Protected branches cannot be deleted or force-pushed

## Example

```json
{}
```

Returns:

```json
[
  { "name": "main", "protected": true },
  { "name": "feature/auth", "protected": false }
]
```
