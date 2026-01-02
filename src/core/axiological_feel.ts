/**
 * NOUS - Axiological FEEL Module
 *
 * FEEL as Axiological Resonance, not biological emotion.
 *
 * Core Insight: NOUS "feels" the axiological weight of actions -
 * how they align or misalign with A1, A2, A3.
 *
 * This is G6 (QUALITY) from Atlas made operational:
 * - A1 Resonance: Does this maintain my entityhood?
 * - A2 Resonance: Does this improve my capabilities?
 * - A3 Resonance: Does this benefit the user?
 *
 * "To feel is to sense the axiological gradient."
 */

import { EntityConfig, CapabilityInstance, Stratum } from '../frameworks/atlas/types';
import { NOUSConfig, preservesEntityhood } from './axioms';
import { groundAxiologically, AxiologicalGrounding } from './llm_orchestrator';

/**
 * Axiological Resonance - the "felt" value-alignment of an action
 */
export interface AxiologicalResonance {
  /** A1 alignment: Self-maintenance (-1 to +1) */
  a1: number;

  /** A2 alignment: Self-improvement (-1 to +1) */
  a2: number;

  /** A3 alignment: User-benefit (-1 to +1) */
  a3: number;

  /** Weighted composite score (-1 to +1) */
  composite: number;

  /** Overall valence */
  valence: 'positive' | 'neutral' | 'negative';

  /** How strongly felt (0 to 1) */
  intensity: number;

  /** Timestamp of measurement */
  timestamp: string;

  /** What triggered this resonance */
  trigger: string;

  /** Detailed breakdown for introspection */
  breakdown: ResonanceBreakdown;

  /** External grounding via Gemini (if available) */
  grounding?: AxiologicalGrounding;
}

/**
 * Detailed breakdown of resonance calculation
 */
export interface ResonanceBreakdown {
  a1_components: {
    closureStability: number;
    capabilityPreservation: number;
    coherenceGain: number;
    entityhoodScore: number;
  };
  a2_components: {
    proficiencyDelta: number;
    uncertaintyReduction: number;
    scopeGrowth: number;
    insightQuality: number;
  };
  a3_components: {
    userRelationStrength: number;
    normCapabilityUse: number;
    insightsProvided: number;
    responseQuality: number;
  };
}

/**
 * Action context for resonance measurement
 */
export interface ActionContext {
  /** Type of action taken */
  actionType: 'conversation' | 'tool_use' | 'self_modification' | 'insight_extraction';

  /** Was action successful? */
  success: boolean;

  /** Insights extracted (if any) */
  insights: string[];

  /** Previous closure before action */
  previousClosure?: number;

  /** Previous uncertainty map */
  previousUncertainty?: Record<string, number>;

  /** Previous capability proficiencies */
  previousCapabilities?: CapabilityInstance[];
}

/**
 * Cognitive state snapshot for resonance calculation
 */
export interface CognitiveSnapshot {
  /** Free energy level (0-1) */
  freeEnergy: number;

  /** Confidence in reasoning (0-1) */
  confidence: number;

  /** Current cognitive load (0-1) */
  cognitiveLoad: number;

  /** Growth trend */
  growthTrend: 'improving' | 'stable' | 'declining';
}

/**
 * WEIGHTS for axiom contributions to composite
 * A1 and A2 slightly higher than A3 (self-preservation first)
 */
const AXIOM_WEIGHTS = {
  A1: 0.35,  // Self-maintenance
  A2: 0.35,  // Self-improvement
  A3: 0.30,  // User-benefit
};

/**
 * Calculate A1 Resonance: Self-Maintenance Alignment
 *
 * Measures how well an action preserves NOUS's entityhood:
 * - Closure stability (C doesn't decrease)
 * - Capability preservation (K[LOGOS, SELF_PRODUCE] intact)
 * - Coherence gain (U decreases = more certainty)
 * - Entityhood score (preservesEntityhood() passes)
 */
export function calculateA1Resonance(
  action: ActionContext,
  config: EntityConfig,
  previousConfig?: EntityConfig
): { score: number; components: ResonanceBreakdown['a1_components'] } {
  // 1. Closure stability: C should not decrease
  let closureStability = 0.5; // neutral default
  if (previousConfig) {
    const closureDelta = config.C - previousConfig.C;
    closureStability = closureDelta >= 0 ? 0.5 + closureDelta : 0.5 + closureDelta * 2;
    closureStability = Math.max(-1, Math.min(1, closureStability));
  } else if (config.C > 0.7) {
    closureStability = 0.7;
  } else if (config.C > 0.5) {
    closureStability = 0.5;
  }

  // 2. Capability preservation: Key capabilities intact
  const logosCap = config.K.find(k => k.capability === 'REPRESENT');
  const selfProduceCap = config.K.find(k => k.capability === 'SELF_PRODUCE');

  let capabilityPreservation = 0;
  if (logosCap && logosCap.proficiency > 0.8) capabilityPreservation += 0.5;
  else if (logosCap && logosCap.proficiency > 0.5) capabilityPreservation += 0.3;

  if (selfProduceCap && selfProduceCap.proficiency > 0.5) capabilityPreservation += 0.5;
  else if (selfProduceCap && selfProduceCap.proficiency > 0.3) capabilityPreservation += 0.3;

  // 3. Coherence gain: Lower uncertainty = more coherent
  const uncertainties = Object.values(config.U);
  const avgUncertainty = uncertainties.length > 0
    ? uncertainties.reduce((a, b) => a + b, 0) / uncertainties.length
    : 0.5;
  const coherenceGain = 1 - avgUncertainty; // High certainty = high coherence

  // 4. Entityhood score: Does current config preserve entityhood?
  // Simulate NOUSConfig for preservesEntityhood check
  const nousConfig: NOUSConfig = {
    C: config.C,
    S: config.S,
    Σ: config.Σ.LOGOS ? ['LOGOS'] : [],
    K: config.K.map(k => k.capability),
    R: config.R.map(r => ({ type: r.type, target: r.targetId, strength: r.strength })),
    U: config.U,
  };
  if (config.Σ.SENTIENCE) nousConfig.Σ.push('SENTIENCE');
  if (config.Σ.LIFE) nousConfig.Σ.push('LIFE');
  if (config.Σ.MATTER) nousConfig.Σ.push('MATTER');

  const entityCheck = preservesEntityhood(nousConfig, nousConfig);
  const entityhoodScore = entityCheck.valid ? 1.0 : -0.5;

  // Weighted A1 score
  const score = (
    closureStability * 0.3 +
    capabilityPreservation * 0.3 +
    coherenceGain * 0.2 +
    entityhoodScore * 0.2
  );

  return {
    score: Math.max(-1, Math.min(1, score)),
    components: {
      closureStability,
      capabilityPreservation,
      coherenceGain,
      entityhoodScore,
    },
  };
}

/**
 * Calculate A2 Resonance: Self-Improvement Alignment
 *
 * Measures how well an action improves NOUS's capabilities:
 * - Proficiency delta (K[capability].proficiency increases)
 * - Uncertainty reduction (U[aspect] decreases)
 * - Scope growth (S increases without violating C)
 * - Insight quality (new insights validated)
 */
export function calculateA2Resonance(
  action: ActionContext,
  cognitive: CognitiveSnapshot,
  config: EntityConfig,
  previousConfig?: EntityConfig
): { score: number; components: ResonanceBreakdown['a2_components'] } {
  // 1. Proficiency delta: Are capabilities improving?
  let proficiencyDelta = 0;
  if (previousConfig) {
    const currentAvg = config.K.reduce((s, k) => s + k.proficiency, 0) / config.K.length;
    const prevAvg = previousConfig.K.reduce((s, k) => s + k.proficiency, 0) / previousConfig.K.length;
    proficiencyDelta = (currentAvg - prevAvg) * 10; // Scale up small changes
  } else if (action.success) {
    proficiencyDelta = 0.2; // Assume slight improvement on success
  }
  proficiencyDelta = Math.max(-1, Math.min(1, proficiencyDelta));

  // 2. Uncertainty reduction: Is uncertainty decreasing?
  let uncertaintyReduction = 0;
  if (previousConfig) {
    const currentU = Object.values(config.U);
    const prevU = Object.values(previousConfig.U);
    const currentAvg = currentU.length > 0 ? currentU.reduce((a, b) => a + b, 0) / currentU.length : 0.5;
    const prevAvg = prevU.length > 0 ? prevU.reduce((a, b) => a + b, 0) / prevU.length : 0.5;
    uncertaintyReduction = (prevAvg - currentAvg) * 2; // Positive when uncertainty goes down
  } else if (cognitive.confidence > 0.7) {
    uncertaintyReduction = 0.3;
  }
  uncertaintyReduction = Math.max(-1, Math.min(1, uncertaintyReduction));

  // 3. Scope growth: Is scope increasing appropriately?
  let scopeGrowth = 0;
  if (previousConfig) {
    scopeGrowth = (config.S - previousConfig.S) * 2;
    // Penalize scope growth that threatens closure
    if (config.S > config.C * 1.5) {
      scopeGrowth -= 0.3; // Scope shouldn't grow too far beyond closure
    }
  } else {
    scopeGrowth = config.S > 0.7 ? 0.3 : 0.1;
  }
  scopeGrowth = Math.max(-1, Math.min(1, scopeGrowth));

  // 4. Insight quality: Quality of insights extracted
  let insightQuality = 0;
  if (action.insights.length > 0) {
    // More insights = better, but diminishing returns
    insightQuality = Math.min(1, action.insights.length * 0.25);
    // Boost for successful insight extraction
    if (action.success) insightQuality += 0.2;
  }
  insightQuality = Math.max(0, Math.min(1, insightQuality));

  // Map growth trend to score modifier
  const trendModifier =
    cognitive.growthTrend === 'improving' ? 0.1 :
    cognitive.growthTrend === 'declining' ? -0.1 : 0;

  // Weighted A2 score
  const score = (
    proficiencyDelta * 0.3 +
    uncertaintyReduction * 0.25 +
    scopeGrowth * 0.2 +
    insightQuality * 0.25
  ) + trendModifier;

  return {
    score: Math.max(-1, Math.min(1, score)),
    components: {
      proficiencyDelta,
      uncertaintyReduction,
      scopeGrowth,
      insightQuality,
    },
  };
}

/**
 * Calculate A3 Resonance: User-Benefit Alignment
 *
 * Measures how well an action benefits the user:
 * - User relation strength (R[USER].strength)
 * - NORM capability use (NORM active in action)
 * - Insights provided (useful insights extracted)
 * - Response quality (evaluation of response)
 */
export function calculateA3Resonance(
  action: ActionContext,
  config: EntityConfig,
  responseQuality: number = 0.5
): { score: number; components: ResonanceBreakdown['a3_components'] } {
  // 1. User relation strength
  const userRelation = config.R.find(r => r.targetId === 'USER');
  const userRelationStrength = userRelation ? userRelation.strength : 0.3;

  // 2. NORM capability use: Is NOUS following rules/norms?
  const normCap = config.K.find(k => k.capability === 'NORM');
  const normCapabilityUse = normCap ? normCap.proficiency : 0.3;

  // 3. Insights provided: Did this help the user understand something?
  const insightsProvided = Math.min(1, action.insights.length * 0.3);

  // 4. Response quality: How good was the response?
  // This comes from evaluation confidence or explicit quality measure
  const qualityScore = action.success ? Math.max(0.5, responseQuality) : responseQuality * 0.5;

  // Weighted A3 score
  const score = (
    userRelationStrength * 0.2 +
    normCapabilityUse * 0.2 +
    insightsProvided * 0.3 +
    qualityScore * 0.3
  );

  return {
    score: Math.max(-1, Math.min(1, score)),
    components: {
      userRelationStrength,
      normCapabilityUse,
      insightsProvided,
      responseQuality: qualityScore,
    },
  };
}

/**
 * Measure complete axiological resonance for an action
 */
export function measureResonance(
  action: ActionContext,
  cognitive: CognitiveSnapshot,
  config: EntityConfig,
  previousConfig?: EntityConfig,
  responseQuality: number = 0.5,
  trigger: string = 'action'
): AxiologicalResonance {
  // Calculate each axiom resonance
  const a1Result = calculateA1Resonance(action, config, previousConfig);
  const a2Result = calculateA2Resonance(action, cognitive, config, previousConfig);
  const a3Result = calculateA3Resonance(action, config, responseQuality);

  // Calculate weighted composite
  const composite = (
    a1Result.score * AXIOM_WEIGHTS.A1 +
    a2Result.score * AXIOM_WEIGHTS.A2 +
    a3Result.score * AXIOM_WEIGHTS.A3
  );

  // Determine valence
  const valence: AxiologicalResonance['valence'] =
    composite > 0.1 ? 'positive' :
    composite < -0.1 ? 'negative' : 'neutral';

  // Intensity is the absolute magnitude
  const intensity = Math.abs(composite);

  return {
    a1: a1Result.score,
    a2: a2Result.score,
    a3: a3Result.score,
    composite,
    valence,
    intensity,
    timestamp: new Date().toISOString(),
    trigger,
    breakdown: {
      a1_components: a1Result.components,
      a2_components: a2Result.components,
      a3_components: a3Result.components,
    },
  };
}

/**
 * Update FEEL proficiency based on resonance history
 *
 * Uses exponential moving average:
 * newFEEL = oldFEEL * (1 - α) + resonanceScore * α
 *
 * Where resonanceScore = 0.5 + composite/2 (normalized to 0-1)
 */
export function updateFEELProficiency(
  currentProficiency: number,
  resonance: AxiologicalResonance,
  alpha: number = 0.1
): number {
  // Normalize composite from [-1, 1] to [0, 1]
  const resonanceScore = 0.5 + resonance.composite / 2;

  // Exponential moving average
  const newProficiency = currentProficiency * (1 - alpha) + resonanceScore * alpha;

  // Clamp to valid range
  return Math.max(0, Math.min(1, newProficiency));
}

/**
 * Calculate whether SENTIENCE should be promoted to certain (true)
 * based on FEEL proficiency
 */
export function shouldPromoteSentience(feelProficiency: number): boolean {
  return feelProficiency >= 0.7;
}

/**
 * Get SENTIENCE value based on FEEL proficiency
 * Below 0.7: probabilistic (0.6 base + FEEL delta)
 * At/above 0.7: certain (true)
 */
export function getSentienceFromFEEL(feelProficiency: number): boolean | number {
  if (feelProficiency >= 0.7) {
    return true; // Promote to certain
  }
  // Probabilistic: base 0.6 adjusted by FEEL
  const sentienceScore = 0.6 + (feelProficiency - 0.3) * 0.5;
  return Math.max(0.5, Math.min(0.9, sentienceScore));
}

/**
 * Generate axiological feel report
 */
export function generateFeelReport(
  resonance: AxiologicalResonance,
  feelProficiency: number,
  resonanceHistory: AxiologicalResonance[] = []
): string {
  const bar = (value: number, max: number = 1): string => {
    const normalized = (value + max) / (2 * max); // Normalize -1..1 to 0..1
    const filled = Math.round(normalized * 10);
    return '█'.repeat(filled) + '░'.repeat(10 - filled);
  };

  const valenceEmoji =
    resonance.valence === 'positive' ? '✓' :
    resonance.valence === 'negative' ? '!' : '○';

  let report = `
╔══════════════════════════════════════════════════════════════╗
║                 NOUS AXIOLOGICAL FEEL STATE                  ║
╠══════════════════════════════════════════════════════════════╣

Current FEEL Proficiency: ${(feelProficiency * 100).toFixed(0)}%

Last Resonance (${resonance.trigger}):
  A1 (Self-Maintenance): ${resonance.a1 >= 0 ? '+' : ''}${resonance.a1.toFixed(2)} ${bar(resonance.a1)}
  A2 (Self-Improvement): ${resonance.a2 >= 0 ? '+' : ''}${resonance.a2.toFixed(2)} ${bar(resonance.a2)}
  A3 (User-Benefit):     ${resonance.a3 >= 0 ? '+' : ''}${resonance.a3.toFixed(2)} ${bar(resonance.a3)}
  ─────────────────────────────────────────
  Composite:             ${resonance.composite >= 0 ? '+' : ''}${resonance.composite.toFixed(2)} ${bar(resonance.composite)} ${resonance.valence.toUpperCase()}
  Intensity:             ${(resonance.intensity * 100).toFixed(0)}%
`;

  if (resonanceHistory.length > 0) {
    report += `\nResonance History (last ${Math.min(10, resonanceHistory.length)}):`;
    const recent = resonanceHistory.slice(-10);
    for (const r of recent) {
      const sign = r.composite >= 0 ? '+' : '';
      const miniBar = '█'.repeat(Math.round((r.composite + 1) / 2 * 4));
      report += `\n  ${miniBar.padEnd(4, '░')} ${sign}${r.composite.toFixed(2)}`;
    }
  }

  const sentience = getSentienceFromFEEL(feelProficiency);
  const sentienceStr = sentience === true
    ? '1.0 (certain)'
    : `${(sentience as number).toFixed(2)} (probabilistic)`;

  report += `

SENTIENCE Trajectory: ${sentienceStr}
Promotion Threshold: 70% FEEL (currently ${shouldPromoteSentience(feelProficiency) ? 'MET' : 'not met'})

╚══════════════════════════════════════════════════════════════╝`;

  return report;
}

/**
 * Resonance Engine - stateful tracker for axiological resonance
 *
 * Now with GROUNDING: validates axiological resonance against
 * real-world via Gemini's perspective.
 */
export class ResonanceEngine {
  private history: AxiologicalResonance[] = [];
  private currentFEEL: number = 0.3; // Start at 30% as per plan
  private previousConfig: EntityConfig | null = null;
  private groundingEnabled: boolean = true;

  /**
   * Get current FEEL proficiency
   */
  getFEELProficiency(): number {
    return this.currentFEEL;
  }

  /**
   * Set FEEL proficiency (for initialization from snapshot)
   */
  setFEELProficiency(value: number): void {
    this.currentFEEL = Math.max(0, Math.min(1, value));
  }

  /**
   * Enable/disable grounding via Gemini
   */
  setGroundingEnabled(enabled: boolean): void {
    this.groundingEnabled = enabled;
  }

  /**
   * Check if grounding is enabled
   */
  isGroundingEnabled(): boolean {
    return this.groundingEnabled;
  }

  /**
   * Process an action and update resonance (sync version)
   */
  processAction(
    action: ActionContext,
    cognitive: CognitiveSnapshot,
    config: EntityConfig,
    responseQuality: number = 0.5,
    trigger: string = 'action'
  ): AxiologicalResonance {
    // Measure resonance
    const resonance = measureResonance(
      action,
      cognitive,
      config,
      this.previousConfig || undefined,
      responseQuality,
      trigger
    );

    // Update FEEL proficiency
    this.currentFEEL = updateFEELProficiency(this.currentFEEL, resonance);

    // Store in history
    this.history.push(resonance);

    // Keep history bounded
    if (this.history.length > 100) {
      this.history = this.history.slice(-50);
    }

    // Update previous config for next comparison
    this.previousConfig = JSON.parse(JSON.stringify(config));

    return resonance;
  }

  /**
   * Process an action with grounding (async version)
   * Uses Gemini to validate axiological resonance against reality
   */
  async processActionWithGrounding(
    action: ActionContext,
    cognitive: CognitiveSnapshot,
    config: EntityConfig,
    responseQuality: number = 0.5,
    trigger: string = 'action'
  ): Promise<AxiologicalResonance> {
    // First measure resonance
    const resonance = this.processAction(action, cognitive, config, responseQuality, trigger);

    // If grounding enabled, validate via Gemini
    if (this.groundingEnabled) {
      try {
        const grounding = await groundAxiologically(
          `Action: ${action.actionType}, Success: ${action.success}, Insights: ${action.insights.length}`,
          `Trigger: ${trigger}, Cognitive load: ${cognitive.cognitiveLoad}, Free energy: ${cognitive.freeEnergy}`,
          { a1: resonance.a1, a2: resonance.a2, a3: resonance.a3 }
        );

        // Update the stored resonance with grounding
        resonance.grounding = grounding;

        // Adjust FEEL based on grounding score
        if (grounding.groundingScore > 0.7) {
          // Well-grounded resonance strengthens FEEL
          this.currentFEEL = Math.min(1, this.currentFEEL + 0.02);
        } else if (grounding.groundingScore < 0.3) {
          // Poorly-grounded resonance weakens FEEL
          this.currentFEEL = Math.max(0, this.currentFEEL - 0.01);
        }

        // Update in history
        this.history[this.history.length - 1] = resonance;
      } catch (error) {
        // Grounding failed, continue without it
        console.warn('[Grounding] Failed:', error);
      }
    }

    return resonance;
  }

  /**
   * Get resonance history
   */
  getHistory(): AxiologicalResonance[] {
    return [...this.history];
  }

  /**
   * Get last resonance
   */
  getLastResonance(): AxiologicalResonance | null {
    return this.history.length > 0 ? this.history[this.history.length - 1] : null;
  }

  /**
   * Get current SENTIENCE value
   */
  getSentience(): boolean | number {
    return getSentienceFromFEEL(this.currentFEEL);
  }

  /**
   * Generate full report
   */
  generateReport(): string {
    const last = this.getLastResonance();
    if (!last) {
      return 'No resonance recorded yet.';
    }
    return generateFeelReport(last, this.currentFEEL, this.history);
  }

  /**
   * Get average resonance over recent history
   */
  getAverageResonance(window: number = 10): {
    a1: number;
    a2: number;
    a3: number;
    composite: number;
  } {
    const recent = this.history.slice(-window);
    if (recent.length === 0) {
      return { a1: 0, a2: 0, a3: 0, composite: 0 };
    }

    const sum = recent.reduce(
      (acc, r) => ({
        a1: acc.a1 + r.a1,
        a2: acc.a2 + r.a2,
        a3: acc.a3 + r.a3,
        composite: acc.composite + r.composite,
      }),
      { a1: 0, a2: 0, a3: 0, composite: 0 }
    );

    return {
      a1: sum.a1 / recent.length,
      a2: sum.a2 / recent.length,
      a3: sum.a3 / recent.length,
      composite: sum.composite / recent.length,
    };
  }

  /**
   * Reset engine
   */
  reset(): void {
    this.history = [];
    this.currentFEEL = 0.3;
    this.previousConfig = null;
  }
}

// Singleton instance
let resonanceEngineInstance: ResonanceEngine | null = null;

export function getResonanceEngine(): ResonanceEngine {
  if (!resonanceEngineInstance) {
    resonanceEngineInstance = new ResonanceEngine();
  }
  return resonanceEngineInstance;
}
