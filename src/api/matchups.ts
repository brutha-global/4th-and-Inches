import { Env } from "../lib/sportsdata";
import { calculatePlayerScore, DEFAULT_SCORING_CONFIG } from "../lib/scoring";

export interface LeagueTypeConfig {
  autoSetLineups: boolean;
  eliminationStyle: boolean;
  tradeAllowed: boolean;
  benchCountMultiplier: number;
}

/**
 * Factory returning scoring and matchup configurations per league style
 */
export function getLeagueTypeConfig(type: string): LeagueTypeConfig {
  switch (type) {
    case "best_ball":
      return { autoSetLineups: true, eliminationStyle: false, tradeAllowed: false, benchCountMultiplier: 0.0 };
    case "survivor":
    case "guillotine":
      return { autoSetLineups: false, eliminationStyle: true, tradeAllowed: true, benchCountMultiplier: 1.0 };
    case "dynasty":
    case "classic":
    default:
      return { autoSetLineups: false, eliminationStyle: false, tradeAllowed: true, benchCountMultiplier: 1.0 };
  }
}

// Get current week matchups for a league
export async function getLeagueMatchups(
  leagueId: string,
  db: D1Database
): Promise<Response> {
  try {
    const league = await db.prepare("SELECT season, week FROM leagues WHERE league_id = ?").bind(leagueId).first<any>();
    if (!league) {
      return new Response(JSON.stringify({ error: "League not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
    }

    const { results: matchups } = await db.prepare(`
      SELECT m.*, t1.name as team1_name, t2.name as team2_name 
      FROM matchups m
      JOIN teams t1 ON m.team1_id = t1.team_id
      JOIN teams t2 ON m.team2_id = t2.team_id
      WHERE m.league_id = ? AND m.week = ?
    `).bind(leagueId, league.week).all<any>();

    return new Response(JSON.stringify({ week: league.week, season: league.season, matchups }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message || String(e) }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}

// Get detailed matchup points breakdown per player contribution
export async function getMatchupDetails(
  matchupId: string,
  db: D1Database
): Promise<Response> {
  try {
    const matchup = await db.prepare("SELECT * FROM matchups WHERE matchup_id = ?").bind(matchupId).first<any>();
    if (!matchup) {
      return new Response(JSON.stringify({ error: "Matchup not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
    }

    const { results: team1Players } = await db.prepare(`
      SELECT r.slot_type, r.is_starter, p.player_id, p.name, p.position, p.team 
      FROM rosters r
      JOIN players p ON r.player_id = p.player_id
      WHERE r.team_id = ? AND r.week = ?
    `).bind(matchup.team1_id, matchup.week).all<any>();

    const { results: team2Players } = await db.prepare(`
      SELECT r.slot_type, r.is_starter, p.player_id, p.name, p.position, p.team 
      FROM rosters r
      JOIN players p ON r.player_id = p.player_id
      WHERE r.team_id = ? AND r.week = ?
    `).bind(matchup.team2_id, matchup.week).all<any>();

    // Calculate score points for each player
    const getStatsAndScore = async (players: any[]) => {
      const list = [];
      for (const p of players) {
        const stats = await db.prepare(`
          SELECT * FROM player_stats 
          WHERE player_id = ? AND week = ? AND season = (SELECT season FROM leagues WHERE league_id = ?)
          LIMIT 1
        `).bind(p.player_id, matchup.week, matchup.league_id).first<any>();

        const points = stats ? calculatePlayerScore(stats, DEFAULT_SCORING_CONFIG) : 0.0;
        list.push({
          ...p,
          points
        });
      }
      return list;
    };

    const team1Breakdown = await getStatsAndScore(team1Players);
    const team2Breakdown = await getStatsAndScore(team2Players);

    return new Response(JSON.stringify({
      matchup,
      team1: team1Breakdown,
      team2: team2Breakdown
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message || String(e) }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}

// Get league standings list
export async function getLeagueStandings(
  leagueId: string,
  db: D1Database
): Promise<Response> {
  try {
    const { results: standings } = await db.prepare(`
      SELECT s.*, t.name as team_name, t.logo_url 
      FROM standings s
      JOIN teams t ON s.team_id = t.team_id
      WHERE s.league_id = ?
      ORDER BY s.wins DESC, s.points_for DESC
    `).bind(leagueId).all<any>();

    return new Response(JSON.stringify({ leagueId, standings }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message || String(e) }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
