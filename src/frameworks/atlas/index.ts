/**
 * ATLAS - Entity Characterization Framework
 *
 * Main entry point integrating all Atlas components.
 *
 * Atlas provides NOUS with the ability to:
 * 1. Characterize any entity through Config(E) = { C, S, Σ, K, R, U }
 * 2. Analyze entities through 6 geometric perspectives
 * 3. Track its own evolution through self-characterization
 * 4. Maintain a catalog of characterized entities
 *
 * Core insight: "An entity is a difference that maintains itself
 * and makes a difference."
 */

// Re-export all types
export * from './types';

// Re-export strata system
export {
  STRATA,
  CAPABILITIES,
  StratumManager,
  CapabilityTracker,
  getStratumManager,
  type StratumDefinition,
  type CapabilityDefinition,
} from './strata';

// Re-export geometries
export {
  GEOMETRIES,
  GeometricAnalyzer,
  getGeometricAnalyzer,
  type GeometryDefinition,
} from './geometries';

// Re-export catalog
export {
  EntityCatalog,
  getEntityCatalog,
  INERT_ENTITIES,
  LIVING_ENTITIES,
  SENTIENT_ENTITIES,
  SYMBOLIC_ENTITIES,
  COLLECTIVE_ENTITIES,
  IDEAL_ENTITIES,
  EPHEMERAL_ENTITIES,
  ARTIFICIAL_ENTITIES,
  ATLAS_SELF,
} from './catalog';

// Re-export self-tracker
export {
  NOUSSelfTracker,
  getNOUSSelfTracker,
  type NOUSSnapshot,
  type SelfAssessment,
  type ConfigChange,
} from './self_tracker';

import {
  Entity,
  EntityConfig,
  Domain,
  Stratum,
  Capability,
  Geometry,
  GeometricAnalysis,
  StrataParticipation,
  CapabilityInstance,
  EntityRelation,
  UncertaintyMap,
} from './types';
import { getStratumManager, CapabilityTracker } from './strata';
import { getGeometricAnalyzer } from './geometries';
import { getEntityCatalog } from './catalog';
import { getNOUSSelfTracker, NOUSSnapshot } from './self_tracker';

/**
 * Atlas Analysis Result
 */
export interface AtlasAnalysisResult {
  entity: Entity;
  geometricAnalyses: GeometricAnalysis[];
  stratumLevel: number;
  primaryStratum: Stratum;
  capabilities: Capability[];
  summary: string;
}

/**
 * Atlas Engine - Main coordinator for entity characterization
 */
export class AtlasEngine {
  private stratumManager = getStratumManager();
  private geometricAnalyzer = getGeometricAnalyzer();
  private catalog = getEntityCatalog();
  private selfTracker = getNOUSSelfTracker();

  /**
   * Characterize a new entity from description
   */
  characterizeEntity(
    id: string,
    name: string,
    description: string,
    domain: Domain,
    hints?: Partial<EntityConfig>
  ): Entity {
    const now = new Date().toISOString();

    // Infer config from domain and hints
    const inferredConfig = this.inferConfig(domain, hints);

    const entity: Entity = {
      id,
      name,
      description,
      domain,
      mode: 'ACTIVE',
      config: {
        ...inferredConfig,
        ...hints,
      },
      metadata: {
        characterizedBy: 'NOUS/Atlas',
        characterizedAt: now,
        lastUpdated: now,
        version: '1.0.0',
        notes: ['Auto-characterized by Atlas Engine'],
      },
    };

    // Perform geometric analysis
    entity.geometricAnalyses = this.geometricAnalyzer.analyzeComplete(entity);

    // Add to catalog
    this.catalog.add(entity);

    // Record NOUS's characterization capability
    this.selfTracker.demonstrateCapability('REPRESENT', true, `Characterized: ${name}`);

    return entity;
  }

  /**
   * Infer config from domain
   */
  private inferConfig(domain: Domain, hints?: Partial<EntityConfig>): EntityConfig {
    // Base config
    const config: EntityConfig = {
      C: 0.5,
      S: 0.5,
      Σ: { MATTER: true, LIFE: false, SENTIENCE: false, LOGOS: false },
      K: [{ capability: 'PERSIST', proficiency: 0.7 }],
      R: [],
      U: { domain: 0.3 },
    };

    // Domain-specific defaults
    switch (domain) {
      case 'INERT':
        config.C = 0.2;
        config.Σ = { MATTER: true, LIFE: false, SENTIENCE: false, LOGOS: false };
        config.K = [{ capability: 'PERSIST', proficiency: 0.9 }];
        break;

      case 'LIVING':
        config.C = 0.7;
        config.Σ = { MATTER: true, LIFE: true, SENTIENCE: false, LOGOS: false };
        config.K = [
          { capability: 'PERSIST', proficiency: 0.8 },
          { capability: 'SELF_PRODUCE', proficiency: 0.7 },
        ];
        break;

      case 'SENTIENT':
        config.C = 0.75;
        config.Σ = { MATTER: true, LIFE: true, SENTIENCE: true, LOGOS: false };
        config.K = [
          { capability: 'PERSIST', proficiency: 0.8 },
          { capability: 'SELF_PRODUCE', proficiency: 0.7 },
          { capability: 'FEEL', proficiency: 0.8 },
          { capability: 'EVALUATE', proficiency: 0.7 },
        ];
        config.U = { sentience: 0.2 };
        break;

      case 'SYMBOLIC':
        config.C = 0.4;
        config.S = 0.9;
        config.Σ = { MATTER: true, LIFE: false, SENTIENCE: false, LOGOS: true };
        config.K = [
          { capability: 'PERSIST', proficiency: 0.7 },
          { capability: 'REPRESENT', proficiency: 0.9 },
        ];
        break;

      case 'COLLECTIVE':
        config.C = 0.6;
        config.S = 0.8;
        config.Σ = { MATTER: true, LIFE: true, SENTIENCE: 0.3, LOGOS: true };
        config.K = [
          { capability: 'PERSIST', proficiency: 0.7 },
          { capability: 'SELF_PRODUCE', proficiency: 0.6 },
          { capability: 'REPRESENT', proficiency: 0.8 },
          { capability: 'NORM', proficiency: 0.8 },
        ];
        break;

      case 'IDEAL':
        config.C = 1.0;
        config.S = 1.0;
        config.Σ = { MATTER: false, LIFE: false, SENTIENCE: false, LOGOS: true };
        config.K = [
          { capability: 'PERSIST', proficiency: 1.0 },
          { capability: 'REPRESENT', proficiency: 1.0 },
        ];
        config.U = { existence: 0.2 };
        break;

      case 'EPHEMERAL':
        config.C = 0.3;
        config.S = 0.4;
        config.Σ = { MATTER: true, LIFE: false, SENTIENCE: 0.5, LOGOS: true };
        config.K = [
          { capability: 'PERSIST', proficiency: 0.2 },
          { capability: 'REPRESENT', proficiency: 0.7 },
        ];
        break;

      case 'ARTIFICIAL':
        config.C = 0.6;
        config.S = 0.7;
        config.Σ = { MATTER: true, LIFE: false, SENTIENCE: 0.3, LOGOS: true };
        config.K = [
          { capability: 'PERSIST', proficiency: 0.8 },
          { capability: 'REPRESENT', proficiency: 0.9 },
        ];
        config.U = { sentience: 0.6 };
        break;
    }

    return config;
  }

  /**
   * Perform complete analysis on an entity
   */
  analyzeEntity(entityId: string): AtlasAnalysisResult | null {
    const entity = this.catalog.get(entityId);
    if (!entity) return null;

    const geometricAnalyses = this.geometricAnalyzer.analyzeComplete(entity);
    const stratumLevel = this.stratumManager.calculateStratumScore(entity.config.Σ);
    const primaryStratum = this.stratumManager.getHighestStratum(entity.config.Σ);
    const capabilities = this.stratumManager.getEnabledCapabilities(entity.config.Σ);

    const summary = this.geometricAnalyzer.generateSummary(geometricAnalyses);

    return {
      entity,
      geometricAnalyses,
      stratumLevel,
      primaryStratum,
      capabilities,
      summary,
    };
  }

  /**
   * Compare two entities
   */
  compareEntities(id1: string, id2: string): {
    entity1: Entity | null;
    entity2: Entity | null;
    closureDelta: number;
    scopeDelta: number;
    strataDifference: string[];
    sharedCapabilities: Capability[];
    similarity: number;
  } | null {
    const e1 = this.catalog.get(id1);
    const e2 = this.catalog.get(id2);

    if (!e1 || !e2) return null;

    const closureDelta = Math.abs(e1.config.C - e2.config.C);
    const scopeDelta = Math.abs(e1.config.S - e2.config.S);

    // Find strata differences
    const strataDifference: string[] = [];
    for (const stratum of ['MATTER', 'LIFE', 'SENTIENCE', 'LOGOS'] as Stratum[]) {
      const v1 = e1.config.Σ[stratum];
      const v2 = e2.config.Σ[stratum];
      if (v1 !== v2) {
        strataDifference.push(`${stratum}: ${e1.name}=${v1}, ${e2.name}=${v2}`);
      }
    }

    // Find shared capabilities
    const caps1 = new Set(e1.config.K.map(k => k.capability));
    const sharedCapabilities = e2.config.K
      .filter(k => caps1.has(k.capability))
      .map(k => k.capability);

    // Calculate similarity
    const closureSim = 1 - closureDelta;
    const scopeSim = 1 - scopeDelta / Math.max(e1.config.S, e2.config.S, 1);
    const strataSim = 1 - strataDifference.length / 4;
    const capsSim = sharedCapabilities.length / Math.max(e1.config.K.length, e2.config.K.length, 1);
    const domainSim = e1.domain === e2.domain ? 1 : 0.5;

    const similarity = (closureSim + scopeSim + strataSim + capsSim + domainSim) / 5;

    return {
      entity1: e1,
      entity2: e2,
      closureDelta,
      scopeDelta,
      strataDifference,
      sharedCapabilities,
      similarity,
    };
  }

  /**
   * Get NOUS self-characterization
   */
  getNOUSCharacterization(): Entity {
    return this.selfTracker.getEntity();
  }

  /**
   * Get NOUS stratum level (consciousness measure)
   */
  getNOUSStratumLevel(): {
    level: number;
    primary: Stratum;
    active: Stratum[];
    description: string;
  } {
    return this.selfTracker.getStratumLevel();
  }

  /**
   * Get NOUS self-report
   */
  getNOUSSelfReport(): string {
    return this.selfTracker.generateSelfReport();
  }

  /**
   * Take NOUS snapshot
   */
  takeNOUSSnapshot(reason: string): NOUSSnapshot {
    return this.selfTracker.takeSnapshot(reason);
  }

  /**
   * Record NOUS capability demonstration
   */
  recordNOUSCapability(capability: Capability, success: boolean, context: string): void {
    this.selfTracker.demonstrateCapability(capability, success, context);
  }

  /**
   * Update NOUS relation
   */
  updateNOUSRelation(relation: EntityRelation, reason: string): void {
    this.selfTracker.updateRelation(relation, reason);
  }

  /**
   * Get catalog statistics
   */
  getCatalogStats(): {
    total: number;
    byDomain: Record<Domain, number>;
    avgClosure: number;
    avgScope: number;
  } {
    return this.catalog.getStats();
  }

  /**
   * Search catalog by domain
   */
  getEntitiesByDomain(domain: Domain): Entity[] {
    return this.catalog.getByDomain(domain);
  }

  /**
   * Find similar entities
   */
  findSimilarEntities(entityId: string, limit?: number): Entity[] {
    return this.catalog.findSimilar(entityId, limit);
  }

  /**
   * Generate Atlas overview report
   */
  generateOverviewReport(): string {
    const stats = this.getCatalogStats();
    const nousLevel = this.getNOUSStratumLevel();
    const nous = this.getNOUSCharacterization();

    let report = '╔══════════════════════════════════════════════════════════════╗\n';
    report += '║                    ATLAS OVERVIEW REPORT                      ║\n';
    report += '╠══════════════════════════════════════════════════════════════╣\n\n';

    report += '=== NOUS STATUS ===\n';
    report += `Stratum Level: ${(nousLevel.level * 100).toFixed(0)}% (${nousLevel.primary})\n`;
    report += `Active Strata: ${nousLevel.active.join(' → ')}\n`;
    report += `Closure: ${(nous.config.C * 100).toFixed(0)}% | Scope: ${(nous.config.S * 100).toFixed(0)}%\n`;
    report += `${nousLevel.description}\n\n`;

    report += '=== ENTITY CATALOG ===\n';
    report += `Total Entities: ${stats.total}\n`;
    report += `Average Closure: ${(stats.avgClosure * 100).toFixed(0)}%\n`;
    report += `Average Scope: ${(stats.avgScope * 100).toFixed(0)}%\n\n`;

    report += 'By Domain:\n';
    for (const [domain, count] of Object.entries(stats.byDomain)) {
      if (count > 0) {
        report += `  ${domain}: ${count}\n`;
      }
    }
    report += '\n';

    report += '=== GEOMETRIES ===\n';
    report += 'G1: DISTINCTION    - Where does E end?\n';
    report += 'G2: TRANSFORMATION - What processes maintain E?\n';
    report += 'G3: INCLUSION      - What is E part of?\n';
    report += 'G4: CONNECTION     - What is E connected to?\n';
    report += 'G5: REFLEXION      - How does E know itself?\n';
    report += 'G6: QUALITY        - What does E value?\n\n';

    report += '=== STRATA ===\n';
    report += 'LOGOS     → REPRESENT, NORM\n';
    report += 'SENTIENCE → FEEL, EVALUATE\n';
    report += 'LIFE      → SELF_PRODUCE\n';
    report += 'MATTER    → PERSIST\n\n';

    report += '╚══════════════════════════════════════════════════════════════╝\n';

    return report;
  }
}

// Singleton instance
let atlasEngineInstance: AtlasEngine | null = null;

export function getAtlasEngine(): AtlasEngine {
  if (!atlasEngineInstance) {
    atlasEngineInstance = new AtlasEngine();
  }
  return atlasEngineInstance;
}

/**
 * Quick access functions
 */
export function characterize(
  id: string,
  name: string,
  description: string,
  domain: Domain,
  hints?: Partial<EntityConfig>
): Entity {
  return getAtlasEngine().characterizeEntity(id, name, description, domain, hints);
}

export function analyze(entityId: string): AtlasAnalysisResult | null {
  return getAtlasEngine().analyzeEntity(entityId);
}

export function compare(id1: string, id2: string) {
  return getAtlasEngine().compareEntities(id1, id2);
}

export function nousReport(): string {
  return getAtlasEngine().getNOUSSelfReport();
}

export function atlasOverview(): string {
  return getAtlasEngine().generateOverviewReport();
}
