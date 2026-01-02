/**
 * NOUS Core Files Protection
 *
 * These files can only be modified via Pull Request, not by NOUS directly.
 * This ensures system stability and prevents NOUS from accidentally breaking itself.
 *
 * Philosophy:
 * - Core logic is sacred
 * - NOUS can modify config, not code
 * - PR review = human verification
 */

/**
 * Files that are PR-only (cannot be modified by NOUS)
 */
export const PROTECTED_FILES = [
  // Core system files
  'src/core/axioms.ts',           // A1, A2, A3 - immutable
  'src/core/loop.ts',             // Main NOUS loop
  'src/core/agent.ts',            // Agent execution
  'src/core/self.ts',             // Self config management
  'src/core/metrics.ts',          // Metrics computation
  'src/core/rollback.ts',         // Rollback guard
  'src/core/protected_files.ts',  // This file

  // Memory system
  'src/memory/store.ts',
  'src/memory/cognitive/index.ts',
  'src/memory/cognitive/complementary_learning.ts',
  'src/memory/cognitive/global_workspace.ts',
  'src/memory/cognitive/free_energy.ts',
  'src/memory/cognitive/metacognition.ts',

  // LLM integration
  'src/llm/index.ts',
  'src/llm/openai.ts',
  'src/llm/anthropic.ts',
  'src/llm/gemini.ts',

  // Entry point
  'src/index.ts',

  // Package dependencies
  'package.json',
  'package-lock.json',
  'tsconfig.json',

  // Git
  '.git/**/*',
  '.gitignore',

  // Axioms backup
  'config/backups/**/*',
];

/**
 * Check if a file is protected
 */
export function isFileProtected(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, '/');

  for (const pattern of PROTECTED_FILES) {
    // Exact match
    if (normalized === pattern) {
      return true;
    }

    // Wildcard match (e.g., "config/backups/**/*")
    if (pattern.includes('**')) {
      const regex = new RegExp('^' + pattern.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*') + '$');
      if (regex.test(normalized)) {
        return true;
      }
    }

    // Directory match
    if (pattern.endsWith('/') && normalized.startsWith(pattern)) {
      return true;
    }
  }

  return false;
}

/**
 * Get protection reason for a file
 */
export function getProtectionReason(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/');

  if (normalized.includes('axioms.ts')) {
    return 'Contains A1, A2, A3 - immutable axioms';
  }

  if (normalized.includes('core/')) {
    return 'Core system file - modifications require PR review';
  }

  if (normalized.includes('memory/')) {
    return 'Memory system file - modifications require PR review';
  }

  if (normalized.includes('llm/')) {
    return 'LLM integration - modifications require PR review';
  }

  if (normalized.includes('package.json')) {
    return 'Dependencies - modifications require PR review';
  }

  if (normalized.includes('.git')) {
    return 'Git repository - cannot be modified';
  }

  if (normalized.includes('backups/')) {
    return 'Backup directory - read-only';
  }

  return 'Protected file - modifications require PR review';
}

/**
 * Validate file modification request
 */
export function validateFileModification(filePath: string): {
  allowed: boolean;
  reason?: string;
} {
  if (isFileProtected(filePath)) {
    return {
      allowed: false,
      reason: getProtectionReason(filePath),
    };
  }

  return { allowed: true };
}
