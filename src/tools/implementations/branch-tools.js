// branch-tools.js
// Branch management tools: list, create, delete, switch

import { defineTool, successResult, errorResult, readString } from '../tool-base.js';

// Descriptions loaded from .md files
import listBranchesDesc from '../descriptions/list-branches.md?raw';
import createBranchDesc from '../descriptions/create-branch.md?raw';
import deleteBranchDesc from '../descriptions/delete-branch.md?raw';
import setBranchDesc from '../descriptions/set-branch.md?raw';

/**
 * List all branches in the repository
 */
export const ListBranchesTool = defineTool('listBranches', {
  description: listBranchesDesc,
  parameters: {},
  async execute(args, ctx) {
    const branches = await ctx.fs.listBranches();
    
    const current = ctx.fs.getCurrentBranch();
    const formatted = branches.map(b => 
      `${b.name === current ? '* ' : '  '}${b.name}${b.protected ? ' (protected)' : ''}`
    ).join('\n');
    
    const output = `Branches:\n\n${formatted}`;
    
    return successResult(output, {
      current,
      branches: branches.map(b => b.name),
      count: branches.length
    });
  }
});

/**
 * Create a new branch
 */
export const CreateBranchTool = defineTool('createBranch', {
  description: createBranchDesc,
  parameters: {
    name: { type: 'string', required: true, description: 'New branch name' },
    base: { type: 'string', required: false, description: 'Base branch (defaults to current)' }
  },
  async execute(args, ctx) {
    const name = readString(args, 'name', { required: true });
    const base = readString(args, 'base');
    
    await ctx.fs.createBranch(name, base);
    
    const baseBranch = base || ctx.fs.getCurrentBranch();
    return successResult(`Branch '${name}' created from '${baseBranch}'`, {
      name,
      base: baseBranch
    });
  }
});

/**
 * Delete a branch
 */
export const DeleteBranchTool = defineTool('deleteBranch', {
  description: deleteBranchDesc,
  parameters: {
    name: { type: 'string', required: true, description: 'Branch name to delete' }
  },
  async execute(args, ctx) {
    const name = readString(args, 'name', { required: true });
    
    await ctx.fs.deleteBranch(name);
    
    return successResult(`Branch '${name}' deleted`, { name });
  }
});

/**
 * Switch to a different branch
 */
export const SetBranchTool = defineTool('setBranch', {
  description: setBranchDesc,
  parameters: {
    name: { type: 'string', required: true, description: 'Branch name to switch to' }
  },
  async execute(args, ctx) {
    const name = readString(args, 'name', { required: true });
    
    const previousBranch = ctx.fs.getCurrentBranch();
    ctx.fs.setBranch(name);
    
    return successResult(`Switched from '${previousBranch}' to '${name}'`, {
      previous: previousBranch,
      current: name
    });
  }
});

export default {
  ListBranchesTool,
  CreateBranchTool,
  DeleteBranchTool,
  SetBranchTool
};
