import { renderPage, SPARK } from "./theme";

export function renderCoach(): string {
  const extraCss = `
    .ai-card {
      background: linear-gradient(160deg, rgba(168,85,247,.10), rgba(31,41,55,.85));
      border: 1px solid rgba(168,85,247,.28);
      border-radius: 16px; padding: 18px; margin-bottom: 16px;
    }
    .ai-icon {
      width: 40px; height: 40px; border-radius: 12px;
      background: var(--neon-purple-soft); display:flex; align-items:center;
      justify-content:center; font-size:18px; flex-shrink:0; color: var(--neon-purple);
    }
    .ai-icon .spark { width: 20px; height: 20px; }
    .reason-chip {
      display:inline-block; background: var(--bg-elevated); border:1px solid var(--border-subtle);
      color: var(--text-muted); font-size:11px; padding:4px 10px; border-radius:8px; margin:3px 4px 0 0;
    }
    .brain-pulse { animation: brainPulse 1.4s ease-in-out infinite; }
    @keyframes brainPulse { 0%,100%{opacity:.4;transform:scale(.96);} 50%{opacity:1;transform:scale(1.04);} }
    .confidence-arc {
      font-variant-numeric: tabular-nums; font-weight:800;
      color: var(--neon-purple); font-family:'Outfit',sans-serif;
    }
    .boom-bust-col { flex:1; }
    .bb-row { display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid var(--border-subtle); font-size:13px; }
    .bb-row:last-child { border-bottom:none; }
  `;

  const body = `
    <div class="page-header fade-up fade-up-1">
      <a href="/" class="header-back">←</a>
      <span class="outfit-font font-black text-lg text-purple">AI Coach</span>
      <span class="pill pill-purple">${SPARK} GPT-4o</span>
    </div>

    <div class="desk-grid">
      <div class="desk-main">
    <!-- Lineup Optimizer -->
    <div class="ai-card fade-up fade-up-1">
      <div class="flex items-center gap-3 mb-4">
        <div class="ai-icon">${SPARK}</div>
        <div class="flex-col">
          <span class="font-bold text-base">Lineup Optimizer</span>
          <span class="text-2xs text-muted">Maximize projected points for Week 5</span>
        </div>
      </div>
      <div id="optResult"></div>
      <button class="btn-purple mt-2" id="optBtn" onclick="optimize()">Optimize Lineup</button>
    </div>

    <!-- Trade Analyzer -->
    <div class="ai-card fade-up fade-up-2">
      <div class="flex items-center gap-3 mb-4">
        <div class="ai-icon">${SPARK}</div>
        <div class="flex-col">
          <span class="font-bold text-base">Trade Analyzer</span>
          <span class="text-2xs text-muted">Get a verdict before you pull the trigger</span>
        </div>
      </div>
      <div class="flex gap-3 mb-4">
        <div class="card" style="flex:1;margin:0;padding:12px;">
          <span class="text-2xs text-muted uppercase">You Give</span>
          <div class="text-sm font-semibold mt-2">CeeDee Lamb</div>
        </div>
        <div class="flex-center" style="font-size:20px;color:var(--neon-purple);">⇄</div>
        <div class="card" style="flex:1;margin:0;padding:12px;">
          <span class="text-2xs text-muted uppercase">You Get</span>
          <div class="text-sm font-semibold mt-2">Ja'Marr Chase</div>
        </div>
      </div>
      <div id="tradeResult"></div>
      <button class="btn-secondary" onclick="analyzeTrade()">Analyze Trade</button>
    </div>

      </div>
      <div class="desk-side flex-col gap-4">
    <!-- Waiver Assistant -->
    <div class="ai-card fade-up fade-up-3" style="margin:0;">
      <div class="flex items-center gap-3 mb-4">
        <div class="ai-icon">${SPARK}</div>
        <div class="flex-col">
          <span class="font-bold text-base">Waiver Assistant</span>
          <span class="text-2xs text-muted">$100 FAAB · top pickups this week</span>
        </div>
      </div>
      <div class="player-row">
        <div class="flex-col"><span class="font-semibold text-sm">Jaylen Wright</span><span class="text-2xs text-muted">RB · MIA · 24% rostered</span></div>
        <span class="pill pill-purple">Bid $18</span>
      </div>
      <div class="player-row">
        <div class="flex-col"><span class="font-semibold text-sm">Demario Douglas</span><span class="text-2xs text-muted">WR · NE · 19% rostered</span></div>
        <span class="pill pill-purple">Bid $11</span>
      </div>
      <div class="player-row">
        <div class="flex-col"><span class="font-semibold text-sm">Cade Otton</span><span class="text-2xs text-muted">TE · TB · 31% rostered</span></div>
        <span class="pill pill-purple">Bid $7</span>
      </div>
    </div>

    <!-- Boom / Bust -->
    <div class="ai-card fade-up fade-up-4">
      <div class="flex items-center gap-3 mb-4">
        <div class="ai-icon">${SPARK}</div>
        <span class="font-bold text-base">Boom / Bust Picks</span>
      </div>
      <div class="flex gap-4">
        <div class="boom-bust-col">
          <span class="text-2xs font-black text-green uppercase">🔥 Boom</span>
          <div class="bb-row"><span>J. Dobbins</span><span class="text-green">+</span></div>
          <div class="bb-row"><span>R. Odunze</span><span class="text-green">+</span></div>
          <div class="bb-row"><span>T. Dell</span><span class="text-green">+</span></div>
        </div>
        <div class="boom-bust-col">
          <span class="text-2xs font-black text-red uppercase">💥 Bust</span>
          <div class="bb-row"><span>D. Cook</span><span class="text-red">−</span></div>
          <div class="bb-row"><span>Z. Moss</span><span class="text-red">−</span></div>
          <div class="bb-row"><span>G. Pickens</span><span class="text-red">−</span></div>
        </div>
      </div>
    </div>
      </div>
    </div>
  `;

  const extraJs = `
    async function optimize() {
      const btn = document.getElementById('optBtn');
      const out = document.getElementById('optResult');
      btn.style.display = 'none';
      out.innerHTML = '<div class="flex-center flex-col gap-2" style="padding:20px;"><span class="brain-pulse" style="font-size:32px;">🧠</span><span class="text-2xs text-muted">Analyzing matchups & projections…</span></div>';
      try {
        const r = await fetch('/ai/lineup/optimize', {
          method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ teamId:'T_TEST_1', week:5 })
        });
        const data = await r.json();
        renderOpt(data);
      } catch (e) {
        renderOpt({ confidence: 82, fallback: true });
      }
    }
    function renderOpt(data) {
      const out = document.getElementById('optResult');
      const conf = data.confidence != null ? data.confidence : 82;
      out.innerHTML =
        '<div class="flex-between mb-4">' +
          '<div class="flex-col"><span class="text-2xs text-muted uppercase">Recommended Confidence</span>' +
          '<span class="confidence-arc" style="font-size:32px;line-height:1;">' + conf + '%</span></div>' +
          '<span class="pill pill-green">Optimized</span>' +
        '</div>' +
        '<div class="track mb-4"><div class="track-fill fill-purple" style="width:' + conf + '%;"></div></div>' +
        '<div class="mb-2"><span class="text-sm font-semibold">Start Amon-Ra St. Brown over Tank Dell</span>' +
        '<div><span class="reason-chip">Softer coverage</span><span class="reason-chip">+4.2 proj</span><span class="reason-chip">3-wk hot</span></div></div>' +
        '<a href="/roster/T_TEST_1" class="btn-purple mt-4">Apply Suggestions</a>';
    }
    async function analyzeTrade() {
      const out = document.getElementById('tradeResult');
      out.innerHTML = '<div class="text-2xs text-muted" style="padding:8px 0;">Crunching values…</div>';
      setTimeout(() => {
        out.innerHTML =
          '<div class="card" style="margin-bottom:12px;border-color:rgba(34,197,94,.4);background:var(--neon-green-soft);">' +
          '<div class="flex-between mb-2"><span class="font-black text-green">✓ ACCEPT</span><span class="text-2xs text-muted">Confidence 76%</span></div>' +
          '<p class="text-2xs text-muted" style="line-height:1.5;">Chase carries a higher ceiling and an easier Weeks 6-9 schedule. Lamb is elite but Dallas\\'s pass volume is trending down. Clear value gain.</p></div>';
      }, 900);
    }
  `;

  return renderPage({ title: "AI Coach", body, active: "ai", extraCss, extraJs });
}
