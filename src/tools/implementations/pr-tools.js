// pr-tools.js
// Pull request tools: create, list

import { defineTool, successResult, errorResult, readString, readNumber, readBoolean } from '../tool-base.js';

// Descriptions loaded from .md files
import createPRDesc from '../descriptions/create-pr.md?raw';
import listPRsDesc from '../descriptions/list-prs.md?raw';

/**
 * Create a pull request
 */
export const CreatePRTool = defineTool('createPullRequest', {
  description: createPRDesc,
  parameters: {
    title: { type: 'string', required: true, description: 'PR title' },
    head: { type: 'string', required: true, description: 'Source branch' },
    base: { type: 'string', required: true, description: 'Target branch' },
    body: { type: 'string', required: false, description: 'PR description (markdown)' },
    draft: { type: 'boolean', required: false, description: 'Create as draft' }
  },
  async execute(args, ctx) {
    const title = readString(args, 'title', { required: true });
    const head = readString(args, 'head', { required: true });
    const base = readString(args, 'base', { required: true });
    const body = readString(args, 'body', { defaultValue: '' });
    const draft = readBoolean(args, 'draft', { defaultValue: false });
    
    const pr = await ctx.fs.createPullRequest({ title, head, base, body, draft });
    
    const output = `Pull request created!\n\n` +
      `- **PR #${pr.number}**: ${pr.title}\n` +
      `- **URL**: ${pr.url}\n` +
      `- **Status**: ${pr.state}${draft ? ' (draft)' : ''}`;
    
    return successResult(output, {
      number: pr.number,
      url: pr.url,
      state: pr.state
    });
  }
});

/**
 * List pull requests
 */
export const ListPRsTool = defineTool('listPullRequests', {
  description: listPRsDesc,
  parameters: {
    state: { type: 'string', required: false, description: 'Filter: open, closed, or all' },
    base: { type: 'string', required: false, description: 'Filter by target branch' },
    head: { type: 'string', required: false, description: 'Filter by source branch' },
    limit: { type: 'number', required: false, description: 'Maximum results' }
  },
  async execute(args, ctx) {
    const state = readString(args, 'state', { defaultValue: 'open' });
    const base = readString(args, 'base');
    const head = readString(args, 'head');
    const limit = readNumber(args, 'limit', { defaultValue: 30, min: 1, max: 100 });
    
    const prs = await ctx.fs.listPullRequests({ state, base, head, limit });
    
    if (prs.length === 0) {
      return successResult(`No pull requests found matching criteria.`, { count: 0, prs: [] });
    }
    
    const formatted = prs.map(pr => 
      `- **#${pr.number}**: ${pr.title}\n  ${pr.head} → ${pr.base} (${pr.state})\n  ${pr.url}`
    ).join('\n\n');
    
    const output = `Pull Requests (${prs.length}):\n\n${formatted}`;
    
    return successResult(output, {
      count: prs.length,
      prs: prs.map(pr => ({ number: pr.number, title: pr.title, state: pr.state }))
    });
  }
});

export default {
  CreatePRTool,
  ListPRsTool
};
