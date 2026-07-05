import { DEFAULT_SCORING_CONFIG, calculatePlayerScore } from "./scoring";

export interface SubstitutionRequest {
  leagueId: string;
  teamId: string;
  week: number;
  season: number;
  type: "injury_insurance" | "coach_challenge" | "momentum_swap" | "tactical_timeout";
  playerId: string;
  replacementId: string;
}

export interface ValidationResult {
  ok: boolean;
  reason: string;
  week: number;
  season: number;
  pointsAtTime: number;
}

export interface SubResult {
  success: boolean;
  reason: string;
}

/**
 * Validates all anti-abuse and specific rules for a substitution request.
 */
export async function validateSubstitution(
  req: SubstitutionRequest,
  db: D1Database
): Promise<ValidationResult> {
  const { leagueId, teamId, week, season, type, playerId, replacementId } = req;

  // 1. Fetch player & replacement info
  const player = await db.prepare("SELECT * FROM players WHERE player_id = ?").bind(playerId).first<{ team: string; status: string; injury_status: string }>();
  const replacement = await db.prepare("SELECT * FROM players WHERE player_id = ?").bind(replacementId).first<{ team: string; status: string; injury_status: string }>();

  if (!player || !replacement) {
    return { ok: false, reason: "Player or replacement details not found", week, season, pointsAtTime: 0 };
  }

  // 2. Fetch game records
  const playerGame = await db.prepare(`
    SELECT * FROM games 
    WHERE season = ? AND week = ? AND (home_team = ? OR away_team = ?)
    LIMIT 1
  `).bind(season, week, player.team, player.team).first<{ game_id: string; status: string; quarter: string; time_remaining: string }>();

  const repGame = await db.prepare(`
    SELECT * FROM games 
    WHERE season = ? AND week = ? AND (home_team = ? OR away_team = ?)
    LIMIT 1
  `).bind(season, week, replacement.team, replacement.team).first<{ game_id: string; status: string }>();

  if (!playerGame) {
    return { ok: false, reason: "Player has no active game scheduled this week", week, season, pointsAtTime: 0 };
  }
  if (!repGame) {
    return { ok: false, reason: "Replacement has no active game scheduled this week", week, season, pointsAtTime: 0 };
  }

  // 3. Fetch rosters configurations
  const playerRoster = await db.prepare(`
    SELECT is_starter, slot_type FROM rosters 
    WHERE team_id = ? AND player_id = ? AND week = ?
    LIMIT 1
  `).bind(teamId, playerId, week).first<{ is_starter: number; slot_type: string }>();

  const repRoster = await db.prepare(`
    SELECT is_starter, slot_type FROM rosters 
    WHERE team_id = ? AND player_id = ? AND week = ?
    LIMIT 1
  `).bind(teamId, replacementId, week).first<{ is_starter: number; slot_type: string }>();

  if (!playerRoster || playerRoster.is_starter !== 1) {
    return { ok: false, reason: "Player is not in your starting lineup", week, season, pointsAtTime: 0 };
  }
  if (!repRoster || repRoster.is_starter !== 0) {
    return { ok: false, reason: "Replacement player is not on your bench", week, season, pointsAtTime: 0 };
  }

  // 4. Anti-Abuse: Roster slot substituted only once/week
  const slotSubbed = await db.prepare(`
    SELECT COUNT(*) as c FROM substitution_log 
    WHERE team_id = ? AND week = ? AND out_player_id = ? AND approved_at IS NOT NULL
  `).bind(teamId, week, playerId).first<{ c: number }>();
  if (slotSubbed && slotSubbed.c > 0) {
    return { ok: false, reason: "This starting roster slot has already been substituted this week", week, season, pointsAtTime: 0 };
  }

  // Anti-Abuse: Cannot re-enter a removed player
  const reEnter = await db.prepare(`
    SELECT COUNT(*) as c FROM substitution_log 
    WHERE team_id = ? AND week = ? AND in_player_id = ? AND approved_at IS NOT NULL
  `).bind(teamId, week, playerId).first<{ c: number }>();
  if (reEnter && reEnter.c > 0) {
    return { ok: false, reason: "Cannot substitute in a player who has already been removed from the active starting lineup this week", week, season, pointsAtTime: 0 };
  }

  // Fetch current stats to get points at time of sub
  const stats = await db.prepare(`
    SELECT * FROM player_stats 
    WHERE player_id = ? AND game_id = ? AND week = ? AND season = ?
    LIMIT 1
  `).bind(playerId, playerGame.game_id, week, season).first<any>();
  const pointsAtTime = stats ? calculatePlayerScore(stats, DEFAULT_SCORING_CONFIG) : 0.0;

  // Retrieve team substitution tokens
  let tokens = await db.prepare(`
    SELECT * FROM substitution_tokens 
    WHERE team_id = ? AND week = ? AND season = ?
  `).bind(teamId, week, season).first<any>();

  if (!tokens) {
    await db.prepare(`
      INSERT INTO substitution_tokens (team_id, week, season, injury_insurance_used, coach_challenge_used, momentum_swaps_remaining, tactical_timeouts_remaining)
      VALUES (?, ?, ?, 0, 0, 1, 1)
    `).bind(teamId, week, season).run();
    tokens = { injury_insurance_used: 0, coach_challenge_used: 0, momentum_swaps_remaining: 1, tactical_timeouts_remaining: 1 };
  }

  // 5. Anti-Abuse: No substitutions after overtime begins
  if (playerGame.quarter === "OT") {
    return { ok: false, reason: "Substitutions are disabled after overtime begins", week, season, pointsAtTime };
  }

  // 6. Subtype Rules validations
  if (type === "injury_insurance") {
    const isGameStarted = playerGame.status !== "Scheduled";
    if (!isGameStarted) {
      return { ok: false, reason: "Injury Insurance requires that the player's game has kicked off", week, season, pointsAtTime };
    }

    const isOut = player.injury_status === "Out" || player.status === "Out";
    if (!isOut) {
      return { ok: false, reason: `Injury Insurance requires an 'Out' status (currently: ${player.injury_status || player.status})`, week, season, pointsAtTime };
    }

    if (repGame.status !== "Scheduled") {
      return { ok: false, reason: "Replacement player's game has already started", week, season, pointsAtTime };
    }

    if (tokens.injury_insurance_used >= 1) {
      return { ok: false, reason: "No Injury Insurance tokens remaining for this week", week, season, pointsAtTime };
    }

  } else if (type === "coach_challenge") {
    const isGameStarted = playerGame.status !== "Scheduled";
    if (!isGameStarted) {
      return { ok: false, reason: "Coach Challenge requires that the player's game has kicked off", week, season, pointsAtTime };
    }

    // Available from kickoff to end of Q3 (cannot sub in Q4 or final)
    const isQ4OrFinal = playerGame.quarter === "4" || playerGame.status === "Final";
    if (isQ4OrFinal) {
      return { ok: false, reason: "Coach Challenge substitutions are only available from kickoff to the end of Q3", week, season, pointsAtTime };
    }

    if (repGame.status !== "Scheduled") {
      return { ok: false, reason: "Replacement player's game has already started", week, season, pointsAtTime };
    }

    if (tokens.coach_challenge_used >= 1) {
      return { ok: false, reason: "No Coach Challenge tokens remaining for this week", week, season, pointsAtTime };
    }

  } else if (type === "momentum_swap") {
    // Halftime window (mocked as status 'Halftime' or quarter = '2' and time_remaining = '0:00')
    const isHalftime = playerGame.quarter === "Halftime" || playerGame.quarter === "2" || playerGame.status === "Halftime";
    if (!isHalftime) {
      return { ok: false, reason: "Momentum Swap can only be triggered during the game's halftime window", week, season, pointsAtTime };
    }

    // Must be below 25% of projected score
    const projection = await db.prepare("SELECT fantasy_points FROM player_stats WHERE player_id = ? AND week = ? AND season = ?").bind(playerId, week, season).first<{ fantasy_points: number }>();
    const projPoints = projection?.fantasy_points || 15.0; // fallback default projection
    if (pointsAtTime >= projPoints * 0.25) {
      return { ok: false, reason: `Player is performing adequately (points: ${pointsAtTime}, projection: ${projPoints})`, week, season, pointsAtTime };
    }

    if (repGame.status !== "Scheduled") {
      return { ok: false, reason: "Replacement player's game has already started", week, season, pointsAtTime };
    }

    if (tokens.momentum_swaps_remaining < 1) {
      return { ok: false, reason: "No Momentum Swaps remaining for this week", week, season, pointsAtTime };
    }

  } else if (type === "tactical_timeout") {
    // Reserve lineup slot up to 60 minutes before kickoff (status must be Scheduled)
    if (playerGame.status !== "Scheduled") {
      return { ok: false, reason: "Tactical Timeout is only available before game kickoff", week, season, pointsAtTime };
    }

    if (tokens.tactical_timeouts_remaining < 1) {
      return { ok: false, reason: "No Tactical Timeouts remaining for this week", week, season, pointsAtTime };
    }
  }

  return { ok: true, reason: "Validation passed", week, season, pointsAtTime };
}

/**
 * Executes a valid substitution swap in the database.
 */
export async function processSubstitution(
  req: SubstitutionRequest,
  db: D1Database
): Promise<SubResult> {
  const validation = await validateSubstitution(req, db);
  if (!validation.ok) {
    return { success: false, reason: validation.reason };
  }

  const now = Math.floor(Date.now() / 1000);
  const sub_id = `sub_${req.teamId}_${req.playerId}_${now}`;

  // 1. Log approved substitution
  await db.prepare(`
    INSERT INTO substitution_log (sub_id, team_id, week, type, out_player_id, in_player_id, requested_at, approved_at, points_at_time_of_sub)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(sub_id, req.teamId, req.week, req.type, req.playerId, req.replacementId, now, now, validation.pointsAtTime).run();

  // 2. Update tokens
  if (req.type === "injury_insurance") {
    await db.prepare("UPDATE substitution_tokens SET injury_insurance_used = 1 WHERE team_id = ? AND week = ? AND season = ?").bind(req.teamId, req.week, req.season).run();
  } else if (req.type === "coach_challenge") {
    await db.prepare("UPDATE substitution_tokens SET coach_challenge_used = 1 WHERE team_id = ? AND week = ? AND season = ?").bind(req.teamId, req.week, req.season).run();
  } else if (req.type === "momentum_swap") {
    await db.prepare("UPDATE substitution_tokens SET momentum_swaps_remaining = momentum_swaps_remaining - 1 WHERE team_id = ? AND week = ? AND season = ?").bind(req.teamId, req.week, req.season).run();
  } else if (req.type === "tactical_timeout") {
    await db.prepare("UPDATE substitution_tokens SET tactical_timeouts_remaining = tactical_timeouts_remaining - 1 WHERE team_id = ? AND week = ? AND season = ?").bind(req.teamId, req.week, req.season).run();
  }

  // 3. Swap rosters roles
  const playerRoster = await db.prepare("SELECT slot_type FROM rosters WHERE team_id = ? AND player_id = ? AND week = ?").bind(req.teamId, req.playerId, req.week).first<{ slot_type: string }>();
  if (playerRoster) {
    await db.prepare("UPDATE rosters SET is_starter = 0, slot_type = 'BENCH' WHERE team_id = ? AND player_id = ? AND week = ?").bind(req.teamId, req.playerId, req.week).run();
    await db.prepare("UPDATE rosters SET is_starter = 1, slot_type = ? WHERE team_id = ? AND player_id = ? AND week = ?").bind(playerRoster.slot_type, req.teamId, req.replacementId, req.week).run();
  }

  return { success: true, reason: "Substitution processed successfully" };
}

/**
 * Resets weekly substitution tokens.
 */
export async function resetWeeklyTokens(
  leagueId: string,
  week: number,
  db: D1Database
): Promise<void> {
  const { results: teams } = await db.prepare("SELECT team_id FROM teams WHERE league_id = ?").bind(leagueId).all<{ team_id: string }>();
  const season = 2026;

  for (const t of teams) {
    await db.prepare(`
      INSERT INTO substitution_tokens (team_id, week, season, injury_insurance_used, coach_challenge_used, momentum_swaps_remaining, tactical_timeouts_remaining)
      VALUES (?, ?, ?, 0, 0, 1, 1)
      ON CONFLICT(team_id, week, season) DO UPDATE SET
        injury_insurance_used = 0,
        coach_challenge_used = 0,
        momentum_swaps_remaining = 1,
        tactical_timeouts_remaining = 1
    `).bind(t.team_id, week, season).run();
  }
}

/**
 * Retrieves the substitution logs for a team.
 */
export async function getSubstitutionHistory(
  teamId: string,
  week: number,
  db: D1Database
): Promise<any[]> {
  const { results } = await db.prepare(`
    SELECT * FROM substitution_log 
    WHERE team_id = ? AND week = ?
    ORDER BY requested_at DESC
  `).bind(teamId, week).all<any>();
  return results;
}
