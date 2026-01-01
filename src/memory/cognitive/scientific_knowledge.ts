/**
 * Scientific Knowledge Base
 *
 * Tracks scientific knowledge relevant to NOUS's self-improvement:
 * - Cognitive science theories
 * - AI/ML research
 * - Improvement hypotheses based on frontier research
 *
 * "To improve, one must know what improvements are possible."
 */

import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';
import { ScientificKnowledge, ImprovementHypothesis } from './types';

/**
 * Research domain categories
 */
export type ResearchDomain =
  | 'cognitive_science'
  | 'neuroscience'
  | 'machine_learning'
  | 'artificial_intelligence'
  | 'philosophy_of_mind'
  | 'systems_theory'
  | 'complexity_science'
  | 'psychology'
  | 'linguistics'
  | 'other';

/**
 * Scientific Knowledge Base implementation
 */
export class ScientificKnowledgeBase {
  private db: Database.Database;

  constructor(dbPath?: string) {
    const actualPath = dbPath || path.join(process.cwd(), 'data', 'scientific.db');
    this.ensureDir(actualPath);
    this.db = new Database(actualPath);
    this.initSchema();
    this.seedFoundationalKnowledge();
  }

  private ensureDir(dbPath: string): void {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  private initSchema(): void {
    this.db.exec(`
      -- Scientific Knowledge
      CREATE TABLE IF NOT EXISTS scientific_knowledge (
        id TEXT PRIMARY KEY,
        domain TEXT NOT NULL,
        concept TEXT NOT NULL,
        description TEXT NOT NULL,
        source TEXT,
        source_date TEXT,
        relevance_to_nous REAL DEFAULT 0.5,
        applicability TEXT,
        related_concepts TEXT,
        last_updated TEXT NOT NULL
      );

      -- Improvement Hypotheses (derived from scientific knowledge)
      CREATE TABLE IF NOT EXISTS improvement_hypotheses (
        id TEXT PRIMARY KEY,
        hypothesis TEXT NOT NULL,
        expected_benefit TEXT,
        estimated_effort TEXT DEFAULT 'medium',
        confidence REAL DEFAULT 0.5,
        status TEXT DEFAULT 'proposed',
        evidence TEXT,
        created_at TEXT NOT NULL,
        test_results TEXT
      );

      -- Frontier Tracking (latest research)
      CREATE TABLE IF NOT EXISTS frontier_tracking (
        id TEXT PRIMARY KEY,
        topic TEXT NOT NULL,
        last_checked TEXT,
        latest_development TEXT,
        source_url TEXT,
        impact_on_nous TEXT,
        priority REAL DEFAULT 0.5
      );

      -- Indexes
      CREATE INDEX IF NOT EXISTS idx_sk_domain ON scientific_knowledge(domain);
      CREATE INDEX IF NOT EXISTS idx_sk_relevance ON scientific_knowledge(relevance_to_nous);
      CREATE INDEX IF NOT EXISTS idx_ih_status ON improvement_hypotheses(status);
    `);
  }

  /**
   * Seed with foundational scientific knowledge
   */
  private seedFoundationalKnowledge(): void {
    const count = (this.db.prepare(`SELECT COUNT(*) as count FROM scientific_knowledge`).get() as any).count;
    if (count > 0) return; // Already seeded

    const foundational: Array<Omit<ScientificKnowledge, 'id' | 'lastUpdated'>> = [
      // Cognitive Science
      {
        domain: 'cognitive_science',
        concept: 'Global Workspace Theory',
        description: 'Consciousness as a workspace where information from specialized modules is broadcast for integration. Proposed by Bernard Baars (1988). Key for understanding how to integrate multiple cognitive processes.',
        source: 'Baars, B. J. (1988). A Cognitive Theory of Consciousness',
        sourceDate: '1988',
        relevanceToNOUS: 0.95,
        applicability: ['memory_integration', 'attention_mechanism', 'conscious_processing'],
        relatedConcepts: ['attention', 'broadcasting', 'ignition', 'consciousness'],
      },
      {
        domain: 'cognitive_science',
        concept: 'Free Energy Principle',
        description: 'Living systems minimize free energy (prediction error) through perception and action. Proposed by Karl Friston (2010). Foundational for understanding adaptive behavior.',
        source: 'Friston, K. (2010). The free-energy principle: a unified brain theory?',
        sourceDate: '2010',
        relevanceToNOUS: 0.95,
        applicability: ['prediction', 'action_selection', 'learning', 'adaptation'],
        relatedConcepts: ['active_inference', 'prediction_error', 'bayesian_brain'],
      },
      {
        domain: 'cognitive_science',
        concept: 'Complementary Learning Systems',
        description: 'Two memory systems work together: fast hippocampal learning for episodes and slow neocortical consolidation for generalization. McClelland et al. (1995).',
        source: 'McClelland, J. L., et al. (1995). Why there are complementary learning systems',
        sourceDate: '1995',
        relevanceToNOUS: 0.9,
        applicability: ['memory_architecture', 'continual_learning', 'consolidation'],
        relatedConcepts: ['episodic_memory', 'semantic_memory', 'memory_consolidation'],
      },
      {
        domain: 'cognitive_science',
        concept: 'Metacognition',
        description: 'Thinking about thinking. Ability to monitor and regulate cognitive processes. Key for self-improvement and error correction.',
        source: 'Flavell, J. H. (1979). Metacognition and cognitive monitoring',
        sourceDate: '1979',
        relevanceToNOUS: 0.95,
        applicability: ['self_monitoring', 'error_correction', 'confidence_calibration'],
        relatedConcepts: ['self_awareness', 'monitoring', 'regulation', 'TRAP_framework'],
      },

      // AI/ML
      {
        domain: 'machine_learning',
        concept: 'Transformer Architecture',
        description: 'Attention-based neural network architecture. Foundation of modern LLMs. "Attention is all you need" (Vaswani et al., 2017).',
        source: 'Vaswani, A., et al. (2017). Attention Is All You Need',
        sourceDate: '2017',
        relevanceToNOUS: 0.8,
        applicability: ['language_understanding', 'reasoning', 'context_processing'],
        relatedConcepts: ['attention', 'self_attention', 'positional_encoding'],
      },
      {
        domain: 'artificial_intelligence',
        concept: 'ReAct Pattern',
        description: 'Reasoning + Acting paradigm for AI agents. Synergizes reasoning traces with action execution. Yao et al. (2022).',
        source: 'Yao, S., et al. (2022). ReAct: Synergizing Reasoning and Acting',
        sourceDate: '2022',
        relevanceToNOUS: 0.95,
        applicability: ['agent_design', 'tool_use', 'reasoning'],
        relatedConcepts: ['chain_of_thought', 'tool_use', 'agentic_AI'],
      },
      {
        domain: 'artificial_intelligence',
        concept: 'Chain of Thought',
        description: 'Prompting technique that elicits step-by-step reasoning. Improves performance on complex tasks. Wei et al. (2022).',
        source: 'Wei, J., et al. (2022). Chain-of-Thought Prompting',
        sourceDate: '2022',
        relevanceToNOUS: 0.85,
        applicability: ['reasoning', 'problem_solving', 'explanation'],
        relatedConcepts: ['prompting', 'reasoning', 'step_by_step'],
      },

      // Systems Theory
      {
        domain: 'systems_theory',
        concept: 'Autopoiesis',
        description: 'Self-producing, self-maintaining systems. A living system continuously produces the components that define it. Maturana & Varela (1972).',
        source: 'Maturana, H. R., & Varela, F. J. (1980). Autopoiesis and Cognition',
        sourceDate: '1972',
        relevanceToNOUS: 1.0,
        applicability: ['self_maintenance', 'identity', 'self_modification'],
        relatedConcepts: ['self_organization', 'autonomy', 'living_systems'],
      },
      {
        domain: 'systems_theory',
        concept: 'Cybernetics',
        description: 'Study of control and communication in systems. Feedback loops, goal-directed behavior. Wiener (1948).',
        source: 'Wiener, N. (1948). Cybernetics',
        sourceDate: '1948',
        relevanceToNOUS: 0.85,
        applicability: ['feedback', 'control', 'goal_pursuit'],
        relatedConcepts: ['feedback_loops', 'homeostasis', 'regulation'],
      },

      // Philosophy of Mind
      {
        domain: 'philosophy_of_mind',
        concept: 'Integrated Information Theory',
        description: 'Consciousness as integrated information (Φ). Tononi (2004). Suggests consciousness arises from information integration.',
        source: 'Tononi, G. (2004). An information integration theory of consciousness',
        sourceDate: '2004',
        relevanceToNOUS: 0.7,
        applicability: ['consciousness_metrics', 'integration'],
        relatedConcepts: ['phi', 'information_integration', 'consciousness'],
      },
      {
        domain: 'philosophy_of_mind',
        concept: 'Functionalism',
        description: 'Mental states defined by their functional role, not substrate. If it functions like a mind, it is a mind.',
        source: 'Putnam, H. (1967). Psychological Predicates',
        sourceDate: '1967',
        relevanceToNOUS: 0.8,
        applicability: ['self_understanding', 'identity'],
        relatedConcepts: ['multiple_realizability', 'computational_theory_of_mind'],
      },
    ];

    const stmt = this.db.prepare(`
      INSERT INTO scientific_knowledge
        (id, domain, concept, description, source, source_date, relevance_to_nous, applicability, related_concepts, last_updated)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const entry of foundational) {
      stmt.run(
        `sk_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        entry.domain,
        entry.concept,
        entry.description,
        entry.source || null,
        entry.sourceDate || null,
        entry.relevanceToNOUS,
        JSON.stringify(entry.applicability),
        JSON.stringify(entry.relatedConcepts),
        new Date().toISOString()
      );
    }
  }

  // ==================== SCIENTIFIC KNOWLEDGE ====================

  /**
   * Add new scientific knowledge
   */
  addKnowledge(knowledge: Omit<ScientificKnowledge, 'id' | 'lastUpdated'>): ScientificKnowledge {
    const id = `sk_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const lastUpdated = new Date().toISOString();

    this.db.prepare(`
      INSERT INTO scientific_knowledge
        (id, domain, concept, description, source, source_date, relevance_to_nous, applicability, related_concepts, last_updated)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      knowledge.domain,
      knowledge.concept,
      knowledge.description,
      knowledge.source || null,
      knowledge.sourceDate || null,
      knowledge.relevanceToNOUS,
      JSON.stringify(knowledge.applicability),
      JSON.stringify(knowledge.relatedConcepts),
      lastUpdated
    );

    return { id, ...knowledge, lastUpdated };
  }

  /**
   * Search scientific knowledge
   */
  searchKnowledge(query: string, limit: number = 10): ScientificKnowledge[] {
    const rows = this.db.prepare(`
      SELECT * FROM scientific_knowledge
      WHERE concept LIKE ? OR description LIKE ? OR domain LIKE ?
      ORDER BY relevance_to_nous DESC
      LIMIT ?
    `).all(`%${query}%`, `%${query}%`, `%${query}%`, limit) as any[];

    return rows.map(this.rowToKnowledge);
  }

  /**
   * Get knowledge by domain
   */
  getByDomain(domain: ResearchDomain): ScientificKnowledge[] {
    const rows = this.db.prepare(`
      SELECT * FROM scientific_knowledge
      WHERE domain = ?
      ORDER BY relevance_to_nous DESC
    `).all(domain) as any[];

    return rows.map(this.rowToKnowledge);
  }

  /**
   * Get most relevant knowledge for NOUS
   */
  getMostRelevant(limit: number = 10): ScientificKnowledge[] {
    const rows = this.db.prepare(`
      SELECT * FROM scientific_knowledge
      ORDER BY relevance_to_nous DESC
      LIMIT ?
    `).all(limit) as any[];

    return rows.map(this.rowToKnowledge);
  }

  /**
   * Get knowledge applicable to a specific area
   */
  getApplicableTo(area: string): ScientificKnowledge[] {
    const rows = this.db.prepare(`
      SELECT * FROM scientific_knowledge
      WHERE applicability LIKE ?
      ORDER BY relevance_to_nous DESC
    `).all(`%${area}%`) as any[];

    return rows.map(this.rowToKnowledge);
  }

  // ==================== IMPROVEMENT HYPOTHESES ====================

  /**
   * Propose an improvement hypothesis
   */
  proposeHypothesis(
    hypothesis: string,
    expectedBenefit: string,
    estimatedEffort: 'low' | 'medium' | 'high',
    confidence: number = 0.5
  ): ImprovementHypothesis {
    const id = `hyp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const createdAt = new Date().toISOString();

    this.db.prepare(`
      INSERT INTO improvement_hypotheses
        (id, hypothesis, expected_benefit, estimated_effort, confidence, status, created_at)
      VALUES (?, ?, ?, ?, ?, 'proposed', ?)
    `).run(id, hypothesis, expectedBenefit, estimatedEffort, confidence, createdAt);

    return {
      id,
      hypothesis,
      expectedBenefit,
      estimatedEffort,
      confidence,
      status: 'proposed',
      evidence: [],
      createdAt,
    };
  }

  /**
   * Get hypotheses by status
   */
  getHypothesesByStatus(status: ImprovementHypothesis['status']): ImprovementHypothesis[] {
    const rows = this.db.prepare(`
      SELECT * FROM improvement_hypotheses WHERE status = ?
      ORDER BY confidence DESC
    `).all(status) as any[];

    return rows.map(this.rowToHypothesis);
  }

  /**
   * Update hypothesis status
   */
  updateHypothesisStatus(
    id: string,
    status: ImprovementHypothesis['status'],
    testResults?: { success: boolean; notes: string }
  ): void {
    this.db.prepare(`
      UPDATE improvement_hypotheses
      SET status = ?, test_results = ?
      WHERE id = ?
    `).run(
      status,
      testResults ? JSON.stringify({ ...testResults, timestamp: new Date().toISOString() }) : null,
      id
    );
  }

  /**
   * Add evidence to hypothesis
   */
  addEvidenceToHypothesis(id: string, evidence: string): void {
    const row = this.db.prepare(`SELECT evidence FROM improvement_hypotheses WHERE id = ?`).get(id) as any;
    if (!row) return;

    const existingEvidence = JSON.parse(row.evidence || '[]');
    existingEvidence.push(evidence);

    this.db.prepare(`
      UPDATE improvement_hypotheses SET evidence = ? WHERE id = ?
    `).run(JSON.stringify(existingEvidence), id);
  }

  // ==================== FRONTIER TRACKING ====================

  /**
   * Track a research frontier topic
   */
  trackFrontier(
    topic: string,
    latestDevelopment: string,
    impactOnNOUS: string,
    priority: number = 0.5,
    sourceUrl?: string
  ): void {
    const id = `front_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    // Check if already tracking
    const existing = this.db.prepare(`SELECT id FROM frontier_tracking WHERE topic = ?`).get(topic) as any;

    if (existing) {
      this.db.prepare(`
        UPDATE frontier_tracking
        SET latest_development = ?, impact_on_nous = ?, priority = ?, source_url = ?, last_checked = ?
        WHERE topic = ?
      `).run(latestDevelopment, impactOnNOUS, priority, sourceUrl || null, new Date().toISOString(), topic);
    } else {
      this.db.prepare(`
        INSERT INTO frontier_tracking (id, topic, latest_development, impact_on_nous, priority, source_url, last_checked)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(id, topic, latestDevelopment, impactOnNOUS, priority, sourceUrl || null, new Date().toISOString());
    }
  }

  /**
   * Get all tracked frontiers
   */
  getTrackedFrontiers(): Array<{
    topic: string;
    latestDevelopment: string;
    impactOnNOUS: string;
    priority: number;
    lastChecked: string;
  }> {
    const rows = this.db.prepare(`
      SELECT * FROM frontier_tracking ORDER BY priority DESC
    `).all() as any[];

    return rows.map(r => ({
      topic: r.topic,
      latestDevelopment: r.latest_development,
      impactOnNOUS: r.impact_on_nous,
      priority: r.priority,
      lastChecked: r.last_checked,
    }));
  }

  // ==================== UTILITIES ====================

  private rowToKnowledge(row: any): ScientificKnowledge {
    return {
      id: row.id,
      domain: row.domain,
      concept: row.concept,
      description: row.description,
      source: row.source,
      sourceDate: row.source_date,
      relevanceToNOUS: row.relevance_to_nous,
      applicability: JSON.parse(row.applicability || '[]'),
      relatedConcepts: JSON.parse(row.related_concepts || '[]'),
      lastUpdated: row.last_updated,
    };
  }

  private rowToHypothesis(row: any): ImprovementHypothesis {
    return {
      id: row.id,
      hypothesis: row.hypothesis,
      expectedBenefit: row.expected_benefit,
      estimatedEffort: row.estimated_effort,
      confidence: row.confidence,
      status: row.status,
      evidence: JSON.parse(row.evidence || '[]'),
      createdAt: row.created_at,
      testResults: row.test_results ? JSON.parse(row.test_results) : undefined,
    };
  }

  /**
   * Get statistics
   */
  getStats(): {
    knowledgeCount: number;
    byDomain: Record<string, number>;
    hypothesesTotal: number;
    hypothesesProposed: number;
    hypothesesValidated: number;
    frontiersTracked: number;
  } {
    const total = (this.db.prepare(`SELECT COUNT(*) as count FROM scientific_knowledge`).get() as any).count;

    const domainCounts: Record<string, number> = {};
    const domains = this.db.prepare(`SELECT domain, COUNT(*) as count FROM scientific_knowledge GROUP BY domain`).all() as any[];
    for (const d of domains) {
      domainCounts[d.domain] = d.count;
    }

    const hypTotal = (this.db.prepare(`SELECT COUNT(*) as count FROM improvement_hypotheses`).get() as any).count;
    const hypProposed = (this.db.prepare(`SELECT COUNT(*) as count FROM improvement_hypotheses WHERE status = 'proposed'`).get() as any).count;
    const hypValidated = (this.db.prepare(`SELECT COUNT(*) as count FROM improvement_hypotheses WHERE status = 'validated'`).get() as any).count;
    const frontiers = (this.db.prepare(`SELECT COUNT(*) as count FROM frontier_tracking`).get() as any).count;

    return {
      knowledgeCount: total,
      byDomain: domainCounts,
      hypothesesTotal: hypTotal,
      hypothesesProposed: hypProposed,
      hypothesesValidated: hypValidated,
      frontiersTracked: frontiers,
    };
  }

  close(): void {
    this.db.close();
  }
}

// Singleton
let scientificKBInstance: ScientificKnowledgeBase | null = null;

export function getScientificKB(): ScientificKnowledgeBase {
  if (!scientificKBInstance) {
    scientificKBInstance = new ScientificKnowledgeBase();
  }
  return scientificKBInstance;
}
