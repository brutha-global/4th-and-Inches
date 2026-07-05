import { renderPage, SPARK, ICONS } from "./theme";
import {
  getLeague,
  getStandings,
  getAllTeams,
  getRostersForTeams,
  DIVISION_MAP,
  USER_TEAM_ID,
  CURRENT_WEEK,
  esc,
  initials,
  type DBPlayer,
} from "./data";

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
/** Deterministic power-rank movement: -2..+2 arrows. */
function powerMove(teamId: string): { arrow: string; cls: string } {
  const v = (hash(teamId + "pw") % 5) - 2; // -2..2
  if (v > 0) return { arrow: "▲" + v, cls: "text-green" };
  if (v < 0) return { arrow: "▼" + Math.abs(v), cls: "text-red" };
  return { arrow: "—", cls: "text-muted" };
}

function standingRow(s: any, rankInDiv: number): string {
  const you = s.team_id === USER_TEAM_ID;
  const pf = Number(s.points_for || 0);
  const pa = Number(s.points_against || 0);
  const ties = Number(s.ties || 0);
  const winner = rankInDiv === 1;
  const pw = powerMove(s.team_id);
  return `<tr style="${you ? "background:var(--neon-green-soft);" : ""}${winner ? "border-left:3px solid var(--neon-green);" : ""}">
    <td style="padding:9px 6px;color:var(--text-muted);">${rankInDiv}</td>
    <td style="padding:9px 6px;">
      <span class="font-semibold text-sm">${esc(s.name)}</span>${you ? ' <span class="text-2xs text-green">· YOU</span>' : ""}
    </td>
    <td style="padding:9px 6px;text-align:center;" class="mono-num font-bold">${s.wins}-${s.losses}-${ties}</td>
    <td style="padding:9px 6px;text-align:right;" class="mono-num text-muted">${pf.toFixed(0)}</td>
    <td style="padding:9px 6px;text-align:right;" class="mono-num text-muted">${pa.toFixed(0)}</td>
    <td style="padding:9px 6px;text-align:center;" class="text-2xs font-bold ${(s.streak || "").startsWith("W") ? "text-green" : "text-red"}">${esc(s.streak || "—")}</td>
    <td style="padding:9px 6px;text-align:center;" class="text-2xs font-bold ${pw.cls}">${pw.arrow}</td>
  </tr>`;
}

function divisionTable(title: string, rows: any[]): string {
  const body = rows.map((s, i) => standingRow(s, i + 1)).join("");
  return `
    <div class="card fade-up fade-up-2">
      <span class="section-label">${esc(title)}</span>
      <table class="mono-num" style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead><tr style="color:var(--text-muted);text-align:left;border-bottom:1px solid var(--border-subtle);font-size:11px;">
          <th style="padding:4px 6px;">#</th><th style="padding:4px 6px;">TEAM</th>
          <th style="padding:4px 6px;text-align:center;">REC</th>
          <th style="padding:4px 6px;text-align:right;">PF</th>
          <th style="padding:4px 6px;text-align:right;">PA</th>
          <th style="padding:4px 6px;text-align:center;">STRK</th>
          <th style="padding:4px 6px;text-align:center;">PWR</th>
        </tr></thead>
        <tbody>${body}</tbody>
      </table>
    </div>`;
}

async function rosterAccordion(db: D1Database, leagueId: string, teams: any[], week: number): Promise<string> {
  const rostersByTeam = await getRostersForTeams(db, leagueId, week);
  const blocks: string[] = [];
  for (const t of teams) {
    const meta = DIVISION_MAP[t.team_id];
    const roster = rostersByTeam[t.team_id] || [];
    const starters = roster.filter((p) => p.is_starter === 1);
    const proj = starters.reduce((a, p) => a + projFor(p), 0);
    const playerNames = starters.map((p) => p.name.toLowerCase()).join(" ");
    const mini = starters
      .map(
        (p) => `<div class="flex-between" style="padding:5px 0;border-bottom:1px solid var(--border-subtle);">
          <div class="flex items-center gap-2" style="min-width:0;">
            <span class="position-badge pos-${esc((p.slot_type === "FLEX" ? "WR" : p.slot_type) || p.position)}" style="min-width:34px;">${esc(p.slot_type || p.position)}</span>
            <span class="text-sm" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(p.name)}</span>
          </div>
          <span class="text-2xs text-muted mono-num">${esc(p.team)}</span>
        </div>`
      )
      .join("");
    blocks.push(`
      <details class="card fade-up fade-up-3 roster-acc" data-team="${esc(t.name.toLowerCase())}" data-players="${esc(playerNames)}" style="padding:0;">
        <summary style="list-style:none;cursor:pointer;padding:14px 16px;display:flex;justify-content:space-between;align-items:center;">
          <div class="flex items-center gap-3" style="min-width:0;">
            <div class="avatar" style="width:36px;height:36px;font-size:12px;">${esc(initials(t.name))}</div>
            <div class="flex-col" style="min-width:0;">
              <span class="font-semibold text-sm">${esc(t.name)}${t.team_id === USER_TEAM_ID ? ' <span class="text-2xs text-green">· YOU</span>' : ""}</span>
              <span class="text-2xs text-muted">${esc(meta?.manager || "")} · ${t.wins}-${t.losses}</span>
            </div>
          </div>
          <span class="outfit-font mono-num font-bold text-green text-sm">${proj.toFixed(1)}</span>
        </summary>
        <div style="padding:0 16px 14px 16px;">${mini || '<span class="text-2xs text-muted">No roster set.</span>'}</div>
      </details>`);
  }
  return `
    <input type="text" id="rosterSearch" oninput="filterRosters(this.value)" placeholder="Search by team or player…"
      class="fade-up fade-up-1" style="width:100%;padding:11px 14px;margin-bottom:12px;border-radius:10px;background:var(--bg-elevated);border:1px solid var(--border-subtle);color:var(--text-light);font-size:14px;font-family:'Inter',sans-serif;">
    <div id="rosterList">${blocks.join("")}</div>
    <p id="rosterNone" class="text-sm text-muted" style="display:none;text-align:center;padding:24px;">No team or player matches that search. Clear the box to see every roster.</p>`;
}

async function teamGrid(db: D1Database, leagueId: string, teams: any[], standings: any[], week: number): Promise<string> {
  const rostersByTeam = await getRostersForTeams(db, leagueId, week);
  const seedMap: Record<string, number> = {};
  standings.forEach((s, i) => { seedMap[s.team_id] = i + 1; });
  const strengths = teams.map((t) => {
    const roster = rostersByTeam[t.team_id] || [];
    const proj = roster.filter((p) => p.is_starter === 1).reduce((a, p) => a + projFor(p), 0);
    return { t, proj };
  });
  const maxProj = Math.max(...strengths.map((x) => x.proj), 1);
  const cards = strengths
    .map(({ t, proj }) => {
      const pct = Math.round((proj / maxProj) * 100);
      const you = t.team_id === USER_TEAM_ID;
      const seed = seedMap[t.team_id] || "—";
      return `<a href="/roster/${esc(t.team_id)}" class="card card-tappable fade-up fade-up-2" style="text-decoration:none;color:inherit;margin:0;${you ? "border-color:rgba(34,197,94,.5);" : ""}">
        <div class="flex items-center gap-2 mb-2">
          <div class="avatar" style="width:34px;height:34px;font-size:12px;">${esc(initials(t.name))}</div>
          <div class="flex-col" style="min-width:0;flex:1;">
            <span class="font-semibold text-sm" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(t.name)}${you ? ' <span class="text-2xs text-green">· YOU</span>' : ""}</span>
            <span class="text-2xs text-muted">${t.wins}-${t.losses} · #${seed} seed</span>
          </div>
        </div>
        <div class="flex-between text-2xs mb-2">
          <span class="text-muted uppercase">Roster strength</span>
          <span class="mono-num text-green font-bold">${proj.toFixed(0)}</span>
        </div>
        <div class="track"><div class="track-fill fill-green" style="width:${pct}%;"></div></div>
      </a>`;
    })
    .join("");
  return `<div class="desk-grid-3">${cards}</div>`;
}

function playoffPicture(standings: any[]): string {
  const seeded = standings.slice(0, 6);
  const inTeams = seeded.slice(0, 4);
  const bubble = standings.slice(4, 8);
  const cutWins = inTeams.length ? inTeams[inTeams.length - 1].wins : 0;
  const line = (s: any, seed: number, inPlayoffs: boolean) => {
    const gb = inPlayoffs ? "" : `<span class="text-2xs text-amber mono-num">${Math.max(0, cutWins - s.wins)} GB</span>`;
    return `
    <div class="flex-between" style="padding:7px 0;${inPlayoffs ? "" : "opacity:.75;"}">
      <div class="flex items-center gap-3">
        <span class="pill ${seed <= 4 ? "pill-green" : "pill-amber"}" style="min-width:24px;justify-content:center;">${seed}</span>
        <span class="text-sm font-semibold">${esc(s.name)}${s.team_id === USER_TEAM_ID ? ' <span class="text-2xs text-green">· YOU</span>' : ""}</span>
      </div>
      <div class="flex items-center gap-3">
        ${gb}
        <span class="mono-num text-2xs text-muted">${s.wins}-${s.losses}</span>
      </div>
    </div>`;
  };
  return `
    <div class="card fade-up fade-up-4">
      <span class="section-label">Playoff picture</span>
      ${inTeams.map((s, i) => line(s, i + 1, true)).join("")}
      <div style="border-top:1px dashed var(--neon-amber);margin:6px 0;padding-top:2px;">
        <span class="text-2xs text-amber uppercase" style="letter-spacing:.08em;">Playoff line · tiebreaker: total points for</span>
      </div>
      ${bubble.map((s, i) => line(s, i + 5, false)).join("")}
    </div>`;
}

function emptyState(): string {
  const body = `
    <div class="page-header fade-up fade-up-1">
      <a href="/league/L_TEST" class="header-back">←</a>
      <span class="outfit-font font-black text-lg">League Hub</span>
      <span style="width:36px;"></span>
    </div>
    <div class="card fade-up fade-up-2" style="text-align:center;padding:40px 20px;">
      <span class="section-label" style="justify-content:center;">No league yet</span>
      <p class="text-sm text-muted" style="margin-top:8px;line-height:1.5;">This league hasn't been set up. Create or join one to see the hub.</p>
      <a href="/" class="btn-secondary" style="margin-top:16px;max-width:200px;">Back to Home</a>
    </div>`;
  return renderPage({ title: "League Hub", body, active: "league" });
}

const EXTRA_CSS = `
  .conf-filter .chip.active { color:var(--neon-green); border-color:rgba(34,197,94,.5); background:var(--neon-green-soft); }
  @media (min-width:900px){
    .standings-cols { display:grid; grid-template-columns:1fr 1fr; gap:20px; align-items:start; }
  }
`;

export async function renderLeagueHub(
  db: D1Database,
  leagueId: string,
  tab: string = "standings",
  conf: string = "all"
): Promise<string> {
  const league = await getLeague(db, leagueId);
  if (!league) return emptyState();
  const standings = await getStandings(db, leagueId);
  const teams = await getAllTeams(db, leagueId);
  const week = league.week ?? CURRENT_WEEK;

  // group standings by conference/division
  const groups: Record<string, any[]> = {};
  const conferenceSet = new Set<string>();
  for (const s of standings) {
    const m = DIVISION_MAP[s.team_id];
    if (m) conferenceSet.add(m.conference);
    const key = m ? `${m.conference} · ${m.division}` : "Unassigned";
    (groups[key] ||= []).push(s);
  }
  for (const k in groups) groups[k].sort((a, b) => b.wins - a.wins || b.points_for - a.points_for);
  const conferences = Array.from(conferenceSet);
  const multiConf = conferences.length > 1;

  const tabLink = (key: string, label: string) =>
    `<a href="/hub/${esc(leagueId)}?tab=${key}" class="chip" style="flex:1;text-align:center;text-decoration:none;${
      tab === key ? "color:var(--neon-green);border-color:rgba(34,197,94,.5);background:var(--neon-green-soft);" : ""
    }">${label}</a>`;

  let content = "";
  if (tab === "rosters") {
    content = await rosterAccordion(db, leagueId, teams, week);
  } else if (tab === "teams") {
    content = await teamGrid(db, leagueId, teams, standings, week);
  } else if (tab === "playoffs") {
    content = playoffPicture(standings);
  } else {
    // Standings — optional conference filter + multi-column desktop layout.
    let confFilter = "";
    if (multiConf) {
      const confChip = (key: string, label: string) =>
        `<a href="/hub/${esc(leagueId)}?tab=standings&conf=${key}" class="chip${conf === key ? " active" : ""}" style="text-decoration:none;">${label}</a>`;
      confFilter = `<div class="conf-filter flex gap-2 mb-4 fade-up fade-up-1">
        ${confChip("all", "All")}
        ${conferences.map((c) => confChip(c.toLowerCase(), c)).join("")}
      </div>`;
    }
    const tables = Object.entries(groups)
      .filter(([title]) => conf === "all" || title.toLowerCase().startsWith(conf.toLowerCase()))
      .map(([title, rows]) => divisionTable(title, rows));
    content = `${confFilter}<div class="standings-cols">${tables.join("")}</div>`;
  }

  const body = `
    <div class="page-header fade-up fade-up-1">
      <a href="/league/${esc(leagueId)}" class="header-back">←</a>
      <span class="outfit-font font-black text-lg">League Hub</span>
      <span class="header-back text-green" style="border:none;padding:6px;">${ICONS.league}</span>
    </div>

    <div class="glass-card flex-between fade-up fade-up-1">
      <div class="flex-col">
        <span class="outfit-font font-black text-base">${esc(league.name)}</span>
        <span class="text-2xs text-muted">${teams.length} Teams · ${conferences.length} Conf · ${Object.keys(groups).length} Div · ${esc(league.scoring_type)}</span>
      </div>
      <div class="flex-col items-end">
        <span class="text-2xs text-muted uppercase">Week</span>
        <span class="outfit-font font-black text-green" style="font-size:22px;line-height:1;">${week}</span>
      </div>
    </div>

    <div class="flex gap-2 mb-4 fade-up fade-up-1">
      ${tabLink("standings", "Standings")}
      ${tabLink("teams", "Teams")}
      ${tabLink("rosters", "All Rosters")}
      ${tabLink("playoffs", "Playoffs")}
    </div>

    ${content}
  `;

  const extraJs = `
    function filterRosters(q){
      q = (q||'').trim().toLowerCase();
      var items = document.querySelectorAll('#rosterList .roster-acc');
      var shown = 0;
      items.forEach(function(el){
        var hay = (el.getAttribute('data-team')||'') + ' ' + (el.getAttribute('data-players')||'');
        var match = !q || hay.indexOf(q) !== -1;
        el.style.display = match ? '' : 'none';
        if (match) shown++;
      });
      var none = document.getElementById('rosterNone');
      if (none) none.style.display = shown === 0 ? 'block' : 'none';
    }
  `;

  return renderPage({ title: "League Hub", body, active: "league", extraCss: EXTRA_CSS, extraJs });
}
