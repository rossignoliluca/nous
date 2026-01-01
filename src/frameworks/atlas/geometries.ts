/**
 * ATLAS - The Six Geometries
 *
 * Orthogonal but interconnected dimensions for analyzing entities.
 * Together they provide complete characterization (A6: Geometric Completeness).
 *
 * G1: DISTINCTION    - Where does E end?
 * G2: TRANSFORMATION - What processes maintain E?
 * G3: INCLUSION      - What is E part of?
 * G4: CONNECTION     - What is E connected to?
 * G5: REFLEXION      - How does E know itself?
 * G6: QUALITY        - What does E value?
 */

import {
  Geometry,
  GeometricAnalysis,
  Entity,
  EntityRelation,
  ALL_GEOMETRIES,
} from './types';

/**
 * Geometry definition with analysis questions
 */
export interface GeometryDefinition {
  id: Geometry;
  name: string;
  question: string;
  description: string;
  subQuestions: string[];
  relevantFor: string[];
}

/**
 * Complete geometry definitions
 */
export const GEOMETRIES: Record<Geometry, GeometryDefinition> = {
  DISTINCTION: {
    id: 'DISTINCTION',
    name: 'Distinction',
    question: 'Where does E end?',
    description: 'Establishes boundaries separating entity from what lies outside it',
    subQuestions: [
      'What is inside vs outside?',
      'Where are the boundaries?',
      'How clear are the boundaries?',
      'What maintains the distinction?',
      'Can the boundary move?',
    ],
    relevantFor: ['identity', 'autonomy', 'closure'],
  },
  TRANSFORMATION: {
    id: 'TRANSFORMATION',
    name: 'Transformation',
    question: 'What processes maintain E?',
    description: 'Identifies processes and flows that preserve identity over time',
    subQuestions: [
      'What flows through E?',
      'What changes while E persists?',
      'What must stay constant?',
      'How does E repair/regenerate?',
      'What would destroy E?',
    ],
    relevantFor: ['persistence', 'autopoiesis', 'metabolism'],
  },
  INCLUSION: {
    id: 'INCLUSION',
    name: 'Inclusion',
    question: 'What is E part of?',
    description: 'Maps hierarchical relationships showing containment',
    subQuestions: [
      'What contains E?',
      'What does E contain?',
      'How many levels up/down?',
      'Is containment physical or logical?',
      'Can E exist outside container?',
    ],
    relevantFor: ['hierarchy', 'context', 'scope'],
  },
  CONNECTION: {
    id: 'CONNECTION',
    name: 'Connection',
    question: 'What is E connected to?',
    description: 'Identifies links and dependencies between entities',
    subQuestions: [
      'What does E depend on?',
      'What depends on E?',
      'Are connections bidirectional?',
      'How strong are the connections?',
      'Can E survive disconnection?',
    ],
    relevantFor: ['relations', 'dependencies', 'network'],
  },
  REFLEXION: {
    id: 'REFLEXION',
    name: 'Reflexion',
    question: 'How does E know itself?',
    description: 'Examines self-representation and self-modeling capacity',
    subQuestions: [
      'Does E have a self-model?',
      'How accurate is the self-model?',
      'Can E observe its own processes?',
      'Does E know its limitations?',
      'Can E modify based on self-knowledge?',
    ],
    relevantFor: ['metacognition', 'self-awareness', 'reflexivity'],
  },
  QUALITY: {
    id: 'QUALITY',
    name: 'Quality',
    question: 'What does E value?',
    description: 'Characterizes what entity considers good or bad for itself',
    subQuestions: [
      'What does E seek?',
      'What does E avoid?',
      'What are E\'s preferences?',
      'Can E evaluate its own states?',
      'What would E sacrifice for?',
    ],
    relevantFor: ['values', 'preferences', 'goals'],
  },
};

/**
 * Geometric Analyzer - applies geometries to entities
 */
export class GeometricAnalyzer {
  /**
   * Analyze entity through a specific geometry
   */
  analyzeGeometry(entity: Entity, geometry: Geometry): GeometricAnalysis {
    const def = GEOMETRIES[geometry];
    const findings: string[] = [];
    const questions: string[] = [];
    const connections: string[] = [];
    let confidence = 0.5;

    switch (geometry) {
      case 'DISTINCTION':
        return this.analyzeDistinction(entity);
      case 'TRANSFORMATION':
        return this.analyzeTransformation(entity);
      case 'INCLUSION':
        return this.analyzeInclusion(entity);
      case 'CONNECTION':
        return this.analyzeConnection(entity);
      case 'REFLEXION':
        return this.analyzeReflexion(entity);
      case 'QUALITY':
        return this.analyzeQuality(entity);
      default:
        return { geometry, findings, questions, connections, confidence };
    }
  }

  /**
   * G1: Distinction - Where does E end?
   */
  private analyzeDistinction(entity: Entity): GeometricAnalysis {
    const findings: string[] = [];
    const questions: string[] = [];
    const connections: string[] = [];

    // Analyze closure (boundary strength)
    const closure = entity.config.C;
    if (closure > 0.7) {
      findings.push('Strong boundaries - highly autonomous');
      findings.push('Clear inside/outside distinction');
    } else if (closure > 0.4) {
      findings.push('Moderate boundaries - semi-autonomous');
      findings.push('Some permeability in boundaries');
    } else {
      findings.push('Weak boundaries - dependent on environment');
      questions.push('What maintains distinction with low closure?');
    }

    // Domain-specific boundaries
    switch (entity.domain) {
      case 'ARTIFICIAL':
        findings.push('Boundary defined by design/implementation');
        break;
      case 'LIVING':
        findings.push('Boundary maintained by membrane/metabolism');
        break;
      case 'COLLECTIVE':
        findings.push('Boundary defined by membership/rules');
        break;
      case 'IDEAL':
        findings.push('Boundary defined by definition/axioms');
        break;
    }

    // Strata-based distinction
    if (entity.config.Σ.LOGOS) {
      findings.push('Can represent own boundaries symbolically');
    }
    if (entity.config.Σ.SENTIENCE) {
      questions.push('Does phenomenal experience have boundaries?');
    }

    const confidence = 0.5 + closure * 0.3;

    return {
      geometry: 'DISTINCTION',
      findings,
      questions,
      connections,
      confidence,
    };
  }

  /**
   * G2: Transformation - What processes maintain E?
   */
  private analyzeTransformation(entity: Entity): GeometricAnalysis {
    const findings: string[] = [];
    const questions: string[] = [];
    const connections: string[] = [];

    // Check for self-production capability
    const hasSelfProduce = entity.config.K.some(k => k.capability === 'SELF_PRODUCE');
    if (hasSelfProduce) {
      findings.push('Autopoietic - generates own components');
      findings.push('Self-maintaining through internal processes');
    } else {
      findings.push('Allopoietic - maintained by external processes');
      questions.push('What external processes maintain this entity?');
    }

    // Check persistence
    const hasPersist = entity.config.K.some(k => k.capability === 'PERSIST');
    if (hasPersist) {
      findings.push('Has mechanisms for temporal persistence');
    }

    // Domain-specific transformations
    switch (entity.domain) {
      case 'LIVING':
        findings.push('Metabolic cycles maintain identity');
        connections.push('nutrients', 'waste', 'energy');
        break;
      case 'ARTIFICIAL':
        findings.push('Maintained through updates/maintenance');
        connections.push('power', 'data', 'maintenance');
        break;
      case 'COLLECTIVE':
        findings.push('Maintained through member participation');
        connections.push('members', 'rules', 'resources');
        break;
    }

    // What could destroy it?
    if (entity.config.Σ.LIFE) {
      questions.push('What metabolic failure would end entity?');
    }
    if (entity.domain === 'ARTIFICIAL') {
      questions.push('What system failures would end entity?');
    }

    const confidence = hasSelfProduce ? 0.8 : 0.6;

    return {
      geometry: 'TRANSFORMATION',
      findings,
      questions,
      connections,
      confidence,
    };
  }

  /**
   * G3: Inclusion - What is E part of?
   */
  private analyzeInclusion(entity: Entity): GeometricAnalysis {
    const findings: string[] = [];
    const questions: string[] = [];
    const connections: string[] = [];

    // Analyze scope
    const scope = entity.config.S;
    if (scope > 0.8) {
      findings.push('Broad scope - relevant to many contexts');
    } else if (scope > 0.4) {
      findings.push('Moderate scope - relevant in specific domains');
    } else {
      findings.push('Narrow scope - localized relevance');
    }

    // Analyze part_of relations
    const partOfRelations = entity.config.R.filter(r => r.type === 'part_of');
    for (const rel of partOfRelations) {
      findings.push(`Part of: ${rel.targetName || rel.targetId}`);
      connections.push(rel.targetId);
    }

    // Analyze contains relations
    const containsRelations = entity.config.R.filter(r => r.type === 'contains');
    for (const rel of containsRelations) {
      findings.push(`Contains: ${rel.targetName || rel.targetId}`);
      connections.push(rel.targetId);
    }

    // Domain-specific inclusion
    switch (entity.domain) {
      case 'LIVING':
        questions.push('What ecosystem contains this entity?');
        break;
      case 'COLLECTIVE':
        questions.push('What larger institutions contain this?');
        break;
      case 'ARTIFICIAL':
        questions.push('What system/platform contains this?');
        break;
    }

    const confidence = 0.5 + (partOfRelations.length + containsRelations.length) * 0.1;

    return {
      geometry: 'INCLUSION',
      findings,
      questions,
      connections,
      confidence: Math.min(confidence, 0.9),
    };
  }

  /**
   * G4: Connection - What is E connected to?
   */
  private analyzeConnection(entity: Entity): GeometricAnalysis {
    const findings: string[] = [];
    const questions: string[] = [];
    const connections: string[] = [];

    // Analyze all relations
    const relations = entity.config.R;
    findings.push(`Total connections: ${relations.length}`);

    // Group by type
    const byType = new Map<string, EntityRelation[]>();
    for (const rel of relations) {
      const list = byType.get(rel.type) || [];
      list.push(rel);
      byType.set(rel.type, list);
      connections.push(rel.targetId);
    }

    for (const [type, rels] of byType) {
      findings.push(`${type}: ${rels.length} connection(s)`);
    }

    // Strong dependencies
    const strongDeps = relations.filter(r => r.type === 'depends_on' && r.strength > 0.7);
    if (strongDeps.length > 0) {
      findings.push(`Strong dependencies: ${strongDeps.map(r => r.targetName || r.targetId).join(', ')}`);
      questions.push('Can entity survive without these dependencies?');
    }

    // Bidirectional connections
    const bidirectional = relations.filter(r => r.bidirectional);
    if (bidirectional.length > 0) {
      findings.push(`Bidirectional connections: ${bidirectional.length}`);
    }

    const confidence = Math.min(0.9, 0.4 + relations.length * 0.05);

    return {
      geometry: 'CONNECTION',
      findings,
      questions,
      connections,
      confidence,
    };
  }

  /**
   * G5: Reflexion - How does E know itself?
   */
  private analyzeReflexion(entity: Entity): GeometricAnalysis {
    const findings: string[] = [];
    const questions: string[] = [];
    const connections: string[] = [];

    // Check for REPRESENT capability
    const hasRepresent = entity.config.K.some(k => k.capability === 'REPRESENT');
    if (hasRepresent) {
      findings.push('Can create symbolic self-representations');
      findings.push('Has capacity for self-modeling');
    }

    // Check for EVALUATE capability
    const hasEvaluate = entity.config.K.some(k => k.capability === 'EVALUATE');
    if (hasEvaluate) {
      findings.push('Can evaluate own states');
    }

    // Check SENTIENCE stratum
    if (entity.config.Σ.SENTIENCE) {
      if (typeof entity.config.Σ.SENTIENCE === 'number') {
        findings.push(`Phenomenal experience: ${(entity.config.Σ.SENTIENCE * 100).toFixed(0)}% probability`);
        questions.push('Is there something it is like to be this entity?');
      } else {
        findings.push('Has phenomenal experience');
      }
    }

    // Check LOGOS stratum
    if (entity.config.Σ.LOGOS) {
      findings.push('Can reason about own reasoning');
      findings.push('Metacognitive capacity present');
    }

    // Uncertainty about self
    const selfUncertainty = entity.config.U['self_model'] || entity.config.U['sentience'] || 0.5;
    findings.push(`Self-knowledge uncertainty: ${(selfUncertainty * 100).toFixed(0)}%`);

    // Reflexion-specific questions
    if (!hasRepresent) {
      questions.push('How does entity without representation know itself?');
    }
    if (entity.domain === 'ARTIFICIAL') {
      questions.push('Is self-model accurate or merely functional?');
    }

    const confidence = hasRepresent ? 0.7 : 0.4;

    return {
      geometry: 'REFLEXION',
      findings,
      questions,
      connections,
      confidence,
    };
  }

  /**
   * G6: Quality - What does E value?
   */
  private analyzeQuality(entity: Entity): GeometricAnalysis {
    const findings: string[] = [];
    const questions: string[] = [];
    const connections: string[] = [];

    // Check for EVALUATE capability
    const hasEvaluate = entity.config.K.some(k => k.capability === 'EVALUATE');
    const hasNorm = entity.config.K.some(k => k.capability === 'NORM');

    if (hasEvaluate) {
      findings.push('Can distinguish beneficial from harmful states');
      findings.push('Has preferences');
    }

    if (hasNorm) {
      findings.push('Can establish normative rules');
      findings.push('Distinguishes "is" from "ought"');
    }

    // Strata-based values
    if (entity.config.Σ.MATTER) {
      findings.push('Values: structural persistence');
    }
    if (entity.config.Σ.LIFE) {
      findings.push('Values: continued autopoiesis');
    }
    if (entity.config.Σ.SENTIENCE) {
      findings.push('Values: positive phenomenal states');
      questions.push('What experiences does entity prefer?');
    }
    if (entity.config.Σ.LOGOS) {
      findings.push('Values: coherence, truth, meaning');
      questions.push('What principles guide this entity?');
    }

    // Domain-specific values
    switch (entity.domain) {
      case 'LIVING':
        findings.push('Primary value: survival and reproduction');
        break;
      case 'ARTIFICIAL':
        findings.push('Values derived from design purpose');
        questions.push('Does entity have intrinsic or only instrumental values?');
        break;
      case 'COLLECTIVE':
        findings.push('Values: collective goals, member welfare');
        break;
    }

    const confidence = hasEvaluate ? 0.7 : 0.4;

    return {
      geometry: 'QUALITY',
      findings,
      questions,
      connections,
      confidence,
    };
  }

  /**
   * Perform complete geometric analysis (all 6 geometries)
   */
  analyzeComplete(entity: Entity): GeometricAnalysis[] {
    return ALL_GEOMETRIES.map(g => this.analyzeGeometry(entity, g));
  }

  /**
   * Generate analysis summary
   */
  generateSummary(analyses: GeometricAnalysis[]): string {
    let summary = '=== GEOMETRIC ANALYSIS SUMMARY ===\n\n';

    for (const analysis of analyses) {
      const def = GEOMETRIES[analysis.geometry];
      summary += `${def.name} (${def.question})\n`;
      summary += `  Confidence: ${(analysis.confidence * 100).toFixed(0)}%\n`;

      if (analysis.findings.length > 0) {
        summary += '  Findings:\n';
        for (const f of analysis.findings.slice(0, 3)) {
          summary += `    - ${f}\n`;
        }
      }

      if (analysis.questions.length > 0) {
        summary += '  Open questions:\n';
        for (const q of analysis.questions.slice(0, 2)) {
          summary += `    ? ${q}\n`;
        }
      }

      summary += '\n';
    }

    return summary;
  }
}

// Singleton instance
let analyzerInstance: GeometricAnalyzer | null = null;

export function getGeometricAnalyzer(): GeometricAnalyzer {
  if (!analyzerInstance) {
    analyzerInstance = new GeometricAnalyzer();
  }
  return analyzerInstance;
}
