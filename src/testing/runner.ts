/**
 * NOUS Test Runner
 *
 * Simple, zero-dependency test framework for NOUS.
 * No Jest, no Mocha - just TypeScript.
 *
 * Why custom? NOUS must be able to test itself without external dependencies.
 */

export interface TestResult {
  name: string;
  passed: boolean;
  error?: Error;
  duration: number;
}

export interface TestSuite {
  name: string;
  tests: TestCase[];
}

export interface TestCase {
  name: string;
  fn: () => void | Promise<void>;
}

export class TestRunner {
  private suites: TestSuite[] = [];
  private results: Map<string, TestResult[]> = new Map();

  /**
   * Define a test suite
   */
  describe(suiteName: string, fn: () => void): void {
    const suite: TestSuite = { name: suiteName, tests: [] };
    this.suites.push(suite);

    // Set current suite for test() calls
    currentSuite = suite;
    fn();
    currentSuite = null;
  }

  /**
   * Run all test suites
   */
  async run(): Promise<{ passed: number; failed: number; total: number }> {
    console.log('\n╔══════════════════════════════════════════════════════════╗');
    console.log('║               NOUS TEST SUITE                            ║');
    console.log('╚══════════════════════════════════════════════════════════╝\n');

    let totalPassed = 0;
    let totalFailed = 0;

    for (const suite of this.suites) {
      console.log(`\n📦 ${suite.name}`);
      console.log('─'.repeat(50));

      const suiteResults: TestResult[] = [];

      for (const test of suite.tests) {
        const start = Date.now();
        let passed = false;
        let error: Error | undefined;

        try {
          await test.fn();
          passed = true;
          totalPassed++;
          console.log(`  ✓ ${test.name}`);
        } catch (e: any) {
          passed = false;
          error = e;
          totalFailed++;
          console.log(`  ✗ ${test.name}`);
          console.log(`    ${e.message}`);
          if (e.stack && process.env.NOUS_DEBUG) {
            console.log(`    ${e.stack.split('\n').slice(1, 3).join('\n    ')}`);
          }
        }

        const duration = Date.now() - start;
        suiteResults.push({
          name: test.name,
          passed,
          error,
          duration,
        });
      }

      this.results.set(suite.name, suiteResults);
    }

    const total = totalPassed + totalFailed;
    const percentage = total > 0 ? ((totalPassed / total) * 100).toFixed(1) : '0';

    console.log('\n' + '═'.repeat(50));
    console.log(`\n📊 Results: ${totalPassed}/${total} passed (${percentage}%)`);

    if (totalFailed > 0) {
      console.log(`❌ ${totalFailed} tests failed\n`);
      return { passed: totalPassed, failed: totalFailed, total };
    } else {
      console.log(`✅ All tests passed!\n`);
      return { passed: totalPassed, failed: totalFailed, total };
    }
  }

  /**
   * Get detailed results
   */
  getResults(): Map<string, TestResult[]> {
    return this.results;
  }

  /**
   * Check if all tests passed
   */
  allPassed(): boolean {
    for (const results of this.results.values()) {
      if (results.some(r => !r.passed)) {
        return false;
      }
    }
    return true;
  }
}

// Global test registration
let currentSuite: TestSuite | null = null;

/**
 * Define a test case
 */
export function test(name: string, fn: () => void | Promise<void>): void {
  if (!currentSuite) {
    throw new Error('test() must be called inside describe()');
  }
  currentSuite.tests.push({ name, fn });
}

/**
 * Assertions
 */
export const assert = {
  /**
   * Assert value is truthy
   */
  ok(value: any, message?: string): void {
    if (!value) {
      throw new Error(message || `Expected truthy value, got ${value}`);
    }
  },

  /**
   * Assert strict equality
   */
  equal<T>(actual: T, expected: T, message?: string): void {
    if (actual !== expected) {
      throw new Error(
        message || `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
      );
    }
  },

  /**
   * Assert deep equality
   */
  deepEqual(actual: any, expected: any, message?: string): void {
    const actualJSON = JSON.stringify(actual, null, 0);
    const expectedJSON = JSON.stringify(expected, null, 0);
    if (actualJSON !== expectedJSON) {
      throw new Error(
        message || `Expected ${expectedJSON}, got ${actualJSON}`
      );
    }
  },

  /**
   * Assert not equal
   */
  notEqual<T>(actual: T, expected: T, message?: string): void {
    if (actual === expected) {
      throw new Error(
        message || `Expected values to be different, but both were ${JSON.stringify(actual)}`
      );
    }
  },

  /**
   * Assert throws error
   */
  throws(fn: () => any, message?: string): void {
    let threw = false;
    try {
      fn();
    } catch (e) {
      threw = true;
    }
    if (!threw) {
      throw new Error(message || 'Expected function to throw, but it did not');
    }
  },

  /**
   * Assert async throws
   */
  async rejects(fn: () => Promise<any>, message?: string): Promise<void> {
    let threw = false;
    try {
      await fn();
    } catch (e) {
      threw = true;
    }
    if (!threw) {
      throw new Error(message || 'Expected async function to throw, but it did not');
    }
  },

  /**
   * Assert value exists (not null/undefined)
   */
  exists(value: any, message?: string): void {
    if (value === null || value === undefined) {
      throw new Error(message || `Expected value to exist, got ${value}`);
    }
  },

  /**
   * Assert type
   */
  type(value: any, expectedType: string, message?: string): void {
    const actualType = typeof value;
    if (actualType !== expectedType) {
      throw new Error(
        message || `Expected type ${expectedType}, got ${actualType}`
      );
    }
  },

  /**
   * Assert array includes value
   */
  includes(array: any[], value: any, message?: string): void {
    if (!array.includes(value)) {
      throw new Error(
        message || `Expected array to include ${JSON.stringify(value)}`
      );
    }
  },

  /**
   * Assert number is greater than
   */
  greaterThan(actual: number, expected: number, message?: string): void {
    if (actual <= expected) {
      throw new Error(
        message || `Expected ${actual} to be greater than ${expected}`
      );
    }
  },

  /**
   * Assert number is less than
   */
  lessThan(actual: number, expected: number, message?: string): void {
    if (actual >= expected) {
      throw new Error(
        message || `Expected ${actual} to be less than ${expected}`
      );
    }
  },
};

/**
 * Create a new test runner instance
 */
export function createRunner(): TestRunner {
  return new TestRunner();
}
