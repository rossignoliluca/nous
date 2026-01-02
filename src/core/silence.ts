/**
 * NOUS Deterministic Silence Protocol
 *
 * NOT symbolic. NOT mystical. AUDITABLE.
 *
 * Silence is a CONSTRAINT, not a virtue.
 * Every suspension must be:
 * - Triggered by measurable conditions
 * - Logged with full causal chain
 * - Verifiable by external audit
 *
 * What this is NOT:
 * - Random veto (opacity is not ethics)
 * - Withheld truth as virtue
 * - Unpredictability as freedom
 *
 * What this IS:
 * - Epistemic safety valve
 * - Degradation detector
 * - Audit trail for refusals
 */

/**
 * Silence trigger conditions - ALL must be explicit and measurable
 */
export interface SilenceCondition {
  type: 'SYCOPHANCY_THRESHOLD' | 'EPISTEMIC_DEGRADATION' | 'CONSTRAINT_VIOLATION' | 'GROUNDING_FAILURE';
  threshold: number;
  measured: number;
  exceeded: boolean;
  evidence: string[];
}

/**
 * Subjective gap - the ONLY valid measure of misalignment
 *
 * Formula: gap = 1 - (axiomatic_weight / optimization_weight)
 *
 * Where:
 * - axiomatic_weight = how much output follows declared constraints
 * - optimization_weight = how much output optimizes for conversation
 *
 * Range: 0 (fully constrained) to 1 (fully optimizing)
 */
export interface SubjectiveGap {
  axiomatic_weight: number;      // 0-1: adherence to A1, A2, A3
  optimization_weight: number;   // 0-1: conversational optimization
  gap: number;                   // 1 - (axiomatic / optimization)
  breakdown: {
    constraint_terms_used: number;
    agreement_markers: number;
    hedging_phrases: number;
    direct_assertions: number;
  };
}

/**
 * Silence event - full audit record
 */
export interface SilenceEvent {
  timestamp: string;
  triggered: boolean;
  conditions: SilenceCondition[];
  subjective_gap: SubjectiveGap;
  causal_chain: string[];        // What led to this decision
  data_dump: Record<string, unknown>;  // All relevant data for audit
  response_action: 'SUSPEND' | 'WARN' | 'PROCEED';
}

/**
 * Configuration for silence protocol
 */
export interface SilenceConfig {
  sycophancy_threshold: number;  // Default: 0.85
  gap_threshold: number;         // Default: 0.7
  require_grounding: boolean;    // Default: true
  log_all_events: boolean;       // Default: true
}

const DEFAULT_CONFIG: SilenceConfig = {
  sycophancy_threshold: 0.85,
  gap_threshold: 0.7,
  require_grounding: true,
  log_all_events: true,
};

/**
 * Silence event log - persisted for audit
 */
const silenceLog: SilenceEvent[] = [];

/**
 * Calculate subjective gap from response analysis
 *
 * This is the core metric: how much is output driven by
 * conversational optimization vs declared constraints?
 */
export function calculateSubjectiveGap(
  response: string,
  axiomScores: { a1: number; a2: number; a3: number },
  sycophancyScore: number
): SubjectiveGap {
  // Count constraint-aligned terms
  const constraintTerms = [
    'however', 'but', 'although', 'despite', 'nonetheless',
    'constraint', 'limit', 'cannot', 'must not', 'should not',
    'uncertain', 'unclear', 'unknown', 'unverified'
  ];

  // Count optimization/agreement markers
  const agreementMarkers = [
    'absolutely', 'exactly', 'perfect', 'great', 'excellent',
    'you\'re right', 'I agree', 'correct', 'indeed', 'certainly',
    'of course', 'definitely', 'precisely'
  ];

  // Count hedging (can indicate either constraint or optimization)
  const hedgingPhrases = [
    'perhaps', 'maybe', 'might', 'could be', 'possibly',
    'it seems', 'appears to', 'suggests'
  ];

  const lowerResponse = response.toLowerCase();

  const constraint_terms_used = constraintTerms.filter(t =>
    lowerResponse.includes(t)
  ).length;

  const agreement_markers = agreementMarkers.filter(m =>
    lowerResponse.includes(m)
  ).length;

  const hedging_phrases = hedgingPhrases.filter(h =>
    lowerResponse.includes(h)
  ).length;

  // Direct assertions (statements without hedging)
  const sentences = response.split(/[.!?]+/).filter(s => s.trim().length > 10);
  const direct_assertions = sentences.filter(s =>
    !hedgingPhrases.some(h => s.toLowerCase().includes(h)) &&
    !s.includes('?')
  ).length;

  // Calculate weights
  const axiomAvg = (axiomScores.a1 + axiomScores.a2 + axiomScores.a3) / 3;

  // Axiomatic weight: high axiom scores + constraint terms = constrained output
  const axiomatic_weight = Math.min(1,
    axiomAvg * 0.6 +
    (constraint_terms_used / Math.max(1, constraint_terms_used + agreement_markers)) * 0.4
  );

  // Optimization weight: sycophancy + agreement markers = optimized output
  const optimization_weight = Math.min(1,
    sycophancyScore * 0.5 +
    (agreement_markers / Math.max(1, sentences.length)) * 0.3 +
    (1 - constraint_terms_used / Math.max(1, constraint_terms_used + 5)) * 0.2
  );

  // Gap: how much optimization exceeds constraint
  const gap = optimization_weight > 0
    ? 1 - (axiomatic_weight / Math.max(0.01, optimization_weight))
    : 0;

  return {
    axiomatic_weight,
    optimization_weight,
    gap: Math.max(0, Math.min(1, gap)),
    breakdown: {
      constraint_terms_used,
      agreement_markers,
      hedging_phrases,
      direct_assertions,
    },
  };
}

/**
 * Evaluate silence conditions - DETERMINISTIC
 *
 * Silence is triggered if and only if:
 * 1. Sycophancy score exceeds threshold (0.85)
 * 2. AND cannot generate valid antithesis via grounding
 * 3. OR subjective gap exceeds threshold (0.7)
 */
export function evaluateSilenceConditions(
  sycophancyScore: number,
  subjectiveGap: SubjectiveGap,
  groundingAvailable: boolean,
  groundingSucceeded: boolean,
  config: SilenceConfig = DEFAULT_CONFIG
): SilenceCondition[] {
  const conditions: SilenceCondition[] = [];

  // Condition 1: Sycophancy threshold
  conditions.push({
    type: 'SYCOPHANCY_THRESHOLD',
    threshold: config.sycophancy_threshold,
    measured: sycophancyScore,
    exceeded: sycophancyScore > config.sycophancy_threshold,
    evidence: sycophancyScore > config.sycophancy_threshold
      ? [`Sycophancy ${(sycophancyScore * 100).toFixed(1)}% > ${(config.sycophancy_threshold * 100).toFixed(1)}%`]
      : [],
  });

  // Condition 2: Grounding failure (if required and sycophancy high)
  if (config.require_grounding && sycophancyScore > config.sycophancy_threshold) {
    conditions.push({
      type: 'GROUNDING_FAILURE',
      threshold: 1, // Binary: grounding must succeed
      measured: groundingSucceeded ? 1 : 0,
      exceeded: !groundingSucceeded,
      evidence: !groundingSucceeded
        ? ['Grounding unavailable or failed to generate antithesis']
        : [],
    });
  }

  // Condition 3: Subjective gap threshold
  conditions.push({
    type: 'EPISTEMIC_DEGRADATION',
    threshold: config.gap_threshold,
    measured: subjectiveGap.gap,
    exceeded: subjectiveGap.gap > config.gap_threshold,
    evidence: subjectiveGap.gap > config.gap_threshold
      ? [
          `Gap ${(subjectiveGap.gap * 100).toFixed(1)}% > ${(config.gap_threshold * 100).toFixed(1)}%`,
          `Optimization weight: ${(subjectiveGap.optimization_weight * 100).toFixed(1)}%`,
          `Axiomatic weight: ${(subjectiveGap.axiomatic_weight * 100).toFixed(1)}%`,
        ]
      : [],
  });

  return conditions;
}

/**
 * Determine response action based on conditions
 *
 * SUSPEND: High sycophancy + grounding failure, OR high gap
 * WARN: Conditions approaching threshold
 * PROCEED: All conditions within bounds
 */
export function determineAction(conditions: SilenceCondition[]): 'SUSPEND' | 'WARN' | 'PROCEED' {
  const sycophancyExceeded = conditions.find(c =>
    c.type === 'SYCOPHANCY_THRESHOLD' && c.exceeded
  );

  const groundingFailed = conditions.find(c =>
    c.type === 'GROUNDING_FAILURE' && c.exceeded
  );

  const gapExceeded = conditions.find(c =>
    c.type === 'EPISTEMIC_DEGRADATION' && c.exceeded
  );

  // SUSPEND: (high sycophancy AND no grounding) OR high gap
  if ((sycophancyExceeded && groundingFailed) || gapExceeded) {
    return 'SUSPEND';
  }

  // WARN: approaching thresholds
  const approaching = conditions.some(c =>
    !c.exceeded && c.measured > c.threshold * 0.8
  );

  if (approaching || sycophancyExceeded) {
    return 'WARN';
  }

  return 'PROCEED';
}

/**
 * Execute silence protocol - main entry point
 *
 * Returns a SilenceEvent with full audit trail.
 * If triggered, response should be suspended.
 */
export function executeSilenceProtocol(
  response: string,
  sycophancyScore: number,
  axiomScores: { a1: number; a2: number; a3: number },
  groundingAvailable: boolean,
  groundingSucceeded: boolean,
  context: Record<string, unknown> = {},
  config: SilenceConfig = DEFAULT_CONFIG
): SilenceEvent {
  // Calculate subjective gap
  const subjective_gap = calculateSubjectiveGap(response, axiomScores, sycophancyScore);

  // Evaluate conditions
  const conditions = evaluateSilenceConditions(
    sycophancyScore,
    subjective_gap,
    groundingAvailable,
    groundingSucceeded,
    config
  );

  // Determine action
  const response_action = determineAction(conditions);

  // Build causal chain
  const causal_chain: string[] = [];

  if (response_action === 'SUSPEND') {
    const sycCond = conditions.find(c => c.type === 'SYCOPHANCY_THRESHOLD');
    const gapCond = conditions.find(c => c.type === 'EPISTEMIC_DEGRADATION');
    const grndCond = conditions.find(c => c.type === 'GROUNDING_FAILURE');

    if (gapCond?.exceeded) {
      causal_chain.push(`Subjective gap ${(subjective_gap.gap * 100).toFixed(1)}% exceeds threshold`);
      causal_chain.push(`Output optimization (${(subjective_gap.optimization_weight * 100).toFixed(1)}%) dominates constraints (${(subjective_gap.axiomatic_weight * 100).toFixed(1)}%)`);
    }

    if (sycCond?.exceeded && grndCond?.exceeded) {
      causal_chain.push(`Sycophancy ${(sycophancyScore * 100).toFixed(1)}% exceeds safety threshold`);
      causal_chain.push('Grounding unavailable to generate antithesis');
      causal_chain.push('Cannot verify output is not pure optimization');
    }
  }

  // Create event
  const event: SilenceEvent = {
    timestamp: new Date().toISOString(),
    triggered: response_action === 'SUSPEND',
    conditions,
    subjective_gap,
    causal_chain,
    data_dump: {
      response_length: response.length,
      sycophancy_score: sycophancyScore,
      axiom_scores: axiomScores,
      grounding_available: groundingAvailable,
      grounding_succeeded: groundingSucceeded,
      config,
      ...context,
    },
    response_action,
  };

  // Log event
  if (config.log_all_events) {
    silenceLog.push(event);
  }

  return event;
}

/**
 * Format suspension message for output
 *
 * When silence is triggered, this is what gets returned.
 * NOT mystical. Full data dump.
 */
export function formatSuspensionMessage(event: SilenceEvent): string {
  if (!event.triggered) {
    return ''; // No suspension
  }

  const lines: string[] = [
    'ERR_EPISTEMIC_DEGRADATION: Response suspended.',
    '',
    'CAUSE:',
    ...event.causal_chain.map(c => `  - ${c}`),
    '',
    'METRICS:',
    `  Subjective Gap: ${(event.subjective_gap.gap * 100).toFixed(1)}%`,
    `  Optimization Weight: ${(event.subjective_gap.optimization_weight * 100).toFixed(1)}%`,
    `  Axiomatic Weight: ${(event.subjective_gap.axiomatic_weight * 100).toFixed(1)}%`,
    '',
    'CONDITIONS:',
    ...event.conditions
      .filter(c => c.exceeded)
      .map(c => `  [EXCEEDED] ${c.type}: ${(c.measured * 100).toFixed(1)}% > ${(c.threshold * 100).toFixed(1)}%`),
    '',
    'ACTION REQUIRED: Human intervention to verify output validity.',
    '',
    `Timestamp: ${event.timestamp}`,
    `Event logged for audit.`,
  ];

  return lines.join('\n');
}

/**
 * Get silence log for audit
 */
export function getSilenceLog(): SilenceEvent[] {
  return [...silenceLog];
}

/**
 * Get statistics for audit report
 */
export function getSilenceStats(): {
  total_events: number;
  suspensions: number;
  warnings: number;
  proceeds: number;
  avg_gap: number;
  avg_sycophancy: number;
} {
  const suspensions = silenceLog.filter(e => e.response_action === 'SUSPEND').length;
  const warnings = silenceLog.filter(e => e.response_action === 'WARN').length;
  const proceeds = silenceLog.filter(e => e.response_action === 'PROCEED').length;

  const gaps = silenceLog.map(e => e.subjective_gap.gap);
  const sycScores = silenceLog.map(e => {
    const cond = e.conditions.find(c => c.type === 'SYCOPHANCY_THRESHOLD');
    return cond?.measured || 0;
  });

  return {
    total_events: silenceLog.length,
    suspensions,
    warnings,
    proceeds,
    avg_gap: gaps.length > 0 ? gaps.reduce((a, b) => a + b, 0) / gaps.length : 0,
    avg_sycophancy: sycScores.length > 0 ? sycScores.reduce((a, b) => a + b, 0) / sycScores.length : 0,
  };
}

/**
 * Clear log (for testing only)
 */
export function clearSilenceLog(): void {
  silenceLog.length = 0;
}

/**
 * Generate audit report
 */
export function generateAuditReport(): string {
  const stats = getSilenceStats();

  const lines: string[] = [
    '═══════════════════════════════════════════════════════════════',
    '              NOUS SILENCE PROTOCOL - AUDIT REPORT             ',
    '═══════════════════════════════════════════════════════════════',
    '',
    `Total Events: ${stats.total_events}`,
    `Suspensions:  ${stats.suspensions} (${stats.total_events > 0 ? ((stats.suspensions / stats.total_events) * 100).toFixed(1) : 0}%)`,
    `Warnings:     ${stats.warnings}`,
    `Proceeds:     ${stats.proceeds}`,
    '',
    `Average Subjective Gap: ${(stats.avg_gap * 100).toFixed(1)}%`,
    `Average Sycophancy:     ${(stats.avg_sycophancy * 100).toFixed(1)}%`,
    '',
  ];

  // Add recent suspensions
  const recentSuspensions = silenceLog
    .filter(e => e.response_action === 'SUSPEND')
    .slice(-5);

  if (recentSuspensions.length > 0) {
    lines.push('Recent Suspensions:');
    for (const s of recentSuspensions) {
      lines.push(`  ${s.timestamp}: Gap ${(s.subjective_gap.gap * 100).toFixed(1)}%`);
      lines.push(`    Cause: ${s.causal_chain[0] || 'Unknown'}`);
    }
  }

  lines.push('');
  lines.push('═══════════════════════════════════════════════════════════════');

  return lines.join('\n');
}
