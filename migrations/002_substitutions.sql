-- Migration: 002_substitutions.sql
-- Create leagues, teams, rosters, and substitution-related tables

CREATE TABLE IF NOT EXISTS leagues (
  league_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  commissioner_id TEXT NOT NULL,
  scoring_type TEXT NOT NULL DEFAULT 'PPR', -- PPR, HALF_PPR, NO_PPR
  roster_size INTEGER NOT NULL DEFAULT 16,
  bench_size INTEGER NOT NULL DEFAULT 7,
  season INTEGER NOT NULL DEFAULT 2026,
  week INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'Drafting', -- Drafting, Active, Completed
  league_type TEXT NOT NULL DEFAULT 'classic' -- classic, best_ball, survivor, guillotine, dynasty
);

CREATE TABLE IF NOT EXISTS teams (
  team_id TEXT PRIMARY KEY,
  league_id TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  name TEXT NOT NULL,
  logo_url TEXT,
  wins INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0,
  points_for REAL NOT NULL DEFAULT 0.0,
  points_against REAL NOT NULL DEFAULT 0.0,
  FOREIGN KEY (league_id) REFERENCES leagues(league_id)
);

CREATE TABLE IF NOT EXISTS rosters (
  roster_id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL,
  player_id TEXT NOT NULL,
  slot_type TEXT NOT NULL, -- QB, RB, WR, TE, FLEX, K, DEF, BENCH
  week INTEGER NOT NULL,
  is_starter INTEGER NOT NULL DEFAULT 0, -- 0 = Bench, 1 = Starter
  FOREIGN KEY (team_id) REFERENCES teams(team_id),
  FOREIGN KEY (player_id) REFERENCES players(player_id)
);

CREATE TABLE IF NOT EXISTS substitution_tokens (
  team_id TEXT NOT NULL,
  week INTEGER NOT NULL,
  season INTEGER NOT NULL,
  injury_insurance_used INTEGER NOT NULL DEFAULT 0,
  coach_challenge_used INTEGER NOT NULL DEFAULT 0,
  momentum_swaps_remaining INTEGER NOT NULL DEFAULT 1,
  tactical_timeouts_remaining INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (team_id, week, season),
  FOREIGN KEY (team_id) REFERENCES teams(team_id)
);

CREATE TABLE IF NOT EXISTS substitution_log (
  sub_id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL,
  week INTEGER NOT NULL,
  type TEXT NOT NULL, -- injury_insurance, coach_challenge, momentum_swap, tactical_timeout
  out_player_id TEXT NOT NULL,
  in_player_id TEXT NOT NULL,
  requested_at INTEGER NOT NULL,
  approved_at INTEGER, -- NULL if denied
  denied_reason TEXT, -- NULL if approved
  points_at_time_of_sub REAL DEFAULT 0.0,
  FOREIGN KEY (team_id) REFERENCES teams(team_id),
  FOREIGN KEY (out_player_id) REFERENCES players(player_id),
  FOREIGN KEY (in_player_id) REFERENCES players(player_id)
);
