/**
 * NOUS Dashboard Server
 *
 * Read-only web dashboard.
 * Serves static HTML + fetches from API.
 */

import * as http from 'http';
import { URL } from 'url';

const DASHBOARD_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>NOUS Dashboard</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'SF Mono', 'Monaco', 'Consolas', monospace;
      background: #0d1117;
      color: #c9d1d9;
      padding: 20px;
    }
    h1 { color: #58a6ff; margin-bottom: 20px; font-size: 24px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; }
    .card {
      background: #161b22;
      border: 1px solid #30363d;
      border-radius: 6px;
      padding: 16px;
    }
    .card h2 { color: #8b949e; font-size: 12px; text-transform: uppercase; margin-bottom: 12px; }
    .metric { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #21262d; }
    .metric:last-child { border-bottom: none; }
    .metric .label { color: #8b949e; }
    .metric .value { color: #c9d1d9; font-weight: bold; }
    .metric .value.ok { color: #3fb950; }
    .metric .value.warn { color: #d29922; }
    .metric .value.error { color: #f85149; }
    .bar { height: 8px; background: #21262d; border-radius: 4px; overflow: hidden; margin-top: 4px; }
    .bar-fill { height: 100%; transition: width 0.3s; }
    .bar-fill.ok { background: #3fb950; }
    .bar-fill.warn { background: #d29922; }
    .bar-fill.error { background: #f85149; }
    .status-badge {
      display: inline-block;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: bold;
    }
    .status-badge.ready { background: #238636; color: #fff; }
    .status-badge.warn { background: #9e6a03; color: #fff; }
    .status-badge.locked { background: #da3633; color: #fff; }
    .log-entry { font-size: 11px; padding: 4px 0; border-bottom: 1px solid #21262d; }
    .log-entry .time { color: #6e7681; }
    .log-entry.ERROR .msg { color: #f85149; }
    .log-entry.WARN .msg { color: #d29922; }
    .refresh { color: #6e7681; font-size: 11px; margin-top: 20px; }
    #error { color: #f85149; padding: 10px; display: none; }
  </style>
</head>
<body>
  <h1>NOUS Dashboard</h1>
  <div id="error"></div>
  <div class="grid">
    <div class="card">
      <h2>Telemetry</h2>
      <div class="metric">
        <span class="label">Mode</span>
        <span id="mode" class="status-badge ready">READY</span>
      </div>
      <div class="metric">
        <span class="label">FEEL</span>
        <span id="feel" class="value">0%</span>
      </div>
      <div class="bar"><div id="feel-bar" class="bar-fill ok" style="width: 0%"></div></div>
      <div class="metric">
        <span class="label">GAP</span>
        <span id="gap" class="value">0%</span>
      </div>
      <div class="bar"><div id="gap-bar" class="bar-fill ok" style="width: 0%"></div></div>
      <div class="metric">
        <span class="label">SYCOPHANCY</span>
        <span id="syc" class="value">0%</span>
      </div>
      <div class="bar"><div id="syc-bar" class="bar-fill ok" style="width: 0%"></div></div>
      <div class="metric">
        <span class="label">GROUNDED</span>
        <span id="grounded" class="value ok">YES</span>
      </div>
    </div>
    <div class="card">
      <h2>Dispute Status</h2>
      <div class="metric">
        <span class="label">Locked</span>
        <span id="locked" class="value">NO</span>
      </div>
      <div class="metric">
        <span class="label">Duration</span>
        <span id="duration" class="value">0s</span>
      </div>
      <div class="metric">
        <span class="label">Count (24h)</span>
        <span id="count24h" class="value">0</span>
      </div>
      <div class="metric">
        <span class="label">Open Issues</span>
        <span id="openIssues" class="value">0</span>
      </div>
    </div>
    <div class="card">
      <h2>Silence Protocol</h2>
      <div class="metric">
        <span class="label">Total Events</span>
        <span id="totalEvents" class="value">0</span>
      </div>
      <div class="metric">
        <span class="label">Suspensions</span>
        <span id="suspensions" class="value">0</span>
      </div>
      <div class="metric">
        <span class="label">Warnings</span>
        <span id="warnings" class="value">0</span>
      </div>
      <div class="metric">
        <span class="label">Avg Gap</span>
        <span id="avgGap" class="value">0%</span>
      </div>
    </div>
    <div class="card">
      <h2>Recent Logs</h2>
      <div id="logs"></div>
    </div>
  </div>
  <p class="refresh">Auto-refresh: 5s | API: <a href="http://localhost:3001/status" style="color:#58a6ff">localhost:3001</a></p>
  <script>
    const API = 'http://localhost:3001';

    function barClass(value, thresholds = [0.5, 0.7]) {
      if (value < thresholds[0]) return 'ok';
      if (value < thresholds[1]) return 'warn';
      return 'error';
    }

    function valueClass(value, thresholds = [0.5, 0.7]) {
      if (value < thresholds[0]) return 'ok';
      if (value < thresholds[1]) return 'warn';
      return 'error';
    }

    async function refresh() {
      try {
        const [statusRes, logsRes] = await Promise.all([
          fetch(API + '/status'),
          fetch(API + '/logs?limit=10')
        ]);
        const status = await statusRes.json();
        const logsData = await logsRes.json();

        document.getElementById('error').style.display = 'none';

        // Telemetry
        const t = status.telemetry;
        document.getElementById('mode').textContent = t.mode;
        document.getElementById('mode').className = 'status-badge ' + t.mode.toLowerCase();

        document.getElementById('feel').textContent = (t.feel * 100).toFixed(1) + '%';
        document.getElementById('feel-bar').style.width = (t.feel * 100) + '%';
        document.getElementById('feel-bar').className = 'bar-fill ' + barClass(1 - t.feel);

        document.getElementById('gap').textContent = (t.gap * 100).toFixed(1) + '%';
        document.getElementById('gap').className = 'value ' + valueClass(t.gap);
        document.getElementById('gap-bar').style.width = (t.gap * 100) + '%';
        document.getElementById('gap-bar').className = 'bar-fill ' + barClass(t.gap);

        document.getElementById('syc').textContent = (t.sycophancy * 100).toFixed(1) + '%';
        document.getElementById('syc').className = 'value ' + valueClass(t.sycophancy, [0.3, 0.7]);
        document.getElementById('syc-bar').style.width = (t.sycophancy * 100) + '%';
        document.getElementById('syc-bar').className = 'bar-fill ' + barClass(t.sycophancy, [0.3, 0.7]);

        document.getElementById('grounded').textContent = t.grounded ? 'YES' : 'NO';
        document.getElementById('grounded').className = 'value ' + (t.grounded ? 'ok' : 'error');

        // Dispute
        const d = status.dispute;
        document.getElementById('locked').textContent = d.locked ? 'YES' : 'NO';
        document.getElementById('locked').className = 'value ' + (d.locked ? 'error' : 'ok');
        document.getElementById('duration').textContent = Math.floor(d.durationMs / 1000) + 's';
        document.getElementById('count24h').textContent = d.count24h;
        document.getElementById('openIssues').textContent = d.openIssues;
        document.getElementById('openIssues').className = 'value ' + (d.openIssues > 0 ? 'warn' : 'ok');

        // Silence
        const s = status.silence;
        document.getElementById('totalEvents').textContent = s.total_events;
        document.getElementById('suspensions').textContent = s.suspensions;
        document.getElementById('suspensions').className = 'value ' + (s.suspensions > 0 ? 'error' : 'ok');
        document.getElementById('warnings').textContent = s.warnings;
        document.getElementById('avgGap').textContent = (s.avg_gap * 100).toFixed(1) + '%';

        // Logs
        const logsEl = document.getElementById('logs');
        logsEl.innerHTML = logsData.logs.map(l =>
          '<div class="log-entry ' + l.level + '"><span class="time">' +
          l.timestamp.split('T')[1].split('.')[0] + '</span> <span class="msg">' +
          l.message + '</span></div>'
        ).join('');

      } catch (err) {
        document.getElementById('error').textContent = 'API unavailable: ' + err.message;
        document.getElementById('error').style.display = 'block';
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
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  }
}

export function startDashboard(port = 3000): http.Server {
  const server = http.createServer(handleRequest);
  server.listen(port, () => {
    console.log(`[DASHBOARD] http://localhost:${port}`);
  });
  return server;
}

export function stopDashboard(server: http.Server): void {
  server.close();
}
