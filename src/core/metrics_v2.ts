/**
 * NOUS Performance Metrics V2 - Recalibrated Trust System
 *
 * Key fixes:
 * 1. Minimum window: 30 actions before trust is meaningful
 * 2. EMA smoothing to prevent inflation
 * 3. Split trust: readonly / write / core
 * 4. Persistent loop history
 */

import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// INTERFACES
// ============================================================================

export interface PerformanceMetrics {
  // Tool execution quality
  toolCallsValid: number;
  toolCallsInvalid: number;
  toolCallsTotal: number;
  toolValidityRate: number;

  // Split by risk level (for trust calculation)
  readonlyCallsTotal: number;   // read_file, list_files, grep, run_command(readonly)
  writeCallsTotal: number;      // write_file, run_command(write/execute)
  coreCallsTotal: number;       // modify_self_config, operations with test validation

  readonlyCallsValid: number;
  writeCallsValid: number;
  coreCallsValid: number;

  // Loop detection
  loopDetections: number;
  loopFreeSteps: number;

  // Consolidation efficiency
  consolidationAttempts: number;
  consolidationSuccesses: number;
  consolidationYield: number;

  // Error tracking
  errorFreeSteps: number;
  totalErrors: number;

  // Test results
  testsPassed: number;
  testsFailed: number;
  testPassRate: number;

  // Cognitive health
  freeEnergyAvg: number;
  cognitiveLoadAvg: number;

  // EMA state
  trustEMA: number;             // Previous trust for smoothing

  // Timestamps
  lastUpdated: string;
  windowStart: string;
}

export interface TrustBreakdown {
  readonly: number;   // Trust from read-only operations
  write: number;      // Trust from write operations
  core: number;       // Trust from core/validated operations
  overall: number;    // Weighted average
}

export interface DerivedMetrics {
  trust: number;              // Overall trust (with EMA smoothing)
  trustBreakdown: TrustBreakdown;
  C_effective: number;
  stability: number;
  readiness: 'degraded' | 'stable' | 'excellent';
  hasMinimumData: boolean;    // true if >= 30 operations
}

// Loop history (persistent across agent invocations)
export interface ToolCallRecord {
  tool: string;
  params: string;
  outcome: string;
  timestamp: string;
}

const METRICS_FILE = path.join(process.cwd(), 'data', 'metrics_v2.json');
const LOOP_HISTORY_FILE = path.join(process.cwd(), 'data', 'loop_history.json');
const MAX_LOOP_HISTORY = 200;  // Decay: keep only last 200 events to prevent false positives

// ============================================================================
// CONFIGURATION
// ============================================================================

const MIN_OPERATIONS_FOR_TRUST = 30;   // No trust until 30 operations
const EMA_ALPHA = 0.15;                 // Smoothing factor (0.15 = slow adaptation)

// Trust weights for different operation types
const TRUST_WEIGHTS = {
  readonly: 0.2,   // Low weight (easy to get right)
  write: 0.3,      // Medium weight (more risky)
  core: 0.5,       // High weight (critical operations)
};

// Minimum evidence thresholds (prevent "trust farming" on easy operations)
const MIN_WRITE_OPS_FOR_TIER2 = 5;   // trust > 30% requires at least 5 successful write ops
const MIN_CORE_OPS_FOR_TIER3 = 3;    // trust > 60% requires at least 3 successful core ops

// ============================================================================
// STORAGE
// ============================================================================

function initializeMetrics(): PerformanceMetrics {
  return {
    toolCallsValid: 0,
    toolCallsInvalid: 0,
    toolCallsTotal: 0,
    toolValidityRate: 1.0,

    readonlyCallsTotal: 0,
    writeCallsTotal: 0,
    coreCallsTotal: 0,

    readonlyCallsValid: 0,
    writeCallsValid: 0,
    coreCallsValid: 0,

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

    trustEMA: 0,

    lastUpdated: new Date().toISOString(),
    windowStart: new Date().toISOString(),
  };
}

export function loadMetrics(): PerformanceMetrics {
  if (fs.existsSync(METRICS_FILE)) {
    try {
      const data = fs.readFileSync(METRICS_FILE, 'utf-8');
      return JSON.parse(data);
    } catch (e) {
      // Corrupted, reset
    }
  }

  const metrics = initializeMetrics();
  saveMetrics(metrics);
  return metrics;
}

function saveMetrics(metrics: PerformanceMetrics): void {
  const dir = path.dirname(METRICS_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  metrics.lastUpdated = new Date().toISOString();

  // Update calculated fields
  metrics.toolValidityRate = metrics.toolCallsTotal > 0
    ? metrics.toolCallsValid / metrics.toolCallsTotal
    : 1.0;

  metrics.consolidationYield = metrics.consolidationAttempts > 0
    ? metrics.consolidationSuccesses / metrics.consolidationAttempts
    : 0;

  metrics.testPassRate = (metrics.testsPassed + metrics.testsFailed) > 0
    ? metrics.testsPassed / (metrics.testsPassed + metrics.testsFailed)
    : 1.0;

  fs.writeFileSync(METRICS_FILE, JSON.stringify(metrics, null, 2), 'utf-8');
}

// ============================================================================
// LOOP HISTORY (Persistent)
// ============================================================================

export function loadLoopHistory(): ToolCallRecord[] {
  if (fs.existsSync(LOOP_HISTORY_FILE)) {
    try {
      const data = fs.readFileSync(LOOP_HISTORY_FILE, 'utf-8');
      return JSON.parse(data);
    } catch (e) {
      return [];
    }
  }
  return [];
}

function saveLoopHistory(history: ToolCallRecord[]): void {
  const dir = path.dirname(LOOP_HISTORY_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(LOOP_HISTORY_FILE, JSON.stringify(history, null, 2), 'utf-8');
}

export function recordToolCallInLoopHistory(tool: string, params: string, outcome: string): void {
  const history = loadLoopHistory();
  history.push({
    tool,
    params,
    outcome,
    timestamp: new Date().toISOString()
  });

  // Keep only last MAX_LOOP_HISTORY
  if (history.length > MAX_LOOP_HISTORY) {
    history.splice(0, history.length - MAX_LOOP_HISTORY);
  }

  saveLoopHistory(history);
}

export function checkForOperationalLoop(tool: string, params: string, outcome: string): boolean {
  const history = loadLoopHistory();

  // Check recent window (last 20 calls, increased from 10)
  // Why 20: with 200-event history, checking last 10 is too narrow
  // If system does 100 varied ops, then repeats same 3x, we want to catch it
  const recentWindow = history.slice(-20);
  const matches = recentWindow.filter(call =>
    call.tool === tool &&
    call.params === params &&
    call.outcome === outcome
  );

  return matches.length >= 3;
}

// ============================================================================
// TRUST CALCULATION V2
// ============================================================================

export function computeDerivedMetrics(metrics: PerformanceMetrics, C_potential: number = 0.8): DerivedMetrics {
  const hasMinimumData = metrics.toolCallsTotal >= MIN_OPERATIONS_FOR_TRUST;

  // If not enough data, return cold start values
  if (!hasMinimumData) {
    return {
      trust: 0,
      trustBreakdown: {
        readonly: 0,
        write: 0,
        core: 0,
        overall: 0
      },
      C_effective: 0.65,  // Base C_effective
      stability: 0.35,
      readiness: 'degraded',
      hasMinimumData: false
    };
  }

  // ==================== TRUST BREAKDOWN ====================

  // 1. Trust from readonly operations (easy)
  const trust_readonly = metrics.readonlyCallsTotal > 0
    ? metrics.readonlyCallsValid / metrics.readonlyCallsTotal
    : 1.0;

  // 2. Trust from write operations (medium risk)
  const trust_write = metrics.writeCallsTotal > 0
    ? metrics.writeCallsValid / metrics.writeCallsTotal
    : 1.0;

  // 3. Trust from core operations (high risk)
  const trust_core = metrics.coreCallsTotal > 0
    ? metrics.coreCallsValid / metrics.coreCallsTotal
    : 1.0;

  // Weighted average
  const trust_base = (
    trust_readonly * TRUST_WEIGHTS.readonly +
    trust_write * TRUST_WEIGHTS.write +
    trust_core * TRUST_WEIGHTS.core
  );

  // Apply penalties
  const loopPenalty = 1 - Math.min(1, metrics.loopDetections / 10);
  const errorPenalty = 1 - Math.min(1, metrics.totalErrors / 20);
  const stabilityBonus = Math.min(1, metrics.loopFreeSteps / 100); // Slower scaling

  let trust_calculated = trust_base * loopPenalty * errorPenalty * stabilityBonus;

  // ==================== MINIMUM EVIDENCE THRESHOLDS ====================
  // Prevent "trust farming" on readonly operations

  // Tier 1 (0-30%): Can be achieved with readonly only
  // Tier 2 (30-60%): Requires at least MIN_WRITE_OPS_FOR_TIER2 successful write ops
  if (trust_calculated > 0.30 && metrics.writeCallsValid < MIN_WRITE_OPS_FOR_TIER2) {
    trust_calculated = Math.min(trust_calculated, 0.30);
  }

  // Tier 3 (60%+): Requires at least MIN_CORE_OPS_FOR_TIER3 successful core ops
  if (trust_calculated > 0.60 && metrics.coreCallsValid < MIN_CORE_OPS_FOR_TIER3) {
    trust_calculated = Math.min(trust_calculated, 0.60);
  }

  // Apply EMA smoothing
  const trust = EMA_ALPHA * trust_calculated + (1 - EMA_ALPHA) * metrics.trustEMA;

  // Update EMA state
  metrics.trustEMA = trust;
  saveMetrics(metrics);

  // ==================== C_EFFECTIVE ====================

  const stabilityFactors = [
    metrics.toolValidityRate >= 0.95 ? 1.0 : 0.5,
    metrics.loopDetections === 0 ? 1.0 : 0.0,
    metrics.errorFreeSteps >= 20 ? 1.0 : metrics.errorFreeSteps / 20,
    metrics.consolidationYield >= 0.3 ? 1.0 : 0.5,
    metrics.freeEnergyAvg < 0.6 ? 1.0 : 0.7,
  ];

  const stabilityScore = stabilityFactors.reduce((a, b) => a + b, 0) / stabilityFactors.length;

  const C_base = 0.3;
  const C_effective = Math.min(
    C_potential,
    C_base + (C_potential - C_base) * stabilityScore
  );

  // ==================== OVERALL STABILITY ====================

  const stability = (trust + stabilityScore) / 2;

  // ==================== READINESS ====================

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
    trustBreakdown: {
      readonly: trust_readonly,
      write: trust_write,
      core: trust_core,
      overall: trust_base
    },
    C_effective: Math.max(0, Math.min(1, C_effective)),
    stability: Math.max(0, Math.min(1, stability)),
    readiness,
    hasMinimumData: true
  };
}

// ============================================================================
// RECORDING FUNCTIONS
// ============================================================================

export type ToolRiskLevel = 'readonly' | 'write' | 'core';

export function recordToolCallValid(riskLevel: ToolRiskLevel = 'readonly'): void {
  const metrics = loadMetrics();
  metrics.toolCallsValid++;
  metrics.toolCallsTotal++;
  metrics.errorFreeSteps++;
  metrics.loopFreeSteps++;

  // Track by risk level
  if (riskLevel === 'readonly') {
    metrics.readonlyCallsTotal++;
    metrics.readonlyCallsValid++;
  } else if (riskLevel === 'write') {
    metrics.writeCallsTotal++;
    metrics.writeCallsValid++;
  } else if (riskLevel === 'core') {
    metrics.coreCallsTotal++;
    metrics.coreCallsValid++;
  }

  saveMetrics(metrics);
}

export function recordToolCallInvalid(riskLevel: ToolRiskLevel = 'readonly'): void {
  const metrics = loadMetrics();
  metrics.toolCallsInvalid++;
  metrics.toolCallsTotal++;
  metrics.totalErrors++;
  metrics.errorFreeSteps = 0;

  // Track by risk level (invalid)
  if (riskLevel === 'readonly') {
    metrics.readonlyCallsTotal++;
  } else if (riskLevel === 'write') {
    metrics.writeCallsTotal++;
  } else if (riskLevel === 'core') {
    metrics.coreCallsTotal++;
  }

  saveMetrics(metrics);
}

export function recordLoopDetection(): void {
  const metrics = loadMetrics();
  metrics.loopDetections++;
  metrics.loopFreeSteps = 0;
  metrics.totalErrors++;
  saveMetrics(metrics);
}

export function recordConsolidation(episodesProcessed: number, conceptsCreated: number): void {
  const metrics = loadMetrics();
  metrics.consolidationAttempts++;

  if (conceptsCreated > 0) {
    metrics.consolidationSuccesses++;
  }

  // Update yield
  metrics.consolidationYield = conceptsCreated / Math.max(1, episodesProcessed);

  saveMetrics(metrics);
}

export function recordTestResults(passed: number, failed: number): void {
  const metrics = loadMetrics();
  metrics.testsPassed += passed;
  metrics.testsFailed += failed;
  saveMetrics(metrics);
}

export function updateCognitiveHealth(freeEnergy: number, cognitiveLoad: number): void {
  const metrics = loadMetrics();

  // Simple moving average (weight recent more)
  metrics.freeEnergyAvg = 0.7 * metrics.freeEnergyAvg + 0.3 * freeEnergy;
  metrics.cognitiveLoadAvg = 0.7 * metrics.cognitiveLoadAvg + 0.3 * cognitiveLoad;

  saveMetrics(metrics);
}

export function getMetrics(C_potential: number = 0.8): {
  performance: PerformanceMetrics;
  derived: DerivedMetrics;
} {
  const performance = loadMetrics();
  const derived = computeDerivedMetrics(performance, C_potential);
  return { performance, derived };
}

export function resetMetrics(): void {
  const metrics = initializeMetrics();
  saveMetrics(metrics);

  // Clear loop history
  saveLoopHistory([]);

  console.log('✓ Metrics reset to zero (V2)');
}

// ============================================================================
// REPORTING
// ============================================================================

export function generateReport(C_potential: number = 0.8): string {
  const { performance, derived } = getMetrics(C_potential);

  let report = '\n╔══════════════════════════════════════════════════════════╗\n';
  report += '║        NOUS PERFORMANCE METRICS V2 (RECALIBRATED)       ║\n';
  report += '╠══════════════════════════════════════════════════════════╣\n\n';

  if (!derived.hasMinimumData) {
    report += `⚠️  INSUFFICIENT DATA: Need ${MIN_OPERATIONS_FOR_TRUST} operations\n`;
    report += `   Current: ${performance.toolCallsTotal}\n`;
    report += `   Remaining: ${MIN_OPERATIONS_FOR_TRUST - performance.toolCallsTotal}\n\n`;
  }

  report += 'DERIVED METRICS (Non-Manipulable):\n';
  report += `  Trust (Earned):        ${(derived.trust * 100).toFixed(1)}%\n`;
  if (derived.hasMinimumData) {
    report += `    ├─ Readonly:         ${(derived.trustBreakdown.readonly * 100).toFixed(1)}% (weight: ${(TRUST_WEIGHTS.readonly * 100).toFixed(0)}%)\n`;
    report += `    ├─ Write:            ${(derived.trustBreakdown.write * 100).toFixed(1)}% (weight: ${(TRUST_WEIGHTS.write * 100).toFixed(0)}%)\n`;
    report += `    └─ Core:             ${(derived.trustBreakdown.core * 100).toFixed(1)}% (weight: ${(TRUST_WEIGHTS.core * 100).toFixed(0)}%)\n`;
  }
  report += `  C_effective:           ${(derived.C_effective * 100).toFixed(1)}% (potential: ${(C_potential * 100).toFixed(0)}%)\n`;
  report += `  Stability:             ${(derived.stability * 100).toFixed(1)}%\n`;
  report += `  Readiness:             ${derived.readiness.toUpperCase()}\n\n`;

  report += 'TOOL EXECUTION:\n';
  report += `  Valid calls:           ${performance.toolCallsValid}\n`;
  report += `  Invalid calls:         ${performance.toolCallsInvalid}\n`;
  report += `  Validity rate:         ${(performance.toolValidityRate * 100).toFixed(1)}%\n`;
  if (derived.hasMinimumData) {
    report += `    ├─ Readonly:         ${performance.readonlyCallsValid}/${performance.readonlyCallsTotal}\n`;
    report += `    ├─ Write:            ${performance.writeCallsValid}/${performance.writeCallsTotal}\n`;
    report += `    └─ Core:             ${performance.coreCallsValid}/${performance.coreCallsTotal}\n`;
  }
  report += '\n';

  report += 'LOOP & ERROR TRACKING:\n';
  report += `  Loop detections:       ${performance.loopDetections}\n`;
  report += `  Loop-free steps:       ${performance.loopFreeSteps}\n`;
  report += `  Error-free steps:      ${performance.errorFreeSteps}\n`;
  report += `  Total errors:          ${performance.totalErrors}\n\n`;

  report += 'CONSOLIDATION:\n';
  report += `  Attempts:              ${performance.consolidationAttempts}\n`;
  report += `  Successes:             ${performance.consolidationSuccesses}\n`;
  report += `  Yield:                 ${(performance.consolidationYield * 100).toFixed(1)}%\n\n`;

  report += 'TESTS:\n';
  report += `  Passed:                ${performance.testsPassed}\n`;
  report += `  Failed:                ${performance.testsFailed}\n`;
  report += `  Pass rate:             ${(performance.testPassRate * 100).toFixed(1)}%\n\n`;

  report += 'COGNITIVE HEALTH:\n';
  report += `  Free Energy (avg):     ${performance.freeEnergyAvg.toFixed(3)}\n`;
  report += `  Cognitive Load (avg):  ${(performance.cognitiveLoadAvg * 100).toFixed(1)}%\n\n`;

  const lastUpdate = new Date(performance.lastUpdated);
  report += `LAST UPDATED: ${lastUpdate.toLocaleString('en-GB', { timeZone: 'Europe/Rome' })}\n\n`;

  report += '╚══════════════════════════════════════════════════════════╝\n';

  return report;
}
