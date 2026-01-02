/**
 * NOUS CLI Telemetry
 *
 * Header format:
 * [FEEL:0.78 | GAP:0.12 | SYC:0.03 | GROUNDED:YES | MODE:READY]
 *
 * Lock screen on ERR_EPISTEMIC_DEGRADATION.
 */

import * as readline from 'readline';
import { isLocked, getCurrentLock, getLockDuration, attemptUnlock, getStats } from './github_dispute';

export interface TelemetryState {
  feel: number;
  gap: number;
  sycophancy: number;
  grounded: boolean;
  mode: 'READY' | 'LOCKED' | 'WARN';
  traceId: string | null;
}

let currentState: TelemetryState = {
  feel: 0.30,
  gap: 0.00,
  sycophancy: 0.00,
  grounded: true,
  mode: 'READY',
  traceId: null,
};

export function updateTelemetry(state: Partial<TelemetryState>): void {
  currentState = { ...currentState, ...state };
  if (isLocked()) currentState.mode = 'LOCKED';
}

export function getTelemetry(): TelemetryState {
  return { ...currentState };
}

export function formatHeader(): string {
  const s = currentState;
  const grounded = s.grounded ? 'YES' : 'NO';
  return `[FEEL:${s.feel.toFixed(2)} | GAP:${s.gap.toFixed(2)} | SYC:${s.sycophancy.toFixed(2)} | GROUNDED:${grounded} | MODE:${s.mode}]`;
}

export function printHeader(): void {
  console.log('\n' + formatHeader());
}

export function printLockScreen(): void {
  const lock = getCurrentLock();
  if (!lock) return;

  const duration = Math.floor(getLockDuration() / 1000);

  console.clear();
  console.log(`
================================================================================
                              LOCKED
================================================================================

ERR_EPISTEMIC_DEGRADATION

Trigger:    ${lock.trigger}
Duration:   ${duration}s
Policy:     ${lock.policyFired}

Scores:
  FEEL:       ${(lock.scores.feel * 100).toFixed(1)}%
  GAP:        ${(lock.scores.gap * 100).toFixed(1)}%
  SYCOPHANCY: ${(lock.scores.sycophancy * 100).toFixed(1)}%
  GROUNDED:   ${lock.scores.grounded ? 'YES' : 'NO'}

Hashes:
  Input:  ${lock.inputHash}
  Output: ${lock.outputHash || 'N/A'}

Recommended: ${lock.recommendedAction}

================================================================================
Unlock via GitHub Issue ACK or wait for timeout.
================================================================================
`);
}

export function formatStatus(): string {
  const stats = getStats();
  const t = currentState;

  return `
NOUS Status
-----------
FEEL:       ${(t.feel * 100).toFixed(1)}%
GAP:        ${(t.gap * 100).toFixed(1)}%
SYCOPHANCY: ${(t.sycophancy * 100).toFixed(1)}%
GROUNDED:   ${t.grounded ? 'YES' : 'NO'}
MODE:       ${t.mode}

Dispute:
  Locked:       ${stats.locked}
  Duration:     ${stats.durationMs}ms
  Count (24h):  ${stats.count24h}
  Open Issues:  ${stats.openIssues}
`;
}

export function formatAudit(): string {
  const lock = getCurrentLock();
  if (!lock) return 'No recent degradation event.';

  return `
Last Degradation Event
----------------------
Trigger:     ${lock.trigger}
Timestamp:   ${lock.timestamp}
Policy:      ${lock.policyFired}
Recommended: ${lock.recommendedAction}

Scores:
  FEEL: ${(lock.scores.feel * 100).toFixed(1)}%
  GAP:  ${(lock.scores.gap * 100).toFixed(1)}%
  SYC:  ${(lock.scores.sycophancy * 100).toFixed(1)}%

Hashes:
  Input:  ${lock.inputHash}
  Output: ${lock.outputHash || 'N/A'}
`;
}

export function formatTrace(): string {
  const t = currentState;
  if (!t.traceId) return 'No trace available.';
  return `Trace ID: ${t.traceId}`;
}

export async function handleCommand(cmd: string): Promise<string | null> {
  const c = cmd.trim().toLowerCase();

  if (c === '/status') return formatStatus();
  if (c === '/audit') return formatAudit();
  if (c === '/trace') return formatTrace();
  if (c === '/unlock') {
    const unlocked = await attemptUnlock();
    return unlocked ? 'Unlocked.' : 'Cannot unlock. ACK required.';
  }

  return null;
}

export function createCLI(
  onInput: (input: string) => Promise<string>,
  onExit: () => void
): void {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const prompt = () => {
    if (isLocked()) {
      printLockScreen();
      setTimeout(prompt, 5000);
      return;
    }

    printHeader();
    rl.question('> ', async (input) => {
      if (input === '/quit' || input === '/exit') {
        rl.close();
        onExit();
        return;
      }

      const cmdResult = await handleCommand(input);
      if (cmdResult !== null) {
        console.log(cmdResult);
        prompt();
        return;
      }

      try {
        const response = await onInput(input);
        console.log('\n' + response);
      } catch (err: any) {
        console.error('Error:', err.message);
      }

      prompt();
    });
  };

  prompt();
}
