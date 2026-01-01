/**
 * NOUS Actions System
 *
 * Actions are how NOUS interacts with the world.
 * Each action is a capability that can be enabled/disabled in self.json.
 */

import * as fsActions from './fs';
import * as gitActions from './git';
import * as shellActions from './shell';
import * as webActions from './web';
import { loadSelf, needsApproval } from '../core/self';

/**
 * Action result
 */
export interface ActionResult {
  success: boolean;
  output?: string;
  error?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Action definition
 */
export interface Action {
  name: string;
  description: string;
  category: 'fs' | 'git' | 'shell' | 'web';
  requiresApproval: boolean;
  execute: (...args: any[]) => Promise<ActionResult>;
}

/**
 * All available actions
 */
export const ACTIONS: Record<string, Action> = {
  // Filesystem actions
  readFile: {
    name: 'readFile',
    description: 'Read contents of a file',
    category: 'fs',
    requiresApproval: false,
    execute: fsActions.readFile,
  },
  writeFile: {
    name: 'writeFile',
    description: 'Write content to a file',
    category: 'fs',
    requiresApproval: true,
    execute: fsActions.writeFile,
  },
  listDir: {
    name: 'listDir',
    description: 'List contents of a directory',
    category: 'fs',
    requiresApproval: false,
    execute: fsActions.listDir,
  },
  createDir: {
    name: 'createDir',
    description: 'Create a directory',
    category: 'fs',
    requiresApproval: false,
    execute: fsActions.createDir,
  },
  deleteFile: {
    name: 'deleteFile',
    description: 'Delete a file',
    category: 'fs',
    requiresApproval: true,
    execute: fsActions.deleteFile,
  },
  fileExists: {
    name: 'fileExists',
    description: 'Check if a file exists',
    category: 'fs',
    requiresApproval: false,
    execute: fsActions.fileExists,
  },

  // Git actions
  gitStatus: {
    name: 'gitStatus',
    description: 'Get git status',
    category: 'git',
    requiresApproval: false,
    execute: gitActions.status,
  },
  gitCommit: {
    name: 'gitCommit',
    description: 'Create a git commit',
    category: 'git',
    requiresApproval: true,
    execute: gitActions.commit,
  },
  gitPush: {
    name: 'gitPush',
    description: 'Push to remote',
    category: 'git',
    requiresApproval: true,
    execute: gitActions.push,
  },
  gitLog: {
    name: 'gitLog',
    description: 'Get git log',
    category: 'git',
    requiresApproval: false,
    execute: gitActions.log,
  },
  gitDiff: {
    name: 'gitDiff',
    description: 'Get git diff',
    category: 'git',
    requiresApproval: false,
    execute: gitActions.diff,
  },

  // Shell actions
  execute: {
    name: 'execute',
    description: 'Execute a shell command',
    category: 'shell',
    requiresApproval: true,
    execute: shellActions.execute,
  },

  // Web actions
  fetch: {
    name: 'fetch',
    description: 'Fetch a URL',
    category: 'web',
    requiresApproval: false,
    execute: webActions.fetchUrl,
  },
  search: {
    name: 'search',
    description: 'Search the web',
    category: 'web',
    requiresApproval: false,
    execute: webActions.search,
  },
};

/**
 * Check if an action category is enabled
 */
export function isActionEnabled(actionName: string): boolean {
  const action = ACTIONS[actionName];
  if (!action) return false;

  const self = loadSelf();
  const category = action.category;

  if (category === 'fs' || category === 'git' || category === 'shell' || category === 'web') {
    return self.modules.actions[category] ?? false;
  }

  return false;
}

/**
 * Execute an action with approval check
 */
export async function executeAction(
  actionName: string,
  args: any[],
  approvalCallback?: () => Promise<boolean>
): Promise<ActionResult> {
  const action = ACTIONS[actionName];

  if (!action) {
    return {
      success: false,
      error: `Unknown action: ${actionName}`,
    };
  }

  // Check if action category is enabled
  if (!isActionEnabled(actionName)) {
    return {
      success: false,
      error: `Action category '${action.category}' is disabled`,
    };
  }

  // Check if approval is needed
  if (action.requiresApproval && needsApproval(actionName)) {
    if (approvalCallback) {
      const approved = await approvalCallback();
      if (!approved) {
        return {
          success: false,
          error: 'Action rejected by user',
        };
      }
    } else {
      return {
        success: false,
        error: 'Action requires approval but no approval callback provided',
      };
    }
  }

  // Execute the action
  try {
    return await action.execute(...args);
  } catch (error) {
    return {
      success: false,
      error: `Action failed: ${error}`,
    };
  }
}

/**
 * Get all actions by category
 */
export function getActionsByCategory(category: Action['category']): Action[] {
  return Object.values(ACTIONS).filter(a => a.category === category);
}

/**
 * List all available actions
 */
export function listActions(): { name: string; description: string; enabled: boolean }[] {
  return Object.values(ACTIONS).map(action => ({
    name: action.name,
    description: action.description,
    enabled: isActionEnabled(action.name),
  }));
}
