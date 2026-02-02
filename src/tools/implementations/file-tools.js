// file-tools.js
// File operation tools: read, write, delete, list, exists, create directory, get tree

import { defineTool, successResult, errorResult, readString, readBoolean } from '../tool-base.js';

// Descriptions will be loaded from .md files
import readFileDesc from '../descriptions/read-file.md?raw';
import writeFileDesc from '../descriptions/write-file.md?raw';
import deleteFileDesc from '../descriptions/delete-file.md?raw';
import listDirectoryDesc from '../descriptions/list-directory.md?raw';
import existsDesc from '../descriptions/exists.md?raw';
import createDirectoryDesc from '../descriptions/create-directory.md?raw';
import getTreeDesc from '../descriptions/get-tree.md?raw';

/**
 * Read a file from the repository
 */
export const ReadFileTool = defineTool('readFile', {
  description: readFileDesc,
  parameters: {
    path: { type: 'string', required: true, description: 'File path relative to repository root' }
  },
  async execute(args, ctx) {
    const path = readString(args, 'path', { required: true });
    
    const file = await ctx.fs.readFile(path);
    
    // Format output with line numbers like cat -n
    const lines = file.content.split('\n');
    const numbered = lines.map((line, i) => 
      `${String(i + 1).padStart(5)}| ${line}`
    ).join('\n');
    
    const output = `<file path="${file.path}" size="${file.size}">\n${numbered}\n</file>`;
    
    return successResult(output, {
      path: file.path,
      size: file.size,
      sha: file.sha
    });
  }
});

/**
 * Write or update a file in the repository
 */
export const WriteFileTool = defineTool('writeFile', {
  description: writeFileDesc,
  parameters: {
    path: { type: 'string', required: true, description: 'File path' },
    content: { type: 'string', required: true, description: 'File content' },
    message: { type: 'string', required: false, description: 'Commit message' }
  },
  async execute(args, ctx) {
    const path = readString(args, 'path', { required: true });
    const content = readString(args, 'content', { required: true, trim: false });
    const message = readString(args, 'message', { defaultValue: `Update ${path}` });
    
    const file = await ctx.fs.writeFile(path, content, message);
    
    return successResult(`File written successfully: ${file.path}`, {
      path: file.path,
      size: file.size,
      sha: file.sha
    });
  }
});

/**
 * Delete a file from the repository
 */
export const DeleteFileTool = defineTool('deleteFile', {
  description: deleteFileDesc,
  parameters: {
    path: { type: 'string', required: true, description: 'File path to delete' },
    message: { type: 'string', required: false, description: 'Commit message' }
  },
  async execute(args, ctx) {
    const path = readString(args, 'path', { required: true });
    const message = readString(args, 'message', { defaultValue: `Delete ${path}` });
    
    await ctx.fs.deleteFile(path, message);
    
    return successResult(`File deleted successfully: ${path}`, { path });
  }
});

/**
 * List contents of a directory
 */
export const ListDirectoryTool = defineTool('listDirectory', {
  description: listDirectoryDesc,
  parameters: {
    path: { type: 'string', required: false, description: 'Directory path (empty for root)' }
  },
  async execute(args, ctx) {
    const path = readString(args, 'path', { defaultValue: '' });
    
    const entries = await ctx.fs.listDirectory(path);
    
    const formatted = entries.map(e => 
      `${e.type === 'dir' ? '📁' : '📄'} ${e.name}${e.type === 'dir' ? '/' : ''} (${e.size} bytes)`
    ).join('\n');
    
    const output = `Directory: ${path || '/'}\n\n${formatted}`;
    
    return successResult(output, { 
      path, 
      count: entries.length,
      entries: entries.map(e => ({ name: e.name, type: e.type, size: e.size }))
    });
  }
});

/**
 * Check if a file or directory exists
 */
export const ExistsTool = defineTool('exists', {
  description: existsDesc,
  parameters: {
    path: { type: 'string', required: true, description: 'Path to check' }
  },
  async execute(args, ctx) {
    const path = readString(args, 'path', { required: true });
    
    const exists = await ctx.fs.exists(path);
    
    return successResult(exists ? `Path exists: ${path}` : `Path does not exist: ${path}`, {
      path,
      exists
    });
  }
});

/**
 * Create a directory
 */
export const CreateDirectoryTool = defineTool('createDirectory', {
  description: createDirectoryDesc,
  parameters: {
    path: { type: 'string', required: true, description: 'Directory path to create' }
  },
  async execute(args, ctx) {
    const path = readString(args, 'path', { required: true });
    
    await ctx.fs.createDirectory(path);
    
    return successResult(`Directory created: ${path}`, { path });
  }
});

/**
 * Get full repository tree
 */
export const GetTreeTool = defineTool('getTree', {
  description: getTreeDesc,
  parameters: {
    recursive: { type: 'boolean', required: false, description: 'Include subdirectories' }
  },
  async execute(args, ctx) {
    const recursive = readBoolean(args, 'recursive', { defaultValue: true });
    
    const tree = await ctx.fs.getTree(recursive);
    
    const formatted = tree.map(f => f.path).join('\n');
    const output = `Repository files (${tree.length} total):\n\n${formatted}`;
    
    return successResult(output, {
      count: tree.length,
      files: tree.map(f => f.path)
    });
  }
});

export default {
  ReadFileTool,
  WriteFileTool,
  DeleteFileTool,
  ListDirectoryTool,
  ExistsTool,
  CreateDirectoryTool,
  GetTreeTool
};
