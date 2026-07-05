export interface Env {
  DB: D1Database;
  SPORTSDATA_API_KEY?: string;
  LEAGUE_ROOM: DurableObjectNamespace;
  DRAFT_ROOM: DurableObjectNamespace;
  AI_CONTENT_CACHE?: R2Bucket;
  AZURE_AI_ENDPOINT?: string;
  AZURE_AI_KEY?: string;
}

// --- SportsDataIO API Interface Definitions ---

export interface SportsDataPlayer {
  PlayerID: number;
  Name?: string;
  FirstName?: string;
  LastName?: string;
  Position?: string;
  Team?: string;
  Status?: string;
  InjuryStatus?: string;
  DepthPosition?: string;
  PhotoUrl?: string;
}

export interface SportsDataGame {
  GameKey?: string;
  ScoreID?: number;
  GameID?: number;
  Week: number;
  Season: number;
  HomeTeam: string;
  AwayTeam: string;
  Status: string;
  HomeScore: number | null;
  AwayScore: number | null;
  Quarter: string | null;
  TimeRemaining: string | null;
}

export interface SportsDataPlayerStat {
  PlayerID: number;
  GameKey?: string;
  GameID?: number;
  Week: number;
  Season: number;
  PassingYards: number;
  PassingTouchdowns: number;
  RushingYards: number;
  RushingTouchdowns: number;
  ReceivingYards: number;
  ReceivingTouchdowns: number;
  Receptions: number;
  ReceivingTargets: number;
  Fumbles: number;
  PassingInterceptions: number;
  FantasyPoints: number;
}

export interface SportsDataInjury {
  InjuryID?: number;
  PlayerID: number;
  Team: string;
  Position: string;
  FirstName?: string;
  LastName?: string;
  Injury: string;
  Status: string;
  PracticeStatus: string;
}

export interface SportsDataDepthChartEntry {
  PlayerID: number;
  Name?: string;
  Position?: string;
  DepthOrder?: number;
  PositionCategory?: string;
}

export interface SportsDataTeamDepthCharts {
  Team: string;
  DepthCharts: SportsDataDepthChartEntry[];
}

// --- Database Roster Schema Interfaces ---

export interface DbPlayer {
  player_id: string;
  name: string;
  position: string | null;
  team: string | null;
  status: string | null;
  injury_status: string | null;
  depth_chart_position: string | null;
  headshot_url: string | null;
  updated_at: number;
}

export interface DbGame {
  game_id: string;
  week: number;
  season: number;
  home_team: string;
  away_team: string;
  status: string;
  home_score: number | null;
  away_score: number | null;
  quarter: string | null;
  time_remaining: string | null;
  updated_at: number;
}

export interface DbPlayerStat {
  stat_id: string;
  player_id: string;
  game_id: string;
  week: number;
  season: number;
  pass_yards: number;
  pass_tds: number;
  rush_yards: number;
  rush_tds: number;
  rec_yards: number;
  rec_tds: number;
  receptions: number;
  targets: number;
  fumbles: number;
  interceptions: number;
  fantasy_points: number;
  updated_at: number;
}

export interface DbInjury {
  injury_id: string;
  player_id: string;
  game_id: string | null;
  injury_type: string | null;
  status: string | null;
  practice_status: string | null;
  updated_at: number;
}

export interface DbDepthChart {
  depth_id: string;
  player_id: string;
  team: string;
  position: string;
  depth_order: number;
  updated_at: number;
}

// --- Cache & Request Helpers ---

const BASE_URL = "https://api.sportsdata.io/v3/nfl";

function getApiKey(env: Env): string {
  return env.SPORTSDATA_API_KEY || "ee36220d6dbc4fcbb4184020f38cffdc";
}

async function fetchWithRetry(url: string, retries = 5): Promise<Response> {
  let delay = 1000;
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return response;
      }
      if (response.status >= 500 && i < retries - 1) {
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay = Math.min(delay * 2, 30000);
        continue;
      }
      throw new Error(`HTTP error status: ${response.status}`);
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise((resolve) => setTimeout(resolve, delay));
      delay = Math.min(delay * 2, 30000);
    }
  }
  throw new Error("Fetch failed after all retries");
}

async function checkCache(env: Env, entityKey: string, ttlSeconds: number): Promise<boolean> {
  try {
    const row = await env.DB.prepare(
      "SELECT synced_at FROM sync_log WHERE entity = ? AND error IS NULL ORDER BY synced_at DESC LIMIT 1"
    ).bind(entityKey).first<{ synced_at: number }>();
    if (!row) return false;
    const now = Math.floor(Date.now() / 1000);
    return (now - row.synced_at) < ttlSeconds;
  } catch (e) {
    console.error("Cache check failed for entity: " + entityKey, e);
    return false;
  }
}

async function writeSyncLog(env: Env, entityKey: string, count: number, error: string | null = null): Promise<void> {
  const id = `${entityKey}_${Date.now()}`;
  const now = Math.floor(Date.now() / 1000);
  await env.DB.prepare(
    "INSERT INTO sync_log (id, entity, synced_at, record_count, error) VALUES (?, ?, ?, ?, ?)"
  ).bind(id, entityKey, now, count, error).run();
}

// --- API Fetching and Syncing Functions ---

export async function fetchPlayers(env: Env, season: number): Promise<DbPlayer[]> {
  const entityKey = `players_${season}`;
  const isCached = await checkCache(env, entityKey, 86400); // 24 hours TTL

  if (isCached) {
    console.log(`Cache HIT for ${entityKey}. Retrieving from D1...`);
    const { results } = await env.DB.prepare("SELECT * FROM players").all<DbPlayer>();
    return results;
  }

  console.log(`Cache MISS for ${entityKey}. Fetching from SportsDataIO...`);
  const apiKey = getApiKey(env);
  const url = `${BASE_URL}/scores/json/Players?key=${apiKey}`;
  
  try {
    const response = await fetchWithRetry(url);
    const apiPlayers = await response.json<SportsDataPlayer[]>();
    const now = Math.floor(Date.now() / 1000);

    const dbPlayers: DbPlayer[] = apiPlayers.map((p) => {
      const name = p.Name || `${p.FirstName || ""} ${p.LastName || ""}`.trim() || "Unknown Player";
      return {
        player_id: String(p.PlayerID),
        name,
        position: p.Position || null,
        team: p.Team || null,
        status: p.Status || null,
        injury_status: p.InjuryStatus || null,
        depth_chart_position: p.DepthPosition || null,
        headshot_url: p.PhotoUrl || null,
        updated_at: now,
      };
    });

    // Chunk upserts in batches of 100 to optimize D1 limits
    const chunkSize = 100;
    for (let i = 0; i < dbPlayers.length; i += chunkSize) {
      const chunk = dbPlayers.slice(i, i + chunkSize);
      const statements = chunk.map((p) =>
        env.DB.prepare(`
          INSERT INTO players (player_id, name, position, team, status, injury_status, depth_chart_position, headshot_url, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(player_id) DO UPDATE SET
            name = excluded.name,
            position = excluded.position,
            team = excluded.team,
            status = excluded.status,
            injury_status = excluded.injury_status,
            depth_chart_position = excluded.depth_chart_position,
            headshot_url = excluded.headshot_url,
            updated_at = excluded.updated_at
        `).bind(
          p.player_id,
          p.name,
          p.position,
          p.team,
          p.status,
          p.injury_status,
          p.depth_chart_position,
          p.headshot_url,
          p.updated_at
        )
      );
      await env.DB.batch(statements);
    }

    await writeSyncLog(env, entityKey, dbPlayers.length);
    return dbPlayers;
  } catch (error: any) {
    await writeSyncLog(env, entityKey, 0, error.message || String(error));
    throw error;
  }
}

export async function fetchWeeklyScoreboard(env: Env, season: number, week: number): Promise<DbGame[]> {
  const entityKey = `scoreboard_${season}_${week}`;
  const isCached = await checkCache(env, entityKey, 60); // 60 seconds TTL

  if (isCached) {
    console.log(`Cache HIT for ${entityKey}. Retrieving from D1...`);
    const { results } = await env.DB.prepare("SELECT * FROM games WHERE season = ? AND week = ?").bind(season, week).all<DbGame>();
    return results;
  }

  console.log(`Cache MISS for ${entityKey}. Fetching from SportsDataIO...`);
  const apiKey = getApiKey(env);
  const url = `${BASE_URL}/scores/json/ScoresByWeek/${season}/${week}?key=${apiKey}`;

  try {
    const response = await fetchWithRetry(url);
    const apiGames = await response.json<SportsDataGame[]>();
    const now = Math.floor(Date.now() / 1000);

    const dbGames: DbGame[] = apiGames.map((g) => ({
      game_id: String(g.GameKey || g.ScoreID || g.GameID),
      week: g.Week,
      season: g.Season,
      home_team: g.HomeTeam,
      away_team: g.AwayTeam,
      status: g.Status,
      home_score: g.HomeScore,
      away_score: g.AwayScore,
      quarter: g.Quarter,
      time_remaining: g.TimeRemaining,
      updated_at: now,
    }));

    if (dbGames.length > 0) {
      const statements = dbGames.map((g) =>
        env.DB.prepare(`
          INSERT INTO games (game_id, week, season, home_team, away_team, status, home_score, away_score, quarter, time_remaining, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(game_id) DO UPDATE SET
            status = excluded.status,
            home_score = excluded.home_score,
            away_score = excluded.away_score,
            quarter = excluded.quarter,
            time_remaining = excluded.time_remaining,
            updated_at = excluded.updated_at
        `).bind(
          g.game_id,
          g.week,
          g.season,
          g.home_team,
          g.away_team,
          g.status,
          g.home_score,
          g.away_score,
          g.quarter,
          g.time_remaining,
          g.updated_at
        )
      );
      await env.DB.batch(statements);
    }

    await writeSyncLog(env, entityKey, dbGames.length);
    return dbGames;
  } catch (error: any) {
    await writeSyncLog(env, entityKey, 0, error.message || String(error));
    throw error;
  }
}

export async function fetchPlayerGameStats(env: Env, season: number, week: number): Promise<DbPlayerStat[]> {
  const entityKey = `player_stats_${season}_${week}`;
  const isCached = await checkCache(env, entityKey, 60); // 60 seconds TTL

  if (isCached) {
    console.log(`Cache HIT for ${entityKey}. Retrieving from D1...`);
    const { results } = await env.DB.prepare("SELECT * FROM player_stats WHERE season = ? AND week = ?").bind(season, week).all<DbPlayerStat>();
    return results;
  }

  console.log(`Cache MISS for ${entityKey}. Fetching from SportsDataIO...`);
  const apiKey = getApiKey(env);
  const url = `${BASE_URL}/stats/json/PlayerGameStatsByWeek/${season}/${week}?key=${apiKey}`;

  try {
    const response = await fetchWithRetry(url);
    const apiStats = await response.json<SportsDataPlayerStat[]>();
    const now = Math.floor(Date.now() / 1000);

    const dbStats: DbPlayerStat[] = apiStats.map((s) => ({
      stat_id: `${s.PlayerID}_${s.GameKey || s.GameID}`,
      player_id: String(s.PlayerID),
      game_id: String(s.GameKey || s.GameID),
      week: s.Week,
      season: s.Season,
      pass_yards: s.PassingYards || 0.0,
      pass_tds: s.PassingTouchdowns || 0,
      rush_yards: s.RushingYards || 0.0,
      rush_tds: s.RushingTouchdowns || 0,
      rec_yards: s.ReceivingYards || 0.0,
      rec_tds: s.ReceivingTouchdowns || 0,
      receptions: s.Receptions || 0,
      targets: s.ReceivingTargets || 0,
      fumbles: s.Fumbles || 0,
      interceptions: s.PassingInterceptions || 0,
      fantasy_points: s.FantasyPoints || 0.0,
      updated_at: now,
    }));

    const chunkSize = 100;
    for (let i = 0; i < dbStats.length; i += chunkSize) {
      const chunk = dbStats.slice(i, i + chunkSize);
      const statements = chunk.map((s) =>
        env.DB.prepare(`
          INSERT INTO player_stats (stat_id, player_id, game_id, week, season, pass_yards, pass_tds, rush_yards, rush_tds, rec_yards, rec_tds, receptions, targets, fumbles, interceptions, fantasy_points, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(stat_id) DO UPDATE SET
            pass_yards = excluded.pass_yards,
            pass_tds = excluded.pass_tds,
            rush_yards = excluded.rush_yards,
            rush_tds = excluded.rush_tds,
            rec_yards = excluded.rec_yards,
            rec_tds = excluded.rec_tds,
            receptions = excluded.receptions,
            targets = excluded.targets,
            fumbles = excluded.fumbles,
            interceptions = excluded.interceptions,
            fantasy_points = excluded.fantasy_points,
            updated_at = excluded.updated_at
        `).bind(
          s.stat_id,
          s.player_id,
          s.game_id,
          s.week,
          s.season,
          s.pass_yards,
          s.pass_tds,
          s.rush_yards,
          s.rush_tds,
          s.rec_yards,
          s.rec_tds,
          s.receptions,
          s.targets,
          s.fumbles,
          s.interceptions,
          s.fantasy_points,
          s.updated_at
        )
      );
      await env.DB.batch(statements);
    }

    await writeSyncLog(env, entityKey, dbStats.length);
    return dbStats;
  } catch (error: any) {
    await writeSyncLog(env, entityKey, 0, error.message || String(error));
    throw error;
  }
}

export async function fetchInjuries(env: Env, season: number, week: number): Promise<DbInjury[]> {
  const entityKey = `injuries_${season}_${week}`;
  const isCached = await checkCache(env, entityKey, 60); // 60 seconds TTL

  if (isCached) {
    console.log(`Cache HIT for ${entityKey}. Retrieving from D1...`);
    const { results } = await env.DB.prepare(`
      SELECT i.* FROM injuries i 
      JOIN games g ON i.game_id = g.game_id 
      WHERE g.season = ? AND g.week = ?
    `).bind(season, week).all<DbInjury>();
    return results;
  }

  console.log(`Cache MISS for ${entityKey}. Fetching from SportsDataIO...`);
  const apiKey = getApiKey(env);
  const url = `${BASE_URL}/stats/json/Injuries/${season}/${week}?key=${apiKey}`;

  try {
    const response = await fetchWithRetry(url);
    const apiInjuries = await response.json<SportsDataInjury[]>();
    const now = Math.floor(Date.now() / 1000);

    // Resolve games mapped to teams to associate injuries with games
    const { results: games } = await env.DB.prepare("SELECT game_id, home_team, away_team FROM games WHERE season = ? AND week = ?").bind(season, week).all<{ game_id: string; home_team: string; away_team: string }>();
    const teamToGameMap = new Map<string, string>();
    for (const g of games) {
      teamToGameMap.set(g.home_team, g.game_id);
      teamToGameMap.set(g.away_team, g.game_id);
    }

    const dbInjuries: DbInjury[] = apiInjuries.map((inj, index) => {
      const resolvedGameId = teamToGameMap.get(inj.Team) || null;
      // Synthesize unique injury id if not present
      const injury_id = inj.InjuryID ? String(inj.InjuryID) : `${inj.PlayerID}_${resolvedGameId || "unknown"}_${index}`;
      return {
        injury_id,
        player_id: String(inj.PlayerID),
        game_id: resolvedGameId,
        injury_type: inj.Injury || null,
        status: inj.Status || null,
        practice_status: inj.PracticeStatus || null,
        updated_at: now,
      };
    });

    const chunkSize = 100;
    for (let i = 0; i < dbInjuries.length; i += chunkSize) {
      const chunk = dbInjuries.slice(i, i + chunkSize);
      const statements = chunk.map((inj) =>
        env.DB.prepare(`
          INSERT INTO injuries (injury_id, player_id, game_id, injury_type, status, practice_status, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(injury_id) DO UPDATE SET
            game_id = excluded.game_id,
            injury_type = excluded.injury_type,
            status = excluded.status,
            practice_status = excluded.practice_status,
            updated_at = excluded.updated_at
        `).bind(
          inj.injury_id,
          inj.player_id,
          inj.game_id,
          inj.injury_type,
          inj.status,
          inj.practice_status,
          inj.updated_at
        )
      );
      await env.DB.batch(statements);
    }

    await writeSyncLog(env, entityKey, dbInjuries.length);
    return dbInjuries;
  } catch (error: any) {
    await writeSyncLog(env, entityKey, 0, error.message || String(error));
    throw error;
  }
}

export async function fetchDepthCharts(env: Env): Promise<DbDepthChart[]> {
  const entityKey = "depth_charts";
  const isCached = await checkCache(env, entityKey, 86400); // 24 hours TTL

  if (isCached) {
    console.log(`Cache HIT for ${entityKey}. Retrieving from D1...`);
    const { results } = await env.DB.prepare("SELECT * FROM depth_charts").all<DbDepthChart>();
    return results;
  }

  console.log(`Cache MISS for ${entityKey}. Fetching from SportsDataIO...`);
  const apiKey = getApiKey(env);
  const url = `${BASE_URL}/scores/json/DepthCharts?key=${apiKey}`;

  try {
    const response = await fetchWithRetry(url);
    const apiDepthCharts = await response.json<SportsDataTeamDepthCharts[]>();
    const now = Math.floor(Date.now() / 1000);

    const dbDepthCharts: DbDepthChart[] = [];
    for (const teamData of apiDepthCharts) {
      const team = teamData.Team;
      if (!teamData.DepthCharts) continue;

      for (const entry of teamData.DepthCharts) {
        if (!entry.PlayerID || !entry.Position) continue;
        dbDepthCharts.push({
          depth_id: `${entry.PlayerID}_${team}_${entry.Position}`,
          player_id: String(entry.PlayerID),
          team,
          position: entry.Position,
          depth_order: entry.DepthOrder || 1,
          updated_at: now,
        });
      }
    }

    const chunkSize = 100;
    for (let i = 0; i < dbDepthCharts.length; i += chunkSize) {
      const chunk = dbDepthCharts.slice(i, i + chunkSize);
      const statements = chunk.map((dc) =>
        env.DB.prepare(`
          INSERT INTO depth_charts (depth_id, player_id, team, position, depth_order, updated_at)
          VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(depth_id) DO UPDATE SET
            player_id = excluded.player_id,
            team = excluded.team,
            position = excluded.position,
            depth_order = excluded.depth_order,
            updated_at = excluded.updated_at
        `).bind(
          dc.depth_id,
          dc.player_id,
          dc.team,
          dc.position,
          dc.depth_order,
          dc.updated_at
        )
      );
      await env.DB.batch(statements);
    }

    await writeSyncLog(env, entityKey, dbDepthCharts.length);
    return dbDepthCharts;
  } catch (error: any) {
    await writeSyncLog(env, entityKey, 0, error.message || String(error));
    throw error;
  }
}

export async function fetchCurrentTimeframe(env: Env): Promise<{ season: number; week: number }> {
  const apiKey = getApiKey(env);
  const url = `${BASE_URL}/scores/json/Timeframes/current?key=${apiKey}`;
  try {
    const response = await fetchWithRetry(url);
    const timeframes = await response.json<{ Season: number; Week: number }[]>();
    if (timeframes && timeframes.length > 0) {
      const current = timeframes[0];
      return {
        season: current.Season,
        week: current.Week,
      };
    }
  } catch (error) {
    console.error("Failed to fetch current timeframe, falling back to defaults", error);
  }
  // Standard fallback
  return { season: 2025, week: 1 };
}

