// tool-base.js
// Base utilities for defining and executing tools
// Inspired by OpenCode's tool architecture

/**
 * Tool definition interface
 * @typedef {Object} ToolDefinition
 * @property {string} name - Unique tool identifier
 * @property {string} description - LLM-facing description (loaded from .md file)
 * @property {Object} parameters - Parameter schema with name, type, required, description
 * @property {Function} execute - Async function that executes the tool
 */

/**
 * Tool execution context
 * @typedef {Object} ToolContext
 * @property {import('../GitHubFileSystem.js').GitHubFileSystem} fs - GitHub filesystem instance
 * @property {string} sessionId - Current session ID
 * @property {AbortSignal} [abort] - Optional abort signal
 */

/**
 * Tool execution result
 * @typedef {Object} ToolResult
 * @property {boolean} success - Whether execution succeeded
 * @property {string} output - Result output for the LLM
 * @property {Object} [metadata] - Optional metadata about the execution
 */

// Maximum output size before truncation (in characters)
const MAX_OUTPUT_SIZE = 50000;

/**
 * Define a new tool with validation and output handling
 * @param {string} name - Tool identifier
 * @param {Object} config - Tool configuration
 * @param {string} config.description - Tool description
 * @param {Object} config.parameters - Parameter definitions
 * @param {Function} config.execute - Execution function
 * @returns {ToolDefinition}
 */
export function defineTool(name, config) {
  return {
    name,
    description: config.description,
    parameters: config.parameters,
    execute: async (args, ctx) => {
      try {
        // Validate required parameters
        validateParameters(args, config.parameters);
        
        // Execute the tool
        const result = await config.execute(args, ctx);
        
        // Handle output truncation
        if (result.output && result.output.length > MAX_OUTPUT_SIZE) {
          return {
            ...result,
            output: truncateOutput(result.output, MAX_OUTPUT_SIZE),
            metadata: {
              ...result.metadata,
              truncated: true,
              originalLength: result.output.length
            }
          };
        }
        
        return result;
      } catch (error) {
        return {
          success: false,
          output: `Error: ${error.message}`,
          metadata: { error: error.message }
        };
      }
    }
  };
}

/**
 * Validate parameters against schema
 * @param {Object} args - Provided arguments
 * @param {Object} schema - Parameter schema
 * @throws {Error} If validation fails
 */
function validateParameters(args, schema) {
  for (const [key, config] of Object.entries(schema)) {
    if (config.required && (args[key] === undefined || args[key] === null)) {
      throw new Error(`Missing required parameter: ${key}`);
    }
    
    if (args[key] !== undefined && config.type) {
      const actualType = Array.isArray(args[key]) ? 'array' : typeof args[key];
      if (actualType !== config.type) {
        throw new Error(`Parameter '${key}' must be of type ${config.type}, got ${actualType}`);
      }
    }
  }
}

/**
 * Truncate output to maximum size
 * @param {string} output - Original output
 * @param {number} maxSize - Maximum size
 * @returns {string} Truncated output
 */
function truncateOutput(output, maxSize) {
  const truncated = output.substring(0, maxSize);
  const lastNewline = truncated.lastIndexOf('\n');
  const cutPoint = lastNewline > maxSize * 0.8 ? lastNewline : maxSize;
  return truncated.substring(0, cutPoint) + `\n\n... (truncated, ${output.length - cutPoint} more characters)`;
}

/**
 * Format a successful result
 * @param {string} output - Output text
 * @param {Object} [metadata] - Optional metadata
 * @returns {ToolResult}
 */
export function successResult(output, metadata = {}) {
  return {
    success: true,
    output,
    metadata
  };
}

/**
 * Format an error result
 * @param {string} message - Error message
 * @param {Object} [metadata] - Optional metadata
 * @returns {ToolResult}
 */
export function errorResult(message, metadata = {}) {
  return {
    success: false,
    output: `Error: ${message}`,
    metadata: { error: message, ...metadata }
  };
}

/**
 * Load a markdown description file
 * In browser environment, this returns a placeholder.
 * Descriptions should be bundled or fetched separately.
 * @param {string} name - Tool name (matches .md filename)
 * @returns {Promise<string>} Description content
 */
export async function loadDescription(name) {
  // In a browser environment, we'll need to fetch these
  // For now, this is a placeholder that implementations can override
  try {
    const response = await fetch(`./src/tools/descriptions/${name}.md`);
    if (response.ok) {
      return await response.text();
    }
  } catch (e) {
    // Fetch failed, return empty
  }
  return '';
}

/**
 * Helper to read a string parameter with defaults
 * @param {Object} params - All parameters
 * @param {string} key - Parameter key
 * @param {Object} [options] - Options
 * @param {boolean} [options.required=false] - Is required
 * @param {string} [options.defaultValue] - Default value
 * @param {boolean} [options.trim=true] - Trim whitespace
 * @returns {string|undefined}
 */
export function readString(params, key, options = {}) {
  const { required = false, defaultValue, trim = true } = options;
  let value = params[key];
  
  if (value === undefined || value === null) {
    if (required && defaultValue === undefined) {
      throw new Error(`Required parameter '${key}' is missing`);
    }
    return defaultValue;
  }
  
  if (typeof value !== 'string') {
    value = String(value);
  }
  
  return trim ? value.trim() : value;
}

/**
 * Helper to read a number parameter with defaults
 * @param {Object} params - All parameters
 * @param {string} key - Parameter key
 * @param {Object} [options] - Options
 * @param {boolean} [options.required=false] - Is required
 * @param {number} [options.defaultValue] - Default value
 * @param {number} [options.min] - Minimum value
 * @param {number} [options.max] - Maximum value
 * @returns {number|undefined}
 */
export function readNumber(params, key, options = {}) {
  const { required = false, defaultValue, min, max } = options;
  let value = params[key];
  
  if (value === undefined || value === null) {
    if (required && defaultValue === undefined) {
      throw new Error(`Required parameter '${key}' is missing`);
    }
    return defaultValue;
  }
  
  if (typeof value === 'string') {
    value = parseFloat(value);
  }
  
  if (typeof value !== 'number' || isNaN(value)) {
    throw new Error(`Parameter '${key}' must be a number`);
  }
  
  if (min !== undefined && value < min) {
    throw new Error(`Parameter '${key}' must be at least ${min}`);
  }
  
  if (max !== undefined && value > max) {
    throw new Error(`Parameter '${key}' must be at most ${max}`);
  }
  
  return value;
}

/**
 * Helper to read a boolean parameter with defaults
 * @param {Object} params - All parameters
 * @param {string} key - Parameter key
 * @param {Object} [options] - Options
 * @param {boolean} [options.defaultValue=false] - Default value
 * @returns {boolean}
 */
export function readBoolean(params, key, options = {}) {
  const { defaultValue = false } = options;
  const value = params[key];
  
  if (value === undefined || value === null) {
    return defaultValue;
  }
  
  if (typeof value === 'boolean') {
    return value;
  }
  
  if (typeof value === 'string') {
    return value.toLowerCase() === 'true' || value === '1';
  }
  
  return Boolean(value);
}

export default {
  defineTool,
  successResult,
  errorResult,
  loadDescription,
  readString,
  readNumber,
  readBoolean
};
