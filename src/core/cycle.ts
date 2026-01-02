import { executeAgent } from './agent';
import { loadSelf } from './self';
import {
  getQualityGateSessionStats,
  initQualityGateSession,
  runQualityGate,
  createPRForPass,
  createIssueForReview,
  logQualityGateDecision
} from './quality_gate_integration';
import { getExplorationStatus } from './exploration';
import { generateReport } from './metrics_v2';
import {
  loadTaskQueue,
  generateDefaultTasks,
  getNextTask,
  removeTask,
  isProtectedFile,
  TaskQueue,
  MicroTask
} from './task_queue';
import { logCriticalEvent } from './critical_events';
import * as fs from 'fs';
import * as path from 'path';

// Existing imports and code...

/**
 * Task Analytics System
 * Provides functions to analyze task performance and patterns.
 */

// Track task success rates
function trackTaskSuccessRates(results: IterationResult[]): { passRate: number, reviewRate: number, rejectRate: number } {
  const total = results.length;
  const passCount = results.filter(r => r.decision === 'PASS').length;
  const reviewCount = results.filter(r => r.decision === 'REVIEW').length;
  const rejectCount = results.filter(r => r.decision === 'REJECT').length;

  return {
    passRate: (passCount / total) * 100,
    reviewRate: (reviewCount / total) * 100,
    rejectRate: (rejectCount / total) * 100
  };
}

// Analyze timing for each task
function analyzeTaskTiming(startTime: number, endTime: number): number {
  return (endTime - startTime) / 1000; // Return duration in seconds
}

// Detect patterns in task decisions
function detectTaskPatterns(results: IterationResult[]): string[] {
  const patterns: string[] = [];
  const consecutiveReviews = results.filter((r, i, arr) => r.decision === 'REVIEW' && arr[i + 1]?.decision === 'REVIEW').length;
  if (consecutiveReviews >= 3) {
    patterns.push('High frequency of consecutive reviews');
  }
  return patterns;
}

// Compare current cycle with historical data
function compareWithHistoricalData(currentResults: IterationResult[], historicalResults: IterationResult[]): string {
  const currentPassRate = trackTaskSuccessRates(currentResults).passRate;
  const historicalPassRate = trackTaskSuccessRates(historicalResults).passRate;

  if (currentPassRate > historicalPassRate) {
    return 'Improvement in pass rate compared to historical data';
  } else if (currentPassRate < historicalPassRate) {
    return 'Decline in pass rate compared to historical data';
  } else {
    return 'No change in pass rate compared to historical data';
  }
}

// Integrate analytics into the cycle report
function integrateAnalyticsIntoReport(results: IterationResult[], startTime: number, endTime: number, historicalResults: IterationResult[]): void {
  const successRates = trackTaskSuccessRates(results);
  const duration = analyzeTaskTiming(startTime, endTime);
  const patterns = detectTaskPatterns(results);
  const historicalComparison = compareWithHistoricalData(results, historicalResults);

  console.log('\n📊 Task Analytics:');
  console.log(`   Pass Rate: ${successRates.passRate.toFixed(2)}%`);
  console.log(`   Review Rate: ${successRates.reviewRate.toFixed(2)}%`);
  console.log(`   Reject Rate: ${successRates.rejectRate.toFixed(2)}%`);
  console.log(`   Total Duration: ${duration.toFixed(2)} seconds`);
  console.log(`   Patterns Detected: ${patterns.join(', ') || 'None'}`);
  console.log(`   Historical Comparison: ${historicalComparison}`);
}

// Existing cycle code...

// Example usage of analytics in the cycle
const historicalResults: IterationResult[] = []; // This would be loaded from historical data
integrateAnalyticsIntoReport(results, startTime, Date.now(), historicalResults);

// Existing cycle code...
