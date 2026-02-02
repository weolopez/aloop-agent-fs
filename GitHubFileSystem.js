// GitHubFileSystem.js
// This class provides a complete file system abstraction over GitHub repository.
// It enables the agent to use a GitHub repo as persistent storage for all operations:
// - Create/Read/Update/Delete files and directories
// - Search code across the repository
// - List directory contents
// - Batch operations for efficiency
// All operations use the GitHub REST API via Octokit.

import { Octokit } from "https://esm.sh/octokit";

/**
 * @typedef {Object} GitHubConfig
 * @property {string} owner - Repository owner
 * @property {string} repo - Repository name
 * @property {string} branch - Branch name (default: 'main')
 * @property {string} auth - GitHub Personal Access Token
 * @property {string} email - Committer email
 */

/**
 * @typedef {Object} FileEntry
 * @property {string} path - File path in repository
 * @property {string} name - File name
 * @property {string} content - File content (decoded)
 * @property {string} sha - Git SHA hash
 * @property {string} type - 'file' or 'dir'
 * @property {number} size - File size in bytes
 */

export class GitHubFileSystem {
  /**
   * @param {GitHubConfig} config - GitHub repository configuration
   */
  constructor(config) {
    this.config = {
      owner: config.owner,
      repo: config.repo,
      branch: config.branch || 'main',
      auth: config.auth,
      email: config.email || 'agent@localhost'
    };
    this.octokit = new Octokit({ auth: this.config.auth });
    this._cache = new Map(); // Simple in-memory cache for reads
  }

  /**
   * Initialize and verify the repository exists
   * @returns {Promise<boolean>} True if repo is accessible
   */
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
        throw new Error(`Repository ${this.config.owner}/${this.config.repo} not found. Please create it first.`);
      }
      throw new Error(`Failed to connect to GitHub: ${error.message}`);
    }
  }

  /**
   * Read a file from the repository
   * @param {string} path - File path (e.g., 'data/notes.txt')
   * @returns {Promise<FileEntry>} File entry with decoded content
   */
  async readFile(path) {
    // Check cache first
    const cacheKey = `${this.config.branch}:${path}`;
    if (this._cache.has(cacheKey)) {
      return this._cache.get(cacheKey);
    }

    try {
      const { data } = await this.octokit.rest.repos.getContent({
        owner: this.config.owner,
        repo: this.config.repo,
        path: path,
        ref: this.config.branch
      });

      if (Array.isArray(data)) {
        throw new Error(`Path '${path}' is a directory, not a file. Use listDirectory() instead.`);
      }

      const fileEntry = {
        path: data.path,
        name: data.name,
        content: data.content ? atob(data.content.replace(/\n/g, '')) : '',
        sha: data.sha,
        type: 'file',
        size: data.size
      };

      // Cache the result
      this._cache.set(cacheKey, fileEntry);
      return fileEntry;
    } catch (error) {
      if (error.status === 404) {
        throw new Error(`File not found: ${path}`);
      }
      throw new Error(`Failed to read file '${path}': ${error.message}`);
    }
  }

  /**
   * Write or update a file in the repository
   * @param {string} path - File path
   * @param {string} content - File content (plain text)
   * @param {string} [message] - Commit message
   * @returns {Promise<FileEntry>} Updated file entry
   */
  async writeFile(path, content, message) {
    message = message || `Update ${path}`;
    
    // Invalidate cache for this file
    const cacheKey = `${this.config.branch}:${path}`;
    this._cache.delete(cacheKey);

    try {
      // Check if file exists to get its SHA (required for updates)
      let sha = null;
      try {
        const existing = await this.readFile(path);
        sha = existing.sha;
      } catch (error) {
        // File doesn't exist, that's okay for creation
      }

      // Encode content to base64
      const encodedContent = btoa(unescape(encodeURIComponent(content)));

      const { data } = await this.octokit.rest.repos.createOrUpdateFileContents({
        owner: this.config.owner,
        repo: this.config.repo,
        path: path,
        message: message,
        content: encodedContent,
        branch: this.config.branch,
        sha: sha, // undefined for new files, required for updates
        committer: {
          name: this.config.owner,
          email: this.config.email
        }
      });

      return {
        path: data.content.path,
        name: data.content.name,
        content: content, // Return original content (not encoded)
        sha: data.content.sha,
        type: 'file',
        size: data.content.size
      };
    } catch (error) {
      throw new Error(`Failed to write file '${path}': ${error.message}`);
    }
  }

  /**
   * Delete a file from the repository
   * @param {string} path - File path
   * @param {string} [message] - Commit message
   * @returns {Promise<boolean>} True if deleted successfully
   */
  async deleteFile(path, message) {
    message = message || `Delete ${path}`;
    
    // Invalidate cache
    const cacheKey = `${this.config.branch}:${path}`;
    this._cache.delete(cacheKey);

    try {
      // Get file SHA (required for deletion)
      const file = await this.readFile(path);

      await this.octokit.rest.repos.deleteFile({
        owner: this.config.owner,
        repo: this.config.repo,
        path: path,
        message: message,
        sha: file.sha,
        branch: this.config.branch,
        committer: {
          name: this.config.owner,
          email: this.config.email
        }
      });

      return true;
    } catch (error) {
      throw new Error(`Failed to delete file '${path}': ${error.message}`);
    }
  }

  /**
   * List contents of a directory
   * @param {string} [path=''] - Directory path (empty for root)
   * @returns {Promise<FileEntry[]>} Array of file/directory entries
   */
  async listDirectory(path = '') {
    try {
      const { data } = await this.octokit.rest.repos.getContent({
        owner: this.config.owner,
        repo: this.config.repo,
        path: path,
        ref: this.config.branch
      });

      if (!Array.isArray(data)) {
        throw new Error(`Path '${path}' is a file, not a directory. Use readFile() instead.`);
      }

      return data.map(item => ({
        path: item.path,
        name: item.name,
        content: null, // Don't load content for listings
        sha: item.sha,
        type: item.type === 'dir' ? 'dir' : 'file',
        size: item.size || 0
      }));
    } catch (error) {
      if (error.status === 404) {
        throw new Error(`Directory not found: ${path}`);
      }
      throw new Error(`Failed to list directory '${path}': ${error.message}`);
    }
  }

  /**
   * Search for code in the repository
   * @param {string} query - Search query
   * @param {Object} [options] - Search options
   * @param {string} [options.extension] - Filter by file extension (e.g., 'js')
   * @param {string} [options.path] - Filter by path
   * @param {number} [options.limit=30] - Max results to return
   * @returns {Promise<FileEntry[]>} Array of matching file entries
   */
  async searchCode(query, options = {}) {
    const { extension, path, limit = 30 } = options;

    try {
      // Build search query
      let q = `${query} repo:${this.config.owner}/${this.config.repo}`;
      if (extension) q += ` extension:${extension}`;
      if (path) q += ` path:${path}`;

      const { data } = await this.octokit.rest.search.code({
        q: q,
        per_page: limit
      });

      // Return minimal info - full content can be fetched with readFile()
      return data.items.map(item => ({
        path: item.path,
        name: item.name,
        content: null, // Don't include content in search results
        sha: item.sha,
        type: 'file',
        size: 0 // Not provided in search results
      }));
    } catch (error) {
      if (error.status === 403 && error.message.includes('rate limit')) {
        throw new Error('GitHub search rate limit exceeded. Please wait before searching again.');
      }
      throw new Error(`Search failed: ${error.message}`);
    }
  }

  /**
   * Check if a file or directory exists
   * @param {string} path - Path to check
   * @returns {Promise<boolean>} True if exists
   */
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
      if (error.status === 404) {
        return false;
      }
      throw new Error(`Failed to check if '${path}' exists: ${error.message}`);
    }
  }

  /**
   * Create a directory by creating a placeholder file
   * GitHub doesn't support empty directories, so we create a .gitkeep file
   * @param {string} path - Directory path
   * @returns {Promise<boolean>} True if created
   */
  async createDirectory(path) {
    const gitkeepPath = `${path}/.gitkeep`;
    try {
      await this.writeFile(gitkeepPath, '', `Create directory ${path}`);
      return true;
    } catch (error) {
      throw new Error(`Failed to create directory '${path}': ${error.message}`);
    }
  }

  /**
   * Get the full tree of the repository (useful for bulk operations)
   * @param {boolean} [recursive=true] - Get full tree recursively
   * @returns {Promise<FileEntry[]>} Array of all files in repo
   */
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

      return treeData.tree
        .filter(item => item.type !== 'tree') // Only files, not directories
        .map(item => ({
          path: item.path,
          name: item.path.split('/').pop(),
          content: null,
          sha: item.sha,
          type: 'file',
          size: item.size || 0
        }));
    } catch (error) {
      throw new Error(`Failed to get repository tree: ${error.message}`);
    }
  }

  /**
   * Clear the read cache
   */
  clearCache() {
    this._cache.clear();
  }

  /**
   * Get repository information
   * @returns {Promise<Object>} Repository metadata
   */
  async getRepoInfo() {
    try {
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
    } catch (error) {
      throw new Error(`Failed to get repository info: ${error.message}`);
    }
  }
}

// Helper function to load config from localStorage
export function loadGitHubFSConfig() {
  try {
    const saved = localStorage.getItem('github-fs-config');
    if (!saved) {
      throw new Error('GitHub file system not configured. Please run setupGitHubFS()');
    }
    return JSON.parse(saved);
  } catch (error) {
    throw new Error(`Failed to load GitHub config: ${error.message}`);
  }
}

// Helper function to save config to localStorage
export function saveGitHubFSConfig(config) {
  localStorage.setItem('github-fs-config', JSON.stringify(config));
}

// Interactive setup function
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
  
  // Test the configuration
  console.log('Testing connection...');
  const fs = new GitHubFileSystem(config);
  
  try {
    await fs.initialize();
    saveGitHubFSConfig(config);
    
    // Save individual items for easier access
    localStorage.setItem('github-fs-owner', owner);
    localStorage.setItem('github-fs-repo', repo);
    
    console.log('✅ GitHub File System configured successfully!');
    return fs;
  } catch (error) {
    console.error('❌ Configuration failed:', error.message);
    throw error;
  }
}

export default GitHubFileSystem;
