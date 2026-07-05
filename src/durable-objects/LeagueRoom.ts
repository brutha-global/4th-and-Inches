import { Env } from "../lib/sportsdata";
import { processSubstitution } from "../lib/substitutions";

export class LeagueRoom {
  state: DurableObjectState;
  env: Env;
  sessions = new Map<WebSocket, { leagueId: string; teamId: string }>();

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected websocket upgrade", { status: 400 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    this.state.acceptWebSocket(server);

    return new Response(null, {
      status: 101,
      webSocket: client
    });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    try {
      const msgStr = typeof message === "string" ? message : new TextDecoder().decode(message);
      const data = JSON.parse(msgStr);

      if (data.type === "subscribe") {
        const { leagueId, teamId } = data;
        this.sessions.set(ws, { leagueId, teamId });

        const snapshot = await this.getFullStateSnapshot(leagueId);
        ws.send(JSON.stringify({
          type: "full_state_snapshot",
          ...snapshot
        }));
        return;
      }

      if (data.type === "ping") {
        ws.send(JSON.stringify({ type: "pong" }));
        return;
      }

      if (data.type === "substitution_request") {
        const { subType, playerId, replacementId, teamId } = data;
        const session = this.sessions.get(ws);
        const leagueId = session?.leagueId || data.leagueId;

        if (!leagueId) {
          ws.send(JSON.stringify({ type: "substitution_denied", teamId, reason: "No league subscription active" }));
          return;
        }

        const league = await this.env.DB.prepare("SELECT season, week FROM leagues WHERE league_id = ?").bind(leagueId).first<{ season: number; week: number }>();
        const week = league?.week || 1;
        const season = league?.season || 2026;

        const subRes = await processSubstitution({
          leagueId,
          teamId,
          week,
          season,
          type: subType,
          playerId,
          replacementId
        }, this.env.DB);

        if (subRes.success) {
          this.broadcast({
            type: "substitution_approved",
            teamId,
            outPlayer: playerId,
            inPlayer: replacementId,
            reason: subRes.reason || "Substitution approved"
          });
        } else {
          ws.send(JSON.stringify({
            type: "substitution_denied",
            teamId,
            reason: subRes.reason || "Validation failed"
          }));
        }
        return;
      }
    } catch (e: any) {
      console.error("Durable Object WebSocket error", e);
      ws.send(JSON.stringify({ type: "error", message: e.message || String(e) }));
    }
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean): Promise<void> {
    console.log(`WebSocket closed: code=${code}, reason=${reason}`);
    this.sessions.delete(ws);
  }

  async webSocketError(ws: WebSocket, error: any): Promise<void> {
    console.error("WebSocket error state:", error);
    this.sessions.delete(ws);
  }

  private broadcast(message: any): void {
    let sockets: WebSocket[] = [];
    try {
      sockets = this.state.getWebSockets();
    } catch {
      sockets = Array.from(this.sessions.keys());
    }
    if (sockets.length === 0) {
      sockets = Array.from(this.sessions.keys());
    }

    const payload = JSON.stringify(message);
    for (const s of sockets) {
      try {
        s.send(payload);
      } catch (err) {
        console.error("Failed to send message to client socket", err);
      }
    }
  }

  private async getFullStateSnapshot(leagueId: string): Promise<any> {
    const league = await this.env.DB.prepare("SELECT * FROM leagues WHERE league_id = ?").bind(leagueId).first<any>();
    const season = league?.season || 2026;
    const week = league?.week || 1;

    const { results: teams } = await this.env.DB.prepare("SELECT * FROM teams WHERE league_id = ?").bind(leagueId).all<any>();
    const { results: matchups } = await this.env.DB.prepare(`
      SELECT * FROM games 
      WHERE season = ? AND week = ?
    `).bind(season, week).all<any>();

    return {
      leagueId,
      week,
      season,
      teams,
      matchups
    };
  }
}
