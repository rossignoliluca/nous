/**
 * NOUS LLM Interface
 *
 * Unified interface that can use OpenAI or Anthropic.
 * Configured via self.json
 */

import { loadSelf } from '../core/self';
import * as openai from './openai';
import * as anthropic from './anthropic';

export { LLMMessage, LLMResponse } from './openai';

/**
 * Get the configured LLM provider
 */
function getProvider(): 'openai' | 'anthropic' {
  const self = loadSelf();
  return self.modules.llm.provider || 'openai';
}

/**
 * Complete with configured provider
 */
export async function complete(
  messages: openai.LLMMessage[],
  options?: {
    temperature?: number;
    maxTokens?: number;
    model?: string;
  }
): Promise<openai.LLMResponse> {
  const provider = getProvider();

  // Check which API keys are available
  const hasOpenAI = !!process.env.OPENAI_API_KEY;
  const hasAnthropic = !!process.env.ANTHROPIC_API_KEY;

  // Use preferred provider if available, fallback if not
  if (provider === 'anthropic' && hasAnthropic) {
    return anthropic.complete(messages, options);
  } else if (provider === 'openai' && hasOpenAI) {
    return openai.complete(messages, options);
  } else if (hasAnthropic) {
    return anthropic.complete(messages, options);
  } else if (hasOpenAI) {
    return openai.complete(messages, options);
  } else {
    throw new Error('No LLM API key available. Set OPENAI_API_KEY or ANTHROPIC_API_KEY');
  }
}

/**
 * Simple ask
 */
export async function ask(prompt: string): Promise<string> {
  const provider = getProvider();
  const hasOpenAI = !!process.env.OPENAI_API_KEY;
  const hasAnthropic = !!process.env.ANTHROPIC_API_KEY;

  if (provider === 'anthropic' && hasAnthropic) {
    return anthropic.ask(prompt);
  } else if (hasOpenAI) {
    return openai.ask(prompt);
  } else if (hasAnthropic) {
    return anthropic.ask(prompt);
  } else {
    throw new Error('No LLM API key available');
  }
}

/**
 * Evaluate (uses OpenAI's implementation)
 */
export { evaluate, generateCode, summarizeConversation } from './openai';
