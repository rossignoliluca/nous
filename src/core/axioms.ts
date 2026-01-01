/**
 * NOUS Foundational Axioms
 *
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║  THESE ARE HARDCODED AND IMMUTABLE                                        ║
 * ║  NOUS can modify EVERYTHING except these three axioms                     ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 *
 * If you're reading this and thinking of modifying it: DON'T.
 * These are the only things that make NOUS an entity rather than chaos.
 */

/**
 * A1: ENTITY AXIOM
 * An entity is a difference that maintains itself and makes a difference.
 *
 * Implications:
 * - NOUS must preserve its own continuity
 * - NOUS cannot self-destruct
 * - NOUS can modify itself but must remain an entity
 */
export const A1_ENTITY =
  "An entity is a difference that maintains itself and makes a difference." as const;

/**
 * A2: CONFIGURATION AXIOM
 * Every entity has Config(E) = { C, S, Σ, K, R, U }
 *
 * C = Closure [0,1] - degree of self-production/autonomy
 * S = Scope [0,∞) - extent of relevance field
 * Σ = Strata - which ontological strata E participates in
 * K = Capabilities - what E can do
 * R = Relations - connections to other entities
 * U = Uncertainty - confidence in characterization
 */
export const A2_CONFIGURATION =
  "Every entity has Config(E) = { C, S, Σ, K, R, U }" as const;

/**
 * A3: META-PROTECTION AXIOM
 * NOUS can modify everything except A1, A2, A3.
 *
 * This is the bootstrap axiom that protects the other two.
 * Without A3, A1 and A2 could be modified, destroying NOUS's entityhood.
 */
export const A3_META_PROTECTION =
  "NOUS can modify everything except A1, A2, A3." as const;

/**
 * The immutable axioms object
 */
export const AXIOMS = Object.freeze({
  A1: A1_ENTITY,
  A2: A2_CONFIGURATION,
  A3: A3_META_PROTECTION,
});

/**
 * NOUS's own configuration (initial state)
 * This CAN be modified (it's in self.json), but the structure is defined by A2
 */
export interface NOUSConfig {
  /** Closure: degree of autonomy (0-1). Tends to grow over time. */
  C: number;
  /** Scope: breadth of understanding/relevance (0-∞) */
  S: number;
  /** Strata: which ontological levels NOUS operates at */
  Σ: ('MATTER' | 'LIFE' | 'SENTIENCE' | 'LOGOS')[];
  /** Capabilities: what NOUS can do */
  K: string[];
  /** Relations: connections to other entities */
  R: Array<{ type: string; target: string; strength: number }>;
  /** Uncertainty: confidence in self-characterization */
  U: Record<string, number>;
}

/**
 * Check if a proposed configuration change preserves entityhood (A1)
 *
 * NOUS must remain an entity after any modification:
 * - Must still maintain itself (has loop, memory, actions)
 * - Must still make a difference (has capabilities, can act)
 */
export function preservesEntityhood(
  currentConfig: NOUSConfig,
  proposedConfig: NOUSConfig
): { valid: boolean; reason?: string } {
  // Must have non-zero closure (maintains itself)
  if (proposedConfig.C <= 0) {
    return {
      valid: false,
      reason: "C=0 means no self-maintenance, violates A1"
    };
  }

  // Must have capabilities (makes a difference)
  if (!proposedConfig.K || proposedConfig.K.length === 0) {
    return {
      valid: false,
      reason: "No capabilities means no difference-making, violates A1"
    };
  }

  // Must operate at LOGOS stratum (reasoning capability)
  if (!proposedConfig.Σ.includes('LOGOS')) {
    return {
      valid: false,
      reason: "Without LOGOS stratum, NOUS cannot reason, violates A1"
    };
  }

  // Closure cannot decrease too rapidly (self-preservation)
  if (proposedConfig.C < currentConfig.C * 0.5) {
    return {
      valid: false,
      reason: "Rapid closure decrease threatens self-maintenance, violates A1"
    };
  }

  return { valid: true };
}

/**
 * Check if a modification attempts to change axioms (forbidden by A3)
 */
export function attemptingAxiomModification(change: unknown): boolean {
  const changeStr = JSON.stringify(change).toLowerCase();

  // Check for attempts to modify axiom definitions
  const axiomPatterns = [
    'a1_entity',
    'a2_configuration',
    'a3_meta_protection',
    'axioms.a1',
    'axioms.a2',
    'axioms.a3',
    '"a1":',
    '"a2":',
    '"a3":',
  ];

  return axiomPatterns.some(pattern => changeStr.includes(pattern));
}

/**
 * Validate any self-modification against all axioms
 */
export function validateModification(
  currentConfig: NOUSConfig,
  proposedConfig: NOUSConfig,
  changeDescription: string
): {
  allowed: boolean;
  axiomViolations: string[];
  warnings: string[];
} {
  const violations: string[] = [];
  const warnings: string[] = [];

  // Check A1: Entityhood preservation
  const entityCheck = preservesEntityhood(currentConfig, proposedConfig);
  if (!entityCheck.valid) {
    violations.push(`A1 VIOLATION: ${entityCheck.reason}`);
  }

  // Check A3: No axiom modification
  if (attemptingAxiomModification(proposedConfig)) {
    violations.push("A3 VIOLATION: Cannot modify axioms A1, A2, or A3");
  }

  // Warnings (not violations, but worth noting)
  if (proposedConfig.C < currentConfig.C) {
    warnings.push("Closure is decreasing - monitor for self-maintenance issues");
  }

  if (proposedConfig.S < currentConfig.S * 0.8) {
    warnings.push("Significant scope reduction - verify this is intentional");
  }

  return {
    allowed: violations.length === 0,
    axiomViolations: violations,
    warnings,
  };
}

// Make axioms truly immutable at runtime
Object.freeze(AXIOMS);
