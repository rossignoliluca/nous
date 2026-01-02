/**
 * Tool Call Compiler
 *
 * Makes invalid tool calls impossible by construction.
 *
 * Flow:
 * 1. Agent produces ToolIntent (tool name + partial params)
 * 2. Compiler validates against tool schema
 * 3. If valid → execute
 * 4. If missing required fields → CompilationResult with specifics
 *
 * This prevents ERR_TOOL_SCHEMA from stopping autonomous cycles on single failures.
 */

import { Tool, ToolParameter } from './agent';

export interface ToolIntent {
  tool: string;
  params: Record<string, any>;
}

export type CompilationStatus = 'valid' | 'incomplete' | 'invalid';

export interface CompilationResult {
  status: CompilationStatus;
  intent: ToolIntent;
  missingFields?: string[];
  invalidFields?: Array<{ field: string; reason: string }>;
  suggestion?: string;
  canAutoComplete?: boolean;
}

/**
 * Compile tool intent against tool schema
 */
export function compileToolIntent(
  intent: ToolIntent,
  tools: Tool[]
): CompilationResult {
  // Find tool
  const tool = tools.find(t => t.name === intent.tool);
  if (!tool) {
    return {
      status: 'invalid',
      intent,
      invalidFields: [{ field: 'tool', reason: `Tool '${intent.tool}' not found` }]
    };
  }

  const missingFields: string[] = [];
  const invalidFields: Array<{ field: string; reason: string }> = [];

  // Check required parameters
  for (const param of tool.parameters) {
    if (!param.required) continue;

    const value = intent.params[param.name];

    // Missing entirely
    if (value === undefined || value === null || value === '') {
      missingFields.push(param.name);
      continue;
    }

    // Type mismatch
    const actualType = typeof value;
    if (actualType !== param.type) {
      invalidFields.push({
        field: param.name,
        reason: `Expected type '${param.type}', got '${actualType}'`
      });
      continue;
    }

    // String validation
    if (param.type === 'string' && typeof value === 'string') {
      // Empty string
      if (value.trim() === '') {
        missingFields.push(param.name);
        continue;
      }

      // Truncation detection
      if (value.length > 100 && !/[\s.!?,;:\n]$/.test(value)) {
        invalidFields.push({
          field: param.name,
          reason: 'Appears truncated (ends abruptly)'
        });
        continue;
      }

      // Path traversal
      if ((param.name.includes('path') || param.name.includes('file')) &&
          (value.includes('../') || value.includes('..\\'))) {
        invalidFields.push({
          field: param.name,
          reason: 'Contains path traversal'
        });
        continue;
      }
    }

    // Number validation
    if (param.type === 'number' && typeof value === 'number') {
      if (isNaN(value) || !isFinite(value)) {
        invalidFields.push({
          field: param.name,
          reason: 'Not a valid number'
        });
        continue;
      }
    }
  }

  // Determine status
  if (missingFields.length > 0) {
    return {
      status: 'incomplete',
      intent,
      missingFields,
      suggestion: generateSuggestion(tool, missingFields),
      canAutoComplete: canAttemptAutoComplete(tool, intent, missingFields)
    };
  }

  if (invalidFields.length > 0) {
    return {
      status: 'invalid',
      intent,
      invalidFields
    };
  }

  return {
    status: 'valid',
    intent
  };
}

/**
 * Generate human-readable suggestion for missing fields
 */
function generateSuggestion(tool: Tool, missingFields: string[]): string {
  const descriptions: string[] = [];

  for (const fieldName of missingFields) {
    const param = tool.parameters.find(p => p.name === fieldName);
    if (param) {
      descriptions.push(`- ${fieldName}: ${param.description}`);
    }
  }

  return `Tool '${tool.name}' requires:\n${descriptions.join('\n')}`;
}

/**
 * Check if we can attempt auto-completion
 */
function canAttemptAutoComplete(
  tool: Tool,
  intent: ToolIntent,
  missingFields: string[]
): boolean {
  // For write_file, if we have path but missing content, we might be able to
  // infer content from context (e.g., read file first, then modify)
  if (tool.name === 'write_file') {
    const hasPath = intent.params.path !== undefined;
    const missingContent = missingFields.includes('content');

    if (hasPath && missingContent) {
      // Could potentially read existing file and let agent modify
      return true;
    }
  }

  // Generally, auto-completion is not safe
  return false;
}

/**
 * Attempt to auto-complete missing fields (limited, safe cases only)
 */
export async function attemptAutoComplete(
  intent: ToolIntent,
  missingFields: string[],
  tools: Tool[]
): Promise<ToolIntent | null> {
  const tool = tools.find(t => t.name === intent.tool);
  if (!tool) return null;

  // Only handle write_file path inference for now
  if (tool.name === 'write_file' && missingFields.includes('path')) {
    // Cannot auto-complete path - too ambiguous
    return null;
  }

  // For other tools, no safe auto-completion
  return null;
}

/**
 * Format compilation result as error message for agent
 */
export function formatCompilationError(result: CompilationResult): string {
  if (result.status === 'incomplete') {
    let msg = `INCOMPLETE_TOOL_CALL: Tool '${result.intent.tool}' is missing required fields.\n\n`;
    msg += `Missing: ${result.missingFields!.join(', ')}\n\n`;
    if (result.suggestion) {
      msg += result.suggestion;
    }
    return msg;
  }

  if (result.status === 'invalid') {
    let msg = `INVALID_TOOL_CALL: Tool '${result.intent.tool}' has invalid fields.\n\n`;
    msg += `Issues:\n`;
    for (const issue of result.invalidFields!) {
      msg += `  - ${issue.field}: ${issue.reason}\n`;
    }
    return msg;
  }

  return 'UNKNOWN_COMPILATION_ERROR';
}

/**
 * Check if compilation failures are repeating (loop detection)
 */
export class CompilationLoopDetector {
  private history: Array<{ tool: string; missingFields: string[] }> = [];
  private readonly maxHistory = 5;
  private readonly loopThreshold = 3;

  record(result: CompilationResult): void {
    if (result.status === 'incomplete' && result.missingFields) {
      this.history.push({
        tool: result.intent.tool,
        missingFields: result.missingFields
      });

      if (this.history.length > this.maxHistory) {
        this.history.shift();
      }
    }
  }

  isLooping(): boolean {
    if (this.history.length < this.loopThreshold) return false;

    // Check if last 3 failures are identical
    const recent = this.history.slice(-this.loopThreshold);
    const first = recent[0];

    return recent.every(entry =>
      entry.tool === first.tool &&
      JSON.stringify(entry.missingFields.sort()) === JSON.stringify(first.missingFields.sort())
    );
  }

  getLoopDetails(): string | null {
    if (!this.isLooping()) return null;

    const recent = this.history.slice(-this.loopThreshold);
    const first = recent[0];

    return `Agent is stuck in compilation loop: repeatedly calling '${first.tool}' without providing: ${first.missingFields.join(', ')}`;
  }

  reset(): void {
    this.history = [];
  }
}
