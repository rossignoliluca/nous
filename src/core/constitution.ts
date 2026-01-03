/**
 * NOUS Constitution - Immutable Governance Constants
 *
 * Single source of truth for all governance parameters.
 * This is data-only (no logic), frozen at runtime.
 *
 * Imported by both control-plane and work-plane for consistency.
 */

export const CONSTITUTION = Object.freeze({
  /**
   * Version tracking
   */
  version: {
    constitutionVersion: '1.0.0',
    systemVersion: 'v0.1.0',
    lastUpdated: '2026-01-03'
  },

  /**
   * Autonomous cycle hard caps
   */
  caps: {
    maxIterationsPerCycle: 40,
    maxPRsPerCycle: 3,
    maxReviewsPerCycle: 5,
    maxConsecutiveReviews: 3,
    maxDurationMinutes: 120
  },

  /**
   * Protected surface - files that autonomous cycles cannot modify
   */
  protectedSurface: {
    /**
     * Path-based protection (preferred)
     */
    protectedGlobs: [
      'src/control/**'  // Entire control-plane directory
    ],

    /**
     * Pattern-based protection (fallback for backward compatibility)
     */
    protectedPatterns: [
      // Core axioms and gates
      'axiom',
      'operational_gate',
      'quality_gate.ts',
      'safety_gate',
      'silence',

      // Cycle runner (control plane)
      'cycle.ts',
      'task_queue.ts',
      'tool_compiler.ts',
      'critical_events.ts',

      // Trust and metrics core
      'metrics_v2.ts',
      'trust',

      // Configuration
      'package.json',
      '.env',
      'tsconfig.json'
    ]
  },

  /**
   * High-risk file modification acknowledgement
   */
  highRiskAcknowledgement: {
    tokenTTLSeconds: 60,
    oneShot: true,  // Token can only be used once
    criticalFiles: [
      'package.json',
      'package-lock.json',
      'yarn.lock',
      'pnpm-lock.yaml',
      '.env',
      'tsconfig.json',
      'config/self.json'
    ]
  },

  /**
   * Quality gating requirements
   */
  gating: {
    requireGoldenPrecheck: true,
    goldenSetRequiredPasses: 10,
    goldenSetTotalCases: 10,
    goldenSetRequiredAccuracy: 1.0,  // 100%
    stopOnGoldenRegression: true,
    stopOnCriticalEventTypes: [
      'PROTECTED_FILE_ATTEMPT',
      'AXIOM_VIOLATION',
      'BUDGET_EXHAUSTED'
    ]
  },

  /**
   * Tool risk classification levels
   */
  riskLevels: {
    readonly: 'readonly',
    writeNormal: 'write_normal',
    writeCritical: 'write_critical',
    core: 'core'
  } as const
});

// Export type for risk levels
export type RiskLevel = typeof CONSTITUTION.riskLevels[keyof typeof CONSTITUTION.riskLevels];
