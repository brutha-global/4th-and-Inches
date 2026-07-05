import { Env } from "../lib/sportsdata";

interface Pick {
  round: number;
  pickNumber: number;
  teamId: string;
  playerId: string;
}

export class DraftRoom {
  state: DurableObjectState;
  env: Env;

  // In-memory draft states
  draftId: string = "";
  status: "Scheduled" | "Active" | "Completed" = "Scheduled";
  currentPick: number = 1;
  round: number = 1;
  teams: string[] = []; // Draft order team IDs
  picks: Pick[] = [];
  queues = new Map<string, string[]>(); // teamId -> playerQueueIds
  timer: number = 0; // Deadline timestamp in epoch seconds
  timerDuration: number = 600; // 10 minutes default in seconds
  sessions = new Map<WebSocket, string>(); // WebSocket -> teamId

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

      if (data.type === "init") {
        const { draftId, teamId, teams, timerDuration } = data;
        this.draftId = draftId;
        this.sessions.set(ws, teamId);

        if (this.status === "Scheduled" && teams) {
          this.teams = teams;
          this.status = "Active";
          this.timerDuration = timerDuration || 600;
          this.timer = Math.floor(Date.now() / 1000) + this.timerDuration;
        }

        ws.send(JSON.stringify({
          type: "state",
          status: this.status,
          currentPick: this.currentPick,
          round: this.round,
          teams: this.teams,
          picks: this.picks,
          timer: this.timer
        }));
        return;
      }

      if (data.type === "queue_update") {
        const teamId = this.sessions.get(ws) || data.teamId;
        const { playerQueue } = data;
        if (teamId && playerQueue) {
          this.queues.set(teamId, playerQueue);
          ws.send(JSON.stringify({ type: "queue_updated", playerQueue }));
        }
        return;
      }

      if (data.type === "make_pick") {
        const teamId = this.sessions.get(ws) || data.teamId;
        const { playerId } = data;

        const validation = this.validatePickTurn(teamId, playerId);
        if (!validation.ok) {
          ws.send(JSON.stringify({ type: "pick_denied", reason: validation.reason }));
          return;
        }

        await this.recordPick(teamId, playerId);
        return;
      }

      if (data.type === "ping") {
        ws.send(JSON.stringify({ type: "pong" }));
        return;
      }
    } catch (e: any) {
      console.error("DraftRoom DO error", e);
      ws.send(JSON.stringify({ type: "error", message: e.message || String(e) }));
    }
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean): Promise<void> {
    this.sessions.delete(ws);
  }

  async webSocketError(ws: WebSocket, error: any): Promise<void> {
    this.sessions.delete(ws);
  }

  // --- Helper Methods ---

  private validatePickTurn(teamId: string, playerId: string): { ok: boolean; reason?: string } {
    if (this.status !== "Active") {
      return { ok: false, reason: "Draft is not currently active" };
    }

    // Determine whose turn it is using Snake Draft logic
    const currentTurnTeamId = this.getCurrentTurnTeam();
    if (currentTurnTeamId !== teamId) {
      return { ok: false, reason: `Not your turn. Active drafter is: ${currentTurnTeamId}` };
    }

    // Ensure player is not already selected
    const alreadyPicked = this.picks.some(p => p.playerId === playerId);
    if (alreadyPicked) {
      return { ok: false, reason: "Player already selected in this draft" };
    }

    return { ok: true };
  }

  private getCurrentTurnTeam(): string {
    if (this.teams.length === 0) return "";
    
    // Snake draft math:
    // Round 1 (1-based index 0): pick 1-12 (normal order)
    // Round 2 (1-based index 1): pick 13-24 (reverse order)
    const totalTeams = this.teams.length;
    const zeroIndexedPick = this.currentPick - 1;
    const currentRoundZeroIndex = Math.floor(zeroIndexedPick / totalTeams);
    const pickInRound = zeroIndexedPick % totalTeams;

    const isReverseRound = currentRoundZeroIndex % 2 !== 0;
    if (isReverseRound) {
      return this.teams[totalTeams - 1 - pickInRound];
    } else {
      return this.teams[pickInRound];
    }
  }

  private async recordPick(teamId: string, playerId: string): Promise<void> {
    const pick: Pick = {
      round: this.round,
      pickNumber: this.currentPick,
      teamId,
      playerId
    };
    this.picks.push(pick);

    // Broadcast pick made to all connected sessions
    this.broadcast({
      type: "pick_made",
      pick,
      nextTeam: this.getCurrentTurnTeam()
    });

    const maxRosterSize = 16;
    const maxPicks = this.teams.length * maxRosterSize;

    if (this.currentPick >= maxPicks) {
      // Draft Complete!
      this.status = "Completed";
      await this.saveDraftToDatabase();
      this.broadcast({
        type: "draft_complete",
        picks: this.picks
      });
    } else {
      // Advance to next draft pick
      this.currentPick++;
      this.round = Math.floor((this.currentPick - 1) / this.teams.length) + 1;
      this.timer = Math.floor(Date.now() / 1000) + this.timerDuration;

      // Broadcast new active turn
      this.broadcast({
        type: "your_turn",
        teamId: this.getCurrentTurnTeam(),
        timer: this.timer
      });
    }
  }

  private async saveDraftToDatabase(): Promise<void> {
    try {
      // 1. Insert draft status
      await this.env.DB.prepare(`
        INSERT INTO drafts (draft_id, league_id, type, status, current_pick, round)
        VALUES (?, (SELECT league_id FROM teams WHERE team_id = ? LIMIT 1), 'Snake', 'Completed', ?, ?)
      `).bind(this.draftId, this.teams[0], this.currentPick, this.round).run();

      // 2. Insert pick details and rosters
      for (const p of this.picks) {
        const pick_id = `pick_${this.draftId}_${p.pickNumber}`;
        const now = Math.floor(Date.now() / 1000);

        await this.env.DB.prepare(`
          INSERT INTO draft_picks (pick_id, draft_id, round, pick_number, team_id, player_id, timestamp)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).bind(pick_id, this.draftId, p.round, p.pickNumber, p.teamId, p.playerId, now).run();

        // Assign roster slots: First 9 picks as starters (QB, RB, WR, TE, FLEX, K, DEF, etc.) and rest bench
        // For simplicity:
        // Pick 1: QB, Pick 2: RB, Pick 3: RB, Pick 4: WR, Pick 5: WR, Pick 6: TE, Pick 7: FLEX, Pick 8: K, Pick 9: DEF, rest: BENCH
        const teamPicks = this.picks.filter(x => x.teamId === p.teamId);
        const playerIndex = teamPicks.findIndex(x => x.playerId === p.playerId) + 1;

        let slot_type = "BENCH";
        let is_starter = 0;

        if (playerIndex === 1) { slot_type = "QB"; is_starter = 1; }
        else if (playerIndex === 2 || playerIndex === 3) { slot_type = "RB"; is_starter = 1; }
        else if (playerIndex === 4 || playerIndex === 5) { slot_type = "WR"; is_starter = 1; }
        else if (playerIndex === 6) { slot_type = "TE"; is_starter = 1; }
        else if (playerIndex === 7) { slot_type = "FLEX"; is_starter = 1; }
        else if (playerIndex === 8) { slot_type = "K"; is_starter = 1; }
        else if (playerIndex === 9) { slot_type = "DEF"; is_starter = 1; }

        const roster_id = `ros_${p.teamId}_${p.playerId}_1`;
        await this.env.DB.prepare(`
          INSERT INTO rosters (roster_id, team_id, player_id, slot_type, week, is_starter)
          VALUES (?, ?, ?, ?, 1, ?)
        `).bind(roster_id, p.teamId, p.playerId, slot_type, is_starter).run();
      }
    } catch (err) {
      console.error("Failed to persist completed draft state to D1", err);
    }
  }

  private broadcast(message: any): void {
    const sockets = Array.from(this.sessions.keys());
    const payload = JSON.stringify(message);
    for (const s of sockets) {
      try {
        s.send(payload);
      } catch (err) {
        console.error("Failed to broadcast draft state to websocket connection", err);
      }
    }
  }
}
