/**
 * NOUS Cognitive Architecture - Unified Interface
 *
 * This module integrates all cognitive subsystems into a coherent whole:
 *
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │                    NOUS COGNITIVE ARCHITECTURE                       │
 * ├─────────────────────────────────────────────────────────────────────┤
 * │                                                                     │
 * │  ┌─────────────────────────────────────────────────────────────┐   │
 * │  │              GLOBAL WORKSPACE (GWT)                          │   │
 * │  │     Central hub for conscious processing and broadcasting    │   │
 * │  └──────────────────────────┬──────────────────────────────────┘   │
 * │                             │                                       │
 * │  ┌──────────────────────────┼──────────────────────────────────┐   │
 * │  │        COMPLEMENTARY LEARNING SYSTEMS                        │   │
 * │  │   Hippocampal (fast, episodic) ◄──► Neocortical (slow, sem)  │   │
 * │  └──────────────────────────┬──────────────────────────────────┘   │
 * │                             │                                       │
 * │  ┌──────────┬───────────────┼───────────────┬──────────────────┐   │
 * │  │          │               │               │                  │   │
 * │  ▼          ▼               ▼               ▼                  ▼   │
 * │  METACOG   FREE ENERGY   SCIENTIFIC      SELF-MODEL           │   │
 * │  MONITOR   ENGINE        KNOWLEDGE       (Autopoietic)        │   │
 * │  (TRAP)    (Friston)     BASE            Core                 │   │
 * │                                                                     │
 * └─────────────────────────────────────────────────────────────────────┘
 *
 * Scientific Foundations:
 * - Global Workspace Theory (Baars, 1988)
 * - Free Energy Principle (Friston, 2010)
 * - Complementary Learning Systems (McClelland et al., 1995)
 * - Metacognition TRAP Framework (2024)
 * - Autopoiesis (Maturana & Varela, 1972)
 */

// Export types
export * from './types';

// Export individual systems
export { GlobalWorkspace, getGlobalWorkspace } from './global_workspace';
export { ComplementaryLearningSystem, getCLS } from './complementary_learning';
export { MetacognitiveMonitor, getMetacognition } from './metacognition';
export { FreeEnergyEngine, getFreeEnergyEngine } from './free_energy';
export { ScientificKnowledgeBase, getScientificKB } from './scientific_knowledge';
export { SelfModelManager, getSelfModel } from './self_model';

// Import for unified system
import { GlobalWorkspace, getGlobalWorkspace } from './global_workspace';
import { ComplementaryLearningSystem, getCLS } from './complementary_learning';
import { MetacognitiveMonitor, getMetacognition } from './metacognition';
import { FreeEnergyEngine, getFreeEnergyEngine } from './free_energy';
import { ScientificKnowledgeBase, getScientificKB } from './scientific_knowledge';
import { SelfModelManager, getSelfModel } from './self_model';
import { WorkspaceItem, EpisodicMemory, MetacognitiveState, FreeEnergyState, SelfModel } from './types';

/**
 * Unified Cognitive State
 */
export interface CognitiveState {
  // Global Workspace
  workspace: {
    items: WorkspaceItem[];
    focus: string | null;
    activeGoals: number;
  };

  // Memory
  memory: {
    recentEpisodes: number;
    unconsolidated: number;
    semanticConcepts: number;
  };

  // Metacognition
  metacognition: MetacognitiveState;

  // Free Energy
  freeEnergy: FreeEnergyState;

  // Self-Model
  selfModel: {
    health: number;
    capabilities: number;
    limitations: number;
    growthTrend: 'improving' | 'stable' | 'declining';
  };

  // Scientific Knowledge
  scientificKnowledge: {
    concepts: number;
    hypotheses: number;
    frontiers: number;
  };

  // Timestamp
  timestamp: string;
}

/**
 * Unified Cognitive System
 *
 * Integrates all cognitive subsystems and provides a coherent interface.
 */
export class CognitiveSystem {
  private workspace: GlobalWorkspace;
  private cls: ComplementaryLearningSystem;
  private metacog: MetacognitiveMonitor;
  private freeEnergy: FreeEnergyEngine;
  private scientific: ScientificKnowledgeBase;
  private selfModel: SelfModelManager;

  private initialized: boolean = false;

  constructor() {
    this.workspace = getGlobalWorkspace();
    this.cls = getCLS();
    this.metacog = getMetacognition();
    this.freeEnergy = getFreeEnergyEngine();
    this.scientific = getScientificKB();
    this.selfModel = getSelfModel();
  }

  /**
   * Initialize all subsystems
   */
  initialize(): void {
    if (this.initialized) return;

    // Set initial beliefs from self-model
    const identity = this.selfModel.getIdentity();
    this.freeEnergy.setBelief('identity', `I am ${identity.name}`, 1.0);
    this.freeEnergy.setBelief('purpose', identity.primaryPurpose, 0.95);

    // Set preferences
    this.freeEnergy.setPreference('understanding', 0.9);
    this.freeEnergy.setPreference('improvement', 0.85);
    this.freeEnergy.setPreference('accuracy', 0.8);
    this.freeEnergy.setPreference('efficiency', 0.7);

    // Register initial metacognitive knowledge
    for (const cap of this.selfModel.getCapabilities()) {
      if (cap.proficiency > 0.7) {
        this.metacog.registerKnown(`capability:${cap.name}`);
      } else if (cap.proficiency > 0.4) {
        this.metacog.registerUncertain(`capability:${cap.name}`);
      }
    }

    // Record health check
    this.selfModel.recordHealthCheck('cognitive_system', 'healthy', 'Initialized successfully');

    this.initialized = true;
  }

  // ==================== EXPERIENCE PROCESSING ====================

  /**
   * Process an experience through the cognitive system
   *
   * This is the main entry point for new information/events
   */
  async processExperience(
    event: string,
    context: {
      emotional?: string;
      social?: string;
      outcome?: string;
      significance?: number;
    } = {}
  ): Promise<{
    episodeId: string;
    workspaceUpdated: boolean;
    insightsGenerated: string[];
    freeEnergyDelta: number;
  }> {
    // 1. Encode in episodic memory (hippocampal buffer)
    const episode = this.cls.encodeEpisode({
      event,
      context: {
        temporal: new Date().toISOString(),
        emotional: context.emotional,
        social: context.social,
      },
      participants: [],
      outcome: context.outcome || 'ongoing',
      significance: context.significance || 0.5,
    });

    // 2. Submit to global workspace for potential broadcast
    const workspaceId = this.workspace.submit({
      type: 'observation',
      content: event,
      source: 'experience_processor',
      priority: context.significance || 0.5,
      ttl: 60000, // 1 minute
    });

    // 3. Update metacognitive focus
    this.metacog.setFocus(event.slice(0, 50));

    // 4. Update free energy (observation)
    const oldFE = this.freeEnergy.getFreeEnergy();
    this.freeEnergy.updateBelief('current_situation', {
      content: event,
      source: 'experience',
      timestamp: new Date().toISOString(),
      reliability: 0.8,
    });
    const newFE = this.freeEnergy.getFreeEnergy();

    // 5. Extract any immediate insights
    const insights: string[] = [];
    if (context.significance && context.significance > 0.7) {
      insights.push(`High-significance event: ${event.slice(0, 50)}`);
      this.metacog.registerKnown(`event:${event.slice(0, 30)}`);
    }

    // 6. Record cognitive load
    this.metacog.recordTaskComplexity(context.significance || 0.5);

    return {
      episodeId: episode.id,
      workspaceUpdated: true,
      insightsGenerated: insights,
      freeEnergyDelta: newFE - oldFE,
    };
  }

  /**
   * Record an action and its outcome
   */
  recordAction(
    action: string,
    outcome: string,
    success: boolean
  ): void {
    // Update capability tracking
    const capability = this.inferCapabilityFromAction(action);
    if (capability) {
      this.selfModel.recordCapabilityUse(capability, success);
    }

    // Update free energy with outcome
    this.freeEnergy.recordActionOutcome(action, outcome, success ? 0.2 : 0.8);

    // Record error if failed
    if (!success) {
      this.metacog.recordError(
        `Action failed: ${action}`,
        outcome,
        'Retry or modify approach',
        `Check preconditions before ${action}`
      );
    }

    // Encode experience
    this.cls.encodeEpisode({
      event: `Action: ${action}`,
      context: { temporal: new Date().toISOString() },
      participants: [],
      outcome,
      significance: success ? 0.4 : 0.7, // Failures are more significant for learning
    });
  }

  /**
   * Infer capability from action
   */
  private inferCapabilityFromAction(action: string): string | null {
    const actionLower = action.toLowerCase();
    if (actionLower.includes('read') || actionLower.includes('write') || actionLower.includes('file')) {
      return 'file_operations';
    }
    if (actionLower.includes('search') || actionLower.includes('web')) {
      return 'web_search';
    }
    if (actionLower.includes('git') || actionLower.includes('commit')) {
      return 'git_operations';
    }
    if (actionLower.includes('think') || actionLower.includes('reason') || actionLower.includes('analyze')) {
      return 'reasoning';
    }
    return null;
  }

  // ==================== DECISION MAKING ====================

  /**
   * Make a decision using active inference
   */
  async makeDecision(
    options: Array<{
      action: string;
      expectedOutcomes: Array<{ outcome: string; probability: number }>;
      effortCost: number;
    }>
  ): Promise<{
    selectedAction: string;
    reasoning: string;
    confidence: number;
    alternatives: string[];
  }> {
    // Convert to FreeEnergyEngine format
    const actionOptions = options.map((opt, i) => ({
      id: `opt_${i}`,
      action: opt.action,
      expectedOutcomes: opt.expectedOutcomes.map(eo => ({
        ...eo,
        value: this.freeEnergy.getPreference(eo.outcome),
      })),
      informationGain: this.freeEnergy.calculateEpistemicValue(opt.action),
      effortCost: opt.effortCost,
    }));

    // Use active inference
    const decision = this.freeEnergy.selectAction(actionOptions);

    // Update metacognition
    this.metacog.recordReasoningStrategy('active_inference', 'decision_making', 'success');

    // Make prediction for later validation
    const predId = `pred_${Date.now()}`;
    this.freeEnergy.predict(
      predId,
      decision.selected.action,
      1 - decision.efe, // Higher EFE = lower expected value
      0.2
    );

    return {
      selectedAction: decision.selected.action,
      reasoning: `Selected based on Expected Free Energy minimization. EFE: ${decision.efe.toFixed(3)}`,
      confidence: 1 - Math.abs(decision.efe),
      alternatives: decision.alternatives.map(a => a.action),
    };
  }

  // ==================== SELF-IMPROVEMENT ====================

  /**
   * Generate improvement suggestions based on scientific knowledge
   */
  async generateImprovementSuggestions(): Promise<Array<{
    suggestion: string;
    scientificBasis: string;
    expectedBenefit: string;
    priority: number;
  }>> {
    const suggestions: Array<{
      suggestion: string;
      scientificBasis: string;
      expectedBenefit: string;
      priority: number;
    }> = [];

    // Check declining capabilities
    const weakCaps = this.selfModel.getWeakestCapabilities(3);
    for (const cap of weakCaps) {
      if (cap.proficiency < 0.6) {
        const relatedKnowledge = this.scientific.getApplicableTo(cap.name);
        if (relatedKnowledge.length > 0) {
          suggestions.push({
            suggestion: `Improve ${cap.name} capability`,
            scientificBasis: relatedKnowledge[0].concept,
            expectedBenefit: `Increase proficiency from ${(cap.proficiency * 100).toFixed(0)}% to ${((cap.proficiency + 0.2) * 100).toFixed(0)}%`,
            priority: 0.8 - cap.proficiency,
          });
        }
      }
    }

    // Check metacognitive issues
    const untestedHypotheses = this.metacog.getUntestedHypotheses();
    for (const hyp of untestedHypotheses.slice(0, 2)) {
      suggestions.push({
        suggestion: `Test hypothesis: ${hyp.hypothesis}`,
        scientificBasis: 'Metacognitive improvement',
        expectedBenefit: 'Validate or reject improvement approach',
        priority: hyp.confidence,
      });
    }

    // Check high epistemic value explorations
    const explorations = this.freeEnergy.getHighValueExplorations(2);
    for (const exp of explorations) {
      suggestions.push({
        suggestion: `Explore: ${exp.topic}`,
        scientificBasis: 'Free Energy Principle - epistemic drive',
        expectedBenefit: 'Reduce uncertainty and improve model',
        priority: exp.epistemicValue * 0.7,
      });
    }

    // Sort by priority
    return suggestions.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Run memory consolidation (should be called during idle periods)
   */
  async runConsolidation(): Promise<{
    episodesConsolidated: number;
    conceptsLearned: number;
    decayedMemories: number;
  }> {
    // Run CLS consolidation
    const consolidation = await this.cls.consolidate();

    // Apply decay
    const decayed = this.cls.applyDecay();

    // Update self-model
    const clsStats = this.cls.getStats();
    this.selfModel.recordGrowth('memory_entries', clsStats.episodicCount + clsStats.semanticCount);

    return {
      episodesConsolidated: consolidation.episodesProcessed,
      conceptsLearned: consolidation.conceptsCreated,
      decayedMemories: decayed,
    };
  }

  // ==================== STATE ACCESS ====================

  /**
   * Get unified cognitive state
   */
  getState(): CognitiveState {
    const wsState = this.workspace.getState();
    const clsStats = this.cls.getStats();
    const metacogState = this.metacog.getState();
    const feState = this.freeEnergy.getState();
    const selfCheck = this.selfModel.runSelfCheck();
    const sciStats = this.scientific.getStats();

    // Determine overall growth trend
    const improving = this.selfModel.getImprovingMetrics();
    const declining = this.selfModel.getDecliningMetrics();
    const growthTrend: 'improving' | 'stable' | 'declining' =
      improving.length > declining.length ? 'improving' :
      declining.length > improving.length ? 'declining' : 'stable';

    return {
      workspace: {
        items: this.workspace.getWorkspaceContents(),
        focus: wsState.currentFocus,
        activeGoals: wsState.activeGoals,
      },
      memory: {
        recentEpisodes: clsStats.episodicCount,
        unconsolidated: clsStats.episodicUnconsolidated,
        semanticConcepts: clsStats.semanticCount,
      },
      metacognition: metacogState,
      freeEnergy: feState,
      selfModel: {
        health: selfCheck.health,
        capabilities: this.selfModel.getCapabilities().length,
        limitations: this.selfModel.getLimitations().length,
        growthTrend,
      },
      scientificKnowledge: {
        concepts: sciStats.knowledgeCount,
        hypotheses: sciStats.hypothesesTotal,
        frontiers: sciStats.frontiersTracked,
      },
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Generate comprehensive status report
   */
  generateStatusReport(): string {
    let report = '';
    report += '╔══════════════════════════════════════════════════════════════════════╗\n';
    report += '║              NOUS COGNITIVE ARCHITECTURE STATUS                       ║\n';
    report += '╚══════════════════════════════════════════════════════════════════════╝\n\n';

    // Self-Model Report
    report += this.selfModel.generateSelfReport();
    report += '\n';

    // Metacognition Report
    report += this.metacog.generateSelfAssessment();
    report += '\n';

    // Free Energy Report
    report += this.freeEnergy.generateReport();
    report += '\n';

    // Memory Stats
    const clsStats = this.cls.getStats();
    report += '=== MEMORY SYSTEMS ===\n\n';
    report += `Hippocampal Buffer: ${clsStats.episodicCount} episodes (${clsStats.episodicUnconsolidated} unconsolidated)\n`;
    report += `Neocortical Store: ${clsStats.semanticCount} concepts\n`;
    report += `Consolidations Run: ${clsStats.consolidationsRun}\n`;
    if (clsStats.lastConsolidation) {
      report += `Last Consolidation: ${clsStats.lastConsolidation}\n`;
    }
    report += '\n';

    // Scientific Knowledge Stats
    const sciStats = this.scientific.getStats();
    report += '=== SCIENTIFIC KNOWLEDGE ===\n\n';
    report += `Total Concepts: ${sciStats.knowledgeCount}\n`;
    report += `Improvement Hypotheses: ${sciStats.hypothesesTotal} (${sciStats.hypothesesProposed} proposed, ${sciStats.hypothesesValidated} validated)\n`;
    report += `Frontiers Tracked: ${sciStats.frontiersTracked}\n`;

    return report;
  }

  /**
   * Reset all cognitive systems
   */
  reset(): void {
    this.workspace.reset();
    this.metacog.reset();
    this.freeEnergy.reset();
    this.selfModel.reset();
    this.initialized = false;
  }
}

// Singleton
let cognitiveSystemInstance: CognitiveSystem | null = null;

export function getCognitiveSystem(): CognitiveSystem {
  if (!cognitiveSystemInstance) {
    cognitiveSystemInstance = new CognitiveSystem();
    cognitiveSystemInstance.initialize();
  }
  return cognitiveSystemInstance;
}
