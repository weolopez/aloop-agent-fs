// tools/index.js
// Central registry for all available tools
// This module exports all tools and provides utility functions for tool discovery

import { 
  ReadFileTool, 
  WriteFileTool, 
  DeleteFileTool, 
  ListDirectoryTool,
  ExistsTool,
  CreateDirectoryTool,
  GetTreeTool
} from './implementations/file-tools.js';

import {
  ListBranchesTool,
  CreateBranchTool,
  DeleteBranchTool,
  SetBranchTool
} from './implementations/branch-tools.js';

import {
  CreatePRTool,
  ListPRsTool
} from './implementations/pr-tools.js';

import {
  SearchCodeTool
} from './implementations/search-tools.js';

import {
  RelayMessageTool
} from './implementations/relay-tools.js';

import {
  DelegateTaskTool,
  AskCodieTool,
  CodieMemoryTool,
  AnalyzeTaskComplexityTool
} from './implementations/codie-tools.js';

/**
 * All available tools organized by category
 */
export const toolsByCategory = {
  file: {
    readFile: ReadFileTool,
    writeFile: WriteFileTool,
    deleteFile: DeleteFileTool,
    listDirectory: ListDirectoryTool,
    exists: ExistsTool,
    createDirectory: CreateDirectoryTool,
    getTree: GetTreeTool
  },
  branch: {
    listBranches: ListBranchesTool,
    createBranch: CreateBranchTool,
    deleteBranch: DeleteBranchTool,
    setBranch: SetBranchTool
  },
  pr: {
    createPullRequest: CreatePRTool,
    listPullRequests: ListPRsTool
  },
  search: {
    searchCode: SearchCodeTool
  },
   relay: {
     relayMessage: RelayMessageTool
   },
    codie: {
      delegateTask: DelegateTaskTool,
      askCodie: AskCodieTool,
      codieMemory: CodieMemoryTool,
      analyzeTaskComplexity: AnalyzeTaskComplexityTool
    }
};

/**
 * Flat map of all tools by name
 */
export const allTools = {
  // File operations
  readFile: ReadFileTool,
  writeFile: WriteFileTool,
  deleteFile: DeleteFileTool,
  listDirectory: ListDirectoryTool,
  exists: ExistsTool,
  createDirectory: CreateDirectoryTool,
  getTree: GetTreeTool,
  
  // Branch operations
  listBranches: ListBranchesTool,
  createBranch: CreateBranchTool,
  deleteBranch: DeleteBranchTool,
  setBranch: SetBranchTool,
  
  // Pull request operations
  createPullRequest: CreatePRTool,
  listPullRequests: ListPRsTool,
  
  // Search operations
  searchCode: SearchCodeTool,

   // Relay operations
   relayMessage: RelayMessageTool,

    // Codie operations
    delegateTask: DelegateTaskTool,
    askCodie: AskCodieTool,
    codieMemory: CodieMemoryTool,
    analyzeTaskComplexity: AnalyzeTaskComplexityTool
};

/**
 * Get a tool by name
 * @param {string} name - Tool name
 * @returns {Object|undefined} Tool definition or undefined
 */
export function getTool(name) {
  return allTools[name];
}

/**
 * Get all tool names
 * @returns {string[]} Array of tool names
 */
export function getToolNames() {
  return Object.keys(allTools);
}

/**
 * Get tools by category
 * @param {string} category - Category name (file, branch, pr, search)
 * @returns {Object} Tools in that category
 */
export function getToolsByCategory(category) {
  return toolsByCategory[category] || {};
}

/**
 * Get all category names
 * @returns {string[]} Array of category names
 */
export function getCategories() {
  return Object.keys(toolsByCategory);
}

/**
 * Generate a summary of all available tools for the LLM
 * @returns {string} Formatted tool summary
 */
export function getToolSummary() {
  const lines = ['# Available Tools\n'];
  
  for (const [category, tools] of Object.entries(toolsByCategory)) {
    lines.push(`## ${category.charAt(0).toUpperCase() + category.slice(1)} Operations\n`);
    
    for (const [name, tool] of Object.entries(tools)) {
      // Extract first line of description as summary
      const summary = tool.description.split('\n')[0];
      lines.push(`- **${name}**: ${summary}`);
    }
    
    lines.push('');
  }
  
  return lines.join('\n');
}

/**
 * Execute a tool by name
 * @param {string} name - Tool name
 * @param {Object} args - Tool arguments
 * @param {Object} ctx - Execution context (must include fs: GitHubFileSystem)
 * @returns {Promise<Object>} Tool result
 */
export async function executeTool(name, args, ctx) {
  const tool = getTool(name);
  
  if (!tool) {
    return {
      success: false,
      output: `Unknown tool: ${name}. Available tools: ${getToolNames().join(', ')}`,
      metadata: { error: 'unknown_tool' }
    };
  }
  
  return tool.execute(args, ctx);
}

/**
 * Get tool schema for LLM function calling
 * @param {string} name - Tool name
 * @returns {Object|null} Tool schema in function calling format
 */
export function getToolSchema(name) {
  const tool = getTool(name);
  if (!tool) return null;
  
  const properties = {};
  const required = [];
  
  for (const [paramName, config] of Object.entries(tool.parameters)) {
    properties[paramName] = {
      type: config.type,
      description: config.description
    };
    
    if (config.required) {
      required.push(paramName);
    }
  }
  
  return {
    name: tool.name,
    description: tool.description,
    parameters: {
      type: 'object',
      properties,
      required
    }
  };
}

/**
 * Get all tool schemas for LLM function calling
 * @returns {Object[]} Array of tool schemas
 */
export function getAllToolSchemas() {
  return getToolNames().map(name => getToolSchema(name));
}

export default {
  allTools,
  toolsByCategory,
  getTool,
  getToolNames,
  getToolsByCategory,
  getCategories,
  getToolSummary,
  executeTool,
  getToolSchema,
  getAllToolSchemas
};
