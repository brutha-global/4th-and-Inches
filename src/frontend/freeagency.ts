import { renderPage, SPARK } from "./theme";
import {
  getFreeAgents,
  injuryMeta,
  initials,
  esc,
  CURRENT_WEEK,
  type DBPlayer,
} from "./data";

function hash(s: string): number {
  let h = 2166136261;
  for (const ch of s) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function projFor(p: DBPlayer): number {
  const base: Record<string, [number, number]> = {
    QB: [10, 24], RB: [3, 16], WR: [3, 15], TE: [2, 11], K: [5, 11], DEF: [2, 11],
  };
  const [lo, hi] = base[p.position] || [3, 13];
  const h = hash(p.player_id + p.name);
  return Math.round((lo + ((h % 1000) / 1000) * (hi - lo)) * 10) / 10;
}
function reasonFor(p: DBPlayer): string {
  const h = hash(p.name);
  const reasons = [
    "3rd straight game with 8+ targets",
    "Backfield workload trending up after the bye",
    "Starter ahead of him is banged up — next man up",
    "Double-digit looks in the red zone this month",
    "Snap share jumped to a season high",
    "Soft upcoming schedule through the fantasy playoffs",
  ];
  return reasons[h % reasons.length];
}
function miniSpark(p: DBPlayer): string {
  const h = hash(p.player_id);
  const vals = Array.from({ length: 5 }, (_, i) => 4 + ((h >> (i * 3)) & 7) * 2);
  const max = Math.max(...vals);
  return `<div class="flex items-end gap-1" style="height:20px;">${vals
    .map((v) => `<div style="width:4px;height:${Math.round((v / max) * 18) + 2}px;background:var(--neon-blue);border-radius:2px;opacity:.8;"></div>`)
    .join("")}</div>`;
}

const POSITIONS = ["ALL", "QB", "RB", "WR", "TE", "K", "DEF"];

function chipGroup(leagueId: string, active: string): string {
  return `<div class="flex gap-2" style="overflow-x:auto;padding-bottom:4px;">${POSITIONS.map(
    (pos) =>
      `<a href="/freeagency/${esc(leagueId)}?pos=${pos}" class="chip" style="flex-shrink:0;text-decoration:none;${
        pos === active
          ? "color:var(--neon-green);border-color:rgba(34,197,94,.5);background:var(--neon-green-soft);"
          : ""
      }">${pos}</a>`
  ).join("")}</div>`;
}

function faRow(p: DBPlayer): string {
  const inj = injuryMeta(p.injury_status);
  const proj = projFor(p);
  const chip = inj.isRisk ? `<span class="pill ${inj.chipClass}" style="padding:2px 8px;font-size:10px;">${esc(inj.label)}</span>` : "";
  return `
    <a href="/playerdb/${esc(p.player_id)}" class="player-row" style="text-decoration:none;color:inherit;">
      <div class="flex items-center gap-3" style="flex:1;min-width:0;">
        <span class="position-badge pos-${esc(p.position)}" style="flex-shrink:0;">${esc(p.position)}</span>
        <div class="avatar" style="width:34px;height:34px;font-size:12px;flex-shrink:0;">${esc(initials(p.name))}</div>
        <div class="flex-col" style="min-width:0;gap:2px;">
          <span class="font-semibold text-sm" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(p.name)}</span>
          <span class="text-2xs text-muted">${esc(p.team)} ${chip}</span>
        </div>
      </div>
      <div class="flex items-center gap-3" style="flex-shrink:0;padding-left:8px;">
        ${miniSpark(p)}
        <span class="outfit-font mono-num font-bold text-sm" style="min-width:34px;text-align:right;">${proj.toFixed(1)}</span>
        <span class="pill pill-green" style="padding:6px 14px;cursor:pointer;">Add</span>
      </div>
    </a>`;
}

function emptyState(leagueId: string, pos: string): string {
  const body = `
    ${topBar(leagueId, pos, "")}
    <div class="card fade-up fade-up-2" style="text-align:center;padding:40px 20px;">
      <span class="section-label" style="justify-content:center;">Nobody open here</span>
      <p class="text-sm text-muted" style="margin-top:8px;line-height:1.5;">
        No one open at this position right now. Widen your filters or check back after Sunday's inactives.
      </p>
      <a href="/freeagency/${esc(leagueId)}" class="btn-secondary" style="margin-top:16px;max-width:200px;">Clear filters</a>
    </div>`;
  return renderPage({ title: "Free Agency", body, active: "league" });
}

function topBar(leagueId: string, pos: string, search: string): string {
  return `
    <div class="page-header fade-up fade-up-1">
      <a href="/league/${esc(leagueId)}" class="header-back">←</a>
      <span class="outfit-font font-black text-lg">Free Agency</span>
      <span style="width:36px;"></span>
    </div>
    <form method="get" action="/freeagency/${esc(leagueId)}" class="fade-up fade-up-1" style="margin-bottom:12px;">
      <input type="text" name="q" value="${esc(search)}" placeholder="Search players…"
        style="width:100%;padding:12px 14px;border-radius:10px;background:var(--bg-elevated);border:1px solid var(--border-subtle);color:var(--text-light);font-size:14px;font-family:'Inter',sans-serif;">
    </form>
    ${chipGroup(leagueId, pos || "ALL")}`;
}

export async function renderFreeAgency(
  db: D1Database,
  leagueId: string,
  query: { position?: string; search?: string } = {}
): Promise<string> {
  const pos = (query.position || "ALL").toUpperCase();
  const search = query.search || "";
  const players = await getFreeAgents(db, leagueId, CURRENT_WEEK, {
    position: pos,
    search,
    limit: 60,
  });

  if (players.length === 0) return emptyState(leagueId, pos);

  const trending = players.slice(0, 5);
  const top = players[0];

  const trendingRail = `
    <div class="card fade-up fade-up-2">
      <span class="section-label">Trending adds</span>
      <div class="flex gap-3" style="overflow-x:auto;padding-bottom:4px;">
        ${trending
          .map(
            (p) => `<a href="/playerdb/${esc(p.player_id)}" style="flex-shrink:0;width:150px;text-decoration:none;color:inherit;background:var(--bg-elevated);border:1px solid var(--border-subtle);border-radius:12px;padding:12px;">
              <div class="flex items-center gap-2 mb-2">
                <span class="position-badge pos-${esc(p.position)}">${esc(p.position)}</span>
                <span class="text-2xs text-muted">${esc(p.team)}</span>
              </div>
              <span class="font-semibold text-sm" style="display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(p.name)}</span>
              <span class="text-2xs text-muted" style="display:block;line-height:1.35;margin-top:4px;">${esc(reasonFor(p))}</span>
            </a>`
          )
          .join("")}
      </div>
    </div>`;

  const waiverCallout = `
    <div class="card fade-up fade-up-2" style="border-color:rgba(168,85,247,.34);background:linear-gradient(160deg,var(--neon-purple-soft),transparent);">
      <span class="section-label" style="color:var(--neon-purple);">${SPARK} Waiver Assistant</span>
      <span class="text-2xs text-muted uppercase">Your #1 priority claim this week</span>
      <div class="flex-between items-center mt-2">
        <div class="flex items-center gap-3" style="min-width:0;">
          <span class="position-badge pos-${esc(top.position)}">${esc(top.position)}</span>
          <div class="flex-col" style="min-width:0;">
            <span class="font-bold text-sm">${esc(top.name)}</span>
            <span class="text-2xs text-muted" style="line-height:1.35;">${esc(reasonFor(top))} — spend ~18% of FAAB.</span>
          </div>
        </div>
      </div>
      <a href="#" class="btn-purple" style="margin-top:12px;">Submit claim</a>
    </div>`;

  const body = `
    ${topBar(leagueId, pos, search)}
    ${waiverCallout}
    ${trendingRail}
    <div class="card fade-up fade-up-3">
      <div class="flex-between mb-2">
        <span class="section-label" style="margin:0;">Available${pos !== "ALL" ? ` · ${pos}` : ""}</span>
        <span class="text-2xs text-muted">${players.length} players</span>
      </div>
      ${players.map(faRow).join("")}
    </div>
  `;
  return renderPage({ title: "Free Agency", body, active: "league" });
}
