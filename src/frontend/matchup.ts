import { SHARED_CSS } from "./theme";

export function renderMatchupRoom(matchup: any): string {
  const t1Score = matchup.team1_score || 112.6;
  const t2Score = matchup.team2_score || 98.7;
  const total = t1Score + t2Score || 1;
  const t1Pct = Math.floor((t1Score / total) * 100);

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
  <title>War Room - 4th & Inches</title>
  <style>
    ${SHARED_CSS}
    
    .probability-track {
      width: 100%;
      height: 6px;
      background: var(--bg-card);
      border-radius: 3px;
      overflow: hidden;
      margin-top: 8px;
    }
    
    .probability-fill {
      height: 100%;
      width: ${t1Pct}%;
      background: var(--neon-green);
      transition: width 0.5s ease-in-out;
    }
    
    .player-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 0;
      border-bottom: 1px solid var(--border-subtle);
    }
    
    .btn-action-sub {
      background: transparent;
      color: var(--text-light);
      border: 1px solid var(--border-subtle);
      font-size: 10px;
      padding: 6px 10px;
      border-radius: 6px;
      cursor: pointer;
      font-weight: 600;
      text-transform: uppercase;
      transition: all 0.2s;
    }
    
    .btn-action-sub:hover {
      background: var(--bg-card);
      border-color: var(--neon-green);
      color: var(--neon-green);
    }
    
    .position-badge {
      font-size: 10px;
      background: var(--bg-card);
      border: 1px solid var(--border-subtle);
      color: var(--text-muted);
      padding: 2px 6px;
      border-radius: 4px;
      font-weight: 800;
      min-width: 28px;
      text-align: center;
    }
  </style>
</head>
<body>

  <div class="app-container">
    
    <!-- Top Nav Replacement -->
    <div class="flex-between" style="margin-bottom: 24px;">
      <a href="/" style="color: var(--text-muted); text-decoration: none;">&larr;</a>
      <span class="font-bold text-sm">Week 5</span>
      <span style="width: 16px;"></span> <!-- Spacer -->
    </div>

    <!-- Matchup Score Card -->
    <div class="flex-col" style="margin-bottom: 32px;">
      <div class="flex-between align-end">
        <div class="flex-col">
          <span class="text-xs text-muted" style="margin-bottom: 4px;">Gridiron Giants</span>
          <span class="outfit-font" style="font-size: 36px; font-weight: 800; line-height: 1;">${t1Score.toFixed(1)}</span>
        </div>
        
        <span class="text-xs text-muted font-bold" style="padding-bottom: 6px;">VS</span>
        
        <div class="flex-col" style="text-align: right;">
          <span class="text-xs text-muted" style="margin-bottom: 4px;">Rushing Royalty</span>
          <span class="outfit-font" style="font-size: 36px; font-weight: 800; line-height: 1; color: var(--text-muted);">${t2Score.toFixed(1)}</span>
        </div>
      </div>
      
      <!-- Win Probability -->
      <div style="margin-top: 16px;">
        <div class="flex-between text-xs font-semibold">
          <span class="text-green">WIN PROBABILITY</span>
          <span>${t1Pct}%</span>
        </div>
        <div class="probability-track">
          <div class="probability-fill"></div>
        </div>
      </div>
    </div>

    <!-- Tokens / Action Panel Side -->
    <div class="card" style="margin-bottom: 24px; padding: 12px 16px;">
      <div class="flex-between" style="margin-bottom: 8px;">
        <span class="text-xs font-bold text-muted">COACH TOKENS</span>
      </div>
      <div class="flex-between text-sm" style="padding: 4px 0;">
        <span>Injury Insurance</span>
        <span class="text-green font-bold" id="insuranceCount">1</span>
      </div>
      <div class="flex-between text-sm" style="padding: 4px 0;">
        <span>Coach Challenge</span>
        <span class="text-green font-bold" id="challengeCount">1</span>
      </div>
    </div>

    <!-- Roster View -->
    <div class="flex-col">
      <span class="text-xs font-bold text-muted" style="margin-bottom: 8px;">LINEUP COMPARISON</span>
      
      <div class="player-row">
        <div style="display: flex; gap: 12px; align-items: center;">
          <span class="position-badge">QB</span>
          <div class="flex-col">
            <span class="font-bold text-sm">P. Mahomes</span>
            <span class="text-xs text-muted">KC - (Active)</span>
          </div>
        </div>
        <div style="display: flex; gap: 12px; align-items: center;">
          <button class="btn-action-sub" onclick="subRequest('coach_challenge', 'PL_1', 'PL_2')">Challenge</button>
          <span class="text-green font-bold">14.5</span>
        </div>
      </div>

      <div class="player-row">
        <div style="display: flex; gap: 12px; align-items: center;">
          <span class="position-badge">RB</span>
          <div class="flex-col">
            <span class="font-bold text-sm">B. Hall</span>
            <span class="text-xs text-muted">NYJ - (Active)</span>
          </div>
        </div>
        <div style="display: flex; gap: 12px; align-items: center;">
          <button class="btn-action-sub" onclick="subRequest('injury_insurance', 'PL_3', 'PL_4')">Insure</button>
          <span class="text-green font-bold">22.0</span>
        </div>
      </div>

      <div class="player-row" style="border-bottom: none;">
        <div style="display: flex; gap: 12px; align-items: center;">
          <span class="position-badge">WR</span>
          <div class="flex-col">
            <span class="font-bold text-sm">J. Jefferson</span>
            <span class="text-xs text-muted">MIN - (Active)</span>
          </div>
        </div>
        <div style="display: flex; gap: 12px; align-items: center;">
          <button class="btn-action-sub" onclick="subRequest('tactical_timeout', 'PL_5', 'PL_6')">Timeout</button>
          <span class="text-green font-bold">18.2</span>
        </div>
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
    <a href="/matchup/TEST" class="tab-item active">
      ${matchupIcon}
      <span>Matchup</span>
    </a>
    <a href="/draft/TEST" class="tab-item">
      ${leagueIcon}
      <span>Draft</span>
    </a>
  </nav>

  <script>
    async function subRequest(type, playerId, replacementId) {
      const payload = {
        type: "substitution_request",
        subType: type,
        playerId: playerId,
        replacementId: replacementId,
        teamId: "T_TEST_1",
        leagueId: "L_TEST"
      };

      // In production, this goes over WebSocket to LeagueRoom DO.
      alert("Triggering Live " + type.replace('_', ' ') + " swap for player " + playerId);
    }
  </script>
</body>
</html>
  `;
}

