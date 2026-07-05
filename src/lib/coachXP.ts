import { Env } from "../lib/sportsdata";

/**
 * Adds XP to a coach's profile and checks for level-up.
 */
export async function awardXP(
  coachId: string,
  amount: number,
  reason: string,
  db: D1Database
): Promise<{ levelUp: boolean; newLevel: number }> {
  const now = Math.floor(Date.now() / 1000);
  const event_id = `xp_${coachId}_${Date.now()}_${Math.floor(Math.random() * 100)}`;

  // 1. Fetch coach profile or lazily register
  let profile = await db.prepare("SELECT * FROM coach_profiles WHERE coach_id = ?").bind(coachId).first<any>();
  if (!profile) {
    // Lazy profile registration
    await db.prepare(`
      INSERT INTO coach_profiles (coach_id, user_id, level, xp, reputation_score, title, created_at)
      VALUES (?, 'user_default', 1, 0, 1000, 'Rookie', ?)
    `).bind(coachId, now).run();
    profile = { level: 1, xp: 0, reputation_score: 1000 };
  }

  // 2. Log XP event
  await db.prepare(`
    INSERT INTO xp_events (event_id, coach_id, xp_amount, reason, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).bind(event_id, coachId, amount, reason, now).run();

  let currentXP = profile.xp + amount;
  let currentLevel = profile.level;
  let levelUp = false;

  // Level benchmarking: XP_to_next = 500 * current_level
  while (currentXP >= 500 * currentLevel) {
    currentXP -= 500 * currentLevel;
    currentLevel++;
    levelUp = true;
  }

  // Titles mapping: 1=Rookie, 10=Field General, 20=Head Coach, 35=Legend, 50=Hall of Famer
  let title = "Rookie";
  if (currentLevel >= 50) title = "Hall of Famer";
  else if (currentLevel >= 35) title = "Legend";
  else if (currentLevel >= 20) title = "Head Coach";
  else if (currentLevel >= 10) title = "Field General";

  await db.prepare(`
    UPDATE coach_profiles 
    SET xp = ?, level = ?, title = ? 
    WHERE coach_id = ?
  `).bind(currentXP, currentLevel, title, coachId).run();

  return { levelUp, newLevel: currentLevel };
}

/**
 * Adjusts coach reputation score.
 */
export async function updateReputation(
  coachId: string,
  change: number,
  db: D1Database
): Promise<number> {
  let profile = await db.prepare("SELECT reputation_score FROM coach_profiles WHERE coach_id = ?").bind(coachId).first<{ reputation_score: number }>();
  if (!profile) {
    const now = Math.floor(Date.now() / 1000);
    await db.prepare(`
      INSERT INTO coach_profiles (coach_id, user_id, level, xp, reputation_score, title, created_at)
      VALUES (?, 'user_default', 1, 0, 1000, 'Rookie', ?)
    `).bind(coachId, now).run();
    profile = { reputation_score: 1000 };
  }
  const currentRep = profile.reputation_score;
  const newRep = Math.max(0, currentRep + change);

  await db.prepare(`
    UPDATE coach_profiles 
    SET reputation_score = ? 
    WHERE coach_id = ?
  `).bind(newRep, coachId).run();

  return newRep;
}

/**
 * Chooses coach archetype (unlocks at level 5).
 */
export async function chooseArchetype(
  coachId: string,
  archetype: "Gambler" | "Analyst" | "Grinder" | "Loyalist",
  db: D1Database
): Promise<{ success: boolean; reason?: string }> {
  const profile = await db.prepare("SELECT level FROM coach_profiles WHERE coach_id = ?").bind(coachId).first<{ level: number }>();
  if (!profile || profile.level < 5) {
    return { success: false, reason: "Coach archetypes unlock at Level 5" };
  }

  await db.prepare(`
    UPDATE coach_profiles 
    SET archetype = ? 
    WHERE coach_id = ?
  `).bind(archetype, coachId).run();

  return { success: true };
}

/**
 * Tracks and applies Bench Heat points rules.
 */
export async function applyBenchHeat(
  teamId: string,
  week: number,
  db: D1Database
): Promise<void> {
  // Query bench players on the roster
  const { results: bench } = await db.prepare(`
    SELECT player_id FROM rosters 
    WHERE team_id = ? AND week = ? AND is_starter = 0
  `).bind(teamId, week).all<{ player_id: string }>();

  // Fetch archetype to check for Loyalist perks
  const profile = await db.prepare("SELECT archetype FROM coach_profiles WHERE coach_id = ?").bind(teamId).first<{ archetype: string }>();
  const isLoyalist = profile?.archetype === "Loyalist";

  for (const b of bench) {
    const player_id = b.player_id;

    // Fetch previous bench heat records
    const record = await db.prepare(`
      SELECT consecutive_bench_weeks, accumulated_bonus 
      FROM bench_heat 
      WHERE player_id = ? AND team_id = ?
    `).bind(player_id, teamId).first<{ consecutive_bench_weeks: number; accumulated_bonus: number }>();

    const prevWeeks = record?.consecutive_bench_weeks || 0;
    const nextWeeks = prevWeeks + 1;

    // Loyalist earns full benefit, non-Loyalist gets 0 points benched
    const bonusInc = isLoyalist ? 0.1 : 0.0;
    const nextBonus = Math.min(1.5, (record?.accumulated_bonus || 0) + bonusInc);

    await db.prepare(`
      INSERT INTO bench_heat (player_id, team_id, consecutive_bench_weeks, accumulated_bonus)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(player_id, team_id) DO UPDATE SET
        consecutive_bench_weeks = excluded.consecutive_bench_weeks,
        accumulated_bonus = excluded.accumulated_bonus
    `).bind(player_id, teamId, nextWeeks, nextBonus).run();
  }

  // Reset bench heat for starting players
  const { results: starters } = await db.prepare(`
    SELECT player_id FROM rosters 
    WHERE team_id = ? AND week = ? AND is_starter = 1
  `).bind(teamId, week).all<{ player_id: string }>();

  for (const s of starters) {
    await db.prepare(`
      DELETE FROM bench_heat 
      WHERE player_id = ? AND team_id = ?
    `).bind(s.player_id, teamId).run();
  }
}
