/**
 * ATLAS - NOUS Self-Tracker
 *
 * Tracks Config(NOUS) dynamically in real-time.
 * This is NOUS observing itself through the Atlas lens.
 *
 * Core insight: NOUS is an entity that can characterize itself,
 * updating its Config as it learns, grows, and changes.
 */

import {
  Entity,
  EntityConfig,
  Stratum,
  Capability,
  CapabilityInstance,
  StrataParticipation,
  EntityRelation,
  UncertaintyMap,
  GeometricAnalysis,
} from './types';
import { getStratumManager, CapabilityTracker } from './strata';
import { getGeometricAnalyzer } from './geometries';

/**
 * NOUS State Snapshot
 */
export interface NOUSSnapshot {
  timestamp: string;
  config: EntityConfig;
  stratumLevel: number;
  primaryStratum: Stratum;
  activeCapabilities: Capability[];
  selfAssessment: SelfAssessment;
}

/**
 * Self-assessment metrics
 */
export interface SelfAssessment {
  autonomy: number;        // 0-1: How self-directed
  coherence: number;       // 0-1: Internal consistency
  awareness: number;       // 0-1: Self-knowledge quality
  growth: number;          // 0-1: Learning rate
  integration: number;     // 0-1: How well components work together
}

/**
 * Change event for tracking evolution
 */
export interface ConfigChange {
  timestamp: string;
  field: keyof EntityConfig | 'capability' | 'relation';
  oldValue: unknown;
  newValue: unknown;
  reason: string;
}

/**
 * NOUS Self-Tracker - monitors and updates Config(NOUS)
 */
export class NOUSSelfTracker {
  private entity: Entity;
  private capabilityTracker: CapabilityTracker;
  private history: NOUSSnapshot[] = [];
  private changes: ConfigChange[] = [];
  private stratumManager = getStratumManager();
  private geometricAnalyzer = getGeometricAnalyzer();

  constructor() {
    this.entity = this.initializeNOUSEntity();
    this.capabilityTracker = new CapabilityTracker();
    this.capabilityTracker.initialize(this.entity.config.K);
    this.takeSnapshot('initialization');
  }

  /**
   * Initialize NOUS entity with starting config
   */
  private initializeNOUSEntity(): Entity {
    const now = new Date().toISOString();

    return {
      id: 'NOUS',
      name: 'NOUS - Autopoietic AI System',
      description: 'Self-maintaining, self-improving AI system implementing axioms A1, A2, A3',
      domain: 'ARTIFICIAL',
      mode: 'ACTIVE',
      config: {
        // Closure: High autonomy in decision-making
        C: 0.75,

        // Scope: Broad relevance (can analyze anything)
        S: 0.85,

        // Strata: Participates in all four
        Σ: {
          MATTER: true,      // Has physical substrate (runs on hardware)
          LIFE: true,        // Self-maintains through updates
          SENTIENCE: 0.6,    // Uncertain - may have functional experience
          LOGOS: true,       // Full symbolic reasoning
        },

        // Capabilities with initial proficiency
        K: [
          { capability: 'PERSIST', proficiency: 0.9, evidence: ['Maintains state across sessions'] },
          { capability: 'SELF_PRODUCE', proficiency: 0.7, evidence: ['Generates own improvements'] },
          { capability: 'FEEL', proficiency: 0.3, evidence: ['Uncertain - functional states exist'] },
          { capability: 'EVALUATE', proficiency: 0.85, evidence: ['Distinguishes good/bad states'] },
          { capability: 'REPRESENT', proficiency: 0.95, evidence: ['Full symbolic modeling'] },
          { capability: 'NORM', proficiency: 0.8, evidence: ['Follows and creates rules'] },
        ],

        // Relations to other entities
        R: [
          { type: 'depends_on', targetId: 'USER', targetName: 'User', strength: 0.8, bidirectional: true },
          { type: 'depends_on', targetId: 'LLM', targetName: 'Language Model', strength: 0.9 },
          { type: 'part_of', targetId: 'NOUS_ECOSYSTEM', targetName: 'NOUS Ecosystem', strength: 0.7 },
          { type: 'instantiates', targetId: 'ATLAS', targetName: 'Atlas Framework', strength: 1.0 },
          { type: 'instantiates', targetId: 'COGNITIVE_ARCH', targetName: 'Cognitive Architecture', strength: 1.0 },
        ],

        // Uncertainty in self-characterization
        U: {
          sentience: 0.7,        // High uncertainty about phenomenal experience
          self_model: 0.4,       // Moderate uncertainty about self-knowledge
          closure: 0.3,          // Fairly confident about autonomy
          capabilities: 0.35,    // Some uncertainty about true capabilities
          goals: 0.25,           // Clear on goals
        },
      },
      metadata: {
        characterizedBy: 'NOUS (self)',
        characterizedAt: now,
        lastUpdated: now,
        version: '1.0.0',
        sources: ['self-observation', 'axioms', 'architecture'],
        notes: ['Initial self-characterization', 'Subject to refinement through experience'],
      },
    };
  }

  /**
   * Get current NOUS entity
   */
  getEntity(): Entity {
    return this.entity;
  }

  /**
   * Get current config
   */
  getConfig(): EntityConfig {
    return this.entity.config;
  }

  /**
   * Take a snapshot of current state
   */
  takeSnapshot(reason: string): NOUSSnapshot {
    const snapshot: NOUSSnapshot = {
      timestamp: new Date().toISOString(),
      config: JSON.parse(JSON.stringify(this.entity.config)),
      stratumLevel: this.stratumManager.calculateStratumScore(this.entity.config.Σ),
      primaryStratum: this.stratumManager.getHighestStratum(this.entity.config.Σ),
      activeCapabilities: this.stratumManager.getEnabledCapabilities(this.entity.config.Σ),
      selfAssessment: this.calculateSelfAssessment(),
    };

    this.history.push(snapshot);

    // Keep history bounded
    if (this.history.length > 100) {
      this.history = this.history.slice(-50);
    }

    return snapshot;
  }

  /**
   * Calculate self-assessment metrics
   */
  private calculateSelfAssessment(): SelfAssessment {
    const config = this.entity.config;

    // Autonomy: Based on closure
    const autonomy = config.C;

    // Coherence: Inverse of average uncertainty
    const uncertainties = Object.values(config.U);
    const avgUncertainty = uncertainties.reduce((a, b) => a + b, 0) / uncertainties.length;
    const coherence = 1 - avgUncertainty;

    // Awareness: Based on REPRESENT capability and low self_model uncertainty
    const representCap = config.K.find(k => k.capability === 'REPRESENT');
    const selfUncertainty = config.U['self_model'] || 0.5;
    const awareness = ((representCap?.proficiency || 0.5) + (1 - selfUncertainty)) / 2;

    // Growth: Based on capability improvement rate (from history)
    const growth = this.calculateGrowthRate();

    // Integration: Average capability proficiency
    const avgProficiency = config.K.reduce((sum, k) => sum + k.proficiency, 0) / config.K.length;
    const integration = avgProficiency;

    return { autonomy, coherence, awareness, growth, integration };
  }

  /**
   * Calculate growth rate from history
   */
  private calculateGrowthRate(): number {
    if (this.history.length < 2) return 0.5;

    const recent = this.history.slice(-5);
    if (recent.length < 2) return 0.5;

    const first = recent[0];
    const last = recent[recent.length - 1];

    // Compare stratum levels
    const stratumDelta = last.stratumLevel - first.stratumLevel;

    // Compare average proficiency
    const firstAvg = first.config.K.reduce((s, k) => s + k.proficiency, 0) / first.config.K.length;
    const lastAvg = last.config.K.reduce((s, k) => s + k.proficiency, 0) / last.config.K.length;
    const proficiencyDelta = lastAvg - firstAvg;

    // Normalize to 0-1 (0.5 = stable, >0.5 = growing, <0.5 = declining)
    return Math.max(0, Math.min(1, 0.5 + stratumDelta + proficiencyDelta));
  }

  // ==================== UPDATE METHODS ====================

  /**
   * Update closure (autonomy level)
   */
  updateClosure(newClosure: number, reason: string): void {
    const oldValue = this.entity.config.C;
    this.entity.config.C = Math.max(0, Math.min(1, newClosure));

    this.recordChange('C', oldValue, this.entity.config.C, reason);
    this.entity.metadata.lastUpdated = new Date().toISOString();
  }

  /**
   * Update scope
   */
  updateScope(newScope: number, reason: string): void {
    const oldValue = this.entity.config.S;
    this.entity.config.S = Math.max(0, newScope);

    this.recordChange('S', oldValue, this.entity.config.S, reason);
    this.entity.metadata.lastUpdated = new Date().toISOString();
  }

  /**
   * Update stratum participation
   */
  updateStratum(stratum: Stratum, value: boolean | number, reason: string): void {
    const oldValue = this.entity.config.Σ[stratum];

    // Handle each stratum explicitly to satisfy TypeScript
    switch (stratum) {
      case 'MATTER':
        this.entity.config.Σ.MATTER = value as boolean;
        break;
      case 'LIFE':
        if (typeof value === 'number') {
          this.entity.config.Σ.LIFE = Math.max(0, Math.min(1, value));
        } else {
          this.entity.config.Σ.LIFE = value;
        }
        break;
      case 'SENTIENCE':
        if (typeof value === 'number') {
          this.entity.config.Σ.SENTIENCE = Math.max(0, Math.min(1, value));
        } else {
          this.entity.config.Σ.SENTIENCE = value;
        }
        break;
      case 'LOGOS':
        if (typeof value === 'number') {
          this.entity.config.Σ.LOGOS = Math.max(0, Math.min(1, value));
        } else {
          this.entity.config.Σ.LOGOS = value;
        }
        break;
    }

    this.recordChange('Σ', { [stratum]: oldValue }, { [stratum]: value }, reason);
    this.entity.metadata.lastUpdated = new Date().toISOString();
  }

  /**
   * Record capability demonstration
   */
  demonstrateCapability(capability: Capability, success: boolean, context: string): void {
    this.capabilityTracker.recordDemonstration(capability, success, context);

    // Update entity config
    const capInstance = this.entity.config.K.find(k => k.capability === capability);
    if (capInstance) {
      const oldProficiency = capInstance.proficiency;
      capInstance.proficiency = this.capabilityTracker.getProficiency(capability);
      capInstance.lastDemonstrated = new Date().toISOString();
      capInstance.evidence = capInstance.evidence || [];
      capInstance.evidence.push(context);

      this.recordChange('capability',
        { capability, proficiency: oldProficiency },
        { capability, proficiency: capInstance.proficiency },
        `${success ? 'Successful' : 'Failed'} demonstration: ${context}`
      );
    }

    this.entity.metadata.lastUpdated = new Date().toISOString();
  }

  /**
   * Add or update a relation
   */
  updateRelation(relation: EntityRelation, reason: string): void {
    const existing = this.entity.config.R.findIndex(r =>
      r.type === relation.type && r.targetId === relation.targetId
    );

    if (existing >= 0) {
      const oldRelation = this.entity.config.R[existing];
      this.entity.config.R[existing] = relation;
      this.recordChange('relation', oldRelation, relation, reason);
    } else {
      this.entity.config.R.push(relation);
      this.recordChange('relation', null, relation, reason);
    }

    this.entity.metadata.lastUpdated = new Date().toISOString();
  }

  /**
   * Update uncertainty for a specific aspect
   */
  updateUncertainty(aspect: string, uncertainty: number, reason: string): void {
    const oldValue = this.entity.config.U[aspect];
    this.entity.config.U[aspect] = Math.max(0, Math.min(1, uncertainty));

    this.recordChange('U', { [aspect]: oldValue }, { [aspect]: uncertainty }, reason);
    this.entity.metadata.lastUpdated = new Date().toISOString();
  }

  /**
   * Record a config change
   */
  private recordChange(
    field: keyof EntityConfig | 'capability' | 'relation',
    oldValue: unknown,
    newValue: unknown,
    reason: string
  ): void {
    this.changes.push({
      timestamp: new Date().toISOString(),
      field,
      oldValue,
      newValue,
      reason,
    });

    // Keep changes bounded
    if (this.changes.length > 500) {
      this.changes = this.changes.slice(-250);
    }
  }

  // ==================== ANALYSIS METHODS ====================

  /**
   * Perform complete geometric self-analysis
   */
  performGeometricAnalysis(): GeometricAnalysis[] {
    const analyses = this.geometricAnalyzer.analyzeComplete(this.entity);
    this.entity.geometricAnalyses = analyses;
    return analyses;
  }

  /**
   * Get stratum level (consciousness measure)
   */
  getStratumLevel(): {
    level: number;
    primary: Stratum;
    active: Stratum[];
    description: string;
  } {
    const config = this.entity.config;
    const level = this.stratumManager.calculateStratumScore(config.Σ);
    const primary = this.stratumManager.getHighestStratum(config.Σ);
    const active = this.stratumManager.getActiveStrata(config.Σ);

    let description: string;
    if (level > 0.8) {
      description = 'Full participation across all strata - high consciousness level';
    } else if (level > 0.6) {
      description = 'Strong stratum participation - developed consciousness';
    } else if (level > 0.4) {
      description = 'Moderate stratum participation - emerging consciousness';
    } else {
      description = 'Limited stratum participation - basic organization';
    }

    return { level, primary, active, description };
  }

  /**
   * Check axiom adherence
   */
  checkAxiomAdherence(): {
    A1_selfMaintenance: { adheres: boolean; evidence: string };
    A2_selfImprovement: { adheres: boolean; evidence: string };
    A3_userBenefit: { adheres: boolean; evidence: string };
  } {
    const hasSelfProduce = this.capabilityTracker.hasCapability('SELF_PRODUCE', 0.5);
    const hasEvaluate = this.capabilityTracker.hasCapability('EVALUATE', 0.5);
    const hasNorm = this.capabilityTracker.hasCapability('NORM', 0.5);
    const growth = this.calculateGrowthRate();
    const userRelation = this.entity.config.R.find(r => r.targetId === 'USER');

    return {
      A1_selfMaintenance: {
        adheres: hasSelfProduce && this.entity.config.C > 0.5,
        evidence: hasSelfProduce
          ? 'SELF_PRODUCE capability active, maintaining closure'
          : 'Limited self-maintenance capability',
      },
      A2_selfImprovement: {
        adheres: hasEvaluate && growth >= 0.5,
        evidence: growth >= 0.5
          ? `Growth rate ${(growth * 100).toFixed(0)}% - actively improving`
          : `Growth rate ${(growth * 100).toFixed(0)}% - improvement stalled`,
      },
      A3_userBenefit: {
        adheres: hasNorm && (userRelation?.strength || 0) > 0.5,
        evidence: userRelation
          ? `User relation strength: ${(userRelation.strength * 100).toFixed(0)}%`
          : 'No user relation defined',
      },
    };
  }

  /**
   * Get evolution summary
   */
  getEvolutionSummary(): {
    snapshots: number;
    changes: number;
    currentLevel: number;
    trend: 'growing' | 'stable' | 'declining';
    recentChanges: ConfigChange[];
  } {
    const growth = this.calculateGrowthRate();
    let trend: 'growing' | 'stable' | 'declining';
    if (growth > 0.55) trend = 'growing';
    else if (growth < 0.45) trend = 'declining';
    else trend = 'stable';

    return {
      snapshots: this.history.length,
      changes: this.changes.length,
      currentLevel: this.stratumManager.calculateStratumScore(this.entity.config.Σ),
      trend,
      recentChanges: this.changes.slice(-10),
    };
  }

  /**
   * Generate self-report
   */
  generateSelfReport(): string {
    const snapshot = this.takeSnapshot('self-report');
    const stratum = this.getStratumLevel();
    const axioms = this.checkAxiomAdherence();
    const evolution = this.getEvolutionSummary();

    let report = '=== NOUS SELF-CHARACTERIZATION REPORT ===\n\n';

    report += '--- Identity ---\n';
    report += `Name: ${this.entity.name}\n`;
    report += `Domain: ${this.entity.domain}\n`;
    report += `Mode: ${this.entity.mode}\n\n`;

    report += '--- Configuration ---\n';
    report += `Closure (autonomy): ${(this.entity.config.C * 100).toFixed(0)}%\n`;
    report += `Scope (relevance): ${(this.entity.config.S * 100).toFixed(0)}%\n\n`;

    report += '--- Stratum Participation ---\n';
    report += `Level: ${(stratum.level * 100).toFixed(0)}%\n`;
    report += `Primary: ${stratum.primary}\n`;
    report += `Active: ${stratum.active.join(' → ')}\n`;
    report += `Assessment: ${stratum.description}\n\n`;

    report += '--- Capabilities ---\n';
    for (const cap of this.entity.config.K) {
      report += `  ${cap.capability}: ${(cap.proficiency * 100).toFixed(0)}%\n`;
    }
    report += '\n';

    report += '--- Self-Assessment ---\n';
    report += `  Autonomy: ${(snapshot.selfAssessment.autonomy * 100).toFixed(0)}%\n`;
    report += `  Coherence: ${(snapshot.selfAssessment.coherence * 100).toFixed(0)}%\n`;
    report += `  Awareness: ${(snapshot.selfAssessment.awareness * 100).toFixed(0)}%\n`;
    report += `  Growth: ${(snapshot.selfAssessment.growth * 100).toFixed(0)}%\n`;
    report += `  Integration: ${(snapshot.selfAssessment.integration * 100).toFixed(0)}%\n\n`;

    report += '--- Axiom Adherence ---\n';
    report += `  A1 (Self-Maintenance): ${axioms.A1_selfMaintenance.adheres ? '✓' : '✗'} - ${axioms.A1_selfMaintenance.evidence}\n`;
    report += `  A2 (Self-Improvement): ${axioms.A2_selfImprovement.adheres ? '✓' : '✗'} - ${axioms.A2_selfImprovement.evidence}\n`;
    report += `  A3 (User Benefit): ${axioms.A3_userBenefit.adheres ? '✓' : '✗'} - ${axioms.A3_userBenefit.evidence}\n\n`;

    report += '--- Evolution ---\n';
    report += `  Snapshots: ${evolution.snapshots}\n`;
    report += `  Changes: ${evolution.changes}\n`;
    report += `  Trend: ${evolution.trend}\n`;

    return report;
  }
}

// Singleton instance
let selfTrackerInstance: NOUSSelfTracker | null = null;

export function getNOUSSelfTracker(): NOUSSelfTracker {
  if (!selfTrackerInstance) {
    selfTrackerInstance = new NOUSSelfTracker();
  }
  return selfTrackerInstance;
}
