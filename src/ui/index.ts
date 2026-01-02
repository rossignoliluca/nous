/**
 * NOUS UI Module
 *
 * 4 layers:
 * 1. CLI - Terminal with telemetry header + lock screen
 * 2. API - Read-only endpoints for audit
 * 3. Dashboard - Read-only web interface
 * 4. GitHub Dispute - Issue-based conflict resolution
 */

export * from './github_dispute';
export * from './cli';
export * from './api';
export * from './dashboard';

import { startAPI } from './api';
import { startDashboard } from './dashboard';

export function startUI(options: { apiPort?: number; dashboardPort?: number } = {}): {
  api: ReturnType<typeof startAPI>;
  dashboard: ReturnType<typeof startDashboard>;
} {
  const api = startAPI(options.apiPort || 3001);
  const dashboard = startDashboard(options.dashboardPort || 3000);
  return { api, dashboard };
}
