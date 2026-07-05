import { Env } from "../lib/sportsdata";

// Helper to hash query inputs for cache lookup
function getHash(feature: string, inputs: any): string {
  const str = feature + "_" + JSON.stringify(inputs);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0; // Convert to 32bit integer
  }
  return "h_" + Math.abs(hash);
}

// Check cache
async function getCachedResponse(hash: string, db: D1Database): Promise<any | null> {
  const row = await db.prepare("SELECT response, cached_at FROM ai_response_cache WHERE hash = ?").bind(hash).first<{ response: string; cached_at: number }>();
  if (row) {
    const age = Math.floor(Date.now() / 1000) - row.cached_at;
    if (age < 3600) { // 1 hour TTL
      return JSON.parse(row.response);
    }
  }
  return null;
}

// Save response to cache
async function setCachedResponse(hash: string, response: any, db: D1Database): Promise<void> {
  const responseStr = JSON.stringify(response);
  const now = Math.floor(Date.now() / 1000);
  await db.prepare(`
    INSERT INTO ai_response_cache (hash, response, cached_at)
    VALUES (?, ?, ?)
    ON CONFLICT(hash) DO UPDATE SET response = excluded.response, cached_at = excluded.cached_at
  `).bind(hash, responseStr, now).run();
}

// Log token analytics
async function logAIUsage(feature: string, tokensIn: number, tokensOut: number, db: D1Database): Promise<void> {
  const cost = tokensIn * 0.000005 + tokensOut * 0.000015; // GPT-4o estimate rate
  const id = `usage_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const now = Math.floor(Date.now() / 1000);
  try {
    await db.prepare(`
      INSERT INTO ai_usage (id, feature, tokens_in, tokens_out, cost_estimate, timestamp)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(id, feature, tokensIn, tokensOut, cost, now).run();
  } catch (err) {
    console.error("AI usage logging failed", err);
  }
}

// Fetch helper targeting Azure AI Foundry API
async function callAzureAI(
  systemPrompt: string,
  userPrompt: string,
  env: Env
): Promise<{ text: string; tokensIn: number; tokensOut: number }> {
  const endpoint = env.AZURE_AI_ENDPOINT;
  const key = env.AZURE_AI_KEY;

  if (!endpoint || !key) {
    throw new Error("Azure AI credentials not set");
  }

  // Format completions endpoint
  const url = `${endpoint}/chat/completions?api-version=2024-02-15-preview`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout limit

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": key
      },
      body: JSON.stringify({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        model: "gpt-4o",
        temperature: 0.2
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`Azure HTTP error status: ${res.status}`);
    }

    const payload: any = await res.json();
    const text = payload?.choices?.[0]?.message?.content || "";
    const tokensIn = payload?.usage?.prompt_tokens || 0;
    const tokensOut = payload?.usage?.completion_tokens || 0;

    return { text, tokensIn, tokensOut };
  } catch (err: any) {
    clearTimeout(timeoutId);
    throw err;
  }
}

// --- Feature 1: Lineup Optimizer ---
export async function optimizeLineup(
  teamId: string,
  week: number,
  db: D1Database,
  env: Env
): Promise<any> {
  const cacheHash = getHash("optimize", { teamId, week });
  const cached = await getCachedResponse(cacheHash, db);
  if (cached) return cached;

  // Retrieve players roster
  const { results: roster } = await db.prepare(`
    SELECT p.player_id, p.name, p.position, p.injury_status, p.team
    FROM rosters r
    JOIN players p ON r.player_id = p.player_id
    WHERE r.team_id = ? AND r.week = ?
  `).bind(teamId, week).all<any>();

  // Fallback data preparation (4-week averages)
  const rosterWithAvg = [];
  for (const p of roster) {
    const stats = await db.prepare(`
      SELECT AVG(fantasy_points) as avg_pts FROM player_stats 
      WHERE player_id = ? AND week < ?
    `).bind(p.player_id, week).first<{ avg_pts: number | null }>();
    rosterWithAvg.push({
      ...p,
      avg_pts: stats?.avg_pts || 8.0
    });
  }

  // Fallback: sort by 4-week average points
  const fallbackResult = {
    lineup: rosterWithAvg.sort((a, b) => b.avg_pts - a.avg_pts).map(p => ({
      player_id: p.player_id,
      name: p.name,
      position: p.position,
      recommended_slot: p.position === "QB" ? "QB" : "BENCH"
    })),
    reasoning: rosterWithAvg.reduce((acc, p) => {
      acc[p.player_id] = `Recommended based on 4-week average points of ${p.avg_pts.toFixed(1)}`;
      return acc;
    }, {} as any),
    confidence: 70
  };

  try {
    const system = "You are an expert fantasy football AI Coach. Suggest the optimal starter lineup based on players provided. Format response as JSON containing: { lineup: [{player_id, recommended_slot}], reasoning: {[player_id]: string}, confidence: number }";
    const user = JSON.stringify(rosterWithAvg);
    const ai = await callAzureAI(system, user, env);

    const parsed = JSON.parse(ai.text);
    await setCachedResponse(cacheHash, parsed, db);
    await logAIUsage("optimize", ai.tokensIn, ai.tokensOut, db);
    return parsed;
  } catch (e) {
    console.error("AI lineup optimizer failed, serving rule-based fallback", e);
    return fallbackResult;
  }
}

// --- Feature 2: Trade Analyzer ---
export async function analyzeTrade(
  givePlayerIds: string[],
  receivePlayerIds: string[],
  teamId: string,
  leagueId: string,
  db: D1Database,
  env: Env
): Promise<any> {
  const cacheHash = getHash("trade", { givePlayerIds, receivePlayerIds, teamId });
  const cached = await getCachedResponse(cacheHash, db);
  if (cached) return cached;

  // Retrieve player records to compute 4-week averages
  const getPlayersValue = async (ids: string[]) => {
    let sum = 0;
    const details = [];
    for (const id of ids) {
      const p = await db.prepare("SELECT name, position FROM players WHERE player_id = ?").bind(id).first<any>();
      const stats = await db.prepare("SELECT AVG(fantasy_points) as avg_pts FROM player_stats WHERE player_id = ?").bind(id).first<{ avg_pts: number | null }>();
      const avg = stats?.avg_pts || 8.0;
      sum += avg;
      details.push({ id, name: p?.name || id, position: p?.position || "RB", avg });
    }
    return { sum, details };
  };

  const giveVal = await getPlayersValue(givePlayerIds);
  const recVal = await getPlayersValue(receivePlayerIds);

  const verdict = recVal.sum >= giveVal.sum ? "accept" : "decline";
  const fallbackResult = {
    verdict,
    analysis: `Rule-based analysis: Giving up players worth ${giveVal.sum.toFixed(1)} avg points, receiving players worth ${recVal.sum.toFixed(1)} avg points. Recommend ${verdict.toUpperCase()}.`,
    give_value: parseFloat(giveVal.sum.toFixed(1)),
    receive_value: parseFloat(recVal.sum.toFixed(1)),
    counter_suggestion: verdict === "decline" ? "Ask for an additional bench player to balance the trade value difference." : undefined
  };

  try {
    const system = "You are a fantasy trade analyzer. Review the trade details. Output JSON: { verdict: 'accept'|'decline'|'counter', analysis: 'max 150 words', give_value: number, receive_value: number, counter_suggestion?: string }";
    const user = JSON.stringify({ give: giveVal.details, receive: recVal.details });
    const ai = await callAzureAI(system, user, env);

    const parsed = JSON.parse(ai.text);
    await setCachedResponse(cacheHash, parsed, db);
    await logAIUsage("trade", ai.tokensIn, ai.tokensOut, db);
    return parsed;
  } catch (e) {
    console.error("AI trade analyzer failed, serving rule-based fallback", e);
    return fallbackResult;
  }
}

// --- Feature 3: Waiver Assistant ---
export async function suggestWaivers(
  teamId: string,
  week: number,
  faabBudget: number,
  db: D1Database,
  env: Env
): Promise<any> {
  const cacheHash = getHash("waivers", { teamId, week, faabBudget });
  const cached = await getCachedResponse(cacheHash, db);
  if (cached) return cached;

  // Retrieve unrostered top players
  const { results: topFreeAgents } = await db.prepare(`
    SELECT p.player_id, p.name, p.position, p.team 
    FROM players p
    WHERE p.player_id NOT IN (SELECT player_id FROM rosters WHERE week = ?)
    LIMIT 10
  `).bind(week).all<any>();

  const freeAgentsWithVal = [];
  for (const fa of topFreeAgents) {
    const stats = await db.prepare("SELECT AVG(fantasy_points) as avg_pts FROM player_stats WHERE player_id = ?").bind(fa.player_id).first<{ avg_pts: number | null }>();
    freeAgentsWithVal.push({
      ...fa,
      avg_pts: stats?.avg_pts || 6.5
    });
  }

  const sortedFA = freeAgentsWithVal.sort((a, b) => b.avg_pts - a.avg_pts).slice(0, 3);
  const fallbackResult = {
    suggestions: sortedFA.map(fa => ({
      player_id: fa.player_id,
      name: fa.name,
      reasoning: `Highly rated free agent scoring ${fa.avg_pts.toFixed(1)} points on average.`,
      recommended_bid: 10
    }))
  };

  try {
    const system = "You are a fantasy waiver wire advisor. Analyze free agents. Output JSON: { suggestions: [{player_id, name, reasoning, recommended_bid}] }";
    const user = JSON.stringify({ freeAgents: sortedFA, faabBudget });
    const ai = await callAzureAI(system, user, env);

    const parsed = JSON.parse(ai.text);
    await setCachedResponse(cacheHash, parsed, db);
    await logAIUsage("waivers", ai.tokensIn, ai.tokensOut, db);
    return parsed;
  } catch (e) {
    console.error("AI waivers analyst failed, serving rule-based fallback", e);
    return fallbackResult;
  }
}

// --- Feature 4: Weekly Recap ---
export async function generateWeeklyRecap(
  teamId: string,
  week: number,
  db: D1Database,
  env: Env
): Promise<any> {
  const cacheHash = getHash("recap", { teamId, week });
  const cached = await getCachedResponse(cacheHash, db);
  if (cached) return cached;

  const team = await db.prepare("SELECT name FROM teams WHERE team_id = ?").bind(teamId).first<{ name: string }>();
  const name = team?.name || "Your Team";

  const fallbackResult = {
    recap: `Weekly Recap: ${name} played hard in Week ${week}. Roster contributions met projections, paving the way for coaching improvements next week. Keep setting lineups and chasing XP!`,
    grade: "B"
  };

  try {
    const system = "You are a witty, sports broadcaster style weekly recap generator. Output JSON: { recap: 'max 200 words text', grade: 'A'|'B'|'C'|'D'|'F' }";
    const user = `Team name: ${name}, Week: ${week}`;
    const ai = await callAzureAI(system, user, env);

    const parsed = JSON.parse(ai.text);
    await setCachedResponse(cacheHash, parsed, db);
    await logAIUsage("recap", ai.tokensIn, ai.tokensOut, db);
    return parsed;
  } catch (e) {
    console.error("AI recap failed, serving rule-based fallback", e);
    return fallbackResult;
  }
}

// --- Feature 5: Injury Forecast ---
export async function forecastInjury(
  playerId: string,
  db: D1Database,
  env: Env
): Promise<any> {
  const cacheHash = getHash("injury", { playerId });
  const cached = await getCachedResponse(cacheHash, db);
  if (cached) return cached;

  const p = await db.prepare("SELECT name, injury_status, status FROM players WHERE player_id = ?").bind(playerId).first<{ name: string; injury_status: string; status: string }>();
  if (!p) {
    return { likelihood_to_play: 100, confidence: "high", reasoning: "Player not found, assuming healthy status." };
  }

  const stat = p.injury_status || p.status || "";
  let likelihood = 100;
  let confidence = "high";
  let reasoning = "Player is healthy and active.";

  if (stat.includes("Out")) {
    likelihood = 0;
    reasoning = "Player has been ruled OUT for the game.";
  } else if (stat.includes("Doubtful")) {
    likelihood = 25;
    confidence = "medium";
    reasoning = "Player is doubtful to play.";
  } else if (stat.includes("Questionable")) {
    likelihood = 50;
    confidence = "medium";
    reasoning = "Player is questionable and will likely be a game-time decision.";
  }

  const fallbackResult = { likelihood_to_play: likelihood, confidence, reasoning };

  try {
    const system = "You are a sports injury forecasting analyst. Output JSON: { likelihood_to_play: number, confidence: 'low'|'medium'|'high', reasoning: string }";
    const user = JSON.stringify(p);
    const ai = await callAzureAI(system, user, env);

    const parsed = JSON.parse(ai.text);
    await setCachedResponse(cacheHash, parsed, db);
    await logAIUsage("injury", ai.tokensIn, ai.tokensOut, db);
    return parsed;
  } catch (e) {
    console.error("AI injury forecast failed, serving rule-based fallback", e);
    return fallbackResult;
  }
}
