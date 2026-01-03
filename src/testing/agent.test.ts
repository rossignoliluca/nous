/**
 * Agent System Tests
 *
 * Tests for:
 * - Tool registry
 * - Tool execution
 * - Agent patterns (requiresAgent)
 */

import * as fs from 'fs';
import * as path from 'path';
import { TestRunner, test, assert } from './runner';
import { TOOLS, requiresAgent } from '../work/agent';

export function registerAgentTests(runner: TestRunner): void {
  // ===========================================
  // TOOL REGISTRY TESTS
  // ===========================================

  runner.describe('Agent - Tool Registry', () => {
    test('TOOLS array exists and has tools', () => {
      assert.exists(TOOLS);
      assert.ok(Array.isArray(TOOLS));
      assert.greaterThan(TOOLS.length, 0);
    });

    test('All tools have required fields', () => {
      for (const tool of TOOLS) {
        assert.exists(tool.name, `Tool missing name: ${JSON.stringify(tool)}`);
        assert.exists(tool.description, `Tool ${tool.name} missing description`);
        assert.ok(
          Array.isArray(tool.parameters),
          `Tool ${tool.name} parameters not array`
        );
        assert.type(
          tool.execute,
          'function',
          `Tool ${tool.name} execute not function`
        );
      }
    });

    test('Tool names are unique', () => {
      const names = TOOLS.map(t => t.name);
      const uniqueNames = new Set(names);
      assert.equal(
        names.length,
        uniqueNames.size,
        `Duplicate tool names found: ${names.join(', ')}`
      );
    });

    test('Has essential filesystem tools', () => {
      const names = TOOLS.map(t => t.name);
      assert.includes(names, 'read_file');
      assert.includes(names, 'write_file');
      assert.includes(names, 'list_files');
    });

    test('Has memory tools', () => {
      const names = TOOLS.map(t => t.name);
      assert.includes(names, 'search_memory');
      assert.includes(names, 'save_insight');
    });

    test('Has cognitive tools', () => {
      const names = TOOLS.map(t => t.name);
      assert.includes(names, 'cognitive_status');
      assert.includes(names, 'run_consolidation');
    });

    test('Has git tools', () => {
      const names = TOOLS.map(t => t.name);
      assert.includes(names, 'git_status');
      assert.includes(names, 'git_diff');
      assert.includes(names, 'git_commit');
    });

    test('Has web tools', () => {
      const names = TOOLS.map(t => t.name);
      assert.includes(names, 'web_search');
      assert.includes(names, 'fetch_url');
    });
  });

  // ===========================================
  // TOOL PARAMETER VALIDATION
  // ===========================================

  runner.describe('Agent - Tool Parameters', () => {
    test('All parameters have required fields', () => {
      for (const tool of TOOLS) {
        for (const param of tool.parameters) {
          assert.exists(
            param.name,
            `Tool ${tool.name} has parameter without name`
          );
          assert.exists(
            param.type,
            `Tool ${tool.name} parameter ${param.name} missing type`
          );
          assert.exists(
            param.description,
            `Tool ${tool.name} parameter ${param.name} missing description`
          );
          assert.type(
            param.required,
            'boolean',
            `Tool ${tool.name} parameter ${param.name} required not boolean`
          );
        }
      }
    });

    test('Parameter types are valid', () => {
      const validTypes = ['string', 'number', 'boolean'];
      for (const tool of TOOLS) {
        for (const param of tool.parameters) {
          assert.includes(
            validTypes,
            param.type,
            `Tool ${tool.name} parameter ${param.name} has invalid type: ${param.type}`
          );
        }
      }
    });
  });

  // ===========================================
  // TOOL EXECUTION TESTS (Safe Tools Only)
  // ===========================================

  runner.describe('Agent - Tool Execution', () => {
    test('search_memory tool executes', async () => {
      const tool = TOOLS.find(t => t.name === 'search_memory');
      assert.exists(tool);

      const result = await tool!.execute({ query: 'test' });
      assert.exists(result);
      assert.type(result.success, 'boolean');
      assert.exists(result.output);
    });

    test('cognitive_status tool executes', async () => {
      const tool = TOOLS.find(t => t.name === 'cognitive_status');
      assert.exists(tool);

      const result = await tool!.execute({});
      assert.exists(result);
      assert.type(result.success, 'boolean');
      assert.exists(result.output);
    });

    test('git_status tool executes', async () => {
      const tool = TOOLS.find(t => t.name === 'git_status');
      assert.exists(tool);

      const result = await tool!.execute({});
      assert.exists(result);
      assert.type(result.success, 'boolean');
      // Output should exist (even if empty repo)
      assert.exists(result.output);
    });

    test('list_files tool works on valid directory', async () => {
      const tool = TOOLS.find(t => t.name === 'list_files');
      assert.exists(tool);

      // List current directory
      const result = await tool!.execute({ path: '.' });
      assert.exists(result);
      assert.type(result.success, 'boolean');

      if (result.success) {
        assert.exists(result.output);
      }
    });

    test('read_file tool can read package.json', async () => {
      const tool = TOOLS.find(t => t.name === 'read_file');
      assert.exists(tool);

      const result = await tool!.execute({ path: 'package.json' });
      assert.exists(result);

      if (result.success) {
        assert.exists(result.output);
        assert.ok(result.output.includes('nous'));
      }
    });

    test('Tool execution returns ToolResult structure', async () => {
      const tool = TOOLS.find(t => t.name === 'search_memory');
      assert.exists(tool);

      const result = await tool!.execute({ query: '' });

      assert.type(result.success, 'boolean');
      assert.exists(result.output);
      // error is optional, only check if present
      if ('error' in result) {
        assert.type(result.error, 'string');
      }
    });
  });

  // ===========================================
  // AGENT PATTERN DETECTION
  // ===========================================

  runner.describe('Agent - Pattern Detection', () => {
    test('requiresAgent() detects read commands', () => {
      assert.ok(requiresAgent('read the file package.json'));
      assert.ok(requiresAgent('leggi il file src/index.ts'));
    });

    test('requiresAgent() detects write commands', () => {
      assert.ok(requiresAgent('write a file called test.txt'));
      assert.ok(requiresAgent('scrivi un file nuovo'));
    });

    test('requiresAgent() detects search commands', () => {
      assert.ok(requiresAgent('search for TypeScript on the web'));
      assert.ok(requiresAgent('cerca informazioni su AI'));
    });

    test('requiresAgent() detects git commands', () => {
      assert.ok(requiresAgent('run git status'));
      assert.ok(requiresAgent('commit these changes'));
    });

    test('requiresAgent() detects file extensions', () => {
      assert.ok(requiresAgent('analyze the index.ts file'));
      assert.ok(requiresAgent('look at package.json'));
    });

    test('requiresAgent() detects run commands', () => {
      assert.ok(requiresAgent('run npm install'));
      assert.ok(requiresAgent('esegui il comando build'));
    });

    test('requiresAgent() rejects pure conversation', () => {
      assert.equal(requiresAgent('Hello, how are you?'), false);
      assert.equal(requiresAgent('Explain what autopoiesis means'), false);
      assert.equal(requiresAgent('What is the meaning of life?'), false);
    });

    test('requiresAgent() rejects theoretical questions', () => {
      assert.equal(requiresAgent('What would happen if...'), false);
      assert.equal(requiresAgent('Tell me about consciousness'), false);
    });
  });

  // ===========================================
  // TOOL ERROR HANDLING
  // ===========================================

  runner.describe('Agent - Error Handling', () => {
    test('read_file returns error for non-existent file', async () => {
      const tool = TOOLS.find(t => t.name === 'read_file');
      assert.exists(tool);

      const result = await tool!.execute({
        path: 'non_existent_file_12345.txt'
      });

      assert.equal(result.success, false);
      assert.exists(result.error);
    });

    test('list_files returns error for non-existent directory', async () => {
      const tool = TOOLS.find(t => t.name === 'list_files');
      assert.exists(tool);

      const result = await tool!.execute({
        path: '/non/existent/path/12345'
      });

      assert.equal(result.success, false);
      assert.exists(result.error);
    });

    test('Tool execution catches exceptions', async () => {
      const tool = TOOLS.find(t => t.name === 'read_file');
      assert.exists(tool);

      // Pass invalid parameter type (should handle gracefully)
      try {
        const result = await tool!.execute({ path: null as any });
        // Should return error result, not throw
        assert.equal(result.success, false);
      } catch (e) {
        // Should not throw, but if it does, test fails
        throw new Error('Tool should handle errors gracefully, not throw');
      }
    });
  });

  // ===========================================
  // COGNITIVE TOOLS SPECIFIC
  // ===========================================

  runner.describe('Agent - Cognitive Tools', () => {
    test('check_epistemic_health tool exists and executes', async () => {
      const tool = TOOLS.find(t => t.name === 'check_epistemic_health');
      assert.exists(tool, 'check_epistemic_health tool not found');

      const result = await tool!.execute({});
      assert.exists(result);
      assert.type(result.success, 'boolean');
    });

    test('get_improvement_suggestions tool exists', () => {
      const tool = TOOLS.find(t => t.name === 'get_improvement_suggestions');
      assert.exists(tool, 'get_improvement_suggestions tool not found');
    });

    test('run_consolidation tool exists', () => {
      const tool = TOOLS.find(t => t.name === 'run_consolidation');
      assert.exists(tool, 'run_consolidation tool not found');
    });

    test('analyze_self_code tool exists for self-knowledge', () => {
      const tool = TOOLS.find(t => t.name === 'analyze_self_code');
      assert.exists(tool, 'analyze_self_code tool not found');
    });
  });
}
