// GitHubFileSystem.js
// Low-level GitHub API wrapper for file system operations
// Tool descriptions and documentation are in src/tools/descriptions/*.md

import { Octokit } from "https://esm.sh/octokit";

export class GitHubFileSystem {
  constructor(config) {
    this.config = {
      owner: config.owner,
      repo: config.repo,
      branch: config.branch || 'main',
      auth: config.auth,
      email: config.email || 'agent@localhost'
    };
    this.octokit = new Octokit({ auth: this.config.auth });
    this._cache = new Map();
  }

  // ===========================================================================
  // INITIALIZATION
  // ===========================================================================

  async initialize() {
    try {
      const { data } = await this.octokit.rest.repos.get({
        owner: this.config.owner,
        repo: this.config.repo
      });
      console.log(`Connected to GitHub repo: ${data.full_name}`);
      return true;
    } catch (error) {
      if (error.status === 404) {
        throw new Error(`Repository ${this.config.owner}/${this.config.repo} not found.`);
      }
      if (error.status === 401) {
        throw new Error('Authentication failed. Check your GitHub token.');
      }
      throw new Error(`Failed to connect to GitHub: ${error.message}`);
    }
  }

  async getRepoInfo() {
    const { data } = await this.octokit.rest.repos.get({
      owner: this.config.owner,
      repo: this.config.repo
    });
    return {
      name: data.name,
      fullName: data.full_name,
      description: data.description,
      defaultBranch: data.default_branch,
      private: data.private,
      url: data.html_url
    };
  }

  // ===========================================================================
  // FILE OPERATIONS
  // ===========================================================================

  async readFile(path) {
    const cacheKey = `${this.config.branch}:${path}`;
    if (this._cache.has(cacheKey)) {
      return this._cache.get(cacheKey);
    }

    try {
      const { data } = await this.octokit.rest.repos.getContent({
        owner: this.config.owner,
        repo: this.config.repo,
        path,
        ref: this.config.branch
      });

      if (Array.isArray(data)) {
        throw new Error(`Path '${path}' is a directory. Use listDirectory() instead.`);
      }

      const fileEntry = {
        path: data.path,
        name: data.name,
        content: data.content ? atob(data.content.replace(/\n/g, '')) : '',
        sha: data.sha,
        type: 'file',
        size: data.size
      };

      this._cache.set(cacheKey, fileEntry);
      return fileEntry;
    } catch (error) {
      if (error.status === 404) throw new Error(`File not found: ${path}`);
      throw new Error(`Failed to read file '${path}': ${error.message}`);
    }
  }

  async writeFile(path, content, message) {
    message = message || `Update ${path}`;
    this._cache.delete(`${this.config.branch}:${path}`);

    let sha = null;
    try {
      const existing = await this.readFile(path);
      sha = existing.sha;
    } catch (e) { /* File doesn't exist */ }

    const { data } = await this.octokit.rest.repos.createOrUpdateFileContents({
      owner: this.config.owner,
      repo: this.config.repo,
      path,
      message,
      content: btoa(unescape(encodeURIComponent(content))),
      branch: this.config.branch,
      sha,
      committer: { name: this.config.owner, email: this.config.email }
    });

    return {
      path: data.content.path,
      name: data.content.name,
      content,
      sha: data.content.sha,
      type: 'file',
      size: data.content.size
    };
  }

  async deleteFile(path, message) {
    message = message || `Delete ${path}`;
    this._cache.delete(`${this.config.branch}:${path}`);

    const file = await this.readFile(path);
    await this.octokit.rest.repos.deleteFile({
      owner: this.config.owner,
      repo: this.config.repo,
      path,
      message,
      sha: file.sha,
      branch: this.config.branch,
      committer: { name: this.config.owner, email: this.config.email }
    });

    return true;
  }

  async exists(path) {
    try {
      await this.octokit.rest.repos.getContent({
        owner: this.config.owner,
        repo: this.config.repo,
        path,
        ref: this.config.branch
      });
      return true;
    } catch (error) {
      if (error.status === 404) return false;
      throw error;
    }
  }

  // ===========================================================================
  // DIRECTORY OPERATIONS
  // ===========================================================================

  async listDirectory(path = '') {
    try {
      const { data } = await this.octokit.rest.repos.getContent({
        owner: this.config.owner,
        repo: this.config.repo,
        path,
        ref: this.config.branch
      });

      if (!Array.isArray(data)) {
        throw new Error(`Path '${path}' is a file. Use readFile() instead.`);
      }

      return data.map(item => ({
        path: item.path,
        name: item.name,
        content: null,
        sha: item.sha,
        type: item.type === 'dir' ? 'dir' : 'file',
        size: item.size || 0
      }));
    } catch (error) {
      if (error.status === 404) throw new Error(`Directory not found: ${path}`);
      throw new Error(`Failed to list directory '${path}': ${error.message}`);
    }
  }

  async createDirectory(path) {
    await this.writeFile(`${path}/.gitkeep`, '', `Create directory ${path}`);
    return true;
  }

  async getTree(recursive = true) {
    const { data: refData } = await this.octokit.rest.git.getRef({
      owner: this.config.owner,
      repo: this.config.repo,
      ref: `heads/${this.config.branch}`
    });

    const { data: treeData } = await this.octokit.rest.git.getTree({
      owner: this.config.owner,
      repo: this.config.repo,
      tree_sha: refData.object.sha,
      recursive: recursive ? 'true' : 'false'
    });

    return treeData.tree
      .filter(item => item.type !== 'tree')
      .map(item => ({
        path: item.path,
        name: item.path.split('/').pop(),
        content: null,
        sha: item.sha,
        type: 'file',
        size: item.size || 0
      }));
  }

  // ===========================================================================
  // SEARCH OPERATIONS
  // ===========================================================================

  async searchCode(query, options = {}) {
    const { extension, path, limit = 30 } = options;

    let q = `${query} repo:${this.config.owner}/${this.config.repo}`;
    if (extension) q += ` extension:${extension}`;
    if (path) q += ` path:${path}`;

    try {
      const { data } = await this.octokit.rest.search.code({
        q,
        per_page: Math.min(limit, 100)
      });

      return data.items.map(item => ({
        path: item.path,
        name: item.name,
        content: null,
        sha: item.sha,
        type: 'file',
        size: 0
      }));
    } catch (error) {
      if (error.status === 403 && error.message.includes('rate limit')) {
        throw new Error('GitHub search rate limit exceeded.');
      }
      throw new Error(`Search failed: ${error.message}`);
    }
  }

  // ===========================================================================
  // BRANCH OPERATIONS
  // ===========================================================================

  async listBranches() {
    const { data } = await this.octokit.rest.repos.listBranches({
      owner: this.config.owner,
      repo: this.config.repo,
      per_page: 100
    });
    return data.map(b => ({
      name: b.name,
      sha: b.commit.sha,
      protected: b.protected
    }));
  }

  async createBranch(name, base) {
    const baseRef = base || this.config.branch;
    
    const { data: refData } = await this.octokit.rest.git.getRef({
      owner: this.config.owner,
      repo: this.config.repo,
      ref: `heads/${baseRef}`
    });

    try {
      await this.octokit.rest.git.createRef({
        owner: this.config.owner,
        repo: this.config.repo,
        ref: `refs/heads/${name}`,
        sha: refData.object.sha
      });
      console.log(`Created branch '${name}' from '${baseRef}'`);
      return true;
    } catch (error) {
      if (error.status === 422) throw new Error(`Branch '${name}' already exists.`);
      throw new Error(`Failed to create branch '${name}': ${error.message}`);
    }
  }

  async deleteBranch(name) {
    if (name === this.config.branch) {
      throw new Error(`Cannot delete current branch '${name}'.`);
    }

    try {
      await this.octokit.rest.git.deleteRef({
        owner: this.config.owner,
        repo: this.config.repo,
        ref: `heads/${name}`
      });
      console.log(`Deleted branch '${name}'`);
      return true;
    } catch (error) {
      if (error.status === 422) {
        throw new Error(`Cannot delete branch '${name}': may be protected.`);
      }
      throw new Error(`Failed to delete branch '${name}': ${error.message}`);
    }
  }

  setBranch(name) {
    if (this.config.branch !== name) {
      this.config.branch = name;
      this.clearCache();
      console.log(`Switched to branch '${name}'`);
    }
  }

  getCurrentBranch() {
    return this.config.branch;
  }

  // ===========================================================================
  // PULL REQUEST OPERATIONS
  // ===========================================================================

  async createPullRequest({ title, head, base, body = '', draft = false }) {
    try {
      const { data } = await this.octokit.rest.pulls.create({
        owner: this.config.owner,
        repo: this.config.repo,
        title,
        head,
        base,
        body,
        draft
      });

      console.log(`Created PR #${data.number}: ${title}`);
      return {
        number: data.number,
        url: data.html_url,
        state: data.state,
        title: data.title
      };
    } catch (error) {
      if (error.status === 422) {
        if (error.message?.includes('No commits')) {
          throw new Error(`No commits between '${base}' and '${head}'.`);
        }
        if (error.message?.includes('already exists')) {
          throw new Error(`PR already exists for '${head}' into '${base}'.`);
        }
      }
      throw new Error(`Failed to create PR: ${error.message}`);
    }
  }

  async listPullRequests(options = {}) {
    const { state = 'open', base, head, limit = 30 } = options;

    const params = {
      owner: this.config.owner,
      repo: this.config.repo,
      state,
      per_page: Math.min(limit, 100)
    };
    if (base) params.base = base;
    if (head) params.head = `${this.config.owner}:${head}`;

    const { data } = await this.octokit.rest.pulls.list(params);

    return data.map(pr => ({
      number: pr.number,
      url: pr.html_url,
      state: pr.state,
      title: pr.title,
      head: pr.head.ref,
      base: pr.base.ref,
      createdAt: pr.created_at,
      updatedAt: pr.updated_at
    }));
  }

  // ===========================================================================
  // CACHE
  // ===========================================================================

  clearCache() {
    this._cache.clear();
  }
}

// ===========================================================================
// HELPER FUNCTIONS
// ===========================================================================

export function loadGitHubFSConfig() {
  const saved = localStorage.getItem('github-fs-config');
  if (!saved) {
    throw new Error('GitHub file system not configured.');
  }
  return JSON.parse(saved);
}

export function saveGitHubFSConfig(config) {
  localStorage.setItem('github-fs-config', JSON.stringify(config));
}

export async function setupGitHubFS() {
  console.log('=== GitHub File System Setup ===');
  
  const owner = prompt('GitHub username/organization:', localStorage.getItem('github-fs-owner') || '');
  const repo = prompt('Repository name:', localStorage.getItem('github-fs-repo') || 'agent-workspace');
  const branch = prompt('Branch name:', 'main');
  const auth = prompt('GitHub Personal Access Token (needs repo scope):', '');
  const email = prompt('Your email (for commits):', 'agent@example.com');

  if (!owner || !repo || !auth) {
    throw new Error('Owner, repo, and auth token are required');
  }

  const config = { owner, repo, branch, auth, email };
  const fs = new GitHubFileSystem(config);
  
  await fs.initialize();
  saveGitHubFSConfig(config);
  localStorage.setItem('github-fs-owner', owner);
  localStorage.setItem('github-fs-repo', repo);
  
  console.log('✅ GitHub File System configured!');
  return fs;
}

export default GitHubFileSystem;
