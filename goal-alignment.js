// goal-alignment.js
// Pre-flight check before main execution loop
// Analyzes user goals to ensure understanding before acting

import { fetchGemini } from './llm-tools.js';

/**
 * @typedef {Object} GoalAnalysis
 * @property {string} understood_goal - What the agent thinks the user wants
 * @property {'simple'|'moderate'|'complex'} complexity - Estimated task complexity
 * @property {boolean} requires_confirmation - Whether to ask user before proceeding
 * @property {string[]} safety_notes - Any concerns or warnings
 * @property {string[]} suggested_approach - Step-by-step plan
 * @property {boolean} is_destructive - Whether the action could destroy/overwrite data
 * @property {string[]} required_info - Information needed from user (if any)
 */

/**
 * Analyze a user goal before executing
 * @param {string} goal - The user's stated goal
 * @returns {Promise<GoalAnalysis>} - Analysis of the goal
 */
export async function analyzeGoal(goal) {
  const analysisPrompt = `Analyze this user request and respond in JSON only:
"${goal}"

Respond with this exact JSON structure:
{
  "understood_goal": "What you think the user wants (1-2 sentences)",
  "complexity": "simple|moderate|complex",
  "requires_confirmation": true or false,
  "safety_notes": ["any concerns or warnings"],
  "suggested_approach": ["step 1", "step 2", "..."],
  "is_destructive": true or false,
  "required_info": ["information needed from user if any"]
}

Guidelines:
- "simple" = single action, no side effects
- "moderate" = multiple steps, some context needed
- "complex" = many steps, needs planning, potential side effects
- requires_confirmation = true if: destructive, external actions, or ambiguous
- is_destructive = true if: deleting files, overwriting data, external API calls

Only output valid JSON, no explanation.`;

  try {
    const response = await fetchGemini(analysisPrompt);
    const text = response.candidates[0].content.parts[0].text;
    
    // Extract JSON from response (handle markdown code blocks)
    let jsonStr = text;
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1];
    }
    
    // Find JSON object in response
    const start = jsonStr.indexOf('{');
    const end = jsonStr.lastIndexOf('}');
    if (start !== -1 && end !== -1) {
      jsonStr = jsonStr.substring(start, end + 1);
    }
    
    return JSON.parse(jsonStr);
  } catch (error) {
    console.warn('Goal analysis failed, using defaults:', error.message);
    // Return safe defaults if analysis fails
    return {
      understood_goal: goal,
      complexity: 'moderate',
      requires_confirmation: false,
      safety_notes: [],
      suggested_approach: ['Execute as requested'],
      is_destructive: false,
      required_info: []
    };
  }
}

/**
 * Format goal analysis for display to user
 * @param {GoalAnalysis} analysis - The goal analysis
 * @returns {string} - Formatted string for display
 */
export function formatGoalConfirmation(analysis) {
  const complexityIcons = {
    simple: 'zap',
    moderate: 'clipboard',
    complex: 'git-branch'
  };
  
  let output = `**Goal Analysis**

**I understand you want to:** ${analysis.understood_goal}

**Complexity:** ${analysis.complexity}

**My approach:**
${analysis.suggested_approach.map((s, i) => `  ${i + 1}. ${s}`).join('\n')}`;

  if (analysis.safety_notes && analysis.safety_notes.length > 0) {
    output += `\n\n**Notes:** ${analysis.safety_notes.join(', ')}`;
  }

  if (analysis.is_destructive) {
    output += `\n\n**Warning:** This action may modify or delete existing data.`;
  }

  if (analysis.required_info && analysis.required_info.length > 0) {
    output += `\n\n**I need to know:** ${analysis.required_info.join(', ')}`;
  }

  return output;
}

/**
 * Determine if a goal requires user confirmation before proceeding
 * @param {GoalAnalysis} analysis - The goal analysis
 * @param {Object} options - Configuration options
 * @param {boolean} options.alwaysConfirm - Always require confirmation
 * @param {boolean} options.neverConfirm - Never require confirmation
 * @returns {boolean} - Whether to confirm with user
 */
export function shouldConfirm(analysis, options = {}) {
  if (options.neverConfirm) return false;
  if (options.alwaysConfirm) return true;
  
  // Confirm for destructive actions
  if (analysis.is_destructive) return true;
  
  // Confirm for complex tasks
  if (analysis.complexity === 'complex') return true;
  
  // Confirm if analysis says so
  if (analysis.requires_confirmation) return true;
  
  // Confirm if missing required info
  if (analysis.required_info && analysis.required_info.length > 0) return true;
  
  return false;
}

/**
 * Create a quick pre-flight summary for logging
 * @param {GoalAnalysis} analysis - The goal analysis
 * @returns {string} - One-line summary
 */
export function getQuickSummary(analysis) {
  const icon = analysis.is_destructive ? 'warning' : 
               analysis.complexity === 'complex' ? 'git-branch' :
               analysis.complexity === 'moderate' ? 'clipboard' : 'zap';
  
  return `[${analysis.complexity}] ${analysis.understood_goal} (${analysis.suggested_approach.length} steps)`;
}

/**
 * Estimate time for goal completion (rough heuristic)
 * @param {GoalAnalysis} analysis - The goal analysis
 * @returns {string} - Estimated time string
 */
export function estimateTime(analysis) {
  const stepCount = analysis.suggested_approach.length;
  
  if (analysis.complexity === 'simple') {
    return 'A few seconds';
  } else if (analysis.complexity === 'moderate') {
    return `About ${stepCount * 5} seconds`;
  } else {
    return `${Math.ceil(stepCount * 10 / 60)} minute(s) or more`;
  }
}

export default {
  analyzeGoal,
  formatGoalConfirmation,
  shouldConfirm,
  getQuickSummary,
  estimateTime
};
