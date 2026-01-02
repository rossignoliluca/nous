/**
 * NOUS Exploration Budget System
 *
 * Dynamic risk allocation with automatic ceiling adjustment.
 *
 * Philosophy:
 * - Risk is admitted, but only if rare, tracked, and reversible
 * - The ceiling auto-raises based on demonstrated stability
 * - Descent is faster than ascent (asymmetric response)
 * - Exploration enables C, doesn't inflate it artificially
 *
 * Key principle: "Il rischio è alto abbastanza da imparare,
 *                 ma mai abbastanza da dominare il sistema."
 */

import * as fs from 'fs';
import * as path from 'path';

/**
 * Exploration budget configuration
 */
export interface ExplorationConfig {
  floor: number;           // Min: 5%
  target: number;          // Normal: 7%
  ceiling: number;         // Max: 12%
  current: number;         // Current budget
  stepUp: number;          // +1% per window
  stepDownSoft: number;    // -2% for minor issues
  stepDownHard: number;    // -3% for critical issues
  windowActions: number;   // 100 actions per window
  actionsInWindow: number; // Counter
  riskyActionsInWindow: number; // Risky actions taken
}

/**
 * Action risk assessment
 */
export type RiskLevel = 'safe' | 'risky';

export interface RiskyAction {
  timestamp: string;
  action: string;
  reason: string;
  success: boolean;
  rolledBack: boolean;
}

/**
 * Exploration state
 */
interface ExplorationState {
  config: ExplorationConfig;
  history: RiskyAction[];
  lastAdjustment: string;
}

const STATE_PATH = path.join(process.cwd(), 'data', 'exploration.json');

/**
 * Default configuration
 */
const DEFAULT_CONFIG: ExplorationConfig = {
  floor: 0.05,           // 5% minimum
  target: 0.07,          // 7% normal
  ceiling: 0.12,         // 12% maximum
  current: 0.07,         // Start at target
  stepUp: 0.01,          // +1% per window
  stepDownSoft: 0.02,    // -2% soft
  stepDownHard: 0.03,    // -3% hard
  windowActions: 100,    // 100 actions per window
  actionsInWindow: 0,
  riskyActionsInWindow: 0
};

/**
 * Load exploration state
 */
function loadState(): ExplorationState {
  if (fs.existsSync(STATE_PATH)) {
    try {
      const data = fs.readFileSync(STATE_PATH, 'utf-8');
      return JSON.parse(data);
    } catch (e) {
      // Corrupted, reset
    }
  }

  return {
    config: { ...DEFAULT_CONFIG },
    history: [],
    lastAdjustment: new Date().toISOString()
  };
}

/**
 * Save exploration state
 */
function saveState(state: ExplorationState): void {
  const dir = path.dirname(STATE_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2), 'utf-8');
}

/**
 * Get current exploration budget
 */
export function getExplorationBudget(): number {
  const state = loadState();
  return state.config.current;
}

/**
 * Check if risky action is allowed
 */
export function canTakeRisk(): { allowed: boolean; reason?: string; budget: number } {
  const state = loadState();
  const { config } = state;

  // Handle initial state: if no actions taken yet, allow risky actions
  const usedPercent = config.actionsInWindow > 0
    ? config.riskyActionsInWindow / config.actionsInWindow
    : 0;

  const allowed = usedPercent < config.current;

  return {
    allowed,
    reason: allowed ? undefined : `Exploration budget exhausted (${(usedPercent * 100).toFixed(1)}% of ${(config.current * 100).toFixed(0)}% used)`,
    budget: config.current
  };
}

/**
 * Record an action (risky or safe)
 */
export function recordAction(risk: RiskLevel, details?: {
  action: string;
  success: boolean;
  rolledBack: boolean;
}): void {
  const state = loadState();
  const { config } = state;

  config.actionsInWindow++;

  if (risk === 'risky' && details) {
    config.riskyActionsInWindow++;
    state.history.push({
      timestamp: new Date().toISOString(),
      action: details.action,
      reason: 'Exploration',
      success: details.success,
      rolledBack: details.rolledBack
    });

    // Keep only last 500 risky actions
    if (state.history.length > 500) {
      state.history = state.history.slice(-500);
    }
  }

  // Check if window is complete
  if (config.actionsInWindow >= config.windowActions) {
    adjustBudget(state);
    // Reset window
    config.actionsInWindow = 0;
    config.riskyActionsInWindow = 0;
  }

  saveState(state);
}

/**
 * Adjust budget based on performance (auto-regulation)
 */
function adjustBudget(state: ExplorationState): void {
  const { config } = state;

  // Import metrics to check criteria
  const { getMetrics } = require('./metrics');
  const { performance, derived } = getMetrics(0.8);

  // Criteria for step UP (+1%)
  const canStepUp =
    performance.toolValidityRate === 100 &&
    performance.loopDetections === 0 &&
    derived.stability >= 0.65 &&
    performance.errorFreeSteps >= 30 &&
    config.current < config.ceiling;

  if (canStepUp) {
    const newBudget = Math.min(config.current + config.stepUp, config.ceiling);
    console.log(`\n🔼 Exploration budget increased: ${(config.current * 100).toFixed(0)}% → ${(newBudget * 100).toFixed(0)}%`);
    console.log('   Reason: Demonstrated stability across window\n');
    config.current = newBudget;
    state.lastAdjustment = new Date().toISOString();
    return;
  }

  // Criteria for step DOWN
  // Hard descent (-3%): critical errors
  if (performance.loopDetections > 0 || performance.toolValidityRate < 100) {
    const newBudget = Math.max(config.current - config.stepDownHard, config.floor);
    console.log(`\n🔻 Exploration budget decreased (HARD): ${(config.current * 100).toFixed(0)}% → ${(newBudget * 100).toFixed(0)}%`);
    console.log('   Reason: Critical error detected (loop or invalid tool)\n');
    config.current = newBudget;
    state.lastAdjustment = new Date().toISOString();
    return;
  }

  // Soft descent (-2%): minor issues
  if (derived.stability < 0.50) {
    const newBudget = Math.max(config.current - config.stepDownSoft, config.floor);
    console.log(`\n🔻 Exploration budget decreased (SOFT): ${(config.current * 100).toFixed(0)}% → ${(newBudget * 100).toFixed(0)}%`);
    console.log('   Reason: Stability below threshold\n');
    config.current = newBudget;
    state.lastAdjustment = new Date().toISOString();
    return;
  }

  // No change
  console.log(`\n➡️  Exploration budget maintained at ${(config.current * 100).toFixed(0)}%`);
}

/**
 * Force budget adjustment (for testing or manual intervention)
 */
export function adjustBudgetManual(direction: 'up' | 'down' | 'reset'): void {
  const state = loadState();
  const { config } = state;

  switch (direction) {
    case 'up':
      config.current = Math.min(config.current + config.stepUp, config.ceiling);
      break;
    case 'down':
      config.current = Math.max(config.current - config.stepDownSoft, config.floor);
      break;
    case 'reset':
      config.current = config.target;
      config.actionsInWindow = 0;
      config.riskyActionsInWindow = 0;
      break;
  }

  state.lastAdjustment = new Date().toISOString();
  saveState(state);
}

/**
 * Get exploration status
 */
export function getExplorationStatus(): {
  budget: number;
  floor: number;
  ceiling: number;
  actionsInWindow: number;
  riskyActionsInWindow: number;
  remainingActions: number;
  usedPercent: number;
  canExplore: boolean;
} {
  const state = loadState();
  const { config } = state;

  const usedPercent = config.actionsInWindow > 0
    ? config.riskyActionsInWindow / config.actionsInWindow
    : 0;

  return {
    budget: config.current,
    floor: config.floor,
    ceiling: config.ceiling,
    actionsInWindow: config.actionsInWindow,
    riskyActionsInWindow: config.riskyActionsInWindow,
    remainingActions: config.windowActions - config.actionsInWindow,
    usedPercent,
    canExplore: usedPercent < config.current
  };
}

/**
 * Get risky action history
 */
export function getRiskyActionHistory(limit: number = 20): RiskyAction[] {
  const state = loadState();
  return state.history.slice(-limit);
}

/**
 * Reset exploration system (for testing)
 */
export function resetExploration(): void {
  const state: ExplorationState = {
    config: { ...DEFAULT_CONFIG },
    history: [],
    lastAdjustment: new Date().toISOString()
  };
  saveState(state);
}

/**
 * Generate exploration report
 */
export function generateExplorationReport(): string {
  const state = loadState();
  const status = getExplorationStatus();
  const recentRisky = getRiskyActionHistory(10);

  const successRate = recentRisky.length > 0
    ? (recentRisky.filter(a => a.success).length / recentRisky.length) * 100
    : 0;

  const rollbackRate = recentRisky.length > 0
    ? (recentRisky.filter(a => a.rolledBack).length / recentRisky.length) * 100
    : 0;

  let report = '\n╔══════════════════════════════════════════════════════════╗\n';
  report += '║           EXPLORATION BUDGET REPORT                      ║\n';
  report += '╠══════════════════════════════════════════════════════════╣\n\n';

  report += 'CURRENT BUDGET:\n';
  report += `  Budget:                ${(status.budget * 100).toFixed(0)}%\n`;
  report += `  Floor:                 ${(status.floor * 100).toFixed(0)}%\n`;
  report += `  Ceiling:               ${(status.ceiling * 100).toFixed(0)}%\n`;
  report += `  Can explore:           ${status.canExplore ? 'YES' : 'NO'}\n\n`;

  report += 'CURRENT WINDOW:\n';
  report += `  Actions taken:         ${status.actionsInWindow}/${state.config.windowActions}\n`;
  report += `  Risky actions:         ${status.riskyActionsInWindow}\n`;
  report += `  Risk usage:            ${(status.usedPercent * 100).toFixed(1)}% of ${(status.budget * 100).toFixed(0)}%\n`;
  report += `  Remaining budget:      ${Math.max(0, (status.budget - status.usedPercent) * 100).toFixed(1)}%\n\n`;

  report += 'RECENT RISKY ACTIONS:\n';
  if (recentRisky.length === 0) {
    report += '  No risky actions yet\n';
  } else {
    report += `  Total tracked:         ${state.history.length}\n`;
    report += `  Success rate:          ${successRate.toFixed(0)}%\n`;
    report += `  Rollback rate:         ${rollbackRate.toFixed(0)}%\n\n`;

    report += '  Last 5 risky actions:\n';
    for (const action of recentRisky.slice(-5)) {
      const icon = action.success ? '✓' : '✗';
      const rollback = action.rolledBack ? ' [ROLLED BACK]' : '';
      report += `    ${icon} ${action.action}${rollback}\n`;
    }
  }

  report += '\n╚══════════════════════════════════════════════════════════╝\n';

  return report;
}
