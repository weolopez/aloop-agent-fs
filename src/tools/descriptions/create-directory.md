Create a directory in the GitHub repository.

## Parameters

- **path** (required): Directory path to create

## Behavior

- Creates a `.gitkeep` file in the directory
- GitHub doesn't support empty directories, so a placeholder file is required
- Parent directories are created automatically

## Usage Notes

- Use to set up directory structure before adding files
- The `.gitkeep` file can be deleted once other files are added

## Example

```json
{
  "path": "src/components/ui"
}
```
