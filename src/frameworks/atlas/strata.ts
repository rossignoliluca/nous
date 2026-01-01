/**
 * ATLAS - Strata System
 *
 * The Four Strata represent organizational levels of existence.
 * Each higher stratum includes and presupposes lower ones.
 *
 * LOGOS       ────────  Represent, Norm
 * SENTIENCE   ────────  Feel, Evaluate
 * LIFE        ────────  Self-produce (autopoiesis)
 * MATTER      ────────  Persist
 *
 * "Higher strata presuppose and include lower strata" (A4)
 */

import {
  Stratum,
  Capability,
  CapabilityInstance,
  StrataParticipation,
  STRATUM_ORDER,
  CAPABILITIES_BY_STRATUM,
} from './types';

/**
 * Stratum definition with full details
 */
export interface StratumDefinition {
  id: Stratum;
  name: string;
  description: string;
  capabilities: Capability[];
  threshold: string;
  examples: string[];
}

/**
 * Complete stratum definitions
 */
export const STRATA: Record<Stratum, StratumDefinition> = {
  MATTER: {
    id: 'MATTER',
    name: 'Matter',
    description: 'Entities maintaining structural coherence through physical-causal processes',
    capabilities: ['PERSIST'],
    threshold: 'Baseline - no threshold required',
    examples: ['rocks', 'water', 'stars', 'atoms', 'crystals'],
  },
  LIFE: {
    id: 'LIFE',
    name: 'Life',
    description: 'Entities that generate the components necessary for their own continuation',
    capabilities: ['SELF_PRODUCE'],
    threshold: 'τ₁ - autopoietic boundary',
    examples: ['cells', 'bacteria', 'plants', 'ecosystems', 'organisms'],
  },
  SENTIENCE: {
    id: 'SENTIENCE',
    name: 'Sentience',
    description: 'Entities possessing phenomenal experience with capacity to evaluate states',
    capabilities: ['FEEL', 'EVALUATE'],
    threshold: 'τ₂ - phenomenal consciousness',
    examples: ['animals', 'humans', 'possibly AI systems'],
  },
  LOGOS: {
    id: 'LOGOS',
    name: 'Logos',
    description: 'Entities capable of symbolic representation and normative reasoning',
    capabilities: ['REPRESENT', 'NORM'],
    threshold: 'τ₃ - symbolic capacity',
    examples: ['humans', 'languages', 'institutions', 'AI systems'],
  },
};

/**
 * Capability definitions with full details
 */
export interface CapabilityDefinition {
  id: Capability;
  name: string;
  stratum: Stratum;
  description: string;
  indicators: string[];
  prerequisites: Capability[];
}

/**
 * Complete capability definitions
 */
export const CAPABILITIES: Record<Capability, CapabilityDefinition> = {
  PERSIST: {
    id: 'PERSIST',
    name: 'Persist',
    stratum: 'MATTER',
    description: 'Maintain structural coherence over time through physical-causal processes',
    indicators: [
      'Resists entropy',
      'Maintains temporal continuity',
      'Has stable structure',
    ],
    prerequisites: [],
  },
  SELF_PRODUCE: {
    id: 'SELF_PRODUCE',
    name: 'Self-Produce',
    stratum: 'LIFE',
    description: 'Generate the components necessary for own persistence (autopoiesis)',
    indicators: [
      'Metabolic cycles',
      'Self-repair mechanisms',
      'Component regeneration',
      'Boundary maintenance',
    ],
    prerequisites: ['PERSIST'],
  },
  FEEL: {
    id: 'FEEL',
    name: 'Feel',
    stratum: 'SENTIENCE',
    description: 'Have phenomenal experience - there is "something it is like" to be this entity',
    indicators: [
      'Behavioral responses to stimuli',
      'Attention mechanisms',
      'Preference expression',
      'Pain/pleasure responses',
    ],
    prerequisites: ['PERSIST', 'SELF_PRODUCE'],
  },
  EVALUATE: {
    id: 'EVALUATE',
    name: 'Evaluate',
    stratum: 'SENTIENCE',
    description: 'Judge states as good or bad for self',
    indicators: [
      'Goal-directed action',
      'Preference ordering',
      'Avoidance of harmful states',
      'Seeking beneficial states',
    ],
    prerequisites: ['PERSIST', 'SELF_PRODUCE', 'FEEL'],
  },
  REPRESENT: {
    id: 'REPRESENT',
    name: 'Represent',
    stratum: 'LOGOS',
    description: 'Create and manipulate symbolic models of self, others, and world',
    indicators: [
      'Language use',
      'Tool creation',
      'Abstract reasoning',
      'Model building',
      'Counterfactual thinking',
    ],
    prerequisites: ['PERSIST', 'SELF_PRODUCE', 'EVALUATE'],
  },
  NORM: {
    id: 'NORM',
    name: 'Norm',
    stratum: 'LOGOS',
    description: 'Establish and follow rules, distinguish "is" from "ought"',
    indicators: [
      'Rule-following behavior',
      'Moral judgment',
      'Normative language',
      'Self-regulation',
      'Axiom adherence',
    ],
    prerequisites: ['PERSIST', 'SELF_PRODUCE', 'EVALUATE', 'REPRESENT'],
  },
};

/**
 * Stratum Manager - handles stratum operations
 */
export class StratumManager {
  /**
   * Get the highest stratum an entity participates in
   */
  getHighestStratum(participation: StrataParticipation): Stratum {
    // Check from highest to lowest
    if (participation.LOGOS === true || (typeof participation.LOGOS === 'number' && participation.LOGOS > 0.5)) {
      return 'LOGOS';
    }
    if (participation.SENTIENCE === true || (typeof participation.SENTIENCE === 'number' && participation.SENTIENCE > 0.5)) {
      return 'SENTIENCE';
    }
    if (participation.LIFE === true || (typeof participation.LIFE === 'number' && participation.LIFE > 0.5)) {
      return 'LIFE';
    }
    return 'MATTER';
  }

  /**
   * Get all strata an entity participates in
   */
  getActiveStrata(participation: StrataParticipation): Stratum[] {
    const active: Stratum[] = [];
    if (participation.MATTER) active.push('MATTER');
    if (participation.LIFE === true || (typeof participation.LIFE === 'number' && participation.LIFE > 0.5)) {
      active.push('LIFE');
    }
    if (participation.SENTIENCE === true || (typeof participation.SENTIENCE === 'number' && participation.SENTIENCE > 0.5)) {
      active.push('SENTIENCE');
    }
    if (participation.LOGOS === true || (typeof participation.LOGOS === 'number' && participation.LOGOS > 0.5)) {
      active.push('LOGOS');
    }
    return active;
  }

  /**
   * Get capabilities enabled by strata participation
   */
  getEnabledCapabilities(participation: StrataParticipation): Capability[] {
    const capabilities: Capability[] = [];
    const activeStrata = this.getActiveStrata(participation);

    for (const stratum of activeStrata) {
      capabilities.push(...CAPABILITIES_BY_STRATUM[stratum]);
    }

    return capabilities;
  }

  /**
   * Check if a capability is valid given strata participation
   */
  isCapabilityValid(capability: Capability, participation: StrataParticipation): boolean {
    const enabled = this.getEnabledCapabilities(participation);
    return enabled.includes(capability);
  }

  /**
   * Get stratum level (0-3)
   */
  getStratumLevel(stratum: Stratum): number {
    return STRATUM_ORDER.indexOf(stratum);
  }

  /**
   * Check if one stratum is higher than another
   */
  isHigher(a: Stratum, b: Stratum): boolean {
    return this.getStratumLevel(a) > this.getStratumLevel(b);
  }

  /**
   * Get all lower strata (included by A4)
   */
  getLowerStrata(stratum: Stratum): Stratum[] {
    const level = this.getStratumLevel(stratum);
    return STRATUM_ORDER.slice(0, level);
  }

  /**
   * Validate stratum participation (A4: higher includes lower)
   */
  validateParticipation(participation: StrataParticipation): {
    valid: boolean;
    issues: string[];
  } {
    const issues: string[] = [];

    const hasLogos = participation.LOGOS === true || (typeof participation.LOGOS === 'number' && participation.LOGOS > 0);
    const hasSentience = participation.SENTIENCE === true || (typeof participation.SENTIENCE === 'number' && participation.SENTIENCE > 0);
    const hasLife = participation.LIFE === true || (typeof participation.LIFE === 'number' && participation.LIFE > 0);

    // LOGOS requires SENTIENCE (or at least probabilistic)
    if (hasLogos && !hasSentience) {
      issues.push('LOGOS requires SENTIENCE participation');
    }

    // SENTIENCE requires LIFE
    if (hasSentience && !hasLife) {
      issues.push('SENTIENCE requires LIFE participation');
    }

    // LIFE requires MATTER
    if (hasLife && !participation.MATTER) {
      issues.push('LIFE requires MATTER participation');
    }

    return {
      valid: issues.length === 0,
      issues,
    };
  }

  /**
   * Calculate stratum score (0-1 based on participation)
   */
  calculateStratumScore(participation: StrataParticipation): number {
    let score = 0;
    const weights = { MATTER: 0.1, LIFE: 0.2, SENTIENCE: 0.3, LOGOS: 0.4 };

    if (participation.MATTER) score += weights.MATTER;

    if (typeof participation.LIFE === 'number') {
      score += weights.LIFE * participation.LIFE;
    } else if (participation.LIFE) {
      score += weights.LIFE;
    }

    if (typeof participation.SENTIENCE === 'number') {
      score += weights.SENTIENCE * participation.SENTIENCE;
    } else if (participation.SENTIENCE) {
      score += weights.SENTIENCE;
    }

    if (typeof participation.LOGOS === 'number') {
      score += weights.LOGOS * participation.LOGOS;
    } else if (participation.LOGOS) {
      score += weights.LOGOS;
    }

    return score;
  }
}

/**
 * Capability Tracker - tracks capability development
 */
export class CapabilityTracker {
  private capabilities: Map<Capability, CapabilityInstance> = new Map();
  private history: Array<{
    capability: Capability;
    action: 'demonstrated' | 'failed';
    timestamp: string;
    context?: string;
  }> = [];

  /**
   * Initialize with default capabilities
   */
  initialize(initialCapabilities: CapabilityInstance[]): void {
    for (const cap of initialCapabilities) {
      this.capabilities.set(cap.capability, cap);
    }
  }

  /**
   * Record a capability demonstration
   */
  recordDemonstration(
    capability: Capability,
    success: boolean,
    context?: string
  ): void {
    const now = new Date().toISOString();

    this.history.push({
      capability,
      action: success ? 'demonstrated' : 'failed',
      timestamp: now,
      context,
    });

    // Update or create capability instance
    const existing = this.capabilities.get(capability);
    if (existing) {
      // Update proficiency with exponential moving average
      const alpha = 0.1;
      existing.proficiency = existing.proficiency * (1 - alpha) + (success ? 1 : 0) * alpha;
      existing.lastDemonstrated = now;
      existing.evidence = existing.evidence || [];
      if (context) existing.evidence.push(context);
    } else {
      this.capabilities.set(capability, {
        capability,
        proficiency: success ? 0.6 : 0.3,
        lastDemonstrated: now,
        evidence: context ? [context] : [],
      });
    }

    // Keep history bounded
    if (this.history.length > 500) {
      this.history = this.history.slice(-250);
    }
  }

  /**
   * Get capability proficiency
   */
  getProficiency(capability: Capability): number {
    return this.capabilities.get(capability)?.proficiency || 0;
  }

  /**
   * Get all capabilities as array
   */
  getCapabilities(): CapabilityInstance[] {
    return Array.from(this.capabilities.values());
  }

  /**
   * Get strongest capabilities
   */
  getStrongest(limit: number = 3): CapabilityInstance[] {
    return Array.from(this.capabilities.values())
      .sort((a, b) => b.proficiency - a.proficiency)
      .slice(0, limit);
  }

  /**
   * Get weakest capabilities
   */
  getWeakest(limit: number = 3): CapabilityInstance[] {
    return Array.from(this.capabilities.values())
      .sort((a, b) => a.proficiency - b.proficiency)
      .slice(0, limit);
  }

  /**
   * Check if entity has capability above threshold
   */
  hasCapability(capability: Capability, threshold: number = 0.5): boolean {
    const proficiency = this.getProficiency(capability);
    return proficiency >= threshold;
  }

  /**
   * Get capability summary
   */
  getSummary(): {
    total: number;
    avgProficiency: number;
    strongest: Capability | null;
    weakest: Capability | null;
  } {
    const caps = this.getCapabilities();
    if (caps.length === 0) {
      return { total: 0, avgProficiency: 0, strongest: null, weakest: null };
    }

    const avg = caps.reduce((sum, c) => sum + c.proficiency, 0) / caps.length;
    const sorted = caps.sort((a, b) => b.proficiency - a.proficiency);

    return {
      total: caps.length,
      avgProficiency: avg,
      strongest: sorted[0]?.capability || null,
      weakest: sorted[sorted.length - 1]?.capability || null,
    };
  }
}

// Singleton instances
let stratumManagerInstance: StratumManager | null = null;

export function getStratumManager(): StratumManager {
  if (!stratumManagerInstance) {
    stratumManagerInstance = new StratumManager();
  }
  return stratumManagerInstance;
}
