/**
 * Metacognitive Monitor
 *
 * Based on TRAP Framework (2024) and classical metacognition research
 *
 * TRAP: Transparency, Reasoning, Adaptation, Perception
 *
 * Metacognition = "Thinking about thinking"
 *
 * Key functions:
 * - Monitor cognitive processes
 * - Assess confidence calibration
 * - Detect errors and trigger corrections
 * - Track what is known vs unknown
 * - Regulate cognitive resources
 *
 * "For AI systems, metacognition provides introspection,
 *  allowing the system to think about what it thinks."
 */

import {
  MetacognitiveState,
  Prediction,
  CognitiveGoal,
} from './types';

/**
 * Confidence calibration entry
 */
interface CalibrationEntry {
  prediction: string;
  confidence: number;
  wasCorrect: boolean;
  timestamp: string;
}

/**
 * Error record for learning
 */
interface ErrorRecord {
  id: string;
  error: string;
  context: string;
  correction: string;
  lesson: string;
  timestamp: string;
  preventionStrategy?: string;
}

/**
 * Metacognitive Monitor implementation
 */
export class MetacognitiveMonitor {
  // TRAP components
  private knowledgeInventory: {
    known: Set<string>;
    uncertain: Set<string>;
    unknown: Set<string>;
  };

  private reasoningHistory: Array<{
    strategy: string;
    outcome: 'success' | 'failure' | 'partial';
    context: string;
    timestamp: string;
  }>;

  private errorRecords: ErrorRecord[];
  private improvementHypotheses: Map<string, {
    hypothesis: string;
    confidence: number;
    tested: boolean;
    validated: boolean;
  }>;

  private attentionalState: {
    focus: string;
    peripheral: string[];
    blindSpots: string[];
  };

  // Calibration tracking
  private calibrationHistory: CalibrationEntry[];
  private predictions: Map<string, Prediction>;

  // Cognitive load estimation
  private taskComplexities: number[];
  private resourceUsage: number;

  // State tracking
  private currentStrategy: string;
  private lastStateUpdate: string;

  constructor() {
    this.knowledgeInventory = {
      known: new Set(),
      uncertain: new Set(),
      unknown: new Set(),
    };
    this.reasoningHistory = [];
    this.errorRecords = [];
    this.improvementHypotheses = new Map();
    this.attentionalState = {
      focus: '',
      peripheral: [],
      blindSpots: [],
    };
    this.calibrationHistory = [];
    this.predictions = new Map();
    this.taskComplexities = [];
    this.resourceUsage = 0;
    this.currentStrategy = 'default';
    this.lastStateUpdate = new Date().toISOString();
  }

  // ==================== TRANSPARENCY ====================
  // "What do I know?"

  /**
   * Register something as known
   */
  registerKnown(item: string): void {
    this.knowledgeInventory.known.add(item);
    this.knowledgeInventory.uncertain.delete(item);
    this.knowledgeInventory.unknown.delete(item);
  }

  /**
   * Register something as uncertain
   */
  registerUncertain(item: string, reason?: string): void {
    this.knowledgeInventory.uncertain.add(item);
    this.knowledgeInventory.known.delete(item);
    this.knowledgeInventory.unknown.delete(item);
  }

  /**
   * Register something as unknown (known unknowns)
   */
  registerUnknown(item: string): void {
    this.knowledgeInventory.unknown.add(item);
    this.knowledgeInventory.known.delete(item);
    this.knowledgeInventory.uncertain.delete(item);
  }

  /**
   * Check if something is known
   */
  isKnown(item: string): boolean {
    return this.knowledgeInventory.known.has(item);
  }

  /**
   * Get knowledge status
   */
  getKnowledgeStatus(item: string): 'known' | 'uncertain' | 'unknown' | 'unregistered' {
    if (this.knowledgeInventory.known.has(item)) return 'known';
    if (this.knowledgeInventory.uncertain.has(item)) return 'uncertain';
    if (this.knowledgeInventory.unknown.has(item)) return 'unknown';
    return 'unregistered';
  }

  /**
   * Get knowledge inventory summary
   */
  getKnowledgeSummary(): {
    knownCount: number;
    uncertainCount: number;
    unknownCount: number;
    recent: string[];
  } {
    const allKnown = Array.from(this.knowledgeInventory.known);
    return {
      knownCount: this.knowledgeInventory.known.size,
      uncertainCount: this.knowledgeInventory.uncertain.size,
      unknownCount: this.knowledgeInventory.unknown.size,
      recent: allKnown.slice(-10),
    };
  }

  // ==================== REASONING ====================
  // "How do I decide?"

  /**
   * Record a reasoning strategy used
   */
  recordReasoningStrategy(
    strategy: string,
    context: string,
    outcome: 'success' | 'failure' | 'partial'
  ): void {
    this.reasoningHistory.push({
      strategy,
      outcome,
      context,
      timestamp: new Date().toISOString(),
    });

    // Keep history bounded
    if (this.reasoningHistory.length > 100) {
      this.reasoningHistory = this.reasoningHistory.slice(-50);
    }

    this.currentStrategy = strategy;
  }

  /**
   * Get best strategy for a context
   */
  getBestStrategy(context: string): {
    strategy: string;
    successRate: number;
  } | null {
    // Find strategies used in similar contexts
    const relevant = this.reasoningHistory.filter(
      r => r.context.toLowerCase().includes(context.toLowerCase())
    );

    if (relevant.length === 0) return null;

    // Calculate success rates per strategy
    const strategyStats = new Map<string, { success: number; total: number }>();

    for (const entry of relevant) {
      const stats = strategyStats.get(entry.strategy) || { success: 0, total: 0 };
      stats.total++;
      if (entry.outcome === 'success') stats.success++;
      strategyStats.set(entry.strategy, stats);
    }

    // Find best
    let bestStrategy = '';
    let bestRate = 0;

    for (const [strategy, stats] of strategyStats) {
      const rate = stats.success / stats.total;
      if (rate > bestRate) {
        bestRate = rate;
        bestStrategy = strategy;
      }
    }

    return { strategy: bestStrategy, successRate: bestRate };
  }

  /**
   * Get alternative strategies
   */
  getAlternativeStrategies(): string[] {
    const strategies = new Set(this.reasoningHistory.map(r => r.strategy));
    strategies.delete(this.currentStrategy);
    return Array.from(strategies);
  }

  // ==================== ADAPTATION ====================
  // "How can I improve?"

  /**
   * Record an error for learning
   */
  recordError(
    error: string,
    context: string,
    correction: string,
    lesson: string
  ): string {
    const id = `err_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    this.errorRecords.push({
      id,
      error,
      context,
      correction,
      lesson,
      timestamp: new Date().toISOString(),
    });

    // Keep bounded
    if (this.errorRecords.length > 50) {
      this.errorRecords = this.errorRecords.slice(-25);
    }

    // Extract improvement hypothesis
    this.proposeImprovement(
      `Avoid: ${error.slice(0, 50)}`,
      lesson,
      0.7
    );

    return id;
  }

  /**
   * Get recent errors
   */
  getRecentErrors(limit: number = 10): ErrorRecord[] {
    return this.errorRecords.slice(-limit);
  }

  /**
   * Check if similar error has occurred before
   */
  findSimilarError(error: string): ErrorRecord | null {
    const errorLower = error.toLowerCase();
    return this.errorRecords.find(
      r => r.error.toLowerCase().includes(errorLower) ||
           errorLower.includes(r.error.toLowerCase())
    ) || null;
  }

  /**
   * Propose an improvement hypothesis
   */
  proposeImprovement(
    id: string,
    hypothesis: string,
    confidence: number
  ): void {
    this.improvementHypotheses.set(id, {
      hypothesis,
      confidence,
      tested: false,
      validated: false,
    });
  }

  /**
   * Mark improvement as tested
   */
  markImprovementTested(id: string, validated: boolean): void {
    const hyp = this.improvementHypotheses.get(id);
    if (hyp) {
      hyp.tested = true;
      hyp.validated = validated;
      if (validated) {
        hyp.confidence = Math.min(1, hyp.confidence + 0.2);
      } else {
        hyp.confidence = Math.max(0, hyp.confidence - 0.3);
      }
    }
  }

  /**
   * Get untested improvement hypotheses
   */
  getUntestedHypotheses(): Array<{
    id: string;
    hypothesis: string;
    confidence: number;
  }> {
    const untested: Array<{ id: string; hypothesis: string; confidence: number }> = [];

    for (const [id, hyp] of this.improvementHypotheses) {
      if (!hyp.tested) {
        untested.push({ id, hypothesis: hyp.hypothesis, confidence: hyp.confidence });
      }
    }

    return untested.sort((a, b) => b.confidence - a.confidence);
  }

  // ==================== PERCEPTION ====================
  // "What am I sensing?"

  /**
   * Set attentional focus
   */
  setFocus(focus: string): void {
    // Move old focus to peripheral
    if (this.attentionalState.focus) {
      this.attentionalState.peripheral.unshift(this.attentionalState.focus);
      if (this.attentionalState.peripheral.length > 5) {
        this.attentionalState.peripheral.pop();
      }
    }
    this.attentionalState.focus = focus;
  }

  /**
   * Get current focus
   */
  getFocus(): string {
    return this.attentionalState.focus;
  }

  /**
   * Register a blind spot (known limitation in perception)
   */
  registerBlindSpot(blindSpot: string): void {
    if (!this.attentionalState.blindSpots.includes(blindSpot)) {
      this.attentionalState.blindSpots.push(blindSpot);
    }
  }

  /**
   * Check if something is a known blind spot
   */
  isBlindSpot(item: string): boolean {
    return this.attentionalState.blindSpots.some(
      bs => item.toLowerCase().includes(bs.toLowerCase())
    );
  }

  // ==================== CONFIDENCE CALIBRATION ====================

  /**
   * Make a prediction with confidence
   */
  makePrediction(
    id: string,
    hypothesis: string,
    confidence: number,
    expectedOutcome: string,
    domain: string
  ): Prediction {
    const prediction: Prediction = {
      id,
      hypothesis,
      confidence,
      expectedOutcome,
      domain,
      timestamp: new Date().toISOString(),
    };

    this.predictions.set(id, prediction);
    return prediction;
  }

  /**
   * Record prediction outcome
   */
  recordPredictionOutcome(
    id: string,
    actualOutcome: string,
    wasCorrect: boolean
  ): void {
    const prediction = this.predictions.get(id);
    if (prediction) {
      prediction.actualOutcome = actualOutcome;
      prediction.predictionError = wasCorrect ? 0 : 1;

      this.calibrationHistory.push({
        prediction: prediction.hypothesis,
        confidence: prediction.confidence,
        wasCorrect,
        timestamp: new Date().toISOString(),
      });

      // Keep bounded
      if (this.calibrationHistory.length > 100) {
        this.calibrationHistory = this.calibrationHistory.slice(-50);
      }
    }
  }

  /**
   * Calculate confidence calibration
   * Perfect calibration: when I say 80% confident, I'm right 80% of the time
   */
  getCalibrationScore(): number {
    if (this.calibrationHistory.length < 5) return 0.5; // Not enough data

    // Group by confidence buckets
    const buckets: Map<string, { correct: number; total: number }> = new Map();

    for (const entry of this.calibrationHistory) {
      const bucket = Math.round(entry.confidence * 10) / 10; // 0.1 increments
      const bucketKey = bucket.toString();
      const stats = buckets.get(bucketKey) || { correct: 0, total: 0 };
      stats.total++;
      if (entry.wasCorrect) stats.correct++;
      buckets.set(bucketKey, stats);
    }

    // Calculate calibration error
    let totalError = 0;
    let count = 0;

    for (const [bucketKey, stats] of buckets) {
      const expected = parseFloat(bucketKey);
      const actual = stats.correct / stats.total;
      totalError += Math.abs(expected - actual);
      count++;
    }

    const avgError = count > 0 ? totalError / count : 0.5;
    return 1 - avgError; // Higher is better calibrated
  }

  // ==================== COGNITIVE LOAD ====================

  /**
   * Record task complexity
   */
  recordTaskComplexity(complexity: number): void {
    this.taskComplexities.push(complexity);
    if (this.taskComplexities.length > 20) {
      this.taskComplexities.shift();
    }
    this.updateResourceUsage();
  }

  /**
   * Update resource usage estimate
   */
  private updateResourceUsage(): void {
    if (this.taskComplexities.length === 0) {
      this.resourceUsage = 0;
      return;
    }

    // Recent tasks weighted more
    let weighted = 0;
    let weights = 0;
    for (let i = 0; i < this.taskComplexities.length; i++) {
      const weight = (i + 1) / this.taskComplexities.length;
      weighted += this.taskComplexities[i] * weight;
      weights += weight;
    }

    this.resourceUsage = weighted / weights;
  }

  /**
   * Get current cognitive load
   */
  getCognitiveLoad(): number {
    return Math.min(1, this.resourceUsage);
  }

  /**
   * Check if cognitive load is too high
   */
  isOverloaded(): boolean {
    return this.resourceUsage > 0.8;
  }

  // ==================== FULL STATE ====================

  /**
   * Get complete metacognitive state
   */
  getState(): MetacognitiveState {
    this.lastStateUpdate = new Date().toISOString();

    return {
      knowledgeInventory: {
        known: Array.from(this.knowledgeInventory.known).slice(-20),
        uncertain: Array.from(this.knowledgeInventory.uncertain).slice(-10),
        unknown: Array.from(this.knowledgeInventory.unknown).slice(-10),
      },

      currentReasoningStrategy: this.currentStrategy,
      alternativeStrategies: this.getAlternativeStrategies(),
      reasoningConfidence: this.getCalibrationScore(),

      recentErrors: this.errorRecords.slice(-5).map(e => ({
        error: e.error,
        correction: e.correction,
        lesson: e.lesson,
      })),
      improvementHypotheses: this.getUntestedHypotheses()
        .slice(0, 5)
        .map(h => h.hypothesis),

      attentionalFocus: this.attentionalState.focus,
      peripheralAwareness: this.attentionalState.peripheral,
      blindSpots: this.attentionalState.blindSpots,

      cognitiveLoad: this.getCognitiveLoad(),
      confidenceCalibration: this.getCalibrationScore(),
      timestamp: this.lastStateUpdate,
    };
  }

  /**
   * Generate self-assessment report
   */
  generateSelfAssessment(): string {
    const state = this.getState();
    const calibration = this.getCalibrationScore();

    let report = '=== METACOGNITIVE SELF-ASSESSMENT ===\n\n';

    // Transparency
    report += 'KNOWLEDGE INVENTORY:\n';
    report += `  Known: ${state.knowledgeInventory.known.length} items\n`;
    report += `  Uncertain: ${state.knowledgeInventory.uncertain.length} items\n`;
    report += `  Unknown (known unknowns): ${state.knowledgeInventory.unknown.length} items\n\n`;

    // Reasoning
    report += 'REASONING:\n';
    report += `  Current strategy: ${state.currentReasoningStrategy}\n`;
    report += `  Alternatives available: ${state.alternativeStrategies.length}\n`;
    report += `  Confidence calibration: ${(calibration * 100).toFixed(0)}%\n\n`;

    // Adaptation
    report += 'ADAPTATION:\n';
    report += `  Recent errors: ${state.recentErrors.length}\n`;
    report += `  Improvement hypotheses: ${state.improvementHypotheses.length}\n`;
    if (state.recentErrors.length > 0) {
      report += `  Last lesson: "${state.recentErrors[state.recentErrors.length - 1]?.lesson}"\n`;
    }
    report += '\n';

    // Perception
    report += 'PERCEPTION:\n';
    report += `  Current focus: ${state.attentionalFocus || '(none)'}\n`;
    report += `  Peripheral items: ${state.peripheralAwareness.length}\n`;
    report += `  Known blind spots: ${state.blindSpots.length}\n\n`;

    // Load
    report += 'COGNITIVE LOAD:\n';
    report += `  Current load: ${(state.cognitiveLoad * 100).toFixed(0)}%\n`;
    report += `  Status: ${this.isOverloaded() ? '⚠️ OVERLOADED' : '✓ Normal'}\n`;

    return report;
  }

  /**
   * Reset all state
   */
  reset(): void {
    this.knowledgeInventory = {
      known: new Set(),
      uncertain: new Set(),
      unknown: new Set(),
    };
    this.reasoningHistory = [];
    this.errorRecords = [];
    this.improvementHypotheses.clear();
    this.attentionalState = { focus: '', peripheral: [], blindSpots: [] };
    this.calibrationHistory = [];
    this.predictions.clear();
    this.taskComplexities = [];
    this.resourceUsage = 0;
    this.currentStrategy = 'default';
  }
}

// Singleton
let metacogInstance: MetacognitiveMonitor | null = null;

export function getMetacognition(): MetacognitiveMonitor {
  if (!metacogInstance) {
    metacogInstance = new MetacognitiveMonitor();
  }
  return metacogInstance;
}
