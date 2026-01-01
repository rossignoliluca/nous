/**
 * Complementary Learning Systems (CLS)
 *
 * Based on McClelland et al. (1995) and recent work (2024)
 *
 * Two systems working together:
 * 1. HIPPOCAMPAL BUFFER: Fast learning, episodic, sparse
 *    - Rapidly encodes new experiences
 *    - Maintains unique, context-rich memories
 *    - Prone to interference but high fidelity
 *
 * 2. NEOCORTICAL STORE: Slow learning, semantic, distributed
 *    - Gradually extracts patterns across experiences
 *    - Generalizes and integrates knowledge
 *    - Resistant to catastrophic forgetting
 *
 * KEY PROCESS: Memory Consolidation
 * During "sleep" or idle periods, hippocampal memories
 * are replayed and gradually integrated into neocortex.
 */

import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';
import { EpisodicMemory, SemanticMemory, TemporalScale } from './types';

/**
 * CLS Configuration
 */
interface CLSConfig {
  hippocampalCapacity: number;     // Max episodic memories before consolidation
  consolidationThreshold: number;  // Min replays before consolidation
  similarityThreshold: number;     // For pattern extraction
  forgettingRate: number;          // Episodic decay rate
  reinforcementBoost: number;      // Boost for accessed memories
}

const DEFAULT_CLS_CONFIG: CLSConfig = {
  hippocampalCapacity: 1000,
  consolidationThreshold: 3,
  similarityThreshold: 0.7,
  forgettingRate: 0.01,
  reinforcementBoost: 0.1,
};

/**
 * Complementary Learning System implementation
 */
export class ComplementaryLearningSystem {
  private db: Database.Database;
  private config: CLSConfig;
  private recentEpisodes: Map<string, number>; // ID -> replay count

  constructor(dbPath?: string, config: Partial<CLSConfig> = {}) {
    this.config = { ...DEFAULT_CLS_CONFIG, ...config };
    this.recentEpisodes = new Map();

    const actualPath = dbPath || path.join(process.cwd(), 'data', 'cognitive.db');
    this.ensureDir(actualPath);
    this.db = new Database(actualPath);
    this.initSchema();
  }

  private ensureDir(dbPath: string): void {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  private initSchema(): void {
    this.db.exec(`
      -- Hippocampal Buffer (Episodic Memory)
      CREATE TABLE IF NOT EXISTS episodic_memory (
        id TEXT PRIMARY KEY,
        event TEXT NOT NULL,
        context_temporal TEXT,
        context_spatial TEXT,
        context_emotional TEXT,
        context_social TEXT,
        participants TEXT,
        outcome TEXT,
        significance REAL DEFAULT 0.5,
        timestamp TEXT NOT NULL,
        consolidated INTEGER DEFAULT 0,
        replay_count INTEGER DEFAULT 0,
        decay_score REAL DEFAULT 1.0
      );

      -- Neocortical Store (Semantic Memory)
      CREATE TABLE IF NOT EXISTS semantic_memory (
        id TEXT PRIMARY KEY,
        concept TEXT NOT NULL UNIQUE,
        definition TEXT,
        category TEXT,
        properties TEXT,
        relationships TEXT,
        confidence REAL DEFAULT 0.5,
        source_episodes TEXT,
        last_reinforced TEXT,
        access_count INTEGER DEFAULT 0
      );

      -- Consolidation Log
      CREATE TABLE IF NOT EXISTS consolidation_log (
        id TEXT PRIMARY KEY,
        timestamp TEXT NOT NULL,
        episodes_processed INTEGER,
        concepts_updated INTEGER,
        concepts_created INTEGER,
        duration_ms INTEGER
      );

      -- Indexes
      CREATE INDEX IF NOT EXISTS idx_episodic_timestamp ON episodic_memory(timestamp);
      CREATE INDEX IF NOT EXISTS idx_episodic_consolidated ON episodic_memory(consolidated);
      CREATE INDEX IF NOT EXISTS idx_semantic_category ON semantic_memory(category);
      CREATE INDEX IF NOT EXISTS idx_semantic_confidence ON semantic_memory(confidence);
    `);
  }

  // ==================== HIPPOCAMPAL BUFFER ====================

  /**
   * Encode a new episodic memory (fast learning)
   */
  encodeEpisode(episode: Omit<EpisodicMemory, 'id' | 'timestamp' | 'consolidated' | 'replayCount'>): EpisodicMemory {
    const id = `ep_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const timestamp = new Date().toISOString();

    this.db.prepare(`
      INSERT INTO episodic_memory
        (id, event, context_temporal, context_spatial, context_emotional, context_social,
         participants, outcome, significance, timestamp, consolidated, replay_count)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0)
    `).run(
      id,
      episode.event,
      episode.context.temporal || null,
      episode.context.spatial || null,
      episode.context.emotional || null,
      episode.context.social || null,
      JSON.stringify(episode.participants),
      episode.outcome,
      episode.significance,
      timestamp
    );

    this.recentEpisodes.set(id, 0);

    // Check capacity
    this.enforceCapacity();

    return {
      id,
      ...episode,
      timestamp,
      consolidated: false,
      replayCount: 0,
    };
  }

  /**
   * Retrieve episodic memory (reactivation/replay)
   */
  retrieveEpisode(id: string): EpisodicMemory | null {
    const row = this.db.prepare(`
      SELECT * FROM episodic_memory WHERE id = ?
    `).get(id) as any;

    if (!row) return null;

    // Increment replay count
    this.db.prepare(`
      UPDATE episodic_memory SET replay_count = replay_count + 1 WHERE id = ?
    `).run(id);

    this.recentEpisodes.set(id, (this.recentEpisodes.get(id) || 0) + 1);

    return this.rowToEpisodic(row);
  }

  /**
   * Search episodic memories
   */
  searchEpisodes(query: string, limit: number = 10): EpisodicMemory[] {
    const rows = this.db.prepare(`
      SELECT * FROM episodic_memory
      WHERE event LIKE ? OR outcome LIKE ?
      ORDER BY significance DESC, timestamp DESC
      LIMIT ?
    `).all(`%${query}%`, `%${query}%`, limit) as any[];

    return rows.map(this.rowToEpisodic);
  }

  /**
   * Get recent episodes
   */
  getRecentEpisodes(limit: number = 20): EpisodicMemory[] {
    const rows = this.db.prepare(`
      SELECT * FROM episodic_memory
      ORDER BY timestamp DESC
      LIMIT ?
    `).all(limit) as any[];

    return rows.map(this.rowToEpisodic);
  }

  /**
   * Get unconsolidated episodes ready for consolidation
   */
  getEpisodesForConsolidation(): EpisodicMemory[] {
    const rows = this.db.prepare(`
      SELECT * FROM episodic_memory
      WHERE consolidated = 0 AND replay_count >= ?
      ORDER BY significance DESC
    `).all(this.config.consolidationThreshold) as any[];

    return rows.map(this.rowToEpisodic);
  }

  // ==================== NEOCORTICAL STORE ====================

  /**
   * Store or update semantic memory (slow learning)
   */
  storeConcept(memory: Omit<SemanticMemory, 'id' | 'lastReinforced'>): SemanticMemory {
    const id = `sem_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const lastReinforced = new Date().toISOString();

    // Check if concept already exists
    const existing = this.db.prepare(`
      SELECT * FROM semantic_memory WHERE concept = ?
    `).get(memory.concept) as any;

    if (existing) {
      // Update existing concept (reinforcement)
      const newConfidence = Math.min(1, existing.confidence + this.config.reinforcementBoost);
      const existingRelationships = JSON.parse(existing.relationships || '[]');
      const mergedRelationships = this.mergeRelationships(existingRelationships, memory.relationships);
      const existingSources = JSON.parse(existing.source_episodes || '[]');
      const mergedSources = [...new Set([...existingSources, ...memory.sourceEpisodes])];

      this.db.prepare(`
        UPDATE semantic_memory
        SET definition = ?,
            properties = ?,
            relationships = ?,
            confidence = ?,
            source_episodes = ?,
            last_reinforced = ?,
            access_count = access_count + 1
        WHERE concept = ?
      `).run(
        memory.definition,
        JSON.stringify(memory.properties),
        JSON.stringify(mergedRelationships),
        newConfidence,
        JSON.stringify(mergedSources),
        lastReinforced,
        memory.concept
      );

      return {
        id: existing.id,
        ...memory,
        confidence: newConfidence,
        relationships: mergedRelationships,
        sourceEpisodes: mergedSources,
        lastReinforced,
      };
    }

    // Create new concept
    this.db.prepare(`
      INSERT INTO semantic_memory
        (id, concept, definition, category, properties, relationships, confidence, source_episodes, last_reinforced)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      memory.concept,
      memory.definition,
      memory.category,
      JSON.stringify(memory.properties),
      JSON.stringify(memory.relationships),
      memory.confidence,
      JSON.stringify(memory.sourceEpisodes),
      lastReinforced
    );

    return {
      id,
      ...memory,
      lastReinforced,
    };
  }

  /**
   * Retrieve semantic memory
   */
  getConcept(concept: string): SemanticMemory | null {
    const row = this.db.prepare(`
      SELECT * FROM semantic_memory WHERE concept = ?
    `).get(concept) as any;

    if (!row) return null;

    // Update access
    this.db.prepare(`
      UPDATE semantic_memory
      SET access_count = access_count + 1, last_reinforced = ?
      WHERE concept = ?
    `).run(new Date().toISOString(), concept);

    return this.rowToSemantic(row);
  }

  /**
   * Search semantic memories
   */
  searchConcepts(query: string, limit: number = 10): SemanticMemory[] {
    const rows = this.db.prepare(`
      SELECT * FROM semantic_memory
      WHERE concept LIKE ? OR definition LIKE ? OR category LIKE ?
      ORDER BY confidence DESC, access_count DESC
      LIMIT ?
    `).all(`%${query}%`, `%${query}%`, `%${query}%`, limit) as any[];

    return rows.map(this.rowToSemantic);
  }

  /**
   * Get concepts by category
   */
  getConceptsByCategory(category: string): SemanticMemory[] {
    const rows = this.db.prepare(`
      SELECT * FROM semantic_memory
      WHERE category = ?
      ORDER BY confidence DESC
    `).all(category) as any[];

    return rows.map(this.rowToSemantic);
  }

  // ==================== CONSOLIDATION ====================

  /**
   * Run memory consolidation (like sleep)
   * Transfers patterns from hippocampus to neocortex
   */
  async consolidate(): Promise<{
    episodesProcessed: number;
    conceptsUpdated: number;
    conceptsCreated: number;
  }> {
    const startTime = Date.now();
    const episodes = this.getEpisodesForConsolidation();

    let conceptsUpdated = 0;
    let conceptsCreated = 0;

    for (const episode of episodes) {
      // Extract semantic knowledge from episode
      const concepts = this.extractConcepts(episode);

      for (const concept of concepts) {
        const existing = this.getConcept(concept.concept);
        if (existing) {
          conceptsUpdated++;
        } else {
          conceptsCreated++;
        }
        this.storeConcept(concept);
      }

      // Mark episode as consolidated
      this.db.prepare(`
        UPDATE episodic_memory SET consolidated = 1 WHERE id = ?
      `).run(episode.id);
    }

    // Log consolidation
    const duration = Date.now() - startTime;
    this.db.prepare(`
      INSERT INTO consolidation_log (id, timestamp, episodes_processed, concepts_updated, concepts_created, duration_ms)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      `cons_${Date.now()}`,
      new Date().toISOString(),
      episodes.length,
      conceptsUpdated,
      conceptsCreated,
      duration
    );

    return {
      episodesProcessed: episodes.length,
      conceptsUpdated,
      conceptsCreated,
    };
  }

  /**
   * Extract semantic concepts from episodic memory
   * This simulates the pattern extraction process
   */
  private extractConcepts(episode: EpisodicMemory): Omit<SemanticMemory, 'id' | 'lastReinforced'>[] {
    const concepts: Omit<SemanticMemory, 'id' | 'lastReinforced'>[] = [];

    // Extract main event as concept
    const mainConcept = this.eventToConcept(episode);
    if (mainConcept) {
      concepts.push(mainConcept);
    }

    // Extract participant concepts
    for (const participant of episode.participants) {
      concepts.push({
        concept: participant,
        definition: `Entity involved in: ${episode.event.slice(0, 50)}`,
        category: 'entity',
        properties: {},
        relationships: [{
          type: 'participated_in',
          target: episode.event.slice(0, 30),
          strength: episode.significance,
        }],
        confidence: episode.significance * 0.7,
        sourceEpisodes: [episode.id],
      });
    }

    return concepts;
  }

  /**
   * Convert episodic event to semantic concept
   */
  private eventToConcept(episode: EpisodicMemory): Omit<SemanticMemory, 'id' | 'lastReinforced'> | null {
    // Simple heuristic: extract key phrase
    const words = episode.event.split(' ');
    if (words.length < 2) return null;

    // Use first key phrase as concept
    const concept = words.slice(0, 3).join(' ').toLowerCase();

    return {
      concept,
      definition: episode.event,
      category: this.categorizeEvent(episode),
      properties: {
        outcome: episode.outcome,
        emotional_context: episode.context.emotional,
      },
      relationships: [],
      confidence: episode.significance,
      sourceEpisodes: [episode.id],
    };
  }

  /**
   * Categorize event type
   */
  private categorizeEvent(episode: EpisodicMemory): string {
    const event = episode.event.toLowerCase();
    if (event.includes('error') || event.includes('fail')) return 'failure';
    if (event.includes('success') || event.includes('complete')) return 'success';
    if (event.includes('learn') || event.includes('discover')) return 'learning';
    if (event.includes('decid') || event.includes('chose')) return 'decision';
    return 'experience';
  }

  // ==================== MEMORY DECAY ====================

  /**
   * Apply decay to episodic memories
   * Unconsolidated memories fade faster
   */
  applyDecay(): number {
    const result = this.db.prepare(`
      UPDATE episodic_memory
      SET decay_score = CASE
        WHEN consolidated = 1 THEN decay_score * 0.99
        ELSE decay_score * (1 - ?)
      END
    `).run(this.config.forgettingRate);

    // Remove completely decayed memories
    const deleted = this.db.prepare(`
      DELETE FROM episodic_memory WHERE decay_score < 0.01
    `).run();

    return deleted.changes;
  }

  // ==================== UTILITIES ====================

  private enforceCapacity(): void {
    const count = (this.db.prepare(`
      SELECT COUNT(*) as count FROM episodic_memory WHERE consolidated = 0
    `).get() as any).count;

    if (count > this.config.hippocampalCapacity) {
      // Remove lowest significance unconsolidated memories
      const excess = count - this.config.hippocampalCapacity;
      this.db.prepare(`
        DELETE FROM episodic_memory
        WHERE id IN (
          SELECT id FROM episodic_memory
          WHERE consolidated = 0
          ORDER BY significance ASC, timestamp ASC
          LIMIT ?
        )
      `).run(excess);
    }
  }

  private mergeRelationships(
    existing: SemanticMemory['relationships'],
    incoming: SemanticMemory['relationships']
  ): SemanticMemory['relationships'] {
    const merged = [...existing];

    for (const rel of incoming) {
      const existingRel = merged.find(
        r => r.type === rel.type && r.target === rel.target
      );
      if (existingRel) {
        existingRel.strength = Math.max(existingRel.strength, rel.strength);
      } else {
        merged.push(rel);
      }
    }

    return merged;
  }

  private rowToEpisodic(row: any): EpisodicMemory {
    return {
      id: row.id,
      event: row.event,
      context: {
        temporal: row.context_temporal,
        spatial: row.context_spatial,
        emotional: row.context_emotional,
        social: row.context_social,
      },
      participants: JSON.parse(row.participants || '[]'),
      outcome: row.outcome,
      significance: row.significance,
      timestamp: row.timestamp,
      consolidated: row.consolidated === 1,
      replayCount: row.replay_count,
    };
  }

  private rowToSemantic(row: any): SemanticMemory {
    return {
      id: row.id,
      concept: row.concept,
      definition: row.definition,
      category: row.category,
      properties: JSON.parse(row.properties || '{}'),
      relationships: JSON.parse(row.relationships || '[]'),
      confidence: row.confidence,
      sourceEpisodes: JSON.parse(row.source_episodes || '[]'),
      lastReinforced: row.last_reinforced,
    };
  }

  /**
   * Get CLS statistics
   */
  getStats(): {
    episodicCount: number;
    episodicUnconsolidated: number;
    semanticCount: number;
    consolidationsRun: number;
    lastConsolidation: string | null;
  } {
    const episodic = (this.db.prepare(`SELECT COUNT(*) as count FROM episodic_memory`).get() as any).count;
    const unconsolidated = (this.db.prepare(`SELECT COUNT(*) as count FROM episodic_memory WHERE consolidated = 0`).get() as any).count;
    const semantic = (this.db.prepare(`SELECT COUNT(*) as count FROM semantic_memory`).get() as any).count;
    const consRun = (this.db.prepare(`SELECT COUNT(*) as count FROM consolidation_log`).get() as any).count;
    const lastCons = this.db.prepare(`SELECT timestamp FROM consolidation_log ORDER BY timestamp DESC LIMIT 1`).get() as any;

    return {
      episodicCount: episodic,
      episodicUnconsolidated: unconsolidated,
      semanticCount: semantic,
      consolidationsRun: consRun,
      lastConsolidation: lastCons?.timestamp || null,
    };
  }

  close(): void {
    this.db.close();
  }
}

// Singleton
let clsInstance: ComplementaryLearningSystem | null = null;

export function getCLS(): ComplementaryLearningSystem {
  if (!clsInstance) {
    clsInstance = new ComplementaryLearningSystem();
  }
  return clsInstance;
}
