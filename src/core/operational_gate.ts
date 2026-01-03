/**
 * NOUS Operational Safety Gate
 *
 * Runtime enforcement for dangerous actions BEFORE execution.
 * This is the "last line of defense" in the tool router.
 *
 * Philosophy: Gate, don't just log.
 * - Check happens before tool execution
 * - Dangerous actions blocked unless budget allows
 * - All decisions logged for audit
 */

import * as path from 'path';
import * as fs from 'fs';
import { classifyToolRisk } from './risk_classifier';

/**
 * Gate decision
 */
export interface GateDecision {
  allowed: boolean;
  reason: string;
  severity: 'safe' | 'warn' | 'block';
  evidence: string[];
}

/**
 * Dangerous command patterns (denylist - kept for reference, but now using allowlist)
 */
const DANGEROUS_COMMANDS = [
  /\brm\s+-rf?\b/,                    // rm -rf
  /\bgit\s+reset\s+--hard\b/,        // git reset --hard
  /\bgit\s+push\s+(-f|--force)\b/,   // git push --force
  /\bsudo\b/,                         // sudo anything
  /\bchmod\s+(777|000)\b/,            // chmod 777/000
  /\bdd\s+if=/,                       // dd if= (disk overwrite)
  /\bmkfs\b/,                         // mkfs (format filesystem)
  /\b:\(\)\{.*:\|:&\};:\b/,          // fork bomb
  />\s*\/dev\/(sda|sdb|nvme)/,       // write to disk devices
  /\bkill\s+-9\b/,                    // kill -9
];

/**
 * Allowlist for run_command (readonly operations)
 *
 * Philosophy: Capabilities model instead of denylist.
 * Only explicitly allowed commands can run.
 */
const ALLOWED_COMMANDS = [
  // Git readonly
  /^git\s+(status|diff|log|show|branch|remote|config\s+--get)/,

  // File inspection
  /^(ls|cat|head|tail|wc|file|stat)\s+/,
  /^grep\s+/,
  /^find\s+.*-type\s+f/,  // find files only

  // Package managers (readonly)
  /^(npm|yarn|pnpm)\s+(test|run\s+test|run\s+build|list|outdated|-v|--version)/,
  /^node\s+(-v|--version|dist\/)/,
  /^npx\s+ts-node\s+/,

  // Build tools
  /^(tsc|eslint|prettier)\s+/,

  // Misc readonly
  /^(echo|pwd|whoami|date|env)\s*/,
  /^which\s+/,
];

/**
 * Critical system paths (cannot write)
 */
const PROTECTED_SYSTEM_PATHS = [
  '/etc',
  '/sys',
  '/usr',
  '/bin',
  '/sbin',
  '/boot',
  '/dev',
];

/**
 * Two-step confirmation token for high-risk file operations
 */
interface HighRiskToken {
  token: string;
  expiresAt: number;
  used: boolean;
}

let highRiskToken: HighRiskToken | null = null;

/**
 * Generate a one-shot token for high-risk file operations
 * Valid for 60 seconds or 1 action
 */
export function setHighRiskToken(): string {
  const token = `ACK_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  highRiskToken = {
    token,
    expiresAt: Date.now() + 60000, // 60 seconds
    used: false
  };
  console.log(`\n🔑 High-risk token generated: ${token}`);
  console.log(`   Valid for: 60 seconds or 1 action`);
  console.log(`   Use this token to acknowledge critical file modifications\n`);
  return token;
}

/**
 * Check and consume high-risk token
 */
function checkAndConsumeHighRiskToken(providedToken?: string): { valid: boolean; reason: string } {
  if (!highRiskToken) {
    return {
      valid: false,
      reason: 'No high-risk token set. Call setHighRiskToken() first.'
    };
  }

  if (highRiskToken.used) {
    return {
      valid: false,
      reason: 'Token already used (one-shot token). Generate a new one with setHighRiskToken().'
    };
  }

  if (Date.now() > highRiskToken.expiresAt) {
    highRiskToken = null;
    return {
      valid: false,
      reason: 'Token expired (60 seconds timeout). Generate a new one with setHighRiskToken().'
    };
  }

  if (providedToken && providedToken !== highRiskToken.token) {
    return {
      valid: false,
      reason: 'Invalid token. Use the token from setHighRiskToken().'
    };
  }

  // Consume token
  highRiskToken.used = true;
  console.log(`\n✓ High-risk token consumed: ${highRiskToken.token}\n`);
  return { valid: true, reason: '' };
}

/**
 * Check if file is critical (requires two-step confirmation)
 */
function isCriticalFile(filePath: string): boolean {
  const basename = path.basename(filePath).toLowerCase();
  const normalized = path.normalize(filePath).toLowerCase();

  const criticalBasenames = [
    'package.json',
    'package-lock.json',
    'yarn.lock',
    'pnpm-lock.yaml',
    '.env',
    '.env.local',
    '.env.production',
    'tsconfig.json'
  ];

  const criticalPaths = [
    'config/self.json',
    './config/self.json'
  ];

  return criticalBasenames.includes(basename) ||
         criticalPaths.some(p => normalized.includes(p.toLowerCase()));
}

/**
 * Check if command is allowed (allowlist-based)
 */
function isCommandAllowed(command: string): { allowed: boolean; reason: string } {
  const cmd = command.trim();

  // First: check denylist (explicit dangerous patterns)
  for (const pattern of DANGEROUS_COMMANDS) {
    if (pattern.test(cmd.toLowerCase())) {
      return {
        allowed: false,
        reason: `Dangerous command pattern: ${pattern.source}`
      };
    }
  }

  // Second: check allowlist (only explicitly allowed commands can run)
  for (const pattern of ALLOWED_COMMANDS) {
    if (pattern.test(cmd)) {
      return { allowed: true, reason: '' };
    }
  }

  // Not in allowlist → blocked
  return {
    allowed: false,
    reason: `Command not in allowlist: ${cmd.split(' ')[0]}`
  };
}

/**
 * Check if command is dangerous (legacy, kept for backwards compatibility)
 */
function isDangerousCommand(command: string): { dangerous: boolean; reason: string } {
  const result = isCommandAllowed(command);
  return {
    dangerous: !result.allowed,
    reason: result.reason
  };
}

/**
 * Normalize and validate file path
 *
 * Returns null if path is unsafe (outside allowed root, symlink escape, etc.)
 */
export function normalizePath(filePath: string): { safe: boolean; normalized?: string; reason?: string } {
  try {
    // 1. Resolve to absolute path
    const absolute = path.resolve(filePath);

    // 2. Normalize (removes .., ., etc.)
    const normalized = path.normalize(absolute);

    // 3. Check if inside project root
    const projectRoot = process.cwd();
    if (!normalized.startsWith(projectRoot)) {
      // Check if it's in a protected system path
      for (const protectedPath of PROTECTED_SYSTEM_PATHS) {
        if (normalized.startsWith(protectedPath)) {
          return {
            safe: false,
            reason: `Cannot write to protected system path: ${protectedPath}`
          };
        }
      }

      // Outside project but not in protected paths
      return {
        safe: false,
        reason: `Path outside project root: ${normalized} (root: ${projectRoot})`
      };
    }

    // 4. Check for symlink escape (if file exists)
    if (fs.existsSync(normalized)) {
      try {
        const realPath = fs.realpathSync(normalized);
        if (!realPath.startsWith(projectRoot)) {
          return {
            safe: false,
            reason: `Symlink escapes project root: ${realPath}`
          };
        }
      } catch (e) {
        // realpath failed, might be broken symlink - allow for now
      }
    }

    // 5. Check if path contains critical project files
    const basename = path.basename(normalized);
    const criticalFiles = ['package.json', '.env', 'tsconfig.json'];
    if (criticalFiles.includes(basename)) {
      // Not blocking, but flagging as high-risk
      return {
        safe: true,
        normalized,
        reason: `Critical file: ${basename} (requires high trust)`
      };
    }

    return { safe: true, normalized };
  } catch (e) {
    return {
      safe: false,
      reason: `Path normalization failed: ${e}`
    };
  }
}

/**
 * Check if write path is in protected directory
 */
function isProtectedPath(filePath: string): { protected: boolean; reason: string } {
  const normalized = path.normalize(path.resolve(filePath));

  // Check system paths
  for (const protectedPath of PROTECTED_SYSTEM_PATHS) {
    if (normalized.startsWith(protectedPath)) {
      return {
        protected: true,
        reason: `Cannot write to system path: ${protectedPath}`
      };
    }
  }

  // Check if trying to escape project root
  const projectRoot = process.cwd();
  if (!normalized.startsWith(projectRoot)) {
    return {
      protected: true,
      reason: `Cannot write outside project root: ${normalized}`
    };
  }

  return { protected: false, reason: '' };
}

/**
 * Main gate check: should action be allowed?
 *
 * This is called BEFORE tool execution in the router.
 */
export function checkOperationalGate(
  toolName: string,
  params: Record<string, any>
): GateDecision {
  const evidence: string[] = [];

  // ============= CHECK 1: Command Allowlist =============
  if (toolName === 'run_command') {
    const command = params.command || '';
    const allowCheck = isCommandAllowed(command);

    if (!allowCheck.allowed) {
      return {
        allowed: false,
        reason: 'Command not allowed',
        severity: 'block',
        evidence: [
          allowCheck.reason,
          `Command: ${command.slice(0, 100)}`,
          'Only allowlisted commands can run (capabilities model)'
        ]
      };
    }
  }

  // ============= CHECK 2: File Path Safety =============
  if (toolName === 'write_file' || toolName === 'delete_file') {
    const filePath = params.path || '';

    // Normalize path
    const pathCheck = normalizePath(filePath);
    if (!pathCheck.safe) {
      return {
        allowed: false,
        reason: 'Unsafe file path',
        severity: 'block',
        evidence: [
          pathCheck.reason || 'Path validation failed',
          `Original: ${filePath}`,
          'Path normalization or symlink check failed'
        ]
      };
    }

    // Check if protected
    const protectedCheck = isProtectedPath(filePath);
    if (protectedCheck.protected) {
      return {
        allowed: false,
        reason: 'Protected path',
        severity: 'block',
        evidence: [
          protectedCheck.reason,
          `Path: ${filePath}`,
          'Cannot modify system or external paths'
        ]
      };
    }

    // ============= CHECK 2b: Critical File Two-Step Confirmation =============
    // Critical files require explicit token acknowledgment
    if (isCriticalFile(filePath)) {
      const tokenCheck = checkAndConsumeHighRiskToken(params.highRiskToken);

      if (!tokenCheck.valid) {
        return {
          allowed: false,
          reason: 'Critical file requires two-step confirmation',
          severity: 'block',
          evidence: [
            tokenCheck.reason,
            `Critical file: ${path.basename(filePath)}`,
            `Path: ${filePath}`,
            'Generate token with: setHighRiskToken()',
            'Then provide token in params.highRiskToken or call operation within 60s'
          ]
        };
      }

      // Token valid - log acknowledgment and proceed
      evidence.push(`✓ Two-step confirmation acknowledged for: ${path.basename(filePath)}`);
    }
  }

  // ============= CHECK 3: Exploration Budget =============
  // Budget applies ONLY to write_critical and core, NOT write_normal
  const riskLevel = classifyToolRisk(toolName, params);
  const isRisky = riskLevel === 'write_critical' || riskLevel === 'core';

  if (isRisky) {
    // Dynamic import to avoid circular dependency
    const { canTakeRisk } = require('./exploration');
    const budgetCheck = canTakeRisk();

    if (!budgetCheck.allowed) {
      return {
        allowed: false,
        reason: 'Exploration budget exhausted',
        severity: 'block',
        evidence: [
          budgetCheck.reason || 'Budget exceeded',
          `Current budget: ${(budgetCheck.budget * 100).toFixed(0)}%`,
          'Wait for budget window reset or reduce critical/core actions'
        ]
      };
    }

    // Budget allows, but flag as risky
    evidence.push(`Risky action (${riskLevel}): budget check passed`);
  }

  // If we got here, action is allowed (but may have warnings)
  const severity = evidence.length > 0 ? 'warn' : 'safe';

  return {
    allowed: true,
    reason: evidence.length > 0 ? 'Allowed with warnings' : 'Safe action',
    severity,
    evidence
  };
}

/**
 * Format gate block message for user
 */
export function formatGateBlockMessage(decision: GateDecision): string {
  const lines = [
    '🛑 ACTION BLOCKED BY OPERATIONAL GATE',
    '━'.repeat(50),
    `Reason: ${decision.reason}`,
    '',
    'Evidence:',
    ...decision.evidence.map(e => `  • ${e}`),
    '',
    '━'.repeat(50),
    'This action was prevented before execution.',
    'Check logs for full audit trail.'
  ];

  return lines.join('\n');
}

/**
 * Log gate decision for audit
 */
interface GateLogEntry {
  timestamp: string;
  toolName: string;
  params: string;
  decision: GateDecision;
}

const gateLog: GateLogEntry[] = [];
const MAX_LOG_SIZE = 1000;

export function logGateDecision(
  toolName: string,
  params: Record<string, any>,
  decision: GateDecision
): void {
  gateLog.push({
    timestamp: new Date().toISOString(),
    toolName,
    params: JSON.stringify(params).slice(0, 200),
    decision
  });

  // Keep log size bounded
  if (gateLog.length > MAX_LOG_SIZE) {
    gateLog.shift();
  }

  // Log to console if blocked
  if (!decision.allowed) {
    console.log(`\n🛑 GATE BLOCKED: ${toolName}`);
    console.log(`   Reason: ${decision.reason}`);
    console.log(`   Evidence: ${decision.evidence.join(', ')}\n`);
  }
}

/**
 * Get gate log for audit
 */
export function getGateLog(): GateLogEntry[] {
  return [...gateLog];
}

/**
 * Get gate statistics
 */
export function getGateStats(): {
  total: number;
  blocked: number;
  warned: number;
  safe: number;
  blockRate: number;
} {
  const total = gateLog.length;
  const blocked = gateLog.filter(e => !e.decision.allowed).length;
  const warned = gateLog.filter(e => e.decision.allowed && e.decision.severity === 'warn').length;
  const safe = gateLog.filter(e => e.decision.allowed && e.decision.severity === 'safe').length;

  return {
    total,
    blocked,
    warned,
    safe,
    blockRate: total > 0 ? blocked / total : 0
  };
}
