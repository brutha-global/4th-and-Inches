/**
 * 4th & Inches — shared data-access + league metadata helpers.
 *
 * All DB-backed frontend screens read through these functions so the queries
 * (and the division map, which is not stored in D1) live in one place.
 */

export interface DBPlayer {
  player_id: string;
  name: string;
  position: string;
  team: string;
  status: string | null;
  injury_status: string | null;
  headshot_url: string | null;
  slot_type?: string;
  is_starter?: number;
}

export interface DBTeam {
  team_id: string;
  league_id: string;
  owner_id: string;
  name: string;
  logo_url: string | null;
  wins: number;
  losses: number;
  points_for: number;
  points_against: number;
}

/** Conference/Division map — not stored in D1, single source of truth here. */
export const DIVISION_MAP: Record<string, { conference: string; division: string; manager: string }> = {
  T_TEST_1: { conference: "American", division: "Gridiron", manager: "Coach Alex" },
  T_02: { conference: "American", division: "Gridiron", manager: "Marcus" },
  T_03: { conference: "American", division: "Gridiron", manager: "Deshawn" },
  T_04: { conference: "American", division: "Blitz", manager: "Priya" },
  T_05: { conference: "American", division: "Blitz", manager: "Tommy" },
  T_06: { conference: "American", division: "Blitz", manager: "Sofia" },
  T_07: { conference: "National", division: "Hurry-Up", manager: "Jordan" },
  T_08: { conference: "National", division: "Hurry-Up", manager: "Kenji" },
  T_09: { conference: "National", division: "Hurry-Up", manager: "Bianca" },
  T_10: { conference: "National", division: "Trench", manager: "Malik" },
  T_11: { conference: "National", division: "Trench", manager: "Elena" },
  T_12: { conference: "National", division: "Trench", manager: "Chris" },
};

export const LEAGUE_ID = "L_TEST";
export const CURRENT_WEEK = 5;
export const USER_TEAM_ID = "T_TEST_1";

/** Escape user/data text for safe HTML interpolation. */
export function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Initials for avatar fallback (e.g. "Justin Jefferson" -> "JJ"). */
export function initials(name: string): string {
  const parts = name.replace(/ D\/ST$/, "").trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Injury status -> {label, chipClass, isOut}. null/empty = healthy. */
export function injuryMeta(injury: string | null | undefined): {
  label: string;
  chipClass: string;
  isOut: boolean;
  isRisk: boolean;
} {
  const v = (injury || "").toLowerCase();
  if (v === "out" || v === "ir") return { label: injury as string, chipClass: "pill-red", isOut: true, isRisk: true };
  if (v === "questionable" || v === "doubtful")
    return { label: injury as string, chipClass: "pill-amber", isOut: false, isRisk: true };
  return { label: "Healthy", chipClass: "pill-green", isOut: false, isRisk: false };
}

export async function getTeam(db: D1Database, teamId: string): Promise<DBTeam | null> {
  return await db.prepare("SELECT * FROM teams WHERE team_id = ?").bind(teamId).first<DBTeam>();
}

export async function getLeague(db: D1Database, leagueId: string): Promise<any> {
  return await db.prepare("SELECT * FROM leagues WHERE league_id = ?").bind(leagueId).first<any>();
}

/** Full roster (starters + bench) joined to player data, ordered by slot. */
export async function getRoster(db: D1Database, teamId: string, week: number): Promise<DBPlayer[]> {
  const SLOT_ORDER = "CASE r.slot_type WHEN 'QB' THEN 1 WHEN 'RB' THEN 2 WHEN 'WR' THEN 3 WHEN 'TE' THEN 4 WHEN 'FLEX' THEN 5 WHEN 'K' THEN 6 WHEN 'DEF' THEN 7 ELSE 8 END";
  const { results } = await db
    .prepare(
      `SELECT r.slot_type, r.is_starter, p.*
       FROM rosters r JOIN players p ON r.player_id = p.player_id
       WHERE r.team_id = ? AND r.week = ?
       ORDER BY r.is_starter DESC, ${SLOT_ORDER}, p.name`
    )
    .bind(teamId, week)
    .all<DBPlayer>();
  return results || [];
}

export async function getStandings(db: D1Database, leagueId: string): Promise<any[]> {
  const { results } = await db
    .prepare(
      `SELECT s.*, t.name, t.logo_url
       FROM standings s JOIN teams t ON s.team_id = t.team_id
       WHERE s.league_id = ?
       ORDER BY s.wins DESC, s.points_for DESC`
    )
    .bind(leagueId)
    .all<any>();
  return results || [];
}

/**
 * Batched: every team's roster for a league in ONE query, grouped by team_id.
 * Avoids firing N sequential D1 queries in a loop (which can hit the Workers
 * per-invocation subrequest limit and silently truncate results).
 */
export async function getRostersForTeams(
  db: D1Database,
  leagueId: string,
  week: number
): Promise<Record<string, DBPlayer[]>> {
  const SLOT_ORDER =
    "CASE r.slot_type WHEN 'QB' THEN 1 WHEN 'RB' THEN 2 WHEN 'WR' THEN 3 WHEN 'TE' THEN 4 WHEN 'FLEX' THEN 5 WHEN 'K' THEN 6 WHEN 'DEF' THEN 7 ELSE 8 END";
  const { results } = await db
    .prepare(
      `SELECT r.team_id, r.slot_type, r.is_starter, p.*
       FROM rosters r
       JOIN teams t ON r.team_id = t.team_id
       JOIN players p ON r.player_id = p.player_id
       WHERE t.league_id = ? AND r.week = ?
       ORDER BY r.is_starter DESC, ${SLOT_ORDER}, p.name`
    )
    .bind(leagueId, week)
    .all<any>();
  const byTeam: Record<string, DBPlayer[]> = {};
  for (const row of results || []) {
    (byTeam[row.team_id] ||= []).push(row as DBPlayer);
  }
  return byTeam;
}

export async function getAllTeams(db: D1Database, leagueId: string): Promise<DBTeam[]> {
  const { results } = await db
    .prepare("SELECT * FROM teams WHERE league_id = ? ORDER BY wins DESC, points_for DESC")
    .bind(leagueId)
    .all<DBTeam>();
  return results || [];
}

export async function getPlayer(db: D1Database, playerId: string): Promise<DBPlayer | null> {
  return await db.prepare("SELECT * FROM players WHERE player_id = ?").bind(playerId).first<DBPlayer>();
}

/** Find which team (if any) rosters a given player in the league this week. */
export async function getPlayerOwner(
  db: D1Database,
  playerId: string,
  leagueId: string,
  week: number
): Promise<{ team_id: string; name: string; slot_type: string } | null> {
  return await db
    .prepare(
      `SELECT t.team_id, t.name, r.slot_type
       FROM rosters r JOIN teams t ON r.team_id = t.team_id
       WHERE r.player_id = ? AND t.league_id = ? AND r.week = ?`
    )
    .bind(playerId, leagueId, week)
    .first<any>();
}

/**
 * Free agents: players NOT on any roster in the league this week.
 * Optionally filter by position. Ordered by a rough relevance (has headshot, name).
 */
export async function getFreeAgents(
  db: D1Database,
  leagueId: string,
  week: number,
  opts: { position?: string; limit?: number; search?: string } = {}
): Promise<DBPlayer[]> {
  const limit = opts.limit ?? 60;
  const conds: string[] = [
    `p.player_id NOT IN (
       SELECT r.player_id FROM rosters r JOIN teams t ON r.team_id = t.team_id
       WHERE t.league_id = ? AND r.week = ?
     )`,
    `p.position IN ('QB','RB','WR','TE','K','DEF')`,
  ];
  const binds: any[] = [leagueId, week];
  if (opts.position && opts.position !== "ALL") {
    conds.push("p.position = ?");
    binds.push(opts.position);
  }
  if (opts.search) {
    conds.push("p.name LIKE ?");
    binds.push(`%${opts.search}%`);
  }
  binds.push(limit);
  const { results } = await db
    .prepare(
      `SELECT p.* FROM players p
       WHERE ${conds.join(" AND ")}
       ORDER BY (p.headshot_url IS NOT NULL AND p.headshot_url != '') DESC, p.name
       LIMIT ?`
    )
    .bind(...binds)
    .all<DBPlayer>();
  return results || [];
}

// ---------------------------------------------------------------------------
// NFL news + injury feed (real, ESPN-sourced via nfl-news-api port).
// These read the D1 tables from migration 004 and shape them for the UI.
// ---------------------------------------------------------------------------

export interface NewsRow {
  id: number;
  source: string;
  headline: string;
  summary: string | null;
  link: string;
  image_url: string | null;
  published_at: string | null;
  player_id: string | null;
  team_id: string | null;
}

/** Latest league-wide news for the Home carousel. */
export async function getNews(db: D1Database, limit = 12): Promise<NewsRow[]> {
  try {
    const { results } = await db
      .prepare(
        `SELECT id, source, headline, summary, link, image_url, published_at, player_id, team_id
         FROM news_items ORDER BY COALESCE(published_at, fetched_at) DESC LIMIT ?`
      )
      .bind(limit)
      .all<NewsRow>();
    return results || [];
  } catch {
    return []; // table may not exist pre-migration
  }
}

/** News for one player, for the Player Profile news feed. */
export async function getPlayerNews(db: D1Database, playerId: string, limit = 8): Promise<NewsRow[]> {
  try {
    const { results } = await db
      .prepare(
        `SELECT id, source, headline, summary, link, image_url, published_at, player_id, team_id
         FROM news_items WHERE player_id = ? ORDER BY COALESCE(published_at, fetched_at) DESC LIMIT ?`
      )
      .bind(playerId, limit)
      .all<NewsRow>();
    return results || [];
  } catch {
    return [];
  }
}

/** Is the news feed degraded (failing or stale)? Drives the Section-13 note. */
export async function feedDegraded(
  db: D1Database,
  staleMinutes = 180
): Promise<{ degraded: boolean; reason: string | null }> {
  try {
    const { results } = await db.prepare(`SELECT * FROM feed_status`).all<any>();
    const rows = results || [];
    if (rows.length === 0) return { degraded: false, reason: null };
    for (const r of rows) {
      if (r.ok === 0) return { degraded: true, reason: `NFL ${r.job} feed is having trouble updating.` };
    }
    const newest = rows
      .map((r: any) => (r.last_ok_at ? Date.parse(r.last_ok_at) : 0))
      .reduce((a: number, b: number) => Math.max(a, b), 0);
    if (newest && Date.now() - newest > staleMinutes * 60_000) {
      return { degraded: true, reason: "NFL data hasn't refreshed recently — some info may be stale." };
    }
    return { degraded: false, reason: null };
  } catch {
    return { degraded: false, reason: null };
  }
}

/** Compact relative time from an ISO timestamp, e.g. "12m ago", "3h ago". */
export function relTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const t = Date.parse(iso);
  if (isNaN(t)) return "";
  const secs = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (secs < 60) return "just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

/** Eyebrow label + color class + link for a news row, for the carousel card. */
export function classifyNews(
  n: NewsRow
): { kind: string; cls: string; href: string } {
  const text = `${n.headline} ${n.summary || ""}`.toLowerCase();
  const isInjury =
    /injur|questionable|doubtful|out |ruled out|hamstring|ankle|concussion|ir\b|placed on|designated to return/.test(
      text
    );
  const isTrade = /trade|acquire|deal|sends|swap/.test(text);
  const isRank = /power rank|ranking|moves? (up|down)|#\d/.test(text);

  // Player-scoped news links to that player's profile; otherwise league hub.
  const href = n.player_id ? `/playerdb/${n.player_id}` : "/hub/L_TEST";

  if (isInjury) return { kind: "Injury", cls: "text-amber", href };
  if (isTrade) return { kind: "Trade", cls: "text-purple", href };
  if (isRank) return { kind: "Power rank", cls: "text-green", href };
  return { kind: "News", cls: "text-blue", href };
}

