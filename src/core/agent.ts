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

// ============================================================================
// TYPES
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
    description: 'Write content to a file. Creates the file if it does not exist.',
    parameters: [
      { name: 'path', type: 'string', description: 'Path to the file', required: true },
      { name: 'content', type: 'string', description: 'Content to write', required: true }
    ],
    execute: async (params) => {
      try {
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
  const recentToolCalls: string[] = []; // Track recent tool calls to detect loops

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

      // Validate required parameters
      const missingParams = tool.parameters
        .filter(p => p.required && (params[p.name] === undefined || params[p.name] === null || params[p.name] === ''))
        .map(p => p.name);

      if (missingParams.length > 0) {
        const errorMsg = `Missing required parameters for ${toolName}: ${missingParams.join(', ')}. Required: ${tool.parameters.filter(p => p.required).map(p => `${p.name} (${p.description})`).join(', ')}`;
        console.log(`❌ ${errorMsg}`);

        messages.push(
          { role: 'assistant', content: response.content },
          { role: 'user', content: `<observation><error>${errorMsg}</error></observation>\n\nPlease provide ALL required parameters in the <params> JSON.` }
        );
        continue;
      }

      // Detect looping - same tool called 3+ times in last 5 calls
      recentToolCalls.push(toolName);
      if (recentToolCalls.length > 5) recentToolCalls.shift();

      const sameToolCount = recentToolCalls.filter(t => t === toolName).length;
      if (sameToolCount >= 3) {
        console.log(`⚠️ Loop detected: ${toolName} called ${sameToolCount} times`);
        messages.push(
          { role: 'assistant', content: response.content },
          { role: 'user', content: `<observation><warning>You are repeating the same tool (${toolName}) without progress. Either:\n1. Use a DIFFERENT tool\n2. Take a different approach\n3. Provide your final <answer> with what you've learned so far\n\nDo NOT call ${toolName} again.</warning></observation>` }
        );
        continue;
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

    return result.answer;
  } catch (error: any) {
    console.error('Agent error:', error);
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
