// codie-tools.js
// Codie CLI integration tools for OpenCode
// Provides tools for delegating complex tasks, asking questions, and using memory

import { defineTool, successResult, errorResult, readString, readNumber, readBoolean } from '../tool-base.js';

// Import Codie API functions
import { runQuickTask, checkCodieHealth, createCodie } from '../../../lib/codie-api.js';

// Import description files
// Note: Using static strings for Node.js compatibility - .md?raw imports don't work in Node.js
const delegateTaskDesc = `# delegateTask

Delegate a complex or multi-step software engineering task to Codie CLI for specialized handling.

## Parameters

- **task** (required): Description of the task to delegate. Should be detailed enough for Codie to understand the requirements and approach.
- **context** (optional): Additional context about the codebase, project state, or constraints.
- **priority** (optional): Task priority level ("low", "medium", "high"). Default: "medium"
- **timeout** (optional): Maximum time in minutes to allow Codie to work on the task. Default: 30

## Behavior

- Uses Codie CLI's programmatic API to handle complex tasks
- Codie will analyze the task, break it down, and execute it step-by-step
- Returns Codie's findings, actions taken, and results
- Falls back to local reasoning if Codie is unavailable

## Usage Notes

- Best for complex multi-step tasks like refactoring, implementing features, debugging systemic issues, architecture design
- Use askCodie for simpler questions or advice
- Codie has access to the same codebase and tools as OpenCode`;

const askCodieDesc = `# askCodie

Ask Codie CLI for advice, analysis, or specialized knowledge on software engineering topics.

## Parameters

- **question** (required): The question or topic to ask Codie about
- **context** (optional): Additional context about the codebase or situation
- **detailLevel** (optional): Level of detail in response ("brief", "normal", "detailed"). Default: "normal"

## Behavior

- Uses Codie CLI's knowledge and reasoning capabilities
- Codie analyzes the question in context of current codebase
- Returns thoughtful analysis and recommendations
- Falls back gracefully if Codie is unavailable

## Usage Notes

- Best for design decisions, architecture advice, debugging help, best practices, understanding complex code
- Use delegateTask for tasks that require Codie to take actions
- Questions should be specific and actionable`;

const navigatorMemoryDesc = `# codieMemory

Use Codie CLI's persistent memory system to store and retrieve information across sessions.

## Parameters

- **operation** (required): Memory operation ("store", "retrieve", "search", "list")
- **key** (required for store/retrieve): Memory key for storing or retrieving specific information
- **value** (required for store): Information to store in memory
- **category** (optional): Category for organizing memories
- **query** (required for search): Search query to find relevant memories
- **limit** (optional for list/search): Maximum number of results. Default: 10

## Behavior

- Stores information persistently across OpenCode sessions
- Retrieves specific memories by key or searches by content
- Lists memories by category or all memories
- Codie maintains its own memory separate from OpenCode's

## Usage Notes

- Best for remembering user preferences, storing design decisions, tracking project context
- Memory is persistent and searchable
- Use categories to organize related information`;

const analyzeTaskComplexityDesc = `# analyzeTaskComplexity

Analyze whether a task should be delegated to Codie CLI or handled with local reasoning based on complexity indicators.

## Parameters

- **task** (required): The task description to analyze
- **context** (optional): Additional context about the task or codebase
- **factors** (optional): Specific factors to consider (comma-separated: planning, creativity, memory, debugging, architecture, implementation)

## Behavior

- Analyzes task description for complexity indicators
- Considers multiple factors: planning requirements, creativity needed, memory usage, debugging complexity, architecture decisions, implementation scope
- Returns recommendation on whether to use Codie
- Provides reasoning and confidence score

## Usage Notes

- Use before delegating tasks to make informed decisions
- Higher complexity scores suggest Codie would be more beneficial
- Consider the recommendation but also use your judgment`;

/**
 * Delegate a complex task to Codie CLI
 */
export const DelegateTaskTool = defineTool('delegateTask', {
  description: delegateTaskDesc,
  parameters: {
    task: { type: 'string', required: true, description: 'Description of the task to delegate' },
    context: { type: 'string', required: false, description: 'Additional context about the codebase or constraints' },
    priority: { type: 'string', required: false, description: 'Task priority level (low, medium, high)' },
    timeout: { type: 'number', required: false, description: 'Maximum time in minutes to allow Navigator to work' }
  },
  async execute(args, ctx) {
    const task = readString(args, 'task', { required: true });
    const context = readString(args, 'context');
    const priority = readString(args, 'priority', { defaultValue: 'medium' });
    const timeoutMinutes = readNumber(args, 'timeout', { defaultValue: 30, min: 1, max: 120 });

    try {
      // Check if Codie is available
      const isHealthy = await checkCodieHealth();
      if (!isHealthy) {
        return errorResult(
          'Codie CLI is not available or not properly configured. ' +
          'Please ensure Codie is installed and configured with API keys.',
          { fallback: 'Consider using local reasoning instead' }
        );
      }

      // Convert timeout to milliseconds
      const timeoutMs = timeoutMinutes * 60 * 1000;

      // Prepare the task with context
      let fullTask = task;
      if (context) {
        fullTask = `${task}\n\nContext: ${context}`;
      }

      // Add priority information
      if (priority !== 'medium') {
        fullTask = `[${priority.toUpperCase()} PRIORITY] ${fullTask}`;
      }

      // Run the task through Codie
      const result = await runQuickTask(fullTask, { timeout: timeoutMs });

      return successResult(
        `Codie completed the task:\n\n${result}`,
        {
          delegated_to: 'codie',
          priority,
          timeout_minutes: timeoutMinutes,
          task_summary: task.substring(0, 100) + (task.length > 100 ? '...' : '')
        }
      );

    } catch (error) {
      return errorResult(
        `Failed to delegate task to Codie: ${error.message}`,
        {
          fallback: 'Consider breaking the task into smaller steps or using local reasoning',
          original_task: task
        }
      );
    }
  }
});

/**
 * Ask Codie for advice or analysis
 */
export const AskCodieTool = defineTool('askCodie', {
  description: askCodieDesc,
  parameters: {
    question: { type: 'string', required: true, description: 'The question or topic to ask Codie about' },
    context: { type: 'string', required: false, description: 'Additional context about the codebase or situation' },
    detailLevel: { type: 'string', required: false, description: 'Level of detail in response (brief, normal, detailed)' }
  },
  async execute(args, ctx) {
    const question = readString(args, 'question', { required: true });
    const context = readString(args, 'context');
    const detailLevel = readString(args, 'detailLevel', { defaultValue: 'normal' });

    try {
      // Check if Codie is available
      const isHealthy = await checkCodieHealth();
      if (!isHealthy) {
        return errorResult(
          'Codie CLI is not available or not properly configured.',
          { fallback: 'Consider researching the question yourself' }
        );
      }

      // Format the question with detail level preference
      let fullQuestion = question;
      if (detailLevel !== 'normal') {
        fullQuestion = `[${detailLevel.toUpperCase()} DETAIL] ${question}`;
      }
      if (context) {
        fullQuestion = `${fullQuestion}\n\nContext: ${context}`;
      }

      // Ask Codie
      const result = await runQuickTask(fullQuestion, { timeout: 60000 }); // 1 minute timeout

      return successResult(
        `Codie's response:\n\n${result}`,
        {
          question_type: 'advice',
          detail_level: detailLevel,
          has_context: !!context
        }
      );

    } catch (error) {
      return errorResult(
        `Failed to get response from Codie: ${error.message}`,
        {
          fallback: 'Consider researching the question using available documentation',
          original_question: question
        }
      );
    }
  }
});

/**
 * Use Codie's persistent memory system
 */
export const CodieMemoryTool = defineTool('codieMemory', {
  description: codieMemoryDesc,
  parameters: {
    operation: { type: 'string', required: true, description: 'Memory operation (store, retrieve, search, list)' },
    key: { type: 'string', required: false, description: 'Memory key for storing or retrieving specific information' },
    value: { type: 'string', required: false, description: 'Information to store in memory' },
    category: { type: 'string', required: false, description: 'Category for organizing memories' },
    query: { type: 'string', required: false, description: 'Search query to find relevant memories' },
    limit: { type: 'number', required: false, description: 'Maximum number of results' }
  },
  async execute(args, ctx) {
    const operation = readString(args, 'operation', { required: true });
    const key = readString(args, 'key');
    const value = readString(args, 'value');
    const category = readString(args, 'category');
    const query = readString(args, 'query');
    const limit = readNumber(args, 'limit', { defaultValue: 10, min: 1, max: 50 });

    try {
      // Check if Codie is available
      const isHealthy = await checkCodieHealth();
      if (!isHealthy) {
        return errorResult(
          'Codie CLI is not available or not properly configured.',
          { fallback: 'Memory operations require Codie to be available' }
        );
      }

      // Create a Codie instance for memory operations
      const codie = await createCodie();

      let result;
      switch (operation.toLowerCase()) {
        case 'store':
          if (!key || !value) {
            return errorResult('Store operation requires both key and value parameters');
          }
          await codie.remember(value, key, category);
          result = `Stored information with key: ${key}`;
          break;

        case 'retrieve':
          if (!key) {
            return errorResult('Retrieve operation requires a key parameter');
          }
          const memory = await codie.recall(key);
          result = memory ? `Retrieved: ${memory}` : `No memory found for key: ${key}`;
          break;

        case 'search':
          if (!query) {
            return errorResult('Search operation requires a query parameter');
          }
          const searchResults = await codie.searchMemories(query, { limit });
          result = searchResults.length > 0
            ? `Found ${searchResults.length} memories:\n${searchResults.map(m => `- ${m}`).join('\n')}`
            : `No memories found matching: ${query}`;
          break;

        case 'list':
          const memories = await codie.listMemories(category, limit);
          result = memories.length > 0
            ? `Memories${category ? ` in category '${category}'` : ''}:\n${memories.map(m => `- ${m}`).join('\n')}`
            : `No memories found${category ? ` in category '${category}'` : ''}`;
          break;

        default:
          return errorResult(`Unknown operation: ${operation}. Supported: store, retrieve, search, list`);
      }

      return successResult(result, {
        operation,
        category: category || 'general',
        result_count: Array.isArray(result) ? result.length : 1
      });

    } catch (error) {
      return errorResult(
        `Failed to perform memory operation: ${error.message}`,
        {
          operation,
          fallback: 'Memory operations require Codie to be properly configured'
        }
      );
    }
  }
});

/**
 * Analyze task complexity to determine if Codie should be used
 */
export const AnalyzeTaskComplexityTool = defineTool('analyzeTaskComplexity', {
  description: analyzeTaskComplexityDesc,
  parameters: {
    task: { type: 'string', required: true, description: 'The task description to analyze' },
    context: { type: 'string', required: false, description: 'Additional context about the task or codebase' },
    factors: { type: 'string', required: false, description: 'Specific factors to consider (comma-separated)' }
  },
  async execute(args, ctx) {
    const task = readString(args, 'task', { required: true });
    const context = readString(args, 'context');
    const factorsStr = readString(args, 'factors');

    // Define complexity factors and their indicators
    const complexityFactors = {
      planning: ['plan', 'strategy', 'roadmap', 'architect', 'design', 'structure', 'organize'],
      creativity: ['creative', 'innovative', 'design', 'brainstorm', 'ideate', 'original', 'novel'],
      memory: ['remember', 'recall', 'context', 'history', 'persistent', 'long-term', 'session'],
      debugging: ['debug', 'fix', 'issue', 'problem', 'error', 'bug', 'troubleshoot', 'investigate'],
      architecture: ['architecture', 'system', 'infrastructure', 'scalability', 'performance', 'microservice'],
      implementation: ['implement', 'build', 'develop', 'code', 'refactor', 'optimize', 'feature', 'complex']
    };

    // Custom factors if specified
    const customFactors = factorsStr ? factorsStr.split(',').map(f => f.trim().toLowerCase()) : [];

    // Combine task and context for analysis
    const fullText = (task + ' ' + (context || '')).toLowerCase();

    // Analyze each factor
    const factorScores = {};
    let totalScore = 0;
    const matchedIndicators = [];

    for (const [factor, indicators] of Object.entries(complexityFactors)) {
      if (customFactors.length > 0 && !customFactors.includes(factor)) {
        continue; // Skip factors not in custom list
      }

      const matches = indicators.filter(indicator => fullText.includes(indicator));
      factorScores[factor] = matches.length;
      totalScore += matches.length;

      if (matches.length > 0) {
        matchedIndicators.push(`${factor}: ${matches.join(', ')}`);
      }
    }

    // Additional complexity indicators (always checked)
    const generalIndicators = [
      'multi-step', 'complex', 'challenging', 'difficult', 'sophisticated',
      'comprehensive', 'extensive', 'thorough', 'detailed', 'in-depth'
    ];

    const generalMatches = generalIndicators.filter(indicator => fullText.includes(indicator));
    totalScore += generalMatches.length;

    if (generalMatches.length > 0) {
      matchedIndicators.push(`general: ${generalMatches.join(', ')}`);
    }

    // Calculate recommendation
    const normalizedScore = Math.min(totalScore / 5, 1); // Normalize to 0-1 scale, cap at reasonable level

    const shouldUseNavigator = normalizedScore >= 0.4 || totalScore >= 3; // Use Codie if score >= 3 or normalized >= 0.4

    const confidence = Math.min(totalScore / 8, 1); // Confidence based on number of matches

    return successResult(
      `Task Complexity Analysis:\n\n` +
      `Task: ${task.substring(0, 100)}${task.length > 100 ? '...' : ''}\n` +
      `Complexity Score: ${totalScore}/10 (normalized: ${(normalizedScore * 100).toFixed(1)}%)\n` +
       `Should Use Codie: ${shouldUseNavigator ? 'YES' : 'NO'}\n` +
      `Confidence: ${(confidence * 100).toFixed(1)}%\n\n` +
      `Matched Indicators:\n${matchedIndicators.map(ind => `- ${ind}`).join('\n')}\n\n` +
       `Reasoning: ${shouldUseNavigator
         ? 'Task shows sufficient complexity indicators that would benefit from Codie\'s specialized reasoning and memory capabilities.'
         : 'Task appears suitable for local reasoning with available tools.'}`,
      {
        complexity_score: totalScore,
        normalized_score: normalizedScore,
        should_use_navigator: shouldUseNavigator,
        confidence,
        matched_factors: matchedIndicators,
        factor_breakdown: factorScores
      }
    );
  }
});