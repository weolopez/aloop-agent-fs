// search-tools.js
// Code search tool using GitHub's search API

import { defineTool, successResult, errorResult, readString, readNumber } from '../tool-base.js';

// Description loaded from .md file
import searchCodeDesc from '../descriptions/search-code.md?raw';

/**
 * Search for code in the repository
 */
export const SearchCodeTool = defineTool('searchCode', {
  description: searchCodeDesc,
  parameters: {
    query: { type: 'string', required: true, description: 'Search query' },
    extension: { type: 'string', required: false, description: 'File extension filter' },
    path: { type: 'string', required: false, description: 'Path prefix filter' },
    limit: { type: 'number', required: false, description: 'Maximum results (default: 30)' }
  },
  async execute(args, ctx) {
    const query = readString(args, 'query', { required: true });
    const extension = readString(args, 'extension');
    const path = readString(args, 'path');
    const limit = readNumber(args, 'limit', { defaultValue: 30, min: 1, max: 100 });
    
    const results = await ctx.fs.searchCode(query, { extension, path, limit });
    
    if (results.length === 0) {
      return successResult(`No results found for: "${query}"`, { 
        query, 
        count: 0, 
        results: [] 
      });
    }
    
    const formatted = results.map(r => `- ${r.path}`).join('\n');
    
    const output = `Search results for "${query}" (${results.length} matches):\n\n${formatted}\n\n` +
      `Use readFile to view the content of any file.`;
    
    return successResult(output, {
      query,
      count: results.length,
      results: results.map(r => r.path)
    });
  }
});

export default {
  SearchCodeTool
};
