import { renderPage } from "./theme";

export function renderDraftRoom(leagueId: string): string {
  const extraCss = `
    .clock-ring {
      position: relative; width: 132px; height: 132px; margin: 0 auto 8px;
    }
    .clock-ring svg { transform: rotate(-90deg); }
    .clock-ring .ring-bg { stroke: var(--bg-elevated); }
    .clock-ring .ring-fg { stroke: var(--neon-green); stroke-linecap: round;
      transition: stroke-dashoffset 1s linear, stroke .3s; }
    .clock-ring.urgent .ring-fg { stroke: var(--neon-red); }
    .timer-text {
      position:absolute; inset:0; display:flex; align-items:center; justify-content:center;
      font-size:34px; font-weight:800; font-family:'Outfit',sans-serif; line-height:1;
    }
    .clock-ring.urgent .timer-text { color: var(--neon-red); }
    .draft-player {
      display:flex; justify-content:space-between; align-items:center;
      padding:12px 0; border-bottom:1px solid var(--border-subtle);
    }
    .player-card-btn {
      background: transparent; color: var(--neon-green);
      border: 1px solid var(--neon-green); font-size:10px;
      padding:7px 14px; border-radius:8px; cursor:pointer;
      font-weight:800; text-transform:uppercase; transition:all .2s;
    }
    .player-card-btn:hover { background: var(--neon-green); color:#06210F; }
    .player-card-btn:active { transform: scale(0.94); }
    .your-turn-pill { animation: turnGlow 1.4s ease-in-out infinite; }
    @keyframes turnGlow {
      0%,100% { box-shadow: 0 0 0 0 rgba(34,197,94,.5); }
      50% { box-shadow: 0 0 18px 2px rgba(34,197,94,.4); }
    }
  `;

  const body = `
    <div class="page-header fade-up fade-up-1">
      <a href="/league/${leagueId}" class="header-back">←</a>
      <span class="font-bold text-sm">Mock Draft</span>
      <span class="chip">Snake</span>
    </div>

    <!-- Clock -->
    <div class="flex-col items-center fade-up fade-up-1" style="text-align:center;margin-bottom:32px;">
      <span class="section-label" style="margin-bottom:12px;">Round <span id="roundNum">1</span> · Pick <span id="pickNum">1</span></span>
      <div class="clock-ring" id="clockRing">
        <svg width="132" height="132" viewBox="0 0 132 132">
          <circle class="ring-bg" cx="66" cy="66" r="58" fill="none" stroke-width="8"/>
          <circle class="ring-fg" id="ringFg" cx="66" cy="66" r="58" fill="none" stroke-width="8"
            stroke-dasharray="364.4" stroke-dashoffset="0"/>
        </svg>
        <div class="timer-text" id="timerDisplay">10:00</div>
      </div>
      <div class="pill pill-green mt-4" style="padding:8px 18px;">ON THE CLOCK</div>
      <p id="turnNotice" class="text-xs font-semibold text-muted mt-4">Your pick: <span class="text-muted font-bold">Waiting…</span></p>
    </div>

    <button class="btn-secondary mb-6 fade-up fade-up-2" onclick="updateQueue()">Sync Auto-Draft Queue</button>

    <!-- Best available -->
    <div class="card fade-up fade-up-3">
      <span class="section-label">Best Available</span>
      <div id="playerList">
        ${[
          { name: "Christian McCaffrey", meta: "RB · SF", adp: "1.2", proj: "22.4", id: "PL_2" },
          { name: "Patrick Mahomes", meta: "QB · KC", adp: "2.1", proj: "24.8", id: "PL_1" },
          { name: "Tyreek Hill", meta: "WR · MIA", adp: "3.4", proj: "20.1", id: "PL_5" },
          { name: "Bijan Robinson", meta: "RB · ATL", adp: "4.0", proj: "18.9", id: "PL_6" },
        ].map(p => `
          <div class="draft-player">
            <div class="flex items-center gap-3">
              <span class="position-badge pos-${p.meta.split(" · ")[0]}">${p.meta.split(" · ")[0]}</span>
              <div class="flex-col">
                <span class="font-semibold text-sm">${p.name}</span>
                <span class="text-2xs text-muted">${p.meta.split(" · ")[1]} · ADP ${p.adp} · ${p.proj} proj</span>
              </div>
            </div>
            <button class="player-card-btn" onclick="makePick('${p.id}')">Draft</button>
          </div>`).join("")}
      </div>
    </div>

    <!-- Recent picks ticker -->
    <div class="card fade-up fade-up-4">
      <span class="section-label">Recent Picks</span>
      <div id="picksLog"><p class="text-xs text-muted">Waiting for the draft to begin…</p></div>
    </div>
  `;

  const extraJs = `
    let ws, timerInterval;
    const RING = 364.4;
    function connectWS() {
      const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
      ws = new WebSocket(proto + '//' + location.host + '/league/${leagueId}/draft/ws');
      ws.onopen = () => ws.send(JSON.stringify({ type:'init', draftId:'DR_${leagueId}', teamId:'T_TEST_1', teams:['T_TEST_1','T_TEST_2'], timerDuration:600 }));
      ws.onmessage = (e) => { const d = JSON.parse(e.data); if (['state','your_turn','pick_made'].includes(d.type)) updateUI(d); if (d.type==='your_turn') yourTurn(); };
      ws.onclose = () => setTimeout(connectWS, 2000);
    }
    function makePick(id){ if(ws&&ws.readyState===1){ ws.send(JSON.stringify({type:'make_pick',teamId:'T_TEST_1',playerId:id})); if(navigator.vibrate)navigator.vibrate(20);} }
    function updateQueue(){ if(ws&&ws.readyState===1){ ws.send(JSON.stringify({type:'queue_update',teamId:'T_TEST_1',playerQueue:['PL_2','PL_1']})); } }
    function yourTurn(){
      const n = document.getElementById('turnNotice');
      n.innerHTML = 'Your pick: <span class="text-green font-bold">NOW</span>';
      document.querySelector('.pill.pill-green').classList.add('your-turn-pill');
      if(navigator.vibrate) navigator.vibrate([40,60,40]);
    }
    function updateUI(d){
      if(d.currentPick) document.getElementById('pickNum').innerText = d.currentPick;
      if(d.round) document.getElementById('roundNum').innerText = d.round;
      if(d.timer) startTimer(d.timer, d.timerDuration || 600);
      if(d.picks && d.picks.length){
        document.getElementById('picksLog').innerHTML = d.picks.map(p =>
          '<div class="flex-between text-xs" style="padding:6px 0;"><span class="font-bold">R'+p.round+' P'+p.pickNumber+'</span><span class="text-muted">'+p.playerId+' → '+p.teamId+'</span></div>'
        ).join('');
      }
    }
    function startTimer(deadline, duration){
      clearInterval(timerInterval);
      const ring = document.getElementById('clockRing');
      const fg = document.getElementById('ringFg');
      function tick(){
        const now = Math.floor(Date.now()/1000);
        const remaining = Math.max(0, deadline - now);
        const m = Math.floor(remaining/60), s = remaining%60;
        document.getElementById('timerDisplay').innerText = String(m).padStart(2,'0')+':'+String(s).padStart(2,'0');
        const frac = Math.min(1, remaining/duration);
        fg.style.strokeDashoffset = (RING * (1 - frac)).toFixed(1);
        ring.classList.toggle('urgent', remaining <= 30);
        if(remaining<=0) clearInterval(timerInterval);
      }
      tick(); timerInterval = setInterval(tick, 1000);
    }
    window.onload = connectWS;
  `;

  return renderPage({ title: "Draft Room", body, active: "league", extraCss, extraJs });
}
