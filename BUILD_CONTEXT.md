# 4th & Inches — Build Context for Subagents

You are working in /teamspace/studios/this_studio/4th-and-Inches — a Cloudflare Workers (TypeScript) fantasy football app. D1 SQLite DB binding is `DB`. Frontend screens are TypeScript functions returning HTML strings, composed via `renderPage()` in src/frontend/theme.ts.

## CRITICAL: verify your work with `npx tsc --noEmit` (must exit 0) before reporting done.

## Data model (D1 tables — real data is already seeded for league L_TEST)
- leagues(league_id, name, commissioner_id, scoring_type, roster_size, bench_size, season, week, status, league_type)
- teams(team_id, league_id, owner_id, name, logo_url, wins, losses, points_for, points_against)
- rosters(roster_id, team_id, player_id, slot_type, week, is_starter)  -- slot_type: QB/RB/WR/TE/FLEX/K/DEF/BENCH
- players(player_id, name, position, team, status, injury_status, depth_chart_position, headshot_url, updated_at)
- standings(standing_id, league_id, team_id, wins, losses, ties, points_for, points_against, streak, playoff_seed, updated_at)
- matchups(matchup_id, league_id, week, team1_id, team2_id, team1_score, team2_score, winner_id, status)

Seeded league: league_id='L_TEST', current week=5, 12 teams (T_TEST_1 is the human user = "Gridiron Giants" / "Coach Alex").
Divisions (NOT stored in DB — hardcode this map in a shared helper): 
  American/Gridiron: T_TEST_1, T_02, T_03
  American/Blitz:    T_04, T_05, T_06
  National/Hurry-Up: T_07, T_08, T_09
  National/Trench:   T_10, T_11, T_12

## Design system (src/frontend/theme.ts — import from it, do NOT reinvent)
- `renderPage({ title, body, active, extraCss?, extraJs? })` -> full HTML doc. `active` ∈ home|roster|matchup|league|ai
- `SHARED_CSS` already defines: .card, .glass-card, .card-tappable, .player-row, .avatar, .pill (+ .pill-green/red/amber/purple),
  .position-badge (+ .pos-QB/RB/WR/TE/K/DEF), .chip, .status-dot (.dot-live/out/idle), .track/.track-fill (.fill-green/red/purple),
  .section-label, .btn-primary/.btn-secondary/.btn-purple, .page-header/.header-back, .fade-up (+ .fade-up-1..4),
  text helpers (.text-green/blue/purple/red/amber/muted, .text-2xs..xl, .font-medium..black, .uppercase, .mono-num),
  flex helpers (.flex, .flex-between, .flex-center, .flex-col, .items-center/end, .gap-1..4, .mt/mb-2..6).
- Palette vars: --bg-dark #0B0F19, --bg-elevated #111827, --bg-card #1F2937, --border-subtle #2A3441,
  --neon-green #22C55E (turf/starters/go), --neon-amber #F59E0B (hazard/questionable/tokens),
  --neon-red #FF4444 (flag/out/destructive), --neon-blue #4A9EFF (chain/info/links), --neon-purple #A855F7 (AI).
  --text-light #F4F6FB, --text-muted #8A94A6.
- `SPARK` = inline AI sparkle glyph. `ICONS` = {home,roster,matchup,league,ai}.
- Fonts: Outfit (display/headers via .outfit-font or h1-4), Inter (body), tabular nums via .mono-num.
- Coach Token buttons (Insure/Challenge) MUST be pill-shaped buttons with an icon, never plain links. Use .pill styling + button semantics; greyed/disabled with one-line explainer when unavailable.
- Voice: verbs on buttons ("Start","Bench","Claim","Insure"). Empty/error states state what happened + what to do, never "Oops"/apologies.
- Status chips by color: turf/green = healthy/active, amber = questionable, red = out/IR.

## Render pattern to follow (IMPORTANT — screens become async + DB-backed)
Existing screens (roster.ts, league.ts) use hardcoded arrays. You will convert them to read D1.
Signature becomes: `export async function renderX(db: D1Database, ...ids): Promise<string>`.
index.ts calls them with `await renderX(env.DB, id)` and returns `new Response(await ..., { headers: HTML_HEADERS })`.
On DB miss / empty, render a proper empty state in the interface voice — never crash.

## Injury status mapping (players.injury_status may be null, 'Questionable','Doubtful','Out')
- null/'' -> Healthy (green dot)
- 'Questionable'/'Doubtful' -> amber chip
- 'Out'/'IR' -> red chip + eligible for "Insure this player" token

## Nav / routing note
Bottom tab bar links: Home '/', My Team '/roster/T_TEST_1', Matchup '/matchup/TEST', League '/league/L_TEST', AI Coach '/coach'.
New screens you add must register routes in src/index.ts following the existing `url.pathname.startsWith(...)` pattern, returning HTML with `headers: HTML_HEADERS`.

## PITFALL (from project memory): never nest an <a> inside a row-level <a> — invalid HTML flattens the row DOM. Use <span>/<button> for inner interactive bits inside a linked row.
