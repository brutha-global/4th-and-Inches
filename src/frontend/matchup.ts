import { renderPage, ICONS, SPARK } from "./theme";
import {
  getTeam,
  getRoster,
  getLeague,
  injuryMeta,
  initials,
  esc,
  DIVISION_MAP,
  USER_TEAM_ID,
  CURRENT_WEEK,
  type DBPlayer,
  type DBTeam,
} from "./data";

/* ── deterministic per-player pseudo-stats (same approach as other screens) ── */
function hash(s: string): number {
  let h = 2166136261;
  for (const ch of s) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function projFor(p: DBPlayer): number {
  const base: Record<string, [number, number]> = {
    QB: [14, 26], RB: [6, 22], WR: [5, 20], TE: [4, 14], K: [6, 12], DEF: [3, 13],
  };
  const [lo, hi] = base[p.position] || [4, 16];
  const h = hash(p.player_id + p.name);
  return Math.round((lo + ((h % 1000) / 1000) * (hi - lo)) * 10) / 10;
}
/** Live points so far this game: 0..proj, driven by a per-player phase. */
function liveFor(p: DBPlayer, proj: number): { pts: number; phase: "pre" | "live" | "final"; detail: string } {
  const h = hash(p.player_id + "live");
  const inj = injuryMeta(p.injury_status);
  if (inj.isOut) return { pts: 0, phase: "final", detail: "Ruled out — 0 pts" };
  const phaseRoll = h % 3; // 0 pre, 1 live, 2 final
  if (phaseRoll === 0) return { pts: 0, phase: "pre", detail: "Kickoff pending" };
  if (phaseRoll === 2) return { pts: Math.round(proj * (0.7 + ((h >> 4) % 60) / 100) * 10) / 10, phase: "final", detail: "Final" };
  const frac = 0.25 + ((h >> 6) % 60) / 100;
  return { pts: Math.round(proj * frac * 10) / 10, phase: "live", detail: "In progress" };
}

const STARTER_SLOT_ORDER = ["QB", "RB", "WR", "TE", "FLEX", "K", "DEF"];
function slotSortKey(slot: string): number {
  const i = STARTER_SLOT_ORDER.indexOf(slot);
  return i === -1 ? 99 : i;
}

/** Pair a team's starters into ordered [slotLabel, player] cells, allowing multiple of a slot. */
function orderStarters(roster: DBPlayer[]): { slot: string; player: DBPlayer | null }[] {
  const starters = roster.filter((p) => p.is_starter === 1);
  starters.sort((a, b) => {
    const ka = slotSortKey(a.slot_type || a.position);
    const kb = slotSortKey(b.slot_type || b.position);
    return ka - kb || a.name.localeCompare(b.name);
  });
  return starters.map((p) => ({ slot: p.slot_type || p.position, player: p }));
}

/** A half-cell (one player) rendered for left or right side. */
function halfCell(p: DBPlayer | null, side: "l" | "r"): string {
  if (!p) {
    return `<div class="mu-half mu-${side}"><span class="text-2xs text-muted">—</span></div>`;
  }
  const proj = projFor(p);
  const live = liveFor(p, proj);
  const inj = injuryMeta(p.injury_status);
  const muted = live.phase === "pre";
  const liveDot = live.phase === "live"
    ? `<span class="status-dot dot-live" style="width:6px;height:6px;"></span>`
    : live.phase === "final"
    ? `<span class="mu-check">✓</span>`
    : `<span class="status-dot dot-idle" style="width:6px;height:6px;"></span>`;
  const statusChip = inj.isRisk
    ? `<span class="pill ${inj.chipClass}" style="padding:1px 6px;font-size:9px;">${esc(inj.label)}</span>`
    : "";
  const name = esc(p.name);
  const alignEnd = side === "r" ? "items-end" : "";
  const ptsColor = live.phase === "final" ? "text-muted" : muted ? "text-muted" : "text-green";
  return `<div class="mu-half mu-${side}${muted ? " mu-pre" : ""}">
    <div class="flex-col ${alignEnd}" style="min-width:0;gap:2px;">
      <div class="flex items-center gap-1" style="${side === "r" ? "flex-direction:row-reverse;" : ""}min-width:0;">
        ${liveDot}
        <span class="font-semibold text-xs" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:96px;">${name}</span>
      </div>
      <div class="flex items-center gap-1" style="${side === "r" ? "flex-direction:row-reverse;" : ""}">
        <span class="outfit-font mono-num font-black text-sm ${ptsColor}">${live.pts.toFixed(1)}</span>
        ${statusChip}
      </div>
      <span class="text-2xs text-muted" style="white-space:nowrap;">${esc(p.team)} · ${live.detail}</span>
    </div>
  </div>`;
}

/** The center gutter shows slot label + per-slot differential (user − opp). */
function centerGutter(slot: string, lPts: number, rPts: number): string {
  const diff = Math.round((lPts - rPts) * 10) / 10;
  const cls = diff > 0 ? "text-green" : diff < 0 ? "text-red" : "text-muted";
  const sign = diff > 0 ? "+" : "";
  const badge = slot === "FLEX" ? "WR" : slot;
  return `<div class="mu-center">
    <span class="position-badge pos-${badge}" style="min-width:34px;">${esc(slot)}</span>
    <span class="mono-num font-bold text-2xs ${cls}" style="margin-top:4px;">${sign}${diff.toFixed(1)}</span>
  </div>`;
}

function pvpRow(slot: string, left: DBPlayer | null, right: DBPlayer | null): string {
  const lPts = left ? liveFor(left, projFor(left)).pts : 0;
  const rPts = right ? liveFor(right, projFor(right)).pts : 0;
  return `<div class="mu-row">
    ${halfCell(left, "l")}
    ${centerGutter(slot, lPts, rPts)}
    ${halfCell(right, "r")}
  </div>`;
}

function benchRow(left: DBPlayer | null, right: DBPlayer | null): string {
  const cell = (p: DBPlayer | null, side: "l" | "r") => {
    if (!p) return `<div class="mu-half mu-${side}"><span class="text-2xs text-muted">—</span></div>`;
    const proj = projFor(p);
    const live = liveFor(p, proj);
    const alignEnd = side === "r" ? "items-end" : "";
    return `<div class="mu-half mu-${side}" style="opacity:.7;">
      <div class="flex-col ${alignEnd}" style="min-width:0;gap:1px;">
        <span class="text-xs" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:96px;">${esc(p.name)}</span>
        <span class="mono-num text-2xs text-muted">${live.pts.toFixed(1)} · ${esc(p.position)}</span>
      </div>
    </div>`;
  };
  return `<div class="mu-row" style="border-bottom:1px solid var(--border-subtle);">
    ${cell(left, "l")}
    <div class="mu-center"><span class="text-2xs text-muted">BN</span></div>
    ${cell(right, "r")}
  </div>`;
}

function sumLive(roster: DBPlayer[]): number {
  return roster
    .filter((p) => p.is_starter === 1)
    .reduce((a, p) => a + liveFor(p, projFor(p)).pts, 0);
}
function sumProj(roster: DBPlayer[]): number {
  return roster.filter((p) => p.is_starter === 1).reduce((a, p) => a + projFor(p), 0);
}
function gamesDone(roster: DBPlayer[]): { done: number; total: number } {
  const starters = roster.filter((p) => p.is_starter === 1);
  const done = starters.filter((p) => liveFor(p, projFor(p)).phase === "final").length;
  return { done, total: starters.length };
}
/** best-ball score: swap in the highest bench player eligible for each slot. */
function optimalScore(roster: DBPlayer[]): number {
  const FLEX_OK = new Set(["RB", "WR", "TE"]);
  const starters = orderStarters(roster);
  const bench = roster.filter((p) => p.is_starter !== 1);
  const used = new Set<string>();
  let total = 0;
  for (const { slot, player } of starters) {
    let best = player ? liveFor(player, projFor(player)).pts : 0;
    for (const b of bench) {
      if (used.has(b.player_id)) continue;
      const ok = slot === "FLEX" ? FLEX_OK.has(b.position) : b.position === slot;
      if (!ok) continue;
      const bp = liveFor(b, projFor(b)).pts;
      if (bp > best) { best = bp; }
    }
    total += best;
  }
  return Math.round(total * 10) / 10;
}

function emptyState(): string {
  const body = `
    <div class="page-header fade-up fade-up-1">
      <a href="/" class="header-back">←</a>
      <span class="outfit-font font-black text-lg">War Room</span>
      <span style="width:36px;"></span>
    </div>
    <div class="card fade-up fade-up-2" style="text-align:center;padding:40px 20px;">
      <span class="section-label" style="justify-content:center;">No matchup this week</span>
      <p class="text-sm text-muted" style="margin-top:8px;line-height:1.5;">
        You're on a bye this week — no head-to-head opponent. Set next week's lineup or scout the league while you wait.
      </p>
      <a href="/lineup/${USER_TEAM_ID}" class="btn-secondary" style="margin-top:16px;max-width:220px;">Set your lineup</a>
    </div>`;
  return renderPage({ title: "War Room", body, active: "matchup" });
}

const EXTRA_CSS = `
  .mu-row {
    display:grid; grid-template-columns:1fr 56px 1fr; align-items:center;
    padding:10px 0; border-bottom:1px solid var(--border-subtle); gap:4px;
  }
  .mu-row:last-child { border-bottom:none; }
  .mu-half { min-width:0; }
  .mu-l { text-align:left; }
  .mu-r { text-align:right; display:flex; justify-content:flex-end; }
  .mu-pre { opacity:.5; }
  .mu-center { display:flex; flex-direction:column; align-items:center; justify-content:center; }
  .mu-check { color:var(--neon-green); font-size:11px; font-weight:800; }
  #toast {
    position: fixed; bottom: 96px; left: 50%; transform: translateX(-50%) translateY(20px);
    background: var(--bg-card); border:1px solid var(--border-subtle);
    color: var(--text-light); padding:12px 18px; border-radius:12px;
    font-size:13px; font-weight:600; box-shadow: var(--shadow-card);
    opacity:0; pointer-events:none; transition: all .3s ease; z-index:200; max-width:320px;
  }
  #toast.show { opacity:1; transform: translateX(-50%) translateY(0); }
  .tok-pill {
    display:inline-flex; align-items:center; gap:6px; padding:5px 12px; border-radius:100px;
    font-size:11px; font-weight:700; cursor:pointer; border:1px solid rgba(245,158,11,.4);
    background:var(--neon-amber-soft); color:var(--neon-amber);
  }
  .tok-pill.chal { border-color:rgba(74,158,255,.4); background:rgba(74,158,255,.12); color:var(--neon-blue); }
  @media (min-width:900px){ #toast{ bottom:32px; } }
`;

export async function renderMatchupRoom(
  db: D1Database,
  leagueId: string = "L_TEST",
  userTeamId: string = USER_TEAM_ID
): Promise<string> {
  const league = await getLeague(db, leagueId);
  const week = league?.week ?? CURRENT_WEEK;

  // Find the user's matchup this week.
  const mu = await db
    .prepare(
      `SELECT * FROM matchups WHERE league_id = ? AND week = ?
       AND (team1_id = ? OR team2_id = ?) LIMIT 1`
    )
    .bind(leagueId, week, userTeamId, userTeamId)
    .first<any>();

  if (!mu) return emptyState();

  // Orient so the USER is always the left column.
  const userIsTeam1 = mu.team1_id === userTeamId;
  const oppId = userIsTeam1 ? mu.team2_id : mu.team1_id;

  const [userTeam, oppTeam] = await Promise.all([
    getTeam(db, userTeamId),
    getTeam(db, oppId),
  ]);
  if (!userTeam) return emptyState();

  // Bye week: no opponent.
  if (!oppTeam) {
    const body = `
      <div class="page-header fade-up fade-up-1">
        <a href="/" class="header-back">←</a>
        <div class="flex items-center gap-2"><span class="status-dot dot-idle"></span><span class="font-bold text-sm">Week ${week}</span></div>
        <span style="width:36px;"></span>
      </div>
      <div class="glass-card fade-up fade-up-1" style="text-align:center;">
        <span class="outfit-font font-black text-lg">${esc(userTeam.name)}</span>
        <p class="text-sm text-muted mt-2">Bye week — no opponent to face. Your record is unaffected. Use the time to set a clean lineup.</p>
        <a href="/lineup/${esc(userTeamId)}" class="btn-secondary mt-4" style="max-width:220px;margin-left:auto;margin-right:auto;">Set your lineup</a>
      </div>`;
    return renderPage({ title: "War Room", body, active: "matchup", extraCss: EXTRA_CSS });
  }

  const [userRoster, oppRoster] = await Promise.all([
    getRoster(db, userTeamId, week),
    getRoster(db, oppId, week),
  ]);

  const userLive = Math.round(sumLive(userRoster) * 10) / 10;
  const oppLive = Math.round(sumLive(oppRoster) * 10) / 10;
  const userProj = Math.round(sumProj(userRoster) * 10) / 10;
  const oppProj = Math.round(sumProj(oppRoster) * 10) / 10;
  const total = userLive + oppLive || 1;
  const userWinPct = Math.max(3, Math.min(97, Math.round((userLive / total) * 100)));
  const diff = Math.round((userLive - oppLive) * 10) / 10;
  const diffLabel = (diff >= 0 ? "+" : "") + diff.toFixed(1);
  const userGD = gamesDone(userRoster);
  const oppGD = gamesDone(oppRoster);

  // Build paired rows by slot order.
  const userCells = orderStarters(userRoster);
  const oppCells = orderStarters(oppRoster);
  const rowCount = Math.max(userCells.length, oppCells.length);
  const rows: string[] = [];
  for (let i = 0; i < rowCount; i++) {
    const l = userCells[i];
    const r = oppCells[i];
    const slot = (l && l.slot) || (r && r.slot) || "—";
    rows.push(pvpRow(slot, l ? l.player : null, r ? r.player : null));
  }

  // Bench rows
  const userBench = userRoster.filter((p) => p.is_starter !== 1);
  const oppBench = oppRoster.filter((p) => p.is_starter !== 1);
  const benchCount = Math.max(userBench.length, oppBench.length);
  const benchRows: string[] = [];
  for (let i = 0; i < benchCount; i++) {
    benchRows.push(benchRow(userBench[i] || null, oppBench[i] || null));
  }

  // Secondary info
  const userOptimal = optimalScore(userRoster);
  const leftOnBench = Math.round((userOptimal - userLive) * 10) / 10;
  const meta = DIVISION_MAP[userTeamId];
  const oppMeta = DIVISION_MAP[oppId];

  // Biggest swing = the starter with the largest live-vs-proj overperformance across both teams.
  let swingName = "";
  let swingDelta = -Infinity;
  let swingTeam = "";
  for (const [rost, tName] of [[userRoster, userTeam.name], [oppRoster, oppTeam.name]] as [DBPlayer[], string][]) {
    for (const p of rost.filter((x) => x.is_starter === 1)) {
      const proj = projFor(p);
      const l = liveFor(p, proj);
      const d = l.pts - proj;
      if (d > swingDelta) { swingDelta = d; swingName = p.name; swingTeam = tName; }
    }
  }
  const swingSentence = swingName
    ? `${esc(swingName)} (${esc(swingTeam)}) is the biggest swing so far — ${swingDelta >= 0 ? "+" : ""}${swingDelta.toFixed(1)} over projection, bending this matchup ${swingTeam === userTeam.name ? "your way" : "against you"}.`
    : "No standout swing yet — this one's still tight.";

  // Any user starter that is OUT/Questionable is eligible for Insure.
  const insurable = userRoster.find((p) => p.is_starter === 1 && injuryMeta(p.injury_status).isRisk);

  // Playoff badge (weeks 15+ commonly playoffs; here informational only).
  const playoffBadge = week >= 15 ? `<span class="pill pill-amber" style="padding:2px 8px;">Playoffs</span>` : "";

  const body = `
    <div class="page-header fade-up fade-up-1">
      <a href="/" class="header-back">←</a>
      <div class="flex items-center gap-2">
        <span class="status-dot dot-live"></span>
        <span class="font-bold text-sm">Week ${week} · Live</span>
        ${playoffBadge}
      </div>
      <span class="header-back text-green" style="border:none;padding:6px;">${ICONS.matchup}</span>
    </div>

    <div class="desk-grid">
      <div class="desk-main">
        <!-- Score header -->
        <div class="glass-card flex-col gap-4 fade-up fade-up-1">
          <div class="flex-between align-end">
            <div class="flex-col">
              <span class="text-2xs text-muted uppercase">${esc(userTeam.name)}</span>
              <span class="outfit-font mono-num" style="font-size:40px;font-weight:800;line-height:1;">${userLive.toFixed(1)}</span>
              <span class="text-2xs text-muted mono-num">Proj ${userProj.toFixed(1)} · ${userGD.done}/${userGD.total} done</span>
              <span class="pill ${diff >= 0 ? "pill-green" : "pill-red"} mt-2" style="width:fit-content;">${diffLabel}</span>
            </div>
            <span class="text-2xs text-muted font-bold" style="padding-bottom:20px;">VS</span>
            <div class="flex-col items-end">
              <span class="text-2xs text-muted uppercase">${esc(oppTeam.name)}</span>
              <span class="outfit-font mono-num text-muted" style="font-size:34px;font-weight:700;line-height:1;">${oppLive.toFixed(1)}</span>
              <span class="text-2xs text-muted mono-num">Proj ${oppProj.toFixed(1)} · ${oppGD.done}/${oppGD.total} done</span>
            </div>
          </div>
          <div>
            <div class="flex-between text-2xs font-bold mb-2">
              <span class="${userWinPct >= 50 ? "text-green" : "text-red"}">WIN PROBABILITY</span>
              <span class="mono-num">${userWinPct}%</span>
            </div>
            <div class="track"><div class="track-fill ${userWinPct >= 50 ? "fill-green" : "fill-red"}" style="width:${userWinPct}%;"></div></div>
          </div>
        </div>

        <!-- Insure token (surfaces if a user starter is risky) -->
        ${insurable ? `
        <div class="card fade-up fade-up-2" style="border-color:rgba(245,158,11,.4);background:var(--neon-amber-soft);padding:12px 14px;">
          <div class="flex-between items-center">
            <div class="flex-col" style="min-width:0;">
              <span class="text-2xs text-amber uppercase font-bold">Injury watch</span>
              <span class="text-sm font-semibold">${esc(insurable.name)} — ${esc(injuryMeta(insurable.injury_status).label)}</span>
            </div>
            <button class="tok-pill" onclick="tokUse('injury_insurance','${esc(insurable.player_id)}')">${SPARK} Insure</button>
          </div>
        </div>` : ""}

        <!-- Player-vs-player rows -->
        <div class="card fade-up fade-up-2">
          <div class="flex-between mb-2">
            <span class="section-label" style="margin:0;">Head to head</span>
            <button class="tok-pill chal" onclick="tokUse('coach_challenge','live_play')">${SPARK} Challenge</button>
          </div>
          ${rows.join("")}
        </div>

        <!-- Bench -->
        <div class="card fade-up fade-up-3">
          <span class="section-label">Bench</span>
          ${benchRows.join("") || '<span class="text-2xs text-muted">No bench players.</span>'}
        </div>
      </div>

      <div class="desk-side">
        <!-- Secondary info -->
        <div class="card fade-up fade-up-3" style="border-color:rgba(74,158,255,.28);">
          <span class="section-label">${SPARK} Biggest swing</span>
          <p class="text-sm" style="line-height:1.5;">${swingSentence}</p>
        </div>

        <div class="card fade-up fade-up-3">
          <span class="section-label">Left on the bench</span>
          <div class="flex-between items-center">
            <span class="text-sm text-muted">Best-ball lineup would score</span>
            <span class="outfit-font mono-num font-black text-green">${userOptimal.toFixed(1)}</span>
          </div>
          <p class="text-2xs text-muted mt-2" style="line-height:1.4;">
            ${leftOnBench > 0
              ? `You left ${leftOnBench.toFixed(1)} points on the bench. Informational only — it doesn't change your live score.`
              : `Your starters are your best lineup this week. Nothing left on the bench.`}
          </p>
        </div>

        <div class="card fade-up fade-up-4">
          <span class="section-label">Matchup history</span>
          <div class="flex-between">
            <span class="text-sm">${esc(meta?.division || "")} vs ${esc(oppMeta?.division || "")}</span>
            <span class="mono-num text-sm font-bold">${(hash(userTeamId + oppId) % 4)}-${(hash(oppId + userTeamId) % 3)}</span>
          </div>
          <p class="text-2xs text-muted mt-2">Season series and all-time head-to-head record vs ${esc(oppTeam.name)}.</p>
        </div>
      </div>
    </div>

    <div id="toast"></div>
  `;

  const extraJs = `
    function toast(msg){var t=document.getElementById('toast');t.textContent=msg;t.classList.add('show');if(navigator.vibrate)navigator.vibrate(15);clearTimeout(window._tt);window._tt=setTimeout(function(){t.classList.remove('show')},2600);}
    function tokUse(type,ref){toast('✓ '+type.replace(/_/g,' ').toUpperCase()+' requested for '+ref);}
  `;

  return renderPage({ title: "War Room", body, active: "matchup", extraCss: EXTRA_CSS, extraJs });
}
