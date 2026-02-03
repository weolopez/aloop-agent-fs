// platform/index.js
// Platform detection and adapter selection
// Automatically selects the correct adapter based on runtime environment

import { PLATFORM_NAMES } from './types.js';

/**
 * Detect current runtime environment
 * @returns {'browser' | 'node'}
 */
function detectPlatform() {
  // Check for Node.js
  if (typeof process !== 'undefined' && process.versions && process.versions.node) {
    return PLATFORM_NAMES.NODE;
  }
  
  // Check for browser
  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    return PLATFORM_NAMES.BROWSER;
  }
  
  // Default to browser (for Deno, Bun, etc. that have browser-like APIs)
  return PLATFORM_NAMES.BROWSER;
}

/**
 * Current platform name
 */
export const platformName = detectPlatform();

/**
 * Whether we're running in Node.js
 */
export const isNode = platformName === PLATFORM_NAMES.NODE;

/**
 * Whether we're running in a browser
 */
export const isBrowser = platformName === PLATFORM_NAMES.BROWSER;

/**
 * The platform adapter - loaded dynamically based on environment
 * @type {import('./types.js').PlatformAdapter}
 */
let _platform = null;

/**
 * Get the platform adapter
 * Loads the appropriate adapter on first call
 * @returns {Promise<import('./types.js').PlatformAdapter>}
 */
export async function getPlatform() {
  if (_platform) return _platform;
  
  if (isNode) {
    const { nodeAdapter } = await import('./node.js');
    _platform = nodeAdapter;
  } else {
    const { browserAdapter } = await import('./browser.js');
    _platform = browserAdapter;
  }
  
  return _platform;
}

/**
 * Get the platform adapter synchronously
 * Must be called after getPlatform() has been awaited at least once
 * @returns {import('./types.js').PlatformAdapter}
 */
export function getPlatformSync() {
  if (!_platform) {
    throw new Error('Platform not initialized. Call await getPlatform() first.');
  }
  return _platform;
}

/**
 * Initialize the platform adapter
 * Call this at application startup
 * @returns {Promise<import('./types.js').PlatformAdapter>}
 */
export async function initPlatform() {
  return getPlatform();
}

// Convenience re-exports
export { PLATFORM_NAMES } from './types.js';

export default {
  getPlatform,
  getPlatformSync,
  initPlatform,
  platformName,
  isNode,
  isBrowser,
  PLATFORM_NAMES
};
