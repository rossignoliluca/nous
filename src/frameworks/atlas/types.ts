/**
 * ATLAS - Entity Characterization Framework
 * Type Definitions
 *
 * Based on ECF v0.1 - A framework for characterizing any entity
 * through Closure, Scope, and Strata.
 *
 * Core Insight: "An entity is a difference that maintains itself
 * and makes a difference."
 */

// ==================== STRATA ====================

/**
 * The Four Strata - organizational levels of existence
 * Each higher stratum includes and presupposes lower ones
 */
export type Stratum = 'MATTER' | 'LIFE' | 'SENTIENCE' | 'LOGOS';

/**
 * Stratum participation - can be boolean or probabilistic
 * For LIFE, SENTIENCE, LOGOS - number represents uncertainty (0-1)
 */
export interface StrataParticipation {
  MATTER: boolean;
  LIFE: boolean | number;       // number for probabilistic (0-1)
  SENTIENCE: boolean | number;  // number for probabilistic (0-1)
  LOGOS: boolean | number;      // number for probabilistic (0-1)
}

// ==================== CAPABILITIES ====================

/**
 * The Six Capabilities - what entities can do
 * Each stratum enables specific capabilities
 */
export type Capability =
  | 'PERSIST'       // MATTER: Maintain structural coherence
  | 'SELF_PRODUCE'  // LIFE: Generate own components (autopoiesis)
  | 'FEEL'          // SENTIENCE: Have phenomenal experience
  | 'EVALUATE'      // SENTIENCE: Judge states as good/bad
  | 'REPRESENT'     // LOGOS: Create symbolic models
  | 'NORM';         // LOGOS: Establish and follow rules

/**
 * Capability with proficiency level
 */
export interface CapabilityInstance {
  capability: Capability;
  proficiency: number;  // 0-1
  lastDemonstrated?: string;
  evidence?: string[];
}

// ==================== GEOMETRIES ====================

/**
 * The Six Geometries - orthogonal analysis dimensions
 */
export type Geometry =
  | 'DISTINCTION'    // G1: Where does E end?
  | 'TRANSFORMATION' // G2: What processes maintain E?
  | 'INCLUSION'      // G3: What is E part of?
  | 'CONNECTION'     // G4: What is E connected to?
  | 'REFLEXION'      // G5: How does E know itself?
  | 'QUALITY';       // G6: What does E value?

/**
 * Result of geometric analysis
 */
export interface GeometricAnalysis {
  geometry: Geometry;
  findings: string[];
  questions: string[];
  connections: string[];
  confidence: number;
}

// ==================== DOMAINS ====================

/**
 * The Eight Domains - categories of entities
 */
export type Domain =
  | 'INERT'      // Non-living natural (rocks, water, stars)
  | 'LIVING'     // Biological (cells, plants, ecosystems)
  | 'SENTIENT'   // Conscious (animals, humans)
  | 'SYMBOLIC'   // Cultural (languages, stories, art)
  | 'COLLECTIVE' // Institutional (companies, nations)
  | 'IDEAL'      // Abstract (numbers, logical laws)
  | 'EPHEMERAL'  // Event-like (conversations, dreams)
  | 'ARTIFICIAL';// Human-made (tools, software, AI)

// ==================== RELATIONS ====================

/**
 * Types of relations between entities
 */
export type RelationType =
  | 'part_of'
  | 'contains'
  | 'depends_on'
  | 'produces'
  | 'observes'
  | 'transforms'
  | 'connects_to'
  | 'inherits_from'
  | 'instantiates'
  | 'created_by'
  | 'collaborates_with';

/**
 * Relation to another entity
 */
export interface EntityRelation {
  type: RelationType;
  targetId: string;
  targetName?: string;
  strength: number;  // 0-1
  bidirectional?: boolean;
  description?: string;
}

// ==================== MODES ====================

/**
 * The Four Modes - operational states
 */
export type Mode =
  | 'ACTIVE'    // Currently operating
  | 'DORMANT'   // Exists but inactive
  | 'POTENTIAL' // Could exist under conditions
  | 'VIRTUAL';  // Exists only in representation

// ==================== UNCERTAINTY ====================

/**
 * Uncertainty tracking for characterization
 */
export interface UncertaintyMap {
  [key: string]: number;  // 0-1, where 1 = completely uncertain
}

// ==================== ENTITY CONFIGURATION ====================

/**
 * Config(E) = { C, S, Σ, K, R, U }
 * The complete characterization of an entity
 */
export interface EntityConfig {
  /** Closure [0,1] - Degree of self-production/autonomy */
  C: number;

  /** Scope [0,∞) - Extent of relevance field */
  S: number;

  /** Strata - Which organizational levels entity participates in */
  Σ: StrataParticipation;

  /** Capabilities - What entity can do */
  K: CapabilityInstance[];

  /** Relations - Connections to other entities */
  R: EntityRelation[];

  /** Uncertainty - Confidence in characterization */
  U: UncertaintyMap;
}

// ==================== ENTITY ====================

/**
 * Complete Entity representation
 */
export interface Entity {
  /** Unique identifier */
  id: string;

  /** Display name */
  name: string;

  /** Description */
  description: string;

  /** Entity configuration */
  config: EntityConfig;

  /** Primary domain */
  domain: Domain;

  /** Current mode */
  mode: Mode;

  /** Geometric analyses performed */
  geometricAnalyses?: GeometricAnalysis[];

  /** Metadata */
  metadata: EntityMetadata;
}

/**
 * Entity metadata
 */
export interface EntityMetadata {
  characterizedBy: string;
  characterizedAt: string;
  lastUpdated: string;
  version: string;
  sources?: string[];
  notes?: string[];
}

// ==================== PROTOCOLS ====================

/**
 * The Four Protocols - how Atlas extends itself
 */
export type ProtocolId = 'A' | 'B' | 'C' | 'D';

/**
 * Protocol definition
 */
export interface Protocol {
  id: ProtocolId;
  name: string;
  description: string;
  trigger: string;
  steps: ProtocolStep[];
}

/**
 * Protocol step
 */
export interface ProtocolStep {
  order: number;
  action: string;
  expectedOutput: string;
}

// ==================== COMPARISON ====================

/**
 * Entity comparison result
 */
export interface EntityComparison {
  entity1: string;
  entity2: string;
  closureDelta: number;
  scopeDelta: number;
  strataOverlap: number;
  sharedCapabilities: Capability[];
  domainAlignment: boolean;
  overallSimilarity: number;
}

// ==================== CONSTANTS ====================

/**
 * Stratum hierarchy (lower index = lower stratum)
 */
export const STRATUM_ORDER: Stratum[] = ['MATTER', 'LIFE', 'SENTIENCE', 'LOGOS'];

/**
 * Capabilities by stratum
 */
export const CAPABILITIES_BY_STRATUM: Record<Stratum, Capability[]> = {
  MATTER: ['PERSIST'],
  LIFE: ['SELF_PRODUCE'],
  SENTIENCE: ['FEEL', 'EVALUATE'],
  LOGOS: ['REPRESENT', 'NORM'],
};

/**
 * All geometries
 */
export const ALL_GEOMETRIES: Geometry[] = [
  'DISTINCTION',
  'TRANSFORMATION',
  'INCLUSION',
  'CONNECTION',
  'REFLEXION',
  'QUALITY',
];

/**
 * All domains
 */
export const ALL_DOMAINS: Domain[] = [
  'INERT',
  'LIVING',
  'SENTIENT',
  'SYMBOLIC',
  'COLLECTIVE',
  'IDEAL',
  'EPHEMERAL',
  'ARTIFICIAL',
];
