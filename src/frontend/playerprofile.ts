import { renderPage, SPARK, ICONS } from "./theme";
import {
  getPlayer,
  getPlayerOwner,
  getPlayerNews,
  relTime,
  injuryMeta,
  initials,
  esc,
  LEAGUE_ID,
  CURRENT_WEEK,
  type DBPlayer,
} from "./data";

/** Stable hash of a string -> unsigned 32-bit int (deterministic pseudo-stats). */
function hash(s: string): number {
  let h = 2166136261;
  for (const ch of s) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function rng(seed: number) {
  let x = seed || 1;
  return () => {
    x ^= x << 13; x >>>= 0;
    x ^= x >> 17;
    x ^= x << 5; x >>>= 0;
    return x / 4294967296;
  };
}

function projFor(p: DBPlayer, r: () => number): number {
  const base: Record<string, [number, number]> = {
    QB: [14, 26], RB: [6, 22], WR: [5, 20], TE: [4, 14], K: [6, 12], DEF: [3, 13],
  };
  const [lo, hi] = base[p.position] || [4, 16];
  return Math.round((lo + r() * (hi - lo)) * 10) / 10;
}

function matchupRead(pos: string, r: () => number): string {
  const favorable = r() > 0.5;
  const map: Record<string, [string, string]> = {
    QB: ["Bottom-8 pass defense — clean pocket and a shootout script favor a QB1 ceiling.", "Top-5 pass rush across from him — expect pressure and a capped ceiling."],
    RB: ["Bottom-5 run defense — favorable spot for a true bell-cow workload.", "Stout front seven — game script may force this backfield away from the run."],
    WR: ["Shadow corner is banged up — a plus matchup on the outside all afternoon.", "Draws the opponent's top cover corner — target quality takes a hit."],
    TE: ["Defense bleeds points to tight ends over the middle — trusted streamer.", "Linebackers cover well underneath — tougher week for volume."],
    K: ["Dome game with a high team total — plenty of scoring-range trips.", "Wind and a low total dim the field-goal outlook."],
    DEF: ["Faces a turnover-prone offense — real sack-and-takeaway upside.", "Opposing offense protects the ball — modest floor this week."],
  };
  const pair = map[pos] || ["Neutral matchup on paper.", "Neutral matchup on paper."];
  return favorable ? pair[0] : pair[1];
}

function sparkline(vals: number[]): string {
  const max = Math.max(...vals, 1);
  const med = [...vals].sort((a, b) => a - b)[Math.floor(vals.length / 2)];
  const bars = vals
    .map((v) => {
      const h = Math.max(6, Math.round((v / max) * 40));
      const color = v >= med ? "var(--neon-green)" : "var(--neon-amber)";
      return `<div class="flex-col items-center" style="flex:1;">
        <div style="width:60%;max-width:26px;height:${h}px;background:${color};border-radius:3px 3px 0 0;opacity:.9;"></div>
      </div>`;
    })
    .join("");
  return `<div class="flex items-end" style="height:44px;gap:6px;">${bars}</div>`;
}

function statCell(label: string, value: string, last = false): string {
  return `<div class="flex-col" style="min-width:84px;padding:0 14px;${last ? "" : "border-right:1px solid var(--border-subtle);"}">
    <span class="outfit-font mono-num font-black" style="font-size:20px;">${value}</span>
    <span class="text-2xs text-muted uppercase" style="margin-top:2px;">${label}</span>
  </div>`;
}

function emptyState(): string {
  const body = `
    <div class="page-header fade-up fade-up-1">
      <a href="/roster/T_TEST_1" class="header-back">←</a>
      <span class="outfit-font font-black text-lg">Player</span>
      <span style="width:36px;"></span>
    </div>
    <div class="card fade-up fade-up-2" style="text-align:center;padding:40px 20px;">
      <span class="section-label" style="justify-content:center;">Player not found</span>
      <p class="text-sm text-muted" style="margin-top:8px;line-height:1.5;">
        We couldn't find that player. They may have been removed from the league database. Head back to your roster and try another.
      </p>
      <a href="/roster/T_TEST_1" class="btn-secondary" style="margin-top:16px;max-width:200px;">Back to My Team</a>
    </div>`;
  return renderPage({ title: "Player", body, active: "roster" });
}

function tokenPill(label: string, enabled: boolean, explain: string): string {
  if (enabled) {
    return `<button class="pill pill-amber" style="border:1px solid rgba(245,158,11,.4);cursor:pointer;background:var(--neon-amber-soft);">${SPARK} ${label}</button>`;
  }
  return `<span class="pill" style="opacity:.5;background:var(--bg-elevated);color:var(--text-muted);" title="${esc(explain)}">${label}</span>`;
}

/* NFL dome teams — used to decide weather vs "Dome" on the next-matchup card. */
const DOME_TEAMS = new Set(["ATL", "DAL", "DET", "HOU", "IND", "LAR", "LV", "MIN", "NO", "ARI"]);

export async function renderPlayerProfile(db: D1Database, playerId: string): Promise<string> {
  const p = await getPlayer(db, playerId);
  if (!p) return emptyState();

  const seed = hash(p.player_id + p.name);
  const r = rng(seed);
  const inj = injuryMeta(p.injury_status);
  const owner = await getPlayerOwner(db, p.player_id, LEAGUE_ID, CURRENT_WEEK);

  const ppg = projFor(p, r);
  const last5 = Array.from({ length: 5 }, () => Math.round((ppg * (0.55 + r() * 0.9)) * 10) / 10);
  const seasonPts = Math.round(last5.reduce((a, b) => a + b, 0) + ppg * 4);
  const touches = p.position === "QB" ? Math.round(28 + r() * 12) : Math.round(4 + r() * 16);
  const rzShare = Math.round(8 + r() * 34);
  const snap = Math.round(52 + r() * 46);
  const owned = Math.round(3 + r() * 96);
  const trendUp = r() > 0.5;
  const trendPct = Math.round(1 + r() * 12);
  const byeWeek = 6 + (hash(p.player_id + "bye") % 9); // 6..14

  const photo = (p.headshot_url || "").trim();
  const avatarInner = photo
    ? `<img src="${esc(photo)}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:16px;" onerror="this.style.display='none';this.parentElement.textContent='${esc(initials(p.name))}';">`
    : esc(initials(p.name));

  // Game log
  const opps = ["KC", "@BUF", "DAL", "@SF", "PHI"];
  const gameLog = last5
    .map((pts, i) => {
      const wk = CURRENT_WEEK - (5 - i);
      const won = r() > 0.5;
      const line =
        p.position === "QB"
          ? `${Math.round(190 + r() * 160)} yd · ${Math.round(r() * 3)} TD`
          : p.position === "DEF"
          ? `${Math.round(r() * 4)} sk · ${Math.round(r() * 2)} TO`
          : `${touches} tch · ${Math.round(r() * 2)} TD`;
      return `<tr>
        <td style="padding:8px 6px;color:var(--text-muted);">${wk > 0 ? wk : "—"}</td>
        <td style="padding:8px 6px;">${opps[i]}</td>
        <td style="padding:8px 6px;color:${won ? "var(--neon-green)" : "var(--neon-red)"};">${won ? "W" : "L"}</td>
        <td style="padding:8px 6px;color:var(--text-muted);">${line}</td>
        <td style="padding:8px 6px;text-align:right;" class="font-bold">${pts.toFixed(1)}</td>
      </tr>`;
    })
    .join("");

  // Real player news (ESPN via nfl-news-api port); fall back to deterministic
  // blurbs when this player has no wire news yet.
  const realNews = await getPlayerNews(db, p.player_id, 6);
  const news: { t: string; s: string; href?: string }[] =
    realNews.length > 0
      ? realNews.map((n) => ({
          t: relTime(n.published_at) || "recently",
          s: n.summary || n.headline,
          href: n.link && !n.link.startsWith("espn-article-") ? n.link : undefined,
        }))
      : [
          { t: "2h ago", s: `${p.name.split(" ")[0]} logged a full practice and carries no designation into the week.` },
          { t: "1d ago", s: `Coaching staff hinted at an expanded role — snap share has climbed three straight weeks.` },
          { t: "3d ago", s: `Beat writer expects steady volume; matchup sets up as a get-right spot.` },
        ];

  const ownerLine = owner
    ? `Rostered by <a href="/roster/${esc(owner.team_id)}" style="color:var(--neon-blue);text-decoration:none;">${esc(owner.name)}</a> · ${esc(owner.slot_type)}`
    : `<span class="text-green">Free agent — available to add</span>`;

  // Structured next-matchup facts (deterministic).
  const nextOpp = opps[Math.floor(r() * opps.length)].replace("@", "");
  const defRank = 1 + (hash(p.player_id + "def") % 32);
  const defOrdinal = defRank + (defRank % 10 === 1 && defRank !== 11 ? "st" : defRank % 10 === 2 && defRank !== 12 ? "nd" : defRank % 10 === 3 && defRank !== 13 ? "rd" : "th");
  const implied = Math.round((17 + r() * 14) * 10) / 10;
  const isDome = DOME_TEAMS.has(p.team);
  const weatherOpts = ["Clear 58°", "Wind 18mph", "Rain likely", "Cold 31°"];
  const weather = isDome ? "🏟 Dome" : `🌤 ${weatherOpts[hash(p.player_id + "wx") % weatherOpts.length]}`;

  const primaryActions = `
    <div class="flex gap-2 mt-4" style="flex-wrap:wrap;">
      <a href="/lineup/${owner ? esc(owner.team_id) : "T_TEST_1"}" class="btn-primary" style="flex:1;min-width:78px;padding:10px;">Start</a>
      <a href="/lineup/${owner ? esc(owner.team_id) : "T_TEST_1"}" class="btn-secondary" style="flex:1;min-width:78px;padding:10px;">Bench</a>
      <a href="${owner ? "#" : `/freeagency/${LEAGUE_ID}`}" class="btn-secondary" style="flex:1;min-width:78px;padding:10px;">${owner ? "Add/Drop" : "Add"}</a>
      <a href="#" class="btn-secondary" style="flex:1;min-width:78px;padding:10px;">Trade</a>
      <a href="#" class="btn-secondary" style="flex:1;min-width:78px;padding:10px;">Set Alert</a>
    </div>`;

  const headerBlock = `
    <div class="glass-card fade-up fade-up-1">
      <div class="flex items-center gap-4">
        <div class="avatar" style="width:72px;height:72px;border-radius:16px;font-size:24px;color:var(--text-light);overflow:hidden;">${avatarInner}</div>
        <div class="flex-col gap-1" style="flex:1;min-width:0;">
          <span class="outfit-font font-black" style="font-size:22px;line-height:1.1;">${esc(p.name)}</span>
          <div class="flex items-center gap-2">
            <span class="position-badge pos-${esc(p.position)}">${esc(p.position)}</span>
            <span class="text-2xs text-muted">${esc(p.team)}</span>
            <span class="pill ${inj.chipClass}" style="padding:3px 10px;">${esc(inj.label)}</span>
          </div>
          <span class="text-2xs text-muted" style="margin-top:2px;">
            ${owned}% rostered
            <span class="${trendUp ? "text-green" : "text-red"}">${trendUp ? "▲" : "▼"} ${trendPct}% 7d</span>
            · Bye wk ${byeWeek}
          </span>
          <span class="text-2xs text-muted">${ownerLine}</span>
        </div>
      </div>
      ${primaryActions}
      <div class="flex gap-2 mt-2 items-center">
        ${tokenPill("Insure this player", inj.isRisk, "Only available for Questionable or OUT players")}
        ${tokenPill("Challenge this play", false, "Available once this player's game is live")}
      </div>
    </div>`;

  const statStrip = `
    <div class="card fade-up fade-up-2" style="padding:14px 2px;">
      <div class="flex" style="overflow-x:auto;">
        ${statCell("Fpts", String(seasonPts))}
        ${statCell("Pts/G", ppg.toFixed(1))}
        ${statCell(p.position === "QB" ? "Att" : "Touches", String(touches))}
        ${statCell("RZ %", rzShare + "%")}
        ${statCell("Snap %", snap + "%", true)}
      </div>
    </div>`;

  const sparkCard = `
    <div class="card fade-up fade-up-2">
      <span class="section-label">Last 5 games</span>
      ${sparkline(last5)}
      <div class="flex mono-num" style="margin-top:6px;gap:6px;">
        ${last5.map((v) => `<span class="text-2xs text-muted" style="flex:1;text-align:center;">${v.toFixed(1)}</span>`).join("")}
      </div>
    </div>`;

  const gameLogCard = `
    <div class="card fade-up fade-up-3">
      <span class="section-label">Game log</span>
      <table class="mono-num" style="width:100%;border-collapse:collapse;font-size:12px;">
        <thead><tr style="color:var(--text-muted);text-align:left;border-bottom:1px solid var(--border-subtle);">
          <th style="padding:6px;">WK</th><th style="padding:6px;">OPP</th><th style="padding:6px;">RES</th><th style="padding:6px;">LINE</th><th style="padding:6px;text-align:right;">FPTS</th>
        </tr></thead>
        <tbody>${gameLog}</tbody>
      </table>
    </div>`;

  const nextMatchupCard = `
    <div class="card fade-up fade-up-3" style="border-color:rgba(74,158,255,.28);">
      <span class="section-label">${SPARK} Next matchup</span>
      <div class="flex" style="flex-wrap:wrap;gap:8px;margin-bottom:10px;">
        <span class="chip">vs ${esc(nextOpp)}</span>
        <span class="chip">DEF ${defOrdinal} vs ${esc(p.position)}</span>
        <span class="chip">${weather}</span>
        <span class="chip">Implied ${implied.toFixed(1)}</span>
      </div>
      <p class="text-sm" style="line-height:1.5;">${matchupRead(p.position, r)}</p>
    </div>`;

  const newsCard = `
    <div class="card fade-up fade-up-4">
      <span class="section-label">News & notes</span>
      ${news
        .map(
          (n) => {
            const bodyHtml = `<span class="text-2xs text-muted uppercase">${esc(n.t)}</span>
            <p class="text-sm" style="margin-top:2px;line-height:1.45;">${esc(n.s)}</p>`;
            return n.href
              ? `<a href="${esc(n.href)}" target="_blank" rel="noopener" style="display:block;text-decoration:none;color:inherit;padding:8px 0;border-bottom:1px solid var(--border-subtle);">${bodyHtml}</a>`
              : `<div style="padding:8px 0;border-bottom:1px solid var(--border-subtle);">${bodyHtml}</div>`;
          }
        )
        .join("")}
    </div>`;

  const footerActions = `
    <div class="card fade-up fade-up-4">
      <span class="section-label">More</span>
      <div class="flex-col gap-2">
        <a href="#" class="btn-secondary" style="padding:11px;">Compare to another player</a>
        <a href="${owner ? `/roster/${esc(owner.team_id)}` : `/freeagency/${LEAGUE_ID}`}" class="btn-secondary" style="padding:11px;">View on team roster</a>
        <a href="#" class="btn-secondary" style="padding:11px;">View full season log</a>
      </div>
    </div>`;

  const body = `
    <div class="page-header fade-up fade-up-1">
      <a href="${owner ? `/roster/${esc(owner.team_id)}` : `/freeagency/${LEAGUE_ID}`}" class="header-back">←</a>
      <span class="outfit-font font-black text-lg">Player Profile</span>
      <span class="header-back" style="border:none;padding:6px;color:var(--neon-blue);">${ICONS.roster}</span>
    </div>

    <div class="desk-grid">
      <div class="desk-main">
        ${headerBlock}
        ${statStrip}
        ${sparkCard}
        ${gameLogCard}
      </div>
      <div class="desk-side">
        ${nextMatchupCard}
        ${newsCard}
        ${footerActions}
      </div>
    </div>
  `;

  return renderPage({ title: p.name, body, active: "roster" });
}
