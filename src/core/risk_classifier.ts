/**
 * Risk Classification - Single Source of Truth
 *
 * Centralizes tool risk classification logic used by both agent.ts and operational_gate.ts.
 * Pure function with no side effects, no fs access, no env dependencies.
 *
 * Protected patterns include:
 * - Critical files: package.json, .env, tsconfig, config, lockfiles
 * - Dangerous commands: rm -rf, sudo, chmod 777, git reset --hard
 * - Core operations: modify_self_config, destructive git commands
 * - Project structure: src/, config/, package files
 */

import type { ToolRiskLevel } from './metrics_v2';

/**
 * Classify tool risk level based on tool name and parameters
 *
 * Risk levels:
 * - readonly: Safe read operations (read_file, list_files, grep, web_search, etc.)
 * - write_normal: Mutation operations (git commit, mkdir, write regular files)
 * - write_critical: Critical file writes (package.json, .env, config/self.json)
 * - core: Self-modification or destructive commands (modify_self_config, rm -rf, sudo)
 *
 * @param toolName - Name of the tool being called
 * @param params - Tool parameters (used for param-aware classification)
 * @returns Risk level classification
 */
export function classifyToolRisk(toolName: string, params: Record<string, any>): ToolRiskLevel {
  // Core: Self-modification only
  if (toolName === 'modify_self_config') {
    return 'core';
  }

  if (toolName === 'write_file' || toolName === 'delete_file') {
    const filePath = params.path?.toLowerCase() || '';

    // Write Critical: package.json, .env, tsconfig, lockfiles, config/self.json
    if (filePath.match(/(^|\/)(package(-lock)?\.json|yarn\.lock|pnpm-lock\.yaml|\.env|tsconfig\.json|config\/self\.json)/)) {
      return 'write_critical';
    }

    // Write Normal: Regular files inside project
    return 'write_normal';
  }

  if (toolName === 'run_command') {
    const cmd = params.command?.toLowerCase() || '';

    // Core: Destructive/dangerous commands (denylist)
    if (cmd.match(/\b(rm\s+-rf?|git\s+reset\s+--hard|git\s+push\s+(-f|--force)|sudo|chmod\s+777|dd\s+if=)/)) {
      return 'core';
    }

    // Write Normal: Mutation operations (git commit, npm install, mkdir, etc.)
    if (cmd.match(/^(git\s+(commit|add|push|rm)|npm\s+install|mkdir|rm\s+[^-]|mv|cp|touch|echo\s+.*>)/)) {
      return 'write_normal';
    }

    return 'readonly';
  }

  return 'readonly';
}
