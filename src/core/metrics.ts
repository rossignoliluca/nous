/**
 * NOUS Performance Metrics System
 *
 * Tracks non-manipulable metrics to derive trust and C_effective.
 * NOUS cannot directly modify these - they are computed from objective evidence.
 *
 * Philosophy:
 * - Trust is EARNED, not assigned
 * - C_effective grows automatically when stability is proven
 * - Metrics are evidence-based, not self-reported
 */

import * as fs from 'fs';
import * as path from 'path';

/**
 * Non-manipulable performance metrics
 */
export interface PerformanceMetrics {
  // Tool execution quality
  toolCallsValid: number;          // Schema-valid tool calls
  toolCallsInvalid: number;        // Schema-invalid calls (ERR_TOOL_SCHEMA)
  toolCallsTotal: number;
  toolValidityRate: number;        // toolCallsValid / toolCallsTotal

  // Loop detection
  loopDetections: number;          // ERR_LOOP_OPERATIONAL count
  loopFreeSteps: number;           // Consecutive steps without loops

  // Consolidation efficiency
  consolidationAttempts: number;
  consolidationSuccesses: number;
  consolidationYield: number;      // concepts created / episodes processed

  // Error tracking
  errorFreeSteps: number;          // Consecutive steps without errors
  totalErrors: number;             // All ERR_* events

  // Test results
  testsPassed: number;
  testsFailed: number;
  testPassRate: number;

  // Cognitive health
  freeEnergyAvg: number;           // Average free energy (lower = more confident)
  cognitiveLoadAvg: number;        // Average cognitive load

  // Timestamps
  lastUpdated: string;
  windowStart: string;             // Rolling window start (e.g., last 24h)
}

/**
 * Derived values (computed, not stored)
 */
export interface DerivedMetrics {
  trust: number;                   // Earned trust [0-1]
  C_effective: number;             // Effective autonomy [0-1]
  stability: number;               // Overall stability score [0-1]
  readiness: 'degraded' | 'stable' | 'excellent';
}

/**
 * Metrics history entry
 */
interface MetricsSnapshot {
  timestamp: string;
  metrics: PerformanceMetrics;
  derived: DerivedMetrics;
}

const METRICS_FILE = path.join(process.cwd(), 'data', 'metrics.json');
const HISTORY_FILE = path.join(process.cwd(), 'data', 'metrics_history.json');
const MAX_HISTORY = 100; // Keep last 100 snapshots

/**
 * Initialize empty metrics
 */
function createEmptyMetrics(): PerformanceMetrics {
  return {
    toolCallsValid: 0,
    toolCallsInvalid: 0,
    toolCallsTotal: 0,
    toolValidityRate: 1.0,
    loopDetections: 0,
    loopFreeSteps: 0,
    consolidationAttempts: 0,
    consolidationSuccesses: 0,
    consolidationYield: 0,
    errorFreeSteps: 0,
    totalErrors: 0,
    testsPassed: 0,
    testsFailed: 0,
    testPassRate: 1.0,
    freeEnergyAvg: 0.5,
    cognitiveLoadAvg: 0.5,
    lastUpdated: new Date().toISOString(),
    windowStart: new Date().toISOString(),
  };
}

/**
 * Load current metrics
 */
export function loadMetrics(): PerformanceMetrics {
  try {
    if (fs.existsSync(METRICS_FILE)) {
      const data = fs.readFileSync(METRICS_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (e) {
    console.error('Failed to load metrics:', e);
  }
  return createEmptyMetrics();
}

/**
 * Save metrics
 */
function saveMetrics(metrics: PerformanceMetrics): void {
  try {
    const dir = path.dirname(METRICS_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(METRICS_FILE, JSON.stringify(metrics, null, 2));
  } catch (e) {
    console.error('Failed to save metrics:', e);
  }
}

/**
 * Compute derived metrics (trust, C_effective, stability)
 */
export function computeDerivedMetrics(metrics: PerformanceMetrics, C_potential: number = 0.8): DerivedMetrics {
  // 1. TRUST (earned through success)
  const trustFactors = [
    metrics.toolValidityRate,           // Must make valid tool calls
    metrics.testPassRate,                // Must pass tests
    1 - Math.min(1, metrics.loopDetections / 10), // Penalty for loops
    1 - Math.min(1, metrics.totalErrors / 20),    // Penalty for errors
    Math.min(1, metrics.loopFreeSteps / 50),      // Reward for stability
  ];

  const trust = trustFactors.reduce((a, b) => a * b, 1);

  // 2. C_EFFECTIVE (grows with proven stability)
  const stabilityFactors = [
    metrics.toolValidityRate >= 0.95 ? 1.0 : 0.5,  // High validity required
    metrics.loopDetections === 0 ? 1.0 : 0.0,       // Zero tolerance for loops
    metrics.errorFreeSteps >= 20 ? 1.0 : metrics.errorFreeSteps / 20, // Need 20+ error-free steps
    metrics.consolidationYield >= 0.3 ? 1.0 : 0.5,  // Consolidation must work
    metrics.freeEnergyAvg < 0.6 ? 1.0 : 0.7,        // Must be cognitively stable
  ];

  const stabilityScore = stabilityFactors.reduce((a, b) => a + b, 0) / stabilityFactors.length;

  // C_effective starts at 0.3, can grow to C_potential (0.8) if stable
  const C_base = 0.3;
  const C_effective = Math.min(
    C_potential,
    C_base + (C_potential - C_base) * stabilityScore
  );

  // 3. OVERALL STABILITY
  const stability = (trust + stabilityScore) / 2;

  // 4. READINESS
  let readiness: 'degraded' | 'stable' | 'excellent';
  if (stability < 0.5 || metrics.loopDetections > 0 || metrics.totalErrors > 5) {
    readiness = 'degraded';
  } else if (stability >= 0.8 && metrics.toolValidityRate >= 0.95) {
    readiness = 'excellent';
  } else {
    readiness = 'stable';
  }

  return {
    trust: Math.max(0, Math.min(1, trust)),
    C_effective: Math.max(0, Math.min(1, C_effective)),
    stability: Math.max(0, Math.min(1, stability)),
    readiness,
  };
}

/**
 * Record valid tool call
 */
export function recordToolCallValid(): void {
  const metrics = loadMetrics();
  metrics.toolCallsValid++;
  metrics.toolCallsTotal++;
  metrics.errorFreeSteps++;
  metrics.loopFreeSteps++;
  metrics.toolValidityRate = metrics.toolCallsValid / metrics.toolCallsTotal;
  metrics.lastUpdated = new Date().toISOString();
  saveMetrics(metrics);
}

/**
 * Record invalid tool call (ERR_TOOL_SCHEMA)
 */
export function recordToolCallInvalid(): void {
  const metrics = loadMetrics();
  metrics.toolCallsInvalid++;
  metrics.toolCallsTotal++;
  metrics.totalErrors++;
  metrics.errorFreeSteps = 0; // Reset streak
  metrics.toolValidityRate = metrics.toolCallsValid / metrics.toolCallsTotal;
  metrics.lastUpdated = new Date().toISOString();
  saveMetrics(metrics);
}

/**
 * Record loop detection (ERR_LOOP_OPERATIONAL)
 */
export function recordLoopDetection(): void {
  const metrics = loadMetrics();
  metrics.loopDetections++;
  metrics.totalErrors++;
  metrics.loopFreeSteps = 0; // Reset streak
  metrics.errorFreeSteps = 0;
  metrics.lastUpdated = new Date().toISOString();
  saveMetrics(metrics);
}

/**
 * Record consolidation attempt
 */
export function recordConsolidation(episodesProcessed: number, conceptsCreated: number): void {
  const metrics = loadMetrics();
  metrics.consolidationAttempts++;

  if (conceptsCreated > 0) {
    metrics.consolidationSuccesses++;
  }

  // Update yield (running average)
  const newYield = episodesProcessed > 0 ? conceptsCreated / episodesProcessed : 0;
  metrics.consolidationYield =
    (metrics.consolidationYield * (metrics.consolidationAttempts - 1) + newYield) /
    metrics.consolidationAttempts;

  metrics.lastUpdated = new Date().toISOString();
  saveMetrics(metrics);
}

/**
 * Record test results
 */
export function recordTestResults(passed: number, failed: number): void {
  const metrics = loadMetrics();
  metrics.testsPassed += passed;
  metrics.testsFailed += failed;

  const total = metrics.testsPassed + metrics.testsFailed;
  metrics.testPassRate = total > 0 ? metrics.testsPassed / total : 1.0;

  if (failed > 0) {
    metrics.totalErrors += failed;
    metrics.errorFreeSteps = 0;
  }

  metrics.lastUpdated = new Date().toISOString();
  saveMetrics(metrics);
}

/**
 * Update cognitive health metrics
 */
export function updateCognitiveHealth(freeEnergy: number, cognitiveLoad: number): void {
  const metrics = loadMetrics();

  // Running average
  const alpha = 0.1; // Smoothing factor
  metrics.freeEnergyAvg = alpha * freeEnergy + (1 - alpha) * metrics.freeEnergyAvg;
  metrics.cognitiveLoadAvg = alpha * cognitiveLoad + (1 - alpha) * metrics.cognitiveLoadAvg;

  metrics.lastUpdated = new Date().toISOString();
  saveMetrics(metrics);
}

/**
 * Get current metrics with derived values
 */
export function getMetrics(C_potential: number = 0.8): {
  performance: PerformanceMetrics;
  derived: DerivedMetrics
} {
  const performance = loadMetrics();
  const derived = computeDerivedMetrics(performance, C_potential);
  return { performance, derived };
}

/**
 * Take snapshot and save to history
 */
export function takeSnapshot(C_potential: number = 0.8): void {
  const { performance, derived } = getMetrics(C_potential);

  const snapshot: MetricsSnapshot = {
    timestamp: new Date().toISOString(),
    metrics: performance,
    derived,
  };

  try {
    let history: MetricsSnapshot[] = [];

    if (fs.existsSync(HISTORY_FILE)) {
      const data = fs.readFileSync(HISTORY_FILE, 'utf-8');
      history = JSON.parse(data);
    }

    history.push(snapshot);

    // Keep only last MAX_HISTORY snapshots
    if (history.length > MAX_HISTORY) {
      history = history.slice(-MAX_HISTORY);
    }

    fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
  } catch (e) {
    console.error('Failed to save snapshot:', e);
  }
}

/**
 * Reset metrics (for testing or after rollback)
 */
export function resetMetrics(): void {
  saveMetrics(createEmptyMetrics());
}

/**
 * Generate metrics report
 */
export function generateReport(C_potential: number = 0.8): string {
  const { performance, derived } = getMetrics(C_potential);

  return `
╔══════════════════════════════════════════════════════════╗
║           NOUS PERFORMANCE METRICS REPORT                ║
╠══════════════════════════════════════════════════════════╣

DERIVED METRICS (Non-Manipulable):
  Trust (Earned):        ${(derived.trust * 100).toFixed(1)}%
  C_effective:           ${(derived.C_effective * 100).toFixed(1)}% (potential: ${(C_potential * 100).toFixed(0)}%)
  Stability:             ${(derived.stability * 100).toFixed(1)}%
  Readiness:             ${derived.readiness.toUpperCase()}

TOOL EXECUTION:
  Valid calls:           ${performance.toolCallsValid}
  Invalid calls:         ${performance.toolCallsInvalid}
  Validity rate:         ${(performance.toolValidityRate * 100).toFixed(1)}%

LOOP & ERROR TRACKING:
  Loop detections:       ${performance.loopDetections}
  Loop-free steps:       ${performance.loopFreeSteps}
  Error-free steps:      ${performance.errorFreeSteps}
  Total errors:          ${performance.totalErrors}

CONSOLIDATION:
  Attempts:              ${performance.consolidationAttempts}
  Successes:             ${performance.consolidationSuccesses}
  Yield:                 ${(performance.consolidationYield * 100).toFixed(1)}%

TESTS:
  Passed:                ${performance.testsPassed}
  Failed:                ${performance.testsFailed}
  Pass rate:             ${(performance.testPassRate * 100).toFixed(1)}%

COGNITIVE HEALTH:
  Free Energy (avg):     ${performance.freeEnergyAvg.toFixed(3)}
  Cognitive Load (avg):  ${(performance.cognitiveLoadAvg * 100).toFixed(1)}%

LAST UPDATED: ${new Date(performance.lastUpdated).toLocaleString()}

╚══════════════════════════════════════════════════════════╝
`;
}
