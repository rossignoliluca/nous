/**
 * Global Workspace - Central Cognitive Hub
 *
 * Based on Global Workspace Theory (Baars, 1988; Dehaene et al., 2011)
 *
 * Key concepts:
 * - Limited-capacity workspace for conscious processing
 * - Competitive selection ("ignition") of content
 * - Broadcasting to all specialized modules
 * - Integration of information from multiple sources
 *
 * "Consciousness is a workspace where information from
 *  various specialized processors can be shared and integrated."
 */

import {
  WorkspaceItem,
  CognitiveGoal,
  BroadcastMessage,
  CognitiveModule,
} from './types';

/**
 * Workspace configuration
 */
interface WorkspaceConfig {
  maxItems: number;           // Capacity limit (typically 7±2)
  ignitionThreshold: number;  // Priority threshold for broadcasting
  decayRate: number;          // How fast items fade
  broadcastCooldown: number;  // Minimum time between broadcasts (ms)
}

const DEFAULT_CONFIG: WorkspaceConfig = {
  maxItems: 7,
  ignitionThreshold: 0.6,
  decayRate: 0.1,
  broadcastCooldown: 100,
};

/**
 * Global Workspace implementation
 */
export class GlobalWorkspace {
  private config: WorkspaceConfig;
  private workspace: Map<string, WorkspaceItem>;
  private activeGoals: Map<string, CognitiveGoal>;
  private modules: Map<string, CognitiveModule>;
  private broadcastHistory: BroadcastMessage[];
  private lastBroadcast: number;
  private currentFocus: string | null;
  private attentionalGate: number; // 0-1, how selective attention is

  constructor(config: Partial<WorkspaceConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.workspace = new Map();
    this.activeGoals = new Map();
    this.modules = new Map();
    this.broadcastHistory = [];
    this.lastBroadcast = 0;
    this.currentFocus = null;
    this.attentionalGate = 0.5;
  }

  /**
   * Register a cognitive module
   */
  registerModule(module: CognitiveModule): void {
    this.modules.set(module.name, module);
  }

  /**
   * Submit content for potential broadcasting
   * Items compete for limited workspace capacity
   */
  submit(item: Omit<WorkspaceItem, 'id' | 'timestamp'>): string {
    const id = `ws_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const fullItem: WorkspaceItem = {
      ...item,
      id,
      timestamp: new Date().toISOString(),
    };

    // Check if this deserves workspace space
    if (fullItem.priority >= this.attentionalGate) {
      this.addToWorkspace(fullItem);
    }

    return id;
  }

  /**
   * Add item to workspace, potentially evicting lower-priority items
   */
  private addToWorkspace(item: WorkspaceItem): void {
    // If at capacity, evict lowest priority item
    if (this.workspace.size >= this.config.maxItems) {
      let lowestPriority = Infinity;
      let lowestId: string | null = null;

      for (const [id, wsItem] of this.workspace) {
        if (wsItem.priority < lowestPriority) {
          lowestPriority = wsItem.priority;
          lowestId = id;
        }
      }

      if (lowestId && lowestPriority < item.priority) {
        this.workspace.delete(lowestId);
      } else {
        // Item not important enough to enter workspace
        return;
      }
    }

    this.workspace.set(item.id, item);

    // Check for ignition (broadcast threshold)
    if (item.priority >= this.config.ignitionThreshold) {
      this.broadcast(item);
    }
  }

  /**
   * Broadcast content to all registered modules
   * This is the "ignition" event in GWT
   */
  async broadcast(item: WorkspaceItem): Promise<void> {
    const now = Date.now();
    if (now - this.lastBroadcast < this.config.broadcastCooldown) {
      return; // Throttle broadcasts
    }
    this.lastBroadcast = now;

    const message: BroadcastMessage = {
      id: `broadcast_${Date.now()}`,
      content: item,
      sourceModule: item.source,
      timestamp: new Date().toISOString(),
      urgency: this.determineUrgency(item.priority),
      recipients: ['all'],
    };

    this.broadcastHistory.push(message);

    // Keep history bounded
    if (this.broadcastHistory.length > 100) {
      this.broadcastHistory = this.broadcastHistory.slice(-50);
    }

    // Send to all modules and collect responses
    const responses: WorkspaceItem[] = [];

    for (const [name, module] of this.modules) {
      if (name !== item.source) {
        try {
          const response = await module.process(message);
          if (response) {
            responses.push(response);
          }
        } catch (error) {
          console.error(`Module ${name} error:`, error);
        }
      }
    }

    // Add responses back to workspace for potential re-broadcast
    for (const response of responses) {
      this.submit(response);
    }
  }

  /**
   * Set the current attentional focus
   */
  setFocus(itemId: string): boolean {
    if (this.workspace.has(itemId)) {
      this.currentFocus = itemId;
      // Boost priority of focused item
      const item = this.workspace.get(itemId)!;
      item.priority = Math.min(1, item.priority + 0.2);
      return true;
    }
    return false;
  }

  /**
   * Adjust attentional gate (selectivity)
   */
  setAttentionalGate(level: number): void {
    this.attentionalGate = Math.max(0, Math.min(1, level));
  }

  /**
   * Add a goal to active goals
   */
  addGoal(goal: Omit<CognitiveGoal, 'id' | 'createdAt' | 'subGoals'>): string {
    const id = `goal_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const fullGoal: CognitiveGoal = {
      ...goal,
      id,
      createdAt: new Date().toISOString(),
      subGoals: [],
    };
    this.activeGoals.set(id, fullGoal);

    // Submit goal to workspace
    this.submit({
      type: 'goal',
      content: goal.description,
      source: 'goal_system',
      priority: goal.priority,
      ttl: 300000, // 5 minutes
    });

    return id;
  }

  /**
   * Update goal progress
   */
  updateGoalProgress(goalId: string, progress: number): void {
    const goal = this.activeGoals.get(goalId);
    if (goal) {
      goal.progressEstimate = Math.max(0, Math.min(1, progress));
      if (progress >= 1) {
        goal.status = 'completed';
      }
    }
  }

  /**
   * Apply decay to workspace items
   */
  decay(): void {
    const now = Date.now();
    const toRemove: string[] = [];

    for (const [id, item] of this.workspace) {
      const itemTime = new Date(item.timestamp).getTime();
      const age = now - itemTime;

      // Check TTL
      if (age > item.ttl) {
        toRemove.push(id);
        continue;
      }

      // Apply priority decay
      item.priority = Math.max(0, item.priority - this.config.decayRate);
      if (item.priority <= 0) {
        toRemove.push(id);
      }
    }

    for (const id of toRemove) {
      this.workspace.delete(id);
      if (this.currentFocus === id) {
        this.currentFocus = null;
      }
    }
  }

  /**
   * Get current workspace contents
   */
  getWorkspaceContents(): WorkspaceItem[] {
    return Array.from(this.workspace.values())
      .sort((a, b) => b.priority - a.priority);
  }

  /**
   * Get active goals sorted by priority
   */
  getActiveGoals(): CognitiveGoal[] {
    return Array.from(this.activeGoals.values())
      .filter(g => g.status === 'active')
      .sort((a, b) => b.priority - a.priority);
  }

  /**
   * Get current focus item
   */
  getCurrentFocus(): WorkspaceItem | null {
    if (this.currentFocus) {
      return this.workspace.get(this.currentFocus) || null;
    }
    return null;
  }

  /**
   * Get broadcast history
   */
  getBroadcastHistory(limit: number = 10): BroadcastMessage[] {
    return this.broadcastHistory.slice(-limit);
  }

  /**
   * Get workspace state summary
   */
  getState(): {
    itemCount: number;
    capacity: number;
    utilization: number;
    currentFocus: string | null;
    attentionalGate: number;
    activeGoals: number;
    recentBroadcasts: number;
  } {
    return {
      itemCount: this.workspace.size,
      capacity: this.config.maxItems,
      utilization: this.workspace.size / this.config.maxItems,
      currentFocus: this.currentFocus,
      attentionalGate: this.attentionalGate,
      activeGoals: Array.from(this.activeGoals.values()).filter(
        g => g.status === 'active'
      ).length,
      recentBroadcasts: this.broadcastHistory.filter(
        b => Date.now() - new Date(b.timestamp).getTime() < 60000
      ).length,
    };
  }

  /**
   * Determine broadcast urgency from priority
   */
  private determineUrgency(
    priority: number
  ): 'low' | 'normal' | 'high' | 'critical' {
    if (priority >= 0.9) return 'critical';
    if (priority >= 0.7) return 'high';
    if (priority >= 0.4) return 'normal';
    return 'low';
  }

  /**
   * Clear workspace but keep goals
   */
  clearWorkspace(): void {
    this.workspace.clear();
    this.currentFocus = null;
  }

  /**
   * Reset everything
   */
  reset(): void {
    this.workspace.clear();
    this.activeGoals.clear();
    this.broadcastHistory = [];
    this.currentFocus = null;
    this.attentionalGate = 0.5;
  }
}

// Singleton instance
let workspaceInstance: GlobalWorkspace | null = null;

export function getGlobalWorkspace(): GlobalWorkspace {
  if (!workspaceInstance) {
    workspaceInstance = new GlobalWorkspace();
  }
  return workspaceInstance;
}
