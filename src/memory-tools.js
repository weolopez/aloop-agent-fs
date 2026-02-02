// memory-tools.js
// Tools that allow the agent to read/write its own memory
// These are exposed to the LLM as callable functions

import { logWithPersona } from './persona.js';

/**
 * Create memory tools for the agent
 * @param {MemoryManager} memoryManager - The memory manager instance
 * @returns {Array<Object>} - Array of tool definitions
 */
export function createMemoryTools(memoryManager) {
  return [
    // ============================================
    // WRITE TOOLS
    // ============================================
    {
      name: 'memory_remember',
      description: `Save something important to long-term memory (MEMORY.md). Use this when:
- The user explicitly says "remember this" or "don't forget"
- You learn something important about the user's preferences
- A significant decision is made that should persist
- Technical details that might be needed in future sessions`,
      schema: {
        type: 'object',
        properties: {
          content: {
            type: 'string',
            description: 'What to remember - be specific and include context'
          },
          category: {
            type: 'string',
            description: 'Category for organization',
            enum: ['User Preference', 'Decision', 'Technical', 'Project', 'General']
          }
        },
        required: ['content', 'category']
      },
      execute: async ({ content, category }) => {
        try {
          await memoryManager.writeMemory(content, category);
          return `Saved to long-term memory under "${category}": ${content.substring(0, 100)}${content.length > 100 ? '...' : ''}`;
        } catch (error) {
          return `Failed to save memory: ${error.message}`;
        }
      }
    },

    {
      name: 'memory_log',
      description: `Add an entry to today's daily log. Use this to record:
- Tasks completed
- Important conversations
- Things learned during the session
- Notes for future reference`,
      schema: {
        type: 'object',
        properties: {
          entry: {
            type: 'string',
            description: 'The log entry content'
          },
          category: {
            type: 'string',
            description: 'Type of entry',
            enum: ['Task', 'Note', 'Learned', 'Conversation', 'Error', 'Decision']
          }
        },
        required: ['entry']
      },
      execute: async ({ entry, category = 'Note' }) => {
        try {
          await memoryManager.writeDailyLog(entry, category);
          return `Added to daily log: [${category}] ${entry.substring(0, 80)}${entry.length > 80 ? '...' : ''}`;
        } catch (error) {
          return `Failed to write to daily log: ${error.message}`;
        }
      }
    },

    {
      name: 'memory_update_user',
      description: `Update the user profile (USER.md). Use this when you learn significant new information about the user that should persist across sessions.`,
      schema: {
        type: 'object',
        properties: {
          section: {
            type: 'string',
            description: 'Which section to update',
            enum: ['About', 'Preferences', 'Notes']
          },
          content: {
            type: 'string',
            description: 'Content to add to that section'
          }
        },
        required: ['section', 'content']
      },
      execute: async ({ section, content }) => {
        try {
          // Get current user profile
          let userProfile = memoryManager.getUser() || `# User Profile\n\n## About\n\n## Preferences\n\n## Notes\n`;
          
          // Find section and append content
          const sectionHeader = `## ${section}`;
          const sectionIndex = userProfile.indexOf(sectionHeader);
          
          if (sectionIndex === -1) {
            // Section doesn't exist, add it
            userProfile += `\n${sectionHeader}\n\n${content}\n`;
          } else {
            // Find next section or end of file
            const nextSectionMatch = userProfile.slice(sectionIndex + sectionHeader.length).match(/\n## /);
            const insertPoint = nextSectionMatch 
              ? sectionIndex + sectionHeader.length + nextSectionMatch.index
              : userProfile.length;
            
            // Insert content before next section
            userProfile = userProfile.slice(0, insertPoint) + 
                          `\n- ${content}` + 
                          userProfile.slice(insertPoint);
          }
          
          await memoryManager.writeUser(userProfile);
          return `Updated user profile [${section}]: ${content.substring(0, 60)}${content.length > 60 ? '...' : ''}`;
        } catch (error) {
          return `Failed to update user profile: ${error.message}`;
        }
      }
    },

    // ============================================
    // READ TOOLS
    // ============================================
    {
      name: 'memory_recall',
      description: `Search through memory for relevant information. Use this when:
- You need to recall something from a previous conversation
- Looking for user preferences or past decisions
- Searching for technical details mentioned before`,
      schema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'What to search for'
          }
        },
        required: ['query']
      },
      execute: async ({ query }) => {
        try {
          const results = await memoryManager.search(query);
          
          if (results.length === 0) {
            return `No memories found matching "${query}"`;
          }
          
          let output = `Found ${results.length} file(s) with matches:\n\n`;
          
          for (const result of results) {
            output += `**${result.file}:**\n`;
            for (const match of result.matches.slice(0, 3)) {
              output += `${match}\n---\n`;
            }
            if (result.matches.length > 3) {
              output += `... and ${result.matches.length - 3} more matches\n`;
            }
            output += '\n';
          }
          
          return output;
        } catch (error) {
          return `Failed to search memory: ${error.message}`;
        }
      }
    },

    {
      name: 'memory_read',
      description: `Read a specific memory file in full. Use this to review:
- SOUL.md - Your personality and values
- USER.md - User profile and preferences
- MEMORY.md - Long-term memories
- IDENTITY.md - Your identity configuration
- today - Today's daily log
- yesterday - Yesterday's daily log`,
      schema: {
        type: 'object',
        properties: {
          file: {
            type: 'string',
            description: 'Which memory file to read',
            enum: ['SOUL.md', 'USER.md', 'MEMORY.md', 'IDENTITY.md', 'today', 'yesterday']
          }
        },
        required: ['file']
      },
      execute: async ({ file }) => {
        let content;
        
        switch (file) {
          case 'SOUL.md':
            content = memoryManager.getSoul();
            break;
          case 'USER.md':
            content = memoryManager.getUser();
            break;
          case 'MEMORY.md':
            content = memoryManager.getMemory();
            break;
          case 'IDENTITY.md':
            content = memoryManager.getIdentity();
            break;
          case 'today':
            content = memoryManager.getToday();
            break;
          case 'yesterday':
            content = memoryManager.getYesterday();
            break;
          default:
            return `Unknown memory file: ${file}`;
        }
        
        if (!content) {
          return `${file} is empty or doesn't exist yet.`;
        }
        
        // Truncate if very long
        if (content.length > 4000) {
          return content.substring(0, 4000) + '\n\n... (truncated, use memory_recall to search for specific content)';
        }
        
        return content;
      }
    },

    // ============================================
    // STATS / META
    // ============================================
    {
      name: 'memory_stats',
      description: 'Get statistics about the current memory state',
      schema: {
        type: 'object',
        properties: {},
        required: []
      },
      execute: async () => {
        const stats = memoryManager.getStats();
        
        return `Memory Status:
- Initialized: ${stats.initialized ? 'Yes' : 'No'}
- Soul (SOUL.md): ${stats.hasSoul ? 'Loaded' : 'Using defaults'}
- User (USER.md): ${stats.hasUser ? 'Loaded' : 'Empty'}
- Identity (IDENTITY.md): ${stats.hasIdentity ? 'Loaded' : 'Empty'}
- Long-term Memory (MEMORY.md): ${stats.hasMemory ? `${stats.memorySize} bytes` : 'Empty'}
- Today's Log: ${stats.hasTodayLog ? `${stats.todayLogSize} bytes` : 'Empty'}
- Yesterday's Log: ${stats.hasYesterdayLog ? 'Available' : 'Not loaded'}`;
      }
    }
  ];
}

/**
 * Get tool descriptions formatted for system prompt
 * @param {Array<Object>} tools - Memory tools array
 * @returns {string} - Formatted tool descriptions
 */
export function getMemoryToolsDescription(tools) {
  return tools
    .map(t => `- **${t.name}**: ${t.description.split('\n')[0]}`)
    .join('\n');
}

export default createMemoryTools;
