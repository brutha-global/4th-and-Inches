import { Env } from "../lib/sportsdata";

// Submit a waiver claim
export async function submitWaiverClaim(
  leagueId: string,
  teamId: string,
  playerId: string,
  dropPlayerId: string | null,
  bidAmount: number,
  db: D1Database
): Promise<Response> {
  try {
    // 1. Verify league and team exist
    const team = await db.prepare("SELECT team_id FROM teams WHERE team_id = ? AND league_id = ?").bind(teamId, leagueId).first<any>();
    if (!team) {
      return new Response(JSON.stringify({ success: false, error: "Team not found in this league" }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
    }

    // 2. Validate player exists
    const player = await db.prepare("SELECT player_id, status FROM players WHERE player_id = ?").bind(playerId).first<any>();
    if (!player) {
      return new Response(JSON.stringify({ success: false, error: "Player not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
    }

    // 3. If dropping a player, verify they are actually on the team's roster
    if (dropPlayerId) {
      const dropRoster = await db.prepare("SELECT roster_id FROM rosters WHERE team_id = ? AND player_id = ? LIMIT 1").bind(teamId, dropPlayerId).first<any>();
      if (!dropRoster) {
        return new Response(JSON.stringify({ success: false, error: "Drop player is not on your roster" }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
      }
    }

    // 4. Check FAAB bid parameters
    if (bidAmount < 0 || bidAmount > 100) {
      return new Response(JSON.stringify({ success: false, error: "FAAB bids must be between $0 and $100" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Check currently spent FAAB
    const spentRow = await db.prepare(`
      SELECT SUM(bid_amount) as spent 
      FROM waivers 
      WHERE team_id = ? AND status = 'Processed'
    `).bind(teamId).first<{ spent: number }>();
    const spent = spentRow?.spent || 0;

    if (spent + bidAmount > 100) {
      return new Response(JSON.stringify({ success: false, error: `Insufficient FAAB budget remaining (Budget: $100, Spent: $${spent}, Requesting: $${bidAmount})` }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    // 5. Query standings to determine waiver priority (worse records have higher priority / smaller index)
    const standingsList = await db.prepare(`
      SELECT team_id FROM standings 
      WHERE league_id = ? 
      ORDER BY wins ASC, points_for ASC
    `).bind(leagueId).all<{ team_id: string }>();

    const teamPriority = standingsList.results.findIndex(s => s.team_id === teamId);
    const priority = teamPriority !== -1 ? teamPriority : 99; // Fallback to lowest priority if no standings record exists yet

    // 6. Insert waiver claim
    const waiver_id = `waiver_${teamId}_${playerId}_${Date.now()}`;
    await db.prepare(`
      INSERT INTO waivers (waiver_id, league_id, team_id, player_id, drop_player_id, priority, bid_amount, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'Pending')
    `).bind(waiver_id, leagueId, teamId, playerId, dropPlayerId, priority, bidAmount).run();

    return new Response(JSON.stringify({ success: true, waiverId: waiver_id }), {
      status: 201,
      headers: { "Content-Type": "application/json" }
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ success: false, error: e.message || String(e) }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}

// Process waivers for all active leagues
export async function processAllLeaguesWaivers(db: D1Database): Promise<{ processed: number; failed: number }> {
  let processedCount = 0;
  let failedCount = 0;

  // Retrieve active leagues
  const leagues = await db.prepare("SELECT league_id, season, week FROM leagues WHERE status = 'Active'").all<any>();

  for (const league of leagues.results) {
    const { league_id, season, week } = league;

    // Get all pending claims sorted by bid amount descending, priority ascending
    const claims = await db.prepare(`
      SELECT * FROM waivers 
      WHERE league_id = ? AND status = 'Pending'
      ORDER BY bid_amount DESC, priority ASC, processed_at ASC
    `).bind(league_id).all<any>();

    for (const claim of claims.results) {
      const { waiver_id, team_id, player_id, drop_player_id, bid_amount } = claim;

      // 1. Verify budget
      const spentRow = await db.prepare(`
        SELECT SUM(bid_amount) as spent 
        FROM waivers 
        WHERE team_id = ? AND status = 'Processed'
      `).bind(team_id).first<{ spent: number }>();
      const spent = spentRow?.spent || 0;

      if (spent + bid_amount > 100) {
        await db.prepare(`
          UPDATE waivers 
          SET status = 'Failed', processed_at = ?, drop_player_id = 'Insufficient FAAB budget' 
          WHERE waiver_id = ?
        `).bind(Math.floor(Date.now() / 1000), waiver_id).run();
        failedCount++;
        continue;
      }

      // 2. Check if player is already rostered by any team in this league
      const rostered = await db.prepare(`
        SELECT r.roster_id FROM rosters r 
        JOIN teams t ON r.team_id = t.team_id 
        WHERE t.league_id = ? AND r.player_id = ? AND r.week = ?
        LIMIT 1
      `).bind(league_id, player_id, week).first<any>();

      if (rostered) {
        await db.prepare(`
          UPDATE waivers 
          SET status = 'Failed', processed_at = ?, drop_player_id = 'Player already rostered' 
          WHERE waiver_id = ?
        `).bind(Math.floor(Date.now() / 1000), waiver_id).run();
        failedCount++;
        continue;
      }

      // 3. Claim approved! Process rosters modifications
      const now = Math.floor(Date.now() / 1000);

      // Perform Drop
      if (drop_player_id) {
        await db.prepare("DELETE FROM rosters WHERE team_id = ? AND player_id = ? AND week = ?").bind(team_id, drop_player_id, week).run();
      }

      // Perform Add (Starts on Bench)
      const roster_id = `ros_${team_id}_${player_id}_${week}`;
      await db.prepare(`
        INSERT INTO rosters (roster_id, team_id, player_id, slot_type, week, is_starter)
        VALUES (?, ?, ?, 'BENCH', ?, 0)
      `).bind(roster_id, team_id, player_id, week).run();

      // Update waiver record status
      await db.prepare(`
        UPDATE waivers 
        SET status = 'Processed', processed_at = ? 
        WHERE waiver_id = ?
      `).bind(now, waiver_id).run();

      // Automatically fail other pending claims in this league for this same player
      await db.prepare(`
        UPDATE waivers 
        SET status = 'Failed', processed_at = ?, drop_player_id = 'Player claimed by another team' 
        WHERE league_id = ? AND player_id = ? AND status = 'Pending'
      `).bind(now, league_id, player_id).run();

      processedCount++;
    }
  }

  return { processed: processedCount, failed: failedCount };
}
