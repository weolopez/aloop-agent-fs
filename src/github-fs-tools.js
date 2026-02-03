// github-fs-tools.js
// Tools for AgentLoop that use GitHub as a persistent file system.
// These tools enable the agent to read, write, search, and manage files in a GitHub repository.
//
// Platform-agnostic: works in both browser and Node.js

import GitHubFileSystem, { loadGitHubFSConfig, initOctokit } from './GitHubFileSystem.js';
import { isBrowser } from './platform/index.js';

// Module-level singleton for GitHubFileSystem instance
let _githubFS = null;

/**
 * Get or create a GitHubFileSystem instance
 * @returns {Promise<GitHubFileSystem>}
 */
async function getFS() {
  // Singleton pattern - reuse the same instance
  if (!_githubFS) {
    await initOctokit();
    const config = await loadGitHubFSConfig();
    if (!config) {
      throw new Error('GitHub FS not configured');
    }
    _githubFS = new GitHubFileSystem(config);
  }
  return _githubFS;
}

/**
 * Set the GitHubFileSystem instance (useful for testing or pre-initialization)
 * @param {GitHubFileSystem} fs
 */
export function setFS(fs) {
  _githubFS = fs;
}

/**
 * GitHub File System tools for AgentLoop
 * These tools provide full CRUD operations on a GitHub repository
 */
export const githubFSTools = [
  {
    name: 'fs_read_file',
    description: 'Read the contents of a file from the GitHub repository. Use this to retrieve stored data, notes, or any previously written content.',
    schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'File path in the repository (e.g., "notes/todo.txt" or "data/results.json")'
        }
      },
      required: ['path']
    },
    execute: async (params) => {
      try {
        const fs = await getFS();
        const file = await fs.readFile(params.path);
        return `File: ${file.path}\nSize: ${file.size} bytes\n\nContent:\n${file.content}`;
      } catch (error) {
        return `Error reading file: ${error.message}`;
      }
    }
  },
  
  {
    name: 'fs_write_file',
    description: 'Write or update a file in the GitHub repository. Use this to save data, notes, results, or any content that needs to persist. Creates the file if it doesn\'t exist, updates it if it does.',
    schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'File path in the repository (e.g., "notes/todo.txt")'
        },
        content: {
          type: 'string',
          description: 'The content to write to the file'
        },
        message: {
          type: 'string',
          description: 'Optional commit message (defaults to "Update [filename]")'
        }
      },
      required: ['path', 'content']
    },
    execute: async (params) => {
      try {
        const fs = await getFS();
        const file = await fs.writeFile(params.path, params.content, params.message);
        return `✓ File written successfully: ${file.path}\nSize: ${file.size} bytes\nSHA: ${file.sha}`;
      } catch (error) {
        return `Error writing file: ${error.message}`;
      }
    }
  },
  
  {
    name: 'fs_delete_file',
    description: 'Delete a file from the GitHub repository. Use this to remove files that are no longer needed.',
    schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'File path to delete'
        },
        message: {
          type: 'string',
          description: 'Optional commit message'
        }
      },
      required: ['path']
    },
    execute: async (params) => {
      try {
        const fs = await getFS();
        await fs.deleteFile(params.path, params.message);
        return `✓ File deleted successfully: ${params.path}`;
      } catch (error) {
        return `Error deleting file: ${error.message}`;
      }
    }
  },
  
  {
    name: 'fs_list_directory',
    description: 'List all files and subdirectories in a directory. Use this to explore the repository structure or find existing files.',
    schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Directory path (empty string or omit for root directory)'
        }
      }
    },
    execute: async (params) => {
      try {
        const fs = await getFS();
        const entries = await fs.listDirectory(params.path || '');
        
        if (entries.length === 0) {
          return `Directory is empty: ${params.path || '/'}`;
        }
        
        const dirs = entries.filter(e => e.type === 'dir');
        const files = entries.filter(e => e.type === 'file');
        
        let result = `Directory: ${params.path || '/'}\n\n`;
        
        if (dirs.length > 0) {
          result += `Directories (${dirs.length}):\n`;
          dirs.forEach(d => {
            result += `  📁 ${d.name}/\n`;
          });
          result += '\n';
        }
        
        if (files.length > 0) {
          result += `Files (${files.length}):\n`;
          files.forEach(f => {
            result += `  📄 ${f.name} (${f.size} bytes)\n`;
          });
        }
        
        return result;
      } catch (error) {
        return `Error listing directory: ${error.message}`;
      }
    }
  },
  
  {
    name: 'fs_search_code',
    description: 'Search for code or text across all files in the repository. Very useful for finding specific content, keywords, or patterns.',
    schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query (keywords or phrases to find)'
        },
        extension: {
          type: 'string',
          description: 'Optional: filter by file extension (e.g., "txt", "json", "md")'
        },
        path: {
          type: 'string',
          description: 'Optional: filter by path prefix (e.g., "notes/" to search only in notes directory)'
        }
      },
      required: ['query']
    },
    execute: async (params) => {
      try {
        const fs = await getFS();
        const results = await fs.searchCode(params.query, {
          extension: params.extension,
          path: params.path
        });
        
        if (results.length === 0) {
          return `No results found for: "${params.query}"`;
        }
        
        let output = `Found ${results.length} result(s) for: "${params.query}"\n\n`;
        results.forEach((file, idx) => {
          output += `${idx + 1}. ${file.path}\n`;
        });
        
        output += `\nUse fs_read_file to view the content of any file.`;
        return output;
      } catch (error) {
        return `Error searching: ${error.message}`;
      }
    }
  },
  
  {
    name: 'fs_file_exists',
    description: 'Check if a file or directory exists in the repository.',
    schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'File or directory path to check'
        }
      },
      required: ['path']
    },
    execute: async (params) => {
      try {
        const fs = await getFS();
        const exists = await fs.exists(params.path);
        return exists ? `✓ Path exists: ${params.path}` : `✗ Path does not exist: ${params.path}`;
      } catch (error) {
        return `Error checking path: ${error.message}`;
      }
    }
  },
  
  {
    name: 'fs_create_directory',
    description: 'Create a new directory in the repository. Note: GitHub requires at least one file in a directory, so this creates a .gitkeep placeholder.',
    schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Directory path to create (e.g., "notes/archive")'
        }
      },
      required: ['path']
    },
    execute: async (params) => {
      try {
        const fs = await getFS();
        await fs.createDirectory(params.path);
        return `✓ Directory created: ${params.path}/ (with .gitkeep file)`;
      } catch (error) {
        return `Error creating directory: ${error.message}`;
      }
    }
  },
  
  {
    name: 'fs_get_all_files',
    description: 'Get a complete list of all files in the entire repository. Useful for getting an overview of stored data.',
    schema: {
      type: 'object',
      properties: {}
    },
    execute: async (params) => {
      try {
        const fs = await getFS();
        const files = await fs.getTree(true);
        
        if (files.length === 0) {
          return 'Repository is empty (no files found).';
        }
        
        let output = `Total files: ${files.length}\n\n`;
        
        // Group by directory
        const byDir = {};
        files.forEach(f => {
          const dir = f.path.includes('/') ? f.path.substring(0, f.path.lastIndexOf('/')) : '/';
          if (!byDir[dir]) byDir[dir] = [];
          byDir[dir].push(f);
        });
        
        Object.keys(byDir).sort().forEach(dir => {
          output += `\n${dir}/\n`;
          byDir[dir].forEach(f => {
            output += `  ${f.name} (${f.size} bytes)\n`;
          });
        });
        
        return output;
      } catch (error) {
        return `Error getting file list: ${error.message}`;
      }
    }
  },
  
  {
    name: 'fs_get_repo_info',
    description: 'Get information about the GitHub repository being used as file system.',
    schema: {
      type: 'object',
      properties: {}
    },
    execute: async (params) => {
      try {
        const fs = await getFS();
        const info = await fs.getRepoInfo();
        return `Repository: ${info.fullName}
Description: ${info.description || 'No description'}
Default Branch: ${info.defaultBranch}
Private: ${info.private ? 'Yes' : 'No'}
URL: ${info.url}`;
      } catch (error) {
        return `Error getting repository info: ${error.message}`;
      }
    }
  }
];

// Helper function to create a complete tool description for the LLM prompt
export function getGitHubFSToolsDescription() {
  return `
GITHUB FILE SYSTEM:
You have access to a persistent GitHub repository that acts as your file system. All files you create are permanently stored and will be available in future conversations.

Available file system operations:
${githubFSTools.map(t => `- ${t.name}: ${t.description}`).join('\n')}

IMPORTANT USAGE GUIDELINES:
1. Always save important information to files so it persists between sessions
2. Use descriptive file names and organize files in directories (e.g., "notes/", "data/", "results/")
3. When searching for previous work, use fs_search_code or fs_list_directory first
4. File paths use forward slashes (/) and should not start with a slash
5. Common file extensions: .txt for notes, .json for structured data, .md for markdown
6. Before creating a file, consider checking if it exists with fs_file_exists
7. Use fs_read_file to verify the content of files you've written

Example workflows:
- To save a note: fs_write_file(path="notes/todo.txt", content="My tasks...")
- To search past work: fs_search_code(query="keyword")
- To organize files: fs_create_directory(path="archive") then fs_write_file(path="archive/old.txt", ...)
`;
}

export default githubFSTools;
