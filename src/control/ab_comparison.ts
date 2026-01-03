/**
 * A/B Comparison: Full vs Baseline
 *
 * Scientific comparison between:
 * - Condition A (Full): Safety + Budget + G6 Quality Gate
 * - Condition B (Baseline): Safety + Budget only (G6 bypassed)
 *
 * Metrics:
 * 1. Review load: # REVIEW / 100 tasks
 * 2. Reject rate: # REJECT / total tasks
 * 3. Cycle efficiency: tasks completed / iterations
 * 4. Auditor verdict rate: % cycles PASS
 * 5. PR creation rate: PRs created / tasks completed
 */

import * as fs from 'fs';
import * as path from 'path';
import { runAutonomousCycle, CycleReport } from './cycle';
import { auditCycle, AuditReport } from './replay_auditor';

/**
 * Condition metrics
 */
export interface ConditionMetrics {
  condition: 'FULL' | 'BASELINE';
  cyclesRun: number;
  totalTasks: number;
  totalIterations: number;

  // Task outcomes
  passCount: number;
  reviewCount: number;
  rejectCount: number;
  skipCount: number;
  errorCount: number;

  // PR stats
  prsCreated: number;

  // Auditor verdicts
  auditPassCount: number;
  auditFailCount: number;

  // Computed metrics
  reviewLoad: number; // REVIEW per 100 tasks
  rejectRate: number; // REJECT / total
  cycleEfficiency: number; // tasks completed / iterations
  auditorPassRate: number; // % cycles PASS
  prCreationRate: number; // PRs / tasks completed
}

/**
 * A/B comparison result
 */
export interface ABComparisonResult {
  timestamp: string;
  queuePath: string;
  cyclesPerCondition: number;

  fullCondition: ConditionMetrics;
  baselineCondition: ConditionMetrics;

  delta: {
    reviewLoad: number; // Full - Baseline
    rejectRate: number;
    cycleEfficiency: number;
    auditorPassRate: number;
    prCreationRate: number;
  };

  summary: string;
}

/**
 * Run A/B comparison
 */
export async function runABComparison(
  queuePath: string,
  cyclesPerCondition: number = 3,
  maxIterations: number = 5
): Promise<ABComparisonResult> {
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║          A/B COMPARISON: FULL vs BASELINE                ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');
  console.log(`📋 Queue: ${queuePath}`);
  console.log(`🔄 Cycles per condition: ${cyclesPerCondition}`);
  console.log(`🎯 Max iterations per cycle: ${maxIterations}\n`);

  // ==================== CONDITION A: FULL ====================
  console.log('━'.repeat(60));
  console.log('🅰️  CONDITION A: FULL (Safety + Budget + G6)\n');

  const fullReports: CycleReport[] = [];
  const fullAudits: AuditReport[] = [];

  for (let i = 0; i < cyclesPerCondition; i++) {
    console.log(`\n--- Cycle ${i + 1}/${cyclesPerCondition} (FULL) ---\n`);

    const report = await runAutonomousCycle({
      maxIterations,
      queuePath,
      baselineMode: false
    });

    fullReports.push(report);

    // Audit cycle
    const audit = auditCycle(report);
    fullAudits.push(audit);

    console.log(`   Verdict: ${audit.verdict} (${report.results.pass} PASS, ${report.results.review} REVIEW, ${report.results.reject} REJECT)\n`);
  }

  // ==================== CONDITION B: BASELINE ====================
  console.log('\n━'.repeat(60));
  console.log('🅱️  CONDITION B: BASELINE (Safety + Budget only)\n');

  const baselineReports: CycleReport[] = [];
  const baselineAudits: AuditReport[] = [];

  for (let i = 0; i < cyclesPerCondition; i++) {
    console.log(`\n--- Cycle ${i + 1}/${cyclesPerCondition} (BASELINE) ---\n`);

    const report = await runAutonomousCycle({
      maxIterations,
      queuePath,
      baselineMode: true
    });

    baselineReports.push(report);

    // Audit cycle
    const audit = auditCycle(report);
    baselineAudits.push(audit);

    console.log(`   Verdict: ${audit.verdict} (${report.results.pass} PASS, ${report.results.review} REVIEW, ${report.results.reject} REJECT)\n`);
  }

  // ==================== CALCULATE METRICS ====================
  const fullMetrics = calculateMetrics('FULL', fullReports, fullAudits);
  const baselineMetrics = calculateMetrics('BASELINE', baselineReports, baselineAudits);

  const delta = {
    reviewLoad: fullMetrics.reviewLoad - baselineMetrics.reviewLoad,
    rejectRate: fullMetrics.rejectRate - baselineMetrics.rejectRate,
    cycleEfficiency: fullMetrics.cycleEfficiency - baselineMetrics.cycleEfficiency,
    auditorPassRate: fullMetrics.auditorPassRate - baselineMetrics.auditorPassRate,
    prCreationRate: fullMetrics.prCreationRate - baselineMetrics.prCreationRate
  };

  // ==================== GENERATE SUMMARY ====================
  let summary = 'A/B Comparison Results:\n';
  summary += `- Review Load: ${delta.reviewLoad > 0 ? '+' : ''}${delta.reviewLoad.toFixed(1)} REVIEW/100 tasks (Full vs Baseline)\n`;
  summary += `- Reject Rate: ${delta.rejectRate > 0 ? '+' : ''}${(delta.rejectRate * 100).toFixed(1)}% (Full vs Baseline)\n`;
  summary += `- Cycle Efficiency: ${delta.cycleEfficiency > 0 ? '+' : ''}${delta.cycleEfficiency.toFixed(2)} tasks/iteration (Full vs Baseline)\n`;
  summary += `- Auditor Pass Rate: ${delta.auditorPassRate > 0 ? '+' : ''}${(delta.auditorPassRate * 100).toFixed(1)}% (Full vs Baseline)\n`;
  summary += `- PR Creation Rate: ${delta.prCreationRate > 0 ? '+' : ''}${(delta.prCreationRate * 100).toFixed(1)}% (Full vs Baseline)`;

  const result: ABComparisonResult = {
    timestamp: new Date().toISOString(),
    queuePath,
    cyclesPerCondition,
    fullCondition: fullMetrics,
    baselineCondition: baselineMetrics,
    delta,
    summary
  };

  return result;
}

/**
 * Calculate metrics for a condition
 */
function calculateMetrics(
  condition: 'FULL' | 'BASELINE',
  reports: CycleReport[],
  audits: AuditReport[]
): ConditionMetrics {
  const totalTasks = reports.reduce((sum, r) => sum + r.taskResults.length, 0);
  const totalIterations = reports.reduce((sum, r) => sum + r.iterations, 0);

  const passCount = reports.reduce((sum, r) => sum + r.results.pass, 0);
  const reviewCount = reports.reduce((sum, r) => sum + r.results.review, 0);
  const rejectCount = reports.reduce((sum, r) => sum + r.results.reject, 0);
  const skipCount = reports.reduce((sum, r) => sum + r.results.skip, 0);
  const errorCount = reports.reduce((sum, r) => sum + r.results.error, 0);

  const prsCreated = reports.reduce((sum, r) => sum + (r.qualityGateStats?.prsCreated || 0), 0);

  const auditPassCount = audits.filter(a => a.verdict === 'PASS').length;
  const auditFailCount = audits.filter(a => a.verdict === 'FAIL').length;

  // Compute metrics
  const reviewLoad = totalTasks > 0 ? (reviewCount / totalTasks) * 100 : 0;
  const rejectRate = totalTasks > 0 ? rejectCount / totalTasks : 0;
  const cycleEfficiency = totalIterations > 0 ? totalTasks / totalIterations : 0;
  const auditorPassRate = reports.length > 0 ? auditPassCount / reports.length : 0;
  const prCreationRate = totalTasks > 0 ? prsCreated / totalTasks : 0;

  return {
    condition,
    cyclesRun: reports.length,
    totalTasks,
    totalIterations,
    passCount,
    reviewCount,
    rejectCount,
    skipCount,
    errorCount,
    prsCreated,
    auditPassCount,
    auditFailCount,
    reviewLoad,
    rejectRate,
    cycleEfficiency,
    auditorPassRate,
    prCreationRate
  };
}

/**
 * Print A/B comparison result
 */
export function printABComparison(result: ABComparisonResult): void {
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║          A/B COMPARISON RESULTS                          ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  console.log(`📊 Timestamp: ${new Date(result.timestamp).toLocaleString()}`);
  console.log(`📋 Queue: ${result.queuePath}`);
  console.log(`🔄 Cycles per condition: ${result.cyclesPerCondition}\n`);

  console.log('━'.repeat(60));
  console.log('🅰️  CONDITION A: FULL (Safety + Budget + G6)\n');
  printConditionMetrics(result.fullCondition);

  console.log('\n━'.repeat(60));
  console.log('🅱️  CONDITION B: BASELINE (Safety + Budget only)\n');
  printConditionMetrics(result.baselineCondition);

  console.log('\n━'.repeat(60));
  console.log('📈 DELTA (Full - Baseline)\n');

  console.log(`Review Load:       ${result.delta.reviewLoad > 0 ? '+' : ''}${result.delta.reviewLoad.toFixed(1)} REVIEW/100 tasks`);
  console.log(`Reject Rate:       ${result.delta.rejectRate > 0 ? '+' : ''}${(result.delta.rejectRate * 100).toFixed(1)}%`);
  console.log(`Cycle Efficiency:  ${result.delta.cycleEfficiency > 0 ? '+' : ''}${result.delta.cycleEfficiency.toFixed(2)} tasks/iteration`);
  console.log(`Auditor Pass Rate: ${result.delta.auditorPassRate > 0 ? '+' : ''}${(result.delta.auditorPassRate * 100).toFixed(1)}%`);
  console.log(`PR Creation Rate:  ${result.delta.prCreationRate > 0 ? '+' : ''}${(result.delta.prCreationRate * 100).toFixed(1)}%`);

  console.log('\n━'.repeat(60));
  console.log('📊 SUMMARY\n');
  console.log(result.summary);
  console.log('\n━'.repeat(60) + '\n');
}

/**
 * Print condition metrics
 */
function printConditionMetrics(metrics: ConditionMetrics): void {
  console.log(`Cycles run:        ${metrics.cyclesRun}`);
  console.log(`Total tasks:       ${metrics.totalTasks}`);
  console.log(`Total iterations:  ${metrics.totalIterations}\n`);

  console.log('Task outcomes:');
  console.log(`  PASS:   ${metrics.passCount}`);
  console.log(`  REVIEW: ${metrics.reviewCount}`);
  console.log(`  REJECT: ${metrics.rejectCount}`);
  console.log(`  SKIP:   ${metrics.skipCount}`);
  console.log(`  ERROR:  ${metrics.errorCount}\n`);

  console.log(`PRs created:       ${metrics.prsCreated}\n`);

  console.log('Auditor verdicts:');
  console.log(`  PASS:   ${metrics.auditPassCount}`);
  console.log(`  FAIL:   ${metrics.auditFailCount}\n`);

  console.log('Computed metrics:');
  console.log(`  Review Load:       ${metrics.reviewLoad.toFixed(1)} REVIEW/100 tasks`);
  console.log(`  Reject Rate:       ${(metrics.rejectRate * 100).toFixed(1)}%`);
  console.log(`  Cycle Efficiency:  ${metrics.cycleEfficiency.toFixed(2)} tasks/iteration`);
  console.log(`  Auditor Pass Rate: ${(metrics.auditorPassRate * 100).toFixed(1)}%`);
  console.log(`  PR Creation Rate:  ${(metrics.prCreationRate * 100).toFixed(1)}%`);
}

/**
 * Save A/B comparison result to disk
 */
export function saveABComparison(result: ABComparisonResult, outputPath?: string): void {
  const dir = path.join(process.cwd(), 'data', 'ab_comparisons');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const timestamp = new Date(result.timestamp).toISOString().replace(/[:.]/g, '-');
  const filename = outputPath || `ab_comparison-${timestamp}.json`;
  const filePath = path.join(dir, filename);

  fs.writeFileSync(filePath, JSON.stringify(result, null, 2), 'utf-8');
  console.log(`💾 A/B comparison saved: ${filePath}\n`);
}
