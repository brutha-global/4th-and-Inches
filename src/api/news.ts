/**
 * REST + SSE routes for the ported NFL news/injury feed.
 *
 * Mirrors the original nfl-news-api surface, re-homed under /api/* on the
 * Worker:
 *   GET  /api/news?limit=            -> league-wide news
 *   GET  /api/news/team/:teamId      -> team news (ESPN numeric id)
 *   GET  /api/news/player/:playerId  -> player news
 *   GET  /api/injuries?teamId=       -> current injury report
 *   GET  /api/watchlist              -> list watched players
 *   POST /api/watchlist {playerId}   -> add to watchlist
 *   DELETE /api/watchlist/:playerId  -> remove
 *   GET  /api/feed/status            -> feed health (for degraded-feed note)
 *   POST /api/news/poll              -> manual poll trigger (dev/test)
 *   GET  /api/news/events            -> SSE: pushes new news + injury rows
 *
 * The SSE endpoint bridges D1 polling to a push stream (Workers have no shared
 * in-process event bus across isolates), so the Matchup/Home screens can show
 * live badges without the client polling REST.
 */

import {
  getLeagueNewsRows,
  getTeamNewsRows,
  getPlayerNewsRows,
  getInjuryRows,
  getFeedStatus,
  addToWatchlist,
  removeFromWatchlist,
  runNewsPolls,
} from "../lib/nflNews";

const J = { "Content-Type": "application/json" };

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: J });
}

export async function handleNewsRoutes(
  url: URL,
  request: Request,
  db: D1Database
): Promise<Response | null> {
  const p = url.pathname;
  const method = request.method;

  // GET /api/news
  if (p === "/api/news" && method === "GET") {
    const limit = parseInt(url.searchParams.get("limit") || "20", 10);
    const items = await getLeagueNewsRows(db, limit);
    return json({ count: items.length, items });
  }

  // GET /api/news/team/:teamId
  const teamNews = p.match(/^\/api\/news\/team\/([^/]+)$/);
  if (teamNews && method === "GET") {
    const limit = parseInt(url.searchParams.get("limit") || "20", 10);
    const items = await getTeamNewsRows(db, teamNews[1], limit);
    return json({ count: items.length, items });
  }

  // GET /api/news/player/:playerId
  const playerNews = p.match(/^\/api\/news\/player\/([^/]+)$/);
  if (playerNews && method === "GET") {
    const limit = parseInt(url.searchParams.get("limit") || "20", 10);
    const items = await getPlayerNewsRows(db, playerNews[1], limit);
    return json({ count: items.length, items });
  }

  // GET /api/injuries
  if (p === "/api/injuries" && method === "GET") {
    const teamId = url.searchParams.get("teamId") || undefined;
    const items = await getInjuryRows(db, teamId || undefined);
    return json({ count: items.length, items });
  }

  // GET /api/watchlist
  if (p === "/api/watchlist" && method === "GET") {
    const { results } = await db
      .prepare(`SELECT player_id, added_at FROM watchlist ORDER BY added_at DESC`)
      .all();
    return json({ count: (results || []).length, items: results || [] });
  }

  // POST /api/watchlist
  if (p === "/api/watchlist" && method === "POST") {
    const body: any = await request.json().catch(() => ({}));
    if (!body.playerId) return json({ error: "playerId required" }, 400);
    await addToWatchlist(db, String(body.playerId));
    return json({ ok: true, playerId: String(body.playerId) });
  }

  // DELETE /api/watchlist/:playerId
  const wlDel = p.match(/^\/api\/watchlist\/([^/]+)$/);
  if (wlDel && method === "DELETE") {
    await removeFromWatchlist(db, wlDel[1]);
    return json({ ok: true, playerId: wlDel[1] });
  }

  // GET /api/feed/status
  if (p === "/api/feed/status" && method === "GET") {
    const rows = await getFeedStatus(db);
    return json({ jobs: rows });
  }

  // POST /api/news/poll  (manual trigger — dev/test/first-load)
  if (p === "/api/news/poll" && method === "POST") {
    const result = await runNewsPolls(db);
    return json({ ok: true, ...result });
  }

  // GET /api/news/events  (SSE)
  if (p === "/api/news/events" && method === "GET") {
    return sseStream(db);
  }

  return null; // not a news route
}

/**
 * SSE stream. Sends a snapshot of the latest news + injuries immediately, then
 * every 15s emits any rows newer than the last high-water mark. Closes cleanly
 * when the client disconnects (request.signal).
 */
function sseStream(db: D1Database): Response {
  const encoder = new TextEncoder();
  let lastNewsId = 0;
  let lastInjuryTs = "";
  let timer: any = null;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        );
      };

      // initial snapshot
      const news = await getLeagueNewsRows(db, 10);
      lastNewsId = news.reduce((m, n) => Math.max(m, n.id), 0);
      send("snapshot", { news });

      const tick = async () => {
        try {
          const { results: freshNews } = await db
            .prepare(
              `SELECT id, source, headline, summary, link, image_url, published_at, player_id, team_id
               FROM news_items WHERE id > ? ORDER BY id ASC LIMIT 20`
            )
            .bind(lastNewsId)
            .all<any>();
          for (const row of freshNews || []) {
            lastNewsId = Math.max(lastNewsId, row.id);
            send("news", row);
          }

          const { results: freshInj } = await db
            .prepare(
              `SELECT * FROM injury_feed WHERE updated_at > ? ORDER BY updated_at ASC LIMIT 50`
            )
            .bind(lastInjuryTs || "")
            .all<any>();
          for (const row of freshInj || []) {
            if (row.updated_at > lastInjuryTs) lastInjuryTs = row.updated_at;
            send("injury", row);
          }

          send("ping", { t: Date.now() });
        } catch {
          // keep the stream alive across transient D1 hiccups
        }
      };

      timer = setInterval(tick, 15000);
    },
    cancel() {
      if (timer) clearInterval(timer);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
