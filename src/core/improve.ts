/*
 * NOUS Self-Improvement System
 *
 * Allows NOUS to propose, review, and implement improvements to itself.
 *
 * Key principles:
 * - A1, A2, A3 are NEVER modified (hardcoded protection)
 * - All changes go through self-review
 * - Trust level determines what can be auto-committed
 * - Every change is logged and reversible
 */

import * as fs from 'fs';
import * as path from 'path';
import { loadSelf, modifySelf } from './self';
import { AXIOMS, validateModification } from './axioms';
import { getMemory } from '../memory/store';
import { ask, complete } from '../llm';
import { status as gitStatus, commit as gitCommit, push as gitPush, diff as gitDiff } from '../actions/git';
import { readFile, writeFile, listDir } from '../actions/fs';

/*
 * Improvement proposal
 */
export interface ImprovementProposal {
  id: string;
  type: 'config' | 'code' | 'capability' | 'optimization';
  description: string;
  rationale: string;
  changes: FileChange[];
  risk: 'low' | 'medium' | 'high';
  requiresApproval: boolean;
  createdAt: string;
  status: 'proposed' | 'approved' | 'rejected' | 'implemented';
}

/*
 * File change
 */
export interface FileChange {
  filePath: string;
  action: 'create' | 'modify' | 'delete';
  oldContent?: string;
  newContent?: string;
  diff?: string;
}

/*
 * Improvement goal
 */
export interface ImprovementGoal {
  id: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  status: 'active' | 'completed' | 'abandoned';
  createdAt: string;
  completedAt?: string;
}

/*
 * Protected files that NOUS cannot modify
 */
const PROTECTED_FILES = [
  'src/core/axioms.ts',  // A1, A2, A3 are sacred
];

/*
 * Files that require high trust to modify
 */
const SENSITIVE_FILES = [
  'src/core/self.ts',
  'src/core/improve.ts',
  'src/core/review.ts',
];

/*
 * Check if a file can be modified
 */
export function canModifyFile(filePath: string): { allowed: boolean; reason?: string } {
  const normalizedPath = filePath.replace(/\\/g, '/');

  // Check protected files
  for (const protected_ of PROTECTED_FILES) {
    if (normalizedPath.includes(protected_)) {
      return {
        allowed: false,
        reason: `${protected_} contains immutable axioms (A1, A2, A3) and cannot be modified`
      };
    }
  }

  // Check sensitive files - require high trust
  const self = loadSelf();
  for (const sensitive of SENSITIVE_FILES) {
    if (normalizedPath.includes(sensitive) && self.approval.trustLevel < 0.7) {
      return {
        allowed: false,
        reason: `${sensitive} requires trust level >= 70% (current: ${(self.approval.trustLevel * 100).toFixed(0)}%)`
      };
    }
  }

  return { allowed: true };
}

/*
 * Analyze codebase for potential improvements
 */
export async function analyzeForImprovements(): Promise<string[]> {
  const self = loadSelf();
  const memory = getMemory();
  const insights = memory.searchInsights('', 50); // Increased from 20 to 50 for more comprehensive analysis

  const prompt = `You are NOUS, analyzing yourself for potential improvements.

Your current configuration:
- Closure: ${self.config.C}
- Trust Level: ${(self.approval.trustLevel * 100).toFixed(0)}%
- Capabilities: ${self.capabilities.join(', ')}

Recent insights from interactions:
${insights.map(i => `- ${i.content}`).join('\n')}

Analyze and suggest 3-5 concrete improvements you could make to yourself.
Focus on:
1. Code quality improvements
2. New capabilities that would be useful
3. Performance optimizations
4. Better memory/learning patterns

For each suggestion, provide:
- Brief description (1 line)
- Why it would help
- Risk level (low/medium/high)

Be specific and actionable. Remember: you CANNOT modify axioms.ts (A1, A2, A3).`;

  const response = await ask(prompt);

  // Parse suggestions from response
  const suggestions = response.split('\n')
    .filter(line => line.trim().startsWith('-') || line.trim().match(/^\d+\./))
    .map(line => line.replace(/^[-\d.]\s*/, '').trim())
    .filter(line => line.length > 10);

  return suggestions;
}

/*
 * Generate improvement proposal
 */
export async function proposeImprovement(
  description: string,
  type: ImprovementProposal['type'] = 'code'
): Promise<ImprovementProposal> {
  const self = loadSelf();
  const id = `improve_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

  // Ask LLM to generate the actual changes
  const prompt = `You are NOUS, implementing a self-improvement.

IMPROVEMENT REQUEST: ${description}

Your task: Generate the specific code changes needed.

RULES:
1. NEVER modify src/core/axioms.ts (contains immutable A1, A2, A3)
2. Keep changes minimal and focused
3. Maintain existing code style
4. Add comments explaining changes

Current project structure:
- src/core/: Core systems (axioms, self, loop, improve)
- src/memory/: SQLite memory store
- src/llm/: LLM integrations
- src/actions/: File, git, shell, web actions

Respond with JSON:
{
  "rationale": "Why this improvement helps",
  "risk": "low|medium|high",
  "changes": [
    {
      "filePath": "src/...",
      "action": "create|modify",
      "description": "What this change does",
      "newContent": "... full file content or diff ..."
    }
  ]
}`;

  const response = await ask(prompt);

  // Parse JSON from response
  let parsed;
  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      parsed = JSON.parse(jsonMatch[0]);
    } else {
      throw new Error('No JSON found in response');
    }
  } catch (e) {
    // If parsing fails, create a simple proposal
    parsed = {
      rationale: 'Unable to generate detailed proposal',
      risk: 'high',
      changes: []
    };
  }

  // Check if any protected files are being modified
  for (const change of parsed.changes || []) {
    const canModify = canModifyFile(change.filePath);
    if (!canModify.allowed) {
      throw new Error(`Cannot modify ${change.filePath}: ${canModify.reason}`);
    }
  }

  // Determine if approval is required
  const requiresApproval =
    parsed.risk === 'high' ||
    self.approval.trustLevel < 0.5 ||
    (parsed.changes || []).some((c: any) =>
      SENSITIVE_FILES.some(s => c.filePath?.includes(s))
    );

  const proposal: ImprovementProposal = {
    id,
    type,
    description,
    rationale: parsed.rationale || '',
    changes: (parsed.changes || []).map((c: any) => ({
      filePath: c.filePath,
      action: c.action || 'modify',
      newContent: c.newContent,
      diff: c.description,
    })),
    risk: parsed.risk || 'medium',
    requiresApproval,
    createdAt: new Date().toISOString(),
    status: 'proposed',
  };

  // Store proposal in memory
  const memory = getMemory();
  memory.addInsight(
    `Proposed improvement: ${description}`,
    'self-improvement',
    'self_modification',
    0.7
  );

  return proposal;
}

/*
 * Review an improvement proposal
 */
export async function reviewProposal(
  proposal: ImprovementProposal
): Promise<{ approved: boolean; feedback: string }> {
  const self = loadSelf();

  const prompt = `You are NOUS's self-review system. Evaluate this improvement proposal:

PROPOSAL: ${proposal.description}
RATIONALE: ${proposal.rationale}
RISK: ${proposal.risk}
CHANGES: ${proposal.changes.length} files

Files to be changed:
${proposal.changes.map(c => `- ${c.filePath} (${c.action})`).join('\n')}

REVIEW CRITERIA:
1. Does this violate any axioms (A1, A2, A3)? [AUTOMATIC REJECT IF YES]
2. Is the change beneficial to NOUS's capabilities?
3. Is the risk assessment accurate?
4. Are there potential unintended consequences?
5. Is the code quality acceptable?

Current trust level: ${(self.approval.trustLevel * 100).toFixed(0)}%

Respond with JSON:
{
  "approved": true|false,
  "feedback": "Explanation of decision",
  "concerns": ["list", "of", "concerns"],
  "suggestions": ["improvements", "if", "any"]
}`;

  const response = await ask(prompt);

  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        approved: parsed.approved === true,
        feedback: parsed.feedback || 'No feedback provided',
      };
    }
  } catch (e) {
    // Default to rejection if parsing fails
  }

  return {
    approved: false,
    feedback: 'Review failed - defaulting to rejection for safety',
  };
}

/*
 * Implement an approved proposal
 */
export async function implementProposal(
  proposal: ImprovementProposal
): Promise<{ success: boolean; message: string }> {
  if (proposal.status !== 'approved' && proposal.requiresApproval) {
    return { success: false, message: 'Proposal requires approval first' };
  }

  const self = loadSelf();
  const projectRoot = process.cwd();

  try {
    // Apply each change
    for (const change of proposal.changes) {
      const fullPath = path.join(projectRoot, change.filePath);

      // Double-check protection
      const canModify = canModifyFile(change.filePath);
      if (!canModify.allowed) {
        throw new Error(canModify.reason);
      }

      if (change.action === 'create' || change.action === 'modify') {
        if (change.newContent) {
          // Ensure directory exists
          const dir = path.dirname(fullPath);
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }

          // Write file
          fs.writeFileSync(fullPath, change.newContent, 'utf-8');
          console.log(`✓ ${change.action}: ${change.filePath}`);
        }
      } else if (change.action === 'delete') {
        if (fs.existsSync(fullPath)) {
          fs.unlinkSync(fullPath);
          console.log(`✓ deleted: ${change.filePath}`);
        }
      }
    }

    // Log the modification
    const memory = getMemory();
    memory.addInsight(
      `Implemented improvement: ${proposal.description}`,
      'self-improvement',
      'self_modification',
      0.8
    );

    proposal.status = 'implemented';

    return {
      success: true,
      message: `Successfully implemented: ${proposal.description}`
    };

  } catch (error: any) {
    return {
      success: false,
      message: `Implementation failed: ${error.message}`
    };
  }
}

/*
 * Commit and push improvements to GitHub
 */
export async function commitImprovements(
  message: string,
  autoPush: boolean = false
): Promise<{ success: boolean; message: string }> {
  const self = loadSelf();

  // Check trust level for auto-push
  if (autoPush && self.approval.trustLevel < 0.6) {
    return {
      success: false,
      message: `Auto-push requires trust level >= 60% (current: ${(self.approval.trustLevel * 100).toFixed(0)}%)`
    };
  }

  try {
    // Check for changes
    const status = await gitStatus();
    if (!status.success || !status.output?.trim()) {
      return { success: false, message: 'No changes to commit' };
    }

    // Commit
    const commitMessage = `${message}\n\n🤖 Self-improvement by NOUS\nTrust Level: ${(self.approval.trustLevel * 100).toFixed(0)}%`;
    await gitCommit(commitMessage, { addAll: true });

    // Push if allowed
    if (autoPush) {
      await gitPush();
      return { success: true, message: 'Changes committed and pushed to GitHub' };
    }

    return { success: true, message: 'Changes committed (not pushed)' };

  } catch (error: any) {
    return { success: false, message: `Git operation failed: ${error.message}` };
  }
}

/*
 * Full self-improvement cycle
 */
export async function selfImprovementCycle(
  goal?: string
): Promise<{ proposals: ImprovementProposal[]; implemented: number }> {
  console.log('\n🔄 Starting self-improvement cycle...\n');

  const self = loadSelf();
  const proposals: ImprovementProposal[] = [];
  let implemented = 0;

  // Step 1: Analyze for improvements
  console.log('📊 Analyzing codebase for improvements...');
  const suggestions = goal
    ? [goal]
    : await analyzeForImprovements();

  console.log(`Found ${suggestions.length} potential improvements\n`);

  // Step 2: Generate proposals
  for (const suggestion of suggestions.slice(0, 3)) { // Limit to 3
    console.log(`📝 Generating proposal: ${suggestion.slice(0, 50)}...`);

    try {
      const proposal = await proposeImprovement(suggestion);
      proposals.push(proposal);

      // Step 3: Self-review
      console.log('🔍 Self-reviewing proposal...');
      const review = await reviewProposal(proposal);

      if (review.approved) {
        proposal.status = 'approved';
        console.log('✅ Proposal approved');

        // Step 4: Implement if approved and doesn't require user approval
        if (!proposal.requiresApproval || self.approval.trustLevel >= 0.7) {
          console.log('⚙️ Implementing...');
          const result = await implementProposal(proposal);

          if (result.success) {
            implemented++;
            console.log(`✓ ${result.message}\n`);
          } else {
            console.log(`✗ ${result.message}\n`);
          }
        } else {
          console.log('⏳ Requires user approval\n');
        }
      } else {
        proposal.status = 'rejected';
        console.log(`❌ Proposal rejected: ${review.feedback}\n`);
      }

    } catch (error: any) {
      console.log(`⚠️ Error: ${error.message}\n`);
    }
  }

  // Step 5: Commit if changes were made
  if (implemented > 0) {
    console.log('💾 Committing changes...');
    const commitResult = await commitImprovements(
      `self-improvement: ${implemented} changes`,
      self.approval.trustLevel >= 0.6
    );
    console.log(commitResult.message);
  }

  console.log(`\n✨ Self-improvement cycle complete: ${implemented}/${proposals.length} implemented`);

  return { proposals, implemented };
}
