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
