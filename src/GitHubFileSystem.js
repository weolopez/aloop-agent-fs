// GitHubFileSystem.js
// =============================================================================
// A complete file system abstraction over GitHub repositories.
// 
// This class enables agents to use a GitHub repo as persistent storage with:
// - Full CRUD operations (Create/Read/Update/Delete) for files and directories
// - Code search across the repository
// - Directory listing and tree traversal
// - Branch management (create, delete, switch, list)
// - Pull request creation for collaborative workflows
// - In-memory caching for improved read performance
//
// All operations use the GitHub REST API via Octokit.
// =============================================================================

import { Octokit } from "https://esm.sh/octokit";

/**
 * Configuration for connecting to a GitHub repository.
 * @typedef {Object} GitHubConfig
 * @property {string} owner - Repository owner (username or organization)
 * @property {string} repo - Repository name
 * @property {string} [branch='main'] - Default branch name for operations
 * @property {string} auth - GitHub Personal Access Token (requires 'repo' scope)
 * @property {string} [email='agent@localhost'] - Committer email for commits
 */

/**
 * Represents a file or directory entry in the repository.
 * @typedef {Object} FileEntry
 * @property {string} path - Full path in repository (e.g., 'src/utils/helper.js')
 * @property {string} name - File or directory name (e.g., 'helper.js')
 * @property {string|null} content - File content (decoded), null for directories or listings
 * @property {string} sha - Git SHA hash, used for updates and deletions
 * @property {'file'|'dir'} type - Entry type
 * @property {number} size - File size in bytes (0 for directories)
 */

/**
 * Represents a branch in the repository.
 * @typedef {Object} BranchInfo
 * @property {string} name - Branch name
 * @property {string} sha - SHA of the branch's HEAD commit
 * @property {boolean} protected - Whether the branch is protected
 */

/**
 * Represents a pull request.
 * @typedef {Object} PullRequestInfo
 * @property {number} number - PR number
 * @property {string} url - URL to the PR on GitHub
 * @property {'open'|'closed'|'merged'} state - PR state
 * @property {string} title - PR title
 */

/**
 * Options for creating a pull request.
 * @typedef {Object} CreatePROptions
 * @property {string} title - PR title
 * @property {string} head - Branch containing changes (source branch)
 * @property {string} base - Branch to merge into (target branch)
 * @property {string} [body=''] - PR description/body in markdown
 * @property {boolean} [draft=false] - Create as draft PR
 */

/**
 * GitHubFileSystem - A file system abstraction over GitHub repositories.
 * 
 * @example
 * // Basic usage
 * const fs = new GitHubFileSystem({
 *   owner: 'myuser',
 *   repo: 'my-repo',
 *   auth: 'ghp_xxxxxxxxxxxx'
 * });
 * await fs.initialize();
 * 
 * // Read and write files
 * await fs.writeFile('notes/todo.txt', 'My tasks', 'Add todo file');
 * const file = await fs.readFile('notes/todo.txt');
 * console.log(file.content);
 * 
 * @example
 * // Branch workflow
 * await fs.createBranch('feature/new-feature');
 * fs.setBranch('feature/new-feature');
 * await fs.writeFile('src/feature.js', 'code here', 'Add feature');
 * const pr = await fs.createPullRequest({
 *   title: 'Add new feature',
 *   head: 'feature/new-feature',
 *   base: 'main',
 *   body: '## Summary\nThis PR adds a new feature.'
 * });
 * console.log(`PR created: ${pr.url}`);
 */
export class GitHubFileSystem {
  /**
   * Creates a new GitHubFileSystem instance.
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
    this._cache = new Map(); // In-memory cache keyed by "branch:path"
  }

  // ===========================================================================
  // INITIALIZATION & INFO
  // ===========================================================================

  /**
   * Initialize and verify the repository exists and is accessible.
   * Should be called before any other operations.
   * 
   * @returns {Promise<boolean>} True if repository is accessible
   * @throws {Error} If repository not found or authentication fails
   * 
   * @example
   * const fs = new GitHubFileSystem(config);
   * await fs.initialize(); // Validates connection
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
      if (error.status === 401) {
        throw new Error('Authentication failed. Please check your GitHub token.');
      }
      throw new Error(`Failed to connect to GitHub: ${error.message}`);
    }
  }

  /**
   * Get repository metadata and information.
   * 
   * @returns {Promise<Object>} Repository metadata including name, visibility, default branch
   * @throws {Error} If unable to fetch repository info
   * 
   * @example
   * const info = await fs.getRepoInfo();
   * console.log(`Repo: ${info.fullName}, Default branch: ${info.defaultBranch}`);
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
        url: data.html_url,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
        size: data.size
      };
    } catch (error) {
      throw new Error(`Failed to get repository info: ${error.message}`);
    }
  }

  // ===========================================================================
  // FILE OPERATIONS
  // ===========================================================================

  /**
   * Read a file from the repository.
   * Results are cached in memory for subsequent reads.
   * 
   * @param {string} path - File path relative to repository root (e.g., 'src/index.js')
   * @returns {Promise<FileEntry>} File entry with decoded content
   * @throws {Error} If file not found or path is a directory
   * 
   * @example
   * const file = await fs.readFile('config/settings.json');
   * const config = JSON.parse(file.content);
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
   * Write or update a file in the repository.
   * Creates the file if it doesn't exist, updates it if it does.
   * Each write creates a new commit in the repository.
   * 
   * @param {string} path - File path relative to repository root
   * @param {string} content - File content (plain text, will be base64 encoded)
   * @param {string} [message] - Commit message (defaults to "Update {path}")
   * @returns {Promise<FileEntry>} Updated file entry with new SHA
   * @throws {Error} If write operation fails
   * 
   * @example
   * // Create a new file
   * await fs.writeFile('docs/README.md', '# My Project', 'Add documentation');
   * 
   * // Update an existing file
   * await fs.writeFile('docs/README.md', '# My Project\n\nUpdated!', 'Update docs');
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
   * Delete a file from the repository.
   * Creates a commit that removes the file.
   * 
   * @param {string} path - File path to delete
   * @param {string} [message] - Commit message (defaults to "Delete {path}")
   * @returns {Promise<boolean>} True if deleted successfully
   * @throws {Error} If file not found or deletion fails
   * 
   * @example
   * await fs.deleteFile('temp/old-file.txt', 'Remove deprecated file');
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
   * Check if a file or directory exists in the repository.
   * 
   * @param {string} path - Path to check
   * @returns {Promise<boolean>} True if path exists, false otherwise
   * @throws {Error} If check fails due to API error (not 404)
   * 
   * @example
   * if (await fs.exists('config/settings.json')) {
   *   const settings = await fs.readFile('config/settings.json');
   * }
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

  // ===========================================================================
  // DIRECTORY OPERATIONS
  // ===========================================================================

  /**
   * List contents of a directory.
   * 
   * @param {string} [path=''] - Directory path (empty string for repository root)
   * @returns {Promise<FileEntry[]>} Array of file and directory entries
   * @throws {Error} If directory not found or path is a file
   * 
   * @example
   * // List root directory
   * const rootContents = await fs.listDirectory();
   * 
   * // List specific directory
   * const srcFiles = await fs.listDirectory('src/components');
   * srcFiles.forEach(f => console.log(`${f.type}: ${f.name}`));
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
   * Create a directory by creating a placeholder .gitkeep file.
   * Note: GitHub doesn't support empty directories, so this creates a .gitkeep file.
   * 
   * @param {string} path - Directory path to create
   * @returns {Promise<boolean>} True if created successfully
   * @throws {Error} If creation fails
   * 
   * @example
   * await fs.createDirectory('src/components/ui');
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
   * Get the full tree of all files in the repository.
   * More efficient than recursive listDirectory calls for large repos.
   * 
   * @param {boolean} [recursive=true] - If true, includes files in all subdirectories
   * @returns {Promise<FileEntry[]>} Array of all file entries in the repository
   * @throws {Error} If unable to fetch repository tree
   * 
   * @example
   * const allFiles = await fs.getTree();
   * const jsFiles = allFiles.filter(f => f.name.endsWith('.js'));
   * console.log(`Found ${jsFiles.length} JavaScript files`);
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

  // ===========================================================================
  // SEARCH OPERATIONS
  // ===========================================================================

  /**
   * Search for code in the repository using GitHub's code search.
   * Note: GitHub's search API has rate limits; use sparingly.
   * 
   * @param {string} query - Search query (supports GitHub search syntax)
   * @param {Object} [options] - Search options
   * @param {string} [options.extension] - Filter by file extension (e.g., 'js', 'py')
   * @param {string} [options.path] - Filter by path prefix (e.g., 'src/')
   * @param {number} [options.limit=30] - Maximum results to return (max 100)
   * @returns {Promise<FileEntry[]>} Array of matching file entries (content not included)
   * @throws {Error} If search fails or rate limit exceeded
   * 
   * @example
   * // Search for TODO comments in JavaScript files
   * const results = await fs.searchCode('TODO', { extension: 'js' });
   * 
   * // Search in specific directory
   * const apiFiles = await fs.searchCode('fetch', { path: 'src/api' });
   */
  async searchCode(query, options = {}) {
    const { extension, path, limit = 30 } = options;

    try {
      // Build search query using GitHub search syntax
      let q = `${query} repo:${this.config.owner}/${this.config.repo}`;
      if (extension) q += ` extension:${extension}`;
      if (path) q += ` path:${path}`;

      const { data } = await this.octokit.rest.search.code({
        q: q,
        per_page: Math.min(limit, 100) // GitHub max is 100
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
      if (error.status === 422) {
        throw new Error('Invalid search query. Check your search syntax.');
      }
      throw new Error(`Search failed: ${error.message}`);
    }
  }

  // ===========================================================================
  // BRANCH OPERATIONS
  // ===========================================================================

  /**
   * List all branches in the repository.
   * 
   * @returns {Promise<BranchInfo[]>} Array of branch information
   * @throws {Error} If unable to list branches
   * 
   * @example
   * const branches = await fs.listBranches();
   * branches.forEach(b => console.log(`${b.name} ${b.protected ? '(protected)' : ''}`));
   */
  async listBranches() {
    try {
      const { data } = await this.octokit.rest.repos.listBranches({
        owner: this.config.owner,
        repo: this.config.repo,
        per_page: 100
      });
      return data.map(branch => ({
        name: branch.name,
        sha: branch.commit.sha,
        protected: branch.protected
      }));
    } catch (error) {
      throw new Error(`Failed to list branches: ${error.message}`);
    }
  }

  /**
   * Create a new branch from an existing branch.
   * 
   * @param {string} name - Name for the new branch
   * @param {string} [base] - Base branch to create from (defaults to current branch)
   * @returns {Promise<boolean>} True if branch created successfully
   * @throws {Error} If branch already exists or creation fails
   * 
   * @example
   * // Create feature branch from main
   * await fs.createBranch('feature/new-login', 'main');
   * 
   * // Create branch from current branch
   * await fs.createBranch('bugfix/fix-typo');
   */
  async createBranch(name, base) {
    try {
      const baseRef = base || this.config.branch;
      
      // Get the SHA of the base branch
      const { data: refData } = await this.octokit.rest.git.getRef({
        owner: this.config.owner,
        repo: this.config.repo,
        ref: `heads/${baseRef}`
      });

      // Create the new branch
      await this.octokit.rest.git.createRef({
        owner: this.config.owner,
        repo: this.config.repo,
        ref: `refs/heads/${name}`,
        sha: refData.object.sha
      });

      console.log(`Created branch '${name}' from '${baseRef}'`);
      return true;
    } catch (error) {
      if (error.status === 422) {
        throw new Error(`Branch '${name}' already exists.`);
      }
      throw new Error(`Failed to create branch '${name}': ${error.message}`);
    }
  }

  /**
   * Delete a branch from the repository.
   * Cannot delete protected branches or the default branch.
   * 
   * @param {string} name - Branch name to delete
   * @returns {Promise<boolean>} True if branch deleted successfully
   * @throws {Error} If branch is protected, not found, or deletion fails
   * 
   * @example
   * await fs.deleteBranch('feature/completed-feature');
   */
  async deleteBranch(name) {
    try {
      // Prevent deleting the current branch
      if (name === this.config.branch) {
        throw new Error(`Cannot delete current branch '${name}'. Switch to another branch first.`);
      }

      await this.octokit.rest.git.deleteRef({
        owner: this.config.owner,
        repo: this.config.repo,
        ref: `heads/${name}`
      });

      console.log(`Deleted branch '${name}'`);
      return true;
    } catch (error) {
      if (error.status === 422) {
        throw new Error(`Cannot delete branch '${name}': it may be protected or the default branch.`);
      }
      throw new Error(`Failed to delete branch '${name}': ${error.message}`);
    }
  }

  /**
   * Switch the active branch for subsequent operations.
   * This clears the cache since file contents may differ between branches.
   * 
   * @param {string} name - Branch name to switch to
   * @returns {void}
   * 
   * @example
   * fs.setBranch('feature/new-feature');
   * await fs.writeFile('src/feature.js', 'code', 'Add feature');
   * fs.setBranch('main'); // Switch back
   */
  setBranch(name) {
    if (this.config.branch !== name) {
      this.config.branch = name;
      this.clearCache(); // Clear cache when switching branches
      console.log(`Switched to branch '${name}'`);
    }
  }

  /**
   * Get the current active branch name.
   * 
   * @returns {string} Current branch name
   * 
   * @example
   * console.log(`Working on branch: ${fs.getCurrentBranch()}`);
   */
  getCurrentBranch() {
    return this.config.branch;
  }

  // ===========================================================================
  // PULL REQUEST OPERATIONS
  // ===========================================================================

  /**
   * Create a pull request to merge one branch into another.
   * 
   * @param {CreatePROptions} options - Pull request options
   * @returns {Promise<PullRequestInfo>} Created pull request information
   * @throws {Error} If PR creation fails (e.g., no commits between branches)
   * 
   * @example
   * const pr = await fs.createPullRequest({
   *   title: 'Add user authentication',
   *   head: 'feature/auth',
   *   base: 'main',
   *   body: '## Summary\n- Add login page\n- Add JWT authentication'
   * });
   * console.log(`PR #${pr.number} created: ${pr.url}`);
   */
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
        // Common issue: no commits between branches
        const message = error.message || '';
        if (message.includes('No commits')) {
          throw new Error(`Cannot create PR: No commits between '${base}' and '${head}'. Make sure you have committed changes to '${head}'.`);
        }
        if (message.includes('already exists')) {
          throw new Error(`A pull request already exists for '${head}' into '${base}'.`);
        }
      }
      throw new Error(`Failed to create pull request: ${error.message}`);
    }
  }

  /**
   * List open pull requests in the repository.
   * 
   * @param {Object} [options] - Filter options
   * @param {'open'|'closed'|'all'} [options.state='open'] - PR state to filter
   * @param {string} [options.base] - Filter by base branch
   * @param {string} [options.head] - Filter by head branch
   * @param {number} [options.limit=30] - Maximum results to return
   * @returns {Promise<PullRequestInfo[]>} Array of pull request information
   * @throws {Error} If unable to list pull requests
   * 
   * @example
   * // Get all open PRs
   * const openPRs = await fs.listPullRequests();
   * 
   * // Get PRs targeting main branch
   * const mainPRs = await fs.listPullRequests({ base: 'main' });
   */
  async listPullRequests(options = {}) {
    const { state = 'open', base, head, limit = 30 } = options;

    try {
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
    } catch (error) {
      throw new Error(`Failed to list pull requests: ${error.message}`);
    }
  }

  // ===========================================================================
  // CACHE MANAGEMENT
  // ===========================================================================

  /**
   * Clear the in-memory read cache.
   * Useful when you know files have been modified externally.
   * 
   * @returns {void}
   * 
   * @example
   * fs.clearCache();
   * const freshFile = await fs.readFile('config.json'); // Fetches from GitHub
   */
  clearCache() {
    this._cache.clear();
  }
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Load GitHub FS configuration from localStorage.
 * 
 * @returns {GitHubConfig} Saved configuration
 * @throws {Error} If no configuration found
 * 
 * @example
 * try {
 *   const config = loadGitHubFSConfig();
 *   const fs = new GitHubFileSystem(config);
 * } catch (error) {
 *   console.log('Please configure GitHub FS first');
 * }
 */
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

/**
 * Save GitHub FS configuration to localStorage.
 * 
 * @param {GitHubConfig} config - Configuration to save
 * @returns {void}
 * 
 * @example
 * saveGitHubFSConfig({
 *   owner: 'myuser',
 *   repo: 'my-repo',
 *   branch: 'main',
 *   auth: 'ghp_xxxx',
 *   email: 'me@example.com'
 * });
 */
export function saveGitHubFSConfig(config) {
  localStorage.setItem('github-fs-config', JSON.stringify(config));
}

/**
 * Interactive setup function for browser console.
 * Prompts user for configuration and tests the connection.
 * 
 * @returns {Promise<GitHubFileSystem>} Configured and initialized GitHubFileSystem
 * @throws {Error} If configuration is incomplete or connection fails
 * 
 * @example
 * // Run in browser console
 * const fs = await setupGitHubFS();
 */
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
