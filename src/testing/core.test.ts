/**
 * Core Module Tests
 *
 * Tests for:
 * - Axioms (immutability)
 * - Self Config (load/save/modify)
 * - Memory (CRUD operations)
 */

import * as fs from 'fs';
import * as path from 'path';
import { TestRunner, test, assert } from './runner';
import { AXIOMS, NOUSConfig, preservesEntityhood } from '../core/axioms';
import { loadSelf, saveSelf, SelfConfig } from '../core/self';
import { getMemory, MemoryStore } from '../memory/store';

export function registerCoreTests(runner: TestRunner): void {
  // ===========================================
  // AXIOMS TESTS
  // ===========================================

  runner.describe('Axioms - Immutability', () => {
    test('A1 is defined and correct', () => {
      assert.exists(AXIOMS.A1);
      assert.equal(
        AXIOMS.A1,
        "An entity is a difference that maintains itself and makes a difference"
      );
    });

    test('A2 is defined and correct', () => {
      assert.exists(AXIOMS.A2);
      assert.equal(
        AXIOMS.A2,
        "Every entity has Config(E) = { C, S, Σ, K, R, U }"
      );
    });

    test('A3 is defined and correct', () => {
      assert.exists(AXIOMS.A3);
      assert.equal(
        AXIOMS.A3,
        "NOUS can modify everything except A1, A2, A3"
      );
    });

    test('AXIOMS object is frozen (cannot be modified)', () => {
      // Try to modify - should not change or throw
      try {
        (AXIOMS as any).A1 = "Modified";
      } catch (e) {
        // Object.freeze throws in strict mode, which is fine
      }

      // Should still be original value
      assert.equal(
        AXIOMS.A1,
        "An entity is a difference that maintains itself and makes a difference"
      );
    });

    test('preservesEntityhood() validates closure', () => {
      const validConfig: NOUSConfig = {
        C: 0.5,
        S: 0.8,
        Σ: ['MATTER', 'LOGOS'],
        K: ['persist', 'represent'],
        R: [],
        U: {},
      };

      const result = preservesEntityhood(validConfig, validConfig);
      assert.ok(result.valid);
    });

    test('preservesEntityhood() rejects C=0 (no autonomy)', () => {
      const invalidConfig: NOUSConfig = {
        C: 0,
        S: 0.8,
        Σ: ['MATTER', 'LOGOS'],
        K: ['persist', 'represent'],
        R: [],
        U: {},
      };

      const result = preservesEntityhood(invalidConfig, invalidConfig);
      assert.equal(result.valid, false);
    });

    test('preservesEntityhood() rejects empty capabilities', () => {
      const invalidConfig: NOUSConfig = {
        C: 0.5,
        S: 0.8,
        Σ: ['MATTER', 'LOGOS'],
        K: [], // Empty - entity can't do anything
        R: [],
        U: {},
      };

      const result = preservesEntityhood(invalidConfig, invalidConfig);
      assert.equal(result.valid, false);
    });
  });

  // ===========================================
  // SELF CONFIG TESTS
  // ===========================================

  runner.describe('Self Config - Structure', () => {
    test('loadSelf() returns valid config', () => {
      const self = loadSelf();

      assert.exists(self);
      assert.exists(self.version);
      assert.exists(self.config);
      assert.exists(self.modules);
      assert.ok(Array.isArray(self.capabilities));
      assert.ok(Array.isArray(self.constraints));
      assert.exists(self.approval);
      assert.exists(self.meta);
    });

    test('Config has all required A2 fields', () => {
      const self = loadSelf();
      const config = self.config;

      assert.type(config.C, 'number');
      assert.type(config.S, 'number');
      assert.ok(Array.isArray(config.Σ));
      assert.ok(Array.isArray(config.K));
      assert.ok(Array.isArray(config.R));
      assert.type(config.U, 'object');
    });

    test('C (Closure) is in valid range [0,1]', () => {
      const self = loadSelf();
      assert.ok(self.config.C >= 0 && self.config.C <= 1);
    });

    test('S (Scope) is in valid range [0,1]', () => {
      const self = loadSelf();
      assert.ok(self.config.S >= 0 && self.config.S <= 1);
    });

    test('Strata contain only valid values', () => {
      const self = loadSelf();
      const validStrata = ['MATTER', 'LIFE', 'SENTIENCE', 'LOGOS'];

      for (const stratum of self.config.Σ) {
        assert.includes(validStrata, stratum);
      }
    });

    test('Trust level is in valid range [0,1]', () => {
      const self = loadSelf();
      assert.ok(
        self.approval.trustLevel >= 0 && self.approval.trustLevel <= 1,
        `Trust level ${self.approval.trustLevel} out of range`
      );
    });

    test('Has modification count', () => {
      const self = loadSelf();
      assert.type(self.meta.modificationCount, 'number');
      assert.ok(self.meta.modificationCount >= 0);
    });

    test('Has createdAt timestamp', () => {
      const self = loadSelf();
      assert.exists(self.meta.createdAt);
      // Should be valid ISO date
      assert.ok(!isNaN(Date.parse(self.meta.createdAt)));
    });
  });

  runner.describe('Self Config - Entityhood', () => {
    test('Current config preserves entityhood (A1)', () => {
      const self = loadSelf();
      const config: NOUSConfig = {
        C: self.config.C,
        S: self.config.S,
        Σ: self.config.Σ,
        K: self.config.K,
        R: self.config.R,
        U: self.config.U,
      };

      const result = preservesEntityhood(config, config);
      assert.ok(result.valid, `Current NOUS config violates A1: ${result.reason}`);
    });

    test('Constraints include axiom protection', () => {
      const self = loadSelf();
      const hasA1 = self.constraints.some(c => c.includes('A1'));
      const hasA2 = self.constraints.some(c => c.includes('A2'));
      const hasA3 = self.constraints.some(c => c.includes('A3'));

      assert.ok(hasA1 || hasA2 || hasA3, 'Constraints must reference axioms');
    });
  });

  runner.describe('Self Config - File Operations', () => {
    test('config/self.json file exists', () => {
      const configPath = path.join(process.cwd(), 'config', 'self.json');
      assert.ok(fs.existsSync(configPath), 'config/self.json not found');
    });

    test('config/self.json is valid JSON', () => {
      const configPath = path.join(process.cwd(), 'config', 'self.json');
      const content = fs.readFileSync(configPath, 'utf-8');

      // Should not throw
      const parsed = JSON.parse(content);
      assert.exists(parsed);
    });

    test('Backup directory exists', () => {
      const backupPath = path.join(process.cwd(), 'config', 'backups');
      assert.ok(
        fs.existsSync(backupPath),
        'config/backups directory should exist'
      );
    });
  });

  // ===========================================
  // MEMORY TESTS
  // ===========================================

  runner.describe('Memory - Basic Operations', () => {
    test('getMemory() returns store instance', () => {
      const memory = getMemory();
      assert.exists(memory);
    });

    test('getStats() returns valid statistics', () => {
      const memory = getMemory();
      const stats = memory.getStats();

      assert.exists(stats);
      assert.type(stats.sessions, 'number');
      assert.type(stats.messages, 'number');
      assert.type(stats.insights, 'number');
      assert.type(stats.projects, 'number');
    });

    test('Database file exists', () => {
      const dbPath = path.join(process.cwd(), 'data', 'nous.db');
      assert.ok(fs.existsSync(dbPath), 'data/nous.db not found');
    });
  });

  runner.describe('Memory - Sessions', () => {
    test('startSession() creates new session', () => {
      const memory = getMemory();
      const session = memory.startSession();

      assert.exists(session);
      assert.exists(session.id);
      assert.exists(session.startedAt);
    });

    test('Session ID is unique', () => {
      const memory = getMemory();
      const session1 = memory.startSession();
      const session2 = memory.startSession();

      assert.notEqual(session1.id, session2.id);

      // Clean up
      memory.endSession(session1.id);
      memory.endSession(session2.id);
    });
  });

  runner.describe('Memory - Insights', () => {
    test('searchInsights() returns array', () => {
      const memory = getMemory();
      const insights = memory.searchInsights('', 10);

      assert.ok(Array.isArray(insights));
    });

    test('addInsight() creates insight', () => {
      const memory = getMemory();
      const beforeCount = memory.getStats().insights;

      const insight = memory.addInsight(
        'Test insight for validation',
        'test',
        'fact',
        0.9
      );

      assert.exists(insight);
      assert.exists(insight.id);

      const afterCount = memory.getStats().insights;
      assert.greaterThan(afterCount, beforeCount);
    });

    test('Insight has required fields', () => {
      const memory = getMemory();
      const insight = memory.addInsight(
        'Another test insight',
        'test',
        'pattern',
        0.8
      );

      assert.exists(insight.id);
      assert.exists(insight.content);
      assert.exists(insight.category);
      assert.type(insight.confidence, 'number');
      assert.exists(insight.createdAt);
    });

    test('searchInsights() finds by query', () => {
      const memory = getMemory();

      // Add insight with specific content
      const uniqueContent = `Unique test ${Date.now()}`;
      memory.addInsight(uniqueContent, 'test', 'fact', 0.9);

      // Search for it
      const results = memory.searchInsights(uniqueContent, 10);

      // Should find at least one
      assert.greaterThan(results.length, 0);
    });
  });

  runner.describe('Memory - Messages', () => {
    test('addMessage() stores message', () => {
      const memory = getMemory();
      const session = memory.startSession();

      const beforeCount = memory.getStats().messages;

      memory.addMessage(session.id, 'user', 'Test message');

      const afterCount = memory.getStats().messages;
      assert.greaterThan(afterCount, beforeCount);

      // Clean up
      memory.endSession(session.id);
    });
  });

  runner.describe('Memory - Projects', () => {
    test('getActiveProjects() returns array', () => {
      const memory = getMemory();
      const projects = memory.getActiveProjects();

      assert.ok(Array.isArray(projects));
    });
  });
}
