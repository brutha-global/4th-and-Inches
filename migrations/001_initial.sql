-- Migration: 001_initial.sql
-- Create initial schema for 4th & Inches

CREATE TABLE IF NOT EXISTS players (
  player_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  position TEXT,
  team TEXT,
  status TEXT,
  injury_status TEXT,
  depth_chart_position TEXT,
  headshot_url TEXT,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS games (
  game_id TEXT PRIMARY KEY,
  week INTEGER NOT NULL,
  season INTEGER NOT NULL,
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  status TEXT NOT NULL,
  home_score INTEGER,
  away_score INTEGER,
  quarter TEXT,
  time_remaining TEXT,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS player_stats (
  stat_id TEXT PRIMARY KEY,
  player_id TEXT NOT NULL,
  game_id TEXT NOT NULL,
  week INTEGER NOT NULL,
  season INTEGER NOT NULL,
  pass_yards REAL NOT NULL DEFAULT 0.0,
  pass_tds INTEGER NOT NULL DEFAULT 0,
  rush_yards REAL NOT NULL DEFAULT 0.0,
  rush_tds INTEGER NOT NULL DEFAULT 0,
  rec_yards REAL NOT NULL DEFAULT 0.0,
  rec_tds INTEGER NOT NULL DEFAULT 0,
  receptions INTEGER NOT NULL DEFAULT 0,
  targets INTEGER NOT NULL DEFAULT 0,
  fumbles INTEGER NOT NULL DEFAULT 0,
  interceptions INTEGER NOT NULL DEFAULT 0,
  fantasy_points REAL NOT NULL DEFAULT 0.0,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (player_id) REFERENCES players(player_id),
  FOREIGN KEY (game_id) REFERENCES games(game_id)
);

CREATE TABLE IF NOT EXISTS injuries (
  injury_id TEXT PRIMARY KEY,
  player_id TEXT NOT NULL,
  game_id TEXT,
  injury_type TEXT,
  status TEXT,
  practice_status TEXT,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (player_id) REFERENCES players(player_id),
  FOREIGN KEY (game_id) REFERENCES games(game_id)
);

CREATE TABLE IF NOT EXISTS depth_charts (
  depth_id TEXT PRIMARY KEY,
  player_id TEXT NOT NULL,
  team TEXT NOT NULL,
  position TEXT NOT NULL,
  depth_order INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (player_id) REFERENCES players(player_id)
);

CREATE TABLE IF NOT EXISTS sync_log (
  id TEXT PRIMARY KEY,
  entity TEXT NOT NULL,
  synced_at INTEGER NOT NULL,
  record_count INTEGER NOT NULL DEFAULT 0,
  error TEXT
);
