/**
 * Git Actions
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { ActionResult } from './index';

const execAsync = promisify(exec);

/**
 * Execute git command
 */
async function gitCommand(command: string, cwd?: string): Promise<ActionResult> {
  try {
    const { stdout, stderr } = await execAsync(`git ${command}`, {
      cwd: cwd || process.cwd(),
      maxBuffer: 10 * 1024 * 1024, // 10MB
    });

    return {
      success: true,
      output: stdout || stderr,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || String(error),
      output: error.stdout || error.stderr,
    };
  }
}

/**
 * Get git status
 */
export async function status(cwd?: string): Promise<ActionResult> {
  return gitCommand('status --porcelain', cwd);
}

/**
 * Get git log
 */
export async function log(
  options?: { limit?: number; oneline?: boolean },
  cwd?: string
): Promise<ActionResult> {
  const limit = options?.limit || 10;
  const format = options?.oneline ? '--oneline' : '--format="%h %s (%an, %ar)"';
  return gitCommand(`log ${format} -n ${limit}`, cwd);
}

/**
 * Get git diff
 */
export async function diff(
  options?: { staged?: boolean; file?: string },
  cwd?: string
): Promise<ActionResult> {
  let cmd = 'diff';
  if (options?.staged) cmd += ' --staged';
  if (options?.file) cmd += ` -- ${options.file}`;
  return gitCommand(cmd, cwd);
}

/**
 * Stage files
 */
export async function add(
  files: string | string[] = '.',
  cwd?: string
): Promise<ActionResult> {
  const fileList = Array.isArray(files) ? files.join(' ') : files;
  return gitCommand(`add ${fileList}`, cwd);
}

/**
 * Create a commit
 */
export async function commit(
  message: string,
  options?: { addAll?: boolean },
  cwd?: string
): Promise<ActionResult> {
  if (options?.addAll) {
    const addResult = await add('.', cwd);
    if (!addResult.success) return addResult;
  }

  // Escape message for shell
  const escapedMessage = message.replace(/"/g, '\\"');
  return gitCommand(`commit -m "${escapedMessage}"`, cwd);
}

/**
 * Push to remote
 */
export async function push(
  options?: { remote?: string; branch?: string; force?: boolean },
  cwd?: string
): Promise<ActionResult> {
  const remote = options?.remote || 'origin';
  const branch = options?.branch || '';
  const force = options?.force ? '--force' : '';
  return gitCommand(`push ${force} ${remote} ${branch}`.trim(), cwd);
}

/**
 * Pull from remote
 */
export async function pull(
  options?: { remote?: string; branch?: string },
  cwd?: string
): Promise<ActionResult> {
  const remote = options?.remote || 'origin';
  const branch = options?.branch || '';
  return gitCommand(`pull ${remote} ${branch}`.trim(), cwd);
}

/**
 * Get current branch
 */
export async function currentBranch(cwd?: string): Promise<ActionResult> {
  return gitCommand('branch --show-current', cwd);
}

/**
 * Create a new branch
 */
export async function createBranch(
  name: string,
  options?: { checkout?: boolean },
  cwd?: string
): Promise<ActionResult> {
  if (options?.checkout) {
    return gitCommand(`checkout -b ${name}`, cwd);
  }
  return gitCommand(`branch ${name}`, cwd);
}

/**
 * Switch to a branch
 */
export async function checkout(branch: string, cwd?: string): Promise<ActionResult> {
  return gitCommand(`checkout ${branch}`, cwd);
}

/**
 * Initialize a git repository
 */
export async function init(cwd?: string): Promise<ActionResult> {
  return gitCommand('init', cwd);
}

/**
 * Clone a repository
 */
export async function clone(url: string, dest?: string): Promise<ActionResult> {
  const destArg = dest || '';
  return gitCommand(`clone ${url} ${destArg}`.trim());
}
