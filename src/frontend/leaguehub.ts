import { renderPage, SPARK, ICONS } from "./theme";
import {
  getLeague,
  getStandings,
  getAllTeams,
  getRoster,
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

function standingRow(s: any, rankInDiv: number): string {
  const you = s.team_id === USER_TEAM_ID;
  const pf = Number(s.points_for || 0);
  const pa = Number(s.points_against || 0);
  const winner = rankInDiv === 1;
  return `<tr style="${you ? "background:var(--neon-green-soft);" : ""}${winner ? "border-left:3px solid var(--neon-green);" : ""}">
    <td style="padding:9px 6px;color:var(--text-muted);">${rankInDiv}</td>
    <td style="padding:9px 6px;">
      <span class="font-semibold text-sm">${esc(s.name)}</span>${you ? ' <span class="text-2xs text-green">· YOU</span>' : ""}
    </td>
    <td style="padding:9px 6px;text-align:center;" class="mono-num font-bold">${s.wins}-${s.losses}</td>
    <td style="padding:9px 6px;text-align:right;" class="mono-num text-muted">${pf.toFixed(0)}</td>
    <td style="padding:9px 6px;text-align:right;" class="mono-num text-muted">${pa.toFixed(0)}</td>
    <td style="padding:9px 6px;text-align:center;" class="text-2xs font-bold ${(s.streak || "").startsWith("W") ? "text-green" : "text-red"}">${esc(s.streak || "—")}</td>
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
        </tr></thead>
        <tbody>${body}</tbody>
      </table>
    </div>`;
}

async function rosterAccordion(db: D1Database, teams: any[], week: number): Promise<string> {
  const blocks: string[] = [];
  for (const t of teams) {
    const meta = DIVISION_MAP[t.team_id];
    const roster = await getRoster(db, t.team_id, week);
    const starters = roster.filter((p) => p.is_starter === 1);
    const proj = starters.reduce((a, p) => a + projFor(p), 0);
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
      <details class="card fade-up fade-up-3" style="padding:0;">
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
  return blocks.join("");
}

function playoffPicture(standings: any[]): string {
  const seeded = standings.slice(0, 6);
  const inTeams = seeded.slice(0, 4);
  const bubble = standings.slice(4, 8);
  const line = (s: any, seed: number, inPlayoffs: boolean) => `
    <div class="flex-between" style="padding:7px 0;${inPlayoffs ? "" : "opacity:.6;"}">
      <div class="flex items-center gap-3">
        <span class="pill ${seed <= 4 ? "pill-green" : "pill-amber"}" style="min-width:24px;justify-content:center;">${seed}</span>
        <span class="text-sm font-semibold">${esc(s.name)}${s.team_id === USER_TEAM_ID ? ' <span class="text-2xs text-green">· YOU</span>' : ""}</span>
      </div>
      <span class="mono-num text-2xs text-muted">${s.wins}-${s.losses}</span>
    </div>`;
  return `
    <div class="card fade-up fade-up-4">
      <span class="section-label">Playoff picture</span>
      ${inTeams.map((s, i) => line(s, i + 1, true)).join("")}
      <div style="border-top:1px dashed var(--neon-amber);margin:6px 0;padding-top:2px;">
        <span class="text-2xs text-amber uppercase" style="letter-spacing:.08em;">Playoff line</span>
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

export async function renderLeagueHub(
  db: D1Database,
  leagueId: string,
  tab: string = "standings"
): Promise<string> {
  const league = await getLeague(db, leagueId);
  if (!league) return emptyState();
  const standings = await getStandings(db, leagueId);
  const teams = await getAllTeams(db, leagueId);
  const week = league.week ?? CURRENT_WEEK;

  // group standings by conference/division
  const groups: Record<string, any[]> = {};
  for (const s of standings) {
    const m = DIVISION_MAP[s.team_id];
    const key = m ? `${m.conference} · ${m.division}` : "Unassigned";
    (groups[key] ||= []).push(s);
  }
  for (const k in groups) groups[k].sort((a, b) => b.wins - a.wins || b.points_for - a.points_for);

  const tabLink = (key: string, label: string) =>
    `<a href="/hub/${esc(leagueId)}?tab=${key}" class="chip" style="flex:1;text-align:center;text-decoration:none;${
      tab === key ? "color:var(--neon-green);border-color:rgba(34,197,94,.5);background:var(--neon-green-soft);" : ""
    }">${label}</a>`;

  let content = "";
  if (tab === "rosters") {
    content = await rosterAccordion(db, teams, week);
  } else if (tab === "playoffs") {
    content = playoffPicture(standings);
  } else {
    content = Object.entries(groups)
      .map(([title, rows]) => divisionTable(title, rows))
      .join("");
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
        <span class="text-2xs text-muted">${teams.length} Teams · 2 Conf · 4 Div · ${esc(league.scoring_type)}</span>
      </div>
      <div class="flex-col items-end">
        <span class="text-2xs text-muted uppercase">Week</span>
        <span class="outfit-font font-black text-green" style="font-size:22px;line-height:1;">${week}</span>
      </div>
    </div>

    <div class="flex gap-2 mb-4 fade-up fade-up-1">
      ${tabLink("standings", "Standings")}
      ${tabLink("rosters", "All Rosters")}
      ${tabLink("playoffs", "Playoffs")}
    </div>

    ${content}
  `;

  return renderPage({ title: "League Hub", body, active: "league" });
}
