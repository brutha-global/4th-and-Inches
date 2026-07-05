import { SHARED_CSS } from "./theme";

export function renderDraftRoom(leagueId: string): string {
  const homeIcon = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" /></svg>`;
  const rosterIcon = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /></svg>`;
  const matchupIcon = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" /></svg>`;
  const leagueIcon = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 002.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 012.916.52 6.003 6.003 0 01-5.395 4.972m0 0a6.726 6.726 0 01-2.749 1.35m0 0a6.772 6.772 0 01-3.044 0" /></svg>`;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>Draft Lobby - 4th & Inches</title>
  <style>
    ${SHARED_CSS}
    
    .timer-text {
      font-size: 56px;
      font-weight: 800;
      color: var(--text-light);
      font-family: 'Outfit', sans-serif;
      line-height: 1;
      margin-bottom: 8px;
    }
    
    .player-card {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 0;
      border-bottom: 1px solid var(--border-subtle);
    }
    
    .player-card-btn {
      background: transparent;
      color: var(--neon-green);
      border: 1px solid var(--neon-green);
      font-size: 10px;
      padding: 6px 12px;
      border-radius: 6px;
      cursor: pointer;
      font-weight: 800;
      text-transform: uppercase;
      transition: all 0.2s;
    }
    
    .player-card-btn:hover {
      background: var(--neon-green);
      color: #fff;
    }
  </style>
</head>
<body>

  <div class="app-container">
    
    <!-- Top Nav Replacement -->
    <div class="flex-between" style="margin-bottom: 32px;">
      <a href="/" style="color: var(--text-muted); text-decoration: none;">&larr;</a>
      <span class="font-bold text-sm">Mock Draft</span>
      <span style="width: 16px;"></span> <!-- Spacer -->
    </div>

    <!-- Clock / Status Area -->
    <div class="flex-col" style="align-items: center; text-align: center; margin-bottom: 40px;">
      <span class="text-xs font-bold text-muted" style="text-transform: uppercase; margin-bottom: 12px;">Round <span id="roundNum">1</span>, Pick <span id="pickNum">1</span></span>
      <div class="timer-text" id="timerDisplay">10:00</div>
      
      <div style="background: rgba(34, 197, 94, 0.1); padding: 8px 16px; border-radius: 100px; margin-top: 16px;">
        <span class="text-xs font-bold text-green">ON THE CLOCK</span>
      </div>
      
      <p id="turnNotice" style="font-size: 12px; font-weight: 600; color: var(--text-muted); margin-top: 16px;">Your turn to pick: <span class="text-green font-bold">NO</span></p>
    </div>

    <!-- Auto Queue Action -->
    <div style="margin-bottom: 32px;">
      <button class="btn-secondary" style="font-size: 12px;" onclick="updateQueue()">Sync Auto-Draft Queue</button>
    </div>

    <!-- Suggested Players -->
    <div class="flex-col">
      <span class="text-xs font-bold text-muted" style="text-transform: uppercase; margin-bottom: 8px;">Suggested Players</span>
      
      <div id="playerList">
        <div class="player-card">
          <div class="flex-col">
            <span class="font-bold text-sm">Patrick Mahomes</span>
            <span class="text-xs text-muted">QB - KC</span>
          </div>
          <button class="player-card-btn" onclick="makePick('PL_1')">Draft</button>
        </div>
        
        <div class="player-card">
          <div class="flex-col">
            <span class="font-bold text-sm">Christian McCaffrey</span>
            <span class="text-xs text-muted">RB - SF</span>
          </div>
          <button class="player-card-btn" onclick="makePick('PL_2')">Draft</button>
        </div>
      </div>
    </div>

    <!-- Recent Picks -->
    <div class="flex-col" style="margin-top: 32px;">
      <span class="text-xs font-bold text-muted" style="text-transform: uppercase; margin-bottom: 8px;">Recent Picks</span>
      <div id="picksLog" class="card" style="padding: 12px;">
        <p style="color: var(--text-muted); font-size: 12px;">Waiting for draft picks to begin...</p>
      </div>
    </div>

  </div>

  <!-- Tab Bar -->
  <nav class="tab-bar">
    <a href="/" class="tab-item">
      ${homeIcon}
      <span>Home</span>
    </a>
    <a href="#" class="tab-item">
      ${rosterIcon}
      <span>Roster</span>
    </a>
    <a href="/matchup/TEST" class="tab-item">
      ${matchupIcon}
      <span>Matchup</span>
    </a>
    <a href="/draft/${leagueId}" class="tab-item active">
      ${leagueIcon}
      <span>Draft</span>
    </a>
  </nav>

  <script>
    let ws;
    let timerInterval;

    function connectWS() {
      const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
      const host = window.location.host;
      ws = new WebSocket(proto + "//" + host + "/league/${leagueId}/draft/ws");

      ws.onopen = () => {
        console.log("WebSocket connected to draft DO");
        ws.send(JSON.stringify({
          type: "init",
          draftId: "DR_${leagueId}",
          teamId: "T_TEST_1",
          teams: ["T_TEST_1", "T_TEST_2"],
          timerDuration: 600
        }));
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        console.log("Draft message received", data);

        if (data.type === "state" || data.type === "your_turn" || data.type === "pick_made") {
          updateUI(data);
        }
      };

      ws.onclose = () => {
        setTimeout(connectWS, 2000);
      };
    }

    function makePick(playerId) {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: "make_pick",
          teamId: "T_TEST_1",
          playerId: playerId
        }));
      }
    }

    function updateQueue() {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: "queue_update",
          teamId: "T_TEST_1",
          playerQueue: ["PL_2", "PL_1"]
        }));
        alert("Queue sync complete!");
      }
    }

    function updateUI(data) {
      if (data.currentPick) {
        document.getElementById("pickNum").innerText = data.currentPick;
      }
      if (data.round) {
        document.getElementById("roundNum").innerText = data.round;
      }

      if (data.timer) {
        startTimer(data.timer);
      }

      if (data.picks && data.picks.length > 0) {
        const log = document.getElementById("picksLog");
        log.innerHTML = data.picks.map(p => \`
          <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 8px;">
            <span class="font-bold">R\${p.round} P\${p.pickNumber}</span>
            <span class="text-muted">\${p.playerId} &rarr; \${p.teamId}</span>
          </div>
        \`).join("");
      }
    }

    function startTimer(deadlineEpoch) {
      clearInterval(timerInterval);
      
      function tick() {
        const now = Math.floor(Date.now() / 1000);
        const remaining = Math.max(0, deadlineEpoch - now);
        
        const mins = Math.floor(remaining / 60);
        const secs = remaining % 60;
        document.getElementById("timerDisplay").innerText = 
          String(mins).padStart(2, '0') + ":" + String(secs).padStart(2, '0');

        if (remaining <= 0) {
          clearInterval(timerInterval);
        }
      }
      
      tick();
      timerInterval = setInterval(tick, 1000);
    }

    window.onload = connectWS;
  </script>
</body>
</html>
  `;
}

