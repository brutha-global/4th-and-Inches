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
/** Synthesized rostered % (deterministic). */
function rosteredPct(p: DBPlayer): number {
  return hash(p.player_id + "rost") % 62; // FAs skew low, 0-61%
}
/** Synthesized opportunity score (deterministic), 0-100. */
function opportunity(p: DBPlayer): number {
  return 35 + (hash(p.player_id + "opp") % 65);
}
/** Synthesized weekly rostered % change (deterministic), +/-. */
function rosterChange(p: DBPlayer, adding: boolean): number {
  const raw = hash(p.player_id + (adding ? "add" : "drop")) % 34;
  const v = 4 + raw;
  return adding ? v : -v;
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
function dropReasonFor(p: DBPlayer): string {
  const h = hash(p.name + "drop");
  const reasons = [
    "Target share cratered the last three weeks",
    "Lost the starting job coming out of the bye",
    "Brutal playoff schedule vs top-5 defenses",
    "Nagging injury capping his snap count",
    "Timeshare backfield killing his floor",
    "Sub-5 fantasy points in four of five games",
  ];
  return reasons[h % reasons.length];
}
/** One-paragraph AI take for the inline expand. */
function aiTake(p: DBPlayer): string {
  const proj = projFor(p);
  const opp = opportunity(p);
  const rost = rosteredPct(p);
  return `${esc(p.name)} projects for ${proj.toFixed(1)} pts this week on an opportunity score of ${opp}/100. ${reasonFor(p)} — that's a real signal, not noise. At just ${rost}% rostered he's a low-risk stash: if the volume sticks he's a weekly flex, and if it doesn't you cut him next Tuesday with nothing lost. Prioritize the claim if you're thin at ${esc(p.position)}.`;
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
const STATUSES: Array<{ key: string; label: string }> = [
  { key: "all", label: "All" },
  { key: "healthy", label: "Healthy" },
  { key: "questionable", label: "Questionable" },
];
const SORTS: Array<{ key: string; label: string }> = [
  { key: "trending", label: "Trending" },
  { key: "proj", label: "Projected pts" },
  { key: "rostered", label: "Rostered %" },
  { key: "opportunity", label: "Opportunity" },
];

interface FAQuery {
  position: string;
  search: string;
  status: string;
  sort: string;
  mode: string; // "fa" | "waivers"
}

/** Build a /freeagency URL preserving all filters, overriding one key. */
function faUrl(leagueId: string, q: FAQuery, override: Partial<FAQuery>): string {
  const merged = { ...q, ...override };
  const params: string[] = [];
  if (merged.position && merged.position !== "ALL") params.push(`pos=${encodeURIComponent(merged.position)}`);
  if (merged.search) params.push(`q=${encodeURIComponent(merged.search)}`);
  if (merged.status && merged.status !== "all") params.push(`status=${encodeURIComponent(merged.status)}`);
  if (merged.sort && merged.sort !== "trending") params.push(`sort=${encodeURIComponent(merged.sort)}`);
  if (merged.mode && merged.mode !== "fa") params.push(`mode=${encodeURIComponent(merged.mode)}`);
  const qs = params.length ? `?${params.join("&")}` : "";
  return `/freeagency/${esc(leagueId)}${qs}`;
}

function chipGroup(leagueId: string, q: FAQuery): string {
  return `<div class="flex gap-2" style="overflow-x:auto;padding-bottom:4px;">${POSITIONS.map(
    (pos) =>
      `<a href="${faUrl(leagueId, q, { position: pos })}" class="chip" style="flex-shrink:0;text-decoration:none;${
        pos === (q.position || "ALL")
          ? "color:var(--neon-green);border-color:rgba(34,197,94,.5);background:var(--neon-green-soft);"
          : ""
      }">${pos}</a>`
  ).join("")}</div>`;
}

function statusChips(leagueId: string, q: FAQuery): string {
  return `<div class="flex gap-2" style="overflow-x:auto;">${STATUSES.map(
    (s) =>
      `<a href="${faUrl(leagueId, q, { status: s.key })}" class="chip" style="flex-shrink:0;text-decoration:none;${
        s.key === q.status
          ? "color:var(--neon-blue);border-color:rgba(74,158,255,.5);background:rgba(74,158,255,.12);"
          : ""
      }">${esc(s.label)}</a>`
  ).join("")}</div>`;
}

function sortControl(leagueId: string, q: FAQuery): string {
  return `<div class="flex gap-2 items-center" style="overflow-x:auto;">
    <span class="text-2xs text-muted uppercase" style="flex-shrink:0;letter-spacing:.05em;">Sort</span>
    ${SORTS.map(
      (s) =>
        `<a href="${faUrl(leagueId, q, { sort: s.key })}" class="chip" style="flex-shrink:0;text-decoration:none;${
          s.key === q.sort
            ? "color:var(--neon-purple);border-color:rgba(168,85,247,.5);background:var(--neon-purple-soft);"
            : ""
        }">${esc(s.label)}</a>`
    ).join("")}
  </div>`;
}

function modeToggle(leagueId: string, q: FAQuery, faab: number, priority: number): string {
  const waivers = q.mode === "waivers";
  const tab = (key: string, label: string) =>
    `<a href="${faUrl(leagueId, q, { mode: key })}" class="chip" style="flex:1;justify-content:center;text-decoration:none;${
      (key === q.mode)
        ? "color:var(--neon-green);border-color:rgba(34,197,94,.5);background:var(--neon-green-soft);font-weight:700;"
        : ""
    }">${label}</a>`;
  return `
    <div class="flex gap-2" style="margin-bottom:8px;">
      ${tab("fa", "Free Agents")}
      ${tab("waivers", "Waivers")}
    </div>
    ${waivers
      ? `<div class="flex-between items-center" style="padding:8px 12px;border-radius:10px;background:var(--bg-elevated);border:1px solid var(--border-subtle);margin-bottom:4px;">
          <span class="text-2xs text-muted uppercase" style="letter-spacing:.05em;">FAAB budget</span>
          <div class="flex items-center gap-3">
            <span class="outfit-font mono-num font-bold text-sm" style="color:var(--neon-green);">$${faab}</span>
            <span class="text-2xs text-muted">Waiver priority #${priority}</span>
          </div>
        </div>`
      : ""}`;
}

function faRow(p: DBPlayer, q: FAQuery): string {
  const inj = injuryMeta(p.injury_status);
  const proj = projFor(p);
  const rost = rosteredPct(p);
  const opp = opportunity(p);
  const chip = inj.isRisk ? `<span class="pill ${inj.chipClass}" style="padding:2px 8px;font-size:10px;">${esc(inj.label)}</span>` : "";
  const waivers = q.mode === "waivers";
  const actionLabel = waivers ? "Claim" : "Add";
  const actionClass = waivers ? "pill-purple" : "pill-green";
  // Extra metric shown depending on sort so scanning matches the chosen order.
  let metric = `${proj.toFixed(1)}`;
  let metricLabel = "PROJ";
  if (q.sort === "rostered") { metric = `${rost}%`; metricLabel = "ROST"; }
  else if (q.sort === "opportunity") { metric = `${opp}`; metricLabel = "OPP"; }
  return `
    <details class="fa-item">
      <summary class="player-row fa-summary">
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
          <div class="flex-col" style="align-items:flex-end;gap:0;min-width:38px;">
            <span class="outfit-font mono-num font-bold text-sm">${metric}</span>
            <span class="text-2xs text-muted" style="letter-spacing:.04em;">${metricLabel}</span>
          </div>
          <span class="pill ${actionClass}" style="padding:6px 14px;cursor:pointer;">${actionLabel}</span>
        </div>
      </summary>
      <div class="fa-expand" style="padding:10px 4px 4px 4px;border-top:1px solid var(--border-subtle);margin-top:8px;">
        <span class="section-label" style="color:var(--neon-purple);margin-bottom:6px;">${SPARK} Waiver Assistant take</span>
        <p class="text-2xs text-muted" style="line-height:1.5;margin:0 0 10px 0;">${aiTake(p)}</p>
        <div class="flex gap-2 items-center">
          <a href="/playerdb/${esc(p.player_id)}" class="btn-secondary" style="max-width:190px;">View full profile</a>
          <span class="pill ${actionClass}" style="padding:8px 16px;cursor:pointer;">${actionLabel}</span>
        </div>
      </div>
    </details>`;
}

function sortPlayers(players: DBPlayer[], sort: string): DBPlayer[] {
  const arr = [...players];
  if (sort === "proj") arr.sort((a, b) => projFor(b) - projFor(a));
  else if (sort === "rostered") arr.sort((a, b) => rosteredPct(b) - rosteredPct(a));
  else if (sort === "opportunity") arr.sort((a, b) => opportunity(b) - opportunity(a));
  else arr.sort((a, b) => rosterChange(b, true) - rosterChange(a, true)); // trending
  return arr;
}

function applyStatus(players: DBPlayer[], status: string): DBPlayer[] {
  if (status === "healthy") return players.filter((p) => !injuryMeta(p.injury_status).isRisk);
  if (status === "questionable") return players.filter((p) => injuryMeta(p.injury_status).isRisk && !injuryMeta(p.injury_status).isOut);
  return players;
}

const FA_CSS = `
  details.fa-item { list-style:none; }
  details.fa-item > summary { list-style:none; cursor:pointer; }
  details.fa-item > summary::-webkit-details-marker { display:none; }
  details.fa-item[open] > summary { background:rgba(168,85,247,.06); border-radius:10px; }
  .fa-expand { animation:fadeUp .18s ease both; }
  /* Trending rail: horizontal swipe on mobile, wraps to fit the narrow sidebar on desktop. */
  @media (min-width:900px){
    .trend-rail { display:grid !important; grid-template-columns:1fr 1fr; overflow-x:visible !important; }
    .trend-rail > a { width:auto !important; }
  }
`;

function topBar(leagueId: string, q: FAQuery, faab: number, priority: number): string {
  return `
    <div class="page-header fade-up fade-up-1">
      <a href="/league/${esc(leagueId)}" class="header-back">←</a>
      <span class="outfit-font font-black text-lg">Free Agency</span>
      <span style="width:36px;"></span>
    </div>
    <div class="fade-up fade-up-1">
      ${modeToggle(leagueId, q, faab, priority)}
    </div>
    <form method="get" action="/freeagency/${esc(leagueId)}" class="fade-up fade-up-1" style="margin-bottom:12px;">
      <input type="hidden" name="pos" value="${esc(q.position)}">
      <input type="hidden" name="status" value="${esc(q.status)}">
      <input type="hidden" name="sort" value="${esc(q.sort)}">
      <input type="hidden" name="mode" value="${esc(q.mode)}">
      <input type="text" name="q" value="${esc(q.search)}" placeholder="Search players…"
        style="width:100%;padding:12px 14px;border-radius:10px;background:var(--bg-elevated);border:1px solid var(--border-subtle);color:var(--text-light);font-size:14px;font-family:'Inter',sans-serif;">
    </form>
    <div class="flex-col gap-2 fade-up fade-up-1" style="margin-bottom:8px;">
      ${chipGroup(leagueId, q)}
      ${statusChips(leagueId, q)}
      ${sortControl(leagueId, q)}
    </div>`;
}

function lockedState(leagueId: string, q: FAQuery, faab: number, priority: number): string {
  // Deterministic countdown target for demo: next Wednesday 3:00 AM ET style copy.
  const body = `
    ${topBar(leagueId, q, faab, priority)}
    <div class="card fade-up fade-up-2" style="border-color:rgba(245,158,11,.4);background:linear-gradient(160deg,rgba(245,158,11,.10),transparent);text-align:center;padding:32px 20px;">
      <span class="section-label" style="justify-content:center;color:var(--neon-amber);">Waivers are locked</span>
      <p class="text-sm text-muted" style="margin-top:8px;line-height:1.55;">
        Claims are locked while this week's waivers process. Your submitted claims are still in the queue — nothing was lost.
      </p>
      <div class="flex items-center gap-2" style="justify-content:center;margin:18px 0 8px;">
        <span class="outfit-font mono-num font-black" id="fa-countdown" style="font-size:34px;color:var(--neon-amber);letter-spacing:.02em;">--:--:--</span>
      </div>
      <span class="text-2xs text-muted uppercase" style="letter-spacing:.06em;">Until waivers process</span>
      <p class="text-2xs text-muted" style="margin-top:16px;line-height:1.5;">
        Come back after processing to pick up anyone who clears. Free-agent adds reopen instantly once the run finishes.
      </p>
    </div>`;
  const extraJs = `
    (function(){
      var el = document.getElementById('fa-countdown');
      if(!el) return;
      var target = Date.now() + (7*3600 + 42*60 + 15)*1000; // demo: ~7h42m
      function tick(){
        var s = Math.max(0, Math.floor((target - Date.now())/1000));
        var h = String(Math.floor(s/3600)).padStart(2,'0');
        var m = String(Math.floor((s%3600)/60)).padStart(2,'0');
        var sec = String(s%60).padStart(2,'0');
        el.textContent = h+':'+m+':'+sec;
      }
      tick(); setInterval(tick, 1000);
    })();`;
  return renderPage({ title: "Free Agency", body, active: "league", extraCss: FA_CSS, extraJs });
}

function emptyState(leagueId: string, q: FAQuery, faab: number, priority: number): string {
  const body = `
    ${topBar(leagueId, q, faab, priority)}
    <div class="card fade-up fade-up-2" style="text-align:center;padding:40px 20px;">
      <span class="section-label" style="justify-content:center;">Nobody open here</span>
      <p class="text-sm text-muted" style="margin-top:8px;line-height:1.5;">
        No one open at this position and status right now. Widen your filters or check back after Sunday's inactives.
      </p>
      <a href="/freeagency/${esc(leagueId)}" class="btn-secondary" style="margin-top:16px;max-width:200px;">Clear filters</a>
    </div>`;
  return renderPage({ title: "Free Agency", body, active: "league", extraCss: FA_CSS });
}

export async function renderFreeAgency(
  db: D1Database,
  leagueId: string,
  query: { position?: string; search?: string; status?: string; sort?: string; mode?: string; locked?: boolean } = {}
): Promise<string> {
  const q: FAQuery = {
    position: (query.position || "ALL").toUpperCase(),
    search: query.search || "",
    status: (query.status || "all").toLowerCase(),
    sort: (query.sort || "trending").toLowerCase(),
    mode: (query.mode || "fa").toLowerCase() === "waivers" ? "waivers" : "fa",
  };

  // Synthesized team waiver economy (deterministic per league).
  const faab = 100 - (hash(leagueId + "faab") % 45); // $55-$100
  const priority = 1 + (hash(leagueId + "prio") % 8); // #1-#8

  // Locked edge state — annotated demo trigger.
  if (query.locked) return lockedState(leagueId, q, faab, priority);

  const raw = await getFreeAgents(db, leagueId, CURRENT_WEEK, {
    position: q.position,
    search: q.search,
    limit: 80,
  });

  const filtered = applyStatus(raw, q.status);
  const players = sortPlayers(filtered, q.sort).slice(0, 60);

  if (players.length === 0) return emptyState(leagueId, q, faab, priority);

  // Trending adds: top 5 by add momentum. Drops: distinct pool by drop signal.
  const byAdd = [...raw].sort((a, b) => rosterChange(b, true) - rosterChange(a, true));
  const topAdds = byAdd.slice(0, 5);
  const byDrop = [...raw]
    .sort((a, b) => hash(b.player_id + "drop") - hash(a.player_id + "drop"))
    .slice(0, 5);

  const top = byAdd[0] || players[0];

  const addCard = (p: DBPlayer) => {
    const chg = rosterChange(p, true);
    return `<a href="/playerdb/${esc(p.player_id)}" style="flex-shrink:0;width:150px;text-decoration:none;color:inherit;background:var(--bg-elevated);border:1px solid var(--border-subtle);border-radius:12px;padding:12px;">
      <div class="flex items-center gap-2 mb-2">
        <span class="position-badge pos-${esc(p.position)}">${esc(p.position)}</span>
        <span class="text-2xs" style="color:var(--neon-green);font-weight:700;">▲ ${chg}%</span>
      </div>
      <span class="font-semibold text-sm" style="display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(p.name)}</span>
      <span class="text-2xs text-muted" style="display:block;line-height:1.35;margin-top:4px;">${esc(reasonFor(p))}</span>
    </a>`;
  };
  const dropCard = (p: DBPlayer) => {
    const chg = rosterChange(p, false);
    return `<a href="/playerdb/${esc(p.player_id)}" style="flex-shrink:0;width:150px;text-decoration:none;color:inherit;background:var(--bg-elevated);border:1px solid var(--border-subtle);border-radius:12px;padding:12px;">
      <div class="flex items-center gap-2 mb-2">
        <span class="position-badge pos-${esc(p.position)}">${esc(p.position)}</span>
        <span class="text-2xs" style="color:var(--neon-red);font-weight:700;">▼ ${chg}%</span>
      </div>
      <span class="font-semibold text-sm" style="display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(p.name)}</span>
      <span class="text-2xs text-muted" style="display:block;line-height:1.35;margin-top:4px;">${esc(dropReasonFor(p))}</span>
    </a>`;
  };

  const trendingRail = `
    <div class="card fade-up fade-up-2">
      <span class="section-label">Trending adds</span>
      <div class="flex gap-3 trend-rail" style="overflow-x:auto;padding-bottom:4px;">
        ${topAdds.map(addCard).join("")}
      </div>
      <span class="section-label" style="margin-top:16px;">Trending drops</span>
      <div class="flex gap-3 trend-rail" style="overflow-x:auto;padding-bottom:4px;">
        ${byDrop.map(dropCard).join("")}
      </div>
    </div>`;

  const claimLabel = q.mode === "waivers" ? "Submit claim" : "Add now";
  const faabLine = q.mode === "waivers" ? ` — spend ~18% of your $${faab} FAAB.` : " — add him free while he's open.";
  const waiverCallout = `
    <div class="card fade-up fade-up-2" style="border-color:rgba(168,85,247,.34);background:linear-gradient(160deg,var(--neon-purple-soft),transparent);">
      <span class="section-label" style="color:var(--neon-purple);">${SPARK} Waiver Assistant</span>
      <span class="text-2xs text-muted uppercase">Your #1 priority claim this week</span>
      <div class="flex-between items-center mt-2">
        <div class="flex items-center gap-3" style="min-width:0;">
          <span class="position-badge pos-${esc(top.position)}">${esc(top.position)}</span>
          <div class="flex-col" style="min-width:0;">
            <span class="font-bold text-sm">${esc(top.name)}</span>
            <span class="text-2xs text-muted" style="line-height:1.35;">${esc(reasonFor(top))}${esc(faabLine)}</span>
          </div>
        </div>
      </div>
      <a href="#" class="btn-purple" style="margin-top:12px;">${claimLabel}</a>
    </div>`;

  const mainList = `
    <div class="card fade-up fade-up-3">
      <div class="flex-between mb-2">
        <span class="section-label" style="margin:0;">Available${q.position !== "ALL" ? ` · ${q.position}` : ""}</span>
        <span class="text-2xs text-muted">${players.length} players</span>
      </div>
      ${players.map((p) => faRow(p, q)).join("")}
    </div>`;

  const body = `
    ${topBar(leagueId, q, faab, priority)}
    <div class="desk-grid">
      <div class="desk-main">
        ${mainList}
      </div>
      <div class="desk-side">
        ${waiverCallout}
        ${trendingRail}
      </div>
    </div>
  `;
  return renderPage({ title: "Free Agency", body, active: "league", extraCss: FA_CSS });
}
