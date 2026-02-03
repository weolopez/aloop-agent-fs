// platform/types.js
// Type definitions for platform adapters (JSDoc for IDE support)

/**
 * @typedef {Object} PlatformAdapter
 * 
 * @property {string} name - Platform name ('browser' or 'node')
 * 
 * @property {Object} config - Configuration management
 * @property {function(): Object|null} config.load - Load saved configuration
 * @property {function(Object): void} config.save - Save configuration
 * @property {function(): void} config.clear - Clear saved configuration
 * 
 * @property {Object} env - Environment variable access
 * @property {function(string, string=): string|undefined} env.get - Get environment variable
 * @property {function(string, string): void} env.set - Set environment variable (runtime only)
 * 
 * @property {Object} encoding - Base64 encoding utilities
 * @property {function(string): string} encoding.base64Encode - Encode string to base64
 * @property {function(string): string} encoding.base64Decode - Decode base64 to string
 * 
 * @property {Object} storage - Key-value storage (persistent)
 * @property {function(string): Promise<any>} storage.get - Get value by key
 * @property {function(string, any): Promise<void>} storage.set - Set value by key
 * @property {function(string): Promise<void>} storage.delete - Delete value by key
 * @property {function(): Promise<void>} storage.clear - Clear all values
 * 
 * @property {Object} log - Logging utilities
 * @property {function(string, string=): void} log.info - Log info message
 * @property {function(string): void} log.success - Log success message
 * @property {function(string): void} log.error - Log error message
 * @property {function(string): void} log.warning - Log warning message
 * @property {function(string): void} log.thought - Log thought/reasoning
 * @property {function(string): void} log.action - Log action being taken
 * 
 * @property {Object} prompt - User input prompts
 * @property {function(string, string=): Promise<string>} prompt.text - Prompt for text input
 * @property {function(string): Promise<boolean>} prompt.confirm - Prompt for yes/no confirmation
 * @property {function(string, string[]): Promise<string>} prompt.select - Prompt to select from options
 * 
 * @property {Object} http - HTTP client
 * @property {function(string, Object=): Promise<Response>} http.fetch - Fetch URL
 */

/**
 * @typedef {Object} StorageProvider
 * @property {function(string): Promise<any>} get
 * @property {function(string, any): Promise<void>} set
 * @property {function(string): Promise<void>} delete
 * @property {function(): Promise<void>} clear
 */

/**
 * @typedef {Object} ConfigProvider
 * @property {function(): Object|null} load
 * @property {function(Object): void} save
 * @property {function(): void} clear
 */

export const PLATFORM_NAMES = {
  BROWSER: 'browser',
  NODE: 'node'
};

export default { PLATFORM_NAMES };
