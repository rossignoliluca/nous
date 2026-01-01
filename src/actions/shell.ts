/**
 * Shell Actions
 *
 * WARNING: Shell execution is powerful and potentially dangerous.
 * Always requires approval unless explicitly disabled.
 */

import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import { ActionResult } from './index';

const execAsync = promisify(exec);

/**
 * Dangerous command patterns to block
 */
const DANGEROUS_PATTERNS = [
  /rm\s+-rf\s+\/(?!\w)/,      // rm -rf /
  /rm\s+-rf\s+~\//,           // rm -rf ~/
  /mkfs\./,                    // filesystem format
  /dd\s+if=.*of=\/dev/,       // dd to device
  />\s*\/dev\/sd[a-z]/,       // write to disk
  /chmod\s+-R\s+777\s+\//,    // chmod 777 /
  /:\(\)\{\s*:\|:\s*&\s*\};:/, // fork bomb
];

/**
 * Check if command is potentially dangerous
 */
function isDangerous(command: string): boolean {
  return DANGEROUS_PATTERNS.some(pattern => pattern.test(command));
}

/**
 * Execute a shell command
 */
export async function execute(
  command: string,
  options?: {
    cwd?: string;
    timeout?: number;
    maxBuffer?: number;
  }
): Promise<ActionResult> {
  // Block dangerous commands
  if (isDangerous(command)) {
    return {
      success: false,
      error: 'Command blocked: potentially dangerous operation',
    };
  }

  try {
    const { stdout, stderr } = await execAsync(command, {
      cwd: options?.cwd || process.cwd(),
      timeout: options?.timeout || 60000, // 1 minute default
      maxBuffer: options?.maxBuffer || 10 * 1024 * 1024, // 10MB
    });

    return {
      success: true,
      output: stdout,
      metadata: {
        stderr: stderr || undefined,
        command,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || String(error),
      output: error.stdout,
      metadata: {
        stderr: error.stderr,
        code: error.code,
        command,
      },
    };
  }
}

/**
 * Execute multiple commands in sequence
 */
export async function executeSequence(
  commands: string[],
  options?: { cwd?: string; stopOnError?: boolean }
): Promise<ActionResult> {
  const results: { command: string; success: boolean; output?: string }[] = [];

  for (const command of commands) {
    const result = await execute(command, { cwd: options?.cwd });
    results.push({
      command,
      success: result.success,
      output: result.output,
    });

    if (!result.success && options?.stopOnError !== false) {
      return {
        success: false,
        error: `Command failed: ${command}`,
        metadata: { results },
      };
    }
  }

  return {
    success: true,
    output: results.map(r => r.output).join('\n'),
    metadata: { results },
  };
}

/**
 * Run npm/yarn command
 */
export async function npm(
  command: string,
  options?: { cwd?: string; useYarn?: boolean }
): Promise<ActionResult> {
  const pm = options?.useYarn ? 'yarn' : 'npm';
  return execute(`${pm} ${command}`, { cwd: options?.cwd });
}

/**
 * Check if a command exists
 */
export async function commandExists(command: string): Promise<ActionResult> {
  try {
    await execAsync(`which ${command}`);
    return {
      success: true,
      output: 'true',
      metadata: { exists: true },
    };
  } catch {
    return {
      success: true,
      output: 'false',
      metadata: { exists: false },
    };
  }
}

/**
 * Get environment variable
 */
export async function getEnv(name: string): Promise<ActionResult> {
  const value = process.env[name];
  return {
    success: true,
    output: value || '',
    metadata: { exists: !!value },
  };
}

/**
 * Get current working directory
 */
export async function cwd(): Promise<ActionResult> {
  return {
    success: true,
    output: process.cwd(),
  };
}

/**
 * Get system info
 */
export async function systemInfo(): Promise<ActionResult> {
  const os = await import('os');

  const info = {
    platform: os.platform(),
    arch: os.arch(),
    hostname: os.hostname(),
    cpus: os.cpus().length,
    memory: {
      total: os.totalmem(),
      free: os.freemem(),
    },
    uptime: os.uptime(),
    user: os.userInfo().username,
    home: os.homedir(),
  };

  return {
    success: true,
    output: JSON.stringify(info, null, 2),
    metadata: info,
  };
}
