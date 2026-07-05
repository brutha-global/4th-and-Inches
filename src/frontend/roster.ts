import { renderPage, SPARK } from "./theme";
import {
  getTeam,
  getRoster,
  getLeague,
  DIVISION_MAP,
  CURRENT_WEEK,
  esc,
  initials,
  injuryMeta,
  type DBPlayer,
} from "./data";

/**
 * Deterministic pseudo-projection for a player (no live stats seeded yet).
 * Stable per player so the UI doesn't flicker between renders.
 */
function projFor(p: DBPlayer): number {
  let h = 0;
  for (const ch of p.player_id + p.name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const base: Record<string, [number, number]> = {
    QB: [14, 26], RB: [6, 22], WR: [5, 20], TE: [4, 14], K: [6, 12], DEF: [3, 13],
  };
  const [lo, hi] = base[p.position] || [4, 16];
  return Math.round((lo + (h % 1000) / 1000 * (hi - lo)) * 10) / 10;
}

function starterRow(p: DBPlayer): string {
  const slot = p.slot_type || p.position;
  const inj = injuryMeta(p.injury_status);
  const proj = projFor(p);
  const ptsColor = inj.isOut ? "text-red" : "text-muted";
  const statusLabel = inj.isOut ? "OUT" : inj.isRisk ? (p.injury_status || "").toUpperCase() : "1:00 PM";
  const statusCls = inj.isOut ? "text-red" : inj.isRisk ? "text-amber" : "text-blue";
  const dot = inj.isOut ? "dot-out" : "dot-idle";
  // Injury Insurance token affordance for OUT players — a span pill, NOT a nested <a>.
  const outBanner = inj.isOut
    ? `<span class="pill pill-red" style="margin-top:4px;display:inline-flex;width:fit-content;">${SPARK} Insure</span>`
    : "";
  const badgeClass = slot === "FLEX" ? "WR" : slot;
  return `
    <a href="/playerdb/${esc(p.player_id)}" class="player-row" style="text-decoration:none;color:inherit;">
      <div class="flex items-center gap-3" style="flex:1;min-width:0;">
        <span class="position-badge pos-${badgeClass}" style="min-width:38px;flex-shrink:0;">${esc(slot)}</span>
        <div class="avatar" style="flex-shrink:0;">${esc(initials(p.name))}</div>
        <div class="flex-col" style="gap:2px;min-width:0;flex:1;">
          <span class="font-semibold text-sm" style="line-height:1.25;display:block;max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(p.name)}</span>
          <span class="text-2xs text-muted">${esc(p.team)}</span>
          ${outBanner}
        </div>
      </div>
      <div class="flex-col items-end gap-1" style="flex-shrink:0;padding-left:8px;">
        <span class="outfit-font mono-num font-black ${ptsColor}" style="font-size:18px;">${proj.toFixed(1)}</span>
        <span class="flex items-center gap-1 text-2xs ${statusCls}"><span class="status-dot ${dot}"></span>${statusLabel}</span>
      </div>
    </a>`;
}

function benchRow(p: DBPlayer): string {
  const proj = projFor(p);
  return `
    <a href="/playerdb/${esc(p.player_id)}" class="player-row" style="opacity:.82;text-decoration:none;color:inherit;">
      <div class="flex items-center gap-3" style="flex:1;min-width:0;">
        <span class="position-badge pos-${esc(p.position)}" style="flex-shrink:0;">${esc(p.position)}</span>
        <div class="avatar" style="width:34px;height:34px;font-size:12px;flex-shrink:0;">${esc(initials(p.name))}</div>
        <div class="flex-col" style="min-width:0;">
          <span class="font-medium text-sm" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(p.name)}</span>
          <span class="text-2xs text-muted">${esc(p.team)}</span>
        </div>
      </div>
      <span class="outfit-font mono-num text-muted font-bold" style="font-size:15px;flex-shrink:0;padding-left:8px;">${proj.toFixed(1)}</span>
    </a>`;
}

function emptyState(): string {
  const body = `
    <div class="page-header fade-up fade-up-1">
      <a href="/" class="header-back">←</a>
      <span class="outfit-font font-black text-lg">My Team</span>
      <span style="width:36px;"></span>
    </div>
    <div class="card fade-up fade-up-2" style="text-align:center;padding:40px 20px;">
      <span class="section-label" style="justify-content:center;">No roster yet</span>
      <p class="text-sm text-muted" style="margin-top:8px;line-height:1.5;">
        This team hasn't drafted yet. Once the draft is done, your starters and bench show up here.
      </p>
      <a href="/" class="btn-secondary" style="margin-top:16px;max-width:200px;">Back to Home</a>
    </div>`;
  return renderPage({ title: "My Team", body, active: "roster" });
}

export async function renderRoster(db: D1Database, teamId: string): Promise<string> {
  const team = await getTeam(db, teamId);
  const league = await getLeague(db, "L_TEST");
  const week = league?.week ?? CURRENT_WEEK;
  if (!team) return emptyState();

  const roster = await getRoster(db, teamId, week);
  if (roster.length === 0) return emptyState();

  const starters = roster.filter((p) => p.is_starter === 1);
  const bench = roster.filter((p) => p.is_starter !== 1);

  const projTotal = starters.reduce((s, p) => s + projFor(p), 0);
  const meta = DIVISION_MAP[teamId];
  const record = `${team.wins}-${team.losses}`;
  const av = initials(team.name);

  const body = `
    <div class="page-header fade-up fade-up-1">
      <a href="/" class="header-back">←</a>
      <span class="outfit-font font-black text-lg">My Team</span>
      <a href="/coach" class="header-back" style="font-size:16px;" title="AI optimize">${SPARK}</a>
    </div>

    <div class="glass-card flex-col gap-4 fade-up fade-up-1">
      <div class="flex-between">
        <div class="flex items-center gap-3">
          <div class="avatar" style="width:48px;height:48px;border-radius:14px;color:var(--neon-green);font-size:18px;">${esc(av)}</div>
          <div class="flex-col">
            <span class="outfit-font font-black text-base">${esc(team.name)}</span>
            <span class="text-2xs text-muted">${record}${meta ? ` · ${esc(meta.conference)} ${esc(meta.division)}` : ""}</span>
          </div>
        </div>
        <span class="pill pill-green">Week ${week}</span>
      </div>
      <div class="flex-between">
        <div class="flex-col">
          <span class="text-2xs text-muted uppercase">Projected</span>
          <span class="outfit-font mono-num font-black text-green" style="font-size:28px;line-height:1;">${projTotal.toFixed(1)}</span>
        </div>
        <div class="flex-col items-end">
          <span class="text-2xs text-muted uppercase">Manager</span>
          <span class="outfit-font mono-num font-bold" style="font-size:16px;line-height:1;">${esc(meta?.manager || "—")}</span>
        </div>
      </div>
    </div>

    <div class="desk-grid">
      <div class="desk-main">
        <div class="card fade-up fade-up-2">
          <span class="section-label">Starters</span>
          ${starters.map(starterRow).join("")}
        </div>
      </div>
      <div class="desk-side flex-col gap-4">
        <div class="card fade-up fade-up-3" style="margin:0;">
          <span class="section-label">Bench</span>
          ${bench.map(benchRow).join("")}
        </div>

        <div class="flex gap-3 fade-up fade-up-4">
          <a href="/lineup/${esc(teamId)}" class="btn-secondary">Set Lineup</a>
          <a href="/coach" class="btn-purple">${SPARK} AI Optimize</a>
        </div>
      </div>
    </div>
  `;

  return renderPage({ title: "My Team", body, active: "roster" });
}
