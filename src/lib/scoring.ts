import { Env } from "./sportsdata";

export interface ScoringConfig {
  passingYardsPerPoint: number;
  passingTDPoints: number;
  intPenalty: number;
  fumblePenalty: number;
  rushingYardsPerPoint: number;
  rushingTDPoints: number;
  receivingYardsPerPoint: number;
  receivingTDPoints: number;
  pprValue: number;
  kickingFG0_39: number;
  kickingFG40_49: number;
  kickingFG50plus: number;
  kickingPAT: number;
  defShutout: number;
  def1_6: number;
  def7_13: number;
  def14_17: number;
  def28_34: number;
  def35plus: number;
  sackPoints: number;
  defIntPoints: number;
  defFumblePoints: number;
  defTDPoints: number;
  // Standard Bonuses
  bonus300PassYards: number;
  bonus100RushYards: number;
  bonus100RecYards: number;
  comebackBonus: number;
}

export interface PlayerStats {
  passYards?: number;
  passTDs?: number;
  rushYards?: number;
  rushTDs?: number;
  recYards?: number;
  recTDs?: number;
  receptions?: number;
  targets?: number;
  fumbles?: number;
  interceptions?: number;
  // Kicking
  fg0_39?: number;
  fg40_49?: number;
  fg50plus?: number;
  pat?: number;
  // Defense
  defPointsAllowed?: number;
  defSacks?: number;
  defInt?: number;
  defFumbleRec?: number;
  defTD?: number;
  // Comeback flag
  comebackWon?: boolean;
}

export interface LineupSlot {
  player_id: string;
  is_starter: boolean;
}

export interface LineupScore {
  teamId: string;
  week: number;
  season: number;
  playerScores: { player_id: string; score: number }[];
  totalScore: number;
}

// --- Configurations ---

export const DEFAULT_SCORING_CONFIG: ScoringConfig = {
  passingYardsPerPoint: 0.04, // 1pt per 25 yards
  passingTDPoints: 4,
  intPenalty: -2,
  fumblePenalty: -2,
  rushingYardsPerPoint: 0.1, // 1pt per 10 yards
  rushingTDPoints: 6,
  receivingYardsPerPoint: 0.1, // 1pt per 10 yards
  receivingTDPoints: 6,
  pprValue: 1.0, // Full PPR
  kickingFG0_39: 3,
  kickingFG40_49: 4,
  kickingFG50plus: 5,
  kickingPAT: 1,
  defShutout: 10,
  def1_6: 7,
  def7_13: 4,
  def14_17: 1,
  def28_34: -1,
  def35plus: -4,
  sackPoints: 1,
  defIntPoints: 2,
  defFumblePoints: 2,
  defTDPoints: 6,
  bonus300PassYards: 3,
  bonus100RushYards: 3,
  bonus100RecYards: 3,
  comebackBonus: 0.05, // +5%
};

export const HALF_PPR_CONFIG: ScoringConfig = {
  ...DEFAULT_SCORING_CONFIG,
  pprValue: 0.5,
};

export const NO_PPR_CONFIG: ScoringConfig = {
  ...DEFAULT_SCORING_CONFIG,
  pprValue: 0.0,
};

// --- Functions ---

/**
 * Calculates a player's fantasy score for a game based on their stats and config.
 * Pure and unit-testable.
 */
export function calculatePlayerScore(stats: Partial<PlayerStats>, config: ScoringConfig): number {
  let score = 0;

  // Passing
  score += (stats.passYards || 0) * config.passingYardsPerPoint;
  score += (stats.passTDs || 0) * config.passingTDPoints;
  score += (stats.interceptions || 0) * config.intPenalty;
  score += (stats.fumbles || 0) * config.fumblePenalty;

  // Rushing
  score += (stats.rushYards || 0) * config.rushingYardsPerPoint;
  score += (stats.rushTDs || 0) * config.rushingTDPoints;

  // Receiving
  score += (stats.recYards || 0) * config.receivingYardsPerPoint;
  score += (stats.recTDs || 0) * config.receivingTDPoints;
  score += (stats.receptions || 0) * config.pprValue;

  // Kicking
  score += (stats.fg0_39 || 0) * config.kickingFG0_39;
  score += (stats.fg40_49 || 0) * config.kickingFG40_49;
  score += (stats.fg50plus || 0) * config.kickingFG50plus;
  score += (stats.pat || 0) * config.kickingPAT;

  // Defense points allowed
  if (stats.defPointsAllowed !== undefined) {
    const pts = stats.defPointsAllowed;
    if (pts === 0) score += config.defShutout;
    else if (pts >= 1 && pts <= 6) score += config.def1_6;
    else if (pts >= 7 && pts <= 13) score += config.def7_13;
    else if (pts >= 14 && pts <= 17) score += config.def14_17;
    else if (pts >= 28 && pts <= 34) score += config.def28_34;
    else if (pts >= 35) score += config.def35plus;
  }

  // Defense plays
  score += (stats.defSacks || 0) * config.sackPoints;
  score += (stats.defInt || 0) * config.defIntPoints;
  score += (stats.defFumbleRec || 0) * config.defFumblePoints;
  score += (stats.defTD || 0) * config.defTDPoints;

  // Standard Bonuses
  if ((stats.passYards || 0) >= 300) score += config.bonus300PassYards;
  if ((stats.rushYards || 0) >= 100) score += config.bonus100RushYards;
  if ((stats.recYards || 0) >= 100) score += config.bonus100RecYards;

  // Comeback Bonus (+5%)
  if (stats.comebackWon) {
    score *= (1 + config.comebackBonus);
  }

  // Round to 2 decimal places to prevent floating point noise
  return Math.round(score * 100) / 100;
}

/**
 * Calculates the live score of a player based on their partial stats.
 * Alias of calculatePlayerScore to represent live game-day scoring.
 */
export function calculateLiveScore(partialStats: Partial<PlayerStats>, config: ScoringConfig): number {
  return calculatePlayerScore(partialStats, config);
}

/**
 * Dynamically projects a player's fantasy score for a target week:
 * Formula: 4-week rolling average * opponent defense rank factor * home/away factor
 */
export async function calculateProjectedScore(
  player_id: string,
  week: number,
  config: ScoringConfig,
  db: D1Database
): Promise<number> {
  // 1. Resolve active season dynamically
  const seasonRow = await db.prepare("SELECT MAX(season) as s FROM games WHERE week = ?").bind(week).first<{ s: number }>();
  const season = seasonRow?.s || 2026;

  // 2. Fetch player's past 4 weeks of stats
  const statsQuery = `
    SELECT * FROM player_stats 
    WHERE player_id = ? 
      AND (season < ? OR (season = ? AND week < ?)) 
    ORDER BY season DESC, week DESC 
    LIMIT 4
  `;
  const { results: pastStats } = await db.prepare(statsQuery).bind(player_id, season, season, week).all<any>();

  let rollingAvg = 0;
  if (pastStats && pastStats.length > 0) {
    let sum = 0;
    for (const s of pastStats) {
      const statsObj: Partial<PlayerStats> = {
        passYards: s.pass_yards,
        passTDs: s.pass_tds,
        rushYards: s.rush_yards,
        rushTDs: s.rush_tds,
        recYards: s.rec_yards,
        recTDs: s.rec_tds,
        receptions: s.receptions,
        targets: s.targets,
        fumbles: s.fumbles,
        interceptions: s.interceptions,
      };
      sum += calculatePlayerScore(statsObj, config);
    }
    rollingAvg = sum / pastStats.length;
  }

  // 3. Retrieve player team & position
  const player = await db.prepare("SELECT team, position FROM players WHERE player_id = ?").bind(player_id).first<{ team: string; position: string }>();
  if (!player || !player.team || !player.position) {
    return Math.round(rollingAvg * 100) / 100;
  }

  // 4. Retrieve opponent team & determine Home/Away
  const game = await db.prepare(`
    SELECT game_id, home_team, away_team 
    FROM games 
    WHERE season = ? AND week = ? 
      AND (home_team = ? OR away_team = ?) 
    LIMIT 1
  `).bind(season, week, player.team, player.team).first<{ game_id: string; home_team: string; away_team: string }>();

  if (!game) {
    return Math.round(rollingAvg * 100) / 100; // Bye week or unscheduled
  }

  const isHome = game.home_team === player.team;
  const homeAwayFactor = isHome ? 1.05 : 0.95;
  const opponent = isHome ? game.away_team : game.home_team;

  // 5. Calculate opponent defense rank factor
  // Opponent average allowed to position in last 4 weeks
  const oppGamesRow = await db.prepare(`
    SELECT COUNT(DISTINCT game_id) as c 
    FROM games 
    WHERE (home_team = ? OR away_team = ?)
      AND (season < ? OR (season = ? AND week < ?))
  `).bind(opponent, opponent, season, season, week).first<{ c: number }>();
  const oppGamesCount = oppGamesRow?.c || 0;

  const oppStatsQuery = `
    SELECT s.* 
    FROM player_stats s
    JOIN players p ON s.player_id = p.player_id
    JOIN games g ON s.game_id = g.game_id
    WHERE p.position = ?
      AND (
        (g.home_team = ? AND p.team = g.away_team) OR
        (g.away_team = ? AND p.team = g.home_team)
      )
      AND (g.season < ? OR (g.season = ? AND g.week < ?))
  `;
  const { results: oppAllowedStats } = await db.prepare(oppStatsQuery).bind(player.position, opponent, opponent, season, season, week).all<any>();

  let oppTotalPoints = 0;
  for (const s of oppAllowedStats || []) {
    const statsObj: Partial<PlayerStats> = {
      passYards: s.pass_yards,
      passTDs: s.pass_tds,
      rushYards: s.rush_yards,
      rushTDs: s.rush_tds,
      recYards: s.rec_yards,
      recTDs: s.rec_tds,
      receptions: s.receptions,
      targets: s.targets,
      fumbles: s.fumbles,
      interceptions: s.interceptions,
    };
    oppTotalPoints += calculatePlayerScore(statsObj, config);
  }
  const oppAverage = oppTotalPoints / (oppGamesCount || 1);

  // League average allowed to position in last 4 weeks
  const leagueGamesRow = await db.prepare(`
    SELECT COUNT(DISTINCT game_id) as c 
    FROM games 
    WHERE (season < ? OR (season = ? AND week < ?))
  `).bind(season, season, week).first<{ c: number }>();
  const leagueGamesCount = (leagueGamesRow?.c || 0) * 2; // 2 team-games per scheduled match

  const leagueStatsQuery = `
    SELECT s.* 
    FROM player_stats s
    JOIN players p ON s.player_id = p.player_id
    JOIN games g ON s.game_id = g.game_id
    WHERE p.position = ?
      AND (g.season < ? OR (g.season = ? AND g.week < ?))
  `;
  const { results: leagueAllowedStats } = await db.prepare(leagueStatsQuery).bind(player.position, season, season, week).all<any>();

  let leagueTotalPoints = 0;
  for (const s of leagueAllowedStats || []) {
    const statsObj: Partial<PlayerStats> = {
      passYards: s.pass_yards,
      passTDs: s.pass_tds,
      rushYards: s.rush_yards,
      rushTDs: s.rush_tds,
      recYards: s.rec_yards,
      recTDs: s.rec_tds,
      receptions: s.receptions,
      targets: s.targets,
      fumbles: s.fumbles,
      interceptions: s.interceptions,
    };
    leagueTotalPoints += calculatePlayerScore(statsObj, config);
  }
  const leagueAverage = leagueTotalPoints / (leagueGamesCount || 1);

  // Opponent Defense Rank Factor = Opponent Allowed / League Average
  // Normalize factor to be within [0.5, 1.5] to prevent anomalous statistics
  let defenseRankFactor = 1.0;
  if (leagueAverage > 0) {
    defenseRankFactor = oppAverage / leagueAverage;
    defenseRankFactor = Math.max(0.5, Math.min(1.5, defenseRankFactor));
  }

  // Final Projection
  const projection = rollingAvg * defenseRankFactor * homeAwayFactor;
  return Math.round(projection * 100) / 100;
}

/**
 * Scores a starting lineup for a week.
 */
export async function scoreLineup(
  lineup: LineupSlot[],
  week: number,
  config: ScoringConfig,
  db: D1Database
): Promise<LineupScore> {
  const seasonRow = await db.prepare("SELECT MAX(season) as s FROM games WHERE week = ?").bind(week).first<{ s: number }>();
  const season = seasonRow?.s || 2026;

  const playerScores: { player_id: string; score: number }[] = [];
  let totalScore = 0;

  for (const slot of lineup) {
    let score = 0;
    if (slot.is_starter) {
      const stats = await db.prepare(`
        SELECT * FROM player_stats 
        WHERE player_id = ? AND week = ? AND season = ?
        LIMIT 1
      `).bind(slot.player_id, week, season).first<any>();

      if (stats) {
        const statsObj: Partial<PlayerStats> = {
          passYards: stats.pass_yards,
          passTDs: stats.pass_tds,
          rushYards: stats.rush_yards,
          rushTDs: stats.rush_tds,
          recYards: stats.rec_yards,
          recTDs: stats.rec_tds,
          receptions: stats.receptions,
          targets: stats.targets,
          fumbles: stats.fumbles,
          interceptions: stats.interceptions,
        };
        score = calculatePlayerScore(statsObj, config);
      }
      totalScore += score;
    }
    playerScores.push({ player_id: slot.player_id, score });
  }

  return {
    teamId: "", // Placeholder, context-supplied
    week,
    season,
    playerScores,
    totalScore: Math.round(totalScore * 100) / 100,
  };
}
