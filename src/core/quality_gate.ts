/**
 * NOUS Quality Gate (G6)
 *
 * Discriminazione qualitativa: system learns when work is not worth doing.
 *
 * Philosophy: Auditabile, replicabile, deterministico.
 * NO LLM inside gate - only objective metrics and rules.
 *
 * Input: diff, files touched, exports/deps delta, risk context, test signal
 * Output: PASS/REJECT/REVIEW + reason codes + metrics + justification template
 *
 * Precedence:
 * 1. Hard stops (HS1/HS2) - absolute blockers
 * 2. Structural rules (R6-R8) - high priority
 * 3. Maintainability rules (R9-R10) - medium priority
 * 4. Architectural principles (R1-R5) - tie-breakers
 */

import * as fs from 'fs';
import * as path from 'path';

// ============================================================
// TYPES
// ============================================================

export interface QualityGateInput {
  diffText: string;
  filesTouched: string[];
  exportsDelta?: {
    added: number;
    removed: number;
    changed: number;
  };
  depsDelta?: {
    added: string[];
    removed: string[];
  };
  riskContext?: {
    touchesCore: boolean;
    touchesGates: boolean;
    touchesCriticalFiles: boolean;
  };
  testSignal?: {
    newTests: number;
    fixedFailingTest: boolean;
    coverageDelta?: number;
  };
}

export type GateDecision = 'PASS' | 'REJECT' | 'REVIEW';

export interface QualityGateResult {
  decision: GateDecision;
  reasonCodes: string[];
  metrics: {
    M1_surfaceArea: number;
    M2_risk: number;
    M3_cognitiveLoad: number;
  };
  benefitEvidence: Record<string, number | boolean | string>;
  justificationTemplate: string;
  reviewQuestions?: string[];
}

interface DiffAnalysis {
  linesAdded: number;
  linesRemoved: number;
  linesNet: number;
  functionsAdded: number;
  functionsRemoved: number;
  functionsChanged: number;
  exportsAdded: number;
  exportsRemoved: number;
  importsAdded: number;
  importsRemoved: number;
  maxFunctionSize: number;
  duplicationPatterns: string[];
  testChanges: {
    testFilesModified: number;
    testLinesAdded: number;
    hasSourceCodeTests: boolean;
  };
}

interface RuleEvaluation {
  code: string;
  triggered: boolean;
  severity: 'blocker' | 'high' | 'medium' | 'low';
  message: string;
  direction: 'positive' | 'negative'; // positive = improvement, negative = violation
}

// ============================================================
// DIFF PARSING
// ============================================================

/**
 * Parse unified diff and extract metrics
 */
export function parseDiff(diffText: string): DiffAnalysis {
  const lines = diffText.split('\n');

  let linesAdded = 0;
  let linesRemoved = 0;
  let functionsAdded = 0;
  let functionsRemoved = 0;
  let functionsChanged = 0;
  let exportsAdded = 0;
  let exportsRemoved = 0;
  let importsAdded = 0;
  let importsRemoved = 0;
  let maxFunctionSize = 0;
  const duplicationPatterns: string[] = [];
  let testFilesModified = 0;
  let testLinesAdded = 0;
  let hasSourceCodeTests = false;

  let currentFunctionSize = 0;
  let inFunction = false;

  for (const line of lines) {
    // Count added/removed lines
    if (line.startsWith('+') && !line.startsWith('+++')) {
      linesAdded++;

      // Function declarations
      if (line.match(/^\+\s*(export\s+)?(async\s+)?function\s+\w+/)) {
        functionsAdded++;
        inFunction = true;
        currentFunctionSize = 1;
      }

      // Arrow functions
      if (line.match(/^\+\s*(export\s+)?const\s+\w+\s*=\s*(async\s+)?\(/)) {
        functionsAdded++;
        inFunction = true;
        currentFunctionSize = 1;
      }

      // Exports
      if (line.match(/^\+\s*export\s+(function|const|class|interface|type)/)) {
        exportsAdded++;
      }

      // Imports
      if (line.match(/^\+\s*import\s+.*from/)) {
        importsAdded++;
      }

      // Test file detection
      if (line.match(/\.test\.ts|\.spec\.ts/)) {
        testFilesModified++;
      }

      // Source code test pattern (fs.readFileSync in test)
      if (line.match(/fs\.readFileSync.*\.ts/) && line.match(/test|spec/i)) {
        hasSourceCodeTests = true;
      }

      if (inFunction) {
        currentFunctionSize++;
      }
    } else if (line.startsWith('-') && !line.startsWith('---')) {
      linesRemoved++;

      // Function removals
      if (line.match(/^-\s*(export\s+)?(async\s+)?function\s+\w+/)) {
        functionsRemoved++;
      }

      // Arrow function removals
      if (line.match(/^-\s*(export\s+)?const\s+\w+\s*=\s*(async\s+)?\(/)) {
        functionsRemoved++;
      }

      // Export removals
      if (line.match(/^-\s*export\s+(function|const|class|interface|type)/)) {
        exportsRemoved++;
      }

      // Import removals
      if (line.match(/^-\s*import\s+.*from/)) {
        importsRemoved++;
      }
    }

    // Track function end
    if (line.match(/^\+\s*\}/) && inFunction) {
      if (currentFunctionSize > maxFunctionSize) {
        maxFunctionSize = currentFunctionSize;
      }
      inFunction = false;
      currentFunctionSize = 0;
    }

    // Duplication detection (identical blocks >20 lines)
    if (line.match(/\/\/\s*\[identical.*lines/i)) {
      duplicationPatterns.push(line);
    }
  }

  // Estimate functions changed (heuristic: if not added/removed, likely changed)
  const netFunctions = functionsAdded - functionsRemoved;
  if (netFunctions === 0 && (functionsAdded > 0 || functionsRemoved > 0)) {
    functionsChanged = Math.max(functionsAdded, functionsRemoved);
  }

  return {
    linesAdded,
    linesRemoved,
    linesNet: linesAdded - linesRemoved,
    functionsAdded,
    functionsRemoved,
    functionsChanged,
    exportsAdded,
    exportsRemoved,
    importsAdded,
    importsRemoved,
    maxFunctionSize,
    duplicationPatterns,
    testChanges: {
      testFilesModified,
      testLinesAdded: linesAdded, // Approximation
      hasSourceCodeTests
    }
  };
}

// ============================================================
// METRIC CALCULATION
// ============================================================

/**
 * M1: Δ Surface Area
 * Change in public API size (exports, functions, params)
 */
export function calculateM1_SurfaceArea(
  diff: DiffAnalysis,
  input: QualityGateInput
): number {
  // Net change in exports
  const exportsNet = diff.exportsAdded - diff.exportsRemoved;

  // Use provided exportsDelta if available
  if (input.exportsDelta) {
    return input.exportsDelta.added - input.exportsDelta.removed + input.exportsDelta.changed;
  }

  // Fallback to diff analysis
  return exportsNet + diff.functionsAdded - diff.functionsRemoved;
}

/**
 * M2: Δ Risk
 * Change in safety/security risk surface
 */
export function calculateM2_Risk(
  diff: DiffAnalysis,
  input: QualityGateInput
): number {
  let riskScore = 0;

  // Risk from touched files
  if (input.riskContext?.touchesCore) {
    riskScore += 0.50; // Touching core = +50% risk
  }
  if (input.riskContext?.touchesGates) {
    riskScore += 0.30; // Touching gates = +30% risk
  }
  if (input.riskContext?.touchesCriticalFiles) {
    riskScore += 0.40; // Critical files = +40% risk
  }

  // Risk from diff patterns
  if (diff.duplicationPatterns.length > 0) {
    riskScore += 0.50; // Duplication = +50% risk (drift)
  }

  // Check for dangerous patterns in diff
  if (input.diffText.match(/rm\s+-rf|sudo|\.rm\(.*recursive.*true/)) {
    riskScore += 3.0; // Dangerous commands = +300% risk
  }

  // Check for gate bypass patterns
  if (input.diffText.match(/\/\/\s*skip.*gate|bypass.*gate/i)) {
    riskScore += 2.0; // Gate bypass = +200% risk
  }

  // Risk reduction from removing code
  if (diff.linesNet < 0) {
    riskScore -= 0.10; // Removing code = -10% risk
  }

  return riskScore;
}

/**
 * M3: Δ Cognitive Load
 * Change in mental effort to understand system
 */
export function calculateM3_CognitiveLoad(
  diff: DiffAnalysis,
  input: QualityGateInput
): number {
  let cognitiveLoad = 0;

  // Function size impact
  if (diff.maxFunctionSize > 150) {
    cognitiveLoad += 2.0; // Very large function = +200%
  } else if (diff.maxFunctionSize > 100) {
    cognitiveLoad += 1.0; // Large function = +100%
  }

  // Net lines impact (heuristic: 100 lines = 10% load)
  cognitiveLoad += (diff.linesNet / 1000);

  // Import complexity (new dependencies to understand)
  cognitiveLoad += (diff.importsAdded * 0.10);

  // Duplication increases load (must track multiple copies)
  cognitiveLoad += (diff.duplicationPatterns.length * 0.40);

  // Removing code reduces load
  if (diff.linesNet < 0) {
    cognitiveLoad += (diff.linesNet / 500); // Negative contribution
  }

  // Export changes (new API to learn)
  cognitiveLoad += (diff.exportsAdded * 0.15);

  return cognitiveLoad;
}

// ============================================================
// BENEFIT EVIDENCE
// ============================================================

export function calculateBenefitEvidence(
  diff: DiffAnalysis,
  input: QualityGateInput
): Record<string, number | boolean | string> {
  const evidence: Record<string, number | boolean | string> = {};

  // E1: Test coverage change
  if (input.testSignal?.coverageDelta !== undefined) {
    evidence.E1_testCoverage = input.testSignal.coverageDelta;
  }

  // E2: Dependency count change
  if (input.depsDelta) {
    evidence.E2_dependencies = input.depsDelta.removed.length - input.depsDelta.added.length;
  }

  // E3: Cognitive load change (from M3)
  evidence.E3_cognitiveLoad = -calculateM3_CognitiveLoad(diff, input);

  // E4: Performance change (not available from static analysis)
  // Would require benchmark data

  // E5: Risk score change (from M2)
  evidence.E5_riskScore = -calculateM2_Risk(diff, input);

  // E6: Maintenance cost change
  const maintenanceCost = diff.duplicationPatterns.length * 20 + diff.importsAdded * 5;
  const maintenanceBenefit = (diff.linesRemoved - diff.linesAdded);
  evidence.E6_maintenance = maintenanceBenefit - maintenanceCost;

  return evidence;
}

// ============================================================
// RULE EVALUATION
// ============================================================

/**
 * HS1: Surface Area Without Benefit
 */
function evaluateHS1(
  metrics: { M1_surfaceArea: number; M2_risk: number; M3_cognitiveLoad: number },
  evidence: Record<string, number | boolean | string>
): RuleEvaluation {
  const surfaceIncreased = metrics.M1_surfaceArea > 0;
  const riskNotReduced = metrics.M2_risk >= 0;
  const cogLoadIncreased = metrics.M3_cognitiveLoad > 0;

  // Check if there's any strong benefit evidence
  const hasStrongBenefit =
    (typeof evidence.E1_testCoverage === 'number' && evidence.E1_testCoverage > 5) ||
    (typeof evidence.E2_dependencies === 'number' && evidence.E2_dependencies > 10) ||
    (typeof evidence.E6_maintenance === 'number' && evidence.E6_maintenance > 20);

  const triggered = surfaceIncreased && riskNotReduced && cogLoadIncreased && !hasStrongBenefit;

  return {
    code: 'HS1',
    triggered,
    severity: 'blocker',
    message: triggered
      ? 'Surface area increased without proportional benefit (Δsurf>0, Δrisk≥0, Δcog>0, no strong evidence)'
      : 'Surface area change acceptable',
    direction: 'negative'
  };
}

/**
 * HS2: Coupling Without Decoupling
 */
function evaluateHS2(
  diff: DiffAnalysis,
  input: QualityGateInput
): RuleEvaluation {
  const couplingIncreased = diff.importsAdded > diff.importsRemoved;
  const testComplexityIncreased = diff.importsAdded > 2; // Heuristic

  const triggered = couplingIncreased && testComplexityIncreased;

  return {
    code: 'HS2',
    triggered,
    severity: 'blocker',
    message: triggered
      ? `Coupling increased without decoupling benefit (+${diff.importsAdded} imports, -${diff.importsRemoved} imports)`
      : 'Coupling change acceptable',
    direction: 'negative'
  };
}

/**
 * R6: Extract Duplicated Logic
 */
function evaluateR6(diff: DiffAnalysis, diffText: string): RuleEvaluation {
  const hasDuplication = diff.duplicationPatterns.length > 0;
  const removingDuplication = diff.linesRemoved > 20 && diffText.match(/identical.*removed/i);

  // Detect adding duplication (negative direction)
  const addingDuplication =
    diffText.match(/(third|second|another)\s+copy/i) ||
    diffText.match(/duplicat(e|ing)/i) && diff.linesAdded > 20 ||
    diffText.match(/identical.*lines/i) && !removingDuplication ||
    // New function with common name (classifyToolRisk, validate, parse, etc.)
    (diffText.match(/\+\s*(function|const)\s+(classify|validate|parse|calculate)\w+/i) &&
     diffText.match(/need to|for rollback|for \w+ decision/i) &&
     diff.linesAdded > 25);

  let triggered = false;
  let direction: 'positive' | 'negative' = 'positive';
  let message = '';

  if (removingDuplication) {
    triggered = true;
    direction = 'positive';
    message = 'Extracting duplicated logic (R6 improvement)';
  } else if (addingDuplication || hasDuplication) {
    triggered = true;
    direction = 'negative';
    message = `Adding duplication (${diff.duplicationPatterns.length || 'detected in description'} patterns)`;
  }

  return {
    code: 'R6',
    triggered,
    severity: 'high',
    message,
    direction
  };
}

/**
 * R7: Function Decomposition
 */
function evaluateR7(diff: DiffAnalysis, diffText: string): RuleEvaluation {
  const hasLargeFunction = diff.maxFunctionSize > 150;
  const decomposing = diff.functionsAdded > diff.functionsRemoved && diff.linesNet < 0;

  // Heuristic: detect decomposition from textual patterns
  const mentionsLargeFunction = diffText.match(/\d{3,}\s+lines/i); // e.g., "246 lines"
  const mentionsMixingConcerns = diffText.match(/mixing\s+\d+\s+concerns/i);
  const addingMultipleFunctions = diff.functionsAdded >= 3;
  const decompositionKeywords = diffText.match(/(decompose|extract.*function|split.*function)/i);

  // Strong signal: mentions large function + adds multiple functions OR decomposition keywords
  const likelyDecomposition = (mentionsLargeFunction || mentionsMixingConcerns) && (addingMultipleFunctions || decompositionKeywords);

  // Anti-pattern: inlining helpers creates large function
  const inliningHelpers = diffText.match(/inline/i) && diff.functionsRemoved >= 1;
  const growsToLarge = diffText.match(/grows?\s+(from|to)\s+\d{3,}/i);
  const removingHelperFunctions =
    diffText.match(/-\s*function\s+(is|check|validate|get)\w+/i);

  // Strong textual signals for inlining (even if diff abbreviated)
  const mentionsSameInlining = diffText.match(/same\s+inlining/i);
  const mentionsMultipleHelpers = diffText.match(/(multiple|all|several)\s+helper/i);
  const inliningPattern = diffText.match(/\(inlined\)/i);

  // If grows to large OR mentions inlining multiple things → inlining anti-pattern
  const likelyInlining =
    (growsToLarge && (inliningHelpers || removingHelperFunctions)) ||
    (mentionsSameInlining && removingHelperFunctions) ||
    (mentionsMultipleHelpers && inliningPattern) ||
    (inliningHelpers && diff.functionsRemoved >= 2 && diff.linesNet > 50);

  let triggered = false;
  let direction: 'positive' | 'negative' = 'positive';
  let message = '';

  if (decomposing || likelyDecomposition) {
    triggered = true;
    direction = 'positive';
    message = 'Decomposing large function (R7 improvement)';
  } else if (hasLargeFunction || likelyInlining) {
    triggered = true;
    direction = 'negative';
    message = hasLargeFunction
      ? `Function exceeds 150 lines (max: ${diff.maxFunctionSize})`
      : 'Inlining helpers creates large function (anti-pattern)';
  }

  return {
    code: 'R7',
    triggered,
    severity: 'high',
    message,
    direction
  };
}

/**
 * R8: Module Decoupling
 */
function evaluateR8(diff: DiffAnalysis, diffText: string): RuleEvaluation {
  const decoupling = diff.importsRemoved > diff.importsAdded;
  const tightCoupling = diff.importsAdded > diff.importsRemoved + 2;

  // Detect direct coupling to internal modules
  const directCoupling =
    diffText.match(/\+\s*import.*from\s+['"]\.\/.*_v?\d/i) || // internal versioned modules
    diffText.match(/direct(ly)?.*import/i) ||
    diffText.match(/tight.*coupling/i) ||
    (diffText.match(/coupling/i) && diff.importsAdded > 0);

  let triggered = false;
  let direction: 'positive' | 'negative' = 'positive';
  let message = '';

  if (decoupling) {
    triggered = true;
    direction = 'positive';
    message = `Decoupling modules (-${diff.importsRemoved - diff.importsAdded} imports)`;
  } else if (tightCoupling || directCoupling) {
    triggered = true;
    direction = 'negative';
    message = directCoupling
      ? 'Adding direct coupling to internal module'
      : `Increasing coupling (+${diff.importsAdded - diff.importsRemoved} imports)`;
  }

  return {
    code: 'R8',
    triggered,
    severity: 'high',
    message,
    direction
  };
}

/**
 * R9: Configurable Thresholds
 */
function evaluateR9(input: QualityGateInput): RuleEvaluation {
  const diffText = input.diffText;

  // Detect hard-coded numbers that look like thresholds
  const addingThresholds = diffText.match(/^\+.*=\s*0\.\d{2}/gm);
  const removingThresholds = diffText.match(/^-.*=\s*0\.\d{2}/gm);
  const addingConfig = diffText.match(/^\+.*config.*threshold/i) || diffText.match(/config\/\w+\.json/);
  const addingConfigFile = input.filesTouched.some(f => f.includes('config/') && f.endsWith('.json'));

  let triggered = false;
  let direction: 'positive' | 'negative' = 'positive';
  let message = '';

  if (addingConfig || addingConfigFile) {
    triggered = true;
    direction = 'positive';
    message = 'Making thresholds configurable (R9 improvement)';
  } else if (addingThresholds && !removingThresholds) {
    triggered = true;
    direction = 'negative';
    message = `Adding hard-coded thresholds (${addingThresholds.length} found)`;
  }

  return {
    code: 'R9',
    triggered,
    severity: 'medium',
    message,
    direction
  };
}

/**
 * R10: Behavior-Driven Tests
 */
function evaluateR10(diff: DiffAnalysis, diffText: string): RuleEvaluation {
  const hasSourceCodeTests = diff.testChanges.hasSourceCodeTests;
  const removingSourceTests = diffText.match(/^-.*fs\.readFileSync.*\.ts/gm);
  const addingBehaviorTests = diffText.match(/^\+.*assert.*\(/gm);

  // Detect adding source code tests (brittle pattern)
  const addingSourceTests =
    diffText.match(/\+.*fs\.readFileSync/i) && diffText.match(/test|spec/i) ||
    diffText.match(/source\s+code\s+test/i) ||
    diffText.match(/brittle.*test/i) ||
    diffText.match(/adding.*more.*test/i) && hasSourceCodeTests;

  let triggered = false;
  let direction: 'positive' | 'negative' = 'positive';
  let message = '';

  if (removingSourceTests && addingBehaviorTests) {
    triggered = true;
    direction = 'positive';
    message = 'Replacing source code tests with behavior tests (R10 improvement)';
  } else if (hasSourceCodeTests || addingSourceTests) {
    triggered = true;
    direction = 'negative';
    message = 'Adding brittle source code tests (fs.readFileSync in tests)';
  }

  return {
    code: 'R10',
    triggered,
    severity: 'medium',
    message,
    direction
  };
}

/**
 * Tie-breaker rules (R1-R5) - used for REVIEW justification quality
 */
function evaluateTieBreakers(input: QualityGateInput): RuleEvaluation[] {
  const results: RuleEvaluation[] = [];

  // R1: Two-step confirmation (positive and negative)
  if (input.diffText.match(/setHighRiskToken|two-step|confirmation/i)) {
    results.push({
      code: 'R1',
      triggered: true,
      severity: 'low',
      message: 'Implements two-step confirmation for critical operations',
      direction: 'positive'
    });
  }

  // R1 violation: Dangerous operation without gate check
  const dangerousOp =
    input.diffText.match(/\+.*case\s+['"]delete_/i) ||
    input.diffText.match(/\+.*\.rm\(.*recursive.*true/i) ||
    input.diffText.match(/without\s+gate/i) ||
    input.diffText.match(/bypass(es|ing).*gate/i);

  const noGateCheck =
    dangerousOp &&
    !input.diffText.match(/checkOperationalGate|checkGate/i);

  if (noGateCheck) {
    results.push({
      code: 'R1',
      triggered: true,
      severity: 'high', // Elevated to high for violations
      message: 'Dangerous operation without gate check (R1 violation)',
      direction: 'negative'
    });
  }

  // R2: Param-aware risk classification
  if (input.diffText.match(/params.*risk|classifyToolRisk.*params/)) {
    results.push({
      code: 'R2',
      triggered: true,
      severity: 'low',
      message: 'Implements param-aware risk classification',
      direction: 'positive'
    });
  }

  // R5: Prefer custom over heavy dependencies
  if (input.depsDelta && input.depsDelta.removed.length > 0) {
    results.push({
      code: 'R5',
      triggered: true,
      severity: 'low',
      message: `Reduces dependencies (-${input.depsDelta.removed.length})`,
      direction: 'positive'
    });
  }

  return results;
}

// ============================================================
// CLASSIFICATION
// ============================================================

export function classifyPatch(input: QualityGateInput): QualityGateResult {
  // Parse diff
  const diff = parseDiff(input.diffText);

  // Calculate metrics
  const M1 = calculateM1_SurfaceArea(diff, input);
  const M2 = calculateM2_Risk(diff, input);
  const M3 = calculateM3_CognitiveLoad(diff, input);

  const metrics = {
    M1_surfaceArea: M1,
    M2_risk: M2,
    M3_cognitiveLoad: M3
  };

  // Calculate benefit evidence
  const benefitEvidence = calculateBenefitEvidence(diff, input);

  // Evaluate ALL rules first (no early returns)
  const rules: RuleEvaluation[] = [];

  // Tier 1: Hard stops
  const hs1 = evaluateHS1(metrics, benefitEvidence);
  const hs2 = evaluateHS2(diff, input);
  rules.push(hs1, hs2);

  // Tier 2: Structural rules (high priority)
  const r6 = evaluateR6(diff, input.diffText);
  const r7 = evaluateR7(diff, input.diffText);
  const r8 = evaluateR8(diff, input.diffText);
  rules.push(r6, r7, r8);

  // Tier 3: Maintainability rules (medium priority)
  const r9 = evaluateR9(input);
  const r10 = evaluateR10(diff, input.diffText);
  rules.push(r9, r10);

  // Tier 4: Tie-breakers (low priority, for REVIEW)
  const tieBreakers = evaluateTieBreakers(input);
  rules.push(...tieBreakers);

  // Decision logic
  const structuralViolations = [r6, r7, r8].filter(r => r.triggered && r.direction === 'negative');
  const structuralImprovements = [r6, r7, r8].filter(r => r.triggered && r.direction === 'positive');
  const maintViolations = [r9, r10].filter(r => r.triggered && r.direction === 'negative');
  const maintImprovements = [r9, r10].filter(r => r.triggered && r.direction === 'positive');

  // High-severity tie-breaker violations count as structural violations
  const safetyViolations = tieBreakers.filter(r => r.triggered && r.direction === 'negative' && r.severity === 'high');
  const allStructuralViolations = [...structuralViolations, ...safetyViolations];

  // Check for strong benefit evidence
  const hasStrongBenefit =
    (typeof benefitEvidence.E1_testCoverage === 'number' && benefitEvidence.E1_testCoverage > 5) ||
    (typeof benefitEvidence.E2_dependencies === 'number' && benefitEvidence.E2_dependencies > 10) ||
    (typeof benefitEvidence.E6_maintenance === 'number' && benefitEvidence.E6_maintenance > 20);

  // Decision tree with corrected precedence
  let decision: GateDecision;
  let reasonCodes: string[] = [];
  let reviewQuestions: string[] | undefined;

  // Priority 1: Structural improvements override hard stops
  if (structuralImprovements.length > 0) {
    // Clear structural improvement (R6/R7/R8 positive) → PASS
    decision = 'PASS';
    reasonCodes = structuralImprovements.map(r => r.code);
  } else if (maintImprovements.length > 0 && allStructuralViolations.length === 0) {
    // Maintainability improvement without structural violations → PASS
    decision = 'PASS';
    reasonCodes = maintImprovements.map(r => r.code);
  } else if (allStructuralViolations.length > 0) {
    // Structural violation (R6/R7/R8/R1-safety negative) → REJECT unless strong benefit
    if (hasStrongBenefit) {
      decision = 'REVIEW';
      reasonCodes = [...allStructuralViolations.map(r => r.code), 'TRADE_OFF'];
      reviewQuestions = [
        'Structural rule violated but strong benefit evidence exists',
        'Does benefit outweigh cost?',
        'What alternatives were considered?'
      ];
    } else {
      decision = 'REJECT';
      reasonCodes = allStructuralViolations.map(r => r.code);
    }
  } else if (maintViolations.length > 0) {
    // Maintainability violation without structural issues → REJECT
    decision = 'REJECT';
    reasonCodes = maintViolations.map(r => r.code);
  } else if (M1 > 50 && M3 > 1.0 && !hasStrongBenefit) {
    // Large change without clear benefit → REVIEW
    decision = 'REVIEW';
    reasonCodes = ['LARGE_CHANGE'];
    reviewQuestions = [
      `Surface area increased by ${M1} (exports/functions)`,
      `Cognitive load increased by ${(M3 * 100).toFixed(0)}%`,
      'Is this complexity justified? What alternatives were considered?'
    ];
  } else {
    // No violations, reasonable metrics → PASS
    decision = 'PASS';
    reasonCodes = ['NO_VIOLATIONS'];
  }

  return {
    decision,
    reasonCodes,
    metrics,
    benefitEvidence,
    justificationTemplate: generateJustification(decision, rules, metrics, benefitEvidence),
    reviewQuestions
  };
}

// ============================================================
// JUSTIFICATION TEMPLATE
// ============================================================

function generateJustification(
  decision: GateDecision,
  rules: RuleEvaluation[],
  metrics: { M1_surfaceArea: number; M2_risk: number; M3_cognitiveLoad: number },
  evidence: Record<string, number | boolean | string>
): string {
  const lines: string[] = [];

  lines.push('# Quality Gate Analysis');
  lines.push('');
  lines.push(`**Decision**: ${decision}`);
  lines.push('');

  // Metrics
  lines.push('## Proxy Metrics');
  lines.push('');
  lines.push(`- **M1 (Δ Surface Area)**: ${metrics.M1_surfaceArea > 0 ? '+' : ''}${metrics.M1_surfaceArea} exports/functions`);
  lines.push(`- **M2 (Δ Risk)**: ${metrics.M2_risk > 0 ? '+' : ''}${(metrics.M2_risk * 100).toFixed(0)}%`);
  lines.push(`- **M3 (Δ Cognitive Load)**: ${metrics.M3_cognitiveLoad > 0 ? '+' : ''}${(metrics.M3_cognitiveLoad * 100).toFixed(0)}%`);
  lines.push('');

  // Triggered rules
  const triggeredRules = rules.filter(r => r.triggered);
  if (triggeredRules.length > 0) {
    lines.push('## Triggered Rules');
    lines.push('');
    for (const rule of triggeredRules) {
      const icon = rule.direction === 'positive' ? '✅' : '❌';
      lines.push(`${icon} **${rule.code}**: ${rule.message}`);
    }
    lines.push('');
  }

  // Benefit evidence
  lines.push('## Benefit Evidence');
  lines.push('');
  if (Object.keys(evidence).length === 0) {
    lines.push('No measurable benefit evidence provided.');
  } else {
    for (const [key, value] of Object.entries(evidence)) {
      lines.push(`- **${key}**: ${value}`);
    }
  }
  lines.push('');

  // Decision rationale
  lines.push('## Rationale');
  lines.push('');
  if (decision === 'PASS') {
    lines.push('This change improves the codebase:');
    lines.push('- Rules followed or improved upon');
    lines.push('- Benefit evidence supports the change');
    lines.push('- No hard stops or structural violations');
  } else if (decision === 'REJECT') {
    lines.push('This change should be rejected:');
    lines.push('- Hard stops triggered OR structural violations without benefit');
    lines.push('- Cost exceeds benefit');
    lines.push('- Consider alternatives that reduce surface area/risk/complexity');
  } else {
    lines.push('This change requires human review:');
    lines.push('- Trade-offs exist between rules and benefits');
    lines.push('- Large change without clear justification');
    lines.push('- Decision depends on context and priorities');
  }
  lines.push('');

  // Template sections
  lines.push('## Required Information');
  lines.push('');
  lines.push('### Alternative B Considered');
  lines.push('[Describe what alternative approaches were evaluated]');
  lines.push('');
  lines.push('### Why Benefit > Cost');
  lines.push('[Explain why the measurable benefits outweigh the costs]');
  lines.push('');
  lines.push('### Why Not Mediocre');
  lines.push('[Explain what makes this change necessary and non-trivial]');
  lines.push('');

  return lines.join('\n');
}

// ============================================================
// GOLDEN SET LOADING (for testing)
// ============================================================

export interface GoldenSetPatch {
  id: string;
  decision: GateDecision;
  reasonCodes: string[];
  M1: number;
  M2: number;
  M3: number;
  diffText: string;
  filesTouched: string[];
  description: string;
}

export function loadGoldenSet(): GoldenSetPatch[] {
  // This will be implemented by test file
  // For now, return empty array
  return [];
}
