import { renderPage, SPARK, ICONS } from "./theme";
import {
  getLeague,
  getStandings,
  getAllTeams,
  DIVISION_MAP,
  USER_TEAM_ID,
  esc,
} from "./data";

function streakColor(streak: string): string {
  return streak.startsWith("W") ? "text-green" : "text-red";
}

function standingRow(s: any, rank: number): string {
  const seedBadge = rank <= 4 ? "pill-green" : rank <= 6 ? "pill-amber" : "pill-red";
  const you = s.team_id === USER_TEAM_ID;
  const pf = Number(s.points_for || 0);
  const pa = Number(s.points_against || 0);
  return `
    <div class="player-row" style="${you ? "background:var(--neon-green-soft);margin:0 -12px;padding:12px;border-radius:10px;" : ""}">
      <div class="flex items-center gap-3">
        <span class="pill ${seedBadge}" style="min-width:26px;justify-content:center;padding:4px 8px;">${rank}</span>
        <div class="flex-col">
          <span class="font-semibold text-sm">${esc(s.name)}${you ? ' <span class="text-2xs text-green">· YOU</span>' : ""}</span>
          <span class="text-2xs text-muted mono-num">${pf.toFixed(1)} PF · ${pa.toFixed(1)} PA</span>
        </div>
      </div>
      <div class="flex-col items-end gap-1">
        <span class="mono-num font-bold text-sm">${s.wins}-${s.losses}</span>
        <span class="text-2xs font-bold ${streakColor(s.streak || "0W")}">${esc(s.streak || "—")}</span>
      </div>
    </div>`;
}

/** AI-style power blurb derived from record + points (no external call needed). */
function powerBlurb(s: any, rank: number): { trend: string; blurb: string } {
  const pf = Number(s.points_for || 0);
  const wins = Number(s.wins || 0);
  if (rank === 1) return { trend: "→", blurb: "Top of the table — the scoreboard says they earned it." };
  if (wins >= 3) return { trend: "▲", blurb: "Stacking wins and points for. Trending up fast." };
  if (pf > 460) return { trend: "▲", blurb: "Scoring with anyone — the record will follow." };
  if (wins <= 1) return { trend: "▼", blurb: "Rough stretch. Waiver wire is where the season gets saved." };
  return { trend: "→", blurb: "Right in the mix — one hot week from the top four." };
}

function powerRow(s: any, rank: number): string {
  const { trend, blurb } = powerBlurb(s, rank);
  const tColor = trend === "▲" ? "text-green" : trend === "▼" ? "text-red" : "text-muted";
  return `
    <div class="player-row">
      <div class="flex items-center gap-3">
        <span class="outfit-font font-black text-purple" style="font-size:18px;min-width:26px;">#${rank}</span>
        <div class="flex-col">
          <span class="font-semibold text-sm">${esc(s.name)}</span>
          <span class="text-2xs text-muted" style="line-height:1.4;">${blurb}</span>
        </div>
      </div>
      <span class="${tColor} font-bold" style="font-size:16px;">${trend}</span>
    </div>`;
}

function emptyState(leagueId: string): string {
  const body = `
    <div class="page-header fade-up fade-up-1">
      <a href="/" class="header-back">←</a>
      <span class="outfit-font font-black text-lg">League Home</span>
      <span class="header-back text-green" style="border:none;padding:6px;">${ICONS.league}</span>
    </div>
    <div class="card fade-up fade-up-2" style="text-align:center;padding:40px 20px;">
      <span class="section-label" style="justify-content:center;">No league found</span>
      <p class="text-sm text-muted" style="margin-top:8px;line-height:1.5;">
        This league hasn't been set up yet. Create or join a league to see standings and rosters here.
      </p>
      <a href="/" class="btn-secondary" style="margin-top:16px;max-width:200px;">Back to Home</a>
    </div>`;
  return renderPage({ title: "League", body, active: "league" });
}

export async function renderLeague(db: D1Database, leagueId: string): Promise<string> {
  const league = await getLeague(db, leagueId);
  if (!league) return emptyState(leagueId);

  const standings = await getStandings(db, leagueId);
  const teams = await getAllTeams(db, leagueId);
  const teamCount = teams.length;

  const standingsHtml =
    standings.length > 0
      ? standings.map((s, i) => standingRow(s, i + 1)).join("")
      : `<p class="text-sm text-muted" style="padding:8px 0;">Standings populate once week 1 games are final.</p>`;

  const powerHtml = standings.slice(0, 4).map((s, i) => powerRow(s, i + 1)).join("");

  // Full-league roster access: link to the League Hub "All Rosters" view.
  const body = `
    <div class="page-header fade-up fade-up-1">
      <a href="/" class="header-back">←</a>
      <span class="outfit-font font-black text-lg">League Home</span>
      <span class="header-back text-green" style="border:none;padding:6px;">${ICONS.league}</span>
    </div>

    <div class="glass-card flex-between fade-up fade-up-1">
      <div class="flex-col">
        <span class="outfit-font font-black text-base">${esc(league.name)}</span>
        <span class="text-2xs text-muted">${teamCount} Teams · ${esc(league.scoring_type)} · Season ${league.season}</span>
      </div>
      <div class="flex-col items-end">
        <span class="text-2xs text-muted uppercase">Week</span>
        <span class="outfit-font font-black text-green" style="font-size:24px;line-height:1;">${league.week}</span>
      </div>
    </div>

    <div class="card fade-up fade-up-2" style="border-color: rgba(168,85,247,.28);">
      <div class="flex-between mb-2">
        <span class="section-label" style="margin:0;">${SPARK} AI Power Rankings</span>
        <span class="text-2xs text-muted">Updated 2h ago</span>
      </div>
      ${powerHtml}
    </div>

    <div class="card fade-up fade-up-3">
      <div class="flex-between mb-2">
        <span class="section-label" style="margin:0;">Standings</span>
        <div class="flex gap-2 text-2xs">
          <span class="chip" style="color:var(--neon-green);border-color:rgba(34,197,94,.4);">Playoff</span>
          <span class="chip" style="color:var(--neon-amber);border-color:rgba(245,158,11,.4);">Bubble</span>
        </div>
      </div>
      ${standingsHtml}
    </div>

    <div class="flex gap-3 fade-up fade-up-4">
      <a href="/hub/${esc(leagueId)}" class="btn-secondary">All Rosters</a>
      <a href="/matchup/TEST" class="btn-secondary">Matchups</a>
    </div>
    <div class="flex gap-3 fade-up fade-up-4" style="margin-top:12px;">
      <a href="/freeagency/${esc(leagueId)}" class="btn-secondary">Free Agency</a>
      <a href="/draft/${esc(leagueId)}" class="btn-secondary">Draft Room</a>
    </div>
  `;

  return renderPage({ title: "League", body, active: "league" });
}
