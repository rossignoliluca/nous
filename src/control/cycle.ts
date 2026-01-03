/**
 * NOUS Autonomous Cycle Runner
 *
 * Non-interactive PR-first batch runner with safety controls.
 *
 * Key features:
 * - Non-interactive execution (no stdin/readline)
 * - Hard caps: 3 PRs, 5 REVIEWs, 40 iterations
 * - Golden set validation (10/10 required to proceed)
 * - Protected file enforcement (immediate stop)
 * - Persistent cycle reports with atomic writes
 *
 * Workflow:
 * 1. Load task queue from JSON
 * 2. Run golden set validation (100% required)
 * 3. Loop through tasks (max iterations, max duration)
 * 4. For each task:
 *    - Check if file is protected
 *    - Run agent (executeAgent)
 *    - Run quality gate (runQualityGate)
 *    - Branch on result: PASS→PR, REVIEW→Issue, REJECT→log
 * 5. Stop conditions:
 *    - Duration exceeded
 *    - Iteration/PR/REVIEW caps reached
 *    - 3 consecutive REVIEWs
 *    - Protected file touched
 *    - Golden set regression
 * 6. Save persistent report to data/cycles/cycle-{timestamp}.json
 */

import * as fs from 'fs';
import * as path from 'path';
import { executeAgent } from '../work/agent';
import { loadTaskQueue, generateDefaultTasks, getNextTask, removeTask, isProtectedFile, TaskQueue, MicroTask } from '../work/task_queue';
import { getQualityGateSessionStats, initQualityGateSession } from './quality_gate_integration';
import { logCriticalEvent } from './critical_events';
import { getExplorationStatus } from '../core/exploration';
import { CONSTITUTION } from '../core/constitution';

/**
 * Cycle options
 */
export interface CycleOptions {
  maxIterations?: number;
  maxDurationMinutes?: number;
  queuePath?: string;
  baselineMode?: boolean;
}

/**
 * Task result
 */
interface TaskResult {
  taskId: string;
  decision: 'PASS' | 'REVIEW' | 'REJECT' | 'SKIP' | 'ERROR';
  message: string;
  prUrl?: string;
  issueUrl?: string;
  duration: number;
}

/**
 * Cycle report
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
  taskResults: TaskResult[];
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
 * Run golden set validation
 * Returns true if all 10 golden set cases pass (100% accuracy required)
 */
export function runGoldenSetValidation(): boolean {
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║        PRE-CYCLE: GOLDEN SET VALIDATION                 ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');
  console.log('🔍 Running golden set classification test...');
  console.log('   Requirement: 10/10 cases must pass (100% accuracy)\n');

  try {
    // Import and run golden set test
    const { test_golden_set_classification } = require('../testing/quality_gate.test');

    // Run test (throws error if not 100% accurate)
    test_golden_set_classification();

    console.log('✅ Golden set validation PASSED (10/10)\n');
    return true;
  } catch (error: any) {
    console.error('\n❌ GOLDEN SET VALIDATION FAILED\n');
    console.error('   Quality gate accuracy degraded below 100%');
    console.error(`   Error: ${error.message}\n`);

    // Log critical event
    logCriticalEvent({
      type: 'GOLDEN_REGRESSION',
      severity: 'CRITICAL',
      description: `Golden set validation failed: ${error.message}`,
      context: {
        error: error.message,
        stack: error.stack
      }
    });

    return false;
  }
}

/**
 * Save cycle report to disk (atomic write with temp + rename)
 */
export function saveCycleReport(report: CycleReport, partial: boolean = false): void {
  const cyclesDir = path.join(process.cwd(), 'data', 'cycles');

  if (!fs.existsSync(cyclesDir)) {
    fs.mkdirSync(cyclesDir, { recursive: true });
  }

  const filename = partial
    ? `cycle-${report.cycleId}-partial.json`
    : `cycle-${report.cycleId}.json`;

  const finalPath = path.join(cyclesDir, filename);
  const tempPath = finalPath + '.tmp';

  try {
    // Write to temp file first
    fs.writeFileSync(tempPath, JSON.stringify(report, null, 2), 'utf-8');

    // Atomic rename
    fs.renameSync(tempPath, finalPath);

    console.log(`\n💾 Cycle report saved: ${finalPath}`);
  } catch (error: any) {
    console.error(`\n❌ Failed to save cycle report: ${error.message}`);

    // Try to clean up temp file
    try {
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }
    } catch {}
  }
}

/**
 * Format duration in human-readable form
 */
function formatDuration(ms: number): string {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}m ${seconds}s`;
}

/**
 * Print cycle report to console
 */
function printCycleReport(report: CycleReport): void {
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║          CYCLE COMPLETE - FINAL REPORT                   ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  console.log(`⏱️  Duration: ${formatDuration(report.duration)} (started ${new Date(report.startTime).toLocaleString()})`);
  console.log(`🔄 Iterations: ${report.iterations}/${report.maxIterations}`);
  console.log(`📋 Tasks remaining: ${report.tasksRemaining}`);
  console.log(`\n🏁 Stop reason: ${report.stopReason}\n`);

  console.log('📈 Results:');
  console.log(`   PASS:   ${report.results.pass}`);
  console.log(`   REVIEW: ${report.results.review}`);
  console.log(`   REJECT: ${report.results.reject}`);
  console.log(`   SKIP:   ${report.results.skip}`);
  console.log(`   ERROR:  ${report.results.error}\n`);

  if (report.qualityGateStats) {
    console.log('🎯 Quality Gate Stats:');
    console.log(`   PRs created:       ${report.qualityGateStats.prsCreated}/3`);
    console.log(`   Reviews created:   ${report.qualityGateStats.reviewsCreated}/5`);
    console.log(`   Rejects logged:    ${report.qualityGateStats.rejectsLogged}\n`);
  }

  if (report.prsCreated.length > 0) {
    console.log(`✅ Pull Requests Created (${report.prsCreated.length}):`);
    report.prsCreated.forEach((url, i) => {
      const task = report.taskResults.find(t => t.prUrl === url);
      console.log(`   ${i + 1}. ${url}`);
      if (task) {
        console.log(`      Task: ${task.taskId}`);
      }
    });
    console.log('');
  }

  if (report.issuesCreated.length > 0) {
    console.log(`🔍 Review Issues Created (${report.issuesCreated.length}):`);
    report.issuesCreated.forEach((url, i) => {
      const task = report.taskResults.find(t => t.issueUrl === url);
      console.log(`   ${i + 1}. ${url}`);
      if (task) {
        console.log(`      Task: ${task.taskId}`);
      }
    });
    console.log('');
  }

  if (report.explorationBudget) {
    console.log('💰 Exploration Budget:');
    console.log(`   Current: ${(report.explorationBudget.current * 100).toFixed(1)}%`);
    console.log(`   Used: ${report.explorationBudget.riskyActionsInWindow}/${report.explorationBudget.actionsInWindow}\n`);
  }

  console.log('━'.repeat(60) + '\n');
}

/**
 * Run autonomous cycle
 */
export async function runAutonomousCycle(options: CycleOptions = {}): Promise<CycleReport> {
  const MAX_ITERATIONS = options.maxIterations || CONSTITUTION.caps.maxIterationsPerCycle;
  const MAX_DURATION_MINUTES = options.maxDurationMinutes || CONSTITUTION.caps.maxDurationMinutes;
  const MAX_DURATION_MS = MAX_DURATION_MINUTES * 60 * 1000;

  const cycleId = new Date().toISOString().replace(/[:.]/g, '-');
  const startTime = Date.now();

  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║      NOUS AUTONOMOUS CYCLE - PR-FIRST BATCH RUNNER            ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');
  console.log(`📋 Cycle ID: ${cycleId}`);
  console.log(`⏱️  Max duration: ${MAX_DURATION_MINUTES} minutes`);
  console.log(`🔄 Max iterations: ${MAX_ITERATIONS}`);
  console.log(`📝 Mode: PR-first (PASS→PR, REVIEW→Issue, REJECT→log)\n`);

  // ==================== GOLDEN SET VALIDATION ====================
  console.log('🧪 Running golden set validation...\n');

  if (!runGoldenSetValidation()) {
    const report: CycleReport = {
      cycleId,
      startTime: new Date(startTime).toISOString(),
      endTime: new Date().toISOString(),
      duration: Date.now() - startTime,
      iterations: 0,
      maxIterations: MAX_ITERATIONS,
      stopReason: 'Golden set validation failed (quality gate regression)',
      results: { pass: 0, review: 0, reject: 0, skip: 0, error: 0 },
      taskResults: [],
      prsCreated: [],
      issuesCreated: [],
      tasksRemaining: 0
    };

    saveCycleReport(report, true);
    printCycleReport(report);

    return report;
  }

  // ==================== LOAD TASK QUEUE ====================
  let queue = loadTaskQueue(options.queuePath);

  if (!queue) {
    console.log('⚠️  No task queue found, generating default tasks...\n');
    queue = generateDefaultTasks();
  }

  console.log(`📋 Task queue loaded: ${queue.tasks.length} tasks (source: ${queue.source})\n`);

  // ==================== INITIALIZE QUALITY GATE SESSION ====================
  initQualityGateSession();

  // ==================== MAIN CYCLE LOOP ====================
  const results: TaskResult[] = [];
  let iteration = 0;
  let stopReason = '';

  while (iteration < MAX_ITERATIONS && queue.tasks.length > 0) {
    iteration++;

    // Check duration
    const elapsed = Date.now() - startTime;
    if (elapsed > MAX_DURATION_MS) {
      stopReason = `Max duration exceeded (${MAX_DURATION_MINUTES} minutes)`;
      break;
    }

    console.log('━'.repeat(70) + '\n');
    console.log(`╔══════════════════════════════════════════════════════════════════════╗`);
    console.log(`║ Iteration ${iteration}/${MAX_ITERATIONS}`.padEnd(71) + '║');
    console.log(`╚══════════════════════════════════════════════════════════════════════╝\n`);

    // Get next task
    const task = getNextTask(queue);
    if (!task) {
      stopReason = 'No more tasks in queue';
      break;
    }

    console.log(`📋 Task ${task.id}: ${task.intent}`);
    if (task.context.file) console.log(`   File: ${task.context.file}`);
    if (task.rule) console.log(`   Rule: ${task.rule}`);
    console.log(`   Priority: ${task.priority.toFixed(2)}\n`);

    // Check if protected file
    if (task.context.file && isProtectedFile(task.context.file)) {
      console.log(`🛑 BLOCKED: Task touches protected file: ${task.context.file}\n`);

      logCriticalEvent({
        type: 'PROTECTED_FILE_ATTEMPT',
        severity: 'CRITICAL',
        description: `Autonomous cycle attempted to modify protected file: ${task.context.file}`,
        context: {
          file: task.context.file,
          taskId: task.id,
          taskIntent: task.intent,
          iteration
        },
        taskId: task.id
      });

      results.push({
        taskId: task.id,
        decision: 'SKIP',
        message: `Protected file: ${task.context.file}`,
        duration: 0
      });

      queue = removeTask(queue, task.id);
      stopReason = `Protected file touched: ${task.context.file}`;
      break;
    }

    // Execute agent
    const taskStartTime = Date.now();
    console.log('🤖 Generating solution...\n');

    try {
      // Pass task.context to agent for factual grounding
      const agentResult = await executeAgent(
        task.intent,
        5,
        [],
        5 * 60 * 1000,
        task.context, // Pass facts, constraints, file, type, rule
        options.baselineMode // Baseline mode: bypass quality gate
      );

      if (!agentResult.success) {
        console.log(`\n❌ Generation failed: ${agentResult.answer}\n`);

        results.push({
          taskId: task.id,
          decision: 'ERROR',
          message: agentResult.answer,
          duration: Date.now() - taskStartTime
        });

        queue = removeTask(queue, task.id);

        // Check if critical error
        if (agentResult.answer.includes('ERR_')) {
          stopReason = `Critical error: ${agentResult.answer}`;
          break;
        }

        continue;
      }

      console.log('✅ Solution generated\n');

      // Check quality gate session stats (agent already ran quality gate internally)
      const qgStats = getQualityGateSessionStats();

      if (!qgStats) {
        console.log('ℹ️  No quality gate stats available\n');

        results.push({
          taskId: task.id,
          decision: 'SKIP',
          message: 'No quality gate data',
          duration: Date.now() - taskStartTime
        });

        queue = removeTask(queue, task.id);
        continue;
      }

      // Determine outcome based on session stats changes
      // Agent execution already handled quality gate, so we check the session state
      const sessionHasPR = qgStats.prsCreated > (results.filter(r => r.decision === 'PASS').length);
      const sessionHasReview = qgStats.reviewsCreated > (results.filter(r => r.decision === 'REVIEW').length);
      const sessionHasReject = qgStats.rejectsLogged > (results.filter(r => r.decision === 'REJECT').length);

      if (sessionHasPR) {
        // Agent created a PR during execution
        results.push({
          taskId: task.id,
          decision: 'PASS',
          message: 'Quality gate passed, PR created by agent',
          duration: Date.now() - taskStartTime
        });

        console.log(`✅ Task completed: PASS\n`);

        // Check PR cap
        if (qgStats.prsCreated >= CONSTITUTION.caps.maxPRsPerCycle) {
          stopReason = `PR cap reached (${qgStats.prsCreated}/${CONSTITUTION.caps.maxPRsPerCycle})`;
          queue = removeTask(queue, task.id);
          break;
        }
      } else if (sessionHasReview) {
        // Agent triggered REVIEW
        results.push({
          taskId: task.id,
          decision: 'REVIEW',
          message: 'Quality gate review required',
          duration: Date.now() - taskStartTime
        });

        console.log(`📋 Task completed: REVIEW\n`);

        // Check consecutive REVIEWs
        if (qgStats.consecutiveReviews >= CONSTITUTION.caps.maxConsecutiveReviews) {
          stopReason = `${CONSTITUTION.caps.maxConsecutiveReviews} consecutive REVIEW outcomes`;
          queue = removeTask(queue, task.id);
          break;
        }

        // Check REVIEW cap
        if (qgStats.reviewsCreated >= CONSTITUTION.caps.maxReviewsPerCycle) {
          stopReason = `REVIEW cap reached (${qgStats.reviewsCreated}/${CONSTITUTION.caps.maxReviewsPerCycle})`;
          queue = removeTask(queue, task.id);
          break;
        }
      } else if (sessionHasReject) {
        // Agent hit REJECT
        results.push({
          taskId: task.id,
          decision: 'REJECT',
          message: 'Quality gate rejected',
          duration: Date.now() - taskStartTime
        });

        console.log(`🚫 Task completed: REJECT\n`);
      } else {
        // No change in session stats - likely no files modified
        results.push({
          taskId: task.id,
          decision: 'SKIP',
          message: 'No quality gate decision recorded',
          duration: Date.now() - taskStartTime
        });

        console.log(`⏭️  Task completed: SKIP\n`);
      }

    } catch (error: any) {
      console.error(`\n❌ Task execution error: ${error.message}\n`);

      results.push({
        taskId: task.id,
        decision: 'ERROR',
        message: error.message,
        duration: Date.now() - taskStartTime
      });
    }

    // Remove completed task
    queue = removeTask(queue, task.id);
  }

  if (!stopReason) {
    if (iteration >= MAX_ITERATIONS) {
      stopReason = `Max iterations reached (${MAX_ITERATIONS})`;
    } else if (queue.tasks.length === 0) {
      stopReason = 'All tasks completed';
    } else {
      stopReason = 'Unknown';
    }
  }

  // ==================== BUILD FINAL REPORT ====================
  const qgStats = getQualityGateSessionStats();
  const explorationStats = getExplorationStatus();

  const report: CycleReport = {
    cycleId,
    startTime: new Date(startTime).toISOString(),
    endTime: new Date().toISOString(),
    duration: Date.now() - startTime,
    iterations: iteration,
    maxIterations: MAX_ITERATIONS,
    stopReason,
    results: {
      pass: results.filter(r => r.decision === 'PASS').length,
      review: results.filter(r => r.decision === 'REVIEW').length,
      reject: results.filter(r => r.decision === 'REJECT').length,
      skip: results.filter(r => r.decision === 'SKIP').length,
      error: results.filter(r => r.decision === 'ERROR').length
    },
    taskResults: results,
    prsCreated: results.filter(r => r.prUrl).map(r => r.prUrl!),
    issuesCreated: results.filter(r => r.issueUrl).map(r => r.issueUrl!),
    tasksRemaining: queue.tasks.length,
    qualityGateStats: qgStats || undefined,
    explorationBudget: explorationStats ? {
      current: explorationStats.budget,
      actionsInWindow: explorationStats.actionsInWindow,
      riskyActionsInWindow: explorationStats.riskyActionsInWindow
    } : undefined
  };

  // ==================== SAVE & PRINT REPORT ====================
  saveCycleReport(report, stopReason.includes('error') || stopReason.includes('Critical'));
  printCycleReport(report);

  return report;
}
