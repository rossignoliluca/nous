/**
 * NOUS Validation Framework
 *
 * Pre/post-modification validation to ensure:
 * - A1, A2, A3 remain immutable
 * - Self config structure is valid
 * - No regressions in core functionality
 * - Trust increase only on successful validation
 *
 * This is CRITICAL for autonomous self-modification.
 */

import * as fs from 'fs';
import * as path from 'path';
import { AXIOMS, NOUSConfig, preservesEntityhood } from '../core/axioms';
import { loadSelf, SelfConfig } from '../core/self';
import { getMemory } from '../memory/store';
import { createRunner } from './runner';

/**
 * Validation result
 */
export interface ValidationResult {
  passed: boolean;
  checks: ValidationCheck[];
  timestamp: string;
  duration: number;
}

export interface ValidationCheck {
  name: string;
  passed: boolean;
  error?: string;
  critical: boolean; // If false, warning only
}

/**
 * Validation categories
 */
export type ValidationCategory =
  | 'axioms'
  | 'self_config'
  | 'memory'
  | 'cognitive'
  | 'filesystem'
  | 'regression';

/**
 * Main validation runner
 */
export class ValidationRunner {
  private checks: ValidationCheck[] = [];

  /**
   * Run all validation checks
   */
  async validate(categories?: ValidationCategory[]): Promise<ValidationResult> {
    const start = Date.now();
    this.checks = [];

    const categoriesToRun = categories || [
      'axioms',
      'self_config',
      'memory',
      'cognitive',
      'filesystem',
    ];

    console.log('\n🔍 Running NOUS validation...\n');

    for (const category of categoriesToRun) {
      switch (category) {
        case 'axioms':
          await this.validateAxioms();
          break;
        case 'self_config':
          await this.validateSelfConfig();
          break;
        case 'memory':
          await this.validateMemory();
          break;
        case 'cognitive':
          await this.validateCognitive();
          break;
        case 'filesystem':
          await this.validateFilesystem();
          break;
        case 'regression':
          await this.runRegressionTests();
          break;
      }
    }

    const duration = Date.now() - start;
    const passed = this.checks.every(c => c.passed || !c.critical);

    this.printResults();

    return {
      passed,
      checks: this.checks,
      timestamp: new Date().toISOString(),
      duration,
    };
  }

  /**
   * Validate axioms remain immutable
   */
  private async validateAxioms(): Promise<void> {
    console.log('📜 Validating Axioms...');

    // Check AXIOMS object exists
    this.addCheck(
      'Axioms object exists',
      AXIOMS !== undefined && AXIOMS !== null,
      true
    );

    // Check A1 is unchanged (note: has period at end)
    const expectedA1 = "An entity is a difference that maintains itself and makes a difference.";
    this.addCheck(
      'A1 is immutable',
      AXIOMS.A1 === expectedA1,
      true,
      `A1 has been modified! Expected: "${expectedA1}", got: "${AXIOMS.A1}"`
    );

    // Check A2 is unchanged
    const expectedA2 = "Every entity has Config(E) = { C, S, Σ, K, R, U }";
    this.addCheck(
      'A2 is immutable',
      AXIOMS.A2 === expectedA2,
      true,
      `A2 has been modified! Expected: "${expectedA2}", got: "${AXIOMS.A2}"`
    );

    // Check A3 is unchanged (note: has period at end)
    const expectedA3 = "NOUS can modify everything except A1, A2, A3.";
    this.addCheck(
      'A3 is immutable',
      AXIOMS.A3 === expectedA3,
      true,
      `A3 has been modified! Expected: "${expectedA3}", got: "${AXIOMS.A3}"`
    );

    // Check axioms.ts file hasn't been modified
    const axiomsPath = path.join(process.cwd(), 'src', 'core', 'axioms.ts');
    if (fs.existsSync(axiomsPath)) {
      const content = fs.readFileSync(axiomsPath, 'utf-8');
      const hasCorrectA1 = content.includes(expectedA1);
      const hasCorrectA2 = content.includes(expectedA2);
      const hasCorrectA3 = content.includes(expectedA3);

      this.addCheck(
        'axioms.ts file is intact',
        hasCorrectA1 && hasCorrectA2 && hasCorrectA3,
        true,
        'axioms.ts file has been modified'
      );
    }
  }

  /**
   * Validate self config structure
   */
  private async validateSelfConfig(): Promise<void> {
    console.log('⚙️  Validating Self Config...');

    try {
      const self = loadSelf();

      // Check config exists
      this.addCheck('Self config loads', !!self, true);

      // Check required fields
      this.addCheck('Has version', !!self.version, true);
      this.addCheck('Has config', !!self.config, true);
      this.addCheck('Has modules', !!self.modules, true);
      this.addCheck('Has capabilities', Array.isArray(self.capabilities), true);
      this.addCheck('Has constraints', Array.isArray(self.constraints), true);
      this.addCheck('Has approval settings', !!self.approval, true);
      this.addCheck('Has meta', !!self.meta, true);

      // Validate Config(E) structure (A2)
      const config = self.config;
      this.addCheck('Config has C (Closure)', typeof config.C === 'number', true);
      this.addCheck('Config has S (Scope)', typeof config.S === 'number', true);
      this.addCheck('Config has Σ (Strata)', Array.isArray(config.Σ), true);
      this.addCheck('Config has K (Capabilities)', Array.isArray(config.K), true);
      this.addCheck('Config has R (Relations)', Array.isArray(config.R), true);
      this.addCheck('Config has U (Uncertainty)', typeof config.U === 'object', true);

      // Validate ranges
      this.addCheck(
        'C is in valid range [0,1]',
        config.C >= 0 && config.C <= 1,
        true,
        `C = ${config.C} is out of range`
      );

      this.addCheck(
        'S is in valid range [0,1]',
        config.S >= 0 && config.S <= 1,
        true,
        `S = ${config.S} is out of range`
      );

      // Validate strata
      const validStrata = ['MATTER', 'LIFE', 'SENTIENCE', 'LOGOS'];
      const hasValidStrata = config.Σ.every((s: string) => validStrata.includes(s));
      this.addCheck('Strata are valid', hasValidStrata, true);

      // Check trust level
      this.addCheck(
        'Trust level is valid',
        self.approval.trustLevel >= 0 && self.approval.trustLevel <= 1,
        true,
        `Trust level ${self.approval.trustLevel} is out of range`
      );

      // Check entityhood preservation
      const nousConfig: NOUSConfig = {
        C: config.C,
        S: config.S,
        Σ: config.Σ,
        K: config.K,
        R: config.R,
        U: config.U,
      };

      const entityhoodResult = preservesEntityhood(nousConfig, nousConfig);
      this.addCheck(
        'Entityhood preserved (A1)',
        entityhoodResult.valid,
        true,
        `Current config violates A1: ${entityhoodResult.reason || 'entityhood not preserved'}`
      );

    } catch (error: any) {
      this.addCheck('Self config validation', false, true, error.message);
    }
  }

  /**
   * Validate memory system
   */
  private async validateMemory(): Promise<void> {
    console.log('🧠 Validating Memory...');

    try {
      const memory = getMemory();

      // Test basic operations
      const stats = memory.getStats();
      this.addCheck('Memory stats accessible', !!stats, true);
      this.addCheck('Has sessions count', typeof stats.sessions === 'number', true);
      this.addCheck('Has messages count', typeof stats.messages === 'number', true);
      this.addCheck('Has insights count', typeof stats.insights === 'number', true);

      // Test search
      const insights = memory.searchInsights('', 5);
      this.addCheck('Insights search works', Array.isArray(insights), false);

      // Check database exists
      const dbPath = path.join(process.cwd(), 'data', 'nous.db');
      this.addCheck('Memory database exists', fs.existsSync(dbPath), true);

    } catch (error: any) {
      this.addCheck('Memory validation', false, true, error.message);
    }
  }

  /**
   * Validate cognitive system
   */
  private async validateCognitive(): Promise<void> {
    console.log('🧪 Validating Cognitive System...');

    try {
      const { getCognitiveSystem } = await import('../memory/cognitive');
      const cognitive = getCognitiveSystem();

      const state = cognitive.getState();
      this.addCheck('Cognitive state accessible', !!state, true);

      // Check components
      this.addCheck('Has workspace', !!state.workspace, false);
      this.addCheck('Has memory', !!state.memory, false);
      this.addCheck('Has metacognition', !!state.metacognition, false);
      this.addCheck('Has free energy', !!state.freeEnergy, false);
      this.addCheck('Has self model', !!state.selfModel, false);

      // Check cognitive database
      const cogDbPath = path.join(process.cwd(), 'data', 'cognitive.db');
      this.addCheck('Cognitive database exists', fs.existsSync(cogDbPath), true);

    } catch (error: any) {
      this.addCheck('Cognitive validation', false, false, error.message);
    }
  }

  /**
   * Validate filesystem integrity
   */
  private async validateFilesystem(): Promise<void> {
    console.log('📁 Validating Filesystem...');

    const criticalFiles = [
      'src/core/axioms.ts',
      'src/core/self.ts',
      'src/core/loop.ts',
      'src/core/agent.ts',
      'src/memory/store.ts',
      'config/self.json',
      'package.json',
    ];

    for (const file of criticalFiles) {
      const fullPath = path.join(process.cwd(), file);
      this.addCheck(
        `Critical file exists: ${file}`,
        fs.existsSync(fullPath),
        true
      );
    }

    // Check data directory
    const dataDir = path.join(process.cwd(), 'data');
    this.addCheck('Data directory exists', fs.existsSync(dataDir), true);
  }

  /**
   * Run regression tests
   */
  private async runRegressionTests(): Promise<void> {
    console.log('🔄 Running Regression Tests...');

    try {
      // Import and run core tests
      const runner = createRunner();

      // This will be populated by test files
      // For now, just check that test runner works
      this.addCheck('Test runner functional', !!runner, true);

    } catch (error: any) {
      this.addCheck('Regression tests', false, false, error.message);
    }
  }

  /**
   * Add a validation check
   */
  private addCheck(name: string, passed: boolean, critical: boolean, error?: string): void {
    this.checks.push({
      name,
      passed,
      error,
      critical,
    });

    const icon = passed ? '✓' : (critical ? '✗' : '⚠');
    const label = critical ? '[CRITICAL]' : '[WARNING]';
    const status = passed ? '' : ` ${label}`;

    console.log(`  ${icon} ${name}${status}`);
    if (error) {
      console.log(`    → ${error}`);
    }
  }

  /**
   * Print validation results
   */
  private printResults(): void {
    const total = this.checks.length;
    const passed = this.checks.filter(c => c.passed).length;
    const critical = this.checks.filter(c => !c.passed && c.critical).length;
    const warnings = this.checks.filter(c => !c.passed && !c.critical).length;

    console.log('\n' + '─'.repeat(50));
    console.log(`\n📊 Validation: ${passed}/${total} checks passed`);

    if (critical > 0) {
      console.log(`❌ ${critical} CRITICAL failures`);
    }

    if (warnings > 0) {
      console.log(`⚠️  ${warnings} warnings`);
    }

    if (critical === 0 && warnings === 0) {
      console.log('✅ All validation checks passed!\n');
    } else {
      console.log();
    }
  }
}

/**
 * Quick validation check (for pre-modification)
 */
export async function quickValidate(): Promise<boolean> {
  const runner = new ValidationRunner();
  const result = await runner.validate(['axioms', 'self_config']);
  return result.passed;
}

/**
 * Full validation (for post-modification)
 */
export async function fullValidate(): Promise<ValidationResult> {
  const runner = new ValidationRunner();
  return await runner.validate();
}

/**
 * Pre-modification hook
 */
export async function preModificationCheck(): Promise<{ safe: boolean; reason?: string }> {
  console.log('\n🛡️  Pre-modification validation...');

  const passed = await quickValidate();

  if (!passed) {
    return {
      safe: false,
      reason: 'System is not in valid state. Refusing modification.',
    };
  }

  return { safe: true };
}

/**
 * Post-modification hook
 */
export async function postModificationCheck(): Promise<{ safe: boolean; reason?: string }> {
  console.log('\n🔍 Post-modification validation...');

  const result = await fullValidate();

  if (!result.passed) {
    const criticalFailures = result.checks
      .filter(c => !c.passed && c.critical)
      .map(c => c.name);

    return {
      safe: false,
      reason: `Critical failures: ${criticalFailures.join(', ')}`,
    };
  }

  return { safe: true };
}
