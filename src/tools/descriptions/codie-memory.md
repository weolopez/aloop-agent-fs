# codieMemory

Use Codie CLI's persistent memory system to store and retrieve information across sessions.

## Parameters

- **operation** (required): Memory operation ("store", "retrieve", "search", "list")
- **key** (required for store/retrieve): Memory key for storing or retrieving specific information
- **value** (required for store): Information to store in memory
- **category** (optional): Category for organizing memories (e.g., "preferences", "decisions", "patterns")
- **query** (required for search): Search query to find relevant memories
- **limit** (optional for list/search): Maximum number of results. Default: 10

## Behavior

- Stores information persistently across OpenCode sessions
- Retrieves specific memories by key or searches by content
- Lists memories by category or all memories
- Codie maintains its own memory separate from OpenCode's

## Usage Notes

- Best for:
  - Remembering user preferences and patterns
  - Storing design decisions and rationale
  - Tracking project context and constraints
  - Maintaining state across long conversations
- Memory is persistent and searchable
- Use categories to organize related information

## Example

Store a user preference:

```json
{
  "operation": "store",
  "key": "user_pref_framework",
  "value": "User prefers React over Vue.js for new frontend projects",
  "category": "preferences"
}
```

Retrieve specific information:

```json
{
  "operation": "retrieve",
  "key": "user_pref_framework"
}
```

Search for related memories:

```json
{
  "operation": "search",
  "query": "database",
  "category": "architecture"
}
```

List all memories in a category:

```json
{
  "operation": "list",
  "category": "preferences",
  "limit": 5
}
```