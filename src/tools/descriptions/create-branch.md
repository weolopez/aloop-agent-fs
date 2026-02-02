Create a new branch in the GitHub repository.

## Parameters

- **name** (required): Name for the new branch
- **base** (optional): Base branch to create from (defaults to current branch)

## Behavior

- Creates a new branch pointing to the same commit as the base branch
- Does not switch to the new branch automatically

## Usage Notes

- Use descriptive branch names: `feature/`, `bugfix/`, `docs/`
- Create feature branches before making changes
- Use `setBranch` after creating to switch to it

## Example

Create a feature branch from main:

```json
{
  "name": "feature/user-auth",
  "base": "main"
}
```

Create from current branch:

```json
{
  "name": "bugfix/fix-typo"
}
```
