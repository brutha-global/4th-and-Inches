import { renderPage, SPARK } from "./theme";

export function renderDashboard(
  coach: any,
  recap: any,
  rankings: any[]
): string {
  const coachName = (coach && coach.coach_id) ? String(coach.coach_id).replace(/^T_/, "").replace(/_/g, " ") : "Alex";
  const level = (coach && coach.level) || 1;
  const title = (coach && coach.title) || "Rookie";

  const newsRows = (rankings || []).map((r: any, i: number) => `
    <div class="player-row card-tappable" style="padding: 12px 8px; margin: 0 -8px; border-radius: 10px;">
      <div class="flex items-center gap-3">
        <span class="outfit-font text-green font-black" style="font-size: 16px; min-width: 26px;">#${r.rank}</span>
        <div class="flex-col">
          <span class="font-semibold text-sm">${r.name}</span>
          <span class="text-2xs text-muted">${r.blurb}</span>
        </div>
      </div>
    </div>
  `).join("");

  const grade = (recap && recap.grade) || "B";
  const gradeColor = grade.startsWith("A") ? "text-green" : grade.startsWith("B") ? "text-blue" : grade.startsWith("C") ? "text-amber" : "text-red";

  const body = `
    <!-- Greeting -->
    <div class="flex-between mb-6 fade-up fade-up-1">
      <div class="flex-col">
        <span class="text-sm text-muted">Good Morning,</span>
        <span class="outfit-font font-black" style="font-size: 24px; line-height: 1.1;">Coach ${coachName}</span>
      </div>
      <a href="/roster/T_TEST_1" style="text-decoration:none;" class="flex-col items-end">
        <div class="avatar" style="width:44px;height:44px;border-radius:14px;color:var(--neon-green);">${coachName.charAt(0).toUpperCase()}</div>
        <span class="text-2xs text-muted mt-2">Lv.${level} · ${title}</span>
      </a>
    </div>

    <!-- Main matchup score widget -->
    <div class="glass-card flex-col gap-4 fade-up fade-up-2">
      <div class="flex-between">
        <div class="flex items-center gap-2">
          <span class="status-dot dot-live"></span>
          <span class="text-2xs uppercase font-bold text-green">Live · Week 5</span>
        </div>
        <span class="pill pill-green">3 - 1 · 1st</span>
      </div>

      <div class="flex-between align-end">
        <div class="flex-col">
          <span class="text-2xs text-muted uppercase">Gridiron Giants</span>
          <span class="outfit-font mono-num" style="font-size: 44px; font-weight: 800; line-height: 1;">112.6</span>
          <span class="text-2xs text-green">▲ Proj 120.4</span>
        </div>
        <span class="text-2xs font-bold text-muted" style="padding-bottom: 20px;">VS</span>
        <div class="flex-col items-end">
          <span class="text-2xs text-muted uppercase">Rushing Royalty</span>
          <span class="outfit-font mono-num text-muted" style="font-size: 32px; font-weight: 700; line-height: 1;">98.7</span>
          <span class="text-2xs text-muted">Proj 104.2</span>
        </div>
      </div>

      <div>
        <div class="flex-between text-2xs font-bold mb-2">
          <span class="text-green">WIN PROBABILITY</span>
          <span class="mono-num">68%</span>
        </div>
        <div class="track"><div class="track-fill fill-green" style="width: 68%;"></div></div>
      </div>

      <a href="/matchup/TEST" class="btn-primary mt-2">VIEW LIVE MATCHUP</a>
    </div>

    <!-- Quick actions -->
    <div class="flex gap-3 mb-6 fade-up fade-up-3">
      <a href="/roster/T_TEST_1" class="card card-tappable flex-col gap-2" style="flex:1; margin:0; text-decoration:none; color:inherit;">
        <span class="text-lg text-green" style="width:22px;height:22px;">${SPARK}</span>
        <span class="text-sm font-bold">Set Lineup</span>
        <span class="text-2xs text-muted">1 slot empty</span>
      </a>
      <a href="/coach" class="card card-tappable flex-col gap-2" style="flex:1; margin:0; text-decoration:none; color:inherit; border-color: rgba(168,85,247,.3);">
        <span class="text-lg text-purple" style="width:22px;height:22px;">${SPARK}</span>
        <span class="text-sm font-bold text-purple">AI Coach</span>
        <span class="text-2xs text-muted">Optimize now</span>
      </a>
    </div>

    <!-- Weekly recap -->
    <div class="card fade-up fade-up-3">
      <div class="flex-between mb-2">
        <span class="section-label" style="margin:0;">This Week's Recap</span>
        <span class="outfit-font font-black ${gradeColor}" style="font-size: 22px;">${grade}</span>
      </div>
      <p class="text-sm text-muted" style="line-height: 1.5;">${(recap && recap.recap) || "Complete a matchup week to receive your AI performance analysis."}</p>
    </div>

    <!-- Power rankings / news -->
    <div class="card fade-up fade-up-4">
      <div class="flex-between mb-2">
        <span class="section-label" style="margin:0;">Power Rankings</span>
        <a href="/league/L_TEST" class="text-2xs text-green font-bold" style="text-decoration:none;">Full League →</a>
      </div>
      <div class="flex-col">
        ${newsRows || '<div class="text-sm text-muted">No updates yet.</div>'}
      </div>
    </div>
  `;

  return renderPage({ title: "Home", body, active: "home" });
}
