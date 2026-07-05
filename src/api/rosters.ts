import { Env } from "../lib/sportsdata";
import { calculateProjectedScore, DEFAULT_SCORING_CONFIG } from "../lib/scoring";

// Retrieve full team roster along with player projections and injury statuses
export async function getTeamRoster(
  teamId: string,
  week: number,
  db: D1Database
): Promise<Response> {
  try {
    const team = await db.prepare("SELECT * FROM teams WHERE team_id = ?").bind(teamId).first<any>();
    if (!team) {
      return new Response(JSON.stringify({ error: "Team not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
    }

    const { results: rosterSlots } = await db.prepare(`
      SELECT r.slot_type, r.is_starter, p.* 
      FROM rosters r
      JOIN players p ON r.player_id = p.player_id
      WHERE r.team_id = ? AND r.week = ?
    `).bind(teamId, week).all<any>();

    const playersWithProjections = [];
    for (const p of rosterSlots) {
      const projection = await calculateProjectedScore(p.player_id, week, DEFAULT_SCORING_CONFIG, db);
      playersWithProjections.push({
        ...p,
        projected_points: projection
      });
    }

    return new Response(JSON.stringify({ team, week, roster: playersWithProjections }), {
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

// Update starting lineup with validations
export async function updateLineup(
  teamId: string,
  week: number,
  lineupChanges: { player_id: string; slot_type: string; is_starter: boolean }[],
  db: D1Database
): Promise<Response> {
  try {
    // 1. Fetch current rosters entries
    const currentRoster = await db.prepare(`
      SELECT r.roster_id, r.player_id, r.slot_type, r.is_starter, p.name, p.position, p.injury_status, p.status 
      FROM rosters r
      JOIN players p ON r.player_id = p.player_id
      WHERE r.team_id = ? AND r.week = ?
    `).bind(teamId, week).all<any>();

    const rosterMap = new Map(currentRoster.results.map(r => [r.player_id, r]));

    // 2. Validate all changes target existing roster players
    for (const change of lineupChanges) {
      if (!rosterMap.has(change.player_id)) {
        return new Response(JSON.stringify({ success: false, error: `Player ${change.player_id} is not on this team's roster` }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
      }
    }

    // 3. Construct proposed lineup
    const proposedLineup = currentRoster.results.map(p => {
      const change = lineupChanges.find(c => c.player_id === p.player_id);
      if (change) {
        return {
          ...p,
          slot_type: change.slot_type,
          is_starter: change.is_starter ? 1 : 0
        };
      }
      return {
        ...p,
        is_starter: p.slot_type === "BENCH" ? 0 : 1
      };
    });

    // 4. Validate roster slot limits and positions
    // Standard Roster Limits:
    // QB: 1, RB: 2, WR: 2, TE: 1, FLEX: 1, K: 1, DEF: 1
    const slotCounts = { QB: 0, RB: 0, WR: 0, TE: 0, FLEX: 0, K: 0, DEF: 0, BENCH: 0 };
    for (const p of proposedLineup) {
      const slot = p.slot_type as keyof typeof slotCounts;
      if (!(slot in slotCounts)) {
        return new Response(JSON.stringify({ success: false, error: `Invalid slot type: ${p.slot_type}` }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
      }
      slotCounts[slot]++;

      if (p.is_starter === 1) {
        // No starting players allowed if marked "Out"
        const isOut = p.injury_status === "Out" || p.status === "Out";
        if (isOut) {
          return new Response(JSON.stringify({ success: false, error: `Cannot start player ${p.name} who is currently ruled OUT` }), {
            status: 400,
            headers: { "Content-Type": "application/json" }
          });
        }

        // Validate player position aligns with starting slot
        if (p.slot_type === "QB" && p.position !== "QB") {
          return new Response(JSON.stringify({ success: false, error: `Cannot start a non-QB (${p.name}) in the QB slot` }), {
            status: 400,
            headers: { "Content-Type": "application/json" }
          });
        }
        if (p.slot_type === "RB" && p.position !== "RB") {
          return new Response(JSON.stringify({ success: false, error: `Cannot start a non-RB (${p.name}) in the RB slot` }), {
            status: 400,
            headers: { "Content-Type": "application/json" }
          });
        }
        if (p.slot_type === "WR" && p.position !== "WR") {
          return new Response(JSON.stringify({ success: false, error: `Cannot start a non-WR (${p.name}) in the WR slot` }), {
            status: 400,
            headers: { "Content-Type": "application/json" }
          });
        }
        if (p.slot_type === "TE" && p.position !== "TE") {
          return new Response(JSON.stringify({ success: false, error: `Cannot start a non-TE (${p.name}) in the TE slot` }), {
            status: 400,
            headers: { "Content-Type": "application/json" }
          });
        }
        if (p.slot_type === "FLEX" && !["RB", "WR", "TE"].includes(p.position)) {
          return new Response(JSON.stringify({ success: false, error: `FLEX slot must be RB, WR, or TE (Player ${p.name} is ${p.position})` }), {
            status: 400,
            headers: { "Content-Type": "application/json" }
          });
        }
        if (p.slot_type === "K" && p.position !== "K") {
          return new Response(JSON.stringify({ success: false, error: `Cannot start a non-K (${p.name}) in the K slot` }), {
            status: 400,
            headers: { "Content-Type": "application/json" }
          });
        }
        if (p.slot_type === "DEF" && !["DEF", "DST"].includes(p.position)) {
          return new Response(JSON.stringify({ success: false, error: `DEF slot requires a DEF/DST position (Player ${p.name} is ${p.position})` }), {
            status: 400,
            headers: { "Content-Type": "application/json" }
          });
        }
      }
    }

    if (slotCounts.QB > 1 || slotCounts.RB > 2 || slotCounts.WR > 2 || slotCounts.TE > 1 || slotCounts.FLEX > 1 || slotCounts.K > 1 || slotCounts.DEF > 1) {
      return new Response(JSON.stringify({ success: false, error: "Proposed starting lineup exceeds standard position counts (1 QB, 2 RB, 2 WR, 1 TE, 1 FLEX, 1 K, 1 DEF)" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    // 5. Update lineup in SQLite database
    for (const change of proposedLineup) {
      await db.prepare(`
        UPDATE rosters 
        SET slot_type = ?, is_starter = ? 
        WHERE team_id = ? AND player_id = ? AND week = ?
      `).bind(change.slot_type, change.is_starter, teamId, change.player_id, week).run();
    }

    return new Response(JSON.stringify({ success: true, message: "Lineup updated successfully" }), {
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

// Initiate or process a H2H trade proposal between teams
export async function proposeTrade(
  leagueId: string,
  proposingTeamId: string,
  receivingTeamId: string,
  givePlayerIds: string[],
  receivePlayerIds: string[],
  db: D1Database
): Promise<Response> {
  try {
    // 1. Verify teams exist
    const team1 = await db.prepare("SELECT team_id FROM teams WHERE team_id = ? AND league_id = ?").bind(proposingTeamId, leagueId).first<any>();
    const team2 = await db.prepare("SELECT team_id FROM teams WHERE team_id = ? AND league_id = ?").bind(receivingTeamId, leagueId).first<any>();

    if (!team1 || !team2) {
      return new Response(JSON.stringify({ error: "One or both teams not found in this league" }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
    }

    // 2. Validate players exist on their respective roster teams
    for (const pid of givePlayerIds) {
      const r = await db.prepare("SELECT roster_id FROM rosters WHERE team_id = ? AND player_id = ? LIMIT 1").bind(proposingTeamId, pid).first<any>();
      if (!r) {
        return new Response(JSON.stringify({ error: `Player ${pid} not rostered by proposing team` }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
      }
    }

    for (const pid of receivePlayerIds) {
      const r = await db.prepare("SELECT roster_id FROM rosters WHERE team_id = ? AND player_id = ? LIMIT 1").bind(receivingTeamId, pid).first<any>();
      if (!r) {
        return new Response(JSON.stringify({ error: `Player ${pid} not rostered by receiving team` }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
      }
    }

    // 3. Execute the Trade (Mock instant execution, or write trade status log)
    // For V1 platform testing, we execute the trade swaps instantly to verify database writes!
    // We swap all rosters team IDs for players in this transaction.
    const weekRow = await db.prepare("SELECT week FROM leagues WHERE league_id = ?").bind(leagueId).first<{ week: number }>();
    const week = weekRow?.week || 1;

    for (const pid of givePlayerIds) {
      await db.prepare("UPDATE rosters SET team_id = ?, slot_type = 'BENCH', is_starter = 0 WHERE player_id = ? AND week = ?").bind(receivingTeamId, pid, week).run();
    }
    for (const pid of receivePlayerIds) {
      await db.prepare("UPDATE rosters SET team_id = ?, slot_type = 'BENCH', is_starter = 0 WHERE player_id = ? AND week = ?").bind(proposingTeamId, pid, week).run();
    }

    return new Response(JSON.stringify({ success: true, message: "Trade executed successfully" }), {
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
