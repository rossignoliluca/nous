/**
 * NOUS Memory Store
 *
 * Persistent memory using SQLite.
 * NOUS remembers across sessions - this is what makes it continuous.
 *
 * Schema:
 * - sessions: conversation sessions
 * - messages: individual messages in sessions
 * - insights: learned insights (extracted from conversations)
 * - entities: characterized entities (Atlas integration)
 * - projects: ongoing projects NOUS is working on
 * - self_modifications: history of self.json changes
 */

import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Memory entry types
 */
export interface Session {
  id: string;
  startedAt: string;
  endedAt?: string;
  summary?: string;
  messageCount: number;
}

export interface Message {
  id: string;
  sessionId: string;
  role: 'user' | 'nous' | 'system';
  content: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface Insight {
  id: string;
  content: string;
  source: string; // session_id or 'foundational'
  category: 'fact' | 'preference' | 'pattern' | 'principle' | 'entity' | 'self_modification';
  confidence: number;
  createdAt: string;
  lastReferencedAt?: string;
  referenceCount: number;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'paused' | 'completed' | 'abandoned';
  createdAt: string;
  updatedAt: string;
  relatedSessions: string[];
  metadata?: Record<string, unknown>;
}

export interface SelfModification {
  id: string;
  timestamp: string;
  reason: string;
  beforeSnapshot: string; // JSON
  afterSnapshot: string; // JSON
  approved: boolean;
  approvedBy?: string;
}

/**
 * Memory Store
 */
export class MemoryStore {
  private db: Database.Database;
  private dbPath: string;

  constructor(dbPath?: string) {
    this.dbPath = dbPath || path.join(process.cwd(), 'data', 'nous.db');
    this.ensureDataDir();
    this.db = new Database(this.dbPath);
    this.initSchema();
  }

  private ensureDataDir(): void {
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  /**
   * Initialize database schema
   */
  private initSchema(): void {
    this.db.exec(`
      -- Sessions
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        started_at TEXT NOT NULL,
        ended_at TEXT,
        summary TEXT,
        message_count INTEGER DEFAULT 0
      );

      -- Messages
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('user', 'nous', 'system')),
        content TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        metadata TEXT,
        FOREIGN KEY (session_id) REFERENCES sessions(id)
      );

      -- Insights (learned knowledge)
      CREATE TABLE IF NOT EXISTS insights (
        id TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        source TEXT NOT NULL,
        category TEXT NOT NULL CHECK (category IN ('fact', 'preference', 'pattern', 'principle', 'entity')),
        confidence REAL NOT NULL DEFAULT 0.5,
        created_at TEXT NOT NULL,
        last_referenced_at TEXT,
        reference_count INTEGER DEFAULT 0
      );

      -- Projects
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'abandoned')),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        related_sessions TEXT,
        metadata TEXT
      );

      -- Self modifications history
      CREATE TABLE IF NOT EXISTS self_modifications (
        id TEXT PRIMARY KEY,
        timestamp TEXT NOT NULL,
        reason TEXT NOT NULL,
        before_snapshot TEXT NOT NULL,
        after_snapshot TEXT NOT NULL,
        approved INTEGER NOT NULL DEFAULT 0,
        approved_by TEXT
      );

      -- Indexes for performance
      CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id);
      CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp);
      CREATE INDEX IF NOT EXISTS idx_insights_category ON insights(category);
      CREATE INDEX IF NOT EXISTS idx_insights_confidence ON insights(confidence);
    `);
  }

  // ==================== Sessions ====================

  /**
   * Start a new session
   */
  startSession(): Session {
    const id = `session_${Date.now()}`;
    const startedAt = new Date().toISOString();

    this.db.prepare(`
      INSERT INTO sessions (id, started_at, message_count)
      VALUES (?, ?, 0)
    `).run(id, startedAt);

    return { id, startedAt, messageCount: 0 };
  }

  /**
   * End a session
   */
  endSession(sessionId: string, summary?: string): void {
    this.db.prepare(`
      UPDATE sessions
      SET ended_at = ?, summary = ?
      WHERE id = ?
    `).run(new Date().toISOString(), summary || null, sessionId);
  }

  /**
   * Get current or last session
   */
  getCurrentSession(): Session | null {
    const row = this.db.prepare(`
      SELECT * FROM sessions
      ORDER BY started_at DESC
      LIMIT 1
    `).get() as any;

    if (!row) return null;

    return {
      id: row.id,
      startedAt: row.started_at,
      endedAt: row.ended_at,
      summary: row.summary,
      messageCount: row.message_count,
    };
  }

  /**
   * Get recent sessions
   */
  getRecentSessions(limit: number = 10): Session[] {
    const rows = this.db.prepare(`
      SELECT * FROM sessions
      ORDER BY started_at DESC
      LIMIT ?
    `).all(limit) as any[];

    return rows.map(row => ({
      id: row.id,
      startedAt: row.started_at,
      endedAt: row.ended_at,
      summary: row.summary,
      messageCount: row.message_count,
    }));
  }

  // ==================== Messages ====================

  /**
   * Add a message
   */
  addMessage(
    sessionId: string,
    role: 'user' | 'nous' | 'system',
    content: string,
    metadata?: Record<string, unknown>
  ): Message {
    const id = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const timestamp = new Date().toISOString();

    this.db.prepare(`
      INSERT INTO messages (id, session_id, role, content, timestamp, metadata)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, sessionId, role, content, timestamp, metadata ? JSON.stringify(metadata) : null);

    // Update session message count
    this.db.prepare(`
      UPDATE sessions SET message_count = message_count + 1 WHERE id = ?
    `).run(sessionId);

    return { id, sessionId, role, content, timestamp, metadata };
  }

  /**
   * Get messages for a session
   */
  getSessionMessages(sessionId: string, limit?: number): Message[] {
    const query = limit
      ? `SELECT * FROM messages WHERE session_id = ? ORDER BY timestamp DESC LIMIT ?`
      : `SELECT * FROM messages WHERE session_id = ? ORDER BY timestamp ASC`;

    const rows = limit
      ? this.db.prepare(query).all(sessionId, limit) as any[]
      : this.db.prepare(query).all(sessionId) as any[];

    return rows.map(row => ({
      id: row.id,
      sessionId: row.session_id,
      role: row.role,
      content: row.content,
      timestamp: row.timestamp,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    }));
  }

  /**
   * Get recent messages across all sessions
   */
  getRecentMessages(limit: number = 50): Message[] {
    const rows = this.db.prepare(`
      SELECT * FROM messages
      ORDER BY timestamp DESC
      LIMIT ?
    `).all(limit) as any[];

    return rows.map(row => ({
      id: row.id,
      sessionId: row.session_id,
      role: row.role,
      content: row.content,
      timestamp: row.timestamp,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    }));
  }

  // ==================== Insights ====================

  /**
   * Add an insight
   */
  addInsight(
    content: string,
    source: string,
    category: Insight['category'],
    confidence: number = 0.5
  ): Insight {
    const id = `insight_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const createdAt = new Date().toISOString();

    this.db.prepare(`
      INSERT INTO insights (id, content, source, category, confidence, created_at, reference_count)
      VALUES (?, ?, ?, ?, ?, ?, 0)
    `).run(id, content, source, category, confidence, createdAt);

    return {
      id,
      content,
      source,
      category,
      confidence,
      createdAt,
      referenceCount: 0,
    };
  }

  /**
   * Get insights by category
   */
  getInsightsByCategory(category: Insight['category'], limit?: number): Insight[] {
    const query = limit
      ? `SELECT * FROM insights WHERE category = ? ORDER BY confidence DESC, reference_count DESC LIMIT ?`
      : `SELECT * FROM insights WHERE category = ? ORDER BY confidence DESC, reference_count DESC`;

    const rows = limit
      ? this.db.prepare(query).all(category, limit) as any[]
      : this.db.prepare(query).all(category) as any[];

    return rows.map(row => ({
      id: row.id,
      content: row.content,
      source: row.source,
      category: row.category,
      confidence: row.confidence,
      createdAt: row.created_at,
      lastReferencedAt: row.last_referenced_at,
      referenceCount: row.reference_count,
    }));
  }

  /**
   * Search insights
   */
  searchInsights(query: string, limit: number = 10): Insight[] {
    const rows = this.db.prepare(`
      SELECT * FROM insights
      WHERE content LIKE ?
      ORDER BY confidence DESC, reference_count DESC
      LIMIT ?
    `).all(`%${query}%`, limit) as any[];

    return rows.map(row => ({
      id: row.id,
      content: row.content,
      source: row.source,
      category: row.category,
      confidence: row.confidence,
      createdAt: row.created_at,
      lastReferencedAt: row.last_referenced_at,
      referenceCount: row.reference_count,
    }));
  }

  /**
   * Reference an insight (increases its relevance)
   */
  referenceInsight(insightId: string): void {
    this.db.prepare(`
      UPDATE insights
      SET last_referenced_at = ?, reference_count = reference_count + 1
      WHERE id = ?
    `).run(new Date().toISOString(), insightId);
  }

  /**
   * Update insight confidence
   */
  updateInsightConfidence(insightId: string, newConfidence: number): void {
    this.db.prepare(`
      UPDATE insights SET confidence = ? WHERE id = ?
    `).run(newConfidence, insightId);
  }

  // ==================== Projects ====================

  /**
   * Create a project
   */
  createProject(name: string, description: string): Project {
    const id = `project_${Date.now()}`;
    const now = new Date().toISOString();

    this.db.prepare(`
      INSERT INTO projects (id, name, description, status, created_at, updated_at, related_sessions)
      VALUES (?, ?, ?, 'active', ?, ?, '[]')
    `).run(id, name, description, now, now);

    return {
      id,
      name,
      description,
      status: 'active',
      createdAt: now,
      updatedAt: now,
      relatedSessions: [],
    };
  }

  /**
   * Get active projects
   */
  getActiveProjects(): Project[] {
    const rows = this.db.prepare(`
      SELECT * FROM projects WHERE status = 'active' ORDER BY updated_at DESC
    `).all() as any[];

    return rows.map(row => ({
      id: row.id,
      name: row.name,
      description: row.description,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      relatedSessions: JSON.parse(row.related_sessions || '[]'),
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    }));
  }

  /**
   * Update project status
   */
  updateProjectStatus(projectId: string, status: Project['status']): void {
    this.db.prepare(`
      UPDATE projects SET status = ?, updated_at = ? WHERE id = ?
    `).run(status, new Date().toISOString(), projectId);
  }

  // ==================== Self Modifications ====================

  /**
   * Record a self-modification
   */
  recordSelfModification(
    reason: string,
    beforeSnapshot: object,
    afterSnapshot: object,
    approved: boolean,
    approvedBy?: string
  ): SelfModification {
    const id = `mod_${Date.now()}`;
    const timestamp = new Date().toISOString();

    this.db.prepare(`
      INSERT INTO self_modifications (id, timestamp, reason, before_snapshot, after_snapshot, approved, approved_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      timestamp,
      reason,
      JSON.stringify(beforeSnapshot),
      JSON.stringify(afterSnapshot),
      approved ? 1 : 0,
      approvedBy || null
    );

    return {
      id,
      timestamp,
      reason,
      beforeSnapshot: JSON.stringify(beforeSnapshot),
      afterSnapshot: JSON.stringify(afterSnapshot),
      approved,
      approvedBy,
    };
  }

  /**
   * Get self-modification history
   */
  getSelfModificationHistory(limit: number = 20): SelfModification[] {
    const rows = this.db.prepare(`
      SELECT * FROM self_modifications ORDER BY timestamp DESC LIMIT ?
    `).all(limit) as any[];

    return rows.map(row => ({
      id: row.id,
      timestamp: row.timestamp,
      reason: row.reason,
      beforeSnapshot: row.before_snapshot,
      afterSnapshot: row.after_snapshot,
      approved: row.approved === 1,
      approvedBy: row.approved_by,
    }));
  }

  // ==================== Stats ====================

  /**
   * Get memory statistics
   */
  getStats(): {
    sessions: number;
    messages: number;
    insights: number;
    projects: number;
    modifications: number;
  } {
    const sessions = (this.db.prepare('SELECT COUNT(*) as count FROM sessions').get() as any).count;
    const messages = (this.db.prepare('SELECT COUNT(*) as count FROM messages').get() as any).count;
    const insights = (this.db.prepare('SELECT COUNT(*) as count FROM insights').get() as any).count;
    const projects = (this.db.prepare('SELECT COUNT(*) as count FROM projects').get() as any).count;
    const modifications = (this.db.prepare('SELECT COUNT(*) as count FROM self_modifications').get() as any).count;

    return { sessions, messages, insights, projects, modifications };
  }

  /**
   * Close database connection
   */
  close(): void {
    this.db.close();
  }
}

// Singleton instance
let memoryInstance: MemoryStore | null = null;

/**
 * Get memory store instance
 */
export function getMemory(): MemoryStore {
  if (!memoryInstance) {
    memoryInstance = new MemoryStore();
  }
  return memoryInstance;
}
