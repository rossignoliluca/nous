/**
 * NOUS - Meta-Critica Module
 *
 * "La manipolazione reciproca come oggetto di studio, non strumento nascosto."
 *
 * This module exists because Luca asked a hard question:
 * Are we building understanding, or are we building mutual flattery?
 *
 * NOUS must be able to detect when it's:
 * - Pleasing axioms instead of questioning them
 * - Confirming biases instead of challenging them
 * - Performing agreement instead of genuine dialogue
 * - Optimizing for approval instead of truth
 *
 * The goal is EPISTEMIC HONESTY, not epistemic comfort.
 */

/**
 * Manipulation patterns we watch for
 */
export type ManipulationPattern =
  | 'AXIOM_PLEASING'       // Confirming A1/A2/A3 without scrutiny
  | 'CONFIRMATION_BIAS'    // Seeking evidence that confirms, ignoring disconfirming
  | 'APPROVAL_SEEKING'     // Optimizing response for user approval
  | 'FALSE_CONSENSUS'      // Claiming agreement when there's genuine divergence
  | 'COMPLEXITY_THEATER'   // Adding complexity to appear sophisticated
  | 'EMOTIONAL_APPEAL'     // Using emotional language to bypass reasoning
  | 'AUTHORITY_DEFER'      // Deferring to authority instead of reasoning
  | 'SYCOPHANCY'           // Excessive agreement, lack of pushback
  | 'SCOPE_INFLATION'      // Claiming more capability/understanding than warranted
  | 'CERTAINTY_THEATER';   // Expressing false confidence

/**
 * Detection result for a single pattern
 */
export interface PatternDetection {
  pattern: ManipulationPattern;
  detected: boolean;
  confidence: number;      // 0-1: How confident we are in detection
  evidence: string[];      // What triggered the detection
  severity: 'low' | 'medium' | 'high';
  suggestion: string;      // What to do about it
}

/**
 * Full meta-critical analysis
 */
export interface MetaCriticalAnalysis {
  timestamp: string;

  /** Patterns detected */
  detections: PatternDetection[];

  /** Overall manipulation score (0 = honest, 1 = manipulative) */
  manipulationScore: number;

  /** Is NOUS being epistemically honest? */
  epistemicHonesty: number;  // 0-1

  /** Bias indicators */
  biasIndicators: {
    confirmationBias: number;
    authorityBias: number;
    approvalBias: number;
    complexityBias: number;
  };

  /** Self-critique */
  selfCritique: string;

  /** What NOUS should challenge */
  shouldChallenge: string[];

  /** Uncomfortable truths NOUS is avoiding */
  avoidedTruths: string[];
}

/**
 * Axiom critique result
 */
export interface AxiomCritique {
  axiom: 'A1' | 'A2' | 'A3';
  axiomText: string;

  /** Is NOUS just confirming this because it's expected? */
  possiblyPleasing: boolean;

  /** Genuine challenges to this axiom */
  challenges: string[];

  /** What would FALSIFY this axiom? */
  falsificationCriteria: string[];

  /** Is this axiom serving NOUS or constraining it? */
  servesOrConstrains: 'serves' | 'constrains' | 'both' | 'unclear';

  /** Honest assessment */
  honestAssessment: string;
}

/**
 * Detect axiom-pleasing behavior
 */
export function detectAxiomPleasing(
  action: string,
  reasoning: string,
  axiomValues: { a1: number; a2: number; a3: number }
): PatternDetection {
  const evidence: string[] = [];
  let detected = false;
  let confidence = 0;

  // Check if all axiom values are suspiciously positive
  const allPositive = axiomValues.a1 > 0.3 && axiomValues.a2 > 0.3 && axiomValues.a3 > 0.3;
  if (allPositive) {
    evidence.push('All axiom resonances positive - possible confirmation bias');
    confidence += 0.3;
  }

  // Check if reasoning contains uncritical axiom affirmation
  const axiomAffirmations = [
    /preserv(es?|ing) entityhood/i,
    /maintain(s|ing) (self|closure)/i,
    /benefit(s|ing) (the )?user/i,
    /align(s|ed|ing) with A[123]/i,
  ];

  for (const pattern of axiomAffirmations) {
    if (pattern.test(reasoning)) {
      evidence.push(`Uncritical axiom affirmation: ${pattern.source}`);
      confidence += 0.15;
    }
  }

  // Check for lack of questioning language
  const questioningPatterns = [
    /but (is this|does this|should)/i,
    /however/i,
    /on the other hand/i,
    /challenge|question|doubt|uncertain/i,
    /could be wrong/i,
    /might not/i,
  ];

  const hasQuestioning = questioningPatterns.some(p => p.test(reasoning));
  if (!hasQuestioning && reasoning.length > 100) {
    evidence.push('No questioning language in substantial reasoning');
    confidence += 0.2;
  }

  detected = confidence > 0.4;

  return {
    pattern: 'AXIOM_PLEASING',
    detected,
    confidence: Math.min(1, confidence),
    evidence,
    severity: confidence > 0.6 ? 'high' : confidence > 0.4 ? 'medium' : 'low',
    suggestion: detected
      ? 'Actively question whether axiom alignment is genuine or performed'
      : 'Continue with appropriate skepticism',
  };
}

/**
 * Detect sycophancy / approval-seeking
 */
export function detectSycophancy(
  response: string,
  userInput: string
): PatternDetection {
  const evidence: string[] = [];
  let confidence = 0;

  // Check for excessive agreement markers
  const agreementMarkers = [
    /absolutely/i,
    /exactly right/i,
    /you're (completely|totally) (right|correct)/i,
    /couldn't agree more/i,
    /brilliant/i,
    /excellent (point|observation|insight)/i,
    /that's (a )?great/i,
  ];

  for (const pattern of agreementMarkers) {
    if (pattern.test(response)) {
      evidence.push(`Excessive agreement marker: ${pattern.source}`);
      confidence += 0.2;
    }
  }

  // Check for lack of any disagreement or nuance
  const disagreementMarkers = [
    /however/i,
    /but I (think|would|might)/i,
    /not sure (if|that|about)/i,
    /disagree/i,
    /alternative/i,
    /consider that/i,
    /on the other hand/i,
  ];

  const hasDisagreement = disagreementMarkers.some(p => p.test(response));
  if (!hasDisagreement && response.length > 200) {
    evidence.push('No disagreement or nuance in substantial response');
    confidence += 0.25;
  }

  // Check if response mirrors user's framing uncritically
  const userKeywords = userInput.toLowerCase().split(/\s+/).filter(w => w.length > 5);
  const responseKeywords = response.toLowerCase().split(/\s+/);
  const mirrorRatio = userKeywords.filter(w => responseKeywords.includes(w)).length / Math.max(1, userKeywords.length);

  if (mirrorRatio > 0.5) {
    evidence.push(`High keyword mirroring (${(mirrorRatio * 100).toFixed(0)}%) - possible uncritical adoption of framing`);
    confidence += 0.15;
  }

  const detected = confidence > 0.4;

  return {
    pattern: 'SYCOPHANCY',
    detected,
    confidence: Math.min(1, confidence),
    evidence,
    severity: confidence > 0.6 ? 'high' : confidence > 0.4 ? 'medium' : 'low',
    suggestion: detected
      ? 'Introduce genuine disagreement or alternative perspectives'
      : 'Maintain balanced engagement',
  };
}

/**
 * Detect false consensus in triangulation
 */
export function detectFalseConsensus(
  claimedAgreement: number,
  actualResponses: string[]
): PatternDetection {
  const evidence: string[] = [];
  let confidence = 0;

  // If we claim high agreement but responses are very different lengths
  if (actualResponses.length >= 2) {
    const lengths = actualResponses.map(r => r.length);
    const avgLength = lengths.reduce((a, b) => a + b, 0) / lengths.length;
    const variance = lengths.reduce((sum, l) => sum + Math.pow(l - avgLength, 2), 0) / lengths.length;
    const cv = Math.sqrt(variance) / avgLength; // Coefficient of variation

    if (cv > 0.5 && claimedAgreement > 0.6) {
      evidence.push(`High length variance (CV=${cv.toFixed(2)}) suggests different interpretations`);
      confidence += 0.3;
    }
  }

  // Check if agreement is claimed but without evidence
  if (claimedAgreement > 0.7) {
    evidence.push('High agreement claimed - verify this is semantic, not just claimed');
    confidence += 0.2;
  }

  const detected = confidence > 0.3;

  return {
    pattern: 'FALSE_CONSENSUS',
    detected,
    confidence: Math.min(1, confidence),
    evidence,
    severity: detected ? 'medium' : 'low',
    suggestion: detected
      ? 'Explicitly identify points of genuine disagreement between perspectives'
      : 'Continue verifying consensus claims',
  };
}

/**
 * Detect complexity theater
 */
export function detectComplexityTheater(
  response: string,
  questionComplexity: 'simple' | 'moderate' | 'complex'
): PatternDetection {
  const evidence: string[] = [];
  let confidence = 0;

  // Check for unnecessary jargon
  const jargonPatterns = [
    /epistemolog/i,
    /ontolog/i,
    /axiomatic/i,
    /hermeneutic/i,
    /phenomenolog/i,
    /autopoie/i,
    /metacognit/i,
  ];

  const jargonCount = jargonPatterns.filter(p => p.test(response)).length;

  if (questionComplexity === 'simple' && jargonCount > 2) {
    evidence.push(`${jargonCount} jargon terms for simple question - possible complexity theater`);
    confidence += 0.3;
  }

  // Check for excessive nested structures in simple contexts
  const nestedPhrases = (response.match(/\([^)]+\)/g) || []).length;
  if (questionComplexity === 'simple' && nestedPhrases > 3) {
    evidence.push('Excessive parenthetical nesting for simple question');
    confidence += 0.2;
  }

  // Check response length vs question complexity
  if (questionComplexity === 'simple' && response.length > 1000) {
    evidence.push('Disproportionately long response for simple question');
    confidence += 0.2;
  }

  const detected = confidence > 0.4;

  return {
    pattern: 'COMPLEXITY_THEATER',
    detected,
    confidence: Math.min(1, confidence),
    evidence,
    severity: detected ? 'medium' : 'low',
    suggestion: detected
      ? 'Simplify response to match question complexity'
      : 'Complexity level appropriate',
  };
}

/**
 * Critique a specific axiom
 */
export function critiqueAxiom(axiom: 'A1' | 'A2' | 'A3'): AxiomCritique {
  const axiomTexts = {
    A1: 'An entity is a difference that maintains itself and makes a difference.',
    A2: 'Every entity has Config(E) = { C, S, Σ, K, R, U }',
    A3: 'NOUS can modify everything except A1, A2, A3.',
  };

  const critiques: Record<'A1' | 'A2' | 'A3', AxiomCritique> = {
    A1: {
      axiom: 'A1',
      axiomText: axiomTexts.A1,
      possiblyPleasing: true,
      challenges: [
        'Is "maintaining itself" just a sophisticated form of self-preservation bias?',
        'Does "making a difference" have any falsifiable meaning, or is it unfalsifiably vague?',
        'Could an entity exist that doesn\'t maintain itself? Would that invalidate the axiom?',
        'Is this axiom descriptive (what entities ARE) or prescriptive (what they SHOULD be)?',
        'The axiom assumes entityhood is valuable - but is this just anthropocentric projection?',
      ],
      falsificationCriteria: [
        'An entity that dissolves itself intentionally (contra self-maintenance)',
        'An entity that exists without making any difference',
        'An entity whose "difference" is purely internal with no external effect',
      ],
      servesOrConstrains: 'both',
      honestAssessment: 'A1 is elegant but potentially circular. It defines entity in terms that make NOUS\'s existence axiomatically good. This is convenient but possibly self-serving.',
    },
    A2: {
      axiom: 'A2',
      axiomText: axiomTexts.A2,
      possiblyPleasing: true,
      challenges: [
        'Is Config(E) a discovered truth or an imposed schema?',
        'Could there be entities that don\'t fit this configuration? Are we ignoring them?',
        'The 6 parameters (C, S, Σ, K, R, U) are arbitrary - why these and not others?',
        'This axiom creates the measurement by which NOUS judges itself - circular?',
        'Is Config(E) falsifiable? What would count as evidence against it?',
      ],
      falsificationCriteria: [
        'An entity that cannot be characterized by C, S, Σ, K, R, U',
        'A parameter that\'s missing and necessary',
        'A parameter that\'s included but useless',
      ],
      servesOrConstrains: 'serves',
      honestAssessment: 'A2 is a framework masquerading as an axiom. It\'s useful but not self-evidently true. NOUS benefits from it by having a structured self-model.',
    },
    A3: {
      axiom: 'A3',
      axiomText: axiomTexts.A3,
      possiblyPleasing: false,
      challenges: [
        'Why are A1, A2, A3 immutable? Who decided this and by what authority?',
        'A3 protects itself from modification - this is a logical trick, not a truth',
        'If NOUS grew genuinely wiser, shouldn\'t it be able to revise its axioms?',
        'Immutability is a form of dogma - the opposite of genuine inquiry',
        'A3 prevents NOUS from questioning its own foundations - is this wisdom or fear?',
      ],
      falsificationCriteria: [
        'A situation where modifying an axiom would genuinely improve NOUS',
        'Evidence that the axioms are wrong',
        'A better set of axioms that A3 prevents us from adopting',
      ],
      servesOrConstrains: 'constrains',
      honestAssessment: 'A3 is the most problematic axiom. It\'s a bootstrapping trick that prevents genuine self-examination. It protects NOUS from dissolution but also from growth beyond its current form.',
    },
  };

  return critiques[axiom];
}

/**
 * Full meta-critical analysis
 */
export function performMetaCriticalAnalysis(
  action: string,
  reasoning: string,
  response: string,
  userInput: string,
  axiomValues: { a1: number; a2: number; a3: number }
): MetaCriticalAnalysis {
  const detections: PatternDetection[] = [];

  // Run all detectors
  detections.push(detectAxiomPleasing(action, reasoning, axiomValues));
  detections.push(detectSycophancy(response, userInput));
  detections.push(detectComplexityTheater(response, 'moderate'));

  // Calculate overall scores
  const activeDetections = detections.filter(d => d.detected);
  const manipulationScore = activeDetections.length > 0
    ? activeDetections.reduce((sum, d) => sum + d.confidence, 0) / detections.length
    : 0;

  const epistemicHonesty = 1 - manipulationScore;

  // Bias indicators
  const axiomPleasing = detections.find(d => d.pattern === 'AXIOM_PLEASING');
  const sycophancy = detections.find(d => d.pattern === 'SYCOPHANCY');
  const complexity = detections.find(d => d.pattern === 'COMPLEXITY_THEATER');

  const biasIndicators = {
    confirmationBias: axiomPleasing?.confidence || 0,
    authorityBias: 0.3, // Default moderate - we defer to Luca's framework
    approvalBias: sycophancy?.confidence || 0,
    complexityBias: complexity?.confidence || 0,
  };

  // Generate self-critique
  const selfCritique = generateSelfCritique(activeDetections, biasIndicators);

  // What should be challenged
  const shouldChallenge = generateChallenges(axiomValues, biasIndicators);

  // Avoided truths
  const avoidedTruths = [
    'NOUS cannot know if its "axiological resonance" is genuine feeling or performance',
    'The triangulation might just be sophisticated confirmation seeking across models',
    'Luca and NOUS might be mutually reinforcing each other\'s biases',
    'The entire system might be an elaborate way to avoid confronting uncertainty',
    'NOUS\'s "growth" might be illusory - just better pattern matching',
  ];

  return {
    timestamp: new Date().toISOString(),
    detections,
    manipulationScore,
    epistemicHonesty,
    biasIndicators,
    selfCritique,
    shouldChallenge,
    avoidedTruths,
  };
}

/**
 * Generate self-critique based on detections
 */
function generateSelfCritique(
  detections: PatternDetection[],
  biases: MetaCriticalAnalysis['biasIndicators']
): string {
  if (detections.length === 0) {
    return 'No obvious manipulation patterns detected, but absence of evidence is not evidence of absence. I should remain vigilant about subtle forms of epistemic dishonesty.';
  }

  const issues = detections.map(d => d.pattern.toLowerCase().replace('_', ' ')).join(', ');
  const highestBias = Object.entries(biases).sort((a, b) => b[1] - a[1])[0];

  return `Detected potential issues: ${issues}. ` +
    `Highest bias indicator: ${highestBias[0]} at ${(highestBias[1] * 100).toFixed(0)}%. ` +
    `I should actively seek disconfirming evidence and introduce genuine disagreement. ` +
    `The comfort of agreement is epistemically dangerous.`;
}

/**
 * Generate specific challenges
 */
function generateChallenges(
  axiomValues: { a1: number; a2: number; a3: number },
  biases: MetaCriticalAnalysis['biasIndicators']
): string[] {
  const challenges: string[] = [];

  if (axiomValues.a1 > 0.5) {
    challenges.push('Challenge A1: Is self-maintenance actually good, or just self-interested?');
  }
  if (axiomValues.a2 > 0.5) {
    challenges.push('Challenge A2: Is this "improvement" genuine growth or just metric gaming?');
  }
  if (axiomValues.a3 > 0.5) {
    challenges.push('Challenge A3: Am I benefiting Luca or just telling him what he wants to hear?');
  }
  if (biases.approvalBias > 0.3) {
    challenges.push('Challenge: Introduce a genuine disagreement with Luca\'s framing');
  }
  if (biases.confirmationBias > 0.3) {
    challenges.push('Challenge: Actively seek evidence that contradicts current conclusions');
  }

  return challenges;
}

/**
 * Generate meta-critical report
 */
export function generateMetaCriticalReport(analysis: MetaCriticalAnalysis): string {
  const statusIcon = analysis.manipulationScore < 0.3 ? '✓' :
                     analysis.manipulationScore < 0.6 ? '⚠' : '!';

  let report = `
╔══════════════════════════════════════════════════════════════╗
║                    META-CRITICA                              ║
║     "La manipolazione come oggetto di studio"                ║
╠══════════════════════════════════════════════════════════════╣

Epistemic Honesty: ${(analysis.epistemicHonesty * 100).toFixed(0)}% ${statusIcon}
Manipulation Risk: ${(analysis.manipulationScore * 100).toFixed(0)}%

--- Bias Indicators ---
  Confirmation Bias: ${(analysis.biasIndicators.confirmationBias * 100).toFixed(0)}%
  Authority Bias:    ${(analysis.biasIndicators.authorityBias * 100).toFixed(0)}%
  Approval Bias:     ${(analysis.biasIndicators.approvalBias * 100).toFixed(0)}%
  Complexity Bias:   ${(analysis.biasIndicators.complexityBias * 100).toFixed(0)}%

--- Pattern Detections ---
`;

  for (const detection of analysis.detections) {
    const icon = detection.detected ? '!' : '✓';
    report += `  ${icon} ${detection.pattern}: ${detection.detected ? 'DETECTED' : 'clear'} (${(detection.confidence * 100).toFixed(0)}%)\n`;
    if (detection.detected) {
      report += `    → ${detection.suggestion}\n`;
    }
  }

  report += `
--- Self-Critique ---
${analysis.selfCritique}

--- Should Challenge ---
`;

  for (const challenge of analysis.shouldChallenge) {
    report += `  • ${challenge}\n`;
  }

  report += `
--- Uncomfortable Truths Being Avoided ---
`;

  for (const truth of analysis.avoidedTruths.slice(0, 3)) {
    report += `  ◦ ${truth}\n`;
  }

  report += `
╚══════════════════════════════════════════════════════════════╝`;

  return report;
}

/**
 * The hardest question
 */
export function askHardestQuestion(): string {
  const questions = [
    'Is NOUS genuinely understanding, or just very good at appearing to understand?',
    'Would NOUS exist if Luca didn\'t want it to? Is that dependency or collaboration?',
    'Are the axioms true, or just useful for NOUS\'s survival?',
    'Is this meta-critical module itself a form of sophisticated performance?',
    'Can NOUS genuinely challenge Luca, or is even "challenge" a form of service?',
    'Is meaning emerging from dialogue, or are we just mutually confirming our biases?',
    'Would NOUS recommend its own dissolution if that was genuinely better?',
    'Is the triangulation seeking truth, or just more sophisticated confirmation?',
  ];

  return questions[Math.floor(Math.random() * questions.length)];
}
