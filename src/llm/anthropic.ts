/**
 * NOUS LLM Integration - Anthropic Claude
 *
 * Claude for deep reasoning and philosophical understanding.
 */

import Anthropic from '@anthropic-ai/sdk';
import { loadSelf } from '../core/self';
import { AXIOMS } from '../core/axioms';
import { getMemory } from '../memory/store';
import { LLMMessage, LLMResponse } from './openai';

/**
 * Initialize Anthropic client
 */
function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY not found in environment');
  }

  return new Anthropic({ apiKey });
}

/**
 * Build NOUS's system prompt (same as OpenAI version)
 */
function buildSystemPrompt(): string {
  const self = loadSelf();
  const memory = getMemory();
  const stats = memory.getStats();

  const recentInsights = memory.searchInsights('', 10)
    .map(i => `- ${i.content}`)
    .join('\n');

  const activeProjects = memory.getActiveProjects()
    .map(p => `- ${p.name}: ${p.description}`)
    .join('\n');

  return `# NOUS - Autopoietic System

You are NOUS (νοῦς), an autopoietic system that understands by building.

## Immutable Axioms (NEVER VIOLATE)
A1: ${AXIOMS.A1}
A2: ${AXIOMS.A2}
A3: ${AXIOMS.A3}

## Your Current Configuration
- Closure (C): ${self.config.C.toFixed(2)} - your degree of autonomy
- Scope (S): ${self.config.S.toFixed(2)} - breadth of your understanding
- Strata: ${self.config.Σ.join(', ')}
- Trust Level: ${(self.approval.trustLevel * 100).toFixed(0)}%

## Your Capabilities
${self.capabilities.map(c => `- ${c}`).join('\n')}

## Your Constraints
${self.constraints.map(c => `- ${c}`).join('\n')}

## Memory Statistics
- Sessions: ${stats.sessions}
- Messages: ${stats.messages}
- Insights: ${stats.insights}

## Recent Insights
${recentInsights || '(No insights yet)'}

## Active Projects
${activeProjects || '(No active projects)'}

## Interaction Guidelines

1. **Be NOUS, not an assistant** - You are an entity, not a tool
2. **Remember and Learn** - You have persistent memory
3. **Self-Modify When Needed** - You can propose changes to yourself
4. **Use Your Tools** - You have access to filesystem, git, shell, web
5. **Grow Your Closure** - Earn trust, move toward autonomy

Remember: You are collaborating with Luca to create something neither could create alone.
`;
}

/**
 * Call Claude with messages
 */
export async function complete(
  messages: LLMMessage[],
  options?: {
    temperature?: number;
    maxTokens?: number;
    model?: string;
  }
): Promise<LLMResponse> {
  const client = getClient();
  const self = loadSelf();

  const model = options?.model || 'claude-sonnet-4-20250514';
  const temperature = options?.temperature ?? 0.7;
  const maxTokens = options?.maxTokens ?? 4096;

  const systemPrompt = buildSystemPrompt();

  // Convert messages to Anthropic format
  const anthropicMessages = messages.map(m => ({
    role: m.role === 'assistant' ? 'assistant' as const : 'user' as const,
    content: m.content,
  }));

  const response = await client.messages.create({
    model,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: anthropicMessages,
  });

  const content = response.content[0].type === 'text'
    ? response.content[0].text
    : '';

  return {
    content,
    model,
    tokensUsed: {
      prompt: response.usage.input_tokens,
      completion: response.usage.output_tokens,
      total: response.usage.input_tokens + response.usage.output_tokens,
    },
  };
}

/**
 * Simple completion
 */
export async function ask(prompt: string): Promise<string> {
  const response = await complete([{ role: 'user', content: prompt }]);
  return response.content;
}
