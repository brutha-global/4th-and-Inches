import { Env } from "../lib/sportsdata";
import { awardXP, updateReputation, applyBenchHeat } from "../lib/coachXP";

/**
 * Handles matchup week completions. Iterates through completed matchups in a league,
 * updates wins/losses records, awards XP bonuses, recalculates team reputation stats,
 * and sets Loyalist Bench Heat increments.
 */
export async function finalizeMatchupWeek(
  leagueId: string,
  week: number,
  db: D1Database
): Promise<Response> {
  try {
    // 1. Fetch matchups for this week
    const { results: matchups } = await db.prepare(`
      SELECT * FROM matchups 
      WHERE league_id = ? AND week = ? AND status = 'Scheduled'
    `).bind(leagueId, week).all<any>();

    let updatedCount = 0;

    for (const m of matchups) {
      const { matchup_id, team1_id, team2_id, team1_score, team2_score } = m;

      let winnerId = null;
      let loserId = null;

      if (team1_score > team2_score) {
        winnerId = team1_id;
        loserId = team2_id;
      } else if (team2_score > team1_score) {
        winnerId = team2_id;
        loserId = team1_id;
      }

      // Update matchup status
      await db.prepare(`
        UPDATE matchups 
        SET winner_id = ?, status = 'Final' 
        WHERE matchup_id = ?
      `).bind(winnerId, matchup_id).run();

      // Update teams standings records
      if (winnerId && loserId) {
        await db.prepare("UPDATE teams SET wins = wins + 1, points_for = points_for + ? WHERE team_id = ?").bind(Math.max(team1_score, team2_score), winnerId).run();
        await db.prepare("UPDATE teams SET losses = losses + 1, points_for = points_for + ? WHERE team_id = ?").bind(Math.min(team1_score, team2_score), loserId).run();

        // Standings table update
        await db.prepare(`
          INSERT INTO standings (standing_id, league_id, team_id, wins, losses, ties, points_for, updated_at)
          VALUES (?, ?, ?, 1, 0, 0, ?, ?)
          ON CONFLICT(standing_id) DO UPDATE SET
            wins = wins + 1,
            points_for = points_for + excluded.points_for,
            updated_at = excluded.updated_at
        `).bind(`stand_${leagueId}_${winnerId}`, leagueId, winnerId, Math.max(team1_score, team2_score), Math.floor(Date.now() / 1000)).run();

        await db.prepare(`
          INSERT INTO standings (standing_id, league_id, team_id, wins, losses, ties, points_for, updated_at)
          VALUES (?, ?, ?, 0, 1, 0, ?, ?)
          ON CONFLICT(standing_id) DO UPDATE SET
            losses = losses + 1,
            points_for = points_for + excluded.points_for,
            updated_at = excluded.updated_at
        `).bind(`stand_${leagueId}_${loserId}`, leagueId, loserId, Math.min(team1_score, team2_score), Math.floor(Date.now() / 1000)).run();

        // 2. Award XP & Reputation adjustments
        // Winner rewards
        await awardXP(winnerId, 100, `Matchup Victory (Week ${week})`, db);
        await updateReputation(winnerId, 15, db);

        // Loser reputation reduction
        await updateReputation(loserId, -10, db);
      }

      // Apply lineup checks & Loyalist Bench Heat updates
      await applyBenchHeat(team1_id, week, db);
      await applyBenchHeat(team2_id, week, db);

      updatedCount++;
    }

    return new Response(JSON.stringify({ success: true, processed_matchups: updatedCount }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ success: false, error: e.message || String(e) }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
