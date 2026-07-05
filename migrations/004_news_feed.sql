-- Migration: 004_news_feed.sql
-- Real NFL news + injury feed, ported from the standalone nfl-news-api
-- (ESPN-sourced). Populated by the Worker cron (scheduled handler) and read
-- by the Home League News carousel, Player Profile news feed, and the
-- league-wide status chips.

-- League/team/player news articles, deduped by link (unique).
CREATE TABLE IF NOT EXISTS news_items (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  source       TEXT NOT NULL,           -- 'league' | 'team' | 'player'
  headline     TEXT NOT NULL,
  summary      TEXT,
  link         TEXT NOT NULL UNIQUE,    -- dedup key (falls back to espn-article-<id>)
  image_url    TEXT,
  published_at TEXT,                    -- ISO8601 from ESPN
  player_id    TEXT,                    -- ESPN athlete id when player-scoped
  team_id      TEXT,                    -- ESPN numeric team id when team-scoped
  fetched_at   TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_news_published ON news_items(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_news_player    ON news_items(player_id, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_news_team      ON news_items(team_id, published_at DESC);

-- Current injury report, one row per player (upserted every poll).
-- Kept separate from the existing SportsData-backed `injuries` table so the
-- two feeds don't fight; this one is keyed by ESPN athlete id.
CREATE TABLE IF NOT EXISTS injury_feed (
  player_id   TEXT PRIMARY KEY,   -- ESPN athlete id
  player_name TEXT,               -- resolved name when we can match locally
  team_id     TEXT,               -- ESPN numeric team id
  team_abbr   TEXT,
  status      TEXT,               -- Out / Questionable / Doubtful / Active ...
  description TEXT,
  updated_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_injuryfeed_team ON injury_feed(team_id);

-- Players the app cares about — drives per-player news polling. Auto-populated
-- whenever a player is rostered/added/claimed/drafted or added to a cheat sheet.
CREATE TABLE IF NOT EXISTS watchlist (
  player_id TEXT PRIMARY KEY,     -- ESPN athlete id
  added_at  TEXT NOT NULL
);

-- Health/status of the news feed itself, so the UI can show a degraded-feed
-- note (Section 13) instead of silently stale data. One row per job kind.
CREATE TABLE IF NOT EXISTS feed_status (
  job          TEXT PRIMARY KEY,  -- 'news' | 'injuries' | 'player_news'
  last_ok_at   TEXT,              -- last successful completion (ISO8601)
  last_run_at  TEXT,
  last_error   TEXT,
  ok           INTEGER NOT NULL DEFAULT 1
);
