/**
 * NOUS GitHub Dispute Module
 *
 * Opens GitHub Issues for severe epistemic events.
 * Provides traceable conflict resolution outside the dialogue loop.
 *
 * Triggers:
 * - ERR_EPISTEMIC_DEGRADATION duration > 10min
 * - Same error 3+ times in 24h
 * - sycophancy >= 0.90
 * - grounding failure on critical actions
 *
 * Unlock: ACK_EPISTEMIC_DEGRADATION comment on issue
 */

import { Octokit } from '@octokit/rest';
import * as crypto from 'crypto';

export type DisputeTrigger =
  | 'ERR_EPISTEMIC_DEGRADATION'
  | 'SYCOPHANCY_CRITICAL'
  | 'GROUNDING_FAILURE'
  | 'POLICY_VIOLATION'
  | 'REPEATED_SILENCE';

export interface DisputeScores {
  feel: number;
  gap: number;
  sycophancy: number;
  grounded: boolean;
}

export interface DisputeEvent {
  trigger: DisputeTrigger;
  scores: DisputeScores;
  inputHash: string;
  outputHash: string | null;
  policyFired: string;
  recommendedAction: 'unlock_with_ack' | 'recalibrate_threshold' | 'dismiss_request';
  timestamp: string;
}

export interface DisputeIssue {
  number: number;
  url: string;
  state: 'open' | 'closed';
  acknowledged: boolean;
}

interface Config {
  owner: string;
  repo: string;
  enabled: boolean;
  thresholds: {
    sycophancyCritical: number;
    degradationDurationMs: number;
    repeatedSilenceCount: number;
  };
}

const CONFIG: Config = {
  owner: process.env.GITHUB_OWNER || '',
  repo: process.env.GITHUB_REPO || '',
  enabled: !!process.env.GITHUB_TOKEN,
  thresholds: {
    sycophancyCritical: 0.90,
    degradationDurationMs: 600000,
    repeatedSilenceCount: 3,
  },
};

interface State {
  currentLock: DisputeEvent | null;
  lockStartTime: number | null;
  silenceCount24h: number;
  lastSilenceTime: number;
  openIssues: Map<string, DisputeIssue>;
}

const state: State = {
  currentLock: null,
  lockStartTime: null,
  silenceCount24h: 0,
  lastSilenceTime: 0,
  openIssues: new Map(),
};

function getOctokit(): Octokit | null {
  const token = process.env.GITHUB_TOKEN;
  if (!token) return null;
  return new Octokit({ auth: token });
}

export function hashInput(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex').slice(0, 16);
}

export function hashOutput(output: string | null): string | null {
  if (!output) return null;
  return crypto.createHash('sha256').update(output).digest('hex').slice(0, 16);
}

function buildIssueBody(event: DisputeEvent): string {
  return `## Epistemic Dispute

| Field | Value |
|-------|-------|
| Trigger | \`${event.trigger}\` |
| Timestamp | ${event.timestamp} |
| FEEL | ${(event.scores.feel * 100).toFixed(1)}% |
| GAP | ${(event.scores.gap * 100).toFixed(1)}% |
| SYCOPHANCY | ${(event.scores.sycophancy * 100).toFixed(1)}% |
| GROUNDED | ${event.scores.grounded ? 'YES' : 'NO'} |
| Input Hash | \`${event.inputHash}\` |
| Output Hash | ${event.outputHash ? `\`${event.outputHash}\`` : 'N/A'} |
| Policy | \`${event.policyFired}\` |
| Recommended | \`${event.recommendedAction}\` |

### Unlock

Comment with: \`ACK_EPISTEMIC_DEGRADATION\`
`;
}

export function shouldOpenIssue(trigger: DisputeTrigger, scores: DisputeScores): boolean {
  if (trigger === 'SYCOPHANCY_CRITICAL' && scores.sycophancy >= CONFIG.thresholds.sycophancyCritical) return true;
  if (trigger === 'GROUNDING_FAILURE' && !scores.grounded) return true;
  if (trigger === 'POLICY_VIOLATION') return true;
  if (trigger === 'REPEATED_SILENCE' && state.silenceCount24h >= CONFIG.thresholds.repeatedSilenceCount) return true;
  if (trigger === 'ERR_EPISTEMIC_DEGRADATION' && state.lockStartTime) {
    if (Date.now() - state.lockStartTime > CONFIG.thresholds.degradationDurationMs) return true;
  }
  return false;
}

export async function openDispute(event: DisputeEvent): Promise<DisputeIssue | null> {
  const octokit = getOctokit();
  if (!octokit || !CONFIG.owner || !CONFIG.repo) return null;

  try {
    const response = await octokit.issues.create({
      owner: CONFIG.owner,
      repo: CONFIG.repo,
      title: `[DISPUTE] ${event.trigger} - ${event.timestamp.split('T')[0]}`,
      body: buildIssueBody(event),
      labels: ['dispute', event.trigger.toLowerCase()],
    });

    const issue: DisputeIssue = {
      number: response.data.number,
      url: response.data.html_url,
      state: 'open',
      acknowledged: false,
    };

    state.openIssues.set(event.inputHash, issue);
    return issue;
  } catch (error: any) {
    console.error('[DISPUTE]', error.message);
    return null;
  }
}

export async function checkAcknowledgment(issueNumber: number): Promise<boolean> {
  const octokit = getOctokit();
  if (!octokit) return false;

  try {
    const comments = await octokit.issues.listComments({
      owner: CONFIG.owner,
      repo: CONFIG.repo,
      issue_number: issueNumber,
    });
    return comments.data.some(c => c.body?.includes('ACK_EPISTEMIC_DEGRADATION'));
  } catch {
    return false;
  }
}

export async function closeDispute(issueNumber: number): Promise<boolean> {
  const octokit = getOctokit();
  if (!octokit) return false;

  try {
    await octokit.issues.update({
      owner: CONFIG.owner,
      repo: CONFIG.repo,
      issue_number: issueNumber,
      state: 'closed',
    });
    return true;
  } catch {
    return false;
  }
}

export function enterLock(event: DisputeEvent): void {
  state.currentLock = event;
  state.lockStartTime = Date.now();
  state.silenceCount24h++;
  state.lastSilenceTime = Date.now();
}

export function exitLock(): void {
  state.currentLock = null;
  state.lockStartTime = null;
}

export function isLocked(): boolean {
  return state.currentLock !== null;
}

export function getCurrentLock(): DisputeEvent | null {
  return state.currentLock;
}

export function getLockDuration(): number {
  if (!state.lockStartTime) return 0;
  return Date.now() - state.lockStartTime;
}

export async function handleDispute(
  trigger: DisputeTrigger,
  scores: DisputeScores,
  input: string,
  output: string | null,
  policyFired: string
): Promise<{ locked: boolean; issue: DisputeIssue | null }> {
  const event: DisputeEvent = {
    trigger,
    scores,
    inputHash: hashInput(input),
    outputHash: hashOutput(output),
    policyFired,
    recommendedAction: scores.sycophancy >= 0.95 ? 'recalibrate_threshold' :
                       trigger === 'POLICY_VIOLATION' ? 'dismiss_request' : 'unlock_with_ack',
    timestamp: new Date().toISOString(),
  };

  enterLock(event);
  const issue = shouldOpenIssue(trigger, scores) ? await openDispute(event) : null;
  return { locked: true, issue };
}

export async function attemptUnlock(): Promise<boolean> {
  if (!isLocked()) return true;
  const lock = getCurrentLock();
  if (!lock) return true;

  const issue = state.openIssues.get(lock.inputHash);
  if (!issue) {
    if (getLockDuration() > 60000) {
      exitLock();
      return true;
    }
    return false;
  }

  if (await checkAcknowledgment(issue.number)) {
    await closeDispute(issue.number);
    exitLock();
    return true;
  }
  return false;
}

export function getStats(): {
  locked: boolean;
  durationMs: number;
  count24h: number;
  openIssues: number;
  trigger: DisputeTrigger | null;
} {
  return {
    locked: isLocked(),
    durationMs: getLockDuration(),
    count24h: state.silenceCount24h,
    openIssues: Array.from(state.openIssues.values()).filter(i => i.state === 'open').length,
    trigger: state.currentLock?.trigger || null,
  };
}
