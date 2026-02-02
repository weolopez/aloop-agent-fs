// GitHubFileSystem.js
// Extended with branching and PR support

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

  async initialize() {
    try {
      const { data } = await this.octokit.rest.repos.get({
        owner: this.config.owner,
        repo: this.config.repo
      });
      return true;
    } catch (error) {
      throw new Error(`Failed to connect to GitHub: ${error.message}`);
    }
  }

  async readFile(path) {
    const cacheKey = `${this.config.branch}:${path}`;
    if (this._cache.has(cacheKey)) return this._cache.get(cacheKey);

    try {
      const { data } = await this.octokit.rest.repos.getContent({
        owner: this.config.owner,
        repo: this.config.repo,
        path: path,
        ref: this.config.branch
      });

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
    const cacheKey = `${this.config.branch}:${path}`;
    this._cache.delete(cacheKey);

    try {
      let sha = null;
      try {
        const existing = await this.readFile(path);
        sha = existing.sha;
      } catch (error) {}

      const encodedContent = btoa(unescape(encodeURIComponent(content)));

      const { data } = await this.octokit.rest.repos.createOrUpdateFileContents({
        owner: this.config.owner,
        repo: this.config.repo,
        path: path,
        message: message,
        content: encodedContent,
        branch: this.config.branch,
        sha: sha,
        committer: { name: this.config.owner, email: this.config.email }
      });

      return {
        path: data.content.path,
        name: data.content.name,
        content: content,
        sha: data.content.sha,
        type: 'file',
        size: data.content.size
      };
    } catch (error) {
      throw new Error(`Failed to write file '${path}': ${error.message}`);
    }
  }

  async deleteFile(path, message) {
    message = message || `Delete ${path}`;
    this._cache.delete(`${this.config.branch}:${path}`);

    try {
      const file = await this.readFile(path);
      await this.octokit.rest.repos.deleteFile({
        owner: this.config.owner,
        repo: this.config.repo,
        path: path,
        message: message,
        sha: file.sha,
        branch: this.config.branch,
        committer: { name: this.config.owner, email: this.config.email }
      });
      return true;
    } catch (error) {
      throw new Error(`Failed to delete file '${path}': ${error.message}`);
    }
  }

  async listDirectory(path = '') {
    try {
      const { data } = await this.octokit.rest.repos.getContent({
        owner: this.config.owner,
        repo: this.config.repo,
        path: path,
        ref: this.config.branch
      });

      return data.map(item => ({
        path: item.path,
        name: item.name,
        type: item.type === 'dir' ? 'dir' : 'file',
        sha: item.sha,
        size: item.size || 0
      }));
    } catch (error) {
      throw new Error(`Failed to list directory '${path}': ${error.message}`);
    }
  }

  async searchCode(query, options = {}) {
    const { extension, path, limit = 30 } = options;
    try {
      let q = `${query} repo:${this.config.owner}/${this.config.repo}`;
      if (extension) q += ` extension:${extension}`;
      if (path) q += ` path:${path}`;

      const { data } = await this.octokit.rest.search.code({ q, per_page: limit });
      return data.items.map(item => ({ path: item.path, name: item.name, sha: item.sha, type: 'file' }));
    } catch (error) {
      throw new Error(`Search failed: ${error.message}`);
    }
  }

  async exists(path) {
    try {
      await this.octokit.rest.repos.getContent({
        owner: this.config.owner,
        repo: this.config.repo,
        path: path,
        ref: this.config.branch
      });
      return true;
    } catch (error) {
      if (error.status === 404) return false;
      throw error;
    }
  }

  async createDirectory(path) {
    return await this.writeFile(`${path}/.gitkeep`, '', `Create directory ${path}`);
  }

  async getTree(recursive = true) {
    try {
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

      return treeData.tree.filter(item => item.type !== 'tree').map(item => ({
        path: item.path,
        name: item.path.split('/').pop(),
        sha: item.sha,
        type: 'file',
        size: item.size || 0
      }));
    } catch (error) {
      throw new Error(`Failed to get tree: ${error.message}`);
    }
  }

  // --- NEW BRANCHING METHODS ---

  async listBranches() {
    try {
      const { data } = await this.octokit.rest.repos.listBranches({
        owner: this.config.owner,
        repo: this.config.repo
      });
      return data.map(b => b.name);
    } catch (error) {
      throw new Error(`Failed to list branches: ${error.message}`);
    }
  }

  async createBranch(name, base) {
    try {
      const baseRef = base || this.config.branch;
      const { data: refData } = await this.octokit.rest.git.getRef({
        owner: this.config.owner,
        repo: this.config.repo,
        ref: `heads/${baseRef}`
      });

      await this.octokit.rest.git.createRef({
        owner: this.config.owner,
        repo: this.config.repo,
        ref: `refs/heads/${name}`,
        sha: refData.object.sha
      });
      return true;
    } catch (error) {
      throw new Error(`Failed to create branch '${name}': ${error.message}`);
    }
  }

  async deleteBranch(name) {
    try {
      await this.octokit.rest.git.deleteRef({
        owner: this.config.owner,
        repo: this.config.repo,
        ref: `heads/${name}`
      });
      return true;
    } catch (error) {
      throw new Error(`Failed to delete branch '${name}': ${error.message}`);
    }
  }

  setBranch(name) {
    this.config.branch = name;
    this.clearCache();
  }

  async createPullRequest({ title, head, base, body }) {
    try {
      const { data } = await this.octokit.rest.pulls.create({
        owner: this.config.owner,
        repo: this.config.repo,
        title,
        head,
        base,
        body
      });
      return {
        number: data.number,
        url: data.html_url,
        state: data.state
      };
    } catch (error) {
      throw new Error(`Failed to create PR: ${error.message}`);
    }
  }

  clearCache() {
    this._cache.clear();
  }

  async getRepoInfo() {
    const { data } = await this.octokit.rest.repos.get({
      owner: this.config.owner,
      repo: this.config.repo
    });
    return {
      name: data.name,
      fullName: data.full_name,
      defaultBranch: data.default_branch,
      url: data.html_url
    };
  }
}

export default GitHubFileSystem;