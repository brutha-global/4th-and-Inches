/**
 * 4th & Inches — Shared design system.
 *
 * Palette + typography are locked to the interface.jpg reference:
 *   near-black surfaces, electric green primary, purple AI accent, Inter type.
 *
 * This module owns:
 *   - SHARED_CSS      : design tokens, base elements, reusable components, animations
 *   - ICONS           : single source of truth for nav / UI glyphs (no more copy-paste)
 *   - renderTabBar()  : the 5-tab bottom navigation from the mockup
 *   - renderPage()    : full HTML document shell so screens only write their body
 */

export const SHARED_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700;800&family=Inter:wght@400;500;600;700;800&display=swap');

:root {
  --bg-dark: #0B0F19;
  --bg-elevated: #111827;
  --bg-card: #1F2937;
  --bg-card-hover: #263141;
  --border-subtle: #2A3441;
  --neon-green: #22C55E;
  --neon-green-soft: rgba(34, 197, 94, 0.12);
  --neon-green-hover: #16A34A;
  --neon-blue: #4A9EFF;
  --neon-purple: #A855F7;
  --neon-purple-soft: rgba(168, 85, 247, 0.14);
  --neon-red: #FF4444;
  --neon-red-soft: rgba(255, 68, 68, 0.12);
  --neon-amber: #F59E0B;
  --neon-amber-soft: rgba(245, 158, 11, 0.12);
  --text-muted: #8A94A6;
  --text-light: #F4F6FB;
  --shadow-card: 0 8px 24px rgba(0, 0, 0, 0.35);
}

* { box-sizing: border-box; margin: 0; padding: 0; }

html { -webkit-text-size-adjust: 100%; }

body {
  background:
    radial-gradient(1200px 600px at 50% -10%, rgba(34, 197, 94, 0.06), transparent 60%),
    var(--bg-dark);
  background-attachment: fixed;
  color: var(--text-light);
  font-family: 'Inter', 'Noto Color Emoji', 'Apple Color Emoji', 'Segoe UI Emoji', sans-serif;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  -webkit-font-smoothing: antialiased;
}

/* Inline sparkle glyph — used wherever an AI affordance is needed so it
   renders on every platform (emoji fonts are not guaranteed). */
.spark {
  display: inline-block; width: 1em; height: 1em; vertical-align: -0.12em;
}
.spark svg { width: 100%; height: 100%; }

header, h1, h2, h3, h4, .outfit-font {
  font-family: 'Outfit', sans-serif;
  letter-spacing: -0.01em;
}

.mono-num { font-variant-numeric: tabular-nums; }

/* ── Cards ───────────────────────────────────────────── */
.card {
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: 14px;
  padding: 16px;
  margin-bottom: 16px;
}

.glass-card {
  background: linear-gradient(160deg, rgba(31, 41, 55, 0.85), rgba(17, 24, 39, 0.85));
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-radius: 18px;
  padding: 22px;
  margin-bottom: 20px;
  box-shadow: var(--shadow-card);
}

.card-tappable { cursor: pointer; transition: transform .12s ease, background .2s ease, border-color .2s ease; }
.card-tappable:active { transform: scale(0.985); }
.card-tappable:hover { background: var(--bg-card-hover); }

/* ── Typography helpers ─────────────────────────────── */
.text-green { color: var(--neon-green); }
.text-blue { color: var(--neon-blue); }
.text-purple { color: var(--neon-purple); }
.text-red { color: var(--neon-red); }
.text-amber { color: var(--neon-amber); }
.text-muted { color: var(--text-muted); }
.text-2xs { font-size: 10px; }
.text-xs { font-size: 12px; }
.text-sm { font-size: 14px; }
.text-base { font-size: 16px; }
.text-lg { font-size: 18px; }
.text-xl { font-size: 22px; }
.font-medium { font-weight: 500; }
.font-semibold { font-weight: 600; }
.font-bold { font-weight: 700; }
.font-black { font-weight: 800; }
.uppercase { text-transform: uppercase; letter-spacing: 0.06em; }

/* ── Buttons ─────────────────────────────────────────── */
.btn-primary {
  background: linear-gradient(135deg, var(--neon-green), #16A34A);
  color: #06210F;
  border: none;
  padding: 13px 24px;
  border-radius: 10px;
  font-family: 'Inter', sans-serif;
  font-weight: 700;
  cursor: pointer;
  transition: transform .12s ease, box-shadow .2s ease, filter .2s ease;
  width: 100%;
  text-align: center;
  text-decoration: none;
  display: inline-block;
  box-shadow: 0 6px 18px rgba(34, 197, 94, 0.28);
}
.btn-primary:hover { filter: brightness(1.05); }
.btn-primary:active { transform: scale(0.97); }

.btn-secondary {
  background: transparent;
  color: var(--text-light);
  border: 1px solid var(--border-subtle);
  padding: 13px 24px;
  border-radius: 10px;
  font-weight: 600;
  cursor: pointer;
  width: 100%;
  text-align: center;
  text-decoration: none;
  display: inline-block;
  transition: border-color .2s ease, background .2s ease, transform .12s ease;
}
.btn-secondary:hover { border-color: var(--neon-green); }
.btn-secondary:active { transform: scale(0.97); }

.btn-purple {
  background: linear-gradient(135deg, var(--neon-purple), #7C3AED);
  color: #fff; border: none; padding: 13px 24px; border-radius: 10px;
  font-weight: 700; cursor: pointer; width: 100%; text-align: center;
  text-decoration: none; display: inline-block;
  box-shadow: 0 6px 18px rgba(168, 85, 247, 0.28);
  transition: transform .12s ease, filter .2s ease;
}
.btn-purple:hover { filter: brightness(1.07); }
.btn-purple:active { transform: scale(0.97); }

/* ── Layout ──────────────────────────────────────────── */
.app-container {
  max-width: 480px;
  margin: 0 auto;
  padding: 20px 16px 140px 16px;
  width: 100%;
  position: relative;
}

.flex { display: flex; }
.flex-between { display: flex; justify-content: space-between; align-items: center; }
.flex-center { display: flex; align-items: center; justify-content: center; }
.flex-col { display: flex; flex-direction: column; }
.items-center { align-items: center; }
.items-end { align-items: flex-end; }
.align-end { align-items: flex-end; }
.gap-1 { gap: 4px; }
.gap-2 { gap: 8px; }
.gap-3 { gap: 12px; }
.gap-4 { gap: 16px; }
.mt-2 { margin-top: 8px; }
.mt-4 { margin-top: 16px; }
.mt-6 { margin-top: 24px; }
.mb-2 { margin-bottom: 8px; }
.mb-4 { margin-bottom: 16px; }
.mb-6 { margin-bottom: 24px; }

/* ── Page header ─────────────────────────────────────── */
.page-header {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 22px;
}
.header-back {
  color: var(--text-muted); text-decoration: none; font-size: 22px;
  width: 36px; height: 36px; border-radius: 10px;
  display: flex; align-items: center; justify-content: center;
  border: 1px solid var(--border-subtle); transition: border-color .2s;
}
.header-back:hover { border-color: var(--neon-green); color: var(--text-light); }

/* ── Badges / pills ──────────────────────────────────── */
.position-badge {
  font-size: 10px;
  background: var(--bg-elevated);
  border: 1px solid var(--border-subtle);
  color: var(--text-muted);
  padding: 3px 7px;
  border-radius: 6px;
  font-weight: 800;
  min-width: 30px;
  text-align: center;
}
.pos-QB { color: #F59E0B; border-color: rgba(245,158,11,.4); }
.pos-RB { color: #22C55E; border-color: rgba(34,197,94,.4); }
.pos-WR { color: #4A9EFF; border-color: rgba(74,158,255,.4); }
.pos-TE { color: #A855F7; border-color: rgba(168,85,247,.4); }
.pos-K  { color: #EC4899; border-color: rgba(236,72,153,.4); }
.pos-DEF{ color: #94A3B8; border-color: rgba(148,163,184,.4); }

.pill {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 5px 12px; border-radius: 100px; font-size: 11px; font-weight: 700;
}
.pill-green { background: var(--neon-green-soft); color: var(--neon-green); }
.pill-red { background: var(--neon-red-soft); color: var(--neon-red); }
.pill-amber { background: var(--neon-amber-soft); color: var(--neon-amber); }
.pill-purple { background: var(--neon-purple-soft); color: var(--neon-purple); }

.chip {
  display: inline-block; padding: 4px 10px; border-radius: 8px;
  font-size: 11px; font-weight: 600; background: var(--bg-elevated);
  border: 1px solid var(--border-subtle); color: var(--text-muted);
}

/* ── Player row (reused across roster/matchup) ───────── */
.player-row {
  display: flex; justify-content: space-between; align-items: center;
  padding: 12px 0; border-bottom: 1px solid var(--border-subtle);
}
.player-row:last-child { border-bottom: none; }
.avatar {
  width: 40px; height: 40px; border-radius: 12px; flex-shrink: 0;
  background: linear-gradient(135deg, #263141, #1a2230);
  display: flex; align-items: center; justify-content: center;
  font-weight: 800; font-size: 14px; color: var(--text-muted);
  border: 1px solid var(--border-subtle);
}

/* ── Status dot ──────────────────────────────────────── */
.status-dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
.dot-live { background: var(--neon-green); box-shadow: 0 0 0 0 rgba(34,197,94,.7); animation: pulse 1.6s infinite; }
.dot-out { background: var(--neon-red); }
.dot-idle { background: var(--text-muted); }

@keyframes pulse {
  0% { box-shadow: 0 0 0 0 rgba(34,197,94,.6); }
  70% { box-shadow: 0 0 0 8px rgba(34,197,94,0); }
  100% { box-shadow: 0 0 0 0 rgba(34,197,94,0); }
}

/* ── Progress / probability bars ─────────────────────── */
.track {
  width: 100%; height: 8px; background: var(--bg-elevated);
  border-radius: 100px; overflow: hidden; margin-top: 8px;
}
.track-fill { height: 100%; border-radius: 100px; transition: width .6s cubic-bezier(.4,0,.2,1); }
.fill-green { background: linear-gradient(90deg, #16A34A, var(--neon-green)); }
.fill-red { background: linear-gradient(90deg, var(--neon-red), #F87171); }
.fill-purple { background: linear-gradient(90deg, #7C3AED, var(--neon-purple)); }

/* ── Section label ───────────────────────────────────── */
.section-label {
  font-size: 11px; font-weight: 800; color: var(--text-muted);
  text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 10px;
  display: block;
}

/* ── Entrance animation ──────────────────────────────── */
.fade-up { animation: fadeUp .45s cubic-bezier(.2,.7,.2,1) both; }
.fade-up-1 { animation-delay: .04s; }
.fade-up-2 { animation-delay: .10s; }
.fade-up-3 { animation-delay: .16s; }
.fade-up-4 { animation-delay: .22s; }
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation: none !important; transition: none !important; }
}

/* ── Tab Bar ─────────────────────────────────────────── */
.tab-bar {
  position: fixed; bottom: 0; left: 50%; transform: translateX(-50%);
  width: 100%; max-width: 480px;
  background: var(--bg-dark);
  border-top: 1px solid var(--border-subtle);
  display: flex; justify-content: space-around;
  padding: 10px 0 22px 0; z-index: 100;
}
.tab-item {
  display: flex; flex-direction: column; align-items: center;
  color: var(--text-muted); text-decoration: none;
  font-size: 10px; font-weight: 700; gap: 4px; flex: 1;
  transition: color .2s ease;
}
.tab-item.active { color: var(--neon-green); }
.tab-item svg { width: 24px; height: 24px; }
.tab-item:active { transform: scale(0.92); }
`;

/** Single source of truth for icons. */
export const ICONS = {
  home: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.6" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" /></svg>`,
  roster: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.6" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /></svg>`,
  matchup: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.6" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" /></svg>`,
  league: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.6" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 002.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 012.916.52 6.003 6.003 0 01-5.395 4.972m0 0a6.726 6.726 0 01-2.749 1.35m0 0a6.772 6.772 0 01-3.044 0" /></svg>`,
  ai: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.6" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" /></svg>`,
};

/** Inline sparkle icon markup (AI affordance). Renders everywhere. */
export const SPARK = `<span class="spark">${ICONS.ai}</span>`;

/** Bottom navigation. `active` is one of: home | roster | matchup | league | ai */
export function renderTabBar(active: string): string {
  const tab = (key: string, href: string, label: string, icon: string) =>
    `<a href="${href}" class="tab-item${active === key ? " active" : ""}">${icon}<span>${label}</span></a>`;
  return `
  <nav class="tab-bar">
    ${tab("home", "/", "Home", ICONS.home)}
    ${tab("roster", "/roster/T_TEST_1", "My Team", ICONS.roster)}
    ${tab("matchup", "/matchup/TEST", "Matchup", ICONS.matchup)}
    ${tab("league", "/league/L_TEST", "League", ICONS.league)}
    ${tab("ai", "/coach", "AI Coach", ICONS.ai)}
  </nav>`;
}

interface PageOpts {
  title: string;
  body: string;
  active: string;
  extraCss?: string;
  extraJs?: string;
}

/** Full HTML document shell. Screens supply only their body markup. */
export function renderPage({ title, body, active, extraCss = "", extraJs = "" }: PageOpts): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <meta name="theme-color" content="#0B0F19">
  <title>${title} · 4th &amp; Inches</title>
  <style>${SHARED_CSS}${extraCss}</style>
</head>
<body>
  <div class="app-container">
    ${body}
  </div>
  ${renderTabBar(active)}
  ${extraJs ? `<script>${extraJs}</script>` : ""}
</body>
</html>`;
}
