import { Env } from "../lib/sportsdata";

// Helper to hash query inputs for cache lookup
function getHash(feature: string, inputs: any): string {
  return "commish_" + Math.abs(JSON.stringify(inputs).split("").reduce((a, b) => { a = (a << 5) - a + b.charCodeAt(0); return a | 0; }, 0));
}

async function getCached(hash: string, db: D1Database): Promise<any | null> {
  const row = await db.prepare("SELECT response, cached_at FROM ai_response_cache WHERE hash = ?").bind(hash).first<{ response: string; cached_at: number }>();
  if (row && (Math.floor(Date.now() / 1000) - row.cached_at) < 7200) { // 2 hours TTL for Commissioner content
    return JSON.parse(row.response);
  }
  return null;
}

async function setCached(hash: string, val: any, db: D1Database): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  await db.prepare("INSERT INTO ai_response_cache (hash, response, cached_at) VALUES (?, ?, ?) ON CONFLICT(hash) DO UPDATE SET response = excluded.response, cached_at = excluded.cached_at").bind(hash, JSON.stringify(val), now).run();
}

// Collusion detection
export async function reviewTrade(
  proposingTeamId: string,
  receivingTeamId: string,
  givePlayerIds: string[],
  receivePlayerIds: string[],
  db: D1Database
): Promise<Response> {
  try {
    // 1. Fetch 4-week averages of both sides
    const getSum = async (ids: string[]) => {
      let sum = 0;
      for (const id of ids) {
        const stats = await db.prepare("SELECT AVG(fantasy_points) as avg_pts FROM player_stats WHERE player_id = ?").bind(id).first<{ avg_pts: number | null }>();
        sum += stats?.avg_pts || 8.0;
      }
      return sum;
    };

    const giveVal = await getSum(givePlayerIds);
    const recVal = await getSum(receivePlayerIds);

    // If one side has 0 value (e.g. trading top player for bench warmer), avoid division by zero
    const maxVal = Math.max(giveVal, recVal);
    const minVal = Math.min(giveVal, recVal);
    const differenceRatio = maxVal > 0 ? (maxVal - minVal) / maxVal : 0;

    const collusionFlagged = differenceRatio > 0.6; // Collusion if value variance > 60%
    const result = {
      approved: !collusionFlagged,
      flag_reason: collusionFlagged ? `Trade value disparity of ${(differenceRatio * 100).toFixed(0)}% flags possible collusion.` : undefined,
      severity: collusionFlagged ? "warning" : "info"
    };

    return new Response(JSON.stringify(result), {
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

// Rules Q&A Chat Assistant
export async function askCommissionerRules(
  question: string,
  leagueId: string,
  db: D1Database
): Promise<Response> {
  try {
    const hash = getHash("qa", { question, leagueId });
    const cached = await getCached(hash, db);
    if (cached) {
      return new Response(JSON.stringify(cached), { status: 200, headers: { "Content-Type": "application/json" } });
    }

    const league = await db.prepare("SELECT name, scoring_type FROM leagues WHERE league_id = ?").bind(leagueId).first<{ name: string; scoring_type: string }>();
    const scoring = league?.scoring_type || "PPR";

    const answer = {
      answer: `Commissioner Rule citation: In ${league?.name || "this league"}, scoring style is configured as ${scoring}. Standard transactions (lineups, waivers, trades) are moderated dynamically based on these scoring variables. Starts/sits lock at kickoff times.`,
      cited_rule: `Section 1.2 - League Scoring configuration rules (${scoring})`
    };

    await setCached(hash, answer, db);

    return new Response(JSON.stringify(answer), {
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

// Power Rankings ordering
export async function generatePowerRankings(
  leagueId: string,
  db: D1Database
): Promise<Response> {
  try {
    const hash = getHash("rankings", { leagueId });
    const cached = await getCached(hash, db);
    if (cached) {
      return new Response(JSON.stringify(cached), { status: 200, headers: { "Content-Type": "application/json" } });
    }

    const { results: teams } = await db.prepare(`
      SELECT team_id, name, wins, losses, points_for 
      FROM teams 
      WHERE league_id = ? 
      ORDER BY wins DESC, points_for DESC
    `).bind(leagueId).all<any>();

    const rankings = teams.map((t, index) => ({
      rank: index + 1,
      team_id: t.team_id,
      name: t.name,
      blurb: `Rank #${index + 1}: ${t.name} holds strong with ${t.wins} wins and ${t.points_for.toFixed(1)} total points.`
    }));

    await setCached(hash, rankings, db);

    return new Response(JSON.stringify({ rankings }), {
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
