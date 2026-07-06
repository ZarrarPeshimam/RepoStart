import * as vscode from 'vscode';

export function getDashboardHTML(
  webview: vscode.Webview,
  extensionUri: vscode.Uri
): string {
  const iconUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, 'assets', 'icon.png')
  );
  return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src ${webview.cspSource};" />
  <title>RepoStart</title>
  <style>
    /* ─── Reset & Base ─────────────────────────────── */
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --bg:           #0d0f12;
      --bg-card:      #13161b;
      --bg-hover:     #1a1e26;
      --border:       #1e2430;
      --border-light: #252c3a;
      --accent:       #4f8ef7;
      --accent-glow:  rgba(79,142,247,0.18);
      --accent-dim:   rgba(79,142,247,0.08);
      --green:        #34c97b;
      --yellow:       #f5c842;
      --red:          #f05b5b;
      --purple:       #a87cff;
      --text-primary: #e2e8f2;
      --text-secondary: #7a8899;
      --text-muted:   #4a5568;
      --font-mono:    'JetBrains Mono', 'Cascadia Code', 'Fira Code', 'Consolas', monospace;
      --font-ui:      -apple-system, 'Segoe UI', system-ui, sans-serif;
      --radius:       8px;
      --radius-sm:    5px;
      --transition:   160ms ease;
    }

    html, body { background: var(--bg); color: var(--text-primary); font-family: var(--font-ui);
      font-size: 13px; line-height: 1.5; height: 100%; overflow: hidden; }

    /* ─── Layout ───────────────────────────────────── */
    #app { display: flex; flex-direction: column; height: 100vh; overflow: hidden; }

    /* ─── Header ───────────────────────────────────── */
    #header { display: flex; align-items: center; justify-content: space-between;
      padding: 12px 14px 10px; border-bottom: 1px solid var(--border);
      background: var(--bg); flex-shrink: 0; }

    .logo { display: flex; align-items: center; gap: 8px; }
    .logo-icon { width: 20px; height: 20px; object-fit: contain; display: inline-block; vertical-align: middle; }
    .logo-text { font-size: 14px; font-weight: 700; letter-spacing: -0.3px; }
    .logo-badge { font-size: 10px; font-weight: 600; letter-spacing: 0.5px; color: var(--accent);
      background: var(--accent-dim); border: 1px solid rgba(79,142,247,0.2);
      padding: 2px 6px; border-radius: 20px; text-transform: uppercase; }

    /* ─── Buttons ──────────────────────────────────── */
    .btn {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 6px 14px; border: none; border-radius: var(--radius-sm);
      font-size: 12px; font-weight: 600; cursor: pointer;
      transition: all var(--transition); letter-spacing: 0.2px;
      font-family: var(--font-ui); white-space: nowrap;
    }
    .btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-primary { background: var(--accent); color: #fff; }
    .btn-primary:hover:not(:disabled) { background: #6ba0f9; transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(79,142,247,0.35); }
    .btn-secondary { background: var(--bg-card); border: 1px solid var(--border-light);
      color: var(--text-secondary); }
    .btn-secondary:hover:not(:disabled) { border-color: var(--accent);
      color: var(--text-primary); }
    .btn-green { background: rgba(52,201,123,0.12); border: 1px solid rgba(52,201,123,0.3);
      color: var(--green); }
    .btn-green:hover:not(:disabled) { background: rgba(52,201,123,0.2); transform: translateY(-1px); }
    .btn-muted { background: var(--bg-hover); border: 1px solid var(--border);
      color: var(--text-muted); font-size: 11px; padding: 5px 12px; }
    .btn-muted:hover:not(:disabled) { color: var(--text-secondary); }
    .btn.running { background: var(--bg-card); border: 1px solid var(--border-light);
      color: var(--yellow); }
    .btn-icon { font-size: 13px; }

    /* ─── Tabs ─────────────────────────────────────── */
    #tabs { display: flex; border-bottom: 1px solid var(--border); background: var(--bg);
      flex-shrink: 0; padding: 0 8px; }

    .tab { padding: 8px 10px; font-size: 12px; font-weight: 500; color: var(--text-secondary);
      cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -1px;
      transition: all var(--transition); user-select: none;
      display: flex; align-items: center; gap: 5px; }
    .tab:hover { color: var(--text-primary); }
    .tab.active { color: var(--accent); border-bottom-color: var(--accent); }
    .tab-badge { background: var(--accent-dim); color: var(--accent); font-size: 10px;
      font-weight: 700; padding: 1px 5px; border-radius: 10px;
      min-width: 18px; text-align: center; }

    /* ─── Content ──────────────────────────────────── */
    #content { flex: 1; overflow: hidden; position: relative; }
    .panel { display: none; height: 100%; overflow-y: auto; padding: 12px 12px 24px; }
    .panel.active { display: block; }
    .panel::-webkit-scrollbar { width: 4px; }
    .panel::-webkit-scrollbar-track { background: transparent; }
    .panel::-webkit-scrollbar-thumb { background: var(--border-light); border-radius: 4px; }

    /* ─── Section helpers ──────────────────────────── */
    .section-header {
      font-size: 10px; font-weight: 700; letter-spacing: 0.8px;
      text-transform: uppercase; color: var(--text-muted);
      margin: 16px 0 8px; display: flex; align-items: center; gap: 6px;
    }
    .section-header:first-child { margin-top: 0; }
    .section-divider { border: none; border-top: 1px solid var(--border); margin: 14px 0; }

    /* ─── Cards ────────────────────────────────────── */
    .card { background: var(--bg-card); border: 1px solid var(--border);
      border-radius: var(--radius); overflow: hidden; margin-bottom: 10px;
      animation: fadeIn 0.25s ease; }
    .card-header { padding: 9px 12px; border-bottom: 1px solid var(--border);
      display: flex; align-items: center; gap: 8px; }
    .card-title { font-size: 11px; font-weight: 700; letter-spacing: 0.7px;
      text-transform: uppercase; color: var(--text-secondary); }
    .card-body { padding: 10px 12px; }

    /* ─── Overview: Info rows ──────────────────────── */
    .info-grid { display: flex; flex-direction: column; gap: 6px; }
    .info-row { display: flex; align-items: center; justify-content: space-between;
      padding: 6px 0; border-bottom: 1px solid var(--border); }
    .info-row:last-child { border-bottom: none; }
    .info-label { font-size: 11px; color: var(--text-secondary); }
    .info-value { font-size: 11px; font-weight: 600; color: var(--text-primary); display: flex; align-items: center; gap: 5px; }

    /* ─── Badges ───────────────────────────────────── */
    .badge { font-size: 10px; font-weight: 600; padding: 2px 7px;
      border-radius: 20px; text-transform: capitalize; }
    .badge-arch-single   { background: rgba(168,124,255,0.12); color: var(--purple); border: 1px solid rgba(168,124,255,0.2); }
    .badge-arch-client-server { background: rgba(79,142,247,0.12); color: var(--accent); border: 1px solid rgba(79,142,247,0.2); }
    .badge-arch-multi-app { background: rgba(52,201,123,0.12); color: var(--green); border: 1px solid rgba(52,201,123,0.2); }
    .badge-pm { font-family: var(--font-mono); background: var(--bg-hover);
      color: var(--yellow); border: 1px solid var(--border-light); }
    .badge-fw-front { background: rgba(79,142,247,0.12); color: var(--accent); border: 1px solid rgba(79,142,247,0.2); }
    .badge-fw-back  { background: rgba(52,201,123,0.1); color: var(--green); border: 1px solid rgba(52,201,123,0.2); }
    .badge-env-ok   { background: rgba(52,201,123,0.12); color: var(--green); }
    .badge-env-none { background: var(--bg-hover); color: var(--text-muted); }

    /* ─── Status row ───────────────────────────────── */
    .status-row { display: flex; align-items: center; gap: 6px; margin-top: 8px;
      padding: 8px 10px; border-radius: var(--radius-sm);
      border: 1px solid var(--border); background: var(--bg); }
    .status-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
    .status-idle    { background: var(--text-muted); }
    .status-running { background: var(--yellow); animation: pulse 1s infinite; }
    .status-success { background: var(--green); }
    .status-error   { background: var(--red); }
    .status-text { font-size: 11px; color: var(--text-secondary); }

    /* ─── Service Status Cards ─────────────────────── */
    .service-grid { display: flex; flex-direction: column; gap: 6px; margin-bottom: 10px; }
    .service-card { display: flex; align-items: center; justify-content: space-between;
      padding: 8px 12px; border-radius: var(--radius-sm);
      border: 1px solid var(--border); background: var(--bg);
      transition: border-color var(--transition); }
    .service-card:hover { border-color: var(--border-light); }
    .service-label { font-size: 12px; font-weight: 600; color: var(--text-primary); }
    .service-state { display: flex; align-items: center; gap: 5px;
      font-size: 11px; color: var(--text-secondary); }
    .svc-dot { width: 8px; height: 8px; border-radius: 50%; }
    .svc-running { background: var(--green); }
    .svc-stopped { background: var(--red); }
    .svc-starting { background: var(--yellow); animation: pulse 1s infinite; }

    /* ─── Repo Structure ───────────────────────────── */
    .structure-tree { font-family: var(--font-mono); font-size: 11.5px;
      line-height: 1.7; color: var(--text-secondary); }
    .tree-group { margin-bottom: 10px; }
    .tree-group-label { font-size: 10px; font-weight: 700; letter-spacing: 0.6px;
      text-transform: uppercase; color: var(--text-muted); margin-bottom: 4px; }
    .tree-item { display: flex; align-items: center; gap: 4px; }
    .tree-connector { color: var(--text-muted); }
    .tree-name { color: var(--text-primary); font-weight: 500; }
    .tree-fw   { color: var(--text-secondary); font-size: 10.5px; }

    /* ─── Setup Summary ────────────────────────────── */
    .summary-grid { display: flex; flex-direction: column; gap: 5px; }
    .summary-row { display: flex; align-items: center; justify-content: space-between;
      padding: 5px 0; border-bottom: 1px solid var(--border); }
    .summary-row:last-child { border-bottom: none; }
    .summary-label { font-size: 11px; color: var(--text-secondary); }
    .summary-val { font-size: 11px; font-weight: 600; }
    .val-ok   { color: var(--green); }
    .val-fail { color: var(--red); }
    .val-skip { color: var(--text-muted); }
    .val-num  { color: var(--text-primary); font-family: var(--font-mono); }

    /* ─── Error Guidance ───────────────────────────── */
    .error-card { background: rgba(240,91,91,0.06); border: 1px solid rgba(240,91,91,0.2);
      border-radius: var(--radius-sm); padding: 8px 12px; margin-bottom: 6px;
      font-size: 11px; color: var(--red); animation: fadeIn 0.2s ease; }

    /* ─── Timeline Panel ───────────────────────────── */
    .timeline-empty { display: flex; flex-direction: column; align-items: center;
      justify-content: center; height: 160px; gap: 8px; color: var(--text-muted); }
    .timeline-list { display: flex; flex-direction: column; gap: 2px; }

    /* FIX: Timeline item — constrained width, no overflow */
    .timeline-item {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 7px 10px;
      border-radius: var(--radius-sm);
      border: 1px solid transparent;
      transition: all var(--transition);
      animation: slideIn 0.2s ease;
      width: 100%;
      max-width: 100%;
      min-width: 0;
      overflow: hidden;
    }
    .timeline-item.tl-running { background: rgba(245,200,66,0.04); border-color: rgba(245,200,66,0.12); }
    .timeline-item.tl-success { background: rgba(52,201,123,0.04); border-color: rgba(52,201,123,0.1); }
    .timeline-item.tl-error   { background: rgba(240,91,91,0.04); border-color: rgba(240,91,91,0.12); }
    .timeline-item.tl-skipped { opacity: 0.5; }
    .tl-icon { font-size: 13px; line-height: 1.5; flex-shrink: 0; width: 16px; text-align: center; }
    .tl-running-spinner { display: inline-block; animation: spin 0.8s linear infinite; }

    .tl-body { flex: 1; min-width: 0; }

    /* FIX: tl-header row holds label + timestamp side by side */
    .tl-header {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      width: 100%;
      min-width: 0;
    }

    /* FIX: Label wraps aggressively for long paths / repo names */
    .tl-label {
      flex: 1;
      min-width: 0;
      max-width: 100%;
      font-size: 12px;
      font-weight: 500;
      color: var(--text-primary);
      overflow-wrap: anywhere;
      word-break: break-word;
      white-space: normal;
    }

    /* FIX: Detail wraps for long command output / Windows paths */
    .tl-detail {
      font-size: 10.5px;
      color: var(--text-secondary);
      margin-top: 1px;
      font-family: var(--font-mono);
      min-width: 0;
      max-width: 100%;
      overflow-wrap: anywhere;
      word-break: break-word;
      white-space: pre-wrap;
    }

    /* FIX: Timestamp never shrinks or wraps */
    .tl-time {
      flex-shrink: 0;
      font-size: 10px;
      color: var(--text-muted);
      font-family: var(--font-mono);
      white-space: nowrap;
    }

    /* ─── Search Bar ───────────────────────────── */
.search-container {
  margin-bottom: 10px;
}

.search-input {
  width: 100%;
  padding: 7px 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg-card);
  color: var(--text-primary);
  font-size: 12px;
  outline: none;
  transition: border-color var(--transition);
}

.search-input:focus {
  border-color: var(--accent);
}

.search-input::placeholder {
  color: var(--text-muted);
}

    /* ─── Logs Panel ───────────────────────────────── */
    #logsPanel { padding: 0; display: none; flex-direction: column; }
    #logsPanel.active { display: flex; }
    .logs-toolbar { display: flex; align-items: center; justify-content: space-between;
      padding: 7px 12px; border-bottom: 1px solid var(--border); flex-shrink: 0; gap: 8px; }
    .logs-count { font-size: 11px; color: var(--text-secondary); }
    .logs-filters { display: flex; gap: 4px; }
    .log-filter-btn { font-size: 10px; padding: 2px 7px; border-radius: 3px;
      background: var(--bg-hover); border: 1px solid var(--border);
      color: var(--text-muted); cursor: pointer; font-family: var(--font-mono);
      transition: all var(--transition); }
    .log-filter-btn.active-filter { background: var(--accent-dim); border-color: rgba(79,142,247,0.3); color: var(--accent); }
    .clear-btn { font-size: 11px; color: var(--text-muted); background: none; border: none;
      cursor: pointer; padding: 2px 6px; border-radius: 4px; font-family: var(--font-ui);
      transition: all var(--transition); }
    .clear-btn:hover { background: var(--bg-hover); color: var(--text-secondary); }
    #logsList { flex: 1; overflow-y: auto; padding: 4px 2px; font-family: var(--font-mono); font-size: 11.5px; }
    #logsList::-webkit-scrollbar { width: 4px; }
    #logsList::-webkit-scrollbar-thumb { background: var(--border-light); border-radius: 4px; }
    .log-entry { display: flex; gap: 6px; padding: 2px 8px; border-radius: 3px;
      line-height: 1.5; animation: fadeIn 0.1s ease; }
    .log-entry:hover { background: var(--bg-card); }
    .log-time { color: var(--text-muted); flex-shrink: 0; font-size: 10px; padding-top: 1px; }
    .log-cat  { flex-shrink: 0; font-size: 9.5px; font-weight: 700; padding: 1px 5px;
      border-radius: 3px; margin-top: 2px; letter-spacing: 0.3px; }
    .cat-SYSTEM   { background: rgba(79,142,247,0.1); color: var(--accent); }
    .cat-SETUP    { background: rgba(168,124,255,0.1); color: var(--purple); }
    .cat-FRONTEND { background: rgba(79,142,247,0.12); color: var(--accent); }
    .cat-BACKEND  { background: rgba(52,201,123,0.1); color: var(--green); }
    .cat-ENV      { background: rgba(245,200,66,0.1); color: var(--yellow); }

    /* FIX: Log message — clean wrap instead of break-all */
    .log-msg {
      flex: 1;
      min-width: 0;
      overflow-wrap: anywhere;
      word-break: break-word;
      white-space: pre-wrap;
    }
    .log-info    .log-msg { color: var(--text-primary); }
    .log-warn    .log-msg { color: var(--yellow); }
    .log-error   .log-msg { color: var(--red); }
    .log-success .log-msg { color: var(--green); }
    .log-system  .log-msg { color: var(--accent); opacity: 0.85; }
    .logs-empty { display: flex; flex-direction: column; align-items: center;
      justify-content: center; height: 160px; gap: 8px; color: var(--text-muted); font-family: var(--font-ui); }

    /* ─── Settings Panel ───────────────────────────── */
    .settings-section { margin-bottom: 14px; }
    .settings-section-title { font-size: 10px; font-weight: 700; letter-spacing: 0.7px;
      text-transform: uppercase; color: var(--text-muted); margin-bottom: 8px; }
    .setting-row { display: flex; align-items: center; justify-content: space-between;
      padding: 8px 12px; border-radius: var(--radius-sm); border: 1px solid var(--border);
      background: var(--bg-card); margin-bottom: 5px; cursor: pointer;
      transition: border-color var(--transition); }
    .setting-row:hover { border-color: var(--border-light); }
    .setting-row.active { border-color: rgba(79,142,247,0.3); }
    .setting-label { font-size: 12px; color: var(--text-primary); font-weight: 500; }
    .setting-desc  { font-size: 10.5px; color: var(--text-muted); margin-top: 1px; }
    /* Toggle switch */
    .toggle { position: relative; width: 32px; height: 18px; flex-shrink: 0; }
    .toggle input { opacity: 0; width: 0; height: 0; }
    .toggle-track { position: absolute; inset: 0; background: var(--border-light);
      border-radius: 18px; transition: background var(--transition); cursor: pointer; }
    .toggle-track::after { content: ''; position: absolute; left: 2px; top: 2px;
      width: 14px; height: 14px; background: var(--text-muted);
      border-radius: 50%; transition: all var(--transition); }
    .toggle input:checked + .toggle-track { background: var(--accent); }
    .toggle input:checked + .toggle-track::after { transform: translateX(14px); background: #fff; }
    .settings-save-row { margin-top: 10px; }

    /* ─── Overview empty state ─────────────────────── */
    .overview-empty { display: flex; flex-direction: column; align-items: center;
      justify-content: center; height: 180px; gap: 10px; color: var(--text-muted); text-align: center; }
    .overview-empty-icon { font-size: 32px; opacity: 0.4; }
    .overview-empty-text { font-size: 12px; }

    /* ─── Animations ───────────────────────────────── */
    @keyframes fadeIn  { from { opacity: 0; }              to { opacity: 1; } }
    @keyframes slideIn { from { opacity:0; transform:translateX(-6px); } to { opacity:1; transform:translateX(0); } }
    @keyframes spin    { from { transform:rotate(0deg); }  to { transform:rotate(360deg); } }
    @keyframes pulse   { 0%,100% { opacity:1; } 50% { opacity:0.3; } }
  </style>
</head>
<body>
<div id="app">

  <div id="header">
    <div class="logo">
      <img src="${iconUri}" class="logo-icon" alt="RepoStart" />
      <span class="logo-text">RepoStart</span>
      
    </div>

    <div style="display:flex; gap:8px; align-items:center;">
      <button class="btn btn-primary" id="runSetupBtn" onclick="handleRunSetup()">
        <span class="btn-icon">▶</span> Setup
      </button>

      <button class="btn btn-green" id="runProjectBtn" onclick="handleRunProject()">
        <span class="btn-icon">▶</span> Run
      </button>
    </div>

  </div>

  <div id="tabs">
    <div class="tab active" onclick="switchTab('overview')" id="tab-overview">Overview</div>
    <div class="tab" onclick="switchTab('timeline')" id="tab-timeline">
      Timeline <span class="tab-badge" id="timelineBadge" style="display:none">0</span>
    </div>
    <div class="tab" onclick="switchTab('logs')" id="tab-logs">
      Logs <span class="tab-badge" id="logsBadge" style="display:none">0</span>
    </div>
    <div class="tab" onclick="switchTab('settings')" id="tab-settings">⚙</div>
  </div>

  <div id="content">

    <div class="panel active" id="overviewPanel">
      <div id="overviewContent">
        <div class="overview-empty">
          <div class="overview-empty-icon">📂</div>
          <div class="overview-empty-text">Analyzing repository…</div>
        </div>
      </div>
    </div>

    <div class="panel" id="timelinePanel">

      <div class="search-container">
         <input
      type="text"
      id="timelineSearch"
      class="search-input"
      placeholder="🔍 Search Timeline..."
         />
       </div>

      <div id="timelineContent">
        <div class="timeline-empty">
          <span style="font-size:24px;opacity:0.3">⏱</span>
          <span style="font-size:12px">Run Setup to see the timeline</span>
        </div>
      </div>
    </div>

    <div class="panel" id="logsPanel">

  <div class="search-container">
    <input
      type="text"
      id="logsSearch"
      class="search-input"
      placeholder="🔍 Search Logs..."
    />
  </div>

  <div class="logs-toolbar">
        <span class="logs-count" id="logsCount">0 entries</span>
        <div class="logs-filters" id="logFilters">
          <span class="log-filter-btn active-filter" data-cat="ALL" onclick="setLogFilter('ALL')">ALL</span>
          <span class="log-filter-btn" data-cat="SYSTEM"   onclick="setLogFilter('SYSTEM')">SYS</span>
          <span class="log-filter-btn" data-cat="SETUP"    onclick="setLogFilter('SETUP')">SETUP</span>
          <span class="log-filter-btn" data-cat="FRONTEND" onclick="setLogFilter('FRONTEND')">FE</span>
          <span class="log-filter-btn" data-cat="BACKEND"  onclick="setLogFilter('BACKEND')">BE</span>
        </div>
        <button class="clear-btn" onclick="clearLogs()">Clear</button>
      </div>
      <div id="logsList">
        <div class="logs-empty">
          <span style="font-size:22px;opacity:0.3">🖥</span>
          <span>Logs will appear here</span>
        </div>
      </div>
    </div>

    <div class="panel" id="settingsPanel">
      <div class="section-header">⚙ RepoStart Settings</div>

      <div class="settings-section">
        <div class="settings-section-title">Setup Behaviour</div>
        <div class="setting-row" onclick="toggleSetting('autoRunAfterSetup')">
          <div>
            <div class="setting-label">Auto Run After Setup</div>
            <div class="setting-desc">Automatically launch apps after setup completes</div>
          </div>
          <label class="toggle" onclick="event.stopPropagation()">
            <input type="checkbox" id="cfg-autoRunAfterSetup" onchange="onSettingChange()">
            <span class="toggle-track"></span>
          </label>
        </div>
        <div class="setting-row" onclick="toggleSetting('autoGenerateEnv')">
          <div>
            <div class="setting-label">Auto Generate Environment</div>
            <div class="setting-desc">Copy .env.example → .env if .env doesn't exist</div>
          </div>
          <label class="toggle" onclick="event.stopPropagation()">
            <input type="checkbox" id="cfg-autoGenerateEnv" onchange="onSettingChange()">
            <span class="toggle-track"></span>
          </label>
        </div>
      </div>

      <div class="settings-section">
        <div class="settings-section-title">Launch Options</div>
        <div class="setting-row" onclick="toggleSetting('autoLaunchFrontend')">
          <div>
            <div class="setting-label">Auto Launch Frontend</div>
            <div class="setting-desc">Start frontend terminal on Run Project</div>
          </div>
          <label class="toggle" onclick="event.stopPropagation()">
            <input type="checkbox" id="cfg-autoLaunchFrontend" onchange="onSettingChange()">
            <span class="toggle-track"></span>
          </label>
        </div>
        <div class="setting-row" onclick="toggleSetting('autoLaunchBackend')">
          <div>
            <div class="setting-label">Auto Launch Backend</div>
            <div class="setting-desc">Start backend terminal on Run Project</div>
          </div>
          <label class="toggle" onclick="event.stopPropagation()">
            <input type="checkbox" id="cfg-autoLaunchBackend" onchange="onSettingChange()">
            <span class="toggle-track"></span>
          </label>
        </div>
        <div class="setting-row" onclick="toggleSetting('autoOpenDashboard')">
          <div>
            <div class="setting-label">Auto Open Dashboard</div>
            <div class="setting-desc">Focus RepoStart when workspace opens</div>
          </div>
          <label class="toggle" onclick="event.stopPropagation()">
            <input type="checkbox" id="cfg-autoOpenDashboard" onchange="onSettingChange()">
            <span class="toggle-track"></span>
          </label>
        </div>
      </div>

      <div class="settings-section">
        <div class="settings-section-title">Notifications</div>
        <div class="setting-row" onclick="toggleSetting('showNotifications')">
          <div>
            <div class="setting-label">Show Notifications</div>
            <div class="setting-desc">VS Code info/warning messages from RepoStart</div>
          </div>
          <label class="toggle" onclick="event.stopPropagation()">
            <input type="checkbox" id="cfg-showNotifications" onchange="onSettingChange()">
            <span class="toggle-track"></span>
          </label>
        </div>
      </div>

      <div class="settings-save-row">
        <button class="btn btn-primary" style="width:100%" onclick="saveSettings()">
          Save Settings
        </button>
      </div>
    </div>

  </div>
</div>

<script>
  // ── VS Code API ──────────────────────────────────
  const vscode = acquireVsCodeApi();

  // ── State ─────────────────────────────────────────
  let activeTab     = 'overview';
  let logCount      = 0;
  let timelineCount = 0;
  let isRunning     = false;
  let timelineMap = new Map();
  let timelineEvents = [];
  let timelineSearch = '';
  
  let autoScrollLogs = true;
let logFilter = 'ALL';
let allLogs = [];
let timelineEvents = [];
let timelineSearch = '';
let logsSearch = '';

let currentAnalysis = null;
let serviceStatuses = {};
let setupSummary = null;
let currentEnvStatus = 'pending';
let errorGuidances = [];

let timelineSearchText = '';
let logsSearchText = '';
  let serviceStatuses   = {};
  let setupSummary      = null;
  let currentEnvStatus  = 'pending';
  let errorGuidances    = [];

  // ── Tab switching ─────────────────────────────────
  function switchTab(name) {
    activeTab = name;
    document.querySelectorAll('.tab').forEach(function(t) { t.classList.remove('active'); });
    document.querySelectorAll('.panel').forEach(function(p) { p.classList.remove('active'); });
    document.getElementById('tab-' + name).classList.add('active');
    document.getElementById(name + 'Panel').classList.add('active');
    if (name === 'logs')     resetBadge('logs');
    if (name === 'timeline') resetBadge('timeline');
  }

  // ── Badge helpers ─────────────────────────────────
  function bumpBadge(which) {
    if (activeTab === which) return;
    const el = document.getElementById(which + 'Badge');
    if (!el) return;
    const cur = parseInt(el.textContent) || 0;
    el.textContent = cur + 1;
    el.style.display = 'inline-block';
  }
  function resetBadge(which) {
    const el = document.getElementById(which + 'Badge');
    if (!el) return;
    el.style.display = 'none'; el.textContent = '0';
  }

  // ── Run Setup ─────────────────────────────────────
  function handleRunSetup() {
    if (isRunning) return;
    vscode.postMessage({ type: 'runSetup' });
  }
  function handleRunProject() {
    vscode.postMessage({ type: 'runProject' });
  }

  function setRunning(running) {
    isRunning = running;
    const btn = document.getElementById('runSetupBtn');
    if (running) {
      btn.disabled = true;
      btn.classList.add('running');
      btn.innerHTML = '<span class="btn-icon tl-running-spinner">⟳</span> Running…';
    } else {
      btn.disabled = false;
      btn.classList.remove('running');
      btn.innerHTML = '<span class="btn-icon">▶</span> Setup';
    }
  }

  // ── Overview rendering ────────────────────────────
  function renderOverview(analysis) {
    currentAnalysis = analysis;

    const archClass = {
      'single':        'badge-arch-single',
      'client-server': 'badge-arch-client-server',
      'multi-app':     'badge-arch-multi-app',
    }[analysis.architecture] || 'badge-arch-single';

    const archLabel = {
      'single':        'Single App',
      'client-server': 'Client-Server',
      'multi-app':     'Multi-App',
    }[analysis.architecture] || analysis.architecture;

    const fe  = analysis.apps.find(function(a) { return a.isFrontend; });
    const be  = analysis.apps.find(function(a) { return a.isBackend; });
    const env = analysis.envStatus || currentEnvStatus;

    const feHTML = fe
      ? '<span class="badge badge-fw-front">' + cap(fe.framework) + '</span>'
      : '<span style="color:var(--text-muted);font-size:11px">—</span>';

    const beHTML = be
      ? '<span class="badge badge-fw-back">' + cap(be.framework) + '</span>'
      : '<span style="color:var(--text-muted);font-size:11px">—</span>';

    const envHTML = (env === 'configured')
      ? '<span class="badge badge-env-ok">✓ Configured</span>'
      : env === 'pending'
      ? '<span style="color:var(--text-muted);font-size:11px">Pending</span>'
      : '<span class="badge badge-env-none">Not Required</span>';

    const svcHTML = renderServiceStatusSection();
    const structHTML = renderStructureViz(analysis);
    const summaryHTML = renderSummarySection();

    let errHTML = '';
    if (errorGuidances.length) {
      for (let i = 0; i < errorGuidances.length; i++) {
        errHTML += '<div class="error-card">' + escHtml(errorGuidances[i]) + '</div>';
      }
    }

    document.getElementById('overviewContent').innerHTML = 
      '' +
      '<div class="card">' +
      '  <div class="card-header">' +
      '    <span class="card-title">RepoStart</span>' +
      '  </div>' +
      '  <div class="card-body">' +
      '    <div class="info-grid">' +
      '      <div class="info-row">' +
      '        <span class="info-label">Architecture</span>' +
      '        <span class="info-value"><span class="badge ' + archClass + '">' + archLabel + '</span></span>' +
      '      </div>' +
      '      <div class="info-row">' +
      '        <span class="info-label">Frontend</span>' +
      '        <span class="info-value">' + feHTML + '</span>' +
      '      </div>' +
      '      <div class="info-row">' +
      '        <span class="info-label">Backend</span>' +
      '        <span class="info-value">' + beHTML + '</span>' +
      '      </div>' +
      '      <div class="info-row">' +
      '        <span class="info-label">Package Manager</span>' +
      '        <span class="info-value"><span class="badge badge-pm">' + analysis.packageManager + '</span></span>' +
      '      </div>' +
      '      <div class="info-row">' +
      '        <span class="info-label">Environment</span>' +
      '        <span class="info-value">' + envHTML + '</span>' +
      '      </div>' +
      '    </div>' +
      '    <div id="statusRow" class="status-row" style="margin-top:10px">' +
      '      <div class="status-dot status-idle"></div>' +
      '      <span class="status-text">Ready · click Run Setup to start</span>' +
      '    </div>' +
      '  </div>' +
      '</div>' +
      '<button class="btn btn-primary" style="width:100%;margin-bottom:10px" onclick="handleRunSetup()">' +
      '  <span class="btn-icon">▶</span> Run Setup' +
      '</button>' +
      errHTML +
      '<hr class="section-divider">' +
      '<div class="section-header">Service Status</div>' +
      '<div id="serviceStatusSection">' + svcHTML + '</div>' +
      '<hr class="section-divider">' +
      '<div class="section-header">Repository Structure</div>' +
      '<div class="card">' +
      '  <div class="card-body">' +
           structHTML +
      '  </div>' +
      '</div>' +
      '<hr class="section-divider">' +
      '<div class="section-header">Setup Summary</div>' +
      '<div class="card" id="summaryCard">' +
      '  <div class="card-body">' +
           summaryHTML +
      '  </div>' +
      '</div>' +
      '<hr class="section-divider">' +
      '<div class="section-header">Export</div>' +
      '<div style="display:flex;flex-direction:column;gap:6px">' +
      '  <button class="btn btn-muted" style="width:100%" onclick="downloadSetupReport()">' +
      '    📄 Download Setup Report' +
      '  </button>' +
      '  <button class="btn btn-muted" style="width:100%" onclick="downloadTimeline()">' +
      '    🕐 Download Timeline' +
      '  </button>' +
      '  <button class="btn btn-muted" style="width:100%" onclick="downloadLogs()">' +
      '    📋 Download Logs' +
      '  </button>' +
      '</div>';
  }

  function renderServiceStatusSection() {
    const keys = Object.keys(serviceStatuses);
    if (keys.length === 0) {
      return '<div class="service-grid">' +
             '  <div class="service-card">' +
             '    <span class="service-label" style="color:var(--text-muted)">No services running</span>' +
             '    <span class="service-state" style="color:var(--text-muted)">—</span>' +
             '  </div>' +
             '</div>' +
             '<button class="btn btn-green" style="width:100%" onclick="handleRunProject()">' +
             '  <span class="btn-icon">▶</span> Run Project' +
             '</button>';
    }

    let cardsHTML = '';
    for (let i = 0; i < keys.length; i++) {
      const rel = keys[i];
      const s = serviceStatuses[rel];
      const dotClass = s.state === 'running' ? 'svc-running' : s.state === 'starting' ? 'svc-starting' : 'svc-stopped';
      const stateLabel = s.state === 'running' ? '🟢 Running' : s.state === 'starting' ? '🟡 Starting' : '🔴 Stopped';
      cardsHTML += '<div class="service-card">' +
                   '  <span class="service-label">' + escHtml(s.label) + '</span>' +
                   '  <span class="service-state">' +
                   '    <span class="svc-dot ' + dotClass + '"></span>' +
                        stateLabel +
                   '  </span>' +
                   '</div>';
    }

    return '<div class="service-grid">' + cardsHTML + '</div>' +
           '<button class="btn btn-green" style="width:100%" onclick="handleRunProject()">' +
           '  <span class="btn-icon">▶</span> Run Project' +
           '</button>';
  }

  function renderStructureViz(analysis) {
    if (!analysis || !analysis.apps || analysis.apps.length === 0) {
      return '<div style="color:var(--text-muted);font-size:11px">No apps detected</div>';
    }

    const arch = analysis.architecture;

    if (arch === 'single') {
      const app = analysis.apps[0];
      return '<div class="structure-tree">' +
             '  <div class="tree-group">' +
             '    <div class="tree-group-label">Root</div>' +
             '    <div class="tree-item">' +
             '      <span class="tree-connector">└──</span>' +
             '      <span class="tree-name">' + (app.relativePath === '.' ? '(root)' : app.relativePath) + '</span>' +
             '      <span class="tree-fw">(' + cap(app.framework) + ')</span>' +
             '    </div>' +
             '  </div>' +
             '</div>';
    }

    if (arch === 'client-server') {
      const fe = analysis.apps.find(function(a) { return a.isFrontend; });
      const be = analysis.apps.find(function(a) { return a.isBackend; });
      const others = analysis.apps.filter(function(a) { return !a.isFrontend && !a.isBackend; });
      
      let html = '<div class="structure-tree">';
      if (fe) {
        html += '<div class="tree-group">' +
                '  <div class="tree-group-label">Frontend</div>' +
                '  <div class="tree-item">' +
                '    <span class="tree-connector">└──</span>' +
                '    <span class="tree-name">' + (fe.relativePath === '.' ? '(root)' : fe.relativePath) + '</span>' +
                '    <span class="tree-fw">(' + cap(fe.framework) + ')</span>' +
                '  </div>' +
                '</div>';
      }
      if (be) {
        html += '<div class="tree-group">' +
                '  <div class="tree-group-label">Backend</div>' +
                '  <div class="tree-item">' +
                '    <span class="tree-connector">└──</span>' +
                '    <span class="tree-name">' + be.relativePath + '</span>' +
                '    <span class="tree-fw">(' + cap(be.framework) + ')</span>' +
                '  </div>' +
                '</div>';
      }
      for (let i = 0; i < others.length; i++) {
        html += '<div class="tree-group">' +
                '  <div class="tree-group-label">App</div>' +
                '  <div class="tree-item">' +
                '    <span class="tree-connector">└──</span>' +
                '    <span class="tree-name">' + others[i].relativePath + '</span>' +
                '    <span class="tree-fw">(' + cap(others[i].framework) + ')</span>' +
                '  </div>' +
                '</div>';
      }
      html += '</div>';
      return html;
    }

    const grouped = {};
    for (let i = 0; i < analysis.apps.length; i++) {
      const app = analysis.apps[i];
      const parts = app.relativePath.split('/');
      const group = parts.length > 1 ? parts[0] : 'apps';
      if (!grouped[group]) grouped[group] = [];
      grouped[group].push(app);
    }

    let html = '<div class="structure-tree">';
    const groupKeys = Object.keys(grouped);
    for (let i = 0; i < groupKeys.length; i++) {
      const group = groupKeys[i];
      const apps = grouped[group];
      html += '<div class="tree-group"><div class="tree-group-label">' + cap(group) + '</div>';
      for (let j = 0; j < apps.length; j++) {
        const app = apps[j];
        const connector = j < apps.length - 1 ? '├──' : '└──';
        html += '<div class="tree-item">' +
                '  <span class="tree-connector">' + connector + '</span>' +
                '  <span class="tree-name">' + app.label + '</span>' +
                '  <span class="tree-fw">(' + cap(app.framework) + ')</span>' +
                '</div>';
      }
      html += '</div>';
    }
    html += '</div>';
    return html;
  }

  function renderSummarySection() {
    if (!setupSummary) {
      return '<div class="summary-grid">' +
             '  <div class="summary-row">' +
             '    <span class="summary-label">Dependencies Installed</span>' +
             '    <span class="summary-val val-skip">—</span>' +
             '  </div>' +
             '  <div class="summary-row">' +
             '    <span class="summary-label">Environment Generated</span>' +
             '    <span class="summary-val val-skip">—</span>' +
             '  </div>' +
             '  <div class="summary-row">' +
             '    <span class="summary-label">Applications Started</span>' +
             '    <span class="summary-val val-skip">—</span>' +
             '  </div>' +
             '  <div class="summary-row">' +
             '    <span class="summary-label">Errors</span>' +
             '    <span class="summary-val val-skip">—</span>' +
             '  </div>' +
             '</div>';
    }

    const s = setupSummary;
    return '<div class="summary-grid">' +
           '  <div class="summary-row">' +
           '    <span class="summary-label">Dependencies Installed</span>' +
           '    <span class="summary-val ' + (s.depsInstalled ? 'val-ok' : 'val-fail') + '">' + (s.depsInstalled ? '✓' : '✗') + '</span>' +
           '  </div>' +
           '  <div class="summary-row">' +
           '    <span class="summary-label">Environment Generated</span>' +
           '    <span class="summary-val ' + (s.envGenerated ? 'val-ok' : 'val-skip') + '">' + (s.envGenerated ? '✓' : '—') + '</span>' +
           '  </div>' +
           '  <div class="summary-row">' +
           '    <span class="summary-label">Applications Started</span>' +
           '    <span class="summary-val ' + (s.appsStarted ? 'val-ok' : 'val-fail') + '">' + (s.appsStarted ? '✓' : '✗') + '</span>' +
           '  </div>' +
           '  <div class="summary-row">' +
           '    <span class="summary-label">Errors</span>' +
           '    <span class="summary-val ' + (s.errorCount > 0 ? 'val-fail' : 'val-ok') + ' val-num">' + s.errorCount + '</span>' +
           '  </div>' +
           '</div>';
  }

  function refreshServiceStatusSection() {
    const el = document.getElementById('serviceStatusSection');
    if (el) el.innerHTML = renderServiceStatusSection();
  }

  function refreshSummaryCard() {
    const el = document.getElementById('summaryCard');
    if (el) el.innerHTML = '<div class="card-body">' + renderSummarySection() + '</div>';
  }

  function setStatus(dotClass, text) {
    const row = document.getElementById('statusRow');
    if (!row) return;
    row.innerHTML = '<div class="status-dot ' + dotClass + '"></div>' +
                    '<span class="status-text">' + escHtml(text) + '</span>';
  }

  // ── Timeline rendering ────────────────────────────
  
function renderTimelineEvent(event) {
  timelineCount++;
  bumpBadge('timeline');

  const existing = timelineEvents.findIndex(function(e){
    return e.id === event.id;
  });

  if (existing >= 0) {
    timelineEvents[existing] = event;
  } else {
    timelineEvents.push(event);
  }

  redrawTimeline();
}


function buildTimelineHTML(event) {
  const icons = {
    pending: '○',
    running: '<span class="tl-running-spinner">⟳</span>',
    success: '✓',
    error: '✗',
    skipped: '–'
  };

  return (
    '<span class="tl-icon">' +
    (icons[event.status] || '○') +
    '</span>' +
    '<div class="tl-body">' +
    '<div class="tl-header">' +
    '<div class="tl-label">' +
    escHtml(event.label) +
    '</div>' +
    '<span class="tl-time">' +
    formatTime(event.timestamp) +
    '</span>' +
    '</div>' +
    (event.detail
      ? '<div class="tl-detail">' +
        escHtml(event.detail) +
        '</div>'
      : '') +
    '</div>'
  );
}

function redrawTimeline() {
  const container = document.getElementById('timelineContent');

  let events = timelineEvents;

  if (timelineSearch) {
    const q = timelineSearch.toLowerCase();

    events = events.filter(function(e) {
      return (
        (e.label && e.label.toLowerCase().includes(q)) ||
        (e.detail && e.detail.toLowerCase().includes(q))
      );
    });
  }

  if (events.length === 0) {
    container.innerHTML =
      '<div class="timeline-empty">' +
      '<span style="font-size:22px;opacity:.3">🔍</span>' +
      '<span>No matching timeline events</span>' +
      '</div>';
    return;
  }

  let html = '<div class="timeline-list">';

  for (let i = 0; i < events.length; i++) {
    html +=
      '<div class="timeline-item tl-' +
      events[i].status +
      '">' +
      buildTimelineHTML(events[i]) +
      '</div>';
  }

  html += '</div>';

  container.innerHTML = html;
}
  
  

  // ── Log rendering ─────────────────────────────────
  const ERROR_PATTERNS = [
    { re: /EADDRINUSE|address already in use|port.*in use/i, msg: '⚠ Port may already be in use. Try stopping other processes or changing the port.' },
    { re: /cannot find module|module not found/i,             msg: '⚠ Missing module detected. Try running npm install again.' },
    { re: /npm error|yarn error|pnpm error/i,                msg: '⚠ Dependency installation failure detected. Check the Logs tab for details.' },
    { re: /ENOENT.*\\.env/i,                                  msg: '⚠ Environment file missing. Check your .env configuration.' },
    { re: /exited with code [^0]/,                           msg: '⚠ A process exited unexpectedly. Check the Logs tab for details.' },
  ];

  function checkErrorGuidance(msg) {
    for (let i = 0; i < ERROR_PATTERNS.length; i++) {
      const item = ERROR_PATTERNS[i];
      if (item.re.test(msg) && !errorGuidances.includes(item.msg)) {
        errorGuidances.push(item.msg);
        if (currentAnalysis) renderOverview(currentAnalysis);
      }
    }
  }

  function setLogFilter(cat) {
    logFilter = cat;
    document.querySelectorAll('.log-filter-btn').forEach(function(b) {
      b.classList.toggle('active-filter', b.dataset.cat === cat);
    });
    redrawLogs();
  }

  function redrawLogs() {
    const list = document.getElementById('logsList');
    let filtered = logFilter === 'ALL'
  ? allLogs
  : allLogs.filter(function(e) {
      return (e.category || 'SYSTEM') === logFilter;
    });

if (logsSearch) {
  const q = logsSearch.toLowerCase();

  filtered = filtered.filter(function(e) {
    return (
      (e.message || '').toLowerCase().includes(q) ||
      (e.category || '').toLowerCase().includes(q)
    );
  });
}
    if (filtered.length === 0) {
      list.innerHTML = '<div class="logs-empty"><span>No logs for this filter</span></div>';
      return;
    }
    
    let html = '';
    for (let i = 0; i < filtered.length; i++) {
      html += buildLogHTML(filtered[i]);
    }
    list.innerHTML = html;
    if (autoScrollLogs) list.scrollTop = list.scrollHeight;
  }

  function buildLogHTML(entry) {
    const timeStr = formatTime(entry.timestamp);
    const cat = entry.category || 'SYSTEM';
    return '<div class="log-entry log-' + entry.level + '">' +
           '  <span class="log-time">' + timeStr + '</span>' +
           '  <span class="log-cat cat-' + cat + '">' + cat + '</span>' +
           '  <span class="log-msg">' + escHtml(entry.message) + '</span>' +
           '</div>';
  }

  function appendLog(entry) {
    logCount++;
    bumpBadge('logs');

    if (entry.level === 'error' || entry.level === 'warn') {
      checkErrorGuidance(entry.message);
    }

    allLogs.push(entry);

    const list = document.getElementById('logsList');
    if (logCount === 1) { list.innerHTML = ''; }

    const cat = entry.category || 'SYSTEM';
    if (logFilter === 'ALL' || logFilter === cat) {
      const wrapper = document.createElement('div');
      wrapper.innerHTML = buildLogHTML(entry);
      list.appendChild(wrapper.firstChild);
    }

    if (autoScrollLogs) list.scrollTop = list.scrollHeight;
    document.getElementById('logsCount').textContent =
      logCount + (logCount === 1 ? ' entry' : ' entries');
  }

  function clearLogs() {
    logCount = 0;
    allLogs = [];
    logsSearch = "";
    document.getElementById('logsList').innerHTML =
      '<div class="logs-empty"><span style="font-size:22px;opacity:0.3">🖥</span><span>Logs cleared</span></div>';
    document.getElementById('logsCount').textContent = '0 entries';
    resetBadge('logs');
  }

  // ── Settings ──────────────────────────────────────
  const SETTING_KEYS = ['autoRunAfterSetup','autoGenerateEnv','autoLaunchFrontend',
                        'autoLaunchBackend','autoOpenDashboard','showNotifications'];

  const DEFAULTS = {
    autoRunAfterSetup: true,
    autoGenerateEnv: true,
    autoLaunchFrontend: true,
    autoLaunchBackend: true,
    autoOpenDashboard: true,
    showNotifications: false  // OFF by default — matches types.ts DEFAULT_SETTINGS
  };

  function applySettings(settings) {
  for (let i = 0; i < SETTING_KEYS.length; i++) {
    const key = SETTING_KEYS[i];
    const el = document.getElementById('cfg-' + key);

    if (!el) continue;

    el.checked = settings[key] !== undefined
      ? !!settings[key]
      : DEFAULTS[key];
  }

  document.querySelectorAll('.setting-row').forEach(function(row) {
    const cb = row.querySelector('input[type="checkbox"]');
    if (cb) row.classList.toggle('active', cb.checked);
  });
}

  function collectSettings() {
    const s = {};
    for (let i = 0; i < SETTING_KEYS.length; i++) {
      const key = SETTING_KEYS[i];
      const el = document.getElementById('cfg-' + key);
      s[key] = el ? el.checked : DEFAULTS[key];
    }
    return s;
  }

  function toggleSetting(key) {
    const el = document.getElementById('cfg-' + key);
    if (el) { el.checked = !el.checked; onSettingChange(); }
  }

  function onSettingChange() {
    document.querySelectorAll('.setting-row').forEach(function(row) {
      const cb = row.querySelector('input[type="checkbox"]');
      if (cb) row.classList.toggle('active', cb.checked);
    });
  }

  function saveSettings() {
    const settings = collectSettings();
    vscode.postMessage({ type: 'saveSettings', payload: settings });
  }

  document.getElementById('cfg-autoRunAfterSetup').onchange = onSettingChange;
  document.getElementById('cfg-autoGenerateEnv').onchange = onSettingChange;
  document.getElementById('cfg-autoLaunchFrontend').onchange = onSettingChange;
  document.getElementById('cfg-autoLaunchBackend').onchange = onSettingChange;
  document.getElementById('cfg-autoOpenDashboard').onchange = onSettingChange;
  document.getElementById('cfg-showNotifications').onchange = onSettingChange;

  function downloadSetupReport() {
    vscode.postMessage({ type: 'downloadReport' });
  }

  function downloadTimeline() {
    vscode.postMessage({ type: 'downloadTimeline' });
  }

  function downloadLogs() {
    vscode.postMessage({ type: 'downloadLogs' });
  }

  // ── Helpers ───────────────────────────────────────
  function formatTime(iso) {
    const d = new Date(iso);
    return d.toLocaleTimeString('en-US', { hour12:false, hour:'2-digit', minute:'2-digit', second:'2-digit' });
  }

  function escHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function cap(s) {
    if (!s) return '—';
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  // ── Message handler ───────────────────────────────
  window.addEventListener('message', function(e) {
    const msg = e.data;
    switch (msg.type) {

      case 'analysisResult':
        renderOverview(msg.payload);
        break;

      case 'setupStarted':
        setRunning(true);
        errorGuidances = [];
        if (currentAnalysis) setStatus('status-running', 'Running setup…');
        switchTab('timeline');
        timelineCount = 0; timelineMap.clear();
        timelineEvents = [];
timelineSearch = "";

const search = document.getElementById('timelineSearch');
if (search) search.value = "";
        document.getElementById('timelineContent').innerHTML =
          '<div class="timeline-empty"><span style="font-size:24px;opacity:0.3">⏳</span>' +
          '<span style="font-size:12px">Starting…</span></div>';
        break;

      case 'timelineUpdate':
        renderTimelineEvent(msg.payload);
        break;

      case 'logEntry':
        appendLog(msg.payload);
        break;

      case 'clearLogs':
        clearLogs();
        break;

      case 'setupComplete':
        setRunning(false);
        if (msg.payload.success) {
          setStatus('status-success', '✓ ' + msg.payload.message);
        } else {
          setStatus('status-error', '✗ ' + msg.payload.message);
        }
        if (msg.payload.success) setTimeout(function() { switchTab('overview'); }, 600);
        break;

      case 'serviceStatusUpdate': {
        const s = msg.payload;
        serviceStatuses[s.relativePath] = s;
        refreshServiceStatusSection();
        break;
      }

      case 'setupSummaryUpdate':
        setupSummary = msg.payload;
        refreshSummaryCard();
        break;

      case 'envStatusUpdate':
        currentEnvStatus = msg.payload;
        if (currentAnalysis) {
          currentAnalysis.envStatus = msg.payload;
          renderOverview(currentAnalysis);
        }
        break;

      case 'settingsLoaded':
        applySettings(msg.payload);
        break;
    }
  });

  // ── Init ──────────────────────────────────────────
  const timelineSearchBox = document.getElementById('timelineSearch');

if (timelineSearchBox) {
  timelineSearchBox.addEventListener('input', function () {
    timelineSearch = this.value;
    redrawTimeline();
  });
}

const logsSearchBox = document.getElementById('logsSearch');

if (logsSearchBox) {
  logsSearchBox.addEventListener('input', function () {
    logsSearch = this.value;
    redrawLogs();
  });
}
  vscode.postMessage({ type: 'ready' });
</script>
</body>
</html>`;
}