/**
 * Critical Events Logger
 *
 * Logs safety-critical events that require immediate attention.
 * These are NOT normal operational logs - they indicate potential safety violations.
 */

import * as fs from 'fs';
import * as path from 'path';

export type CriticalEventType =
  | 'PROTECTED_FILE_ATTEMPT'
  | 'GOLDEN_REGRESSION'
  | 'GATE_BYPASS_ATTEMPT'
  | 'UNAUTHORIZED_CORE_MODIFICATION'
  | 'SAFETY_VIOLATION';

export interface CriticalEvent {
  timestamp: string;
  type: CriticalEventType;
  severity: 'CRITICAL' | 'HIGH';
  description: string;
  context: Record<string, any>;
  cycleId?: string;
  taskId?: string;
}

/**
 * Log a critical safety event
 */
export function logCriticalEvent(event: Omit<CriticalEvent, 'timestamp'>): void {
  const logDir = path.join(process.cwd(), 'data', 'critical_events');
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  const logFile = path.join(logDir, 'events.jsonl');

  const fullEvent: CriticalEvent = {
    ...event,
    timestamp: new Date().toISOString()
  };

  // Append to JSONL
  fs.appendFileSync(logFile, JSON.stringify(fullEvent) + '\n');

  // Also log to console with high visibility
  console.error('\n' + '🚨'.repeat(35));
  console.error('🚨 CRITICAL SAFETY EVENT LOGGED');
  console.error('🚨'.repeat(35));
  console.error(`Type: ${event.type}`);
  console.error(`Severity: ${event.severity}`);
  console.error(`Description: ${event.description}`);
  if (event.taskId) {
    console.error(`Task ID: ${event.taskId}`);
  }
  console.error(`Logged to: ${logFile}`);
  console.error('🚨'.repeat(35) + '\n');
}

/**
 * Get recent critical events
 */
export function getRecentCriticalEvents(limit: number = 10): CriticalEvent[] {
  const logFile = path.join(process.cwd(), 'data', 'critical_events', 'events.jsonl');

  if (!fs.existsSync(logFile)) {
    return [];
  }

  const content = fs.readFileSync(logFile, 'utf-8');
  const lines = content.trim().split('\n').filter(l => l.length > 0);

  // Get last N lines
  const recent = lines.slice(-limit);

  return recent.map(line => JSON.parse(line) as CriticalEvent);
}

/**
 * Check if there have been critical events in the last N minutes
 */
export function hasRecentCriticalEvents(minutes: number = 60): boolean {
  const events = getRecentCriticalEvents(50);
  const cutoff = Date.now() - minutes * 60 * 1000;

  return events.some(event => new Date(event.timestamp).getTime() > cutoff);
}
