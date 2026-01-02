/**
 * NOUS Automatic Rollback Guard
 *
 * Automatically rolls back self-modifications if metrics degrade.
 * No human intervention required - fully automatic safety mechanism.
 *
 * Philosophy:
 * - If you make yourself worse, go back
 * - Metrics don't lie
 * - Rollback is not failure, it's learning
 */

import * as fs from 'fs';
import * as path from 'path';
import { getMetrics, DerivedMetrics, PerformanceMetrics } from './metrics_v2';
import { loadSelf, saveSelf, SelfConfig } from './self';

interface RollbackSnapshot {
  timestamp: string;
  selfConfig: SelfConfig;
  metrics: PerformanceMetrics;
  derived: DerivedMetrics;
  reason: string;
}

const SNAPSHOTS_FILE = path.join(process.cwd(), 'data', 'rollback_snapshots.json');
const MAX_SNAPSHOTS = 10;

/**
 * Take snapshot before self-modification
 */
export function takeRollbackSnapshot(reason: string): void {
  const self = loadSelf();
  const { performance, derived } = getMetrics(0.8);

  const snapshot: RollbackSnapshot = {
    timestamp: new Date().toISOString(),
    selfConfig: JSON.parse(JSON.stringify(self)), // Deep copy
    metrics: performance,
    derived,
    reason,
  };

  try {
    let snapshots: RollbackSnapshot[] = [];

    if (fs.existsSync(SNAPSHOTS_FILE)) {
      const data = fs.readFileSync(SNAPSHOTS_FILE, 'utf-8');
      snapshots = JSON.parse(data);
    }

    snapshots.push(snapshot);

    // Keep only last MAX_SNAPSHOTS
    if (snapshots.length > MAX_SNAPSHOTS) {
      snapshots = snapshots.slice(-MAX_SNAPSHOTS);
    }

    const dir = path.dirname(SNAPSHOTS_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(SNAPSHOTS_FILE, JSON.stringify(snapshots, null, 2));

    console.log(`📸 Rollback snapshot taken: ${reason}`);
  } catch (e) {
    console.error('Failed to take rollback snapshot:', e);
  }
}

/**
 * Check if metrics have degraded significantly
 */
function hasMetricsDegraded(before: DerivedMetrics, after: DerivedMetrics): {
  degraded: boolean;
  reasons: string[];
} {
  const reasons: string[] = [];

  // Trust degradation (>20% drop)
  if (after.trust < before.trust * 0.8) {
    reasons.push(`Trust dropped ${((1 - after.trust / before.trust) * 100).toFixed(0)}%`);
  }

  // C_effective degradation (>15% drop)
  if (after.C_effective < before.C_effective * 0.85) {
    reasons.push(`C_effective dropped ${((1 - after.C_effective / before.C_effective) * 100).toFixed(0)}%`);
  }

  // Stability degradation (>25% drop)
  if (after.stability < before.stability * 0.75) {
    reasons.push(`Stability dropped ${((1 - after.stability / before.stability) * 100).toFixed(0)}%`);
  }

  // Readiness degradation (went from excellent/stable to degraded)
  if (before.readiness !== 'degraded' && after.readiness === 'degraded') {
    reasons.push(`Readiness degraded to: ${after.readiness}`);
  }

  return {
    degraded: reasons.length > 0,
    reasons,
  };
}

/**
 * Check if rollback is needed and execute automatically
 */
export function checkAndRollbackIfNeeded(): {
  rolledBack: boolean;
  reason?: string;
} {
  try {
    if (!fs.existsSync(SNAPSHOTS_FILE)) {
      return { rolledBack: false };
    }

    const data = fs.readFileSync(SNAPSHOTS_FILE, 'utf-8');
    const snapshots: RollbackSnapshot[] = JSON.parse(data);

    if (snapshots.length === 0) {
      return { rolledBack: false };
    }

    // Get last snapshot (before modification)
    const lastSnapshot = snapshots[snapshots.length - 1];

    // Get current metrics
    const { derived: currentDerived } = getMetrics(0.8);

    // Check for degradation
    const { degraded, reasons } = hasMetricsDegraded(
      lastSnapshot.derived,
      currentDerived
    );

    if (degraded) {
      // AUTOMATIC ROLLBACK
      console.log('\n🔴 AUTOMATIC ROLLBACK TRIGGERED');
      console.log('━'.repeat(50));
      console.log(`Metrics degraded after: ${lastSnapshot.reason}`);
      console.log(`Degradation reasons:\n  - ${reasons.join('\n  - ')}`);
      console.log('\nRestoring previous configuration...');

      // Restore config
      saveSelf(lastSnapshot.selfConfig);

      console.log('✓ Configuration restored');
      console.log('━'.repeat(50));

      return {
        rolledBack: true,
        reason: `Metrics degraded: ${reasons.join('; ')}`,
      };
    }

    return { rolledBack: false };
  } catch (e) {
    console.error('Rollback check failed:', e);
    return { rolledBack: false };
  }
}

/**
 * Manual rollback to specific snapshot
 */
export function rollbackToSnapshot(index: number): boolean {
  try {
    if (!fs.existsSync(SNAPSHOTS_FILE)) {
      console.log('No rollback snapshots available');
      return false;
    }

    const data = fs.readFileSync(SNAPSHOTS_FILE, 'utf-8');
    const snapshots: RollbackSnapshot[] = JSON.parse(data);

    if (index < 0 || index >= snapshots.length) {
      console.log(`Invalid snapshot index: ${index} (available: 0-${snapshots.length - 1})`);
      return false;
    }

    const snapshot = snapshots[index];

    console.log(`\n🔄 Rolling back to snapshot ${index}:`);
    console.log(`  Timestamp: ${new Date(snapshot.timestamp).toLocaleString()}`);
    console.log(`  Reason: ${snapshot.reason}`);

    // Restore config
    saveSelf(snapshot.selfConfig);

    console.log('✓ Rollback complete\n');
    return true;
  } catch (e) {
    console.error('Rollback failed:', e);
    return false;
  }
}

/**
 * List available snapshots
 */
export function listSnapshots(): RollbackSnapshot[] {
  try {
    if (!fs.existsSync(SNAPSHOTS_FILE)) {
      return [];
    }

    const data = fs.readFileSync(SNAPSHOTS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (e) {
    console.error('Failed to list snapshots:', e);
    return [];
  }
}

/**
 * Clear all snapshots (for testing)
 */
export function clearSnapshots(): void {
  try {
    if (fs.existsSync(SNAPSHOTS_FILE)) {
      fs.unlinkSync(SNAPSHOTS_FILE);
    }
    console.log('✓ Rollback snapshots cleared');
  } catch (e) {
    console.error('Failed to clear snapshots:', e);
  }
}
