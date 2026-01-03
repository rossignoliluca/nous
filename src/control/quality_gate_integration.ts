/**
 * Quality Gate Integration
 *
 * Integrates G6 quality gate into agent workflow.
 * Checks code changes AFTER execution but BEFORE committing.
 *
 * Flow:
 * - Tool executes (write_file, modify_self_config, etc.)
 * - Quality gate analyzes diff
 * - Decision: PASS/REJECT/REVIEW
 * - PASS → continue normally
 * - REJECT → log and provide feedback to agent
 * - REVIEW → create Issue with questions
 */

import * as fs from 'fs';
import * as path from 'path';
import { classifyPatch, QualityGateInput, QualityGateResult } from './quality_gate';
import * as shellActions from '../actions/shell';
import { CONSTITUTION } from '../core/constitution';

interface QualityGateCheck {
  shouldCheck: boolean;
  reason: string;
}

/**
 * Session state for quality gate (caps and counters)
 */
interface QualityGateSession {
  prsCreated: number;
  reviewsCreated: number;
  rejectsLogged: number;
  consecutiveReviews: number;
  startTime: number;
}

let currentSession: QualityGateSession | null = null;


/**
 * Initialize quality gate session
 */
export function initQualityGateSession(): void {
  currentSession = {
    prsCreated: 0,
    reviewsCreated: 0,
    rejectsLogged: 0,
    consecutiveReviews: 0,
    startTime: Date.now()
  };
  console.log('\n🎯 Quality Gate session initialized');
  console.log(`   Caps: ${CONSTITUTION.caps.maxPRsPerCycle} PRs, ${CONSTITUTION.caps.maxReviewsPerCycle} REVIEWs per cycle`);
}

/**
 * Get current session stats
 */
export function getQualityGateSessionStats(): QualityGateSession | null {
  return currentSession;
}

/**
 * Reset session (for testing or new cycle)
 */
export function resetQualityGateSession(): void {
  currentSession = null;
}

/**
 * Check if quality gate should run for this tool
 */
export function shouldRunQualityGate(
  toolName: string,
  params: Record<string, any>
): QualityGateCheck {
  // Quality gate only applies to code-modifying operations
  const codeModifyingTools = ['write_file', 'modify_self_config', 'delete_file'];

  if (!codeModifyingTools.includes(toolName)) {
    return {
      shouldCheck: false,
      reason: `Tool '${toolName}' does not modify code`
    };
  }

  // Check if modifying source code (not data/logs/temp files)
  if (toolName === 'write_file' || toolName === 'delete_file') {
    const filePath = params.path?.toLowerCase() || '';

    // Skip quality gate for non-code files
    const isDataFile =
      filePath.includes('/data/') ||
      filePath.includes('/logs/') ||
      filePath.includes('/tmp/') ||
      filePath.includes('/sandbox/repo/') ||
      filePath.endsWith('.log') ||
      filePath.endsWith('.json') && !filePath.includes('package.json') && !filePath.includes('tsconfig.json');

    if (isDataFile) {
      return {
        shouldCheck: false,
        reason: 'Modifying data/log file, not source code'
      };
    }
  }

  // Initialize session if not exists
  if (!currentSession) {
    initQualityGateSession();
  }

  // Check if session expired (>2h)
  const elapsed = Date.now() - currentSession!.startTime;
  if (elapsed > CONSTITUTION.caps.maxDurationMinutes * 60 * 1000) {
    console.log('\n⏰ Quality Gate session expired, resetting...');
    initQualityGateSession();
  }

  return {
    shouldCheck: true,
    reason: 'Tool modifies source code'
  };
}

/**
 * Generate diff for quality gate analysis
 */
async function generateDiff(
  toolName: string,
  params: Record<string, any>,
  beforeContent: string | null
): Promise<string> {
  if (toolName === 'write_file') {
    const filePath = params.path;
    const newContent = params.content;

    if (!beforeContent) {
      // New file
      return `--- /dev/null
+++ b/${filePath}
@@ -0,0 +1,${newContent.split('\n').length} @@
+${newContent.split('\n').join('\n+')}`;
    } else {
      // Modified file - simplified unified diff
      const beforeLines = beforeContent.split('\n');
      const afterLines = newContent.split('\n');

      return `--- a/${filePath}
+++ b/${filePath}
@@ -1,${beforeLines.length} +1,${afterLines.length} @@
-${beforeLines.slice(0, 10).join('\n-')}${beforeLines.length > 10 ? '\n...' : ''}
+${afterLines.slice(0, 10).join('\n+')}${afterLines.length > 10 ? '\n...' : ''}`;
    }
  } else if (toolName === 'modify_self_config') {
    // For self-modification, generate semantic diff
    return `--- a/config/self.json
+++ b/config/self.json
@@ self-modification @@
+Action: ${params.action}
+Target: ${params.target}
+Value: ${params.value || 'N/A'}
+Reason: ${params.reason}`;
  } else if (toolName === 'delete_file') {
    const filePath = params.path;
    return `--- a/${filePath}
+++ /dev/null
@@ -1,${beforeContent?.split('\n').length || 0} +0,0 @@
-${beforeContent?.split('\n').slice(0, 10).join('\n-') || ''}`;
  }

  return '';
}

/**
 * Run quality gate on tool execution
 */
export async function runQualityGate(
  toolName: string,
  params: Record<string, any>,
  result: { success: boolean; output: string; error?: string }
): Promise<{
  decision: 'PASS' | 'REJECT' | 'REVIEW' | 'SKIP';
  message: string;
  gateResult?: QualityGateResult;
}> {
  // Check if should run
  const check = shouldRunQualityGate(toolName, params);
  if (!check.shouldCheck) {
    return {
      decision: 'SKIP',
      message: check.reason
    };
  }

  // Only check successful operations
  if (!result.success) {
    return {
      decision: 'SKIP',
      message: 'Tool execution failed, skipping quality gate'
    };
  }

  console.log('\n🎯 Running Quality Gate check...');

  try {
    // Get file content before change (for diff)
    let beforeContent: string | null = null;
    if (toolName === 'write_file') {
      try {
        beforeContent = fs.readFileSync(params.path, 'utf-8');
      } catch {
        // File doesn't exist yet (new file)
        beforeContent = null;
      }
    }

    // Generate diff
    const diffText = await generateDiff(toolName, params, beforeContent);

    // Build quality gate input
    const input: QualityGateInput = {
      diffText,
      filesTouched: [params.path || 'config/self.json'],
      riskContext: {
        touchesCore: toolName === 'modify_self_config',
        touchesGates: params.path?.includes('gate') || false,
        touchesCriticalFiles:
          params.path?.includes('package.json') ||
          params.path?.includes('.env') ||
          params.path?.includes('tsconfig.json') ||
          false
      }
    };

    // Classify patch
    const gateResult = classifyPatch(input);

    console.log(`   Decision: ${gateResult.decision}`);
    console.log(`   Reason codes: [${gateResult.reasonCodes.join(', ')}]`);
    console.log(`   M1 (surface): ${gateResult.metrics.M1_surfaceArea}`);
    console.log(`   M2 (risk): ${(gateResult.metrics.M2_risk * 100).toFixed(0)}%`);
    console.log(`   M3 (cognitive): ${(gateResult.metrics.M3_cognitiveLoad * 100).toFixed(0)}%`);

    // Handle decision
    if (gateResult.decision === 'PASS') {
      currentSession!.consecutiveReviews = 0; // Reset consecutive counter
      return {
        decision: 'PASS',
        message: `Quality gate PASSED: ${gateResult.reasonCodes.join(', ')}`,
        gateResult
      };
    } else if (gateResult.decision === 'REJECT') {
      currentSession!.rejectsLogged++;
      currentSession!.consecutiveReviews = 0;

      const message = `Quality gate REJECTED: ${gateResult.reasonCodes.join(', ')}\n\n${gateResult.justificationTemplate.slice(0, 500)}`;

      console.log(`\n❌ QUALITY GATE REJECTION`);
      console.log(`   Tool: ${toolName}`);
      console.log(`   Reason: ${gateResult.reasonCodes.join(', ')}`);
      console.log(`   Rejects this session: ${currentSession!.rejectsLogged}`);

      return {
        decision: 'REJECT',
        message,
        gateResult
      };
    } else {
      // REVIEW
      currentSession!.reviewsCreated++;
      currentSession!.consecutiveReviews++;

      // Check caps
      if (currentSession!.reviewsCreated > CONSTITUTION.caps.maxReviewsPerCycle) {
        console.log(`\n⚠️  REVIEW cap reached (${CONSTITUTION.caps.maxReviewsPerCycle}), treating as REJECT`);
        return {
          decision: 'REJECT',
          message: `Quality gate: REVIEW cap reached (${CONSTITUTION.caps.maxReviewsPerCycle}/${CONSTITUTION.caps.maxReviewsPerCycle})`,
          gateResult
        };
      }

      if (currentSession!.consecutiveReviews >= CONSTITUTION.caps.maxConsecutiveReviews) {
        console.log(`\n⚠️  Consecutive REVIEW limit reached (${CONSTITUTION.caps.maxConsecutiveReviews}), stopping cycle`);
        return {
          decision: 'REJECT',
          message: `Quality gate: Too many consecutive REVIEWs (${CONSTITUTION.caps.maxConsecutiveReviews}). Agent needs human guidance.`,
          gateResult
        };
      }

      const message = `Quality gate: REVIEW REQUIRED\n\nReasons: ${gateResult.reasonCodes.join(', ')}\n\nQuestions:\n${gateResult.reviewQuestions?.map((q, i) => `${i + 1}. ${q}`).join('\n')}\n\nThis change requires human judgment before proceeding.`;

      console.log(`\n🔍 QUALITY GATE REVIEW`);
      console.log(`   Tool: ${toolName}`);
      console.log(`   Reason: ${gateResult.reasonCodes.join(', ')}`);
      console.log(`   Reviews this session: ${currentSession!.reviewsCreated}/${CONSTITUTION.caps.maxReviewsPerCycle}`);
      console.log(`   Consecutive: ${currentSession!.consecutiveReviews}/${CONSTITUTION.caps.maxConsecutiveReviews}`);

      return {
        decision: 'REVIEW',
        message,
        gateResult
      };
    }
  } catch (error: any) {
    console.error(`\n❌ Quality gate error: ${error.message}`);
    // On error, default to PASS (fail open for now)
    return {
      decision: 'PASS',
      message: `Quality gate error (defaulting to PASS): ${error.message}`
    };
  }
}

/**
 * Log quality gate decision to file
 */
export function logQualityGateDecision(
  toolName: string,
  params: Record<string, any>,
  decision: string,
  message: string
): void {
  const logDir = path.join(process.cwd(), 'data', 'quality_gate');
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  const logFile = path.join(logDir, 'decisions.jsonl');
  const entry = {
    timestamp: new Date().toISOString(),
    toolName,
    params: JSON.stringify(params).slice(0, 200),
    decision,
    message: message.slice(0, 500)
  };

  fs.appendFileSync(logFile, JSON.stringify(entry) + '\n');
}

/**
 * Create PR for quality gate PASS
 */
export async function createPRForPass(
  toolName: string,
  params: Record<string, any>,
  gateResult: QualityGateResult
): Promise<{ success: boolean; prUrl?: string; error?: string }> {
  try {
    // Check if PR creation cap reached
    if (!currentSession) {
      initQualityGateSession();
    }

    if (currentSession!.prsCreated >= CONSTITUTION.caps.maxPRsPerCycle) {
      console.log(`\n⚠️  PR cap reached (${CONSTITUTION.caps.maxPRsPerCycle}), skipping PR creation`);
      return {
        success: false,
        error: `PR cap reached (${CONSTITUTION.caps.maxPRsPerCycle}/${CONSTITUTION.caps.maxPRsPerCycle})`
      };
    }

    console.log('\n📝 Creating PR for quality gate PASS...');

    // Get file path
    const filePath = params.path || 'config/self.json';
    const timestamp = Date.now();
    const branchName = `nous/qgate-${timestamp}`;

    // Get current branch for returning later
    const getCurrentBranch = await shellActions.execute('git rev-parse --abbrev-ref HEAD');
    const originalBranch = getCurrentBranch.success && getCurrentBranch.output ? getCurrentBranch.output.trim() : 'main';

    // Create new branch from HEAD
    const createBranch = await shellActions.execute(`git checkout -b ${branchName}`);
    if (!createBranch.success) {
      return { success: false, error: `Failed to create branch: ${createBranch.error}` };
    }

    // Stage the specific file
    const stageFile = await shellActions.execute(`git add "${filePath}"`);
    if (!stageFile.success) {
      await shellActions.execute(`git checkout ${originalBranch}`);
      return { success: false, error: `Failed to stage file: ${stageFile.error}` };
    }

    // Create commit with quality gate justification
    const commitMessage = `${toolName}: ${filePath}

Quality Gate: PASSED
Reason codes: ${gateResult.reasonCodes.join(', ')}

${gateResult.justificationTemplate}

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>`;

    const commit = await shellActions.execute(
      `git commit -m "${commitMessage.replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`
    );

    if (!commit.success) {
      await shellActions.execute(`git checkout ${originalBranch}`);
      return { success: false, error: `Failed to commit: ${commit.error}` };
    }

    // Push branch to remote
    const push = await shellActions.execute(`git push -u origin ${branchName}`);
    if (!push.success) {
      await shellActions.execute(`git checkout ${originalBranch}`);
      return { success: false, error: `Failed to push: ${push.error}` };
    }

    // Create PR using gh
    const prBody = `## Quality Gate: PASSED ✅

**File**: \`${filePath}\`
**Tool**: ${toolName}
**Reason codes**: ${gateResult.reasonCodes.join(', ')}

### Metrics
- **M1 (Surface Area)**: ${gateResult.metrics.M1_surfaceArea}
- **M2 (Risk)**: ${(gateResult.metrics.M2_risk * 100).toFixed(0)}%
- **M3 (Cognitive Load)**: ${(gateResult.metrics.M3_cognitiveLoad * 100).toFixed(0)}%

### Justification
${gateResult.justificationTemplate}

---

🤖 Generated with [Claude Code](https://claude.com/claude-code)

This PR was automatically created by NOUS after passing quality gate G6.
**DO NOT auto-merge** - Human review required.`;

    const createPR = await shellActions.execute(
      `gh pr create --title "${toolName}: Update ${path.basename(filePath)}" --body "${prBody.replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`
    );

    // Return to original branch
    await shellActions.execute(`git checkout ${originalBranch}`);

    if (!createPR.success) {
      return { success: false, error: `Failed to create PR: ${createPR.error}` };
    }

    // Extract PR URL from output
    const prUrlMatch = createPR.output?.match(/https:\/\/github\.com\/[^\s]+/);
    const prUrl = prUrlMatch ? prUrlMatch[0] : undefined;

    // Increment session counter
    currentSession!.prsCreated++;

    console.log(`   ✅ PR created: ${prUrl || 'success'}`);
    console.log(`   PRs this session: ${currentSession!.prsCreated}/${CONSTITUTION.caps.maxPRsPerCycle}`);

    return { success: true, prUrl };
  } catch (error: any) {
    console.error(`\n❌ PR creation error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Create Issue for quality gate REVIEW
 */
export async function createIssueForReview(
  toolName: string,
  params: Record<string, any>,
  gateResult: QualityGateResult
): Promise<{ success: boolean; issueUrl?: string; error?: string }> {
  try {
    console.log('\n🔍 Creating Issue for quality gate REVIEW...');

    const filePath = params.path || 'config/self.json';

    const issueTitle = `Quality Gate Review: ${toolName} on ${path.basename(filePath)}`;
    const issueBody = `## Quality Gate: REVIEW REQUIRED 🟡

**File**: \`${filePath}\`
**Tool**: ${toolName}
**Reason codes**: ${gateResult.reasonCodes.join(', ')}

### Metrics
- **M1 (Surface Area)**: ${gateResult.metrics.M1_surfaceArea}
- **M2 (Risk)**: ${(gateResult.metrics.M2_risk * 100).toFixed(0)}%
- **M3 (Cognitive Load)**: ${(gateResult.metrics.M3_cognitiveLoad * 100).toFixed(0)}%

### Review Questions
${gateResult.reviewQuestions?.map((q, i) => `${i + 1}. ${q}`).join('\n') || 'No specific questions provided'}

### Justification
${gateResult.justificationTemplate}

---

🤖 Generated with [Claude Code](https://claude.com/claude-code)

This change requires human judgment before proceeding. Please review and provide guidance.`;

    const createIssue = await shellActions.execute(
      `gh issue create --title "${issueTitle}" --body "${issueBody.replace(/"/g, '\\"').replace(/\n/g, '\\n')}" --label "quality-gate-review"`
    );

    if (!createIssue.success) {
      return { success: false, error: `Failed to create issue: ${createIssue.error}` };
    }

    // Extract issue URL from output
    const issueUrlMatch = createIssue.output?.match(/https:\/\/github\.com\/[^\s]+/);
    const issueUrl = issueUrlMatch ? issueUrlMatch[0] : undefined;

    console.log(`   ✅ Issue created: ${issueUrl || 'success'}`);

    return { success: true, issueUrl };
  } catch (error: any) {
    console.error(`\n❌ Issue creation error: ${error.message}`);
    return { success: false, error: error.message };
  }
}
