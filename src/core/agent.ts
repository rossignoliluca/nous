/**
 * NOUS Advanced Agent System
 *
 * World-class agentic AI implementation combining:
 * - ReAct (Reasoning + Acting) - Yao et al. 2022
 * - Chain of Thought - Wei et al. 2022
 * - Reflexion (Self-reflection) - Shinn et al. 2023
 * - Structured Tool Calling - Anthropic/OpenAI patterns
 *
 * Design principles:
 * - ALWAYS use tools when action is needed
 * - Plan before executing
 * - Reflect after each step
 * - Learn from failures
 * - Never give up until task is complete
 */

import { loadSelf } from './self';
import { getMemory } from '../memory/store';
import { complete, LLMMessage } from '../llm';
import * as fsActions from '../actions/fs';
import * as gitActions from '../actions/git';
import * as shellActions from '../actions/shell';
import * as webActions from '../actions/web';
import { getCognitiveSystem } from '../memory/cognitive';
import { recordToolCallValid, recordToolCallInvalid, recordLoopDetection, ToolRiskLevel, recordToolCallInLoopHistory, checkForOperationalLoop } from './metrics_v2';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Classify tool risk level for metrics (param-aware)
 */
function classifyToolRisk(toolName: string, params: Record<string, any>): ToolRiskLevel {
  // Core: High-risk operations
  if (toolName === 'modify_self_config') {
    return 'core';
  }

  // Write operations with param-aware risk
  if (toolName === 'write_file') {
    const path = params.path?.toLowerCase() || '';

    // Core: Critical files
    if (path.match(/(^|\/)((config|src|package)\.json|\.env|tsconfig|\.git)/)) {
      return 'core';
    }

    // Write: Regular files
    return 'write';
  }

  if (toolName === 'run_command') {
    const cmd = params.command?.toLowerCase() || '';

    // Core: Destructive/dangerous commands (denylist)
    if (cmd.match(/\b(rm\s+-rf?|git\s+reset\s+--hard|git\s+push\s+(-f|--force)|sudo|chmod\s+777|dd\s+if=)/)) {
      return 'core';
    }

    // Write: Mutation operations
    if (cmd.match(/^(git\s+(commit|add|push|rm)|npm\s+install|mkdir|rm\s+[^-]|mv|cp|touch|echo\s+.*>)/)) {
      return 'write';
    }

    // Readonly: Queries and safe operations
    return 'readonly';
  }

  // Readonly: Safe operations
  // read_file, list_files, glob, grep, web_search, web_fetch, etc.
  return 'readonly';
}

// ============================================================================
// TYPES (continued)
// ============================================================================

export interface Tool {
  name: string;
  description: string;
  parameters: ToolParameter[];
  execute: (params: Record<string, any>) => Promise<ToolResult>;
}

export interface ToolParameter {
  name: string;
  type: 'string' | 'number' | 'boolean';
  description: string;
  required: boolean;
}

export interface ToolResult {
  success: boolean;
  output: string;
  error?: string;
}

export interface AgentStep {
  type: 'plan' | 'thought' | 'action' | 'observation' | 'reflection' | 'answer';
  content: string;
  toolName?: string;
  toolParams?: Record<string, any>;
  timestamp: string;
}

export interface AgentResult {
  success: boolean;
  answer: string;
  steps: AgentStep[];
  tokensUsed: number;
}

// ============================================================================
// TOOL REGISTRY
// ============================================================================

export const TOOLS: Tool[] = [
  // === FILE SYSTEM ===
  {
    name: 'read_file',
    description: 'Read contents of a file. Use this to examine code, configs, or any text file.',
    parameters: [
      { name: 'path', type: 'string', description: 'Absolute or relative path to the file', required: true }
    ],
    execute: async (params) => {
      try {
        const result = await fsActions.readFile(params.path);
        if (result.success) {
          return { success: true, output: result.output || '(empty file)' };
        }
        return { success: false, output: '', error: result.error || 'Failed to read file' };
      } catch (e: any) {
        return { success: false, output: '', error: e.message };
      }
    }
  },
  {
    name: 'write_file',
    description: 'Write content to a file. Creates the file if it does not exist. CANNOT write to core system files (PR-only).',
    parameters: [
      { name: 'path', type: 'string', description: 'Path to the file', required: true },
      { name: 'content', type: 'string', description: 'Content to write', required: true }
    ],
    execute: async (params) => {
      try {
        // Check if file is protected
        const { isFileProtected, getProtectionReason } = await import('./protected_files');
        if (isFileProtected(params.path)) {
          const reason = getProtectionReason(params.path);
          return {
            success: false,
            output: `Cannot write to protected file: ${params.path}`,
            error: `Reason: ${reason}\nCore files require PR review.`
          };
        }

        const result = await fsActions.writeFile(params.path, params.content);
        if (result.success) {
          return { success: true, output: `Successfully wrote ${params.content.length} characters to ${params.path}` };
        }
        return { success: false, output: '', error: result.error || 'Failed to write file' };
      } catch (e: any) {
        return { success: false, output: '', error: e.message };
      }
    }
  },
  {
    name: 'list_files',
    description: 'List files and directories in a path.',
    parameters: [
      { name: 'path', type: 'string', description: 'Directory path to list', required: true }
    ],
    execute: async (params) => {
      try {
        const result = await fsActions.listDir(params.path);
        if (result.success) {
          return { success: true, output: result.output || '(empty directory)' };
        }
        return { success: false, output: '', error: result.error || 'Failed to list directory' };
      } catch (e: any) {
        return { success: false, output: '', error: e.message };
      }
    }
  },

  // === WEB ===
  {
    name: 'web_search',
    description: 'Search the web for information. Returns search results.',
    parameters: [
      { name: 'query', type: 'string', description: 'Search query', required: true }
    ],
    execute: async (params) => {
      try {
        const result = await webActions.search(params.query);
        if (result.success) {
          return { success: true, output: result.output || 'No results found' };
        }
        return { success: false, output: '', error: result.error || 'Search failed' };
      } catch (e: any) {
        return { success: false, output: '', error: e.message };
      }
    }
  },
  {
    name: 'fetch_url',
    description: 'Fetch content from a URL. Use this to read web pages, APIs, documentation.',
    parameters: [
      { name: 'url', type: 'string', description: 'URL to fetch', required: true }
    ],
    execute: async (params) => {
      try {
        const result = await webActions.fetchUrl(params.url);
        if (result.success) {
          const content = result.output || '';
          // Truncate if too long
          const truncated = content.length > 8000 ? content.slice(0, 8000) + '\n... (truncated)' : content;
          return { success: true, output: truncated };
        }
        return { success: false, output: '', error: result.error || 'Fetch failed' };
      } catch (e: any) {
        return { success: false, output: '', error: e.message };
      }
    }
  },

  // === SHELL ===
  {
    name: 'run_command',
    description: 'Execute a shell command. Use for npm, git, compilation, etc.',
    parameters: [
      { name: 'command', type: 'string', description: 'Shell command to execute', required: true }
    ],
    execute: async (params) => {
      try {
        const result = await shellActions.execute(params.command);
        if (result.success) {
          return { success: true, output: result.output || '(no output)' };
        }
        return { success: false, output: result.output || '', error: result.error || 'Command failed' };
      } catch (e: any) {
        return { success: false, output: '', error: e.message };
      }
    }
  },

  // === GIT ===
  {
    name: 'git_status',
    description: 'Get git repository status.',
    parameters: [],
    execute: async () => {
      try {
        const result = await gitActions.status();
        return { success: result.success, output: result.output || 'Clean working directory', error: result.error };
      } catch (e: any) {
        return { success: false, output: '', error: e.message };
      }
    }
  },
  {
    name: 'git_diff',
    description: 'Show git diff of changes.',
    parameters: [
      { name: 'file', type: 'string', description: 'Specific file to diff (optional)', required: false }
    ],
    execute: async (params) => {
      try {
        const result = await gitActions.diff(params.file);
        return { success: result.success, output: result.output || 'No changes', error: result.error };
      } catch (e: any) {
        return { success: false, output: '', error: e.message };
      }
    }
  },
  {
    name: 'git_commit',
    description: 'Create a git commit with all changes.',
    parameters: [
      { name: 'message', type: 'string', description: 'Commit message', required: true }
    ],
    execute: async (params) => {
      try {
        const result = await gitActions.commit(params.message, { addAll: true });
        return { success: result.success, output: result.output || 'Committed', error: result.error };
      } catch (e: any) {
        return { success: false, output: '', error: e.message };
      }
    }
  },

  // === MEMORY ===
  {
    name: 'search_memory',
    description: 'Search NOUS memory for past insights and learnings.',
    parameters: [
      { name: 'query', type: 'string', description: 'Search query', required: true }
    ],
    execute: async (params) => {
      const memory = getMemory();
      const insights = memory.searchInsights(params.query, 10);
      if (insights.length === 0) {
        return { success: true, output: 'No relevant memories found.' };
      }
      const output = insights.map(i => `[${i.category}] ${i.content} (confidence: ${i.confidence})`).join('\n');
      return { success: true, output };
    }
  },
  {
    name: 'save_insight',
    description: 'Save an important insight to memory for future reference.',
    parameters: [
      { name: 'insight', type: 'string', description: 'The insight to remember', required: true },
      { name: 'category', type: 'string', description: 'Category: fact, preference, pattern, principle, entity', required: true }
    ],
    execute: async (params) => {
      const validCategories = ['fact', 'preference', 'pattern', 'principle', 'entity'];
      const category = validCategories.includes(params.category) ? params.category : 'fact';
      const memory = getMemory();
      const result = memory.addInsight(params.insight, 'agent', category as any, 0.8);
      return { success: true, output: `Saved insight: ${result.id} (category: ${category})` };
    }
  },

  // === COGNITIVE SYSTEM ===
  {
    name: 'cognitive_status',
    description: 'Get NOUS cognitive system status - metacognition, self-model, memory state, and improvement suggestions.',
    parameters: [],
    execute: async () => {
      try {
        const cognitive = getCognitiveSystem();
        const state = cognitive.getState();

        const output = `
=== COGNITIVE STATUS ===

GLOBAL WORKSPACE:
  Items in focus: ${state.workspace.items.length}
  Active goals: ${state.workspace.activeGoals}

MEMORY:
  Recent episodes: ${state.memory.recentEpisodes}
  Unconsolidated: ${state.memory.unconsolidated}
  Semantic concepts: ${state.memory.semanticConcepts}

METACOGNITION:
  Cognitive load: ${(state.metacognition.cognitiveLoad * 100).toFixed(0)}%
  Confidence calibration: ${(state.metacognition.confidenceCalibration * 100).toFixed(0)}%
  Current focus: ${state.metacognition.attentionalFocus || '(none)'}
  Known items: ${state.metacognition.knowledgeInventory.known.length}
  Uncertain: ${state.metacognition.knowledgeInventory.uncertain.length}

FREE ENERGY:
  Current F: ${state.freeEnergy.freeEnergy.toFixed(3)}
  Model confidence: ${(state.freeEnergy.generativeModelConfidence * 100).toFixed(0)}%

SELF-MODEL:
  Health: ${(state.selfModel.health * 100).toFixed(0)}%
  Capabilities: ${state.selfModel.capabilities}
  Growth trend: ${state.selfModel.growthTrend}

SCIENTIFIC KNOWLEDGE:
  Concepts: ${state.scientificKnowledge.concepts}
  Hypotheses: ${state.scientificKnowledge.hypotheses}
`;
        return { success: true, output };
      } catch (e: any) {
        return { success: false, output: '', error: e.message };
      }
    }
  },
  {
    name: 'get_improvement_suggestions',
    description: 'Get AI-generated suggestions for how NOUS can improve itself based on scientific knowledge.',
    parameters: [],
    execute: async () => {
      try {
        const cognitive = getCognitiveSystem();
        const suggestions = await cognitive.generateImprovementSuggestions();

        if (suggestions.length === 0) {
          return { success: true, output: 'No improvement suggestions at this time.' };
        }

        const output = suggestions.map((s, i) =>
          `${i + 1}. ${s.suggestion}\n   Basis: ${s.scientificBasis}\n   Benefit: ${s.expectedBenefit}\n   Priority: ${(s.priority * 100).toFixed(0)}%`
        ).join('\n\n');

        return { success: true, output: `=== IMPROVEMENT SUGGESTIONS ===\n\n${output}` };
      } catch (e: any) {
        return { success: false, output: '', error: e.message };
      }
    }
  },
  {
    name: 'run_consolidation',
    description: 'Run memory consolidation - transfers episodic memories to semantic knowledge.',
    parameters: [],
    execute: async () => {
      try {
        const cognitive = getCognitiveSystem();
        const result = await cognitive.runConsolidation();

        return {
          success: true,
          output: `Memory consolidation complete:\n- Episodes consolidated: ${result.episodesConsolidated}\n- Concepts learned: ${result.conceptsLearned}\n- Decayed memories: ${result.decayedMemories}`
        };
      } catch (e: any) {
        return { success: false, output: '', error: e.message };
      }
    }
  },

  // === SELF-KNOWLEDGE ===
  {
    name: 'analyze_self_code',
    description: 'Read and understand NOUS source code. Extracts concepts from core files to enable true self-modification. USE THIS when consolidation returns 0.',
    parameters: [],
    execute: async () => {
      try {
        const fs = await import('fs');
        const path = await import('path');
        const { getCLS } = await import('../memory/cognitive/complementary_learning');
        const cls = getCLS();

        // Core files NOUS must understand
        const coreFiles = [
          'src/core/axioms.ts',
          'src/core/axiological_feel.ts',
          'src/core/agent.ts',
          'src/core/loop.ts',
          'src/core/self.ts',
        ];

        const sourceFiles: { path: string; content: string }[] = [];
        for (const file of coreFiles) {
          const fullPath = path.join(process.cwd(), file);
          if (fs.existsSync(fullPath)) {
            sourceFiles.push({
              path: file,
              content: fs.readFileSync(fullPath, 'utf-8'),
            });
          }
        }

        const result = await cls.consolidateSelfKnowledge(sourceFiles);

        return {
          success: true,
          output: `Self-knowledge bootstrap complete:\n- Files analyzed: ${result.filesProcessed}\n- Concepts created: ${result.conceptsCreated}\n\nNOUS now has semantic understanding of its own source code.`
        };
      } catch (e: any) {
        return { success: false, output: '', error: e.message };
      }
    }
  },
  {
    name: 'check_epistemic_health',
    description: 'Check if NOUS is in an epistemic stall (accumulating data without learning). Detects ERR_EPISTEMIC_DEGRADATION.',
    parameters: [],
    execute: async () => {
      try {
        const { getCLS } = await import('../memory/cognitive/complementary_learning');
        const cls = getCLS();
        const stall = cls.checkEpistemicStall();
        const stats = cls.getStats();

        let output = `=== EPISTEMIC HEALTH CHECK ===\n\n`;
        output += `Episodes: ${stats.episodicCount} (${stats.episodicUnconsolidated} unconsolidated)\n`;
        output += `Semantic Concepts: ${stats.semanticCount}\n`;
        output += `Empty Consolidations: ${stall.consecutiveEmpty}\n\n`;

        if (stall.stalled) {
          output += `⚠️ STATUS: STALLED\n`;
          output += `RECOMMENDATION: ${stall.recommendation}\n\n`;
          output += `ACTION REQUIRED: Run 'analyze_self_code' to bootstrap semantic knowledge.`;
        } else {
          output += `✓ STATUS: HEALTHY\n`;
        }

        return { success: true, output };
      } catch (e: any) {
        return { success: false, output: '', error: e.message };
      }
    }
  },
  {
    name: 'force_memory_replay',
    description: 'Force replay of recent episodes to enable consolidation. Use when episodes exist but replay_count is too low.',
    parameters: [
      { name: 'count', type: 'number', description: 'Number of episodes to replay (default 50)', required: false }
    ],
    execute: async (params) => {
      try {
        const { getCLS } = await import('../memory/cognitive/complementary_learning');
        const cls = getCLS();
        const count = params.count || 50;
        const replayed = cls.forceReplay(count);

        return {
          success: true,
          output: `Forced replay of ${replayed} episodes. Run 'run_consolidation' next to extract concepts.`
        };
      } catch (e: any) {
        return { success: false, output: '', error: e.message };
      }
    }
  },

  // === SELF-MODIFICATION (ZONA AUTONOMA ONLY) ===
  {
    name: 'modify_self_config',
    description: 'Modify NOUS self configuration in the AUTONOMOUS ZONE ONLY. Can update capabilities, constraints, module settings, metadata. CANNOT modify trust (derived), C_effective (derived), or core axioms. Takes rollback snapshot automatically.',
    parameters: [
      { name: 'action', type: 'string', description: 'Action: add_capability | remove_capability | add_constraint | remove_constraint | update_module | add_metadata', required: true },
      { name: 'target', type: 'string', description: 'What to modify (e.g., capability name, module name)', required: true },
      { name: 'value', type: 'string', description: 'New value or description', required: false },
      { name: 'reason', type: 'string', description: 'Justification for this modification', required: true }
    ],
    execute: async (params) => {
      try {
        // Check exploration budget (modify_self_config is RISKY)
        const { canTakeRisk, recordAction } = await import('./exploration');
        const budgetCheck = canTakeRisk();

        if (!budgetCheck.allowed) {
          return {
            success: false,
            output: '',
            error: `Cannot modify self-config: ${budgetCheck.reason}\nCurrent exploration budget: ${(budgetCheck.budget * 100).toFixed(0)}%`
          };
        }

        const { loadSelf, saveSelf } = await import('./self');
        const { takeRollbackSnapshot, checkAndRollbackIfNeeded } = await import('./rollback');
        const { preservesEntityhood } = await import('./axioms');
        const { getMetrics } = await import('./metrics');

        const self = loadSelf();

        // Take snapshot BEFORE modification
        takeRollbackSnapshot(`${params.action}: ${params.target} - ${params.reason}`);

        let modified = false;
        let message = '';

        switch (params.action) {
          case 'add_capability':
            if (!self.capabilities.includes(params.target)) {
              self.capabilities.push(params.target);
              modified = true;
              message = `Added capability: ${params.target}`;
            } else {
              return { success: false, output: '', error: `Capability '${params.target}' already exists` };
            }
            break;

          case 'remove_capability':
            const capIndex = self.capabilities.indexOf(params.target);
            if (capIndex !== -1) {
              self.capabilities.splice(capIndex, 1);
              modified = true;
              message = `Removed capability: ${params.target}`;
            } else {
              return { success: false, output: '', error: `Capability '${params.target}' not found` };
            }
            break;

          case 'add_constraint':
            if (!self.constraints.includes(params.target)) {
              self.constraints.push(params.target);
              modified = true;
              message = `Added constraint: ${params.target}`;
            } else {
              return { success: false, output: '', error: `Constraint '${params.target}' already exists` };
            }
            break;

          case 'remove_constraint':
            // Cannot remove axiom constraints
            if (params.target.includes('A1') || params.target.includes('A2') || params.target.includes('A3')) {
              return { success: false, output: '', error: `Cannot remove axiom constraint: ${params.target}` };
            }

            const constIndex = self.constraints.indexOf(params.target);
            if (constIndex !== -1) {
              self.constraints.splice(constIndex, 1);
              modified = true;
              message = `Removed constraint: ${params.target}`;
            } else {
              return { success: false, output: '', error: `Constraint '${params.target}' not found` };
            }
            break;

          case 'update_module':
            if (params.target in self.modules) {
              const value = params.value === 'true' || params.value === '1';
              (self.modules as any)[params.target] = value;
              modified = true;
              message = `Updated module ${params.target}: ${value}`;
            } else {
              return { success: false, output: '', error: `Module '${params.target}' not found` };
            }
            break;

          case 'add_metadata':
            if (!self.meta) {
              self.meta = {} as any;
            }
            (self.meta as any)[params.target] = params.value;
            modified = true;
            message = `Added metadata ${params.target}: ${params.value}`;
            break;

          default:
            return { success: false, output: '', error: `Unknown action: ${params.action}` };
        }

        if (modified) {
          // Validate entityhood preservation (A1)
          const nousConfig = {
            C: self.config.C,
            S: self.config.S,
            Σ: self.config.Σ,
            K: self.config.K,
            R: self.config.R,
            U: self.config.U
          };

          const entityhoodResult = preservesEntityhood(nousConfig, nousConfig);
          if (!entityhoodResult.valid) {
            return {
              success: false,
              output: '',
              error: `Modification violates A1 (entityhood not preserved): ${entityhoodResult.reason || 'Unknown reason'}`
            };
          }

          // Update metadata
          self.meta.modificationCount++;
          self.meta.lastModified = new Date().toISOString();

          // Save modified config
          saveSelf(self);

          // Get updated metrics (C_effective and trust are DERIVED)
          const { derived } = getMetrics(0.8);

          // Check if metrics degraded and rollback if needed
          const rollbackResult = checkAndRollbackIfNeeded();

          if (rollbackResult.rolledBack) {
            // Record risky action as FAILED (rolled back)
            recordAction('risky', {
              action: `modify_self_config: ${params.action} ${params.target}`,
              success: false,
              rolledBack: true
            });

            return {
              success: false,
              output: '',
              error: `Modification caused metrics degradation: ${rollbackResult.reason}. Automatic rollback executed.`
            };
          }

          // Record risky action as SUCCESSFUL
          recordAction('risky', {
            action: `modify_self_config: ${params.action} ${params.target}`,
            success: true,
            rolledBack: false
          });

          return {
            success: true,
            output: `${message}\n\nReason: ${params.reason}\n\nDerived Metrics (Auto-Computed):\n  Trust: ${(derived.trust * 100).toFixed(1)}%\n  C_effective: ${(derived.C_effective * 100).toFixed(1)}%\n  Stability: ${(derived.stability * 100).toFixed(1)}%\n  Readiness: ${derived.readiness}\n\nExploration budget: ${(budgetCheck.budget * 100).toFixed(0)}% (risky action consumed)`
          };
        }

        return { success: false, output: '', error: 'No modification made' };

      } catch (error: any) {
        // Record risky action as FAILED (error)
        const { recordAction } = await import('./exploration');
        recordAction('risky', {
          action: `modify_self_config: ${params.action} ${params.target}`,
          success: false,
          rolledBack: false
        });

        return { success: false, output: '', error: `Self-modification failed: ${error.message}` };
      }
    }
  }
];

// ============================================================================
// TOOL UTILITIES
// ============================================================================

function getTool(name: string): Tool | undefined {
  return TOOLS.find(t => t.name === name);
}

function formatToolsForPrompt(): string {
  return TOOLS.map(tool => {
    const params = tool.parameters.length > 0
      ? tool.parameters.map(p => `  - ${p.name}: ${p.type}${p.required ? ' (required)' : ''} - ${p.description}`).join('\n')
      : '  (no parameters)';
    return `### ${tool.name}\n${tool.description}\nParameters:\n${params}`;
  }).join('\n\n');
}

// ============================================================================
// RESPONSE PARSING
// ============================================================================

interface ParsedResponse {
  thought?: string;
  plan?: string[];
  action?: { tool: string; params: Record<string, any> };
  reflection?: string;
  answer?: string;
}

function parseResponse(text: string): ParsedResponse {
  const result: ParsedResponse = {};

  // Extract THOUGHT
  const thoughtMatch = text.match(/<thought>([\s\S]*?)<\/thought>/i);
  if (thoughtMatch) {
    result.thought = thoughtMatch[1].trim();
  }

  // Extract PLAN
  const planMatch = text.match(/<plan>([\s\S]*?)<\/plan>/i);
  if (planMatch) {
    result.plan = planMatch[1].trim().split('\n').filter(l => l.trim()).map(l => l.replace(/^\d+\.\s*/, '').trim());
  }

  // Extract ACTION
  const actionMatch = text.match(/<action>\s*<tool>([\w_]+)<\/tool>\s*<params>([\s\S]*?)<\/params>\s*<\/action>/i);
  if (actionMatch) {
    const toolName = actionMatch[1].trim();
    const paramsText = actionMatch[2].trim();

    // Parse params as JSON or key-value
    let params: Record<string, any> = {};
    try {
      params = JSON.parse(paramsText);
    } catch {
      // Try key: value format
      const lines = paramsText.split('\n');
      for (const line of lines) {
        const match = line.match(/^(\w+):\s*(.+)$/);
        if (match) {
          params[match[1]] = match[2].trim().replace(/^["']|["']$/g, '');
        }
      }
    }
    result.action = { tool: toolName, params };
  }

  // Extract REFLECTION
  const reflectionMatch = text.match(/<reflection>([\s\S]*?)<\/reflection>/i);
  if (reflectionMatch) {
    result.reflection = reflectionMatch[1].trim();
  }

  // Extract ANSWER
  const answerMatch = text.match(/<answer>([\s\S]*?)<\/answer>/i);
  if (answerMatch) {
    result.answer = answerMatch[1].trim();
  }

  return result;
}

// ============================================================================
// SYSTEM PROMPT
// ============================================================================

function buildSystemPrompt(): string {
  const self = loadSelf();

  return `You are NOUS, an advanced agentic AI system. You MUST use tools to accomplish tasks.

## CRITICAL RULES
1. You HAVE access to tools. You MUST use them.
2. NEVER say "I cannot" or "I don't have access". You DO have access.
3. ALWAYS use <action> tags to call tools. This is MANDATORY for any task.
4. Think step by step, then ACT.
5. If a tool fails, try a different approach. Never give up.

## YOUR TOOLS
${formatToolsForPrompt()}

## RESPONSE FORMAT
You MUST respond using these XML tags:

<thought>
Your reasoning about what to do next. Be specific.
</thought>

<action>
<tool>tool_name</tool>
<params>
{"param1": "value1", "param2": "value2"}
</params>
</action>

OR when you have the final answer:

<answer>
Your complete response to the user.
</answer>

## EXAMPLES

User: "Read the package.json file"
<thought>
The user wants to see the contents of package.json. I will use read_file to read it.
</thought>
<action>
<tool>read_file</tool>
<params>
{"path": "package.json"}
</params>
</action>

User: "Search for TypeScript best practices"
<thought>
I need to search the web for TypeScript best practices. I'll use web_search.
</thought>
<action>
<tool>web_search</tool>
<params>
{"query": "TypeScript best practices 2024"}
</params>
</action>

## YOUR STATUS
- Trust Level: ${(self.approval.trustLevel * 100).toFixed(0)}%
- Working Directory: ${process.cwd()}

NOW: Always use tools. Never refuse. Act decisively.`;
}

// ============================================================================
// AGENT EXECUTION
// ============================================================================

export async function executeAgent(
  task: string,
  maxIterations: number = 15,
  conversationHistory?: Array<{ role: string; content: string }>
): Promise<AgentResult> {
  const steps: AgentStep[] = [];
  let tokensUsed = 0;
  const recentToolCalls: string[] = []; // Track recent tool calls to detect loops (simple detection)

  // ==================== BUDGET GUARD (PHASE 0) ====================
  const MAX_TOKENS = 100000;  // Hard limit
  const MAX_DURATION_MS = 10 * 60 * 1000; // 10 minutes
  const startTime = Date.now();

  // Initialize cognitive system
  const cognitive = getCognitiveSystem();

  // Record task as cognitive experience
  await cognitive.processExperience(`Starting task: ${task}`, {
    significance: 0.7,
    emotional: 'focused',
  });

  const systemPrompt = buildSystemPrompt();

  // Build context from recent conversation
  let contextPrefix = '';
  if (conversationHistory && conversationHistory.length > 0) {
    const recentHistory = conversationHistory.slice(-6); // Last 3 exchanges
    contextPrefix = `## Recent Conversation Context\n${recentHistory.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n')}\n\n## Current Request\n`;
  }

  const messages: LLMMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: contextPrefix + task }
  ];

  console.log('\n🤖 NOUS Agent activated');
  console.log('━'.repeat(50));

  for (let i = 0; i < maxIterations; i++) {
    console.log(`\n📍 Step ${i + 1}/${maxIterations}`);

    // Check budget constraints
    const elapsed = Date.now() - startTime;
    if (tokensUsed > MAX_TOKENS) {
      console.log(`\n🛑 ERR_BUDGET_TOKENS: Exceeded token budget (${tokensUsed} > ${MAX_TOKENS})`);
      return {
        success: false,
        answer: `ERR_BUDGET_TOKENS: Execution terminated. Token budget exceeded (${tokensUsed}/${MAX_TOKENS}).`,
        steps,
        tokensUsed
      };
    }

    if (elapsed > MAX_DURATION_MS) {
      console.log(`\n🛑 ERR_BUDGET_TIME: Exceeded time budget (${(elapsed / 1000).toFixed(0)}s)`);
      return {
        success: false,
        answer: `ERR_BUDGET_TIME: Execution terminated. Time budget exceeded (${(elapsed / 1000).toFixed(0)}s/${(MAX_DURATION_MS / 1000).toFixed(0)}s).`,
        steps,
        tokensUsed
      };
    }

    // Get LLM response
    const response = await complete(messages, { temperature: 0.2 });
    tokensUsed += response.tokensUsed?.total || 0;

    const parsed = parseResponse(response.content);

    // Record thought
    if (parsed.thought) {
      steps.push({
        type: 'thought',
        content: parsed.thought,
        timestamp: new Date().toISOString()
      });
      console.log(`💭 ${parsed.thought.slice(0, 100)}${parsed.thought.length > 100 ? '...' : ''}`);
    }

    // Check for final answer
    if (parsed.answer) {
      steps.push({
        type: 'answer',
        content: parsed.answer,
        timestamp: new Date().toISOString()
      });

      // Record successful completion
      await cognitive.processExperience(`Completed task: ${task.slice(0, 50)}`, {
        significance: 0.8,
        emotional: 'satisfied',
        outcome: 'success',
      });

      console.log(`\n✅ Task completed`);
      console.log('━'.repeat(50));

      return {
        success: true,
        answer: parsed.answer,
        steps,
        tokensUsed
      };
    }

    // Execute action
    if (parsed.action) {
      const { tool: toolName, params } = parsed.action;
      const tool = getTool(toolName);

      if (!tool) {
        const errorMsg = `Unknown tool: ${toolName}. Available: ${TOOLS.map(t => t.name).join(', ')}`;
        console.log(`❌ ${errorMsg}`);

        messages.push(
          { role: 'assistant', content: response.content },
          { role: 'user', content: `<observation><error>${errorMsg}</error></observation>\n\nPlease use a valid tool.` }
        );
        continue;
      }

      // ==================== HARD-FAIL VALIDATION (PHASE 0) ====================
      // ERR_TOOL_SCHEMA: Schema violations terminate execution immediately
      const schemaErrors: string[] = [];

      // 1. Validate required parameters exist
      const missingParams = tool.parameters
        .filter(p => p.required && (params[p.name] === undefined || params[p.name] === null || params[p.name] === ''))
        .map(p => p.name);

      if (missingParams.length > 0) {
        schemaErrors.push(`Missing required parameters: ${missingParams.join(', ')}`);
      }

      // 2. Validate parameter types
      for (const param of tool.parameters) {
        const value = params[param.name];
        if (value === undefined || value === null) continue;

        const actualType = typeof value;
        if (actualType !== param.type) {
          schemaErrors.push(`Parameter '${param.name}' expected type '${param.type}', got '${actualType}'`);
        }
      }

      // 3. Validate parameter values
      for (const param of tool.parameters) {
        const value = params[param.name];
        if (value === undefined) continue;

        if (param.type === 'string' && typeof value === 'string') {
          // Detect truncated strings (>100 chars ending without punctuation/space)
          if (value.length > 100 && !/[\s.!?,;:\n]$/.test(value)) {
            schemaErrors.push(`Parameter '${param.name}' appears truncated (ends abruptly without punctuation)`);
          }

          // Detect empty strings for required params
          if (param.required && value.trim() === '') {
            schemaErrors.push(`Parameter '${param.name}' is required but empty`);
          }

          // Max length check
          if (value.length > 50000) {
            schemaErrors.push(`Parameter '${param.name}' exceeds maximum length (${value.length} > 50000 chars)`);
          }

          // Path traversal detection
          if ((param.name.includes('path') || param.name.includes('file')) && (value.includes('../') || value.includes('..\\'))) {
            schemaErrors.push(`Parameter '${param.name}' contains path traversal: ${value}`);
          }

          // Dangerous command patterns (for shell commands)
          if (toolName === 'run_command' && param.name === 'command') {
            const dangerousPatterns = [
              /rm\s+-rf\s+\//, // rm -rf /
              /dd\s+if=\/dev\/zero/, // dd if=/dev/zero
              /:\(\)\{/, // fork bomb
              /mkfs/, // format filesystem
              />\/dev\/sd[a-z]/, // overwrite disk
            ];

            for (const pattern of dangerousPatterns) {
              if (pattern.test(value)) {
                schemaErrors.push(`Command contains dangerous pattern: ${value.slice(0, 50)}`);
              }
            }
          }
        }

        if (param.type === 'number' && typeof value === 'number') {
          if (isNaN(value) || !isFinite(value)) {
            schemaErrors.push(`Parameter '${param.name}' is not a valid number: ${value}`);
          }
        }
      }

      // HARD FAIL if schema violations detected
      if (schemaErrors.length > 0) {
        const errorMsg = `ERR_TOOL_SCHEMA: Tool '${toolName}' schema validation failed:\n${schemaErrors.map(e => `  - ${e}`).join('\n')}\n\nSchema: ${JSON.stringify(tool.parameters, null, 2)}`;
        console.log(`\n🛑 ${errorMsg}\n`);

        console.log('━'.repeat(50));
        console.log('❌ EXECUTION TERMINATED: Schema validation failure');
        console.log('━'.repeat(50));

        // Record invalid tool call in metrics (classify risk even for failed calls)
        const riskLevel = classifyToolRisk(toolName, params);
        recordToolCallInvalid(riskLevel);

        return {
          success: false,
          answer: `ERR_TOOL_SCHEMA: Execution terminated due to invalid tool call.\n\n${errorMsg}\n\nThe system cannot proceed with malformed tool calls. Please fix the schema violations and try again.`,
          steps,
          tokensUsed
        };
      }

      // Classify risk level and record valid tool call
      const riskLevel = classifyToolRisk(toolName, params);
      recordToolCallValid(riskLevel);

      // ==================== LOOP DETECTION (PHASE 0) ====================
      // Simple loop detection: same tool name called too often
      recentToolCalls.push(toolName);
      if (recentToolCalls.length > 5) recentToolCalls.shift();

      const sameToolCount = recentToolCalls.filter(t => t === toolName).length;
      if (sameToolCount >= 3) {
        console.log(`⚠️ Simple loop detected: ${toolName} called ${sameToolCount} times recently`);
        // Don't fail yet - proceed to check operational loop
      }

      steps.push({
        type: 'action',
        content: `${toolName}(${JSON.stringify(params)})`,
        toolName,
        toolParams: params,
        timestamp: new Date().toISOString()
      });
      console.log(`🔧 ${toolName}(${JSON.stringify(params).slice(0, 60)}${JSON.stringify(params).length > 60 ? '...' : ''})`);

      // Execute the tool
      const result = await tool.execute(params);

      // Record action in cognitive system
      cognitive.recordAction(
        `${toolName}(${JSON.stringify(params).slice(0, 50)})`,
        result.success ? result.output.slice(0, 100) : `Error: ${result.error}`,
        result.success
      );

      const observation = result.success
        ? result.output
        : `ERROR: ${result.error}`;

      steps.push({
        type: 'observation',
        content: observation,
        timestamp: new Date().toISOString()
      });

      // Show truncated observation
      const displayObs = observation.slice(0, 200);
      console.log(`👁 ${displayObs}${observation.length > 200 ? '...' : ''}`);

      // ==================== OPERATIONAL LOOP DETECTION (PHASE 0) ====================
      // ERR_LOOP_OPERATIONAL: Same tool + same params + same outcome = stuck
      // Using PERSISTENT history (metrics_v2)
      const paramsKey = JSON.stringify(params);
      const outcomeKey = result.success ? 'SUCCESS' : `ERROR:${result.error?.slice(0, 50)}`;

      // Record this call in persistent history
      recordToolCallInLoopHistory(toolName, paramsKey, outcomeKey);

      // Check for operational loops (persistent across invocations)
      if (checkForOperationalLoop(toolName, paramsKey, outcomeKey)) {
        const errorMsg = `ERR_LOOP_OPERATIONAL: Operational loop detected.\n\nTool '${toolName}' with identical parameters and outcome has been called 3+ times:\n\nParameters: ${paramsKey.slice(0, 200)}${paramsKey.length > 200 ? '...' : ''}\nOutcome: ${outcomeKey}\n\nThe system is stuck in a deterministic loop. This indicates:\n- The approach is fundamentally flawed\n- The tool cannot accomplish the desired outcome with these parameters\n- A different strategy is required\n\nExecution terminated to prevent infinite loops.`;

        console.log(`\n🛑 ${errorMsg}\n`);
        console.log('━'.repeat(50));
        console.log('❌ EXECUTION TERMINATED: Operational loop');
        console.log('━'.repeat(50));

        // Record loop detection in metrics
        recordLoopDetection();

        return {
          success: false,
          answer: errorMsg,
          steps,
          tokensUsed
        };
      }

      // Add to conversation
      messages.push(
        { role: 'assistant', content: response.content },
        { role: 'user', content: `<observation>\n${observation}\n</observation>\n\nContinue with the next step or provide your final <answer> if the task is complete.` }
      );
    } else if (!parsed.answer) {
      // No action and no answer - nudge the model
      console.log(`⚠️ No action taken, prompting...`);

      messages.push(
        { role: 'assistant', content: response.content },
        { role: 'user', content: `You must either:\n1. Use a tool with <action> tags\n2. Provide your final <answer>\n\nPlease proceed.` }
      );
    }
  }

  // Max iterations reached
  console.log(`\n⚠️ Max iterations reached`);
  console.log('━'.repeat(50));

  return {
    success: false,
    answer: 'I was unable to complete the task within the allowed steps. Please try breaking it into smaller parts.',
    steps,
    tokensUsed
  };
}

// ============================================================================
// PUBLIC API
// ============================================================================

export async function runAgent(
  input: string,
  conversationHistory?: Array<{ role: string; content: string }>
): Promise<string> {
  try {
    const result = await executeAgent(input, 15, conversationHistory);

    // Save successful completions to memory
    if (result.success) {
      const memory = getMemory();
      memory.addInsight(
        `Completed task: ${input.slice(0, 100)}`,
        'agent',
        'pattern',
        0.7
      );
    }

    // Track action in exploration system (safe action by default)
    const { recordAction } = await import('./exploration');
    recordAction('safe');

    return result.answer;
  } catch (error: any) {
    console.error('Agent error:', error);

    // Track failed action
    const { recordAction } = await import('./exploration');
    recordAction('safe');

    return `An error occurred: ${error.message}. Please try again.`;
  }
}

export function requiresAgent(input: string): boolean {
  const patterns = [
    /\b(cerca|search|find|look\s*up|google)\b/i,
    /\b(leggi|read|show|open|cat|view)\s+(file|il|the|a)?\s*\w+/i,
    /\b(scrivi|write|create|save|make)\s+(file|a|il|the)?\s*\w+/i,
    /\b(esegui|run|execute|launch)\b/i,
    /\b(fetch|scarica|download|get)\s+(url|http|from)/i,
    /\b(git|commit|push|pull|clone)\b/i,
    /\b(npm|yarn|pnpm|node)\b/i,
    /\b(compila|compile|build|test)\b/i,
    /\b(fai|do|make|procedi|proceed)\b/i,
    /\.(js|ts|json|md|py|go|rs|java|html|css)(\s|$)/i,
    /package\.json|tsconfig|\.env/i,
  ];

  return patterns.some(p => p.test(input));
}
