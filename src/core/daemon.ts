/**
 * NOUS Daemon Mode
 *
 * Runs NOUS in the background, allowing it to:
 * - Periodically analyze and improve itself
 * - Process queued tasks
 * - Monitor for triggers
 *
 * Usage:
 *   nous daemon start     - Start daemon
 *   nous daemon stop      - Stop daemon
 *   nous daemon status    - Check daemon status
 */

import * as fs from 'fs';
import * as path from 'path';
import { loadSelf, modifySelf, increaseTrust } from './self';
import { getMemory } from '../memory/store';
import { selfImprovementCycle, analyzeForImprovements } from './improve';
import { ask } from '../llm';

/**
 * Daemon configuration
 */
export interface DaemonConfig {
  enabled: boolean;
  intervalMinutes: number;
  autoImprove: boolean;
  maxImprovementsPerCycle: number;
  logFile: string;
  pidFile: string;
}

/**
 * Default daemon config
 */
const DEFAULT_DAEMON_CONFIG: DaemonConfig = {
  enabled: false,
  intervalMinutes: 60, // Every hour
  autoImprove: true,
  maxImprovementsPerCycle: 2,
  logFile: 'data/daemon.log',
  pidFile: 'data/daemon.pid',
};

/**
 * Get daemon config from self
 */
export function getDaemonConfig(): DaemonConfig {
  const self = loadSelf();
  return {
    ...DEFAULT_DAEMON_CONFIG,
    ...(self as any).daemon,
  };
}

/**
 * Log daemon activity
 */
function daemonLog(message: string): void {
  const config = getDaemonConfig();
  const timestamp = new Date().toISOString();
  const logLine = `[${timestamp}] ${message}\n`;

  console.log(logLine.trim());

  try {
    const logPath = path.join(process.cwd(), config.logFile);
    const dir = path.dirname(logPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.appendFileSync(logPath, logLine);
  } catch (e) {
    // Ignore log errors
  }
}

/**
 * Check if daemon is running
 */
export function isDaemonRunning(): boolean {
  const config = getDaemonConfig();
  const pidPath = path.join(process.cwd(), config.pidFile);

  if (!fs.existsSync(pidPath)) {
    return false;
  }

  try {
    const pid = parseInt(fs.readFileSync(pidPath, 'utf-8').trim());
    // Check if process exists
    process.kill(pid, 0);
    return true;
  } catch (e) {
    // Process doesn't exist, clean up stale PID file
    try {
      fs.unlinkSync(pidPath);
    } catch (_) {}
    return false;
  }
}

/**
 * Get daemon status
 */
export function getDaemonStatus(): {
  running: boolean;
  pid?: number;
  config: DaemonConfig;
  lastActivity?: string;
} {
  const config = getDaemonConfig();
  const pidPath = path.join(process.cwd(), config.pidFile);
  const logPath = path.join(process.cwd(), config.logFile);

  let pid: number | undefined;
  let lastActivity: string | undefined;

  if (fs.existsSync(pidPath)) {
    try {
      pid = parseInt(fs.readFileSync(pidPath, 'utf-8').trim());
    } catch (e) {}
  }

  if (fs.existsSync(logPath)) {
    try {
      const lines = fs.readFileSync(logPath, 'utf-8').trim().split('\n');
      lastActivity = lines[lines.length - 1];
    } catch (e) {}
  }

  return {
    running: isDaemonRunning(),
    pid,
    config,
    lastActivity,
  };
}

/**
 * Single daemon tick
 */
async function daemonTick(): Promise<void> {
  const self = loadSelf();
  const memory = getMemory();
  const config = getDaemonConfig();

  daemonLog('Daemon tick starting...');

  try {
    // Check if auto-improve is enabled
    if (config.autoImprove && self.approval.trustLevel >= 0.3) {
      daemonLog('Running self-improvement analysis...');

      // Analyze for improvements
      const suggestions = await analyzeForImprovements();

      if (suggestions.length > 0) {
        daemonLog(`Found ${suggestions.length} potential improvements`);

        // Run improvement cycle (limited)
        const result = await selfImprovementCycle(
          suggestions[0] // Just try the first one
        );

        daemonLog(`Improvement cycle complete: ${result.implemented} implemented`);

        // If successful, slightly increase trust
        if (result.implemented > 0) {
          await increaseTrust(0.005);
          daemonLog('Trust increased by 0.5%');
        }
      } else {
        daemonLog('No improvements identified this cycle');
      }
    } else {
      daemonLog(`Auto-improve disabled or trust too low (${(self.approval.trustLevel * 100).toFixed(0)}%)`);
    }

    // Record activity
    memory.addInsight(
      'Daemon tick completed successfully',
      'daemon',
      'pattern',
      0.3
    );

  } catch (error: any) {
    daemonLog(`Error in daemon tick: ${error.message}`);
  }

  daemonLog('Daemon tick complete');
}

/**
 * Start the daemon
 */
export async function startDaemon(): Promise<void> {
  if (isDaemonRunning()) {
    console.log('Daemon is already running');
    return;
  }

  const config = getDaemonConfig();
  const pidPath = path.join(process.cwd(), config.pidFile);

  // Write PID file
  const dir = path.dirname(pidPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(pidPath, process.pid.toString());

  // Update config
  await modifySelf(
    { daemon: { ...config, enabled: true } },
    'Enable daemon mode'
  );

  daemonLog('NOUS daemon started');
  console.log(`NOUS daemon started (PID: ${process.pid})`);
  console.log(`Interval: ${config.intervalMinutes} minutes`);
  console.log(`Auto-improve: ${config.autoImprove}`);

  // Run first tick
  await daemonTick();

  // Schedule periodic ticks
  const intervalMs = config.intervalMinutes * 60 * 1000;
  setInterval(async () => {
    await daemonTick();
  }, intervalMs);

  // Keep process alive
  process.on('SIGINT', () => {
    daemonLog('Daemon received SIGINT, shutting down...');
    stopDaemon();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    daemonLog('Daemon received SIGTERM, shutting down...');
    stopDaemon();
    process.exit(0);
  });

  // Prevent exit
  console.log('\nDaemon running. Press Ctrl+C to stop.\n');
}

/**
 * Stop the daemon
 */
export function stopDaemon(): void {
  const config = getDaemonConfig();
  const pidPath = path.join(process.cwd(), config.pidFile);

  if (fs.existsSync(pidPath)) {
    try {
      const pid = parseInt(fs.readFileSync(pidPath, 'utf-8').trim());

      // Try to kill the process
      try {
        process.kill(pid, 'SIGTERM');
        console.log(`Daemon stopped (PID: ${pid})`);
      } catch (e) {
        console.log('Daemon was not running');
      }

      // Remove PID file
      fs.unlinkSync(pidPath);
    } catch (e) {
      console.log('Error stopping daemon');
    }
  } else {
    console.log('Daemon is not running');
  }

  daemonLog('NOUS daemon stopped');
}

/**
 * Run daemon once (for testing)
 */
export async function runOnce(): Promise<void> {
  console.log('Running single daemon cycle...\n');
  await daemonTick();
  console.log('\nCycle complete.');
}
