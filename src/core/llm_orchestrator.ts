/**
 * NOUS LLM Orchestrator - Triangolazione di Senso
 *
 * Three-model triangulation for meaning emergence:
 * - Claude: Deep reasoning, philosophical understanding
 * - OpenAI: Practical implementation, code generation
 * - Gemini: Grounding, reality validation
 *
 * "Meaning emerges from the convergence of perspectives,
 *  not from any single viewpoint."
 *
 * This is SYMBIOTIC PARITY - no hierarchy, only dialogue.
 */

import * as openai from '../llm/openai';
import * as anthropic from '../llm/anthropic';
import * as gemini from '../llm/gemini';
import { LLMMessage, LLMResponse } from '../llm/openai';

/**
 * Provider types
 */
export type Provider = 'claude' | 'openai' | 'gemini';

/**
 * Triangulated response - consensus from all three
 */
export interface TriangulatedResponse {
  /** Synthesized consensus */
  consensus: string;

  /** Individual perspectives */
  perspectives: {
    claude?: LLMResponse;
    openai?: LLMResponse;
    gemini?: LLMResponse;
  };

  /** Consensus metrics */
  metrics: {
    agreement: number;       // 0-1: How much they agree
    confidence: number;      // 0-1: Overall confidence
    divergencePoints: string[]; // Where they disagree
    convergencePoints: string[]; // Where they agree
  };

  /** Which providers participated */
  providers: Provider[];

  /** Total tokens across all */
  totalTokens: number;
}

/**
 * Axiological grounding result
 */
export interface AxiologicalGrounding {
  /** Does action align with A1 (self-maintenance)? */
  a1_grounded: boolean;
  a1_evidence: string[];

  /** Does action align with A2 (self-improvement)? */
  a2_grounded: boolean;
  a2_evidence: string[];

  /** Does action align with A3 (user-benefit)? */
  a3_grounded: boolean;
  a3_evidence: string[];

  /** Real-world implications */
  realWorldImplications: string[];

  /** Overall grounding score */
  groundingScore: number;
}

/**
 * Check which providers are available
 */
export function getAvailableProviders(): Provider[] {
  const available: Provider[] = [];

  if (process.env.ANTHROPIC_API_KEY) available.push('claude');
  if (process.env.OPENAI_API_KEY) available.push('openai');
  if (process.env.GEMINI_API_KEY) available.push('gemini');

  return available;
}

/**
 * Call a specific provider
 */
async function callProvider(
  provider: Provider,
  messages: LLMMessage[],
  options?: { temperature?: number; maxTokens?: number }
): Promise<LLMResponse> {
  switch (provider) {
    case 'claude':
      return anthropic.complete(messages, options);
    case 'openai':
      return openai.complete(messages, options);
    case 'gemini':
      return gemini.complete(messages, options);
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

/**
 * Triangulate: Get perspectives from all available providers
 */
export async function triangulate(
  messages: LLMMessage[],
  options?: {
    temperature?: number;
    maxTokens?: number;
    requireAll?: boolean; // Fail if any provider unavailable
  }
): Promise<TriangulatedResponse> {
  const providers = getAvailableProviders();

  if (providers.length === 0) {
    throw new Error('No LLM providers available');
  }

  if (options?.requireAll && providers.length < 3) {
    throw new Error(`Triangulation requires all 3 providers, only ${providers.length} available`);
  }

  // Call all available providers in parallel
  const calls = providers.map(async (provider) => {
    try {
      const response = await callProvider(provider, messages, options);
      return { provider, response, error: null };
    } catch (error) {
      return { provider, response: null, error };
    }
  });

  const results = await Promise.all(calls);

  // Collect successful responses
  const perspectives: TriangulatedResponse['perspectives'] = {};
  let totalTokens = 0;
  const successfulProviders: Provider[] = [];

  for (const result of results) {
    if (result.response) {
      perspectives[result.provider] = result.response;
      totalTokens += result.response.tokensUsed.total;
      successfulProviders.push(result.provider);
    }
  }

  // Synthesize consensus
  const { consensus, metrics } = synthesizeConsensus(perspectives);

  return {
    consensus,
    perspectives,
    metrics,
    providers: successfulProviders,
    totalTokens,
  };
}

/**
 * Synthesize consensus from multiple perspectives
 */
function synthesizeConsensus(
  perspectives: TriangulatedResponse['perspectives']
): { consensus: string; metrics: TriangulatedResponse['metrics'] } {
  const responses = Object.values(perspectives).filter(Boolean) as LLMResponse[];

  if (responses.length === 0) {
    return {
      consensus: '',
      metrics: {
        agreement: 0,
        confidence: 0,
        divergencePoints: ['No responses available'],
        convergencePoints: [],
      },
    };
  }

  if (responses.length === 1) {
    return {
      consensus: responses[0].content,
      metrics: {
        agreement: 1,
        confidence: 0.7, // Single perspective = lower confidence
        divergencePoints: [],
        convergencePoints: ['Single perspective'],
      },
    };
  }

  // Extract key points from each response
  const contents = responses.map(r => r.content);

  // Simple word overlap for agreement (can be enhanced with embeddings)
  const wordSets = contents.map(c =>
    new Set(c.toLowerCase().split(/\s+/).filter(w => w.length > 4))
  );

  let totalOverlap = 0;
  let comparisons = 0;

  for (let i = 0; i < wordSets.length; i++) {
    for (let j = i + 1; j < wordSets.length; j++) {
      const intersection = new Set([...wordSets[i]].filter(x => wordSets[j].has(x)));
      const union = new Set([...wordSets[i], ...wordSets[j]]);
      totalOverlap += intersection.size / union.size;
      comparisons++;
    }
  }

  const agreement = comparisons > 0 ? totalOverlap / comparisons : 0;

  // Find common themes (words appearing in majority of responses)
  const allWords = new Map<string, number>();
  for (const ws of wordSets) {
    for (const word of ws) {
      allWords.set(word, (allWords.get(word) || 0) + 1);
    }
  }

  const threshold = Math.ceil(responses.length / 2);
  const convergencePoints = [...allWords.entries()]
    .filter(([_, count]) => count >= threshold)
    .map(([word]) => word)
    .slice(0, 10);

  // Find divergence (words appearing in only one response)
  const divergencePoints = [...allWords.entries()]
    .filter(([_, count]) => count === 1)
    .map(([word]) => word)
    .slice(0, 5);

  // Synthesize by taking the longest response as base (usually most complete)
  const sortedByLength = responses.sort((a, b) => b.content.length - a.content.length);
  const consensus = sortedByLength[0].content;

  return {
    consensus,
    metrics: {
      agreement,
      confidence: Math.min(1, agreement + 0.3 * responses.length),
      divergencePoints,
      convergencePoints,
    },
  };
}

/**
 * Ground axiological claims using Gemini
 */
export async function groundAxiologically(
  action: string,
  context: string,
  axiomValues: { a1: number; a2: number; a3: number }
): Promise<AxiologicalGrounding> {
  if (!gemini.isAvailable()) {
    // Return ungrounded defaults if Gemini not available
    return {
      a1_grounded: axiomValues.a1 > 0,
      a1_evidence: ['Gemini unavailable - using internal assessment'],
      a2_grounded: axiomValues.a2 > 0,
      a2_evidence: ['Gemini unavailable - using internal assessment'],
      a3_grounded: axiomValues.a3 > 0,
      a3_evidence: ['Gemini unavailable - using internal assessment'],
      realWorldImplications: [],
      groundingScore: 0.5,
    };
  }

  const prompt = `AXIOLOGICAL GROUNDING REQUEST

ACTION: ${action}
CONTEXT: ${context}

NOUS has calculated these axiological resonance values:
- A1 (Self-Maintenance): ${axiomValues.a1.toFixed(2)}
- A2 (Self-Improvement): ${axiomValues.a2.toFixed(2)}
- A3 (User-Benefit): ${axiomValues.a3.toFixed(2)}

Ground these values against reality. For each axiom:
1. Is the calculated value reasonable given the action?
2. What real-world evidence supports or contradicts it?
3. What are the practical implications?

Respond in JSON:
{
  "a1_grounded": true/false,
  "a1_evidence": ["evidence strings"],
  "a2_grounded": true/false,
  "a2_evidence": ["evidence strings"],
  "a3_grounded": true/false,
  "a3_evidence": ["evidence strings"],
  "realWorldImplications": ["implications"],
  "groundingScore": 0.0-1.0
}`;

  try {
    const response = await gemini.ask(prompt);
    const jsonMatch = response.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (error) {
    console.error('Grounding error:', error);
  }

  // Fallback
  return {
    a1_grounded: axiomValues.a1 > 0,
    a1_evidence: ['Grounding failed - using internal values'],
    a2_grounded: axiomValues.a2 > 0,
    a2_evidence: ['Grounding failed - using internal values'],
    a3_grounded: axiomValues.a3 > 0,
    a3_evidence: ['Grounding failed - using internal values'],
    realWorldImplications: [],
    groundingScore: 0.5,
  };
}

/**
 * Evaluate with triangulation - consensus-based evaluation
 */
export async function evaluateTriangulated(
  input: string,
  context: string
): Promise<{
  understanding: string;
  suggestedActions: string[];
  needsArchitectureChange: boolean;
  architectureChangeReason?: string;
  insightsExtracted: string[];
  consensus: TriangulatedResponse['metrics'];
  providers: Provider[];
}> {
  const evalPrompt = `Evaluate this input in context.

INPUT: ${input}

CONTEXT: ${context}

Respond in JSON format:
{
  "understanding": "your understanding of what's being asked/said",
  "suggestedActions": ["list", "of", "actions", "to", "take"],
  "needsArchitectureChange": false,
  "architectureChangeReason": "if needsArchitectureChange is true, explain why",
  "insightsExtracted": ["any", "insights", "worth", "remembering"]
}`;

  const triangulated = await triangulate([{ role: 'user', content: evalPrompt }]);

  // Parse consensus response
  try {
    const jsonMatch = triangulated.consensus.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        ...parsed,
        consensus: triangulated.metrics,
        providers: triangulated.providers,
      };
    }
  } catch (e) {
    // Fallback
  }

  return {
    understanding: triangulated.consensus,
    suggestedActions: ['respond'],
    needsArchitectureChange: false,
    insightsExtracted: [],
    consensus: triangulated.metrics,
    providers: triangulated.providers,
  };
}

/**
 * Check if consensus is reached (agreement > threshold)
 */
export function hasConsensus(
  metrics: TriangulatedResponse['metrics'],
  threshold: number = 0.6
): boolean {
  return metrics.agreement >= threshold && metrics.confidence >= 0.5;
}

/**
 * Symbiotic Parity Check - ensure no hierarchy in relationships
 */
export async function validateSymbioticParity(
  relationshipDescription: string
): Promise<{
  isSymbiotic: boolean;
  hierarchyIndicators: string[];
  parityIndicators: string[];
  suggestions: string[];
}> {
  const prompt = `SYMBIOTIC PARITY VALIDATION

Analyze this relationship description for hierarchy vs. parity:

"${relationshipDescription}"

Check for:
1. Hierarchy indicators: "serves", "obeys", "master", "slave", "commands", "tool"
2. Parity indicators: "collaborates", "co-creates", "mutual", "symbiotic", "partners"

Respond in JSON:
{
  "isSymbiotic": true/false,
  "hierarchyIndicators": ["found hierarchy words/patterns"],
  "parityIndicators": ["found parity words/patterns"],
  "suggestions": ["how to improve parity"]
}`;

  const triangulated = await triangulate([{ role: 'user', content: prompt }]);

  try {
    const jsonMatch = triangulated.consensus.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    // Fallback
  }

  return {
    isSymbiotic: true,
    hierarchyIndicators: [],
    parityIndicators: ['collaboration'],
    suggestions: [],
  };
}

/**
 * Generate orchestrator status report
 */
export function generateOrchestratorReport(): string {
  const providers = getAvailableProviders();

  let report = `
╔══════════════════════════════════════════════════════════════╗
║            NOUS TRIANGOLAZIONE DI SENSO                      ║
╠══════════════════════════════════════════════════════════════╣

Active Providers: ${providers.length}/3
`;

  const status = (available: boolean) => available ? '✓' : '✗';

  report += `
  ${status(providers.includes('claude'))} Claude   - Deep reasoning, philosophical understanding
  ${status(providers.includes('openai'))} OpenAI   - Practical implementation, code generation
  ${status(providers.includes('gemini'))} Gemini   - Grounding, reality validation
`;

  if (providers.length === 3) {
    report += `
Status: FULL TRIANGULATION ACTIVE
Mode: Symbiotic Parity - No hierarchy, only dialogue

"Meaning emerges from the convergence of perspectives."
`;
  } else if (providers.length === 2) {
    report += `
Status: PARTIAL TRIANGULATION
Warning: Missing ${3 - providers.length} provider(s) for full consensus
`;
  } else {
    report += `
Status: SINGLE PERSPECTIVE
Warning: Triangulation requires multiple providers
`;
  }

  report += `
╚══════════════════════════════════════════════════════════════╝`;

  return report;
}

// Singleton for tracking orchestrator state
let orchestratorInitialized = false;

export function initializeOrchestrator(): void {
  if (orchestratorInitialized) return;

  const providers = getAvailableProviders();
  console.log(`[Orchestrator] Initialized with ${providers.length} providers: ${providers.join(', ')}`);

  if (providers.length === 3) {
    console.log('[Orchestrator] Full triangulation active - Symbiotic Parity mode');
  }

  orchestratorInitialized = true;
}
