-- Migration: 003_v1_tables.sql
-- Relational tables for matchups, standings, drafts, waivers, gamification, AI cache, and user notifications

CREATE TABLE IF NOT EXISTS matchups (
  matchup_id TEXT PRIMARY KEY,
  league_id TEXT NOT NULL,
  week INTEGER NOT NULL,
  team1_id TEXT NOT NULL,
  team2_id TEXT NOT NULL,
  team1_score REAL NOT NULL DEFAULT 0.0,
  team2_score REAL NOT NULL DEFAULT 0.0,
  winner_id TEXT,
  status TEXT NOT NULL DEFAULT 'Scheduled', -- Scheduled, InProgress, Final
  FOREIGN KEY (league_id) REFERENCES leagues(league_id),
  FOREIGN KEY (team1_id) REFERENCES teams(team_id),
  FOREIGN KEY (team2_id) REFERENCES teams(team_id)
);

CREATE TABLE IF NOT EXISTS standings (
  standing_id TEXT PRIMARY KEY,
  league_id TEXT NOT NULL,
  team_id TEXT NOT NULL,
  wins INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0,
  ties INTEGER NOT NULL DEFAULT 0,
  points_for REAL NOT NULL DEFAULT 0.0,
  points_against REAL NOT NULL DEFAULT 0.0,
  streak TEXT NOT NULL DEFAULT '0W',
  playoff_seed INTEGER,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (league_id) REFERENCES leagues(league_id),
  FOREIGN KEY (team_id) REFERENCES teams(team_id)
);

CREATE TABLE IF NOT EXISTS waivers (
  waiver_id TEXT PRIMARY KEY,
  league_id TEXT NOT NULL,
  team_id TEXT NOT NULL,
  player_id TEXT NOT NULL,
  drop_player_id TEXT,
  priority INTEGER NOT NULL DEFAULT 0,
  bid_amount REAL NOT NULL DEFAULT 0.0,
  status TEXT NOT NULL DEFAULT 'Pending', -- Pending, Processed, Failed
  processed_at INTEGER,
  FOREIGN KEY (league_id) REFERENCES leagues(league_id),
  FOREIGN KEY (team_id) REFERENCES teams(team_id),
  FOREIGN KEY (player_id) REFERENCES players(player_id)
);

CREATE TABLE IF NOT EXISTS drafts (
  draft_id TEXT PRIMARY KEY,
  league_id TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'Snake', -- Snake, Auction
  status TEXT NOT NULL DEFAULT 'Scheduled', -- Scheduled, Active, Completed
  current_pick INTEGER NOT NULL DEFAULT 1,
  round INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (league_id) REFERENCES leagues(league_id)
);

CREATE TABLE IF NOT EXISTS draft_picks (
  pick_id TEXT PRIMARY KEY,
  draft_id TEXT NOT NULL,
  round INTEGER NOT NULL,
  pick_number INTEGER NOT NULL,
  team_id TEXT NOT NULL,
  player_id TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  FOREIGN KEY (draft_id) REFERENCES drafts(draft_id),
  FOREIGN KEY (team_id) REFERENCES teams(team_id),
  FOREIGN KEY (player_id) REFERENCES players(player_id)
);

CREATE TABLE IF NOT EXISTS coach_profiles (
  coach_id TEXT PRIMARY KEY, -- maps to team_id or user_id
  user_id TEXT NOT NULL,
  level INTEGER NOT NULL DEFAULT 1,
  xp INTEGER NOT NULL DEFAULT 0,
  reputation_score INTEGER NOT NULL DEFAULT 1000,
  archetype TEXT, -- Gambler, Analyst, Grinder, Loyalist
  title TEXT NOT NULL DEFAULT 'Rookie',
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS coach_achievements (
  achievement_id TEXT PRIMARY KEY,
  coach_id TEXT NOT NULL,
  type TEXT NOT NULL,
  earned_at INTEGER NOT NULL,
  metadata TEXT, -- JSON structure
  FOREIGN KEY (coach_id) REFERENCES coach_profiles(coach_id)
);

CREATE TABLE IF NOT EXISTS cosmetics (
  cosmetic_id TEXT PRIMARY KEY,
  type TEXT NOT NULL, -- badge, banner, avatar_frame
  name TEXT NOT NULL,
  description TEXT,
  rarity TEXT NOT NULL DEFAULT 'common', -- common, rare, epic, legendary
  unlock_condition TEXT
);

CREATE TABLE IF NOT EXISTS coach_cosmetics (
  coach_id TEXT NOT NULL,
  cosmetic_id TEXT NOT NULL,
  unlocked_at INTEGER NOT NULL,
  is_equipped INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (coach_id, cosmetic_id),
  FOREIGN KEY (coach_id) REFERENCES coach_profiles(coach_id),
  FOREIGN KEY (cosmetic_id) REFERENCES cosmetics(cosmetic_id)
);

CREATE TABLE IF NOT EXISTS xp_events (
  event_id TEXT PRIMARY KEY,
  coach_id TEXT NOT NULL,
  xp_amount INTEGER NOT NULL,
  reason TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (coach_id) REFERENCES coach_profiles(coach_id)
);

CREATE TABLE IF NOT EXISTS bench_heat (
  player_id TEXT NOT NULL,
  team_id TEXT NOT NULL,
  consecutive_bench_weeks INTEGER NOT NULL DEFAULT 0,
  accumulated_bonus REAL NOT NULL DEFAULT 0.0,
  PRIMARY KEY (player_id, team_id),
  FOREIGN KEY (player_id) REFERENCES players(player_id),
  FOREIGN KEY (team_id) REFERENCES teams(team_id)
);

CREATE TABLE IF NOT EXISTS ai_response_cache (
  hash TEXT PRIMARY KEY,
  response TEXT NOT NULL,
  cached_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS ai_usage (
  id TEXT PRIMARY KEY,
  feature TEXT NOT NULL,
  tokens_in INTEGER NOT NULL,
  tokens_out INTEGER NOT NULL,
  cost_estimate REAL NOT NULL,
  timestamp INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS user_devices (
  user_id TEXT NOT NULL,
  fcm_token TEXT NOT NULL,
  platform TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, fcm_token)
);

CREATE TABLE IF NOT EXISTS user_notification_prefs (
  user_id TEXT PRIMARY KEY,
  injury_alerts INTEGER NOT NULL DEFAULT 1,
  score_updates INTEGER NOT NULL DEFAULT 1,
  lineup_reminder INTEGER NOT NULL DEFAULT 1,
  waiver_processed INTEGER NOT NULL DEFAULT 1,
  trade_offer INTEGER NOT NULL DEFAULT 1,
  coach_challenge_opp INTEGER NOT NULL DEFAULT 1,
  weekly_recap_ready INTEGER NOT NULL DEFAULT 1
);
