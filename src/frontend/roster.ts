import { renderPage, SPARK } from "./theme";

interface RosterPlayer {
  name: string;
  pos: string;
  team: string;
  opp: string;
  proj: number;
  pts?: number;
  status?: "playing" | "final" | "upcoming" | "out";
  statLine?: string;
}

const STARTERS: { slot: string; p: RosterPlayer }[] = [
  { slot: "QB",   p: { name: "Patrick Mahomes", pos: "QB", team: "KC",  opp: "vs DEN", proj: 24.8, pts: 18.2, status: "playing", statLine: "241 yds · 2 TD" } },
  { slot: "RB",   p: { name: "Breece Hall",     pos: "RB", team: "NYJ", opp: "@ BUF",  proj: 18.4, pts: 22.0, status: "final",   statLine: "127 rush · 1 TD" } },
  { slot: "RB",   p: { name: "Bijan Robinson",  pos: "RB", team: "ATL", opp: "vs CAR", proj: 16.1, pts: 0.0,  status: "upcoming" } },
  { slot: "WR",   p: { name: "Justin Jefferson", pos: "WR", team: "MIN", opp: "@ CHI", proj: 20.3, pts: 14.5, status: "playing", statLine: "6 rec · 88 yds" } },
  { slot: "WR",   p: { name: "CeeDee Lamb",     pos: "WR", team: "DAL", opp: "vs NYG", proj: 17.9, pts: 0.0,  status: "upcoming" } },
  { slot: "TE",   p: { name: "Travis Kelce",    pos: "TE", team: "KC",  opp: "vs DEN", proj: 13.2, pts: 9.1,  status: "playing", statLine: "5 rec · 61 yds" } },
  { slot: "FLEX", p: { name: "Amon-Ra St. Brown", pos: "WR", team: "DET", opp: "@ GB", proj: 15.6, pts: 0.0, status: "out" } },
  { slot: "K",    p: { name: "Harrison Butker", pos: "K",  team: "KC",  opp: "vs DEN", proj: 8.5,  pts: 6.0,  status: "playing", statLine: "2 FG · 0 miss" } },
  { slot: "DEF",  p: { name: "Ravens D/ST",     pos: "DEF", team: "BAL", opp: "vs CLE", proj: 7.8,  pts: 0.0, status: "upcoming" } },
];

const BENCH: RosterPlayer[] = [
  { name: "Jayden Daniels", pos: "QB", team: "WAS", opp: "vs PHI", proj: 21.1, status: "upcoming" },
  { name: "Tank Dell",      pos: "WR", team: "HOU", opp: "@ IND", proj: 11.4, status: "upcoming" },
  { name: "Jaylen Warren",  pos: "RB", team: "PIT", opp: "vs LV",  proj: 9.8,  status: "upcoming" },
  { name: "Dalton Kincaid", pos: "TE", team: "BUF", opp: "vs NYJ", proj: 8.2,  status: "upcoming" },
];

function statusMeta(s?: string) {
  switch (s) {
    case "playing":  return { dot: "dot-live", label: "LIVE", cls: "text-green" };
    case "final":    return { dot: "dot-idle", label: "FINAL", cls: "text-muted" };
    case "out":      return { dot: "dot-out",  label: "OUT", cls: "text-red" };
    default:         return { dot: "dot-idle", label: "1:00 PM", cls: "text-blue" };
  }
}

function starterRow(slot: string, p: RosterPlayer): string {
  const m = statusMeta(p.status);
  const showLive = p.status === "playing" || p.status === "final";
  const ptsDisplay = showLive ? (p.pts ?? 0).toFixed(1) : (p.proj).toFixed(1);
  const ptsColor = p.status === "out" ? "text-red" : showLive ? "text-green" : "text-muted";
  const initials = p.name.split(" ").map(w => w[0]).slice(0, 2).join("");
  const outBanner = p.status === "out"
    ? `<span class="pill pill-red" style="margin-top:4px;display:inline-block;width:fit-content;">⚠ Injury Insurance</span>` : "";

  return `
    <a href="/player/${encodeURIComponent(p.name)}" class="player-row" style="text-decoration:none;color:inherit;">
      <div class="flex items-center gap-3" style="flex:1;min-width:0;">
        <span class="position-badge pos-${slot === "FLEX" ? "WR" : slot}" style="min-width:38px;flex-shrink:0;">${slot}</span>
        <div class="avatar" style="flex-shrink:0;">${initials}</div>
        <div class="flex-col" style="gap:2px;min-width:0;flex:1;">
          <span class="font-semibold text-sm" style="line-height:1.25;display:block;max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${p.name}</span>
          <span class="text-2xs text-muted">${p.team} · ${p.opp}</span>
          ${p.statLine ? `<span class="text-2xs ${m.cls}">${p.statLine}</span>` : ""}
          ${outBanner}
        </div>
      </div>
      <div class="flex-col items-end gap-1" style="flex-shrink:0;padding-left:8px;">
        <span class="outfit-font mono-num font-black ${ptsColor}" style="font-size:18px;">${ptsDisplay}</span>
        <span class="flex items-center gap-1 text-2xs ${m.cls}"><span class="status-dot ${m.dot}"></span>${m.label}</span>
      </div>
    </a>`;
}

function benchRow(p: RosterPlayer): string {
  const initials = p.name.split(" ").map(w => w[0]).slice(0, 2).join("");
  return `
    <div class="player-row" style="opacity:.82;">
      <div class="flex items-center gap-3" style="flex:1;min-width:0;">
        <span class="position-badge pos-${p.pos}" style="flex-shrink:0;">${p.pos}</span>
        <div class="avatar" style="width:34px;height:34px;font-size:12px;flex-shrink:0;">${initials}</div>
        <div class="flex-col" style="min-width:0;">
          <span class="font-medium text-sm" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${p.name}</span>
          <span class="text-2xs text-muted">${p.team} · ${p.opp}</span>
        </div>
      </div>
      <span class="outfit-font mono-num text-muted font-bold" style="font-size:15px;flex-shrink:0;padding-left:8px;">${p.proj.toFixed(1)}</span>
    </div>`;
}

export function renderRoster(teamId: string): string {
  const projTotal = STARTERS.reduce((s, x) => s + x.p.proj, 0);
  const liveTotal = STARTERS.reduce((s, x) => s + (x.p.pts ?? 0), 0);

  const body = `
    <div class="page-header fade-up fade-up-1">
      <a href="/" class="header-back">←</a>
      <span class="outfit-font font-black text-lg">My Team</span>
      <a href="/coach" class="header-back" style="font-size:16px;" title="AI optimize">${SPARK}</a>
    </div>

    <!-- Team summary card -->
    <div class="glass-card flex-col gap-4 fade-up fade-up-1">
      <div class="flex-between">
        <div class="flex items-center gap-3">
          <div class="avatar" style="width:48px;height:48px;border-radius:14px;color:var(--neon-green);font-size:18px;">GG</div>
          <div class="flex-col">
            <span class="outfit-font font-black text-base">Gridiron Giants</span>
            <span class="text-2xs text-muted">3-1 · 2nd in League</span>
          </div>
        </div>
        <span class="pill pill-green">Week 5</span>
      </div>
      <div class="flex-between">
        <div class="flex-col">
          <span class="text-2xs text-muted uppercase">Live Total</span>
          <span class="outfit-font mono-num font-black text-green" style="font-size:28px;line-height:1;">${liveTotal.toFixed(1)}</span>
        </div>
        <div class="flex-col items-end">
          <span class="text-2xs text-muted uppercase">Projected</span>
          <span class="outfit-font mono-num font-bold" style="font-size:22px;line-height:1;">${projTotal.toFixed(1)}</span>
        </div>
      </div>
    </div>

    <!-- Starters -->
    <div class="card fade-up fade-up-2">
      <span class="section-label">Starters</span>
      ${STARTERS.map(s => starterRow(s.slot, s.p)).join("")}
    </div>

    <!-- Bench -->
    <div class="card fade-up fade-up-3">
      <span class="section-label">Bench</span>
      ${BENCH.map(benchRow).join("")}
    </div>

    <div class="flex gap-3 fade-up fade-up-4">
      <a href="/coach" class="btn-secondary">Set Lineup</a>
      <a href="/coach" class="btn-purple">${SPARK} AI Optimize</a>
    </div>
  `;

  return renderPage({ title: "My Team", body, active: "roster" });
}
