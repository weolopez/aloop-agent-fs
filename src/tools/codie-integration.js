/**
 * Codie integration tool for opencode
 * Allows opencode to delegate complex reasoning tasks to Codie
 */

import { runQuickTask, checkCodieHealth } from '../lib/codie-api.js';

/**
 * Tool for delegating complex tasks to Codie
 * Use this when tasks require:
 * - Multi-step planning and reasoning
 * - Memory and context across operations
 * - Creative problem-solving
 * - Complex analysis that benefits from persistent state
 */
export const codieTool = {
  name: 'codie',
  description: 'Delegate complex reasoning and multi-step tasks to Codie AI agent with persistent memory',
  parameters: {
    type: 'object',
    properties: {
      task: {
        type: 'string',
        description: 'The task or question to delegate to Navigator'
      },
      context: {
        type: 'string',
        description: 'Optional context about why this task needs Navigator vs local reasoning'
      },
      require_memory: {
        type: 'boolean',
        description: 'Whether this task should use Navigator\'s persistent memory',
        default: false
      },
      timeout: {
        type: 'number',
        description: 'Timeout in milliseconds (default: 30000)',
        default: 30000
      }
    },
    required: ['task']
  },

  execute: async ({ task, context, require_memory, timeout }) => {
    try {
      // Check if Codie is available
      const isHealthy = await checkCodieHealth();
      if (!isHealthy) {
        return {
          success: false,
          error: 'Codie is not available or not properly configured',
          fallback: 'Consider using local reasoning instead'
        };
      }

      // For tasks that require memory, we should use a persistent Navigator instance
      // For simple tasks, use the quick runner
      if (require_memory) {
        // TODO: Implement persistent Navigator instance for memory tasks
        return {
          success: false,
          error: 'Persistent memory tasks not yet implemented',
          suggestion: 'Use require_memory: false for now'
        };
      }

      // Run the task through Navigator
      const result = await runQuickTask(task, { timeout });

      return {
        success: true,
        result,
        delegated_to: 'codie',
        context: context || 'Complex reasoning task'
      };

    } catch (error) {
      return {
        success: false,
        error: error.message,
        fallback: 'Task failed in Navigator, consider using local reasoning'
      };
    }
  }
};

/**
 * Specialized tool for memory operations through Codie
 */
export const codieMemoryTool = {
  name: 'codie_memory',
  description: 'Access Codie\'s persistent memory system for remembering and recalling information',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['remember', 'recall', 'search', 'status'],
        description: 'Memory operation to perform'
      },
      content: {
        type: 'string',
        description: 'Content to remember (for remember operation)'
      },
      query: {
        type: 'string',
        description: 'Search query (for recall/search operations)'
      },
      category: {
        type: 'string',
        description: 'Category for remembering (for remember operation)',
        default: 'API Request'
      }
    },
    required: ['operation']
  },

  execute: async ({ operation, content, query, category }) => {
    try {
      // TODO: Implement when persistent Navigator instance is available
      return {
        success: false,
        error: 'Navigator memory operations not yet implemented',
        note: 'This will be available when persistent Navigator integration is complete'
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
};

/**
 * Tool to analyze when to use Navigator vs local reasoning
 */
export const shouldUseNavigatorTool = {
  name: 'analyze_task_complexity',
  description: 'Analyze whether a task should use Navigator or local reasoning based on complexity',
  parameters: {
    type: 'object',
    properties: {
      task: {
        type: 'string',
        description: 'The task to analyze'
      },
      context: {
        type: 'string',
        description: 'Additional context about the task'
      }
    },
    required: ['task']
  },

  execute: async ({ task, context }) => {
    // Simple heuristic analysis
    const complexityIndicators = [
      'multi-step', 'complex', 'reasoning', 'planning', 'analyze', 'design',
      'architecture', 'strategy', 'memory', 'remember', 'recall', 'context',
      'creative', 'innovative', 'problem-solving', 'long-term'
    ];

    const taskLower = (task + ' ' + (context || '')).toLowerCase();

    const matches = complexityIndicators.filter(indicator =>
      taskLower.includes(indicator)
    );

    const shouldUseNavigator = matches.length >= 2; // At least 2 complexity indicators

    return {
      task,
      should_use_navigator: shouldUseNavigator,
      complexity_score: matches.length,
      matched_indicators: matches,
      reasoning: shouldUseNavigator
        ? 'Task shows multiple complexity indicators suggesting Navigator would be beneficial'
        : 'Task appears suitable for local reasoning'
    };
  }
};