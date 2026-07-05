import { SHARED_CSS } from "./theme";

export function renderDashboard(
  coach: any,
  recap: any,
  rankings: any[]
): string {
  const homeIcon = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" /></svg>`;
  const rosterIcon = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /></svg>`;
  const matchupIcon = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" /></svg>`;
  const leagueIcon = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 002.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 012.916.52 6.003 6.003 0 01-5.395 4.972m0 0a6.726 6.726 0 01-2.749 1.35m0 0a6.772 6.772 0 01-3.044 0" /></svg>`;

  const rankRows = rankings.map((r: any) => `
    <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid var(--border-subtle);">
      <div style="display: flex; align-items: center; gap: 12px;">
        <span class="outfit-font text-green" style="font-weight: 800; font-size: 16px;">#${r.rank}</span>
        <span style="font-weight: 600;">${r.name}</span>
      </div>
      <span style="font-size: 12px; color: var(--text-muted);">${r.blurb}</span>
    </div>
  `).join("");

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>Dashboard - 4th & Inches</title>
  <style>
    ${SHARED_CSS}
  </style>
</head>
<body>
  <div class="app-container">
    
    <!-- Header Area -->
    <div class="flex-between" style="margin-bottom: 24px;">
      <div class="flex-col">
        <span class="text-sm text-muted">Good Morning,</span>
        <span class="font-bold text-lg">Coach ${coach.coach_id || 'Alex'}</span>
      </div>
      <div style="text-align: right;">
        <div class="text-sm text-muted">2024 Season</div>
        <div class="text-xs text-green">1st Place</div>
      </div>
    </div>

    <!-- Main Score Widget -->
    <div class="glass-card flex-col gap-4">
      <div class="flex-between">
        <div class="flex-col">
          <span class="text-xs text-muted">Your Team</span>
          <span class="font-semibold text-sm">Gridiron Giants</span>
        </div>
        <span class="font-bold text-green">3-1</span>
      </div>

      <div class="flex-between align-end">
        <div class="flex-col">
          <span class="outfit-font" style="font-size: 40px; font-weight: 800; line-height: 1;">112.6</span>
          <span class="text-xs text-muted">Proj 120.4</span>
        </div>
        <span class="text-xs font-semibold text-muted">WEEK 5 MATCHUP</span>
        <div class="flex-col" style="text-align: right;">
          <span class="outfit-font" style="font-size: 24px; font-weight: 600; line-height: 1; color: var(--text-muted);">98.7</span>
          <span class="text-xs text-muted">Proj 104.2</span>
        </div>
      </div>
      
      <a href="/matchup/TEST" class="btn-primary" style="margin-top: 8px;">VIEW MATCHUP</a>
    </div>

    <!-- Power Rankings / News -->
    <div class="card">
      <div class="flex-between" style="margin-bottom: 12px;">
        <span class="font-bold">League News</span>
      </div>
      <div class="flex-col gap-2">
        ${rankRows || '<div class="text-sm text-muted">No news updates.</div>'}
      </div>
    </div>

    <!-- Draft Lobby Button (For testing) -->
    <div style="margin-top: 24px;">
      <a href="/draft/TEST" class="btn-secondary">Enter Draft Lobby</a>
    </div>

  </div>

  <!-- Tab Bar -->
  <nav class="tab-bar">
    <a href="/" class="tab-item active">
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
    <a href="/draft/TEST" class="tab-item">
      ${leagueIcon}
      <span>Draft</span>
    </a>
  </nav>

</body>
</html>
  `;
}

