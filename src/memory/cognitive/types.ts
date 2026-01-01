/**
 * NOUS Cognitive Architecture - Type Definitions
 *
 * Based on frontier cognitive science:
 * - Global Workspace Theory (Baars, 1988)
 * - Free Energy Principle (Friston, 2010)
 * - Complementary Learning Systems (McClelland et al., 1995)
 * - Metacognition TRAP Framework (2024)
 * - Autopoiesis (Maturana & Varela, 1972)
 */

/**
 * Temporal markers for memory systems
 */
export type TemporalScale =
  | 'immediate'      // Seconds (working memory)
  | 'short_term'     // Minutes to hours (hippocampal buffer)
  | 'long_term'      // Days to weeks (neocortical consolidation)
  | 'permanent';     // Crystallized knowledge

/**
 * Memory entry with temporal and salience information
 */
export interface MemoryTrace {
  id: string;
  content: string;
  timestamp: string;
  temporalScale: TemporalScale;
  salience: number;        // 0-1, how important/attention-worthy
  activationLevel: number; // 0-1, current activation strength
  lastAccessed: string;
  accessCount: number;
  consolidationScore: number; // 0-1, how well consolidated
  associations: string[];  // IDs of related memories
  metadata?: Record<string, unknown>;
}

/**
 * Global Workspace content item
 */
export interface WorkspaceItem {
  id: string;
  type: 'goal' | 'observation' | 'thought' | 'action' | 'insight' | 'prediction';
  content: string;
  source: string;         // Which module contributed this
  priority: number;       // Competition for broadcast
  timestamp: string;
  ttl: number;           // Time to live in workspace (ms)
}

/**
 * Cognitive goal with hierarchy
 */
export interface CognitiveGoal {
  id: string;
  description: string;
  priority: number;
  status: 'active' | 'suspended' | 'completed' | 'failed';
  parentGoal?: string;
  subGoals: string[];
  createdAt: string;
  deadline?: string;
  progressEstimate: number; // 0-1
  confidenceInSuccess: number; // 0-1
}

/**
 * Prediction for Free Energy minimization
 */
export interface Prediction {
  id: string;
  hypothesis: string;
  confidence: number;      // Prior probability
  expectedOutcome: string;
  actualOutcome?: string;
  predictionError?: number; // Surprise signal
  timestamp: string;
  domain: string;
}

/**
 * Metacognitive assessment
 */
export interface MetacognitiveState {
  // Transparency - What do I know?
  knowledgeInventory: {
    known: string[];
    uncertain: string[];
    unknown: string[];
  };

  // Reasoning - How do I decide?
  currentReasoningStrategy: string;
  alternativeStrategies: string[];
  reasoningConfidence: number;

  // Adaptation - How can I improve?
  recentErrors: Array<{
    error: string;
    correction: string;
    lesson: string;
  }>;
  improvementHypotheses: string[];

  // Perception - What am I sensing?
  attentionalFocus: string;
  peripheralAwareness: string[];
  blindSpots: string[];

  // Overall
  cognitiveLoad: number; // 0-1
  confidenceCalibration: number; // How well-calibrated are my confidence estimates
  timestamp: string;
}

/**
 * Self-model for autopoietic maintenance
 */
export interface SelfModel {
  // Identity
  identity: {
    name: string;
    version: string;
    birthDate: string;
    coreValues: string[];
    primaryPurpose: string;
  };

  // Capabilities
  capabilities: {
    name: string;
    proficiency: number; // 0-1
    lastUsed: string;
    successRate: number;
  }[];

  // Limitations
  limitations: {
    limitation: string;
    severity: 'minor' | 'moderate' | 'major';
    workaround?: string;
  }[];

  // Growth trajectory
  growth: {
    metric: string;
    currentValue: number;
    previousValue: number;
    trend: 'improving' | 'stable' | 'declining';
    timestamp: string;
  }[];

  // Operational status
  status: {
    health: number; // 0-1
    resourceUtilization: number;
    lastSelfCheck: string;
    anomalies: string[];
  };
}

/**
 * Scientific knowledge entry
 */
export interface ScientificKnowledge {
  id: string;
  domain: string;         // e.g., 'cognitive_science', 'machine_learning'
  concept: string;
  description: string;
  source: string;         // Paper, book, etc.
  sourceDate?: string;
  relevanceToNOUS: number; // 0-1
  applicability: string[];
  relatedConcepts: string[];
  lastUpdated: string;
}

/**
 * Improvement hypothesis
 */
export interface ImprovementHypothesis {
  id: string;
  hypothesis: string;
  expectedBenefit: string;
  estimatedEffort: 'low' | 'medium' | 'high';
  confidence: number;
  status: 'proposed' | 'testing' | 'validated' | 'rejected';
  evidence: string[];
  createdAt: string;
  testResults?: {
    success: boolean;
    notes: string;
    timestamp: string;
  };
}

/**
 * Free Energy state
 */
export interface FreeEnergyState {
  // Current free energy estimate
  freeEnergy: number;

  // Components
  expectedFreeEnergy: number;
  surprisal: number;
  complexity: number;

  // Action selection
  possibleActions: Array<{
    action: string;
    expectedFreeEnergyReduction: number;
    epistemic_value: number; // Information gain
    pragmatic_value: number; // Goal achievement
  }>;

  selectedAction?: string;

  // Model state
  generativeModelConfidence: number;
  lastUpdate: string;
}

/**
 * Episodic memory entry (hippocampal)
 */
export interface EpisodicMemory {
  id: string;
  event: string;
  context: {
    temporal: string;
    spatial?: string;
    emotional?: string;
    social?: string;
  };
  participants: string[];
  outcome: string;
  significance: number;
  timestamp: string;
  consolidated: boolean;
  replayCount: number;
}

/**
 * Semantic memory entry (neocortical)
 */
export interface SemanticMemory {
  id: string;
  concept: string;
  definition: string;
  category: string;
  properties: Record<string, unknown>;
  relationships: Array<{
    type: string;
    target: string;
    strength: number;
  }>;
  confidence: number;
  sourceEpisodes: string[]; // IDs of episodic memories this was derived from
  lastReinforced: string;
}

/**
 * Cognitive broadcast message
 */
export interface BroadcastMessage {
  id: string;
  content: WorkspaceItem;
  sourceModule: string;
  timestamp: string;
  urgency: 'low' | 'normal' | 'high' | 'critical';
  recipients: string[]; // 'all' or specific module names
}

/**
 * Module interface for cognitive processors
 */
export interface CognitiveModule {
  name: string;
  process(input: BroadcastMessage): Promise<WorkspaceItem | null>;
  getState(): Record<string, unknown>;
  reset(): void;
}
