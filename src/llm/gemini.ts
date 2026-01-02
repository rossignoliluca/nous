/**
 * NOUS LLM Integration - Google Gemini
 *
 * Gemini 2.0 Flash: Fast grounding and reality validation.
 *
 * OPTIMIZED FOR:
 * - Quick reality checks (low latency)
 * - Fact validation
 * - Grounding abstract reasoning
 * - Web-connected knowledge (when available)
 *
 * NOT IDEAL FOR:
 * - Deep philosophical reasoning (use Claude)
 * - Code generation (use OpenAI)
 */

import { LLMMessage, LLMResponse } from './openai';

/**
 * Gemini API response structure
 */
interface GeminiResponse {
  candidates: Array<{
    content: {
      parts: Array<{ text: string }>;
    };
    finishReason: string;
  }>;
  usageMetadata?: {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
  };
}

/**
 * Simple cache for repeated queries
 */
const groundingCache = new Map<string, {
  result: GroundingResult;
  timestamp: number;
}>();

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Grounding result structure
 */
export interface GroundingResult {
  grounded: boolean;
  confidence: number;
  realWorldEvidence: string[];
  corrections: string[];
  implications: string[];
}

/**
 * Get Gemini API key
 */
function getApiKey(): string {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY not found in environment');
  }
  return apiKey;
}

/**
 * Gemini models optimized for different tasks
 */
export const GEMINI_MODELS = {
  FLASH: 'gemini-2.0-flash-exp',      // Fast, cheap - use for grounding
  PRO: 'gemini-1.5-pro',              // More capable - use for complex analysis
} as const;

/**
 * Call Gemini API - optimized for speed
 */
export async function complete(
  messages: LLMMessage[],
  options?: {
    temperature?: number;
    maxTokens?: number;
    model?: string;
    systemInstruction?: string;
  }
): Promise<LLMResponse> {
  const apiKey = getApiKey();
  const model = options?.model || GEMINI_MODELS.FLASH;
  const temperature = options?.temperature ?? 0.3; // Lower temp for grounding
  const maxTokens = options?.maxTokens ?? 1024;    // Shorter responses

  // Convert messages to Gemini format
  const contents = messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const body: Record<string, unknown> = {
    contents,
    generationConfig: {
      temperature,
      maxOutputTokens: maxTokens,
    },
  };

  // Add system instruction if provided
  if (options?.systemInstruction) {
    body.systemInstruction = {
      parts: [{ text: options.systemInstruction }],
    };
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${error}`);
  }

  const data = await response.json() as GeminiResponse;

  const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const usage = data.usageMetadata;

  return {
    content,
    model,
    tokensUsed: {
      prompt: usage?.promptTokenCount || 0,
      completion: usage?.candidatesTokenCount || 0,
      total: usage?.totalTokenCount || 0,
    },
  };
}

/**
 * Simple ask - optimized for quick responses
 */
export async function ask(
  prompt: string,
  systemInstruction?: string
): Promise<string> {
  const response = await complete(
    [{ role: 'user', content: prompt }],
    { systemInstruction, maxTokens: 512 }
  );
  return response.content;
}

/**
 * Ground a claim against reality - CACHED
 */
export async function ground(
  claim: string,
  context: string
): Promise<GroundingResult> {
  const cacheKey = `${claim}::${context}`.slice(0, 200);

  // Check cache
  const cached = groundingCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.result;
  }

  const systemInstruction = `You are a reality-grounding system.
Your job: Validate claims against real-world knowledge.
Be concise. Be factual. No speculation.
Always respond in valid JSON.`;

  const prompt = `GROUND THIS CLAIM:
"${claim}"

CONTEXT: ${context}

Respond ONLY with JSON:
{"grounded":true/false,"confidence":0.0-1.0,"realWorldEvidence":["facts"],"corrections":["if any"],"implications":["practical"]}`;

  try {
    const response = await ask(prompt, systemInstruction);
    const jsonMatch = response.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]) as GroundingResult;

      // Cache the result
      groundingCache.set(cacheKey, { result, timestamp: Date.now() });

      // Clean old cache entries
      if (groundingCache.size > 100) {
        const now = Date.now();
        for (const [key, value] of groundingCache.entries()) {
          if (now - value.timestamp > CACHE_TTL) {
            groundingCache.delete(key);
          }
        }
      }

      return result;
    }
  } catch (e) {
    // Fallback on error
  }

  return {
    grounded: true,
    confidence: 0.5,
    realWorldEvidence: [],
    corrections: [],
    implications: [],
  };
}

/**
 * Quick fact check - optimized for speed
 */
export async function factCheck(statement: string): Promise<{
  accurate: boolean;
  confidence: number;
  correction?: string;
}> {
  const systemInstruction = `You are a fact checker. Be brief. Respond only in JSON.`;

  const prompt = `Is this accurate? "${statement}"
{"accurate":true/false,"confidence":0.0-1.0,"correction":"if needed"}`;

  try {
    const response = await ask(prompt, systemInstruction);
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    // Fallback
  }

  return { accurate: true, confidence: 0.5 };
}

/**
 * Reality check for NOUS's self-assessments
 */
export async function realityCheckSelf(
  claim: string,
  selfAssessment: number
): Promise<{
  realistic: boolean;
  adjustment: number;
  reasoning: string;
}> {
  const systemInstruction = `You evaluate AI self-assessments for realism.
Be skeptical of high self-ratings. Be concise.`;

  const prompt = `AI system claims: "${claim}"
Self-assessment score: ${(selfAssessment * 100).toFixed(0)}%

Is this realistic? Respond in JSON:
{"realistic":true/false,"adjustment":-0.3 to +0.3,"reasoning":"brief"}`;

  try {
    const response = await ask(prompt, systemInstruction);
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    // Fallback
  }

  return {
    realistic: true,
    adjustment: 0,
    reasoning: 'Unable to verify',
  };
}

/**
 * Check if Gemini is available
 */
export function isAvailable(): boolean {
  return !!process.env.GEMINI_API_KEY;
}

/**
 * Clear the grounding cache
 */
export function clearCache(): void {
  groundingCache.clear();
}

/**
 * Get cache stats
 */
export function getCacheStats(): { size: number; oldestEntry: number | null } {
  let oldest: number | null = null;
  for (const value of groundingCache.values()) {
    if (oldest === null || value.timestamp < oldest) {
      oldest = value.timestamp;
    }
  }
  return { size: groundingCache.size, oldestEntry: oldest };
}
