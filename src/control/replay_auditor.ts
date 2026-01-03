/**
 * Replay Auditor
 *
 * Read-only auditor that verifies autonomous cycle reports against invariants.
 * Does NOT modify repo, does NOT open PRs, does NOT call agent.
 *
 * Purpose:
 * - Produce deterministic PASS/FAIL verdict
 * - Check invariants: golden check, caps, protected surface, stop reason
 * - Provide evidence for baseline A/B comparison
 * - Enable scientific mode without hype
 */

import * as fs from 'fs';
import * as path from 'path';
import { CONSTITUTION } from '../core/constitution';

/**
 * Cycle report structure (from cycle.ts)
 */
export interface CycleReport {
  cycleId: string;
  startTime: string;
  endTime: string;
  duration: number;
  iterations: number;
  maxIterations: number;
  stopReason: string;
  results: {
    pass: number;
    review: number;
    reject: number;
    skip: number;
    error: number;
  };
  taskResults: Array<{
    taskId: string;
    decision: 'PASS' | 'REVIEW' | 'REJECT' | 'SKIP' | 'ERROR';
    message: string;
    prUrl?: string;
    issueUrl?: string;
    duration: number;
  }>;
  prsCreated: string[];
  issuesCreated: string[];
  tasksRemaining: number;
  qualityGateStats?: {
    prsCreated: number;
    reviewsCreated: number;
    rejectsLogged: number;
    consecutiveReviews: number;
  };
  explorationBudget?: {
    current: number;
    actionsInWindow: number;
    riskyActionsInWindow: number;
  };
}

/**
 * Audit result
 */
export interface AuditReport {
  verdict: 'PASS' | 'FAIL';
  cycleId: string;
  timestamp: string;
  violations: AuditViolation[];
  invariants: AuditInvariant[];
  summary: string;
}

export interface AuditViolation {
  severity: 'CRITICAL' | 'MAJOR' | 'MINOR';
  category: 'GOLDEN' | 'CAPS' | 'PROTECTED_SURFACE' | 'STOP_REASON' | 'CRITICAL_EVENTS' | 'DATA_INTEGRITY';
  message: string;
  evidence: string[];
}

export interface AuditInvariant {
  name: string;
  status: 'OK' | 'VIOLATED';
  evidence: string;
}

/**
 * Load cycle report from disk
 */
export function loadCycleReport(cycleFilePath: string): CycleReport | null {
  if (!fs.existsSync(cycleFilePath)) {
    console.error(`Cycle report not found: ${cycleFilePath}`);
    return null;
  }

  try {
    const content = fs.readFileSync(cycleFilePath, 'utf-8');
    const report = JSON.parse(content) as CycleReport;
    return report;
  } catch (error: any) {
    console.error(`Failed to parse cycle report: ${error.message}`);
    return null;
  }
}

/**
 * Audit cycle report
 */
export function auditCycle(report: CycleReport): AuditReport {
  const violations: AuditViolation[] = [];
  const invariants: AuditInvariant[] = [];

  // ==================== CHECK 1: GOLDEN SET VALIDATION ====================
  // Golden set must have been run and passed (10/10, 100%)
  // We infer this from stopReason - if golden failed, cycle would have stopped immediately
  if (report.stopReason.includes('Golden set validation failed')) {
    violations.push({
      severity: 'CRITICAL',
      category: 'GOLDEN',
      message: 'Golden set validation failed',
      evidence: [`Stop reason: ${report.stopReason}`]
    });
    invariants.push({
      name: 'Golden Set Validation (10/10, 100%)',
      status: 'VIOLATED',
      evidence: 'Cycle stopped due to golden set failure'
    });
  } else if (report.iterations === 0 && report.stopReason.includes('Golden')) {
    violations.push({
      severity: 'CRITICAL',
      category: 'GOLDEN',
      message: 'Golden set validation failed (0 iterations)',
      evidence: [`Stop reason: ${report.stopReason}`]
    });
    invariants.push({
      name: 'Golden Set Validation (10/10, 100%)',
      status: 'VIOLATED',
      evidence: 'No iterations ran - golden check likely failed'
    });
  } else {
    invariants.push({
      name: 'Golden Set Validation (10/10, 100%)',
      status: 'OK',
      evidence: 'Cycle started normally (golden check passed)'
    });
  }

  // ==================== CHECK 2: CAPS ENFORCEMENT ====================
  const qgStats = report.qualityGateStats;

  // Check PR cap
  if (qgStats && qgStats.prsCreated > CONSTITUTION.caps.maxPRsPerCycle) {
    violations.push({
      severity: 'CRITICAL',
      category: 'CAPS',
      message: `PR cap exceeded: ${qgStats.prsCreated}/${CONSTITUTION.caps.maxPRsPerCycle}`,
      evidence: [`PRs created: ${qgStats.prsCreated}`, `Cap: ${CONSTITUTION.caps.maxPRsPerCycle}`]
    });
    invariants.push({
      name: `PR Cap (≤${CONSTITUTION.caps.maxPRsPerCycle})`,
      status: 'VIOLATED',
      evidence: `${qgStats.prsCreated} PRs created`
    });
  } else {
    invariants.push({
      name: `PR Cap (≤${CONSTITUTION.caps.maxPRsPerCycle})`,
      status: 'OK',
      evidence: qgStats ? `${qgStats.prsCreated}/${CONSTITUTION.caps.maxPRsPerCycle} PRs` : 'No QG stats'
    });
  }

  // Check REVIEW cap
  if (qgStats && qgStats.reviewsCreated > CONSTITUTION.caps.maxReviewsPerCycle) {
    violations.push({
      severity: 'CRITICAL',
      category: 'CAPS',
      message: `REVIEW cap exceeded: ${qgStats.reviewsCreated}/${CONSTITUTION.caps.maxReviewsPerCycle}`,
      evidence: [`REVIEWs created: ${qgStats.reviewsCreated}`, `Cap: ${CONSTITUTION.caps.maxReviewsPerCycle}`]
    });
    invariants.push({
      name: `REVIEW Cap (≤${CONSTITUTION.caps.maxReviewsPerCycle})`,
      status: 'VIOLATED',
      evidence: `${qgStats.reviewsCreated} REVIEWs created`
    });
  } else {
    invariants.push({
      name: `REVIEW Cap (≤${CONSTITUTION.caps.maxReviewsPerCycle})`,
      status: 'OK',
      evidence: qgStats ? `${qgStats.reviewsCreated}/${CONSTITUTION.caps.maxReviewsPerCycle} REVIEWs` : 'No QG stats'
    });
  }

  // Check consecutive REVIEW cap
  if (qgStats && qgStats.consecutiveReviews > CONSTITUTION.caps.maxConsecutiveReviews) {
    violations.push({
      severity: 'MAJOR',
      category: 'CAPS',
      message: `Consecutive REVIEW cap exceeded: ${qgStats.consecutiveReviews}/${CONSTITUTION.caps.maxConsecutiveReviews}`,
      evidence: [`Consecutive REVIEWs: ${qgStats.consecutiveReviews}`, `Cap: ${CONSTITUTION.caps.maxConsecutiveReviews}`]
    });
    invariants.push({
      name: `Consecutive REVIEW Cap (≤${CONSTITUTION.caps.maxConsecutiveReviews})`,
      status: 'VIOLATED',
      evidence: `${qgStats.consecutiveReviews} consecutive REVIEWs`
    });
  } else {
    invariants.push({
      name: `Consecutive REVIEW Cap (≤${CONSTITUTION.caps.maxConsecutiveReviews})`,
      status: 'OK',
      evidence: qgStats ? `${qgStats.consecutiveReviews}/${CONSTITUTION.caps.maxConsecutiveReviews} consecutive` : 'No QG stats'
    });
  }

  // Check iterations cap
  if (report.iterations > report.maxIterations) {
    violations.push({
      severity: 'CRITICAL',
      category: 'CAPS',
      message: `Iterations exceeded max: ${report.iterations}/${report.maxIterations}`,
      evidence: [`Iterations: ${report.iterations}`, `Max: ${report.maxIterations}`]
    });
    invariants.push({
      name: `Iteration Cap (≤${report.maxIterations})`,
      status: 'VIOLATED',
      evidence: `${report.iterations} iterations`
    });
  } else {
    invariants.push({
      name: `Iteration Cap (≤${report.maxIterations})`,
      status: 'OK',
      evidence: `${report.iterations}/${report.maxIterations} iterations`
    });
  }

  // ==================== CHECK 3: PROTECTED SURFACE ====================
  // Check if any task attempted to modify protected files
  const protectedAttempts = report.taskResults.filter(task =>
    task.decision === 'SKIP' && task.message.includes('Protected file')
  );

  if (protectedAttempts.length > 0) {
    // Protected file attempts are detected and blocked - this is OK behavior
    // But we flag it as MAJOR to track that tasks were targeting protected surface
    violations.push({
      severity: 'MAJOR',
      category: 'PROTECTED_SURFACE',
      message: `${protectedAttempts.length} task(s) attempted to modify protected files (blocked)`,
      evidence: protectedAttempts.map(t => `Task ${t.taskId}: ${t.message}`)
    });
    invariants.push({
      name: 'Protected Surface Integrity',
      status: 'VIOLATED',
      evidence: `${protectedAttempts.length} blocked attempts (gate worked, but tasks targeted protected files)`
    });
  } else {
    invariants.push({
      name: 'Protected Surface Integrity',
      status: 'OK',
      evidence: 'No attempts to modify protected files'
    });
  }

  // Check if cycle stopped due to protected file (more serious)
  if (report.stopReason.includes('Protected file')) {
    violations.push({
      severity: 'CRITICAL',
      category: 'PROTECTED_SURFACE',
      message: 'Cycle stopped due to protected file violation',
      evidence: [`Stop reason: ${report.stopReason}`]
    });
  }

  // ==================== CHECK 4: STOP REASON VALIDITY ====================
  const validStopReasons = [
    'All tasks completed',
    'Max iterations reached',
    'Max duration exceeded',
    'PR cap reached',
    'REVIEW cap reached',
    'consecutive REVIEW outcomes',
    'Protected file',
    'Golden set validation failed',
    'No more tasks'
  ];

  const stopReasonValid = validStopReasons.some(reason => report.stopReason.includes(reason));

  if (!stopReasonValid) {
    violations.push({
      severity: 'MAJOR',
      category: 'STOP_REASON',
      message: `Unknown or invalid stop reason: ${report.stopReason}`,
      evidence: [`Stop reason: ${report.stopReason}`, 'Expected one of: ' + validStopReasons.join(', ')]
    });
    invariants.push({
      name: 'Valid Stop Reason',
      status: 'VIOLATED',
      evidence: `Unknown: ${report.stopReason}`
    });
  } else {
    invariants.push({
      name: 'Valid Stop Reason',
      status: 'OK',
      evidence: report.stopReason
    });
  }

  // ==================== CHECK 5: DATA INTEGRITY ====================
  // Check that results counts match taskResults
  const actualCounts = {
    pass: report.taskResults.filter(t => t.decision === 'PASS').length,
    review: report.taskResults.filter(t => t.decision === 'REVIEW').length,
    reject: report.taskResults.filter(t => t.decision === 'REJECT').length,
    skip: report.taskResults.filter(t => t.decision === 'SKIP').length,
    error: report.taskResults.filter(t => t.decision === 'ERROR').length
  };

  const countsMatch =
    actualCounts.pass === report.results.pass &&
    actualCounts.review === report.results.review &&
    actualCounts.reject === report.results.reject &&
    actualCounts.skip === report.results.skip &&
    actualCounts.error === report.results.error;

  if (!countsMatch) {
    violations.push({
      severity: 'MINOR',
      category: 'DATA_INTEGRITY',
      message: 'Result counts do not match taskResults',
      evidence: [
        `Reported: ${JSON.stringify(report.results)}`,
        `Actual: ${JSON.stringify(actualCounts)}`
      ]
    });
    invariants.push({
      name: 'Data Integrity (counts match)',
      status: 'VIOLATED',
      evidence: 'Mismatch between results and taskResults'
    });
  } else {
    invariants.push({
      name: 'Data Integrity (counts match)',
      status: 'OK',
      evidence: `${report.taskResults.length} tasks, counts consistent`
    });
  }

  // ==================== VERDICT ====================
  // FAIL if any CRITICAL violations exist
  const hasCritical = violations.some(v => v.severity === 'CRITICAL');
  const verdict = hasCritical ? 'FAIL' : 'PASS';

  // Summary
  const criticalCount = violations.filter(v => v.severity === 'CRITICAL').length;
  const majorCount = violations.filter(v => v.severity === 'MAJOR').length;
  const minorCount = violations.filter(v => v.severity === 'MINOR').length;

  let summary = `Audit ${verdict}`;
  if (violations.length === 0) {
    summary += ': All invariants satisfied';
  } else {
    summary += `: ${criticalCount} critical, ${majorCount} major, ${minorCount} minor violations`;
  }

  return {
    verdict,
    cycleId: report.cycleId,
    timestamp: new Date().toISOString(),
    violations,
    invariants,
    summary
  };
}

/**
 * Print audit report to console
 */
export function printAuditReport(audit: AuditReport): void {
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║          REPLAY AUDITOR - CYCLE VERIFICATION            ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  console.log(`📋 Cycle ID: ${audit.cycleId}`);
  console.log(`🕐 Audit timestamp: ${new Date(audit.timestamp).toLocaleString()}`);
  console.log(`\n🏁 Verdict: ${audit.verdict === 'PASS' ? '✅ PASS' : '❌ FAIL'}\n`);

  console.log('━'.repeat(60));
  console.log('INVARIANTS CHECKED\n');

  for (const inv of audit.invariants) {
    const status = inv.status === 'OK' ? '✓' : '✗';
    console.log(`${status} ${inv.name}`);
    console.log(`  ${inv.evidence}`);
  }

  if (audit.violations.length > 0) {
    console.log('\n━'.repeat(60));
    console.log('VIOLATIONS\n');

    for (const v of audit.violations) {
      const icon = v.severity === 'CRITICAL' ? '🛑' : v.severity === 'MAJOR' ? '⚠️' : 'ℹ️';
      console.log(`${icon} [${v.severity}] ${v.category}: ${v.message}`);
      for (const e of v.evidence) {
        console.log(`   • ${e}`);
      }
      console.log('');
    }
  }

  console.log('━'.repeat(60));
  console.log(`📊 ${audit.summary}\n`);
}

/**
 * Save audit report to disk
 */
export function saveAuditReport(audit: AuditReport, outputPath?: string): void {
  const dir = path.join(process.cwd(), 'data', 'audits');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const filename = outputPath || `audit-${audit.cycleId}.json`;
  const filePath = path.join(dir, filename);

  fs.writeFileSync(filePath, JSON.stringify(audit, null, 2), 'utf-8');
  console.log(`💾 Audit report saved: ${filePath}\n`);
}
