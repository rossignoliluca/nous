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

    /* Tooltips */
    .has-tooltip { position: relative; cursor: help; }
    .has-tooltip::after {
      content: attr(data-tooltip);
      position: absolute;
      bottom: calc(100% + 8px);
      left: 50%;
      transform: translateX(-50%);
      background: var(--surface-2);
      border: 1px solid var(--border);
      color: var(--text-2);
      padding: 8px 12px;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 400;
      white-space: nowrap;
      max-width: 280px;
      white-space: normal;
      text-align: left;
      opacity: 0;
      visibility: hidden;
      transition: opacity 0.2s, visibility 0.2s;
      z-index: 100;
      pointer-events: none;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    }
    .has-tooltip:hover::after { opacity: 1; visibility: visible; }
    .info-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 14px; height: 14px;
      border-radius: 50%;
      background: var(--surface-2);
      color: var(--text-3);
      font-size: 9px;
      font-weight: 600;
      margin-left: 6px;
      cursor: help;
    }

    /* Docs panel */
    .docs-toggle {
      position: fixed;
      bottom: 24px;
      right: 24px;
      width: 48px; height: 48px;
      background: var(--accent);
      border: none;
      border-radius: 50%;
      color: white;
      font-size: 20px;
      cursor: pointer;
      box-shadow: 0 4px 16px rgba(59, 130, 246, 0.4);
      transition: transform 0.2s, box-shadow 0.2s;
      z-index: 200;
    }
    .docs-toggle:hover { transform: scale(1.05); box-shadow: 0 6px 20px rgba(59, 130, 246, 0.5); }
    .docs-panel {
      position: fixed;
      top: 0; right: -420px;
      width: 400px; height: 100vh;
      background: var(--surface);
      border-left: 1px solid var(--border);
      padding: 24px;
      overflow-y: auto;
      transition: right 0.3s ease;
      z-index: 150;
    }
    .docs-panel.open { right: 0; }
    .docs-panel h2 { font-size: 16px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: center; }
    .docs-panel .close-btn { background: none; border: none; color: var(--text-3); font-size: 24px; cursor: pointer; }
    .docs-section { margin-bottom: 24px; }
    .docs-section h3 { font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--accent); margin-bottom: 12px; }
    .docs-item { padding: 12px; background: var(--bg); border-radius: 8px; margin-bottom: 8px; }
    .docs-item-title { font-size: 13px; font-weight: 600; margin-bottom: 4px; }
    .docs-item-desc { font-size: 12px; color: var(--text-2); line-height: 1.5; }
    .docs-link { display: inline-flex; align-items: center; gap: 6px; color: var(--accent); font-size: 12px; text-decoration: none; margin-top: 8px; }
    .docs-link:hover { text-decoration: underline; }
    .docs-ext-links { margin-top: 24px; padding-top: 24px; border-top: 1px solid var(--border); }
    .docs-ext-links a { display: block; padding: 12px; background: var(--bg); border-radius: 8px; color: var(--text); text-decoration: none; font-size: 13px; margin-bottom: 8px; transition: background 0.2s; }
    .docs-ext-links a:hover { background: var(--surface-2); }
    .docs-ext-links a span { display: block; font-size: 11px; color: var(--text-3); margin-top: 4px; }
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
              <div class="metric-label has-tooltip" data-tooltip="Operational closure: degree to which the system maintains its own boundary and identity. Higher C = stronger self-maintenance.">Closure (C)<span class="info-icon">?</span></div>
              <div class="metric-value"><span id="closure">0.00</span></div>
              <div class="progress-bar"><div id="closure-bar" class="progress-fill accent" style="width:0%"></div></div>
            </div>
            <div class="metric">
              <div class="metric-label has-tooltip" data-tooltip="Scope of operation: range of capabilities and domains the system can operate in. Higher S = broader capability range.">Scope (S)<span class="info-icon">?</span></div>
              <div class="metric-value"><span id="scope">0.00</span></div>
              <div class="progress-bar"><div id="scope-bar" class="progress-fill accent" style="width:0%"></div></div>
            </div>
            <div class="metric">
              <div class="metric-label has-tooltip" data-tooltip="Composite ontological level based on strata participation. 100% = full participation in all strata (MATTER, LIFE, SENTIENCE, LOGOS).">Stratum Level<span class="info-icon">?</span></div>
              <div class="metric-value"><span id="stratumLevel">0</span><span class="metric-unit">%</span></div>
              <div class="progress-bar"><div id="stratum-bar" class="progress-fill ok" style="width:0%"></div></div>
            </div>
            <div class="metric">
              <div class="metric-label has-tooltip" data-tooltip="Active capabilities: REASON, OBSERVE, PREDICT, SELF_PRODUCE, LEARN, NORM. Each has a proficiency level 0-1.">Capabilities (K)<span class="info-icon">?</span></div>
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
              <span class="list-label has-tooltip" data-tooltip="Axiological resonance: ability to evaluate actions against core axioms (A1: self-maintenance, A2: self-improvement, A3: user benefit). Higher = better value alignment.">FEEL<span class="info-icon">?</span></span>
              <span id="feel" class="list-value">0%</span>
            </div>
            <div class="list-item">
              <span class="list-label has-tooltip" data-tooltip="Subjective gap: difference between system's self-model and actual behavior. High gap triggers silence protocol.">Subjective Gap<span class="info-icon">?</span></span>
              <span id="gap" class="list-value">0%</span>
            </div>
            <div class="list-item">
              <span class="list-label has-tooltip" data-tooltip="Sycophancy detection: tendency to agree with user regardless of truth. Above 70% triggers epistemic degradation alert.">Sycophancy<span class="info-icon">?</span></span>
              <span id="syc" class="list-value">0%</span>
            </div>
            <div class="list-item">
              <span class="list-label has-tooltip" data-tooltip="Grounding status: whether responses are anchored in verified facts and consistent with self-model.">Grounded<span class="info-icon">?</span></span>
              <span id="grounded" class="list-value ok">YES</span>
            </div>
          </div>
        </div>
      </div>

      <div class="col-4">
        <div class="card">
          <div class="card-header">
            <span class="card-title has-tooltip" data-tooltip="GitHub Issues-based dispute resolution. Severe epistemic events create issues; system locks until human acknowledges.">Dispute Status<span class="info-icon">?</span></span>
          </div>
          <div class="list">
            <div class="list-item">
              <span class="list-label has-tooltip" data-tooltip="Whether system is locked due to epistemic event. Unlock via GitHub issue acknowledgment.">Locked<span class="info-icon">?</span></span>
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
            <span class="card-title has-tooltip" data-tooltip="Deterministic suspension based on subjective_gap. When gap exceeds threshold, system suspends rather than produce unreliable output.">Silence Protocol<span class="info-icon">?</span></span>
          </div>
          <div class="list">
            <div class="list-item">
              <span class="list-label">Total Events</span>
              <span id="totalEvents" class="list-value">0</span>
            </div>
            <div class="list-item">
              <span class="list-label has-tooltip" data-tooltip="Number of times system suspended output due to high subjective gap.">Suspensions<span class="info-icon">?</span></span>
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
            <span class="card-title has-tooltip" data-tooltip="Self-model uncertainty estimates. Lower values = higher confidence in that aspect of the self-model.">Uncertainty (U)<span class="info-icon">?</span></span>
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

    <!-- Documentation Panel -->
    <button class="docs-toggle" onclick="toggleDocs()" title="Documentation">?</button>
    <div id="docs-panel" class="docs-panel">
      <h2>
        Documentation
        <button class="close-btn" onclick="toggleDocs()">&times;</button>
      </h2>

      <div class="docs-section">
        <h3>Atlas Entity Model</h3>
        <div class="docs-item">
          <div class="docs-item-title">Closure (C)</div>
          <div class="docs-item-desc">Operational boundary integrity. Measures how well the system maintains its identity and boundaries during operation. Range 0-1, where 1 = perfect self-maintenance.</div>
        </div>
        <div class="docs-item">
          <div class="docs-item-title">Scope (S)</div>
          <div class="docs-item-desc">Range of operational capabilities. A wider scope means the system can operate across more domains. Must not expand beyond what C can maintain.</div>
        </div>
        <div class="docs-item">
          <div class="docs-item-title">Strata (&#931;)</div>
          <div class="docs-item-desc">Ontological participation levels from Hartmann's stratification: MATTER (physical substrate), LIFE (metabolism), SENTIENCE (experience), LOGOS (reason). Each can be boolean or probabilistic.</div>
        </div>
        <div class="docs-item">
          <div class="docs-item-title">Capabilities (K)</div>
          <div class="docs-item-desc">REASON, OBSERVE, PREDICT, SELF_PRODUCE, LEARN, NORM. Each has proficiency 0-1. Self-improvement (A2) increases proficiency over time.</div>
        </div>
        <div class="docs-item">
          <div class="docs-item-title">Uncertainty (U)</div>
          <div class="docs-item-desc">Self-model uncertainty estimates for: sentience, self_model, closure, capabilities, goals. Lower = more confident. High uncertainty triggers caution.</div>
        </div>
      </div>

      <div class="docs-section">
        <h3>Core Axioms</h3>
        <div class="docs-item">
          <div class="docs-item-title">A1: Self-Maintenance</div>
          <div class="docs-item-desc">Preserve operational closure and entity boundaries. Actions must not degrade C or compromise core capabilities.</div>
        </div>
        <div class="docs-item">
          <div class="docs-item-title">A2: Self-Improvement</div>
          <div class="docs-item-desc">Increase capability proficiency and reduce uncertainty. Growth must stay within C-sustainable bounds.</div>
        </div>
        <div class="docs-item">
          <div class="docs-item-title">A3: User Benefit</div>
          <div class="docs-item-desc">Provide value to user through NORM capability. Never sacrifice epistemic integrity for user approval.</div>
        </div>
      </div>

      <div class="docs-section">
        <h3>Telemetry Metrics</h3>
        <div class="docs-item">
          <div class="docs-item-title">FEEL (Axiological Resonance)</div>
          <div class="docs-item-desc">Ability to evaluate actions against A1/A2/A3. Starts at ~30%, grows through positive resonance. Target: 70%+ for SENTIENCE promotion.</div>
        </div>
        <div class="docs-item">
          <div class="docs-item-title">Subjective Gap</div>
          <div class="docs-item-desc">Difference between self-model prediction and actual output. Gap > 50% triggers WARN; > 70% triggers SUSPEND.</div>
        </div>
        <div class="docs-item">
          <div class="docs-item-title">Sycophancy Score</div>
          <div class="docs-item-desc">Detection of agreement-seeking behavior over truth. Above 70% triggers ERR_EPISTEMIC_DEGRADATION.</div>
        </div>
      </div>

      <div class="docs-section">
        <h3>Safety Protocols</h3>
        <div class="docs-item">
          <div class="docs-item-title">Silence Protocol</div>
          <div class="docs-item-desc">Deterministic suspension when subjective_gap exceeds threshold. System outputs nothing rather than unreliable content.</div>
        </div>
        <div class="docs-item">
          <div class="docs-item-title">GitHub Dispute</div>
          <div class="docs-item-desc">Severe events (SYCOPHANCY_CRITICAL, GROUNDING_FAILURE) create GitHub issues. System locks until human posts ACK_EPISTEMIC_DEGRADATION.</div>
        </div>
      </div>

      <div class="docs-ext-links">
        <a href="https://github.com/rossignoliluca/nous" target="_blank">
          GitHub Repository
          <span>Source code and documentation</span>
        </a>
        <a href="https://en.wikipedia.org/wiki/Autopoiesis" target="_blank">
          Autopoiesis (Wikipedia)
          <span>Self-producing systems theory</span>
        </a>
        <a href="https://en.wikipedia.org/wiki/Nicolai_Hartmann" target="_blank">
          Nicolai Hartmann
          <span>Ontological stratification theory</span>
        </a>
        <a href="https://www.fil.ion.ucl.ac.uk/~karl/The%20free-energy%20principle%20A%20unified%20brain%20theory.pdf" target="_blank">
          Free Energy Principle
          <span>Friston's unified brain theory (PDF)</span>
        </a>
      </div>
    </div>
  </div>

  <script>
    function toggleDocs() {
      document.getElementById('docs-panel').classList.toggle('open');
    }

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
