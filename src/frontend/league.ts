import { renderPage, SPARK } from "./theme";

interface Standing {
  rank: number;
  name: string;
  w: number;
  l: number;
  pf: number;
  pa: number;
  streak: string;
  you?: boolean;
}

const STANDINGS: Standing[] = [
  { rank: 1, name: "Rushing Royalty",  w: 4, l: 0, pf: 512.4, pa: 421.1, streak: "W4" },
  { rank: 2, name: "Gridiron Giants",  w: 3, l: 1, pf: 498.7, pa: 440.3, streak: "W2", you: true },
  { rank: 3, name: "End Zone Elite",   w: 3, l: 1, pf: 476.2, pa: 452.8, streak: "L1" },
  { rank: 4, name: "Blitz Brigade",    w: 2, l: 2, pf: 461.9, pa: 458.4, streak: "W1" },
  { rank: 5, name: "Pocket Passers",   w: 2, l: 2, pf: 449.0, pa: 470.6, streak: "L1" },
  { rank: 6, name: "Hail Mary Heroes", w: 1, l: 3, pf: 430.5, pa: 489.2, streak: "L2" },
  { rank: 7, name: "Fourth Down Fury", w: 1, l: 3, pf: 418.3, pa: 495.7, streak: "L3" },
  { rank: 8, name: "Sack Attack",      w: 0, l: 4, pf: 402.1, pa: 519.9, streak: "L4" },
];

const POWER: { rank: number; name: string; blurb: string; trend: string }[] = [
  { rank: 1, name: "Rushing Royalty", blurb: "Undefeated and unbothered — the ground game is a cheat code.", trend: "→" },
  { rank: 2, name: "Gridiron Giants", blurb: "Quietly stacking wins. That WR corps is about to erupt.", trend: "▲" },
  { rank: 3, name: "End Zone Elite",  blurb: "One bad Sunday from the top. Still terrifying on paper.", trend: "▼" },
  { rank: 4, name: "Blitz Brigade",   blurb: "Boom-or-bust roster. This week? Boom.", trend: "▲" },
];

function standingRow(s: Standing): string {
  const seedBadge = s.rank <= 4 ? "pill-green" : s.rank <= 6 ? "pill-amber" : "pill-red";
  const streakColor = s.streak.startsWith("W") ? "text-green" : "text-red";
  return `
    <div class="player-row" style="${s.you ? "background:var(--neon-green-soft);margin:0 -12px;padding:12px;border-radius:10px;" : ""}">
      <div class="flex items-center gap-3">
        <span class="pill ${seedBadge}" style="min-width:26px;justify-content:center;padding:4px 8px;">${s.rank}</span>
        <div class="flex-col">
          <span class="font-semibold text-sm">${s.name}${s.you ? ' <span class="text-2xs text-green">· YOU</span>' : ""}</span>
          <span class="text-2xs text-muted mono-num">${s.pf.toFixed(1)} PF · ${s.pa.toFixed(1)} PA</span>
        </div>
      </div>
      <div class="flex-col items-end gap-1">
        <span class="mono-num font-bold text-sm">${s.w}-${s.l}</span>
        <span class="text-2xs font-bold ${streakColor}">${s.streak}</span>
      </div>
    </div>`;
}

function powerRow(p: { rank: number; name: string; blurb: string; trend: string }): string {
  const tColor = p.trend === "▲" ? "text-green" : p.trend === "▼" ? "text-red" : "text-muted";
  return `
    <div class="player-row">
      <div class="flex items-center gap-3">
        <span class="outfit-font font-black text-purple" style="font-size:18px;min-width:26px;">#${p.rank}</span>
        <div class="flex-col">
          <span class="font-semibold text-sm">${p.name}</span>
          <span class="text-2xs text-muted" style="line-height:1.4;">${p.blurb}</span>
        </div>
      </div>
      <span class="${tColor} font-bold" style="font-size:16px;">${p.trend}</span>
    </div>`;
}

export function renderLeague(leagueId: string): string {
  const body = `
    <div class="page-header fade-up fade-up-1">
      <a href="/" class="header-back">←</a>
      <span class="outfit-font font-black text-lg">League Home</span>
      <span class="header-back" style="border:none;">🏆</span>
    </div>

    <div class="glass-card flex-between fade-up fade-up-1">
      <div class="flex-col">
        <span class="outfit-font font-black text-base">Dynasty Warriors</span>
        <span class="text-2xs text-muted">8 Teams · PPR · Season 2024</span>
      </div>
      <div class="flex-col items-end">
        <span class="text-2xs text-muted uppercase">Week</span>
        <span class="outfit-font font-black text-green" style="font-size:24px;line-height:1;">5</span>
      </div>
    </div>

    <!-- AI Power Rankings -->
    <div class="card fade-up fade-up-2" style="border-color: rgba(168,85,247,.28);">
      <div class="flex-between mb-2">
        <span class="section-label" style="margin:0;">${SPARK} AI Power Rankings</span>
        <span class="text-2xs text-muted">Updated 2h ago</span>
      </div>
      ${POWER.map(powerRow).join("")}
    </div>

    <!-- Standings -->
    <div class="card fade-up fade-up-3">
      <div class="flex-between mb-2">
        <span class="section-label" style="margin:0;">Standings</span>
        <div class="flex gap-2 text-2xs">
          <span class="chip" style="color:var(--neon-green);border-color:rgba(34,197,94,.4);">Playoff</span>
          <span class="chip" style="color:var(--neon-amber);border-color:rgba(245,158,11,.4);">Bubble</span>
        </div>
      </div>
      ${STANDINGS.map(standingRow).join("")}
    </div>

    <div class="flex gap-3 fade-up fade-up-4">
      <a href="/matchup/TEST" class="btn-secondary">Matchups</a>
      <a href="/draft/${leagueId}" class="btn-secondary">Draft Room</a>
    </div>
  `;

  return renderPage({ title: "League", body, active: "league" });
}
