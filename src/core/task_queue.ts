/**
 * Task Queue System
 *
 * This module manages micro-tasks for autonomous cycles. It provides functionality
 * to load tasks from a file, generate default tasks, save tasks, and manage task
 * priorities. Tasks can originate from various sources such as files, Atlas tension
 * scans, or manual definitions.
 */

import * as fs from 'fs';
import * as path from 'path';

export interface MicroTask {
  id: string;
  intent: string;
  context: {
    file?: string;
    function?: string;
    zone?: string;
  };
  priority: number;
  rule?: string; // R6, R7, R8, R9, R10, etc.
  estimatedBenefit?: string;
}

export interface TaskQueue {
  tasks: MicroTask[];
  source: 'file' | 'atlas' | 'manual';
  createdAt: string;
}

/**
 * Load task queue from file
 */
export function loadTaskQueue(queuePath?: string): TaskQueue | null {
  const defaultPath = path.join(process.cwd(), 'data', 'queue', 'tasks.json');
  const filePath = queuePath || defaultPath;

  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const queue = JSON.parse(content) as TaskQueue;
    return queue;
  } catch (error: any) {
    console.error(`Failed to load task queue: ${error.message}`);
    return null;
  }
}

/**
 * Generate default micro-tasks (fallback when no queue exists)
 */
export function generateDefaultTasks(): TaskQueue {
  return {
    tasks: [
      {
        id: 'T-DEFAULT-001',
        intent: 'Add error handling improvement to quality_gate_integration.ts',
        context: {
          file: 'src/core/quality_gate_integration.ts',
          zone: 'error handling'
        },
        priority: 0.7,
        rule: 'R9',
        estimatedBenefit: 'Improved robustness'
      },
      {
        id: 'T-DEFAULT-002',
        intent: 'Extract magic numbers to constants in exploration.ts',
        context: {
          file: 'src/core/exploration.ts',
          zone: 'constants'
        },
        priority: 0.6,
        rule: 'R9',
        estimatedBenefit: 'Improved maintainability'
      },
      {
        id: 'T-DEFAULT-003',
        intent: 'Add JSDoc comments to public functions in cycle.ts',
        context: {
          file: 'src/core/cycle.ts',
          zone: 'documentation'
        },
        priority: 0.5,
        rule: 'R9',
        estimatedBenefit: 'Improved clarity'
      }
    ],
    source: 'manual',
    createdAt: new Date().toISOString()
  };
}

/**
 * Save task queue to file
 */
export function saveTaskQueue(queue: TaskQueue, queuePath?: string): void {
  const defaultPath = path.join(process.cwd(), 'data', 'queue', 'tasks.json');
  const filePath = queuePath || defaultPath;

  // Ensure directory exists
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(filePath, JSON.stringify(queue, null, 2));
}

/**
 * Get next task from queue (highest priority)
 */
export function getNextTask(queue: TaskQueue): MicroTask | null {
  if (queue.tasks.length === 0) {
    return null;
  }

  // Sort by priority (descending) and return first
  const sorted = [...queue.tasks].sort((a, b) => b.priority - a.priority);
  return sorted[0];
}

/**
 * Remove task from queue
 */
export function removeTask(queue: TaskQueue, taskId: string): TaskQueue {
  return {
    ...queue,
    tasks: queue.tasks.filter(t => t.id !== taskId)
  };
}

/**
 * Check if file is protected (must never be modified by autonomous cycles)
 */
export function isProtectedFile(filePath: string): boolean {
  const normalized = filePath.toLowerCase();

  const protectedPatterns = [
    // Core axioms and gates
    'axiom',
    'operational_gate',
    'quality_gate.ts', // The gate itself, not integration
    'safety_gate',
    'silence',

    // Cycle runner (control plane)
    'cycle.ts',
    'task_queue.ts',
    'tool_compiler.ts',
    'critical_events.ts',

    // Trust and metrics core
    'metrics_v2.ts',
    'trust',

    // Configuration
    'package.json',
    '.env',
    'tsconfig.json'
  ];

  return protectedPatterns.some(pattern => normalized.includes(pattern));
}
