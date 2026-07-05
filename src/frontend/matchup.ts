import { renderPage } from "./theme";

export function renderMatchupRoom(matchup: any): string {
  const t1Score = matchup.team1_score || 112.6;
  const t2Score = matchup.team2_score || 98.7;
  const total = (t1Score + t2Score) || 1;
  const t1Pct = Math.round((t1Score / total) * 100);
  const diff = (t1Score - t2Score);
  const diffLabel = (diff >= 0 ? "+" : "") + diff.toFixed(1);

  const extraCss = `
    .lineup-row {
      display:flex; justify-content:space-between; align-items:center;
      padding:12px 0; border-bottom:1px solid var(--border-subtle);
    }
    .lineup-row:last-child { border-bottom:none; }
    .btn-action-sub {
      background: transparent; color: var(--text-light);
      border: 1px solid var(--border-subtle); font-size:10px;
      padding:6px 10px; border-radius:8px; cursor:pointer;
      font-weight:700; text-transform:uppercase; letter-spacing:.04em;
      transition: all .2s;
    }
    .btn-action-sub:hover { border-color: var(--neon-green); color: var(--neon-green); }
    .btn-action-sub.warn { border-color: rgba(255,68,68,.5); color: var(--neon-red); }
    .btn-action-sub.warn:hover { background: var(--neon-red-soft); }
    #toast {
      position: fixed; bottom: 96px; left: 50%; transform: translateX(-50%) translateY(20px);
      background: var(--bg-card); border:1px solid var(--border-subtle);
      color: var(--text-light); padding:12px 18px; border-radius:12px;
      font-size:13px; font-weight:600; box-shadow: var(--shadow-card);
      opacity:0; pointer-events:none; transition: all .3s ease; z-index:200; max-width:320px;
    }
    #toast.show { opacity:1; transform: translateX(-50%) translateY(0); }
  `;

  const body = `
    <div class="page-header fade-up fade-up-1">
      <a href="/" class="header-back">←</a>
      <div class="flex items-center gap-2">
        <span class="status-dot dot-live"></span>
        <span class="font-bold text-sm">Week 5 · Live</span>
      </div>
      <span class="header-back" style="border:none;">⚡</span>
    </div>

    <!-- Score header -->
    <div class="glass-card flex-col gap-4 fade-up fade-up-1">
      <div class="flex-between align-end">
        <div class="flex-col">
          <span class="text-2xs text-muted uppercase">Gridiron Giants</span>
          <span class="outfit-font mono-num" style="font-size:38px;font-weight:800;line-height:1;">${t1Score.toFixed(1)}</span>
          <span class="pill pill-green mt-2" style="width:fit-content;">${diffLabel}</span>
        </div>
        <span class="text-2xs text-muted font-bold" style="padding-bottom:18px;">VS</span>
        <div class="flex-col items-end">
          <span class="text-2xs text-muted uppercase">Rushing Royalty</span>
          <span class="outfit-font mono-num text-muted" style="font-size:32px;font-weight:700;line-height:1;">${t2Score.toFixed(1)}</span>
        </div>
      </div>
      <div>
        <div class="flex-between text-2xs font-bold mb-2">
          <span class="text-green">WIN PROBABILITY</span>
          <span class="mono-num">${t1Pct}%</span>
        </div>
        <div class="track"><div class="track-fill ${t1Pct >= 50 ? "fill-green" : "fill-red"}" style="width:${t1Pct}%;"></div></div>
      </div>
    </div>

    <!-- Coach tokens -->
    <div class="card fade-up fade-up-2" style="padding:14px 16px;">
      <span class="section-label" style="margin-bottom:8px;">Coach Tokens</span>
      <div class="flex gap-3">
        <div class="flex-between card" style="flex:1;margin:0;padding:10px 12px;">
          <span class="text-2xs">🩹 Injury Ins.</span>
          <span class="text-green font-black" id="insuranceCount">1</span>
        </div>
        <div class="flex-between card" style="flex:1;margin:0;padding:10px 12px;">
          <span class="text-2xs">🚩 Challenge</span>
          <span class="text-green font-black" id="challengeCount">1</span>
        </div>
      </div>
    </div>

    <!-- Your lineup -->
    <div class="card fade-up fade-up-3">
      <span class="section-label">Your Lineup</span>

      <div class="lineup-row">
        <div class="flex items-center gap-3">
          <span class="position-badge pos-QB">QB</span>
          <div class="flex-col">
            <span class="font-semibold text-sm">P. Mahomes</span>
            <span class="text-2xs text-green">241 yds · 2 TD</span>
          </div>
        </div>
        <div class="flex items-center gap-3">
          <button class="btn-action-sub" onclick="subRequest('coach_challenge','PL_1','PL_2')">Challenge</button>
          <span class="outfit-font mono-num text-green font-black" style="font-size:16px;">18.2</span>
        </div>
      </div>

      <div class="lineup-row">
        <div class="flex items-center gap-3">
          <span class="position-badge pos-RB">RB</span>
          <div class="flex-col">
            <span class="font-semibold text-sm">B. Hall</span>
            <span class="text-2xs text-muted">Final · 127 rush · 1 TD</span>
          </div>
        </div>
        <span class="outfit-font mono-num text-muted font-black" style="font-size:16px;">22.0</span>
      </div>

      <div class="lineup-row" style="background:var(--neon-red-soft);margin:0 -8px;padding:12px 8px;border-radius:10px;border-bottom:none;">
        <div class="flex items-center gap-3">
          <span class="position-badge pos-WR">WR</span>
          <div class="flex-col">
            <span class="font-semibold text-sm">A. St. Brown <span class="text-red text-2xs">⚠ OUT</span></span>
            <span class="text-2xs text-red">Ruled out — insurance available</span>
          </div>
        </div>
        <button class="btn-action-sub warn" onclick="subRequest('injury_insurance','PL_3','PL_4')">Insure</button>
      </div>
    </div>

    <!-- NFL scoreboard strip -->
    <div class="fade-up fade-up-4">
      <span class="section-label">Around the League</span>
      <div style="display:flex;gap:10px;overflow-x:auto;padding-bottom:6px;-webkit-overflow-scrolling:touch;">
        ${["KC 24 · DEN 17 · Q3","MIN 14 · CHI 10 · Q2","BAL 31 · CLE 3 · Q4","DAL 7 · NYG 7 · Q1"].map(g => `
          <div class="card" style="min-width:150px;margin:0;padding:12px;">
            <span class="text-2xs text-green font-bold">${g.split(" · ").pop()}</span>
            <div class="text-sm font-semibold mt-2">${g.split(" · ").slice(0,2).join(" · ")}</div>
          </div>`).join("")}
      </div>
    </div>

    <div id="toast"></div>
  `;

  const extraJs = `
    function toast(msg) {
      const t = document.getElementById('toast');
      t.textContent = msg; t.classList.add('show');
      if (navigator.vibrate) navigator.vibrate(15);
      clearTimeout(window._tt); window._tt = setTimeout(()=>t.classList.remove('show'), 2600);
    }
    function subRequest(type, playerId, replacementId) {
      // In production this is sent over WebSocket to the LeagueRoom DO.
      const el = type === 'injury_insurance' ? 'insuranceCount' : 'challengeCount';
      const node = document.getElementById(el);
      const n = parseInt(node.textContent, 10);
      if (n <= 0) { toast('No ' + type.replace('_',' ') + ' tokens left this week'); return; }
      node.textContent = n - 1;
      toast('✓ ' + type.replace('_',' ').toUpperCase() + ' applied for ' + playerId);
    }
  `;

  return renderPage({ title: "War Room", body, active: "matchup", extraCss, extraJs });
}
