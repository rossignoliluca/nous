/**
 * NOUS Dashboard
 * Monitoring interface
 */

import * as http from 'http';
import { URL } from 'url';

const DASHBOARD_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>NOUS</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #09090b;
      --surface: #18181b;
      --surface-2: #27272a;
      --border: #27272a;
      --text: #fafafa;
      --text-2: #a1a1aa;
      --text-3: #71717a;
      --accent: #3b82f6;
      --green: #22c55e;
      --yellow: #eab308;
      --red: #ef4444;
      --radius: 12px;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      background: var(--bg);
      color: var(--text);
      min-height: 100vh;
      -webkit-font-smoothing: antialiased;
    }
    .container { max-width: 1200px; margin: 0 auto; padding: 48px 24px; }

    header { margin-bottom: 48px; }
    .header-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
    .logo { display: flex; align-items: center; gap: 12px; }
    .logo-mark {
      width: 32px; height: 32px;
      background: linear-gradient(135deg, var(--accent), #8b5cf6);
      border-radius: 8px;
      display: flex; align-items: center; justify-content: center;
      font-weight: 600; font-size: 14px;
    }
    .logo-text { font-size: 20px; font-weight: 600; letter-spacing: -0.5px; }
    .status-pill {
      display: flex; align-items: center; gap: 8px;
      padding: 6px 12px;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 20px;
      font-size: 12px;
      color: var(--text-2);
    }
    .status-dot { width: 8px; height: 8px; border-radius: 50%; }
    .status-dot.ok { background: var(--green); box-shadow: 0 0 8px var(--green); }
    .status-dot.warn { background: var(--yellow); box-shadow: 0 0 8px var(--yellow); }
    .status-dot.error { background: var(--red); box-shadow: 0 0 8px var(--red); }
    .subtitle { color: var(--text-3); font-size: 14px; }

    .grid { display: grid; grid-template-columns: repeat(12, 1fr); gap: 16px; }
    .col-4 { grid-column: span 4; }
    .col-6 { grid-column: span 6; }
    .col-8 { grid-column: span 8; }
    .col-12 { grid-column: span 12; }
    @media (max-width: 900px) { .col-4, .col-6, .col-8 { grid-column: span 12; } }

    .card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 24px;
    }
    .card-header {
      display: flex; justify-content: space-between; align-items: center;
      margin-bottom: 20px;
    }
    .card-title { font-size: 13px; font-weight: 500; color: var(--text-2); text-transform: uppercase; letter-spacing: 0.5px; }
    .card-badge {
      font-size: 11px; font-weight: 600;
      padding: 4px 10px;
      border-radius: 6px;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    .card-badge.ok { background: rgba(34, 197, 94, 0.15); color: var(--green); }
    .card-badge.warn { background: rgba(234, 179, 8, 0.15); color: var(--yellow); }
    .card-badge.error { background: rgba(239, 68, 68, 0.15); color: var(--red); }

    .metric-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }
    .metric { padding: 16px; background: var(--bg); border-radius: 8px; }
    .metric-label { font-size: 11px; color: var(--text-3); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; }
    .metric-value { font-size: 28px; font-weight: 600; letter-spacing: -1px; }
    .metric-value.sm { font-size: 20px; }
    .metric-unit { font-size: 14px; font-weight: 400; color: var(--text-3); margin-left: 2px; }
    .metric-value.ok { color: var(--green); }
    .metric-value.warn { color: var(--yellow); }
    .metric-value.error { color: var(--red); }

    .progress-bar { height: 4px; background: var(--surface-2); border-radius: 2px; margin-top: 12px; overflow: hidden; }
    .progress-fill { height: 100%; border-radius: 2px; transition: width 0.4s ease; }
    .progress-fill.ok { background: var(--green); }
    .progress-fill.warn { background: var(--yellow); }
    .progress-fill.error { background: var(--red); }
    .progress-fill.accent { background: var(--accent); }

    .strata-row { display: flex; gap: 8px; margin-top: 16px; }
    .stratum-chip {
      flex: 1;
      padding: 12px 8px;
      background: var(--bg);
      border-radius: 8px;
      text-align: center;
      font-size: 10px;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--text-3);
      border: 1px solid transparent;
      transition: all 0.2s;
    }
    .stratum-chip.active {
      background: rgba(59, 130, 246, 0.1);
      border-color: var(--accent);
      color: var(--accent);
    }
    .stratum-chip .value { display: block; font-size: 14px; font-weight: 600; margin-top: 4px; color: var(--text); }

    .list { display: flex; flex-direction: column; gap: 12px; }
    .list-item {
      display: flex; justify-content: space-between; align-items: center;
      padding: 12px 16px;
      background: var(--bg);
      border-radius: 8px;
    }
    .list-label { font-size: 13px; color: var(--text-2); }
    .list-value { font-size: 14px; font-weight: 600; font-variant-numeric: tabular-nums; }

    .log-list { max-height: 200px; overflow-y: auto; }
    .log-item { padding: 10px 0; border-bottom: 1px solid var(--border); font-size: 12px; font-family: 'SF Mono', Monaco, monospace; }
    .log-item:last-child { border-bottom: none; }
    .log-time { color: var(--text-3); margin-right: 12px; }
    .log-msg { color: var(--text-2); }
    .log-msg.error { color: var(--red); }
    .log-msg.warn { color: var(--yellow); }

    .uncertainty-grid { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
    .uncertainty-tag {
      padding: 6px 10px;
      background: var(--bg);
      border-radius: 6px;
      font-size: 11px;
      color: var(--text-2);
    }
    .uncertainty-tag span { color: var(--text); font-weight: 600; margin-left: 4px; }

    #error { display: none; padding: 16px; background: rgba(239, 68, 68, 0.1); border: 1px solid var(--red); border-radius: var(--radius); color: var(--red); margin-bottom: 24px; font-size: 13px; }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div class="header-top">
        <div class="logo">
          <div class="logo-mark">N</div>
          <span class="logo-text">NOUS</span>
        </div>
        <div class="status-pill">
          <div id="status-dot" class="status-dot ok"></div>
          <span id="status-text">Operational</span>
          <span id="timestamp">--:--:--</span>
        </div>
      </div>
      <p class="subtitle">Autopoietic System Monitor</p>
    </header>

    <div id="error"></div>

    <div class="grid">
      <div class="col-8">
        <div class="card">
          <div class="card-header">
            <span class="card-title">Entity Configuration</span>
            <span id="stratum-badge" class="card-badge ok">LOGOS</span>
          </div>
          <div class="metric-grid">
            <div class="metric">
              <div class="metric-label">Closure (C)</div>
              <div class="metric-value"><span id="closure">0.00</span></div>
              <div class="progress-bar"><div id="closure-bar" class="progress-fill accent" style="width:0%"></div></div>
            </div>
            <div class="metric">
              <div class="metric-label">Scope (S)</div>
              <div class="metric-value"><span id="scope">0.00</span></div>
              <div class="progress-bar"><div id="scope-bar" class="progress-fill accent" style="width:0%"></div></div>
            </div>
            <div class="metric">
              <div class="metric-label">Stratum Level</div>
              <div class="metric-value"><span id="stratumLevel">0</span><span class="metric-unit">%</span></div>
              <div class="progress-bar"><div id="stratum-bar" class="progress-fill ok" style="width:0%"></div></div>
            </div>
            <div class="metric">
              <div class="metric-label">Capabilities (K)</div>
              <div class="metric-value sm"><span id="capabilities">0</span></div>
            </div>
          </div>
          <div class="strata-row" id="strata"></div>
        </div>
      </div>

      <div class="col-4">
        <div class="card">
          <div class="card-header">
            <span class="card-title">Telemetry</span>
            <span id="mode-badge" class="card-badge ok">READY</span>
          </div>
          <div class="list">
            <div class="list-item">
              <span class="list-label">FEEL</span>
              <span id="feel" class="list-value">0%</span>
            </div>
            <div class="list-item">
              <span class="list-label">Subjective Gap</span>
              <span id="gap" class="list-value">0%</span>
            </div>
            <div class="list-item">
              <span class="list-label">Sycophancy</span>
              <span id="syc" class="list-value">0%</span>
            </div>
            <div class="list-item">
              <span class="list-label">Grounded</span>
              <span id="grounded" class="list-value ok">YES</span>
            </div>
          </div>
        </div>
      </div>

      <div class="col-4">
        <div class="card">
          <div class="card-header">
            <span class="card-title">Dispute Status</span>
          </div>
          <div class="list">
            <div class="list-item">
              <span class="list-label">Locked</span>
              <span id="locked" class="list-value ok">NO</span>
            </div>
            <div class="list-item">
              <span class="list-label">Duration</span>
              <span id="duration" class="list-value">0s</span>
            </div>
            <div class="list-item">
              <span class="list-label">Events (24h)</span>
              <span id="count24h" class="list-value">0</span>
            </div>
            <div class="list-item">
              <span class="list-label">Open Issues</span>
              <span id="openIssues" class="list-value">0</span>
            </div>
          </div>
        </div>
      </div>

      <div class="col-4">
        <div class="card">
          <div class="card-header">
            <span class="card-title">Silence Protocol</span>
          </div>
          <div class="list">
            <div class="list-item">
              <span class="list-label">Total Events</span>
              <span id="totalEvents" class="list-value">0</span>
            </div>
            <div class="list-item">
              <span class="list-label">Suspensions</span>
              <span id="suspensions" class="list-value">0</span>
            </div>
            <div class="list-item">
              <span class="list-label">Warnings</span>
              <span id="warnings" class="list-value">0</span>
            </div>
            <div class="list-item">
              <span class="list-label">Avg Gap</span>
              <span id="avgGap" class="list-value">0%</span>
            </div>
          </div>
        </div>
      </div>

      <div class="col-4">
        <div class="card">
          <div class="card-header">
            <span class="card-title">Uncertainty (U)</span>
          </div>
          <div id="uncertainties" class="uncertainty-grid"></div>
        </div>
      </div>

      <div class="col-8">
        <div class="card">
          <div class="card-header">
            <span class="card-title">Activity Log</span>
          </div>
          <div id="logs" class="log-list"></div>
        </div>
      </div>
    </div>
  </div>

  <script>
    const API = 'http://localhost:3001';

    function cls(v, t = [0.5, 0.7]) {
      return v < t[0] ? 'ok' : v < t[1] ? 'warn' : 'error';
    }

    async function refresh() {
      try {
        const [statusRes, logsRes] = await Promise.all([
          fetch(API + '/status'),
          fetch(API + '/logs?limit=6')
        ]);
        const s = await statusRes.json();
        const l = await logsRes.json();
        document.getElementById('error').style.display = 'none';
        document.getElementById('timestamp').textContent = s.timestamp.split('T')[1].split('.')[0];

        // Status
        const t = s.telemetry;
        const isOk = t.mode === 'READY' && !s.dispute.locked;
        document.getElementById('status-dot').className = 'status-dot ' + (isOk ? 'ok' : t.mode === 'WARN' ? 'warn' : 'error');
        document.getElementById('status-text').textContent = isOk ? 'Operational' : t.mode;

        // Atlas
        const a = s.atlas;
        document.getElementById('closure').textContent = a.C.toFixed(2);
        document.getElementById('closure-bar').style.width = (a.C * 100) + '%';
        document.getElementById('scope').textContent = a.S.toFixed(2);
        document.getElementById('scope-bar').style.width = (a.S * 100) + '%';
        document.getElementById('stratumLevel').textContent = (a.stratumLevel * 100).toFixed(0);
        document.getElementById('stratum-bar').style.width = (a.stratumLevel * 100) + '%';
        document.getElementById('stratum-badge').textContent = a.stratum;
        document.getElementById('capabilities').textContent = a.capabilities;

        document.getElementById('strata').innerHTML = ['MATTER', 'LIFE', 'SENTIENCE', 'LOGOS'].map(st => {
          const v = a.strata[st];
          const active = v === true || (typeof v === 'number' && v > 0);
          const val = typeof v === 'number' ? (v * 100).toFixed(0) + '%' : (v ? '100%' : '0%');
          return '<div class="stratum-chip' + (active ? ' active' : '') + '">' + st + '<span class="value">' + val + '</span></div>';
        }).join('');

        const uKeys = Object.keys(a.uncertainties);
        document.getElementById('uncertainties').innerHTML = uKeys.length > 0
          ? uKeys.map(k => '<div class="uncertainty-tag">' + k + '<span>' + (a.uncertainties[k] * 100).toFixed(0) + '%</span></div>').join('')
          : '<div class="uncertainty-tag">No data</div>';

        // Telemetry
        document.getElementById('mode-badge').textContent = t.mode;
        document.getElementById('mode-badge').className = 'card-badge ' + (t.mode === 'READY' ? 'ok' : t.mode === 'WARN' ? 'warn' : 'error');
        document.getElementById('feel').textContent = (t.feel * 100).toFixed(1) + '%';
        document.getElementById('feel').className = 'list-value ' + cls(1 - t.feel);
        document.getElementById('gap').textContent = (t.gap * 100).toFixed(1) + '%';
        document.getElementById('gap').className = 'list-value ' + cls(t.gap);
        document.getElementById('syc').textContent = (t.sycophancy * 100).toFixed(1) + '%';
        document.getElementById('syc').className = 'list-value ' + cls(t.sycophancy, [0.3, 0.7]);
        document.getElementById('grounded').textContent = t.grounded ? 'YES' : 'NO';
        document.getElementById('grounded').className = 'list-value ' + (t.grounded ? 'ok' : 'error');

        // Dispute
        const d = s.dispute;
        document.getElementById('locked').textContent = d.locked ? 'YES' : 'NO';
        document.getElementById('locked').className = 'list-value ' + (d.locked ? 'error' : 'ok');
        document.getElementById('duration').textContent = Math.floor(d.durationMs / 1000) + 's';
        document.getElementById('count24h').textContent = d.count24h;
        document.getElementById('openIssues').textContent = d.openIssues;
        document.getElementById('openIssues').className = 'list-value ' + (d.openIssues > 0 ? 'warn' : '');

        // Silence
        const si = s.silence;
        document.getElementById('totalEvents').textContent = si.total_events;
        document.getElementById('suspensions').textContent = si.suspensions;
        document.getElementById('suspensions').className = 'list-value ' + (si.suspensions > 0 ? 'error' : '');
        document.getElementById('warnings').textContent = si.warnings;
        document.getElementById('avgGap').textContent = (si.avg_gap * 100).toFixed(1) + '%';

        // Logs
        document.getElementById('logs').innerHTML = l.logs.length > 0
          ? l.logs.map(x => '<div class="log-item"><span class="log-time">' + x.timestamp.split('T')[1].split('.')[0] + '</span><span class="log-msg ' + x.level.toLowerCase() + '">' + x.message + '</span></div>').join('')
          : '<div class="log-item"><span class="log-msg">No recent activity</span></div>';
      } catch (e) {
        document.getElementById('error').textContent = 'Connection error: ' + e.message;
        document.getElementById('error').style.display = 'block';
        document.getElementById('status-dot').className = 'status-dot error';
        document.getElementById('status-text').textContent = 'Offline';
      }
    }
    refresh();
    setInterval(refresh, 5000);
  </script>
</body>
</html>`;

function handleRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
  const url = new URL(req.url || '/', `http://${req.headers.host}`);
  if (url.pathname === '/' || url.pathname === '/dashboard') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(DASHBOARD_HTML);
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
}

export function startDashboard(port = 3000): http.Server {
  const server = http.createServer(handleRequest);
  server.listen(port, () => console.log('[DASHBOARD] http://localhost:' + port));
  return server;
}

export function stopDashboard(server: http.Server): void {
  server.close();
}
