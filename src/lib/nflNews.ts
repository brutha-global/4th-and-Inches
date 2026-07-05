/**
 * NFL News + Injury feed — ported from the standalone `nfl-news-api` Express
 * service into the Cloudflare Worker so it runs on the existing cron trigger
 * and stores into D1 (no second service to keep alive).
 *
 * ESPN endpoints are plain public HTTPS GETs, so `fetch` works verbatim inside
 * a Worker. We keep the same dedup-by-link, upsert-by-player behaviour as the
 * original jobs, and record feed health so the UI can flag a degraded feed
 * (brief Section 13) instead of showing silently stale data.
 */

const BASE_SITE = "https://site.api.espn.com/apis/site/v2/sports/football/nfl";
const BASE_FANTASY = "https://site.api.espn.com/apis/fantasy/v2/games/ffl";
const BASE_CORE = "https://sports.core.api.espn.com/v2/sports/football/leagues/nfl";

const UA = { "User-Agent": "4th-and-inches/1.0 (+news-feed)" };

/** ESPN internal numeric team IDs <-> abbreviations (from teams.js). */
export const ESPN_TEAMS: { id: number; abbr: string }[] = [
  { id: 1, abbr: "ATL" }, { id: 2, abbr: "BUF" }, { id: 3, abbr: "CHI" },
  { id: 4, abbr: "CIN" }, { id: 5, abbr: "CLE" }, { id: 6, abbr: "DAL" },
  { id: 7, abbr: "DEN" }, { id: 8, abbr: "DET" }, { id: 9, abbr: "GB" },
  { id: 10, abbr: "TEN" }, { id: 11, abbr: "IND" }, { id: 12, abbr: "KC" },
  { id: 13, abbr: "LV" }, { id: 14, abbr: "LAR" }, { id: 15, abbr: "MIA" },
  { id: 16, abbr: "MIN" }, { id: 17, abbr: "NE" }, { id: 18, abbr: "NO" },
  { id: 19, abbr: "NYG" }, { id: 20, abbr: "NYJ" }, { id: 21, abbr: "PHI" },
  { id: 22, abbr: "ARI" }, { id: 23, abbr: "PIT" }, { id: 24, abbr: "LAC" },
  { id: 25, abbr: "SF" }, { id: 26, abbr: "SEA" }, { id: 27, abbr: "TB" },
  { id: 28, abbr: "WSH" }, { id: 29, abbr: "CAR" }, { id: 30, abbr: "JAX" },
  { id: 33, abbr: "BAL" }, { id: 34, abbr: "HOU" },
];

export const ABBR_TO_ESPN_ID: Record<string, number> = Object.fromEntries(
  ESPN_TEAMS.map((t) => [t.abbr, t.id])
);
export const ESPN_ID_TO_ABBR: Record<string, string> = Object.fromEntries(
  ESPN_TEAMS.map((t) => [String(t.id), t.abbr])
);

// Common abbreviation drift between SportsData (used in our players table) and
// ESPN so injuries still join. Extend as needed.
const ABBR_ALIASES: Record<string, string> = {
  WAS: "WSH", JAC: "JAX", LA: "LAR", OAK: "LV", SD: "LAC", STL: "LAR",
};

export function normalizeAbbr(a: string | null | undefined): string {
  const up = (a || "").toUpperCase();
  return ABBR_ALIASES[up] || up;
}

function nowIso(): string {
  return new Date().toISOString();
}

async function fetchJson(url: string): Promise<any> {
  const res = await fetch(url, { headers: UA });
  if (!res.ok) {
    throw new Error(`ESPN ${res.status} ${res.statusText} for ${url}`);
  }
  return res.json();
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ---- ESPN endpoint wrappers (mirror services/espn.js) --------------------

function getLeagueNews(limit = 50) {
  return fetchJson(`${BASE_SITE}/news?limit=${limit}`);
}
function getPlayerNews(playerId: string, limit = 25) {
  return fetchJson(`${BASE_FANTASY}/news/players?limit=${limit}&playerId=${playerId}`);
}
/**
 * ESPN's core injuries endpoint returns a list of `{ $ref }` pointer stubs, not
 * inline injury objects. Dereference each ref (concurrency-limited) to get the
 * real injury records (status / comments / athlete ref). Returns the resolved
 * injury objects, skipping any that fail to fetch.
 */
async function getTeamInjuries(teamId: number): Promise<any[]> {
  const list = await fetchJson(`${BASE_CORE}/teams/${teamId}/injuries`);
  const refs: string[] = (list?.items || [])
    .map((it: any) => it?.$ref)
    .filter((r: any): r is string => typeof r === "string" && r.length > 0);

  const resolved: any[] = [];
  const CONCURRENCY = 5;
  for (let i = 0; i < refs.length; i += CONCURRENCY) {
    const batch = refs.slice(i, i + CONCURRENCY);
    const settled = await Promise.allSettled(batch.map((r) => fetchJson(r)));
    for (const s of settled) {
      if (s.status === "fulfilled" && s.value) resolved.push(s.value);
    }
    if (i + CONCURRENCY < refs.length) await sleep(60); // stay polite
  }
  return resolved;
}

function extractLink(article: any): string {
  return (
    article?.links?.web?.href ||
    article?.links?.mobile?.href ||
    `espn-article-${article?.id ?? Math.random().toString(36).slice(2)}`
  );
}
function extractImage(article: any): string | null {
  const img = Array.isArray(article?.images) ? article.images[0] : null;
  return img?.url || null;
}
function extractPlayerIdFromInjury(item: any): string | null {
  const ref: string = item?.athlete?.$ref || "";
  const tail = ref.split("/").pop() || "";
  return tail.split("?")[0] || null;
}

// ---- feed_status bookkeeping ---------------------------------------------

async function markStatus(
  db: D1Database,
  job: string,
  ok: boolean,
  error?: string
): Promise<void> {
  const now = nowIso();
  await db
    .prepare(
      `INSERT INTO feed_status (job, last_ok_at, last_run_at, last_error, ok)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(job) DO UPDATE SET
         last_ok_at  = CASE WHEN excluded.ok = 1 THEN excluded.last_run_at ELSE feed_status.last_ok_at END,
         last_run_at = excluded.last_run_at,
         last_error  = excluded.last_error,
         ok          = excluded.ok`
    )
    .bind(job, ok ? now : null, now, error ?? null, ok ? 1 : 0)
    .run();
}

// ---- Poll jobs (mirror jobs/*.js, writing to D1) -------------------------

/** League-wide news → news_items (deduped by link). Returns # inserted. */
export async function pollLeagueNews(db: D1Database): Promise<number> {
  try {
    const data = await getLeagueNews(50);
    const articles: any[] = data?.articles || [];
    const now = nowIso();
    let inserted = 0;

    for (const article of articles) {
      const res = await db
        .prepare(
          `INSERT OR IGNORE INTO news_items
             (source, headline, summary, link, image_url, published_at, player_id, team_id, fetched_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          "league",
          article.headline || "Untitled",
          article.description || null,
          extractLink(article),
          extractImage(article),
          article.published || now,
          null,
          null,
          now
        )
        .run();
      if (res.meta && (res.meta.changes ?? 0) > 0) inserted += 1;
    }
    await markStatus(db, "news", true);
    console.log(`[pollLeagueNews] fetched ${articles.length}, inserted ${inserted}`);
    return inserted;
  } catch (err: any) {
    await markStatus(db, "news", false, err.message || String(err));
    console.error("[pollLeagueNews] failed:", err.message || err);
    return 0;
  }
}

/** All-team injuries → injury_feed (upsert by player). Returns # upserted. */
export async function pollInjuries(db: D1Database): Promise<number> {
  let total = 0;
  let failures = 0;
  const now = nowIso();

  for (const team of ESPN_TEAMS) {
    try {
      const items: any[] = await getTeamInjuries(team.id);
      for (const item of items) {
        const playerId = extractPlayerIdFromInjury(item);
        if (!playerId) continue;
        const status = item.status || item.type?.description || "Unknown";
        const description = item.longComment || item.shortComment || null;
        await db
          .prepare(
            `INSERT INTO injury_feed
               (player_id, player_name, team_id, team_abbr, status, description, updated_at)
             VALUES (?, NULL, ?, ?, ?, ?, ?)
             ON CONFLICT(player_id) DO UPDATE SET
               team_id = excluded.team_id,
               team_abbr = excluded.team_abbr,
               status = excluded.status,
               description = excluded.description,
               updated_at = excluded.updated_at`
          )
          .bind(playerId, String(team.id), team.abbr, status, description, now)
          .run();
        total += 1;
      }
      await sleep(120); // stay polite to the unofficial API
    } catch (err: any) {
      failures += 1;
      console.error(`[pollInjuries] team ${team.abbr} failed:`, err.message || err);
    }
  }

  // Only flag the feed unhealthy if a large fraction of teams failed.
  const ok = failures < ESPN_TEAMS.length / 2;
  await markStatus(db, "injuries", ok, failures ? `${failures} team(s) failed` : undefined);
  console.log(`[pollInjuries] upserted ${total}, failures ${failures}`);
  return total;
}

/** Per-player news for watchlisted players → news_items. Returns # inserted. */
export async function pollWatchlistNews(db: D1Database, maxPlayers = 40): Promise<number> {
  try {
    const { results } = await db
      .prepare(`SELECT player_id FROM watchlist ORDER BY added_at DESC LIMIT ?`)
      .bind(maxPlayers)
      .all<{ player_id: string }>();
    const ids = (results || []).map((r) => r.player_id);
    const now = nowIso();
    let inserted = 0;

    for (const pid of ids) {
      try {
        const data = await getPlayerNews(pid, 15);
        const articles: any[] = data?.feed || data?.articles || [];
        for (const article of articles) {
          const res = await db
            .prepare(
              `INSERT OR IGNORE INTO news_items
                 (source, headline, summary, link, image_url, published_at, player_id, team_id, fetched_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
            )
            .bind(
              "player",
              article.headline || article.title || "Untitled",
              article.description || article.story || null,
              extractLink(article),
              extractImage(article),
              article.published || now,
              pid,
              null,
              now
            )
            .run();
          if (res.meta && (res.meta.changes ?? 0) > 0) inserted += 1;
        }
        await sleep(150);
      } catch (err: any) {
        console.error(`[pollWatchlistNews] player ${pid} failed:`, err.message || err);
      }
    }
    await markStatus(db, "player_news", true);
    console.log(`[pollWatchlistNews] polled ${ids.length} players, inserted ${inserted}`);
    return inserted;
  } catch (err: any) {
    await markStatus(db, "player_news", false, err.message || String(err));
    console.error("[pollWatchlistNews] failed:", err.message || err);
    return 0;
  }
}

/** Run every poll job in sequence. Called from the cron scheduled handler. */
export async function runNewsPolls(db: D1Database): Promise<{ news: number; injuries: number; playerNews: number }> {
  const news = await pollLeagueNews(db);
  const injuries = await pollInjuries(db);
  const playerNews = await pollWatchlistNews(db);
  return { news, injuries, playerNews };
}

// ---- Watchlist maintenance -----------------------------------------------

export async function addToWatchlist(db: D1Database, playerId: string): Promise<void> {
  if (!playerId) return;
  await db
    .prepare(`INSERT OR IGNORE INTO watchlist (player_id, added_at) VALUES (?, ?)`)
    .bind(playerId, nowIso())
    .run();
}

export async function removeFromWatchlist(db: D1Database, playerId: string): Promise<void> {
  await db.prepare(`DELETE FROM watchlist WHERE player_id = ?`).bind(playerId).run();
}

/** Seed the watchlist from everyone currently rostered in the league. */
export async function syncWatchlistFromRosters(db: D1Database): Promise<number> {
  const { results } = await db
    .prepare(`SELECT DISTINCT player_id FROM rosters`)
    .all<{ player_id: string }>();
  const now = nowIso();
  let n = 0;
  for (const r of results || []) {
    await db
      .prepare(`INSERT OR IGNORE INTO watchlist (player_id, added_at) VALUES (?, ?)`)
      .bind(r.player_id, now)
      .run();
    n += 1;
  }
  return n;
}

// ---- Read helpers (used by REST routes + frontend screens) ---------------

export interface NewsRow {
  id: number;
  source: string;
  headline: string;
  summary: string | null;
  link: string;
  image_url: string | null;
  published_at: string | null;
  player_id: string | null;
  team_id: string | null;
}

export async function getLeagueNewsRows(db: D1Database, limit = 20): Promise<NewsRow[]> {
  const { results } = await db
    .prepare(
      `SELECT id, source, headline, summary, link, image_url, published_at, player_id, team_id
       FROM news_items ORDER BY COALESCE(published_at, fetched_at) DESC LIMIT ?`
    )
    .bind(Math.min(limit, 100))
    .all<NewsRow>();
  return results || [];
}

export async function getPlayerNewsRows(db: D1Database, playerId: string, limit = 20): Promise<NewsRow[]> {
  const { results } = await db
    .prepare(
      `SELECT id, source, headline, summary, link, image_url, published_at, player_id, team_id
       FROM news_items WHERE player_id = ? ORDER BY COALESCE(published_at, fetched_at) DESC LIMIT ?`
    )
    .bind(playerId, Math.min(limit, 100))
    .all<NewsRow>();
  return results || [];
}

export async function getTeamNewsRows(db: D1Database, teamId: string, limit = 20): Promise<NewsRow[]> {
  const { results } = await db
    .prepare(
      `SELECT id, source, headline, summary, link, image_url, published_at, player_id, team_id
       FROM news_items WHERE team_id = ? ORDER BY COALESCE(published_at, fetched_at) DESC LIMIT ?`
    )
    .bind(teamId, Math.min(limit, 100))
    .all<NewsRow>();
  return results || [];
}

export interface InjuryRow {
  player_id: string;
  player_name: string | null;
  team_id: string | null;
  team_abbr: string | null;
  status: string | null;
  description: string | null;
  updated_at: string;
}

export async function getInjuryRows(db: D1Database, teamId?: string): Promise<InjuryRow[]> {
  const q = teamId
    ? db
        .prepare(`SELECT * FROM injury_feed WHERE team_id = ? ORDER BY updated_at DESC`)
        .bind(teamId)
    : db.prepare(`SELECT * FROM injury_feed ORDER BY updated_at DESC`);
  const { results } = await q.all<InjuryRow>();
  return results || [];
}

export interface FeedStatus {
  job: string;
  last_ok_at: string | null;
  last_run_at: string | null;
  last_error: string | null;
  ok: number;
}

export async function getFeedStatus(db: D1Database): Promise<FeedStatus[]> {
  const { results } = await db.prepare(`SELECT * FROM feed_status`).all<FeedStatus>();
  return results || [];
}

/**
 * Is the news feed degraded? True if any job is currently failing, or the
 * newest successful run is older than `staleMinutes`. Used to render the
 * Section-13 status note.
 */
export async function isFeedDegraded(db: D1Database, staleMinutes = 90): Promise<{ degraded: boolean; reason: string | null }> {
  const rows = await getFeedStatus(db);
  if (rows.length === 0) return { degraded: false, reason: null }; // never run yet — don't nag
  for (const r of rows) {
    if (r.ok === 0) {
      return { degraded: true, reason: `${r.job} feed error: ${r.last_error || "unknown"}` };
    }
  }
  const newest = rows
    .map((r) => (r.last_ok_at ? Date.parse(r.last_ok_at) : 0))
    .reduce((a, b) => Math.max(a, b), 0);
  if (newest && Date.now() - newest > staleMinutes * 60_000) {
    return { degraded: true, reason: `No fresh NFL data in over ${staleMinutes} minutes.` };
  }
  return { degraded: false, reason: null };
}
