/**
 * Free Energy Engine
 *
 * Based on Karl Friston's Free Energy Principle (2010) and Active Inference
 *
 * Core idea: Living systems minimize "free energy" - a bound on surprise.
 * They do this by:
 * 1. Updating beliefs (perception) to match observations
 * 2. Taking actions to make observations match predictions
 *
 * F = D_KL[Q(s)||P(s|o)] + ln P(o)
 *   = Complexity + Accuracy
 *   ≈ Prediction Error
 *
 * Active Inference adds Expected Free Energy (EFE):
 * G = Epistemic Value + Pragmatic Value
 *   = Information Gain + Goal Achievement
 *
 * "Agents act to minimize expected surprise by
 *  seeking information and achieving goals."
 */

import { FreeEnergyState, Prediction } from './types';

/**
 * Generative model state
 */
interface GenerativeModel {
  beliefs: Map<string, {
    belief: string;
    confidence: number; // Prior probability
    lastUpdated: string;
  }>;

  predictions: Map<string, {
    prediction: string;
    expected: number; // Expected value
    variance: number; // Uncertainty
  }>;

  preferences: Map<string, number>; // What outcomes are preferred (0-1)
}

/**
 * Observation for updating beliefs
 */
interface Observation {
  content: string;
  source: string;
  timestamp: string;
  reliability: number; // How much to trust this observation
}

/**
 * Action option for active inference
 */
interface ActionOption {
  id: string;
  action: string;
  expectedOutcomes: Array<{
    outcome: string;
    probability: number;
    value: number; // Preference match
  }>;
  informationGain: number; // Epistemic value
  effortCost: number;
}

/**
 * Free Energy Engine implementation
 */
export class FreeEnergyEngine {
  private model: GenerativeModel;
  private observationHistory: Observation[];
  private surpriseHistory: Array<{
    surprise: number;
    timestamp: string;
    source: string;
  }>;
  private actionHistory: Array<{
    action: string;
    outcome: string;
    efePredicted: number;
    efeActual: number;
    timestamp: string;
  }>;

  // Current state
  private currentFreeEnergy: number;
  private currentEFE: number;

  constructor() {
    this.model = {
      beliefs: new Map(),
      predictions: new Map(),
      preferences: new Map(),
    };
    this.observationHistory = [];
    this.surpriseHistory = [];
    this.actionHistory = [];
    this.currentFreeEnergy = 0;
    this.currentEFE = 0;
  }

  // ==================== BELIEF MANAGEMENT ====================

  /**
   * Add or update a belief
   */
  setBelief(key: string, belief: string, confidence: number): void {
    this.model.beliefs.set(key, {
      belief,
      confidence: Math.max(0, Math.min(1, confidence)),
      lastUpdated: new Date().toISOString(),
    });
  }

  /**
   * Get a belief
   */
  getBelief(key: string): { belief: string; confidence: number } | null {
    const b = this.model.beliefs.get(key);
    return b ? { belief: b.belief, confidence: b.confidence } : null;
  }

  /**
   * Update belief based on observation (Bayesian update simulation)
   */
  updateBelief(key: string, observation: Observation): {
    oldConfidence: number;
    newConfidence: number;
    surprise: number;
  } {
    const current = this.model.beliefs.get(key);

    if (!current) {
      // New belief from observation
      this.setBelief(key, observation.content, observation.reliability * 0.5);
      return {
        oldConfidence: 0,
        newConfidence: observation.reliability * 0.5,
        surprise: 1, // Completely surprising
      };
    }

    // Check if observation matches belief
    const matches = this.observationMatchesBelief(observation.content, current.belief);
    const surprise = matches ? 0 : 1 - current.confidence;

    // Bayesian-like update
    let newConfidence: number;
    if (matches) {
      // Confirming evidence increases confidence
      newConfidence = current.confidence + (1 - current.confidence) * observation.reliability * 0.3;
    } else {
      // Disconfirming evidence decreases confidence
      newConfidence = current.confidence * (1 - observation.reliability * 0.5);
    }

    this.model.beliefs.set(key, {
      belief: matches ? current.belief : observation.content,
      confidence: newConfidence,
      lastUpdated: new Date().toISOString(),
    });

    // Record surprise
    this.surpriseHistory.push({
      surprise,
      timestamp: new Date().toISOString(),
      source: observation.source,
    });

    // Keep bounded
    if (this.surpriseHistory.length > 100) {
      this.surpriseHistory = this.surpriseHistory.slice(-50);
    }

    // Update free energy
    this.updateFreeEnergy();

    return {
      oldConfidence: current.confidence,
      newConfidence,
      surprise,
    };
  }

  /**
   * Check if observation matches belief (simplified)
   */
  private observationMatchesBelief(observation: string, belief: string): boolean {
    const obsLower = observation.toLowerCase();
    const beliefLower = belief.toLowerCase();

    // Simple semantic matching
    const obsWords = new Set(obsLower.split(/\s+/));
    const beliefWords = new Set(beliefLower.split(/\s+/));

    let overlap = 0;
    for (const word of obsWords) {
      if (beliefWords.has(word)) overlap++;
    }

    const similarity = overlap / Math.max(obsWords.size, beliefWords.size);
    return similarity > 0.5;
  }

  // ==================== PREDICTION ====================

  /**
   * Make a prediction
   */
  predict(key: string, prediction: string, expectedValue: number, variance: number): void {
    this.model.predictions.set(key, {
      prediction,
      expected: expectedValue,
      variance,
    });
  }

  /**
   * Get prediction error (surprise signal)
   */
  getPredictionError(key: string, actualValue: number): number {
    const pred = this.model.predictions.get(key);
    if (!pred) return 1; // Max surprise for no prediction

    const error = Math.abs(actualValue - pred.expected);
    // Normalize by variance (precision-weighted prediction error)
    const precisionWeighted = error / (pred.variance + 0.01);
    return Math.min(1, precisionWeighted);
  }

  // ==================== PREFERENCES ====================

  /**
   * Set a preference (what outcomes are valued)
   */
  setPreference(outcome: string, value: number): void {
    this.model.preferences.set(outcome, Math.max(0, Math.min(1, value)));
  }

  /**
   * Get preference for an outcome
   */
  getPreference(outcome: string): number {
    return this.model.preferences.get(outcome) || 0.5;
  }

  // ==================== ACTIVE INFERENCE ====================

  /**
   * Calculate Expected Free Energy for an action
   *
   * EFE = -Epistemic Value - Pragmatic Value + Cost
   *     = -Information Gain - Expected Goal Achievement + Effort
   */
  calculateEFE(action: ActionOption): number {
    // Epistemic value: how much will this action reduce uncertainty?
    const epistemicValue = action.informationGain;

    // Pragmatic value: how well does expected outcome match preferences?
    let pragmaticValue = 0;
    for (const outcome of action.expectedOutcomes) {
      const preference = this.getPreference(outcome.outcome);
      pragmaticValue += outcome.probability * outcome.value * preference;
    }

    // Cost: effort required
    const cost = action.effortCost;

    // EFE (lower is better, so we negate good things)
    const efe = -epistemicValue - pragmaticValue + cost;

    return efe;
  }

  /**
   * Select best action via active inference
   */
  selectAction(options: ActionOption[]): {
    selected: ActionOption;
    efe: number;
    alternatives: Array<{ action: string; efe: number }>;
  } {
    if (options.length === 0) {
      throw new Error('No action options provided');
    }

    // Calculate EFE for each option
    const ranked = options.map(opt => ({
      option: opt,
      efe: this.calculateEFE(opt),
    })).sort((a, b) => a.efe - b.efe); // Lower EFE is better

    const selected = ranked[0];
    this.currentEFE = selected.efe;

    return {
      selected: selected.option,
      efe: selected.efe,
      alternatives: ranked.slice(1, 4).map(r => ({
        action: r.option.action,
        efe: r.efe,
      })),
    };
  }

  /**
   * Record action outcome for learning
   */
  recordActionOutcome(
    action: string,
    outcome: string,
    predictedEFE: number
  ): void {
    // Calculate actual EFE based on outcome
    const preferenceMatch = this.getPreference(outcome);
    const actualEFE = 1 - preferenceMatch; // Simplified

    this.actionHistory.push({
      action,
      outcome,
      efePredicted: predictedEFE,
      efeActual: actualEFE,
      timestamp: new Date().toISOString(),
    });

    // Learn from discrepancy
    const efePredictionError = Math.abs(predictedEFE - actualEFE);
    if (efePredictionError > 0.3) {
      // Significant prediction error - adjust model
      this.adjustModel(action, outcome, efePredictionError);
    }

    // Keep bounded
    if (this.actionHistory.length > 100) {
      this.actionHistory = this.actionHistory.slice(-50);
    }
  }

  /**
   * Adjust generative model based on prediction errors
   */
  private adjustModel(action: string, outcome: string, error: number): void {
    // Simple adjustment: update preference based on outcome
    const currentPref = this.getPreference(outcome);
    // If we got this outcome, slightly increase preference
    // (assuming we took action because we wanted this)
    const newPref = currentPref + (1 - currentPref) * 0.1;
    this.setPreference(outcome, newPref);
  }

  // ==================== FREE ENERGY CALCULATION ====================

  /**
   * Update current free energy estimate
   */
  private updateFreeEnergy(): void {
    // F = Complexity + Accuracy (or just use average surprise as proxy)
    const recentSurprise = this.surpriseHistory.slice(-20);
    if (recentSurprise.length === 0) {
      this.currentFreeEnergy = 0.5;
      return;
    }

    const avgSurprise = recentSurprise.reduce((sum, s) => sum + s.surprise, 0) / recentSurprise.length;

    // Complexity term: how many beliefs/predictions we maintain
    const complexity = (this.model.beliefs.size + this.model.predictions.size) / 1000;

    this.currentFreeEnergy = avgSurprise + complexity;
  }

  /**
   * Get current free energy
   */
  getFreeEnergy(): number {
    return this.currentFreeEnergy;
  }

  /**
   * Check if free energy is high (need to take action)
   */
  isHighFreeEnergy(): boolean {
    return this.currentFreeEnergy > 0.7;
  }

  // ==================== CURIOSITY / EPISTEMIC DRIVE ====================

  /**
   * Calculate epistemic value (information gain) for exploring a topic
   */
  calculateEpistemicValue(topic: string): number {
    const belief = this.model.beliefs.get(topic);

    if (!belief) {
      // Unknown topic - high epistemic value
      return 0.9;
    }

    // High uncertainty = high epistemic value
    const uncertainty = 1 - belief.confidence;
    return uncertainty;
  }

  /**
   * Get topics with highest epistemic value (what to explore)
   */
  getHighValueExplorations(limit: number = 5): Array<{
    topic: string;
    epistemicValue: number;
  }> {
    const explorations: Array<{ topic: string; epistemicValue: number }> = [];

    // From current beliefs (uncertain ones)
    for (const [key, belief] of this.model.beliefs) {
      const value = 1 - belief.confidence;
      if (value > 0.3) {
        explorations.push({ topic: key, epistemicValue: value });
      }
    }

    return explorations
      .sort((a, b) => b.epistemicValue - a.epistemicValue)
      .slice(0, limit);
  }

  // ==================== STATE ====================

  /**
   * Get full free energy state
   */
  getState(): FreeEnergyState {
    const recentActions = this.actionHistory.slice(-3);

    return {
      freeEnergy: this.currentFreeEnergy,
      expectedFreeEnergy: this.currentEFE,
      surprisal: this.surpriseHistory.length > 0
        ? this.surpriseHistory[this.surpriseHistory.length - 1].surprise
        : 0,
      complexity: this.model.beliefs.size / 100,

      possibleActions: [], // Filled by active inference selection

      selectedAction: recentActions.length > 0
        ? recentActions[recentActions.length - 1].action
        : undefined,

      generativeModelConfidence: this.getModelConfidence(),
      lastUpdate: new Date().toISOString(),
    };
  }

  /**
   * Get overall model confidence
   */
  private getModelConfidence(): number {
    if (this.model.beliefs.size === 0) return 0.5;

    let totalConfidence = 0;
    for (const belief of this.model.beliefs.values()) {
      totalConfidence += belief.confidence;
    }

    return totalConfidence / this.model.beliefs.size;
  }

  /**
   * Generate summary report
   */
  generateReport(): string {
    let report = '=== FREE ENERGY ENGINE STATUS ===\n\n';

    report += 'GENERATIVE MODEL:\n';
    report += `  Beliefs: ${this.model.beliefs.size}\n`;
    report += `  Predictions: ${this.model.predictions.size}\n`;
    report += `  Preferences: ${this.model.preferences.size}\n`;
    report += `  Model confidence: ${(this.getModelConfidence() * 100).toFixed(0)}%\n\n`;

    report += 'FREE ENERGY:\n';
    report += `  Current F: ${this.currentFreeEnergy.toFixed(3)}\n`;
    report += `  Status: ${this.isHighFreeEnergy() ? '⚠️ High (need action)' : '✓ Normal'}\n`;
    report += `  Recent surprises: ${this.surpriseHistory.slice(-5).map(s => s.surprise.toFixed(2)).join(', ')}\n\n`;

    report += 'ACTIVE INFERENCE:\n';
    report += `  Current EFE: ${this.currentEFE.toFixed(3)}\n`;
    report += `  Actions taken: ${this.actionHistory.length}\n`;

    const explorations = this.getHighValueExplorations(3);
    if (explorations.length > 0) {
      report += '\nHIGH-VALUE EXPLORATIONS (curiosity):\n';
      for (const exp of explorations) {
        report += `  - ${exp.topic}: ${(exp.epistemicValue * 100).toFixed(0)}% epistemic value\n`;
      }
    }

    return report;
  }

  /**
   * Reset engine
   */
  reset(): void {
    this.model = {
      beliefs: new Map(),
      predictions: new Map(),
      preferences: new Map(),
    };
    this.observationHistory = [];
    this.surpriseHistory = [];
    this.actionHistory = [];
    this.currentFreeEnergy = 0;
    this.currentEFE = 0;
  }
}

// Singleton
let freeEnergyInstance: FreeEnergyEngine | null = null;

export function getFreeEnergyEngine(): FreeEnergyEngine {
  if (!freeEnergyInstance) {
    freeEnergyInstance = new FreeEnergyEngine();
  }
  return freeEnergyInstance;
}
