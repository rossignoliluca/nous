/**
 * ATLAS - Entity Catalog
 *
 * Pre-characterized entities organized by domain.
 * 60+ entities covering all eight domains.
 */

import {
  Entity,
  Domain,
  EntityConfig,
  CapabilityInstance,
  EntityRelation,
  StrataParticipation,
  ALL_DOMAINS,
} from './types';

/**
 * Create entity helper
 */
function createEntity(
  id: string,
  name: string,
  description: string,
  domain: Domain,
  config: Partial<EntityConfig> & { C: number; S: number; Σ: StrataParticipation }
): Entity {
  return {
    id,
    name,
    description,
    domain,
    mode: 'ACTIVE',
    config: {
      C: config.C,
      S: config.S,
      Σ: config.Σ,
      K: config.K || [],
      R: config.R || [],
      U: config.U || { characterization: 0.3 },
    },
    metadata: {
      characterizedBy: 'atlas',
      characterizedAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      version: '1.0',
    },
  };
}

/**
 * Capability helper
 */
function cap(name: string, proficiency: number = 0.8): CapabilityInstance {
  return {
    capability: name as any,
    proficiency,
    lastDemonstrated: new Date().toISOString(),
  };
}

/**
 * Relation helper
 */
function rel(type: string, targetId: string, strength: number = 0.5, targetName?: string): EntityRelation {
  return {
    type: type as any,
    targetId,
    targetName,
    strength,
  };
}

// ==================== INERT DOMAIN (Non-living natural) ====================

export const INERT_ENTITIES: Entity[] = [
  createEntity('rock', 'Rock', 'Solid aggregate of minerals', 'INERT', {
    C: 0.9, S: 0.1,
    Σ: { MATTER: true, LIFE: false, SENTIENCE: false, LOGOS: false },
    K: [cap('PERSIST', 0.95)],
  }),
  createEntity('water', 'Water', 'H2O in liquid form', 'INERT', {
    C: 0.3, S: 0.9,
    Σ: { MATTER: true, LIFE: false, SENTIENCE: false, LOGOS: false },
    K: [cap('PERSIST', 0.7)],
  }),
  createEntity('star', 'Star', 'Massive luminous sphere of plasma', 'INERT', {
    C: 0.8, S: 0.99,
    Σ: { MATTER: true, LIFE: false, SENTIENCE: false, LOGOS: false },
    K: [cap('PERSIST', 0.99)],
  }),
  createEntity('atom', 'Atom', 'Fundamental unit of matter', 'INERT', {
    C: 0.95, S: 0.1,
    Σ: { MATTER: true, LIFE: false, SENTIENCE: false, LOGOS: false },
    K: [cap('PERSIST', 0.99)],
  }),
  createEntity('crystal', 'Crystal', 'Solid with ordered atomic structure', 'INERT', {
    C: 0.85, S: 0.2,
    Σ: { MATTER: true, LIFE: false, SENTIENCE: false, LOGOS: false },
    K: [cap('PERSIST', 0.9)],
  }),
  createEntity('mountain', 'Mountain', 'Large landform rising above surroundings', 'INERT', {
    C: 0.7, S: 0.4,
    Σ: { MATTER: true, LIFE: false, SENTIENCE: false, LOGOS: false },
    K: [cap('PERSIST', 0.85)],
  }),
  createEntity('river', 'River', 'Natural flowing watercourse', 'INERT', {
    C: 0.4, S: 0.6,
    Σ: { MATTER: true, LIFE: false, SENTIENCE: false, LOGOS: false },
    K: [cap('PERSIST', 0.7)],
  }),
];

// ==================== LIVING DOMAIN (Biological) ====================

export const LIVING_ENTITIES: Entity[] = [
  createEntity('cell', 'Cell', 'Basic unit of life', 'LIVING', {
    C: 0.7, S: 0.2,
    Σ: { MATTER: true, LIFE: true, SENTIENCE: false, LOGOS: false },
    K: [cap('PERSIST', 0.8), cap('SELF_PRODUCE', 0.9)],
  }),
  createEntity('bacterium', 'Bacterium', 'Single-celled prokaryotic organism', 'LIVING', {
    C: 0.75, S: 0.3,
    Σ: { MATTER: true, LIFE: true, SENTIENCE: false, LOGOS: false },
    K: [cap('PERSIST', 0.8), cap('SELF_PRODUCE', 0.95)],
  }),
  createEntity('tree', 'Tree', 'Perennial woody plant', 'LIVING', {
    C: 0.6, S: 0.4,
    Σ: { MATTER: true, LIFE: true, SENTIENCE: false, LOGOS: false },
    K: [cap('PERSIST', 0.85), cap('SELF_PRODUCE', 0.8)],
  }),
  createEntity('ecosystem', 'Ecosystem', 'Community of interacting organisms', 'LIVING', {
    C: 0.5, S: 0.8,
    Σ: { MATTER: true, LIFE: true, SENTIENCE: false, LOGOS: false },
    K: [cap('PERSIST', 0.7), cap('SELF_PRODUCE', 0.6)],
  }),
  createEntity('virus', 'Virus', 'Infectious agent requiring host', 'LIVING', {
    C: 0.2, S: 0.5,
    Σ: { MATTER: true, LIFE: true, SENTIENCE: false, LOGOS: false },
    K: [cap('PERSIST', 0.5), cap('SELF_PRODUCE', 0.3)],
    U: { life_status: 0.5 },
  }),
  createEntity('fungus', 'Fungus', 'Spore-producing organism', 'LIVING', {
    C: 0.65, S: 0.4,
    Σ: { MATTER: true, LIFE: true, SENTIENCE: false, LOGOS: false },
    K: [cap('PERSIST', 0.8), cap('SELF_PRODUCE', 0.85)],
  }),
  createEntity('coral', 'Coral', 'Marine invertebrate colony', 'LIVING', {
    C: 0.55, S: 0.3,
    Σ: { MATTER: true, LIFE: true, SENTIENCE: 0.1, LOGOS: false },
    K: [cap('PERSIST', 0.75), cap('SELF_PRODUCE', 0.7)],
  }),
];

// ==================== SENTIENT DOMAIN (Conscious) ====================

export const SENTIENT_ENTITIES: Entity[] = [
  createEntity('dog', 'Dog', 'Domesticated canine companion', 'SENTIENT', {
    C: 0.4, S: 0.5,
    Σ: { MATTER: true, LIFE: true, SENTIENCE: true, LOGOS: false },
    K: [cap('PERSIST', 0.8), cap('SELF_PRODUCE', 0.7), cap('FEEL', 0.9), cap('EVALUATE', 0.7)],
  }),
  createEntity('octopus', 'Octopus', 'Intelligent cephalopod', 'SENTIENT', {
    C: 0.6, S: 0.4,
    Σ: { MATTER: true, LIFE: true, SENTIENCE: true, LOGOS: 0.2 },
    K: [cap('PERSIST', 0.7), cap('SELF_PRODUCE', 0.7), cap('FEEL', 0.85), cap('EVALUATE', 0.8)],
  }),
  createEntity('human', 'Human', 'Homo sapiens individual', 'SENTIENT', {
    C: 0.5, S: 0.9,
    Σ: { MATTER: true, LIFE: true, SENTIENCE: true, LOGOS: true },
    K: [cap('PERSIST', 0.7), cap('SELF_PRODUCE', 0.6), cap('FEEL', 0.95), cap('EVALUATE', 0.9), cap('REPRESENT', 0.95), cap('NORM', 0.85)],
  }),
  createEntity('crow', 'Crow', 'Highly intelligent corvid bird', 'SENTIENT', {
    C: 0.5, S: 0.4,
    Σ: { MATTER: true, LIFE: true, SENTIENCE: true, LOGOS: 0.3 },
    K: [cap('PERSIST', 0.75), cap('SELF_PRODUCE', 0.7), cap('FEEL', 0.8), cap('EVALUATE', 0.75), cap('REPRESENT', 0.4)],
  }),
  createEntity('dolphin', 'Dolphin', 'Highly intelligent marine mammal', 'SENTIENT', {
    C: 0.45, S: 0.5,
    Σ: { MATTER: true, LIFE: true, SENTIENCE: true, LOGOS: 0.4 },
    K: [cap('PERSIST', 0.75), cap('SELF_PRODUCE', 0.7), cap('FEEL', 0.9), cap('EVALUATE', 0.85), cap('REPRESENT', 0.5)],
  }),
  createEntity('elephant', 'Elephant', 'Large mammal with complex cognition', 'SENTIENT', {
    C: 0.4, S: 0.6,
    Σ: { MATTER: true, LIFE: true, SENTIENCE: true, LOGOS: 0.35 },
    K: [cap('PERSIST', 0.8), cap('SELF_PRODUCE', 0.65), cap('FEEL', 0.9), cap('EVALUATE', 0.8), cap('REPRESENT', 0.45)],
  }),
  createEntity('bee', 'Bee', 'Social insect with collective intelligence', 'SENTIENT', {
    C: 0.3, S: 0.3,
    Σ: { MATTER: true, LIFE: true, SENTIENCE: 0.6, LOGOS: false },
    K: [cap('PERSIST', 0.7), cap('SELF_PRODUCE', 0.75), cap('FEEL', 0.5), cap('EVALUATE', 0.6)],
  }),
];

// ==================== SYMBOLIC DOMAIN (Cultural) ====================

export const SYMBOLIC_ENTITIES: Entity[] = [
  createEntity('language', 'Language', 'System of conventional signs', 'SYMBOLIC', {
    C: 0.6, S: 0.95,
    Σ: { MATTER: false, LIFE: false, SENTIENCE: false, LOGOS: true },
    K: [cap('PERSIST', 0.9), cap('REPRESENT', 0.99)],
  }),
  createEntity('myth', 'Myth', 'Traditional narrative explaining origins', 'SYMBOLIC', {
    C: 0.7, S: 0.7,
    Σ: { MATTER: false, LIFE: false, SENTIENCE: false, LOGOS: true },
    K: [cap('PERSIST', 0.8), cap('REPRESENT', 0.9)],
  }),
  createEntity('meme', 'Meme', 'Unit of cultural transmission', 'SYMBOLIC', {
    C: 0.2, S: 0.8,
    Σ: { MATTER: false, LIFE: false, SENTIENCE: false, LOGOS: true },
    K: [cap('PERSIST', 0.5), cap('REPRESENT', 0.85)],
  }),
  createEntity('art', 'Art', 'Creative expression with aesthetic intent', 'SYMBOLIC', {
    C: 0.65, S: 0.85,
    Σ: { MATTER: true, LIFE: false, SENTIENCE: false, LOGOS: true },
    K: [cap('PERSIST', 0.75), cap('REPRESENT', 0.95)],
  }),
  createEntity('music', 'Music', 'Organized sound with meaning', 'SYMBOLIC', {
    C: 0.5, S: 0.9,
    Σ: { MATTER: true, LIFE: false, SENTIENCE: false, LOGOS: true },
    K: [cap('PERSIST', 0.7), cap('REPRESENT', 0.9)],
  }),
  createEntity('ritual', 'Ritual', 'Symbolic repeated action', 'SYMBOLIC', {
    C: 0.55, S: 0.6,
    Σ: { MATTER: true, LIFE: false, SENTIENCE: false, LOGOS: true },
    K: [cap('PERSIST', 0.8), cap('REPRESENT', 0.85), cap('NORM', 0.7)],
  }),
  createEntity('story', 'Story', 'Narrative sequence of events', 'SYMBOLIC', {
    C: 0.6, S: 0.85,
    Σ: { MATTER: false, LIFE: false, SENTIENCE: false, LOGOS: true },
    K: [cap('PERSIST', 0.75), cap('REPRESENT', 0.95)],
  }),
];

// ==================== COLLECTIVE DOMAIN (Institutional) ====================

export const COLLECTIVE_ENTITIES: Entity[] = [
  createEntity('family', 'Family', 'Primary social unit', 'COLLECTIVE', {
    C: 0.5, S: 0.4,
    Σ: { MATTER: true, LIFE: true, SENTIENCE: true, LOGOS: true },
    K: [cap('PERSIST', 0.7), cap('SELF_PRODUCE', 0.6), cap('REPRESENT', 0.7), cap('NORM', 0.8)],
  }),
  createEntity('nation', 'Nation', 'Large political community', 'COLLECTIVE', {
    C: 0.6, S: 0.9,
    Σ: { MATTER: true, LIFE: false, SENTIENCE: false, LOGOS: true },
    K: [cap('PERSIST', 0.8), cap('REPRESENT', 0.9), cap('NORM', 0.95)],
  }),
  createEntity('company', 'Company', 'Business organization', 'COLLECTIVE', {
    C: 0.55, S: 0.7,
    Σ: { MATTER: true, LIFE: false, SENTIENCE: false, LOGOS: true },
    K: [cap('PERSIST', 0.65), cap('REPRESENT', 0.8), cap('NORM', 0.85)],
  }),
  createEntity('religion', 'Religion', 'Organized belief system', 'COLLECTIVE', {
    C: 0.7, S: 0.95,
    Σ: { MATTER: true, LIFE: false, SENTIENCE: false, LOGOS: true },
    K: [cap('PERSIST', 0.9), cap('REPRESENT', 0.95), cap('NORM', 0.99)],
  }),
  createEntity('university', 'University', 'Institution of higher learning', 'COLLECTIVE', {
    C: 0.6, S: 0.8,
    Σ: { MATTER: true, LIFE: false, SENTIENCE: false, LOGOS: true },
    K: [cap('PERSIST', 0.85), cap('REPRESENT', 0.95), cap('NORM', 0.8)],
  }),
  createEntity('tribe', 'Tribe', 'Social group with shared identity', 'COLLECTIVE', {
    C: 0.65, S: 0.5,
    Σ: { MATTER: true, LIFE: true, SENTIENCE: true, LOGOS: true },
    K: [cap('PERSIST', 0.75), cap('SELF_PRODUCE', 0.5), cap('REPRESENT', 0.7), cap('NORM', 0.85)],
  }),
  createEntity('market', 'Market', 'Exchange system for goods', 'COLLECTIVE', {
    C: 0.3, S: 0.95,
    Σ: { MATTER: true, LIFE: false, SENTIENCE: false, LOGOS: true },
    K: [cap('PERSIST', 0.6), cap('REPRESENT', 0.85), cap('NORM', 0.7)],
  }),
  createEntity('city', 'City', 'Large permanent settlement', 'COLLECTIVE', {
    C: 0.5, S: 0.85,
    Σ: { MATTER: true, LIFE: true, SENTIENCE: false, LOGOS: true },
    K: [cap('PERSIST', 0.8), cap('SELF_PRODUCE', 0.4), cap('REPRESENT', 0.75), cap('NORM', 0.8)],
  }),
];

// ==================== IDEAL DOMAIN (Abstract) ====================

export const IDEAL_ENTITIES: Entity[] = [
  createEntity('number', 'Number', 'Abstract mathematical object', 'IDEAL', {
    C: 1.0, S: 1.0,
    Σ: { MATTER: false, LIFE: false, SENTIENCE: false, LOGOS: true },
    K: [cap('PERSIST', 1.0), cap('REPRESENT', 0.99)],
  }),
  createEntity('logical_law', 'Logical Law', 'Principle of valid reasoning', 'IDEAL', {
    C: 1.0, S: 1.0,
    Σ: { MATTER: false, LIFE: false, SENTIENCE: false, LOGOS: true },
    K: [cap('PERSIST', 1.0), cap('REPRESENT', 0.99), cap('NORM', 0.99)],
  }),
  createEntity('set', 'Set', 'Collection of distinct objects', 'IDEAL', {
    C: 1.0, S: 1.0,
    Σ: { MATTER: false, LIFE: false, SENTIENCE: false, LOGOS: true },
    K: [cap('PERSIST', 1.0), cap('REPRESENT', 0.95)],
  }),
  createEntity('function', 'Function', 'Mapping between sets', 'IDEAL', {
    C: 1.0, S: 1.0,
    Σ: { MATTER: false, LIFE: false, SENTIENCE: false, LOGOS: true },
    K: [cap('PERSIST', 1.0), cap('REPRESENT', 0.95)],
  }),
  createEntity('truth', 'Truth', 'Correspondence with reality', 'IDEAL', {
    C: 1.0, S: 1.0,
    Σ: { MATTER: false, LIFE: false, SENTIENCE: false, LOGOS: true },
    K: [cap('PERSIST', 1.0), cap('REPRESENT', 0.99), cap('NORM', 0.95)],
  }),
];

// ==================== EPHEMERAL DOMAIN (Event-like) ====================

export const EPHEMERAL_ENTITIES: Entity[] = [
  createEntity('conversation', 'Conversation', 'Verbal exchange between agents', 'EPHEMERAL', {
    C: 0.3, S: 0.4,
    Σ: { MATTER: true, LIFE: false, SENTIENCE: true, LOGOS: true },
    K: [cap('PERSIST', 0.2), cap('REPRESENT', 0.9)],
  }),
  createEntity('dream', 'Dream', 'Subjective experience during sleep', 'EPHEMERAL', {
    C: 0.8, S: 0.2,
    Σ: { MATTER: true, LIFE: true, SENTIENCE: true, LOGOS: 0.5 },
    K: [cap('PERSIST', 0.1), cap('FEEL', 0.9), cap('REPRESENT', 0.7)],
  }),
  createEntity('thought', 'Thought', 'Mental representation or process', 'EPHEMERAL', {
    C: 0.7, S: 0.3,
    Σ: { MATTER: true, LIFE: true, SENTIENCE: true, LOGOS: true },
    K: [cap('PERSIST', 0.1), cap('REPRESENT', 0.95)],
  }),
  createEntity('emotion', 'Emotion', 'Affective state with valence', 'EPHEMERAL', {
    C: 0.5, S: 0.4,
    Σ: { MATTER: true, LIFE: true, SENTIENCE: true, LOGOS: false },
    K: [cap('PERSIST', 0.2), cap('FEEL', 0.99), cap('EVALUATE', 0.9)],
  }),
  createEntity('meeting', 'Meeting', 'Organized gathering of people', 'EPHEMERAL', {
    C: 0.4, S: 0.3,
    Σ: { MATTER: true, LIFE: false, SENTIENCE: false, LOGOS: true },
    K: [cap('PERSIST', 0.15), cap('REPRESENT', 0.7), cap('NORM', 0.6)],
  }),
  createEntity('performance', 'Performance', 'Live artistic presentation', 'EPHEMERAL', {
    C: 0.6, S: 0.5,
    Σ: { MATTER: true, LIFE: true, SENTIENCE: true, LOGOS: true },
    K: [cap('PERSIST', 0.1), cap('FEEL', 0.8), cap('REPRESENT', 0.9)],
  }),
];

// ==================== ARTIFICIAL DOMAIN (Human-made) ====================

export const ARTIFICIAL_ENTITIES: Entity[] = [
  createEntity('tool', 'Tool', 'Object made for a purpose', 'ARTIFICIAL', {
    C: 0.1, S: 0.4,
    Σ: { MATTER: true, LIFE: false, SENTIENCE: false, LOGOS: false },
    K: [cap('PERSIST', 0.7)],
  }),
  createEntity('software', 'Software', 'Computer program', 'ARTIFICIAL', {
    C: 0.3, S: 0.7,
    Σ: { MATTER: true, LIFE: false, SENTIENCE: false, LOGOS: true },
    K: [cap('PERSIST', 0.6), cap('REPRESENT', 0.85)],
  }),
  createEntity('ai_system', 'AI System', 'Artificial intelligence system', 'ARTIFICIAL', {
    C: 0.4, S: 0.8,
    Σ: { MATTER: true, LIFE: 0.3, SENTIENCE: 0.5, LOGOS: true },
    K: [cap('PERSIST', 0.7), cap('SELF_PRODUCE', 0.4), cap('EVALUATE', 0.7), cap('REPRESENT', 0.9), cap('NORM', 0.6)],
    U: { sentience: 0.5, life: 0.5 },
  }),
  createEntity('robot', 'Robot', 'Autonomous mechanical agent', 'ARTIFICIAL', {
    C: 0.35, S: 0.5,
    Σ: { MATTER: true, LIFE: false, SENTIENCE: 0.2, LOGOS: 0.6 },
    K: [cap('PERSIST', 0.75), cap('EVALUATE', 0.5), cap('REPRESENT', 0.7)],
  }),
  createEntity('book', 'Book', 'Written work in physical form', 'ARTIFICIAL', {
    C: 0.8, S: 0.6,
    Σ: { MATTER: true, LIFE: false, SENTIENCE: false, LOGOS: true },
    K: [cap('PERSIST', 0.85), cap('REPRESENT', 0.95)],
  }),
  createEntity('building', 'Building', 'Permanent structure for occupation', 'ARTIFICIAL', {
    C: 0.7, S: 0.4,
    Σ: { MATTER: true, LIFE: false, SENTIENCE: false, LOGOS: false },
    K: [cap('PERSIST', 0.9)],
  }),
  createEntity('internet', 'Internet', 'Global network of networks', 'ARTIFICIAL', {
    C: 0.2, S: 0.99,
    Σ: { MATTER: true, LIFE: false, SENTIENCE: false, LOGOS: true },
    K: [cap('PERSIST', 0.8), cap('REPRESENT', 0.9)],
  }),
  createEntity('database', 'Database', 'Organized collection of data', 'ARTIFICIAL', {
    C: 0.4, S: 0.7,
    Σ: { MATTER: true, LIFE: false, SENTIENCE: false, LOGOS: true },
    K: [cap('PERSIST', 0.85), cap('REPRESENT', 0.9)],
  }),
];

// ==================== ATLAS SELF-CHARACTERIZATION ====================

export const ATLAS_SELF: Entity = createEntity(
  'atlas',
  'Atlas',
  'Entity Characterization Framework - A framework for characterizing any entity through Closure, Scope, and Strata',
  'ARTIFICIAL',
  {
    C: 0.45,
    S: 0.95,
    Σ: { MATTER: true, LIFE: false, SENTIENCE: false, LOGOS: true },
    K: [cap('PERSIST', 0.8), cap('REPRESENT', 0.95), cap('NORM', 0.9)],
    R: [
      rel('instantiates', 'ecf_axioms', 0.95, 'ECF Axioms'),
      rel('contains', 'entity_catalog', 0.9, 'Entity Catalog'),
    ],
    U: { self_characterization: 0.3 },
  }
);

// ==================== CATALOG MANAGEMENT ====================

/**
 * Complete catalog
 */
export const ENTITY_CATALOG: Entity[] = [
  ...INERT_ENTITIES,
  ...LIVING_ENTITIES,
  ...SENTIENT_ENTITIES,
  ...SYMBOLIC_ENTITIES,
  ...COLLECTIVE_ENTITIES,
  ...IDEAL_ENTITIES,
  ...EPHEMERAL_ENTITIES,
  ...ARTIFICIAL_ENTITIES,
  ATLAS_SELF,
];

/**
 * Entity Catalog Manager
 */
export class EntityCatalog {
  private entities: Map<string, Entity> = new Map();

  constructor() {
    // Load default catalog
    for (const entity of ENTITY_CATALOG) {
      this.entities.set(entity.id, entity);
    }
  }

  /**
   * Get entity by ID
   */
  get(id: string): Entity | null {
    return this.entities.get(id) || null;
  }

  /**
   * Get all entities
   */
  getAll(): Entity[] {
    return Array.from(this.entities.values());
  }

  /**
   * Get entities by domain
   */
  getByDomain(domain: Domain): Entity[] {
    return this.getAll().filter(e => e.domain === domain);
  }

  /**
   * Get entities by stratum
   */
  getByStratum(stratum: string): Entity[] {
    return this.getAll().filter(e => {
      const participation = (e.config.Σ as any)[stratum];
      return participation === true || (typeof participation === 'number' && participation > 0.5);
    });
  }

  /**
   * Get entities with capability
   */
  getWithCapability(capability: string): Entity[] {
    return this.getAll().filter(e =>
      e.config.K.some(k => k.capability === capability && k.proficiency > 0.5)
    );
  }

  /**
   * Add entity to catalog
   */
  add(entity: Entity): void {
    this.entities.set(entity.id, entity);
  }

  /**
   * Update entity
   */
  update(id: string, updates: Partial<Entity>): boolean {
    const entity = this.entities.get(id);
    if (!entity) return false;

    const updated = { ...entity, ...updates };
    updated.metadata.lastUpdated = new Date().toISOString();
    this.entities.set(id, updated);
    return true;
  }

  /**
   * Find similar entities
   */
  findSimilar(entityOrId: Entity | string, limit: number = 5): Entity[] {
    // Handle both Entity and entityId
    const entity = typeof entityOrId === 'string'
      ? this.entities.get(entityOrId)
      : entityOrId;

    if (!entity) return [];

    const scores: Array<{ entity: Entity; score: number }> = [];

    for (const other of this.entities.values()) {
      if (other.id === entity.id) continue;

      let score = 0;

      // Same domain
      if (other.domain === entity.domain) score += 0.3;

      // Similar closure
      const closureDiff = Math.abs(other.config.C - entity.config.C);
      score += (1 - closureDiff) * 0.2;

      // Similar scope
      const scopeDiff = Math.abs(other.config.S - entity.config.S);
      score += (1 - scopeDiff) * 0.2;

      // Shared strata
      const otherStrata = Object.entries(other.config.Σ).filter(([, v]) => v).map(([k]) => k);
      const entityStrata = Object.entries(entity.config.Σ).filter(([, v]) => v).map(([k]) => k);
      const sharedStrata = otherStrata.filter(s => entityStrata.includes(s));
      score += (sharedStrata.length / 4) * 0.3;

      scores.push({ entity: other, score });
    }

    return scores
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(s => s.entity);
  }

  /**
   * Get catalog statistics
   */
  getStats(): {
    total: number;
    byDomain: Record<Domain, number>;
    avgClosure: number;
    avgScope: number;
  } {
    const all = this.getAll();
    const byDomain: Record<string, number> = {};

    for (const domain of ALL_DOMAINS) {
      byDomain[domain] = this.getByDomain(domain).length;
    }

    const avgClosure = all.reduce((sum, e) => sum + e.config.C, 0) / all.length;
    const avgScope = all.reduce((sum, e) => sum + e.config.S, 0) / all.length;

    return {
      total: all.length,
      byDomain: byDomain as Record<Domain, number>,
      avgClosure,
      avgScope,
    };
  }
}

// Singleton instance
let catalogInstance: EntityCatalog | null = null;

export function getEntityCatalog(): EntityCatalog {
  if (!catalogInstance) {
    catalogInstance = new EntityCatalog();
  }
  return catalogInstance;
}
