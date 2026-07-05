import { renderPage, SPARK, ICONS } from "./theme";
import {
  getTeam,
  getRoster,
  getStandings,
  injuryMeta,
  esc,
  initials,
  DIVISION_MAP,
  LEAGUE_ID,
  CURRENT_WEEK,
  USER_TEAM_ID,
  type DBPlayer,
} from "./data";

interface MatchupRow {
  matchup_id: string;
  league_id: string;
  week: number;
  team1_id: string;
  team2_id: string;
  team1_score: number;
  team2_score: number;
  winner_id: string | null;
  status: string;
}

/** Deterministic projection so live/proj numbers are stable per render. */
function projFromScore(score: number, teamId: string): number {
  let h = 0;
  for (const ch of teamId) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  // remaining projected points to add on top of current live score
  const remaining = 18 + (h % 220) / 10; // 18.0 .. 40.0
  return Math.round((score + remaining) * 10) / 10;
}

/**
 * HOME screen — DB-backed. Reads the user's live matchup, roster (injury
 * watch), and standings from D1, then synthesizes league news / activity for
 * the demo. Two-column on desktop (main + sticky side) via .desk-grid.
 */
export async function renderDashboard(db: D1Database): Promise<string> {
  const coachName =
    DIVISION_MAP[USER_TEAM_ID]?.manager?.replace(/^Coach\s+/i, "") || "Alex";

  // ---- 1) Live matchup (orient the user first) --------------------------
  const mu = await db
    .prepare(
      `SELECT * FROM matchups
       WHERE league_id = ? AND week = ?
         AND (team1_id = ? OR team2_id = ?)`
    )
    .bind(LEAGUE_ID, CURRENT_WEEK, USER_TEAM_ID, USER_TEAM_ID)
    .first<MatchupRow>();

  const standings = await getStandings(db, LEAGUE_ID);
  const recordOf = (teamId: string) => {
    const s = standings.find((r) => r.team_id === teamId);
    return s ? `${s.wins}-${s.losses}` : "";
  };

  let matchupCard: string;
  if (mu) {
    // Orient so the USER's team is always on the left.
    const userIsTeam1 = mu.team1_id === USER_TEAM_ID;
    const userId = USER_TEAM_ID;
    const oppId = userIsTeam1 ? mu.team2_id : mu.team1_id;
    const userScore = userIsTeam1 ? mu.team1_score : mu.team2_score;
    const oppScore = userIsTeam1 ? mu.team2_score : mu.team1_score;

    const userTeam = await getTeam(db, userId);
    const oppTeam = await getTeam(db, oppId);
    const userName = userTeam?.name || "Your team";
    const oppName = oppTeam?.name || "Opponent";

    const userProj = projFromScore(userScore, userId);
    const oppProj = projFromScore(oppScore, oppId);

    // Win probability from projected finish + current margin (demo heuristic).
    const projMargin = userProj - oppProj;
    const liveMargin = userScore - oppScore;
    const raw = 50 + projMargin * 1.6 + liveMargin * 0.9;
    const winProb = Math.max(4, Math.min(96, Math.round(raw)));
    const favored = winProb >= 50;
    const isLive = mu.status === "InProgress";

    const statusChip = isLive
      ? `<div class="flex items-center gap-2">
           <span class="status-dot dot-live"></span>
           <span class="text-2xs uppercase font-bold text-green">Live · Week ${CURRENT_WEEK}</span>
         </div>`
      : `<div class="flex items-center gap-2">
           <span class="status-dot dot-idle"></span>
           <span class="text-2xs uppercase font-bold text-muted">${esc(mu.status)} · Week ${CURRENT_WEEK}</span>
         </div>`;

    matchupCard = `
    <a href="/matchup/TEST" class="glass-card flex-col gap-4 fade-up fade-up-1" style="text-decoration:none;color:inherit;">
      <div class="flex-between">
        ${statusChip}
        <span class="pill ${favored ? "pill-green" : "pill-amber"}">${winProb}% win</span>
      </div>

      <div class="flex-between items-end">
        <div class="flex-col" style="min-width:0;">
          <span class="text-2xs text-muted uppercase" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(userName)} · ${recordOf(userId)}</span>
          <span class="outfit-font mono-num" style="font-size: 44px; font-weight: 800; line-height: 1;">${userScore.toFixed(1)}</span>
          <span class="text-2xs ${favored ? "text-green" : "text-muted"}">Proj ${userProj.toFixed(1)}</span>
        </div>
        <span class="text-2xs font-bold text-muted" style="padding-bottom: 20px;">VS</span>
        <div class="flex-col items-end" style="min-width:0;">
          <span class="text-2xs text-muted uppercase" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(oppName)} · ${recordOf(oppId)}</span>
          <span class="outfit-font mono-num ${oppScore > userScore ? "" : "text-muted"}" style="font-size: 34px; font-weight: 700; line-height: 1;">${oppScore.toFixed(1)}</span>
          <span class="text-2xs text-muted">Proj ${oppProj.toFixed(1)}</span>
        </div>
      </div>

      <div>
        <div class="flex-between text-2xs font-bold mb-2">
          <span class="${favored ? "text-green" : "text-amber"}">WIN PROBABILITY</span>
          <span class="mono-num">${winProb}%</span>
        </div>
        <div class="track"><div class="track-fill ${favored ? "fill-green" : "fill-purple"}" style="width: ${winProb}%;"></div></div>
      </div>

      <span class="btn-primary mt-2">VIEW LIVE MATCHUP</span>
    </a>`;
  } else {
    matchupCard = `
    <div class="glass-card flex-col gap-2 fade-up fade-up-1">
      <span class="section-label" style="margin:0;">Your matchup</span>
      <p class="text-sm text-muted">No matchup scheduled for Week ${CURRENT_WEEK}. Check the schedule to see when you play next.</p>
      <a href="/matchup/TEST" class="btn-secondary mt-2">Open matchup</a>
    </div>`;
  }

  // ---- 2) League News carousel -----------------------------------------
  type NewsItem = { kind: string; cls: string; headline: string; ts: string; href: string };
  const news: NewsItem[] = [
    { kind: "Power rank", cls: "text-green", headline: "Fourth Down Kings surge to #1 after a 4-0 start", ts: "12m ago", href: "/hub/L_TEST" },
    { kind: "Injury", cls: "text-amber", headline: "George Pickens listed Questionable (hamstring) for Week 5", ts: "38m ago", href: "/roster/T_TEST_1" },
    { kind: "Trade", cls: "text-purple", headline: "Sofia sends a 2nd-round pick to Marcus for a WR2 upgrade", ts: "1h ago", href: "#" },
    { kind: "News", cls: "text-blue", headline: "Waivers process Wednesday 3AM ET — set your claims", ts: "2h ago", href: "/freeagency/L_TEST" },
    { kind: "Power rank", cls: "text-green", headline: "Gridiron Giants slide to #9 amid a 1-3 skid", ts: "3h ago", href: "/hub/L_TEST" },
    { kind: "Injury", cls: "text-amber", headline: "Three starters flagged league-wide — check your bench", ts: "5h ago", href: "/roster/T_TEST_1" },
  ];
  const carouselCards = news
    .map(
      (n) => `
      <a class="news-card card-tappable" href="${esc(n.href)}">
        <span class="text-2xs uppercase font-black ${n.cls}" style="letter-spacing:.06em;">${esc(n.kind)}</span>
        <span class="text-sm font-semibold" style="line-height:1.35;">${esc(n.headline)}</span>
        <span class="text-2xs text-muted mt-2">${esc(n.ts)}</span>
      </a>`
    )
    .join("");
  const carousel = `
    <div class="flex-between mb-2 fade-up fade-up-2">
      <span class="section-label" style="margin:0;">League News</span>
      <a href="/hub/L_TEST" class="text-2xs text-green font-bold" style="text-decoration:none;">All →</a>
    </div>
    <div class="news-rail fade-up fade-up-2" id="newsRail">
      ${carouselCards}
    </div>`;

  // ---- 3) Inactives / Injury watch (user roster) — ANNOTATED WARNING ----
  const roster = await getRoster(db, USER_TEAM_ID, CURRENT_WEEK);
  const watch = roster.filter((p) => {
    const m = injuryMeta(p.injury_status);
    return m.isRisk; // Questionable / Doubtful / Out
  });
  const watchRows = watch
    .map((p) => {
      const m = injuryMeta(p.injury_status);
      const badge = (p.slot_type === "FLEX" ? "WR" : (p.slot_type || p.position)) as string;
      const starterTag = p.is_starter
        ? `<span class="text-2xs font-bold text-amber">STARTER</span>`
        : `<span class="text-2xs text-muted">Bench</span>`;
      return `
      <div class="player-row" style="padding:10px 0;">
        <div class="flex items-center gap-3" style="min-width:0;">
          <a href="/playerdb/${esc(p.player_id)}" class="avatar" style="width:38px;height:38px;text-decoration:none;color:var(--text-light);flex:none;">${esc(initials(p.name))}</a>
          <div class="flex-col" style="min-width:0;">
            <a href="/playerdb/${esc(p.player_id)}" class="font-semibold text-sm" style="text-decoration:none;color:inherit;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(p.name)}</a>
            <div class="flex items-center gap-2">
              <span class="position-badge pos-${esc(badge)}">${esc(p.position)}</span>
              ${starterTag}
            </div>
          </div>
        </div>
        <div class="flex-col items-end gap-2" style="flex:none;">
          <span class="pill ${m.chipClass}">${esc(m.label)}</span>
          <button class="pill pill-amber" style="border:none;cursor:pointer;display:inline-flex;align-items:center;gap:4px;" onclick="location.href='/coach'">${SPARK} Insure</button>
        </div>
      </div>`;
    })
    .join("");
  const hasWarning = watch.some((p) => p.is_starter);
  const inactivesCard = `
    <div class="card fade-up fade-up-3" ${hasWarning ? 'style="border-color: rgba(245,158,11,.4);"' : ""}>
      <div class="flex-between mb-2">
        <span class="section-label" style="margin:0;">Injury Watch</span>
        ${hasWarning ? `<span class="pill pill-amber">${watch.length} to review</span>` : ""}
      </div>
      ${
        watch.length
          ? `${hasWarning ? `<p class="text-2xs text-amber mb-2">A starter is flagged this week — insure or replace before lineup lock.</p>` : ""}
             <div class="flex-col">${watchRows}</div>`
          : `<p class="text-sm text-muted">No injury concerns on your roster this week. You're clear for kickoff.</p>`
      }
    </div>`;

  // ---- 4) Quick actions row --------------------------------------------
  const action = (href: string, icon: string, label: string, color: string) => `
    <a href="${href}" class="quick-action card-tappable">
      <span class="qa-icon ${color}">${icon}</span>
      <span class="text-2xs font-bold">${label}</span>
    </a>`;
  const quickActions = `
    <div class="card fade-up fade-up-3">
      <span class="section-label" style="margin:0 0 10px;">Quick Actions</span>
      <div class="quick-grid">
        ${action("/lineup/T_TEST_1", ICONS.roster, "Set lineup", "text-green")}
        ${action("/freeagency/L_TEST", ICONS.matchup, "Free agency", "text-blue")}
        ${action("#", SPARK, "Propose trade", "text-purple")}
        ${action("/hub/L_TEST", ICONS.league, "Standings", "text-amber")}
      </div>
    </div>`;

  // ---- 5) League activity feed -----------------------------------------
  type Activity = { icon: string; cls: string; text: string; ts: string };
  const activity: Activity[] = [
    { icon: "＋", cls: "text-green", text: "<b>Marcus</b> added <b>Jauan Jennings</b> (WR) off waivers", ts: "9m" },
    { icon: "－", cls: "text-red", text: "<b>Priya</b> dropped <b>Zach Charbonnet</b> (RB)", ts: "24m" },
    { icon: "⇄", cls: "text-purple", text: "<b>Sofia</b> and <b>Kenji</b> completed a 2-for-1 trade", ts: "1h" },
    { icon: "＋", cls: "text-green", text: "<b>Deshawn</b> claimed <b>Jaylen Warren</b> (RB)", ts: "2h" },
    { icon: "－", cls: "text-red", text: "<b>Tommy</b> dropped <b>Adam Thielen</b> (WR)", ts: "3h" },
    { icon: "⇄", cls: "text-purple", text: "<b>Jordan</b> proposed a trade to <b>Malik</b>", ts: "5h" },
  ];
  const activityRows = activity
    .map(
      (a) => `
      <div class="flex items-center gap-3" style="padding:8px 0;">
        <span class="act-icon ${a.cls}">${a.icon}</span>
        <span class="text-sm" style="line-height:1.35;min-width:0;">${a.text}</span>
        <span class="text-2xs text-muted mono-num" style="margin-left:auto;flex:none;">${a.ts}</span>
      </div>`
    )
    .join('<div class="yardline" style="margin:0;"></div>');
  const activityFeed = `
    <div class="card fade-up fade-up-4">
      <div class="flex-between mb-2">
        <span class="section-label" style="margin:0;">League Activity</span>
        <a href="/hub/L_TEST" class="text-2xs text-green font-bold" style="text-decoration:none;">View all →</a>
      </div>
      <div class="flex-col">${activityRows}</div>
    </div>`;

  // ---- 6) Upcoming deadlines strip -------------------------------------
  const deadlines = `
    <div class="card fade-up fade-up-4" style="padding:14px 16px;">
      <span class="section-label" style="margin:0 0 8px;">Deadlines</span>
      <div class="flex-col gap-3">
        <div class="flex-between">
          <span class="text-2xs text-muted uppercase">Lineup lock</span>
          <span class="text-sm font-bold text-amber mono-num">2d 14h</span>
        </div>
        <div class="flex-between">
          <span class="text-2xs text-muted uppercase">Waivers process</span>
          <span class="text-sm font-bold text-blue mono-num">Wed 3:00 AM</span>
        </div>
        <div class="flex-between">
          <span class="text-2xs text-muted uppercase">Trade deadline</span>
          <span class="text-sm font-bold mono-num">Wk 11</span>
        </div>
      </div>
    </div>`;

  // ---- Greeting --------------------------------------------------------
  const greeting = `
    <div class="flex-between mb-4 fade-up fade-up-1">
      <div class="flex-col">
        <span class="text-sm text-muted">Welcome back,</span>
        <span class="outfit-font font-black" style="font-size: 24px; line-height: 1.1;">Coach ${esc(coachName)}</span>
      </div>
      <a href="/roster/T_TEST_1" style="text-decoration:none;" class="flex-col items-end">
        <div class="avatar" style="width:44px;height:44px;border-radius:14px;color:var(--neon-green);">${esc(coachName.charAt(0).toUpperCase())}</div>
        <span class="text-2xs text-muted mt-2">Week ${CURRENT_WEEK}</span>
      </a>
    </div>`;

  const body = `
    ${greeting}
    <div class="desk-grid">
      <div class="desk-main flex-col gap-4">
        ${matchupCard}
        ${carousel}
        ${activityFeed}
      </div>
      <div class="desk-side flex-col gap-4">
        ${inactivesCard}
        ${quickActions}
        ${deadlines}
      </div>
    </div>`;

  const extraCss = `
    .news-rail { display:flex; gap:12px; overflow-x:auto; scroll-snap-type:x mandatory; -webkit-overflow-scrolling:touch; padding-bottom:6px; scrollbar-width:none; }
    .news-rail::-webkit-scrollbar { display:none; }
    .news-card { scroll-snap-align:start; flex:0 0 78%; max-width:280px; display:flex; flex-direction:column; gap:6px; padding:14px; background:var(--bg-card); border:1px solid var(--border-subtle); border-radius:14px; text-decoration:none; color:inherit; }
    .quick-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:10px; }
    .quick-action { display:flex; flex-direction:column; align-items:center; gap:6px; padding:12px 4px; background:var(--bg-card); border:1px solid var(--border-subtle); border-radius:12px; text-decoration:none; color:var(--text-light); text-align:center; }
    .qa-icon { width:24px; height:24px; display:inline-flex; }
    .qa-icon svg { width:24px; height:24px; }
    .act-icon { flex:none; width:26px; height:26px; border-radius:8px; display:inline-flex; align-items:center; justify-content:center; font-weight:800; background:var(--bg-elevated); border:1px solid var(--border-subtle); }
    @media (min-width:900px) { .news-card { flex:0 0 46%; } }
  `;

  const extraJs = `
    (function(){
      var rail = document.getElementById('newsRail');
      if(!rail) return;
      var paused = false, i = 0;
      rail.addEventListener('mouseenter', function(){ paused = true; });
      rail.addEventListener('mouseleave', function(){ paused = false; });
      rail.addEventListener('touchstart', function(){ paused = true; }, {passive:true});
      setInterval(function(){
        if(paused) return;
        var cards = rail.children;
        if(!cards.length) return;
        i = (i + 1) % cards.length;
        rail.scrollTo({ left: cards[i].offsetLeft - rail.offsetLeft, behavior: 'smooth' });
      }, 4500);
    })();
  `;

  return renderPage({ title: "Home", body, active: "home", extraCss, extraJs });
}
