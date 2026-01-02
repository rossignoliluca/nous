/**
 * NOUS Read-Only API
 *
 * Endpoints:
 *   GET /status
 *   GET /audit/latest
 *   GET /logs?limit=N
 *   GET /metrics?window=24h
 *
 * No /chat endpoint. Chat stays in CLI.
 */

import * as http from 'http';
import { URL } from 'url';
import { getStats, getCurrentLock, DisputeEvent } from './github_dispute';
import { getTelemetry, TelemetryState } from './cli';
import { getSilenceLog, getSilenceStats, SilenceEvent } from '../core/silence';
import { getNOUSSelfTracker } from '../frameworks/atlas';

export interface AtlasStatus {
  C: number;
  S: number;
  strata: { MATTER: boolean | number; LIFE: boolean | number; SENTIENCE: boolean | number; LOGOS: boolean | number };
  stratum: string;
  stratumLevel: number;
  capabilities: number;
  relations: number;
  uncertainties: Record<string, number>;
}

export interface StatusResponse {
  telemetry: TelemetryState;
  atlas: AtlasStatus;
  dispute: ReturnType<typeof getStats>;
  silence: ReturnType<typeof getSilenceStats>;
  timestamp: string;
}

export interface AuditResponse {
  event: DisputeEvent | null;
  silenceEvents: SilenceEvent[];
}

export interface MetricsResponse {
  window: string;
  avgFeel: number;
  avgGap: number;
  avgSycophancy: number;
  suspensionRate: number;
  totalEvents: number;
}

const logs: Array<{ timestamp: string; level: string; message: string }> = [];

export function log(level: 'INFO' | 'WARN' | 'ERROR', message: string): void {
  logs.push({ timestamp: new Date().toISOString(), level, message });
  if (logs.length > 1000) logs.shift();
}

function jsonResponse(res: http.ServerResponse, data: unknown, status = 200): void {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify(data, null, 2));
}

function getAtlasStatus(): AtlasStatus {
  try {
    const tracker = getNOUSSelfTracker();
    const config = tracker.getConfig();
    const stratum = tracker.getStratumLevel();

    return {
      C: config.C,
      S: config.S,
      strata: config.Σ,
      stratum: stratum.primary,
      stratumLevel: stratum.level,
      capabilities: config.K.length,
      relations: config.R.length,
      uncertainties: config.U,
    };
  } catch {
    return {
      C: 0,
      S: 0,
      strata: { MATTER: false, LIFE: false, SENTIENCE: false, LOGOS: false },
      stratum: 'UNKNOWN',
      stratumLevel: 0,
      capabilities: 0,
      relations: 0,
      uncertainties: {},
    };
  }
}

function handleStatus(res: http.ServerResponse): void {
  const response: StatusResponse = {
    telemetry: getTelemetry(),
    atlas: getAtlasStatus(),
    dispute: getStats(),
    silence: getSilenceStats(),
    timestamp: new Date().toISOString(),
  };
  jsonResponse(res, response);
}

function handleAudit(res: http.ServerResponse): void {
  const response: AuditResponse = {
    event: getCurrentLock(),
    silenceEvents: getSilenceLog().slice(-10),
  };
  jsonResponse(res, response);
}

function handleLogs(res: http.ServerResponse, limit: number): void {
  const result = logs.slice(-limit);
  jsonResponse(res, { logs: result, total: logs.length });
}

function handleMetrics(res: http.ServerResponse, window: string): void {
  const silenceStats = getSilenceStats();
  const response: MetricsResponse = {
    window,
    avgFeel: getTelemetry().feel,
    avgGap: silenceStats.avg_gap,
    avgSycophancy: silenceStats.avg_sycophancy,
    suspensionRate: silenceStats.total_events > 0
      ? silenceStats.suspensions / silenceStats.total_events
      : 0,
    totalEvents: silenceStats.total_events,
  };
  jsonResponse(res, response);
}

function handleRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
  const url = new URL(req.url || '/', `http://${req.headers.host}`);
  const path = url.pathname;

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }

  if (req.method !== 'GET') {
    jsonResponse(res, { error: 'Method not allowed' }, 405);
    return;
  }

  if (path === '/status') {
    handleStatus(res);
  } else if (path === '/audit/latest') {
    handleAudit(res);
  } else if (path === '/logs') {
    const limit = parseInt(url.searchParams.get('limit') || '100', 10);
    handleLogs(res, Math.min(limit, 1000));
  } else if (path === '/metrics') {
    const window = url.searchParams.get('window') || '24h';
    handleMetrics(res, window);
  } else {
    jsonResponse(res, { error: 'Not found', endpoints: ['/status', '/audit/latest', '/logs', '/metrics'] }, 404);
  }
}

export function startAPI(port = 3001): http.Server {
  const server = http.createServer(handleRequest);
  server.listen(port, () => {
    console.log(`[API] Listening on http://localhost:${port}`);
  });
  return server;
}

export function stopAPI(server: http.Server): void {
  server.close();
}
