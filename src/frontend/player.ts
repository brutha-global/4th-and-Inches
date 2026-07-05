import { renderPage } from "./theme";

interface PlayerProfile {
  name: string;
  pos: string;
  team: string;
  number: string;
  opp: string;
  status: string;
  proj: number;
  avg: number;
  rosteredPct: number;
  stats: { label: string; value: string }[];
  gameLog: { wk: string; opp: string; pts: number }[];
  news: string;
}

const DEFAULT_PLAYER: PlayerProfile = {
  name: "Justin Jefferson",
  pos: "WR",
  team: "MIN",
  number: "18",
  opp: "@ CHI",
  status: "Active",
  proj: 20.3,
  avg: 18.7,
  rosteredPct: 99,
  stats: [
    { label: "Rec", value: "42" },
    { label: "Yards", value: "648" },
    { label: "TD", value: "5" },
    { label: "Targets", value: "58" },
    { label: "YPR", value: "15.4" },
    { label: "Rank", value: "WR3" },
  ],
  gameLog: [
    { wk: "W1", opp: "vs NYG", pts: 22.4 },
    { wk: "W2", opp: "@ SF",  pts: 14.1 },
    { wk: "W3", opp: "vs HOU", pts: 25.8 },
    { wk: "W4", opp: "@ GB",  pts: 12.5 },
  ],
  news: "Jefferson drew 11 targets last week and remains the clear WR1 in this offense. Elite matchup on tap vs a Bears secondary allowing the 4th-most fantasy points to receivers.",
};

export function renderPlayer(playerId: string): string {
  const p = DEFAULT_PLAYER;
  const maxPts = Math.max(...p.gameLog.map(g => g.pts));

  const statCells = p.stats.map(s => `
    <div class="card flex-col items-center" style="margin:0;padding:14px 8px;flex:1;min-width:calc(33% - 8px);">
      <span class="outfit-font mono-num font-black" style="font-size:22px;line-height:1;">${s.value}</span>
      <span class="text-2xs text-muted uppercase mt-2">${s.label}</span>
    </div>`).join("");

  const logBars = p.gameLog.map(g => {
    const h = Math.max(8, Math.round((g.pts / maxPts) * 90));
    return `
      <div class="flex-col items-center gap-2" style="flex:1;">
        <span class="text-2xs mono-num text-green font-bold">${g.pts.toFixed(1)}</span>
        <div style="width:60%;height:${h}px;border-radius:6px;background:linear-gradient(180deg,var(--neon-green),#16A34A);"></div>
        <span class="text-2xs text-muted">${g.wk}</span>
      </div>`;
  }).join("");

  const body = `
    <div class="page-header fade-up fade-up-1">
      <a href="/roster/T_TEST_1" class="header-back">←</a>
      <span class="font-bold text-sm">Player Profile</span>
      <span class="header-back" style="border:none;">☆</span>
    </div>

    <div class="desk-grid">
      <div class="desk-main">
    <!-- Season stats -->
    <div class="fade-up fade-up-2">
      <span class="section-label">Season Stats</span>
      <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px;">${statCells}</div>
    </div>

    <!-- Game log -->
    <div class="card fade-up fade-up-3">
      <span class="section-label">Last 4 Weeks</span>
      <div class="flex items-end" style="height:120px;gap:8px;">${logBars}</div>
    </div>
      </div>
      <div class="desk-side flex-col gap-4">
    <!-- Hero -->
    <div class="glass-card fade-up fade-up-1" style="text-align:center;margin:0;">
      <div class="avatar" style="width:88px;height:88px;border-radius:24px;margin:0 auto 14px;font-size:30px;color:var(--neon-green);">${p.name.split(" ").map(w=>w[0]).join("")}</div>
      <div class="outfit-font font-black" style="font-size:26px;line-height:1.1;">${p.name}</div>
      <div class="flex-center gap-2 mt-2">
        <span class="position-badge pos-${p.pos}">${p.pos}</span>
        <span class="text-sm text-muted">${p.team} · #${p.number} · ${p.opp}</span>
      </div>
      <div class="flex gap-3 mt-6">
        <div class="flex-col items-center" style="flex:1;">
          <span class="outfit-font mono-num font-black text-green" style="font-size:22px;">${p.proj.toFixed(1)}</span>
          <span class="text-2xs text-muted uppercase">Projected</span>
        </div>
        <div class="flex-col items-center" style="flex:1;border-left:1px solid var(--border-subtle);border-right:1px solid var(--border-subtle);">
          <span class="outfit-font mono-num font-black" style="font-size:22px;">${p.avg.toFixed(1)}</span>
          <span class="text-2xs text-muted uppercase">Avg</span>
        </div>
        <div class="flex-col items-center" style="flex:1;">
          <span class="outfit-font mono-num font-black" style="font-size:22px;">${p.rosteredPct}%</span>
          <span class="text-2xs text-muted uppercase">Rostered</span>
        </div>
      </div>
    </div>

    <!-- News -->
    <div class="card fade-up fade-up-3" style="margin:0;border-color:rgba(74,158,255,.28);">
      <div class="flex-between mb-2">
        <span class="section-label" style="margin:0;">Latest News</span>
        <span class="pill" style="background:rgba(74,158,255,.14);color:var(--neon-blue);">START</span>
      </div>
      <p class="text-sm text-muted" style="line-height:1.5;">${p.news}</p>
    </div>

    <div class="flex gap-3 fade-up fade-up-4">
      <a href="/roster/T_TEST_1" class="btn-secondary">Bench</a>
      <a href="/roster/T_TEST_1" class="btn-primary">＋ Add to Lineup</a>
    </div>
      </div>
    </div>
  `;

  return renderPage({ title: p.name, body, active: "roster" });
}
