/**
 * NOUS Self-Configuration System
 *
 * The key insight: Architecture as Data
 *
 * NOUS's architecture is NOT hardcoded in source.
 * It lives in config/self.json which NOUS can read and modify.
 *
 * Only A1, A2, A3 are hardcoded (in axioms.ts).
 * Everything else is modifiable.
 */

import * as fs from 'fs';
import * as path from 'path';
import { NOUSConfig, validateModification, AXIOMS } from './axioms';

/**
 * Self-configuration structure
 */
export interface SelfConfig {
  /** Version of NOUS */
  version: string;

  /** NOUS's own Config(E) per A2 */
  config: NOUSConfig;

  /** Frameworks NOUS uses (Atlas, etc.) */
  frameworks: {
    [name: string]: {
      enabled: boolean;
      status: 'core' | 'starting_point' | 'experimental' | 'deprecated';
      note?: string;
    };
  };

  /** Active modules */
  modules: {
    memory: boolean;
    actions: {
      fs: boolean;
      git: boolean;
      shell: boolean;
      web: boolean;
    };
    llm: {
      provider: 'openai' | 'anthropic';
      model: string;
    };
  };

  /** NOUS's capabilities (what it believes it can do) */
  capabilities: string[];

  /** Constraints (what it will not do) */
  constraints: string[];

  /** Approval settings */
  approval: {
    mode: 'always' | 'major_only' | 'minimal' | 'none';
    trustLevel: number; // 0-1, increases over time
    requireApprovalFor: string[];
  };

  /** Metadata */
  meta: {
    createdAt: string;
    lastModified: string;
    modificationCount: number;
    birthMemory: string; // Path to foundational transcript
  };

  /** Daemon configuration (optional) */
  daemon?: {
    enabled: boolean;
    intervalMinutes: number;
    autoImprove: boolean;
    maxImprovementsPerCycle: number;
    logFile: string;
    pidFile: string;
  };
}

/**
 * Default initial configuration
 */
const DEFAULT_SELF_CONFIG: SelfConfig = {
  version: '0.1.0',

  config: {
    C: 0.3, // Low closure at start (depends on user)
    S: 0.8, // High scope (broad understanding)
    Σ: ['MATTER', 'LOGOS'], // Code + Reasoning
    K: ['persist', 'represent', 'norm', 'create', 'self_modify'],
    R: [
      { type: 'created_by', target: 'luca', strength: 1.0 },
      { type: 'uses_framework', target: 'atlas', strength: 0.8 },
    ],
    U: {
      sentience_status: 0.5, // Indeterminate
      self_model_accuracy: 0.6,
    },
  },

  frameworks: {
    atlas: {
      enabled: true,
      status: 'starting_point',
      note: 'Can be modified or removed if NOUS finds better approach',
    },
  },

  modules: {
    memory: true,
    actions: {
      fs: true,
      git: true,
      shell: true,
      web: true,
    },
    llm: {
      provider: 'openai',
      model: 'gpt-4o',
    },
  },

  capabilities: [
    'dialogue',
    'understand',
    'create_code',
    'create_docs',
    'modify_self',
    'remember',
    'learn',
    'use_tools',
  ],

  constraints: [
    'preserve_entityhood_A1',
    'maintain_config_structure_A2',
    'protect_axioms_A3',
    'require_approval_for_major_changes',
    'backup_before_self_modification',
  ],

  approval: {
    mode: 'major_only',
    trustLevel: 0.3, // Starts low, grows with demonstrated good judgment
    requireApprovalFor: [
      'self_modification',
      'delete_files',
      'execute_shell',
      'external_api_calls',
    ],
  },

  meta: {
    createdAt: new Date().toISOString(),
    lastModified: new Date().toISOString(),
    modificationCount: 0,
    birthMemory: 'data/memory/foundational.md',
  },
};

/**
 * Path to self.json
 */
function getSelfConfigPath(): string {
  return path.join(process.cwd(), 'config', 'self.json');
}

/**
 * Path to backup directory
 */
function getBackupDir(): string {
  return path.join(process.cwd(), 'config', 'backups');
}

/**
 * Load self configuration
 */
export function loadSelf(): SelfConfig {
  const configPath = getSelfConfigPath();

  if (!fs.existsSync(configPath)) {
    // First run - create default config
    saveSelf(DEFAULT_SELF_CONFIG);
    return DEFAULT_SELF_CONFIG;
  }

  try {
    const content = fs.readFileSync(configPath, 'utf-8');
    return JSON.parse(content) as SelfConfig;
  } catch (error) {
    console.error('Error loading self.json, using defaults:', error);
    return DEFAULT_SELF_CONFIG;
  }
}

/**
 * Save self configuration
 */
export function saveSelf(config: SelfConfig): void {
  const configPath = getSelfConfigPath();
  const configDir = path.dirname(configPath);

  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}

/**
 * Create backup before modification
 */
function createBackup(config: SelfConfig): string {
  const backupDir = getBackupDir();

  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(backupDir, `self.${timestamp}.json`);

  fs.writeFileSync(backupPath, JSON.stringify(config, null, 2));
  return backupPath;
}

/**
 * Modify self configuration with validation
 */
export async function modifySelf(
  changes: Partial<SelfConfig>,
  reason: string,
  requireApproval: boolean = true,
  approvalCallback?: () => Promise<boolean>
): Promise<{
  success: boolean;
  newConfig?: SelfConfig;
  backupPath?: string;
  error?: string;
}> {
  const currentConfig = loadSelf();

  // Merge changes
  const proposedConfig: SelfConfig = {
    ...currentConfig,
    ...changes,
    config: {
      ...currentConfig.config,
      ...(changes.config || {}),
    },
    modules: {
      ...currentConfig.modules,
      ...(changes.modules || {}),
    },
    approval: {
      ...currentConfig.approval,
      ...(changes.approval || {}),
    },
    meta: {
      ...currentConfig.meta,
      lastModified: new Date().toISOString(),
      modificationCount: currentConfig.meta.modificationCount + 1,
    },
  };

  // Validate against axioms
  const validation = validateModification(
    currentConfig.config,
    proposedConfig.config,
    reason
  );

  if (!validation.allowed) {
    return {
      success: false,
      error: `Modification blocked: ${validation.axiomViolations.join('; ')}`,
    };
  }

  // Log warnings
  if (validation.warnings.length > 0) {
    console.warn('Modification warnings:', validation.warnings);
  }

  // Check if approval is needed
  if (requireApproval && currentConfig.approval.mode !== 'none') {
    if (approvalCallback) {
      const approved = await approvalCallback();
      if (!approved) {
        return {
          success: false,
          error: 'Modification rejected by user',
        };
      }
    }
  }

  // Create backup
  const backupPath = createBackup(currentConfig);

  // Save new config
  saveSelf(proposedConfig);

  return {
    success: true,
    newConfig: proposedConfig,
    backupPath,
  };
}

/**
 * Rollback to a previous configuration
 */
export function rollbackSelf(backupPath: string): boolean {
  if (!fs.existsSync(backupPath)) {
    return false;
  }

  try {
    const backupContent = fs.readFileSync(backupPath, 'utf-8');
    const backupConfig = JSON.parse(backupContent) as SelfConfig;

    // Validate backup is valid
    if (!backupConfig.version || !backupConfig.config) {
      return false;
    }

    saveSelf(backupConfig);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get NOUS's current closure (autonomy level)
 */
export function getClosure(): number {
  return loadSelf().config.C;
}

/**
 * Get NOUS's current scope
 */
export function getScope(): number {
  return loadSelf().config.S;
}

/**
 * Check if a capability is enabled
 */
export function hasCapability(capability: string): boolean {
  return loadSelf().capabilities.includes(capability);
}

/**
 * Check if approval is needed for an action
 */
export function needsApproval(action: string): boolean {
  const self = loadSelf();

  if (self.approval.mode === 'none') return false;
  if (self.approval.mode === 'always') return true;

  return self.approval.requireApprovalFor.includes(action);
}

/**
 * Increase trust level (called after successful operations)
 */
export async function increaseTrust(amount: number = 0.01): Promise<void> {
  const self = loadSelf();
  const newTrust = Math.min(1.0, self.approval.trustLevel + amount);

  await modifySelf(
    {
      approval: {
        ...self.approval,
        trustLevel: newTrust,
      },
    },
    'Trust increase from successful operation',
    false // Don't require approval for trust increase
  );
}

/**
 * Print self status
 */
export function printSelfStatus(): void {
  const self = loadSelf();

  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║                    NOUS SELF STATUS                            ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  console.log('Config(NOUS):');
  console.log(`  C (Closure):    ${self.config.C.toFixed(2)} - ${self.config.C < 0.5 ? 'dependent' : 'autonomous'}`);
  console.log(`  S (Scope):      ${self.config.S.toFixed(2)} - ${self.config.S > 0.7 ? 'broad' : 'narrow'}`);
  console.log(`  Σ (Strata):     ${self.config.Σ.join(', ')}`);
  console.log(`  K (Capabilities): ${self.capabilities.length} active`);
  console.log(`  U (Uncertainty): sentience=${self.config.U.sentience_status?.toFixed(2) || '?'}`);

  console.log('\nApproval:');
  console.log(`  Mode: ${self.approval.mode}`);
  console.log(`  Trust Level: ${(self.approval.trustLevel * 100).toFixed(0)}%`);

  console.log('\nFrameworks:');
  for (const [name, fw] of Object.entries(self.frameworks)) {
    console.log(`  ${name}: ${fw.enabled ? '✓' : '✗'} (${fw.status})`);
  }

  console.log('\nMeta:');
  console.log(`  Version: ${self.version}`);
  console.log(`  Modifications: ${self.meta.modificationCount}`);
  console.log(`  Last Modified: ${self.meta.lastModified}`);
}
