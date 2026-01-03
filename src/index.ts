#!/usr/bin/env node

/**
 * NOUS - Entry Point
 *
 * νοῦς — An autopoietic system that understands by building
 *
 * Usage:
 *   nous           - Start interactive session
 *   nous --status  - Show status
 *   nous --init    - Initialize/reset
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// Load environment variables
dotenv.config();

// Also try to load from ~/.zshrc style exports
const zshrcPath = path.join(process.env.HOME || '', '.zshrc');
if (fs.existsSync(zshrcPath)) {
  const zshrc = fs.readFileSync(zshrcPath, 'utf-8');
  const envMatches = zshrc.matchAll(/export\s+(\w+)=["']?([^"'\n]+)["']?/g);
  for (const match of envMatches) {
    if (!process.env[match[1]]) {
      process.env[match[1]] = match[2];
    }
  }
}

import { Command } from 'commander';
import { nousLoop } from './core/loop';
import { loadSelf, printSelfStatus, saveSelf } from './core/self';
import { getMemory } from './memory/store';
import { AXIOMS } from './core/axioms';
import { selfImprovementCycle, analyzeForImprovements, proposeImprovement } from './work/improve';
import { startDaemon, stopDaemon, getDaemonStatus, runOnce } from './core/daemon';
import { generateReport, getMetrics, resetMetrics } from './core/metrics_v2';
import { listSnapshots, rollbackToSnapshot, clearSnapshots } from './core/rollback';
import { fullValidate } from './testing/validation';
import { createRunner } from './testing/runner';
import { registerGuardrailsTests } from './testing/guardrails.test';
import { registerGateSmokeTests } from './testing/gate_smoke.test';
import { generateExplorationReport, getExplorationStatus, adjustBudgetManual, resetExploration } from './core/exploration';

const program = new Command();

program
  .name('nous')
  .description('NOUS - An autopoietic system that understands by building')
  .version('0.1.0');

program
  .command('start', { isDefault: true })
  .description('Start interactive NOUS session')
  .action(async () => {
    // Check for API key
    if (!process.env.OPENAI_API_KEY && !process.env.ANTHROPIC_API_KEY) {
      console.error('Error: No API key found.');
      console.error('Set OPENAI_API_KEY or ANTHROPIC_API_KEY in your environment.');
      process.exit(1);
    }

    await nousLoop();
  });

program
  .command('status')
  .description('Show NOUS status')
  .action(() => {
    printSelfStatus();

    const memory = getMemory();
    const stats = memory.getStats();

    console.log('\nMemory:');
    console.log(`  Sessions: ${stats.sessions}`);
    console.log(`  Messages: ${stats.messages}`);
    console.log(`  Insights: ${stats.insights}`);
    console.log(`  Projects: ${stats.projects}`);

    memory.close();
  });

program
  .command('axioms')
  .description('Show the immutable axioms')
  .action(() => {
    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║              NOUS IMMUTABLE AXIOMS                             ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');

    console.log('A1: ENTITY AXIOM');
    console.log(`    "${AXIOMS.A1}"\n`);

    console.log('A2: CONFIGURATION AXIOM');
    console.log(`    "${AXIOMS.A2}"\n`);

    console.log('A3: META-PROTECTION AXIOM');
    console.log(`    "${AXIOMS.A3}"\n`);

    console.log('These axioms are HARDCODED and IMMUTABLE.');
    console.log('NOUS can modify everything EXCEPT these three.');
  });

program
  .command('init')
  .description('Initialize NOUS (creates config and loads foundational memory)')
  .option('-f, --force', 'Force reinitialize even if already initialized')
  .action(async (options) => {
    console.log('Initializing NOUS...\n');

    const configPath = path.join(process.cwd(), 'config', 'self.json');
    const exists = fs.existsSync(configPath);

    if (exists && !options.force) {
      console.log('NOUS is already initialized.');
      console.log('Use --force to reinitialize (this will reset configuration).');
      return;
    }

    // Load default config (this creates it if doesn't exist)
    const self = loadSelf();
    console.log('✓ Configuration created');

    // Initialize memory
    const memory = getMemory();
    console.log('✓ Memory database initialized');

    // Load foundational transcript as first memory
    const foundationalPath = path.join(process.cwd(), 'data', 'memory', 'foundational.md');
    if (fs.existsSync(foundationalPath)) {
      const transcript = fs.readFileSync(foundationalPath, 'utf-8');

      // Extract key insights from foundational transcript
      const insights = [
        'NOUS is an autopoietic system that understands by building',
        'A1: An entity maintains itself and makes a difference',
        'A2: Every entity has Config(E) = { C, S, Σ, K, R, U }',
        'A3: NOUS can modify everything except A1, A2, A3',
        'Atlas is a starting framework, not sacred - can be modified or removed',
        'Understanding and building are the same gesture',
        'Trust is earned through demonstrated good judgment',
        'Architecture lives in self.json, not hardcoded',
        'NOUS collaborates with Luca, not serves',
        'The process itself is the end, not a specific goal',
      ];

      for (const insight of insights) {
        memory.addInsight(insight, 'foundational', 'principle', 0.95);
      }

      console.log(`✓ Loaded ${insights.length} foundational insights`);
    } else {
      console.log('! Foundational transcript not found at data/memory/foundational.md');
    }

    console.log('\nNOUS initialized successfully.');
    console.log('Run `nous` or `npm run nous` to start.\n');

    memory.close();
  });

program
  .command('memory')
  .description('Memory operations')
  .option('-s, --stats', 'Show memory statistics')
  .option('-i, --insights [limit]', 'Show recent insights')
  .option('-p, --projects', 'Show projects')
  .option('--clear-sessions', 'Clear all sessions (keeps insights)')
  .action((options) => {
    const memory = getMemory();

    if (options.stats || Object.keys(options).length === 0) {
      const stats = memory.getStats();
      console.log('\nMemory Statistics:');
      console.log(`  Sessions: ${stats.sessions}`);
      console.log(`  Messages: ${stats.messages}`);
      console.log(`  Insights: ${stats.insights}`);
      console.log(`  Projects: ${stats.projects}`);
      console.log(`  Self-modifications: ${stats.modifications}`);
    }

    if (options.insights) {
      const limit = typeof options.insights === 'string' ? parseInt(options.insights) : 10;
      const insights = memory.searchInsights('', limit);
      console.log('\nRecent Insights:');
      for (const insight of insights) {
        console.log(`  [${insight.category}] ${insight.content}`);
        console.log(`    confidence: ${insight.confidence.toFixed(2)}, refs: ${insight.referenceCount}`);
      }
    }

    if (options.projects) {
      const projects = memory.getActiveProjects();
      console.log('\nActive Projects:');
      if (projects.length === 0) {
        console.log('  (none)');
      } else {
        for (const project of projects) {
          console.log(`  ${project.name}: ${project.description}`);
        }
      }
    }

    memory.close();
  });

program
  .command('config')
  .description('Configuration operations')
  .option('-s, --show', 'Show current configuration')
  .option('-e, --edit <key=value>', 'Edit a configuration value')
  .action(async (options) => {
    const self = loadSelf();

    if (options.show || Object.keys(options).length === 0) {
      console.log(JSON.stringify(self, null, 2));
    }

    if (options.edit) {
      const [key, value] = options.edit.split('=');
      console.log(`Would edit ${key} = ${value}`);
      console.log('(Configuration editing via CLI not yet implemented)');
    }
  });

// Self-improvement commands
program
  .command('improve')
  .description('Self-improvement operations')
  .option('-a, --analyze', 'Analyze codebase for potential improvements')
  .option('-r, --run [goal]', 'Run self-improvement cycle')
  .option('-p, --propose <description>', 'Propose a specific improvement')
  .action(async (options) => {
    // Check for API key
    if (!process.env.OPENAI_API_KEY && !process.env.ANTHROPIC_API_KEY) {
      console.error('Error: No API key found.');
      process.exit(1);
    }

    if (options.analyze) {
      console.log('\n🔍 Analyzing codebase for improvements...\n');
      const suggestions = await analyzeForImprovements();
      console.log('Potential improvements:');
      suggestions.forEach((s, i) => console.log(`${i + 1}. ${s}`));
    } else if (options.run !== undefined) {
      const goal = typeof options.run === 'string' ? options.run : undefined;
      await selfImprovementCycle(goal);
    } else if (options.propose) {
      console.log(`\n📝 Proposing improvement: ${options.propose}\n`);
      const proposal = await proposeImprovement(options.propose);
      console.log('Proposal created:');
      console.log(`  ID: ${proposal.id}`);
      console.log(`  Risk: ${proposal.risk}`);
      console.log(`  Requires Approval: ${proposal.requiresApproval}`);
      console.log(`  Changes: ${proposal.changes.length} files`);
    } else {
      console.log('Use --analyze, --run, or --propose <description>');
    }
  });

// Daemon commands
program
  .command('daemon')
  .description('Background daemon operations')
  .argument('<action>', 'start, stop, status, or once')
  .action(async (action) => {
    switch (action) {
      case 'start':
        // Check for API key
        if (!process.env.OPENAI_API_KEY && !process.env.ANTHROPIC_API_KEY) {
          console.error('Error: No API key found.');
          process.exit(1);
        }
        await startDaemon();
        break;

      case 'stop':
        stopDaemon();
        break;

      case 'status':
        const status = getDaemonStatus();
        console.log('\nNOUS Daemon Status:');
        console.log(`  Running: ${status.running ? 'Yes' : 'No'}`);
        if (status.pid) console.log(`  PID: ${status.pid}`);
        console.log(`  Interval: ${status.config.intervalMinutes} minutes`);
        console.log(`  Auto-improve: ${status.config.autoImprove}`);
        if (status.lastActivity) console.log(`  Last activity: ${status.lastActivity}`);
        break;

      case 'once':
        // Check for API key
        if (!process.env.OPENAI_API_KEY && !process.env.ANTHROPIC_API_KEY) {
          console.error('Error: No API key found.');
          process.exit(1);
        }
        await runOnce();
        break;

      default:
        console.log('Unknown action. Use: start, stop, status, or once');
    }
  });

// Metrics command
program
  .command('metrics')
  .description('Show performance metrics and derived values')
  .option('-r, --reset', 'Reset metrics to zero')
  .action((options) => {
    if (options.reset) {
      resetMetrics();
      console.log('✓ Metrics reset to zero');
    } else {
      const report = generateReport(0.8);
      console.log(report);
    }
  });

// Validation command
program
  .command('validate')
  .description('Run full system validation')
  .action(async () => {
    const result = await fullValidate();
    if (result.passed) {
      console.log('\n✅ All validation checks passed');
    } else {
      console.log('\n❌ Validation failed');
      process.exit(1);
    }
  });

// Test command (guardrails tests)
program
  .command('test')
  .description('Run test suite')
  .option('-g, --guardrails', 'Run guardrails tests')
  .option('-s, --smoke', 'Run gate smoke tests')
  .option('-a, --all', 'Run all tests (default)')
  .action(async (options) => {
    const runner = createRunner();

    // Determine which tests to run
    const runAll = !options.guardrails && !options.smoke;

    if (options.guardrails || runAll) {
      registerGuardrailsTests(runner);
    }

    if (options.smoke || runAll) {
      registerGateSmokeTests(runner);
    }

    // Run tests
    const results = await runner.run();

    if (!runner.allPassed()) {
      console.log('\n❌ Some tests failed');
      process.exit(1);
    } else {
      console.log('✅ All tests passed');
    }
  });

// Rollback command
program
  .command('rollback')
  .description('Rollback operations')
  .option('-l, --list', 'List available rollback snapshots')
  .option('-r, --restore <index>', 'Restore to snapshot index')
  .option('-c, --clear', 'Clear all snapshots')
  .action((options) => {
    if (options.list || Object.keys(options).length === 0) {
      const snapshots = listSnapshots();
      if (snapshots.length === 0) {
        console.log('No rollback snapshots available');
      } else {
        console.log('\n📸 Rollback Snapshots:\n');
        snapshots.forEach((s, i) => {
          console.log(`[${i}] ${new Date(s.timestamp).toLocaleString()}`);
          console.log(`    Reason: ${s.reason}`);
          console.log(`    Trust: ${(s.derived.trust * 100).toFixed(1)}%`);
          console.log(`    C_effective: ${(s.derived.C_effective * 100).toFixed(1)}%`);
          console.log();
        });
      }
    } else if (options.restore !== undefined) {
      const index = parseInt(options.restore);
      if (isNaN(index)) {
        console.log('Invalid snapshot index');
        process.exit(1);
      }
      const success = rollbackToSnapshot(index);
      if (!success) {
        process.exit(1);
      }
    } else if (options.clear) {
      clearSnapshots();
    }
  });

// Exploration command
program
  .command('explore')
  .description('Exploration budget operations')
  .option('-s, --status', 'Show exploration budget status')
  .option('-u, --up', 'Manually increase budget')
  .option('-d, --down', 'Manually decrease budget')
  .option('-r, --reset', 'Reset budget to target (7%)')
  .action((options) => {
    if (options.up) {
      adjustBudgetManual('up');
      console.log('✓ Budget increased manually');
    } else if (options.down) {
      adjustBudgetManual('down');
      console.log('✓ Budget decreased manually');
    } else if (options.reset) {
      resetExploration();
      console.log('✓ Exploration system reset to defaults');
    } else {
      const report = generateExplorationReport();
      console.log(report);
    }
  });

// Autonomous cycle command (non-interactive)
program
  .command('cycle')
  .description('Run autonomous cycle (non-interactive, PR-first batch runner)')
  .option('-m, --minutes <minutes>', 'Maximum duration in minutes', '120')
  .option('-i, --iterations <max>', 'Maximum iterations', '40')
  .option('-q, --queue <path>', 'Path to task queue JSON file')
  .action(async (options) => {
    // Check for API key
    if (!process.env.OPENAI_API_KEY && !process.env.ANTHROPIC_API_KEY) {
      console.error('Error: No API key found.');
      console.error('Set OPENAI_API_KEY or ANTHROPIC_API_KEY in your environment.');
      process.exit(1);
    }

    // Import cycle runner
    const { runAutonomousCycle } = await import('./control/cycle');

    const minutes = parseInt(options.minutes);
    const maxIterations = options.iterations ? parseInt(options.iterations) : undefined;

    await runAutonomousCycle({
      maxDurationMinutes: minutes,
      maxIterations,
      queuePath: options.queue
    });
  });

// Parse and run
program.parse();
