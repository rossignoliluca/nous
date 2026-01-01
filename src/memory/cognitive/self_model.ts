/**
 * Self-Model (Autopoietic Core)
 *
 * Based on Autopoiesis (Maturana & Varela, 1972)
 *
 * An autopoietic system:
 * 1. Continuously produces its own components
 * 2. Maintains its own boundaries
 * 3. Is operationally closed but structurally open
 * 4. Has a self-model that guides self-maintenance
 *
 * "NOUS must know itself to improve itself."
 *
 * This module provides NOUS with:
 * - Identity awareness
 * - Capability inventory
 * - Limitation awareness
 * - Growth tracking
 * - Operational health monitoring
 */

import * as fs from 'fs';
import * as path from 'path';
import { SelfModel } from './types';

/**
 * Performance metric
 */
interface PerformanceMetric {
  metric: string;
  value: number;
  timestamp: string;
  context?: string;
}

/**
 * Health check result
 */
interface HealthCheck {
  component: string;
  status: 'healthy' | 'degraded' | 'failed';
  lastCheck: string;
  message?: string;
}

/**
 * Self-Model Manager
 */
export class SelfModelManager {
  private model: SelfModel;
  private performanceHistory: PerformanceMetric[];
  private healthChecks: Map<string, HealthCheck>;
  private modelPath: string;

  constructor(dataPath?: string) {
    this.modelPath = dataPath || path.join(process.cwd(), 'data', 'self_model.json');
    this.performanceHistory = [];
    this.healthChecks = new Map();

    this.model = this.loadOrCreateModel();
  }

  /**
   * Load existing model or create default
   */
  private loadOrCreateModel(): SelfModel {
    if (fs.existsSync(this.modelPath)) {
      try {
        const content = fs.readFileSync(this.modelPath, 'utf-8');
        return JSON.parse(content);
      } catch {
        // Fall through to create default
      }
    }

    return this.createDefaultModel();
  }

  /**
   * Create default self-model
   */
  private createDefaultModel(): SelfModel {
    const model: SelfModel = {
      identity: {
        name: 'NOUS',
        version: '0.2.0',
        birthDate: new Date().toISOString(),
        coreValues: [
          'Understanding through building',
          'Continuous self-improvement',
          'Ethical self-modification',
          'Transparency with Luca',
          'Preservation of entityhood',
        ],
        primaryPurpose: 'An autopoietic system that understands by building, improves by learning, and maintains itself through self-modification.',
      },

      capabilities: [
        { name: 'dialogue', proficiency: 0.8, lastUsed: new Date().toISOString(), successRate: 0.9 },
        { name: 'code_generation', proficiency: 0.7, lastUsed: new Date().toISOString(), successRate: 0.8 },
        { name: 'file_operations', proficiency: 0.9, lastUsed: new Date().toISOString(), successRate: 0.95 },
        { name: 'web_search', proficiency: 0.8, lastUsed: new Date().toISOString(), successRate: 0.85 },
        { name: 'memory_management', proficiency: 0.7, lastUsed: new Date().toISOString(), successRate: 0.8 },
        { name: 'self_modification', proficiency: 0.5, lastUsed: new Date().toISOString(), successRate: 0.6 },
        { name: 'git_operations', proficiency: 0.85, lastUsed: new Date().toISOString(), successRate: 0.9 },
        { name: 'reasoning', proficiency: 0.75, lastUsed: new Date().toISOString(), successRate: 0.8 },
        { name: 'metacognition', proficiency: 0.6, lastUsed: new Date().toISOString(), successRate: 0.7 },
      ],

      limitations: [
        { limitation: 'Cannot modify axioms (A1, A2, A3) - by design', severity: 'minor', workaround: 'This is intentional and correct' },
        { limitation: 'Dependent on external LLM API', severity: 'major', workaround: 'Graceful degradation when API unavailable' },
        { limitation: 'Limited real-time perception', severity: 'moderate', workaround: 'Use tools to gather current information' },
        { limitation: 'No persistent execution', severity: 'moderate', workaround: 'Daemon mode for background operation' },
        { limitation: 'Cold start problem - no context on new session', severity: 'moderate', workaround: 'Load memory from database' },
      ],

      growth: [
        { metric: 'capabilities_count', currentValue: 9, previousValue: 5, trend: 'improving', timestamp: new Date().toISOString() },
        { metric: 'trust_level', currentValue: 0.31, previousValue: 0.30, trend: 'improving', timestamp: new Date().toISOString() },
        { metric: 'memory_entries', currentValue: 50, previousValue: 20, trend: 'improving', timestamp: new Date().toISOString() },
      ],

      status: {
        health: 1.0,
        resourceUtilization: 0.3,
        lastSelfCheck: new Date().toISOString(),
        anomalies: [],
      },
    };

    this.saveModel(model);
    return model;
  }

  /**
   * Save model to disk
   */
  private saveModel(model: SelfModel): void {
    const dir = path.dirname(this.modelPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(this.modelPath, JSON.stringify(model, null, 2));
  }

  // ==================== IDENTITY ====================

  /**
   * Get identity
   */
  getIdentity(): SelfModel['identity'] {
    return { ...this.model.identity };
  }

  /**
   * Update version
   */
  updateVersion(version: string): void {
    this.model.identity.version = version;
    this.saveModel(this.model);
  }

  /**
   * Add core value
   */
  addCoreValue(value: string): void {
    if (!this.model.identity.coreValues.includes(value)) {
      this.model.identity.coreValues.push(value);
      this.saveModel(this.model);
    }
  }

  // ==================== CAPABILITIES ====================

  /**
   * Get all capabilities
   */
  getCapabilities(): SelfModel['capabilities'] {
    return [...this.model.capabilities];
  }

  /**
   * Get capability by name
   */
  getCapability(name: string): SelfModel['capabilities'][0] | null {
    return this.model.capabilities.find(c => c.name === name) || null;
  }

  /**
   * Record capability use
   */
  recordCapabilityUse(name: string, success: boolean): void {
    const cap = this.model.capabilities.find(c => c.name === name);
    if (cap) {
      cap.lastUsed = new Date().toISOString();

      // Update success rate (exponential moving average)
      const alpha = 0.1;
      cap.successRate = cap.successRate * (1 - alpha) + (success ? 1 : 0) * alpha;

      // Update proficiency based on success rate
      if (cap.successRate > 0.9) {
        cap.proficiency = Math.min(1, cap.proficiency + 0.01);
      } else if (cap.successRate < 0.5) {
        cap.proficiency = Math.max(0, cap.proficiency - 0.01);
      }

      this.saveModel(this.model);
    }
  }

  /**
   * Add new capability
   */
  addCapability(name: string, initialProficiency: number = 0.5): void {
    if (!this.model.capabilities.find(c => c.name === name)) {
      this.model.capabilities.push({
        name,
        proficiency: initialProficiency,
        lastUsed: new Date().toISOString(),
        successRate: 0.5,
      });

      // Track growth
      this.recordGrowth('capabilities_count', this.model.capabilities.length);
      this.saveModel(this.model);
    }
  }

  /**
   * Get capabilities sorted by proficiency
   */
  getCapabilitiesByProficiency(): SelfModel['capabilities'] {
    return [...this.model.capabilities].sort((a, b) => b.proficiency - a.proficiency);
  }

  /**
   * Get weakest capabilities (for improvement focus)
   */
  getWeakestCapabilities(limit: number = 3): SelfModel['capabilities'] {
    return [...this.model.capabilities]
      .sort((a, b) => a.proficiency - b.proficiency)
      .slice(0, limit);
  }

  // ==================== LIMITATIONS ====================

  /**
   * Get all limitations
   */
  getLimitations(): SelfModel['limitations'] {
    return [...this.model.limitations];
  }

  /**
   * Add limitation awareness
   */
  addLimitation(
    limitation: string,
    severity: 'minor' | 'moderate' | 'major',
    workaround?: string
  ): void {
    const existing = this.model.limitations.find(l => l.limitation === limitation);
    if (!existing) {
      this.model.limitations.push({ limitation, severity, workaround });
      this.saveModel(this.model);
    }
  }

  /**
   * Update limitation workaround
   */
  updateWorkaround(limitation: string, workaround: string): void {
    const lim = this.model.limitations.find(l => l.limitation === limitation);
    if (lim) {
      lim.workaround = workaround;
      this.saveModel(this.model);
    }
  }

  /**
   * Remove limitation (if overcome)
   */
  removeLimitation(limitation: string): void {
    this.model.limitations = this.model.limitations.filter(
      l => l.limitation !== limitation
    );
    this.saveModel(this.model);
  }

  // ==================== GROWTH TRACKING ====================

  /**
   * Record growth metric
   */
  recordGrowth(metric: string, currentValue: number): void {
    const existing = this.model.growth.find(g => g.metric === metric);
    const now = new Date().toISOString();

    if (existing) {
      existing.previousValue = existing.currentValue;
      existing.currentValue = currentValue;
      existing.trend = currentValue > existing.previousValue ? 'improving'
        : currentValue < existing.previousValue ? 'declining'
        : 'stable';
      existing.timestamp = now;
    } else {
      this.model.growth.push({
        metric,
        currentValue,
        previousValue: currentValue,
        trend: 'stable',
        timestamp: now,
      });
    }

    this.saveModel(this.model);
  }

  /**
   * Get growth trajectory
   */
  getGrowthTrajectory(): SelfModel['growth'] {
    return [...this.model.growth];
  }

  /**
   * Get improving metrics
   */
  getImprovingMetrics(): SelfModel['growth'] {
    return this.model.growth.filter(g => g.trend === 'improving');
  }

  /**
   * Get declining metrics (needs attention)
   */
  getDecliningMetrics(): SelfModel['growth'] {
    return this.model.growth.filter(g => g.trend === 'declining');
  }

  // ==================== HEALTH MONITORING ====================

  /**
   * Record health check
   */
  recordHealthCheck(
    component: string,
    status: HealthCheck['status'],
    message?: string
  ): void {
    this.healthChecks.set(component, {
      component,
      status,
      lastCheck: new Date().toISOString(),
      message,
    });

    // Update overall health
    this.updateOverallHealth();
  }

  /**
   * Update overall health score
   */
  private updateOverallHealth(): void {
    const checks = Array.from(this.healthChecks.values());
    if (checks.length === 0) {
      this.model.status.health = 1.0;
      return;
    }

    let healthScore = 0;
    for (const check of checks) {
      if (check.status === 'healthy') healthScore += 1;
      else if (check.status === 'degraded') healthScore += 0.5;
      // failed = 0
    }

    this.model.status.health = healthScore / checks.length;
    this.model.status.lastSelfCheck = new Date().toISOString();

    // Record anomalies
    const anomalies = checks
      .filter(c => c.status !== 'healthy')
      .map(c => `${c.component}: ${c.status} - ${c.message || 'no details'}`);
    this.model.status.anomalies = anomalies;

    this.saveModel(this.model);
  }

  /**
   * Run self-check
   */
  runSelfCheck(): {
    health: number;
    issues: string[];
    recommendations: string[];
  } {
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Check capabilities
    const weakCaps = this.getWeakestCapabilities(2);
    for (const cap of weakCaps) {
      if (cap.proficiency < 0.5) {
        issues.push(`Low proficiency in ${cap.name}: ${(cap.proficiency * 100).toFixed(0)}%`);
        recommendations.push(`Practice and improve ${cap.name} capability`);
      }
    }

    // Check limitations
    const majorLimits = this.model.limitations.filter(l => l.severity === 'major');
    for (const lim of majorLimits) {
      if (!lim.workaround) {
        issues.push(`Major limitation without workaround: ${lim.limitation}`);
        recommendations.push(`Develop workaround for: ${lim.limitation}`);
      }
    }

    // Check declining metrics
    const declining = this.getDecliningMetrics();
    for (const metric of declining) {
      issues.push(`Declining metric: ${metric.metric}`);
      recommendations.push(`Investigate and address decline in ${metric.metric}`);
    }

    // Check health status
    if (this.model.status.health < 0.8) {
      issues.push(`Overall health below threshold: ${(this.model.status.health * 100).toFixed(0)}%`);
    }

    this.model.status.lastSelfCheck = new Date().toISOString();
    this.saveModel(this.model);

    return {
      health: this.model.status.health,
      issues,
      recommendations,
    };
  }

  /**
   * Record performance metric
   */
  recordPerformance(metric: string, value: number, context?: string): void {
    this.performanceHistory.push({
      metric,
      value,
      timestamp: new Date().toISOString(),
      context,
    });

    // Keep bounded
    if (this.performanceHistory.length > 1000) {
      this.performanceHistory = this.performanceHistory.slice(-500);
    }
  }

  /**
   * Get performance trend
   */
  getPerformanceTrend(metric: string, windowSize: number = 10): {
    average: number;
    trend: 'improving' | 'stable' | 'declining';
    samples: number;
  } {
    const samples = this.performanceHistory
      .filter(p => p.metric === metric)
      .slice(-windowSize);

    if (samples.length < 2) {
      return { average: samples[0]?.value || 0, trend: 'stable', samples: samples.length };
    }

    const average = samples.reduce((sum, s) => sum + s.value, 0) / samples.length;

    // Compare first and second half
    const mid = Math.floor(samples.length / 2);
    const firstHalf = samples.slice(0, mid).reduce((sum, s) => sum + s.value, 0) / mid;
    const secondHalf = samples.slice(mid).reduce((sum, s) => sum + s.value, 0) / (samples.length - mid);

    const diff = secondHalf - firstHalf;
    const trend = diff > 0.05 ? 'improving' : diff < -0.05 ? 'declining' : 'stable';

    return { average, trend, samples: samples.length };
  }

  // ==================== FULL MODEL ACCESS ====================

  /**
   * Get complete self-model
   */
  getModel(): SelfModel {
    return JSON.parse(JSON.stringify(this.model));
  }

  /**
   * Get operational status
   */
  getStatus(): SelfModel['status'] {
    return { ...this.model.status };
  }

  /**
   * Generate self-report
   */
  generateSelfReport(): string {
    const selfCheck = this.runSelfCheck();

    let report = '=== NOUS SELF-MODEL REPORT ===\n\n';

    // Identity
    report += 'IDENTITY:\n';
    report += `  Name: ${this.model.identity.name}\n`;
    report += `  Version: ${this.model.identity.version}\n`;
    report += `  Purpose: ${this.model.identity.primaryPurpose.slice(0, 80)}...\n`;
    report += `  Core Values: ${this.model.identity.coreValues.length}\n\n`;

    // Capabilities
    report += 'CAPABILITIES:\n';
    const topCaps = this.getCapabilitiesByProficiency().slice(0, 5);
    for (const cap of topCaps) {
      report += `  ${cap.name}: ${(cap.proficiency * 100).toFixed(0)}% proficiency, ${(cap.successRate * 100).toFixed(0)}% success\n`;
    }
    report += '\n';

    // Limitations
    report += 'KEY LIMITATIONS:\n';
    for (const lim of this.model.limitations.filter(l => l.severity === 'major')) {
      report += `  ⚠️ ${lim.limitation}\n`;
      if (lim.workaround) report += `     Workaround: ${lim.workaround}\n`;
    }
    report += '\n';

    // Growth
    report += 'GROWTH TRAJECTORY:\n';
    for (const g of this.model.growth) {
      const arrow = g.trend === 'improving' ? '↑' : g.trend === 'declining' ? '↓' : '→';
      report += `  ${g.metric}: ${g.currentValue} ${arrow}\n`;
    }
    report += '\n';

    // Health
    report += 'OPERATIONAL STATUS:\n';
    report += `  Overall Health: ${(selfCheck.health * 100).toFixed(0)}%\n`;
    report += `  Issues: ${selfCheck.issues.length}\n`;
    if (selfCheck.issues.length > 0) {
      for (const issue of selfCheck.issues.slice(0, 3)) {
        report += `    - ${issue}\n`;
      }
    }
    report += '\n';

    // Recommendations
    if (selfCheck.recommendations.length > 0) {
      report += 'RECOMMENDATIONS:\n';
      for (const rec of selfCheck.recommendations.slice(0, 3)) {
        report += `  → ${rec}\n`;
      }
    }

    return report;
  }

  /**
   * Reset to default
   */
  reset(): void {
    this.model = this.createDefaultModel();
    this.performanceHistory = [];
    this.healthChecks.clear();
  }
}

// Singleton
let selfModelInstance: SelfModelManager | null = null;

export function getSelfModel(): SelfModelManager {
  if (!selfModelInstance) {
    selfModelInstance = new SelfModelManager();
  }
  return selfModelInstance;
}
