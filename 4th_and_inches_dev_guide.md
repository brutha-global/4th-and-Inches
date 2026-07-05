

🏈

**4TH & INCHES**

**Universal Developer Build Guide**

*Next-Generation Fantasy Football Platform*

| 5 Phases | 14 Prompts | 12 Weeks | Full Stack |
| :---: | :---: | :---: | :---: |

# **1\. Project Overview**

**VISION**

4th & Inches is a next-generation fantasy football platform where users act as real head coaches — making live game-day substitutions, receiving AI-powered coaching advice, managing franchises, and competing socially. It blends the strategy of NFL coaching with the accessibility of mainstream fantasy apps.

**CORE DIFFERENTIATORS**

* Live substitution system: Injury Insurance swaps \+ Coach Challenge tokens during live games

* AI Coach powered by Azure AI Foundry — lineup optimizer, trade analyzer, weekly recaps

* Coach XP, archetypes, reputation, and cosmetics for long-term engagement

* Real-time league state via Cloudflare Durable Objects (WebSocket-first architecture)

* Full franchise mode: salary cap, contracts, dynasty, rookie development

**TECH STACK**

| Mobile App | Flutter 3.x \+ Dart 3.x (iOS & Android) |
| :---- | :---- |
| **API Layer** | Cloudflare Workers (TypeScript) |
| **Live State** | Cloudflare Durable Objects (WebSocket) |
| **Database** | Cloudflare D1 (SQLite) |
| **File Storage** | Cloudflare R2 |
| **AI Engine** | Azure AI Foundry (GPT-4o) |
| **Sports Data** | SportsDataIO NFL API |
| **Push Notifications** | Firebase Cloud Messaging |
| **Subscriptions** | RevenueCat |
| **Analytics** | PostHog |
| **CI/CD** | GitHub Actions |

**KEY API CREDENTIALS & DOCS**

| SportsDataIO Key | ee36220d6dbc4fcbb4184020f38cffdc |
| :---- | :---- |
| **API Docs** | sportsdata.io/developers/api-documentation/nfl |
| **NFL Ref Gist** | gist.github.com/nntrn/ee26cb2a0716de0947a0a4e9a157bc1c |
| **CF Workers Docs** | developers.cloudflare.com/workers/ |
| **Azure AI Foundry** | Configure AZURE\_AI\_ENDPOINT \+ AZURE\_AI\_KEY as wrangler secrets |
| **RevenueCat** | Configure via RevenueCat dashboard \+ purchases\_flutter SDK |
| **PostHog** | Configure POSTHOG\_KEY in Flutter \+ Workers |

# **2\. System Architecture**

**REQUEST FLOW**

Flutter App  
      │  
Cloudflare CDN  
      │  
Cloudflare Workers (TypeScript API)  
      │  
┌──────────────────────────────┐  
│  Fantasy API  (D1 \+ SDio)   │  
│  AI API       (Azure GPT-4o)│  
│  League API   (Durable Obj) │  
└──────────────────────────────┘  
      │  
Cloudflare D1  (relational data)  
Cloudflare R2  (AI content cache)  
Durable Objects (live league state)  
      │  
Azure AI Foundry ── SportsDataIO  
Firebase FCM ──────── RevenueCat  
PostHog Analytics

**CLOUDFLARE WORKER ROUTES**

| GET  /players | Roster of all NFL players (cached 24h) |
| :---- | :---- |
| **GET  /games/live** | Live scoreboard (cached 60s) |
| **GET  /league/:id/standings** | Standings \+ win probability |
| **GET  /matchup/:id** | Live matchup detail with player contributions |
| **POST /team/:id/lineup** | Set starting lineup with validation |
| **POST /league/:id/waivers** | Submit waiver claim |
| **POST /substitution** | Request live substitution (validated \+ DO broadcast) |
| **POST /ai/lineup/optimize** | AI lineup optimizer |
| **POST /ai/trade/analyze** | AI trade analyzer |
| **POST /ai/recap/generate** | AI weekly recap generation |
| **GET  /league/:id/ws  (DO)** | WebSocket — live league state room |
| **POST /webhooks/revenuecat** | Subscription lifecycle webhook |
| **POST /notifications/register** | Register FCM device token |

| PHASE 1  ·  Weeks 1–2 🏗️  Foundation & Data Infrastructure |
| :---- |

Everything downstream depends on clean data. Build the Cloudflare D1 schema, SportsDataIO fetcher with caching, fantasy scoring engine, and the Durable Objects real-time layer before touching any UI.

## **3\. Prompt 1 — D1 Schema \+ SportsDataIO Fetcher**

| ◆ BACKEND · CLOUDFLARE · TYPESCRIPT  Cloudflare D1 Schema \+ SportsDataIO Fetcher Utility |
| :---- |
| You are a senior backend engineer building "4th & Inches", a next-gen fantasy football app.Set up the entire Cloudflare D1 SQLite schema and data-fetching utility.TECH STACK:\- Cloudflare Workers (TypeScript)\- Cloudflare D1 (SQLite, binding name "DB")\- SportsDataIO NFL API (key: ee36220d6dbc4fcbb4184020f38cffdc)\- Docs: https://sportsdata.io/developers/api-documentation/nflDELIVERABLE 1 — migrations/001\_initial.sql:Create these tables:  players        (player\_id, name, position, team, status, injury\_status,                  depth\_chart\_position, headshot\_url, updated\_at)  games          (game\_id, week, season, home\_team, away\_team, status,                  home\_score, away\_score, quarter, time\_remaining, updated\_at)  player\_stats   (stat\_id, player\_id, game\_id, week, season, pass\_yards,                  pass\_tds, rush\_yards, rush\_tds, rec\_yards, rec\_tds,                  receptions, targets, fumbles, interceptions,                  fantasy\_points, updated\_at)  injuries       (injury\_id, player\_id, game\_id, injury\_type, status,                  practice\_status, updated\_at)  depth\_charts   (depth\_id, player\_id, team, position, depth\_order, updated\_at)  sync\_log       (id, entity, synced\_at, record\_count, error)DELIVERABLE 2 — src/lib/sportsdata.ts:  fetchPlayers(season)  fetchWeeklyScoreboard(season, week)  fetchPlayerGameStats(season, week)  fetchInjuries(season, week)  fetchDepthCharts()  \- SQLite caching: check D1 before fetching; TTL 60s live, 24h static  \- Full TypeScript interfaces for all response shapesDELIVERABLE 3 — src/workers/sync.ts (Cron):  \- Every 60s on Sat/Sun 12pm–11pm ET (live window)  \- Every 5 min otherwise  \- Upsert all entities into D1  \- Exponential backoff on fetch errors (1s, 2s, 4s, max 30s)  \- Write result to sync\_log table |

## **4\. Prompt 2 — Fantasy Scoring Engine**

| ◆ BACKEND · ENGINE · TYPESCRIPT  Configurable Fantasy Scoring Engine |
| :---- |
| Build the fantasy scoring engine for "4th & Inches".File: src/lib/scoring.tsSCORING CONFIG TYPE (ScoringConfig):  passingYardsPerPoint, passingTDPoints, intPenalty, fumblePenalty  rushingYardsPerPoint, rushingTDPoints  receivingYardsPerPoint, receivingTDPoints, pprValue (0 | 0.5 | 1\)  kickingFG0\_39, kickingFG40\_49, kickingFG50plus, kickingPAT  defShutout, def1\_6, def7\_13, def14\_17, def28\_34, def35plus  sackPoints, defIntPoints, defFumblePoints, defTDPointsSTANDARD BONUSES (add to config):  bonus300PassYards: \+3 pts for 300+ pass yards  bonus100RushYards: \+3 pts for 100+ rush yards  bonus100RecYards:  \+3 pts for 100+ rec yards  comebackBonus:     \+5% if player's team was down 14+ and wonFUNCTIONS TO BUILD:1\. calculatePlayerScore(stats, config): number2\. calculateLiveScore(partialStats, config): number3\. calculateProjectedScore(player\_id, week, config, db): Promise\<number\>   \- 4-week rolling average \* opponent defense rank factor \* home/away factor4\. scoreLineup(lineup, week, config, db): Promise\<LineupScore\>EXPORTS:  DEFAULT\_SCORING\_CONFIG   (standard, 1pt PPR)  HALF\_PPR\_CONFIG  NO\_PPR\_CONFIGAll functions must be pure and unit-testable. Full JSDoc comments. |

## **5\. Prompt 3 — Live League State (Durable Objects)**

| ◆ BACKEND · DURABLE OBJECTS · WEBSOCKET  Real-Time League Room via Cloudflare Durable Objects |
| :---- |
| Build the real-time live league state system for "4th & Inches".File: src/durable-objects/LeagueRoom.tsPURPOSE: Each fantasy league gets one DO instance. Maintains live scores,broadcasts updates to all managers via WebSocket.CLIENT → SERVER EVENTS:  subscribe           { leagueId, teamId, authToken }  substitution\_request { type, playerId, replacementId, teamId }  ping                keepaliveSERVER → ALL CLIENTS EVENTS:  score\_update        { teamId, playerId, points, totalTeamScore }  injury\_alert        { playerId, playerName, injuryType, status }  substitution\_approved { teamId, outPlayer, inPlayer, reason }  substitution\_denied  { teamId, reason }  matchup\_update      { matchupId, team1Score, team2Score, winProbability }  full\_state\_snapshot full league state on subscribeSUBSTITUTION VALIDATION:  Coach Challenge:    \- Player's game must have started    \- Team has 1 token remaining this week    \- Replacement on bench, game not started    \- Each roster slot substitutable only once/week  Injury Insurance:    \- Player status \= "Out" AND game has started    \- 1 token per week; resets Monday 12am ETD1 WRITES:  \- Log all subs to substitution\_log (approved \+ denied)  \- Deduct token from substitution\_tokens tableAlso create src/index.ts routing /league/:id/ws → correct DO instance.Handle disconnection/reconnection gracefully. Full TypeScript types. |

| PHASE 2  ·  Weeks 3–4 🏈  Core Fantasy Features |
| :---- |

With data flowing, build the full fantasy layer: drafting, waiver wire, the signature live substitution system, matchups, and standings.

## **6\. Prompt 4 — Draft System \+ Waiver Wire**

| ◆ FEATURE · DRAFT · WAIVERS  Snake/Auction Draft \+ Waiver Wire \+ Roster Management |
| :---- |
| Build the complete draft and waiver wire system for "4th & Inches".NEW D1 TABLES:  leagues    (league\_id, name, commissioner\_id, scoring\_type, roster\_size,              bench\_size, season, week, status, league\_type)  teams      (team\_id, league\_id, owner\_id, name, logo\_url, wins, losses,              points\_for, points\_against)  rosters    (roster\_id, team\_id, player\_id, slot\_type, week, is\_starter)  waivers    (waiver\_id, league\_id, team\_id, player\_id, drop\_player\_id,              priority, bid\_amount, status, processed\_at)  drafts     (draft\_id, league\_id, type, status, current\_pick, round)  draft\_picks(pick\_id, draft\_id, round, pick\_number, team\_id, player\_id, timestamp)DRAFT DURABLE OBJECT — src/durable-objects/DraftRoom.ts:  \- Snake \+ auction modes  \- 10-min per pick timer (configurable), auto-pick on timeout  \- Auto-draft queue: ranked list per manager; pull from top on auto-pick  \- WebSocket events: pick\_made, your\_turn, queue\_update, draft\_complete  \- On complete: populate rosters tableWAIVER SYSTEM — src/api/waivers.ts:  POST /league/:id/waivers     — submit claim  \- Order: inverse of standings  \- Process: Cron Wednesday 12am ET  \- FAAB support: $100 budget, blind bidding, store bids encryptedROSTER API — src/api/rosters.ts:  GET  /team/:id/roster         — full roster \+ projections \+ injury status  POST /team/:id/lineup         — set lineup (validate positions, no "Out" starters)  POST /team/:id/trade          — initiate trade (both sides must accept)All endpoints: JSON responses, proper HTTP codes, descriptive errors. |

## **7\. Prompt 5 — Live Substitution System (Signature Feature)**

| ◆ FEATURE · LIVE SUBS · CORE  Live Substitution Engine — Injury Insurance \+ Coach Challenge |
| :---- |
| Build the live substitution system — the defining feature of "4th & Inches".File: src/lib/substitutions.tsANTI-ABUSE RULES (apply to all types):  \- Each roster slot substitutable only once per week  \- Replacement must be on bench \+ game not started  \- No substitutions after overtime begins  \- Cannot re-enter a removed playerINJURY INSURANCE (type: "injury\_insurance"):  \- Player status must be "Out" AND game must have started  \- Replacement earns 100% of points scored  \- 1 use per week; resets Monday 12am ET  \- Validate against live SportsDataIO injury feedCOACH CHALLENGE (type: "coach\_challenge"):  \- Available from kickoff to end of Q3 for that player's game  \- No performance threshold — manager discretion  \- 1 use per week; resets Monday 12am ET  \- Stub: deduct Coach Energy (future premium, return ok if no energy system)MOMENTUM SWAP (type: "momentum\_swap") — STUB/PREMIUM:  \- Only at halftime window (±5 min of halftime)  \- Player must be below 25% of projected score  \- Costs 1 Coach Token (stub: always return token\_cost: 1\)TACTICAL TIMEOUT (type: "tactical\_timeout") — STUB/PREMIUM:  \- Reserve one lineup slot up to 60 min before kickoff  \- Costs 1 Coach TokenD1 TABLES:  substitution\_tokens (team\_id, week, season, injury\_insurance\_used,                       coach\_challenge\_used, momentum\_swaps\_remaining,                       tactical\_timeouts\_remaining)  substitution\_log    (sub\_id, team\_id, week, type, out\_player\_id,                       in\_player\_id, requested\_at, approved\_at,                       denied\_reason, points\_at\_time\_of\_sub)FUNCTIONS:  validateSubstitution(request, db): Promise\<ValidationResult\>  processSubstitution(request, db, leagueRoom): Promise\<SubResult\>  resetWeeklyTokens(leagueId, week, db): Promise\<void\>  getSubstitutionHistory(teamId, week, db): Promise\<SubLog\[\]\>Every denied validation must return a clear human-readable reason string.Broadcast approved subs via LeagueRoom DO immediately. |

## **8\. Prompt 6 — Matchup Engine \+ Standings**

| ◆ FEATURE · MATCHUPS · STANDINGS  Matchup Scheduling, Live Scoring, Win Probability & Standings |
| :---- |
| Build the matchup and standings engine for "4th & Inches".D1 TABLES:  matchups  (matchup\_id, league\_id, week, team1\_id, team2\_id,             team1\_score, team2\_score, winner\_id, status)  standings (standing\_id, league\_id, team\_id, wins, losses, ties,             points\_for, points\_against, streak, playoff\_seed, updated\_at)SCHEDULE — src/lib/schedule.ts:  generateSchedule(leagueId, teams, weeks)  \- Round-robin, every team plays each other before repeating  \- Support 8/10/12/14 team leagues  \- Playoff seeding: top 4 or 6 by record; tiebreak \= points\_for  \- generatePlayoffBracket(leagueId, week: 15-17)WIN PROBABILITY — src/lib/winProbability.ts:  calculateWinProbability(team1Score, team2Score,    playersRemaining1, playersRemaining2, projections): number  \- Formula: logistic regression on score\_diff / sqrt(projected\_remaining)  \- Update every 60s during live games via DO broadcastMATCHUP API — src/api/matchups.ts:  GET /league/:id/matchups/current   all matchups with live scores  GET /matchup/:id                   detailed matchup \+ player contributions  GET /league/:id/standings          full standingsLEAGUE TYPES (store in leagues.league\_type):  classic      H2H weekly matchups  best\_ball    auto-set optimal lineup each week, no management  survivor     lowest scorer eliminated each week  guillotine   same as survivor  dynasty      multi-year rosters (stub multi-year, single season works fully)Export getLeagueTypeConfig(type) factory that returns scoring/matchup/standingsadjustments per league type. |

| PHASE 3  ·  Weeks 5–6 🤖  AI Coaching Layer |
| :---- |

Integrate Azure AI Foundry (GPT-4o) to power the AI Coach, Trade Analyzer, Commissioner, and News Analyst. Every AI call must have a rule-based fallback and response caching.

## **9\. Prompt 7 — AI Coach \+ Lineup Optimizer**

| ◆ AI · AZURE AI FOUNDRY · GPT-4O  AI Coach: Lineup Optimizer, Trade Analyzer, Waiver Assistant, Recap |
| :---- |
| Build the AI Coach system for "4th & Inches".File: src/ai/coach.tsAzure: configure AZURE\_AI\_ENDPOINT \+ AZURE\_AI\_KEY as wrangler secrets. Model: gpt-4o.FEATURE 1 — POST /ai/lineup/optimize:  Input: teamId, week, scoringConfig  Process: fetch roster \+ projections \+ injuries \+ matchup data from D1;           ask AI to rank starters by projected pts considering:           opponent defense rank (last 4 wks pts allowed at position),           home/away factor, recent 3-wk form  Output: { lineup: LineupSlot\[\], reasoning: { \[playerId\]: string },            confidence: 0-100 }  Fallback: sort by 4-week avg fantasy pointsFEATURE 2 — POST /ai/trade/analyze:  Input: { give: playerId\[\], receive: playerId\[\], teamId, leagueId }  Process: fetch both rosters, 4-wk avg value, remaining schedule difficulty  Output: { verdict: "accept"|"decline"|"counter",            analysis: string (≤150 words),            give\_value: number, receive\_value: number,            counter\_suggestion?: string }FEATURE 3 — POST /ai/waivers/suggest:  Input: teamId, week, faab\_budget  Output: top 3 adds with reasoning, who to drop, bid amountFEATURE 4 — POST /ai/recap/generate:  Input: teamId, week  Output: broadcaster-style recap (≤200 words) \+ Coach Grade A–FFEATURE 5 — POST /ai/injury/forecast:  Input: playerId  Output: { likelihood\_to\_play: %, confidence: "low"|"medium"|"high",            reasoning: string }ALL AI CALLS:  \- 30s timeout  \- Rule-based fallback on failure (log the failure)  \- Cache responses in D1 ai\_response\_cache for 1 hour (same inputs \= same hash)  \- Log token usage to ai\_usage table (feature, tokens\_in, tokens\_out, cost\_estimate) |

## **10\. Prompt 8 — AI Commissioner \+ News Analyst**

| ◆ AI · COMMISSIONER · NEWS  AI Commissioner (Collusion Detection, Power Rankings) \+ News Analyst |
| :---- |
| Build the AI Commissioner and News Analyst for "4th & Inches".Files: src/ai/commissioner.ts, src/ai/news.tsAI COMMISSIONER:1\. POST /ai/commissioner/review (trade/lineup/substitution moderation):   \- Collusion detection: flag if trade value difference \> 60%   \- Flag suspicious waiver patterns   \- Output: { approved: bool, flag\_reason?: string,               severity: "info"|"warning"|"violation" }2\. POST /ai/commissioner/ask (rule Q\&A):   \- Answer league rule questions based on league's scoringConfig \+ platform rules   \- Max 100 words, cite the relevant rule   \- Example: "Can I start a player on IR?" → context-aware answer3\. POST /ai/commissioner/power-rankings:   \- Analyze all teams: record, points\_for, strength of schedule, roster quality   \- Output: ordered list \+ witty 1-sentence blurb per team   \- Regenerate weeklyAI NEWS ANALYST:1\. GET /ai/news/players/:ids (comma-separated playerIds):   \- Fetch from SportsDataIO /scores/json/News   \- Filter to fantasy-relevant events only   \- Classify impact: "start" | "sit" | "monitor" | "drop" | "add"   \- Return 1-sentence fantasy impact per player2\. GET /ai/predictions/week/:week:   \- Top 5 boom candidates (high upside, under-owned)   \- Top 5 bust risks (overvalued starters)3\. POST /ai/matchup/analyze:   \- Input: playerId, opponentTeam, week   \- Output: { grade: A-F, start\_confidence: 0-100, key\_factor: string }STORAGE: Cache all generated content in R2 at key ai/{feature}/{id}/{week}.json.Freshness check: regenerate if \> 2 hours old. |

| PHASE 4  ·  Weeks 7–9 📱  Flutter Mobile App |
| :---- |

Build the Flutter app with a premium dark-mode design identity: electric green (\#00FF87) on near-black (\#0A0A0F), Barlow Condensed for scores/headings, Inter for body copy. Every screen must support real-time WebSocket updates.

## **11\. Prompt 9 — App Architecture \+ Design System**

| ◆ FRONTEND · FLUTTER · ARCHITECTURE  Flutter App Architecture, Design Tokens, API Client & WebSocket Layer |
| :---- |
| Set up the complete Flutter app architecture for "4th & Inches".DESIGN TOKENS (lib/core/theme/app\_theme.dart):  Colors: background \#0A0A0F, surface \#141418, card \#1C1C24,          accent\_green \#00FF87, accent\_blue \#4A9EFF, accent\_red \#FF4444,          border \#2A2A3A, text\_primary \#F0F0FF, text\_muted \#8A8AAA  Typography: Barlow Condensed (scores, headings, numbers — bold, athletic)              Inter (body copy, labels, captions)  Elevation: custom shadow using border color, no material default shadowsPACKAGES (pubspec.yaml):  flutter\_riverpod: ^2.x (with @riverpod codegen)  go\_router: for shell routes \+ deep links  dio: HTTP client  web\_socket\_channel: WebSocket  hive\_flutter: offline cache  firebase\_messaging: FCM push  posthog\_flutter: analytics  purchases\_flutter: RevenueCat  freezed \+ json\_serializable: data classes  google\_fonts: Barlow Condensed \+ Inter  shimmer: loading states  lottie: animationsPROJECT STRUCTURE:  lib/    core/  api/ websocket/ models/ providers/ theme/ analytics/    features/  auth/ draft/ league/ team/ lineup/ live/               ai\_coach/ trade/ profile/ subscription/BUILD THESE FILES:1\. lib/core/api/api\_client.dart   \- Dio with auth interceptor (Bearer from Hive), retry (3x exponential),     error → AppException transformer2\. lib/core/websocket/league\_socket.dart   \- Connect to /league/:id/ws   \- Auto-reconnect: 1s → 2s → 4s → 8s → 30s cap   \- Heartbeat ping every 30s   \- Expose Stream\<LeagueEvent\> (sealed class for all event types)   \- Handle app foreground/background transitions3\. lib/core/models/ — Freezed data classes:   Player, Team, Roster, Matchup, Standing, Substitution, PlayerStats,   AICoachResponse, SubstitutionToken4\. go\_router config with ShellRoute bottom nav:   tabs: Home | League | My Team | Live | AI CoachInclude full pubspec.yaml. All code must null-safe and lint-clean. |

## **12\. Prompt 10 — Live Game Center Screen**

| ◆ FRONTEND · LIVE SCREEN · FLUTTER  Live Game Center — Real-Time Scores, Injury Alerts & Substitution UI |
| :---- |
| Build the Live Game Center screen for "4th & Inches".File: lib/features/live/live\_game\_center\_screen.dartLAYOUT (dark, scrollable, sticky header):SECTION 1 — MATCHUP HEADER (sticky):  \- Your team score vs opponent score (large, animated number tick on update)  \- Win probability bar: green/red gradient, updates via WebSocket  \- Score diff badge: "+12.4" green or "-7.1" redSECTION 2 — YOUR LINEUP:  Each starter as a PlayerCard with these states:    PLAYING     — pulsing green dot \+ live stat line (e.g. "127 rush, 1 TD")    FINISHED    — gray, final points    NOT STARTED — blue, projected points    INJURED     — red banner \+ ⚠️ \+ "Injury Insurance Available" CTA button    UNDERPERFORMING — amber \+ "Coach Challenge Available" CTA button      (trigger: \< 50% of projection AND game \> 50% complete AND token available)  Tap card → PlayerDetailBottomSheet with full stat lineSECTION 3 — SUBSTITUTION DRAWER (slides up on CTA tap):  \- Eligible bench players (game not started)  \- Each: name, matchup, projected pts  \- Confirm button: "Use Injury Insurance" or "Use Coach Challenge"  \- Animated token counter (🪙 1 remaining → 0\)  \- Real-time validation error toast on denialSECTION 4 — LIVE NFL SCOREBOARD (horizontal scroll):  \- Mini game cards: teams, score, quarter \+ clock  \- Tap → modal listing fantasy-relevant players in that game \+ their live ptsSECTION 5 — OPPONENT LINEUP (collapsed, expandable):  \- Same card formatSTATE:  LiveGameProvider — subscribes to LeagueSocket stream, builds reactive state  SubstitutionProvider — state machine:    idle → selecting → confirming → processing → done | errorPOLISH:  \- AnimatedSwitcher on all score transitions  \- ShimmerLoading on initial load  \- HapticFeedback.lightImpact on every tap  \- Reduced motion respected (MediaQuery.disableAnimations) |

## **13\. Prompt 11 — AI Coach Screen \+ Draft Room**

| ◆ FRONTEND · AI COACH · DRAFT ROOM  AI Coach Hub Screen \+ Immersive Draft Room Screen |
| :---- |
| Build two key Flutter screens for "4th & Inches".─── AI COACH SCREEN — lib/features/ai\_coach/ai\_coach\_screen.dart ───Purple (\#C084FC) as AI accent. Card-based layout, gradient headers.1\. LINEUP OPTIMIZER card:   "Optimize Lineup" → loading (brain/shimmer animation 2-3s) → result   Recommended starters with reasoning chips below each player name   Confidence arc (0-100%) as glowing curved progress bar   "Apply Suggestions" → confirm dialog → POST /ai/lineup/optimize2\. TRADE ANALYZER card:   Two drag-drop columns: "You Give" | "You Receive"   "Analyze" → verdict card: ACCEPT (green) / DECLINE (red) / COUNTER (amber)   Horizontal animated value comparison bar3\. WAIVER ASSISTANT card:   Top 3 ranked cards; swipe right to claim, left to skip   Show FAAB bid suggestion4\. WEEKLY RECAP card:   Newspaper-style card with Coach Grade (A–F, color-coded)   Share button → screenshot \+ native share sheet5\. BOOM/BUST PICKS card:   Two columns: 🔥 Boom (green) | 💥 Bust (red), 5 players each─── DRAFT ROOM — lib/features/draft/draft\_room\_screen.dart ───Full-screen dark mode. This is the Super Bowl of UX moments.LAYOUT:  Top bar: Round X · Pick Y/Z · Countdown ring (red when \<30s)  Left 40%: Your ranked queue (drag to reorder; top player glows when your turn)  Right 60%: Available players — filter tabs ALL/QB/RB/WR/TE/K/DEF \+ search bar  Bottom ticker: recent picks scrolling horizontallyPLAYER CARD states:  available: name, position badge, ADP, projected pts  drafted:   dimmed \+ "DRAFTED" overlay  your\_pick\_moment: entire card pulses with green glow \+ "Draft Player" CTAWEBSOCKET EVENTS:  pick\_made    → mark player drafted, update ticker, advance timer  your\_turn    → vibrate \+ sound \+ highlight queue top  draft\_complete → navigate to RosterRevealScreenROSTER REVEAL:  Cards deal one by one (playing card animation)  Show final team summary with projected pts total |

| PHASE 5  ·  Weeks 10–12 🚀  Gamification, Monetization & Launch |
| :---- |

Complete the engagement loop with Coach XP, reputation, and cosmetics. Add RevenueCat subscription tiers, push notifications, PostHog analytics, and GitHub Actions CI/CD for launch.

## **14\. Prompt 12 — Coach XP, Archetypes & Bench Heat**

| ◆ FEATURE · GAMIFICATION · ENGAGEMENT  Coach XP System, Archetypes, Reputation & Bench Heat |
| :---- |
| Build the Coach XP, Reputation, and Cosmetics system for "4th & Inches".Files: src/lib/coachXP.ts, src/api/events.tsD1 TABLES:  coach\_profiles    (coach\_id, user\_id, level 1-50, xp, reputation\_score,                     archetype, title, created\_at)  coach\_achievements(achievement\_id, coach\_id, type, earned\_at, metadata)  cosmetics         (cosmetic\_id, type, name, description, rarity,                     unlock\_condition)  coach\_cosmetics   (coach\_id, cosmetic\_id, unlocked\_at, is\_equipped)  xp\_events         (event\_id, coach\_id, xp\_amount, reason, created\_at)  bench\_heat        (player\_id, team\_id, consecutive\_bench\_weeks,                     accumulated\_bonus)XP AWARDS:  Win matchup:             \+100 XP  Correct start/sit:       \+25  XP (starter outperformed bench player)  Successful Coach Challenge sub: \+50 XP  Draft completed:         \+200 XP  Set lineup on time:      \+10  XP / week  Made a trade:            \+30  XP  Perfect week:            \+500 XPLEVELS: XP\_to\_next \= 500 × current\_level. Titles:  1=Rookie, 10=Field General, 20=Head Coach, 35=Legend, 50=Hall of FamerARCHETYPES (unlock at level 5, choose one):  Gambler     — extra Coach Challenge token every 3 weeks  Analyst     — AI lineup suggestions include extra data (stub extended context)  Grinder     — 1 waiver priority boost per week (stub boost flag)  Loyalist    — Bench Heat bonus applies (+0.1 pts/game on bench, max 1.5, resets on start)BENCH HEAT (Loyalist perk \+ base platform):  Track consecutive bench weeks per player per team  Accumulate 0.1 pts/game benched (base); Loyalist gets full benefit  Apply bonus to final score at week closeREPUTATION:  Start 1000\. Win \+15, Loss \-10, Late/missing lineup \-50  Show on standings. Season MVP cosmetic to top reputation manager.POST /events/game-complete:  Trigger all XP awards \+ reputation updates \+ bench heat \+ achievement checks  Called by Cron after each week's games finalize |

## **15\. Prompt 13 — RevenueCat Subscriptions \+ IAP**

| ◆ MONETIZATION · REVENUECAT · FLUTTER  Subscription Tiers, Coach Tokens (IAP) & Paywall Screen |
| :---- |
| Build the full subscription and IAP system for "4th & Inches".TIERS:  FREE:   1 league (10-team max), basic lineup, AI Coach 3 queries/week  PRO  ($7.99/mo | $49.99/yr):          Unlimited leagues, all AI features, advanced analytics,          2 premium cosmetics, Momentum Swap unlocked, priority waivers  ELITE ($14.99/mo | $99.99/yr):          All Pro \+ AI Commissioner unlimited, custom scoring,          private dynasty leagues, early access, "Elite Coach" badge \+ animated bannerCOACH TOKENS (consumable IAP, premium currency):  100 tokens  $0.99  500 tokens  $3.99  (best value badge)  1200 tokens $7.99  Used for: extra Momentum Swaps, Tactical Timeouts, extra AI queriesCLOUDFLARE WORKER — src/api/subscriptions.ts:  POST /webhooks/revenuecat:    INITIAL\_PURCHASE  → update users.subscription\_tier, subscription\_expires\_at    RENEWAL           → extend subscription\_expires\_at    CANCELLATION      → set cancel\_at\_period\_end \= true    EXPIRATION        → downgrade to free  GET /user/subscription → { tier, features, expires\_at }  Middleware: checkSubscription(tier) → 403 if insufficient tierFLUTTER — lib/features/subscription/paywall\_screen.dart:  Three-column plan comparison: Free | Pro | Elite  Annual plan highlighted: "Save 48%" badge  Animated gradient CTA button  Restore Purchases buttonlib/features/subscription/subscription\_provider.dart (Riverpod):  fetchOfferings() from RevenueCat  purchase(package) with error handling  restorePurchases()  Stream\<SubscriptionStatus\>Add checkSubscription() guard throughout codebase — gate premium featuresand call GoRouter.push('/paywall?trigger=feature\_name') on breach. |

## **16\. Prompt 14 — Push Notifications, Analytics & CI/CD**

| ◆ LAUNCH · NOTIFICATIONS · ANALYTICS · DEVOPS  FCM Push Notifications, PostHog Analytics & GitHub Actions CI/CD |
| :---- |
| Build the notification system, analytics layer, and CI/CD for "4th & Inches".─── PUSH NOTIFICATIONS ───WORKER: src/notifications/notifier.tsNOTIFICATION TYPES \+ TRIGGERS:  injury\_alert       → player status → "Out" during a game                       Body: "\[Name\] ruled OUT — Injury Insurance available\!"                       Deep link: /live → sub drawer open for that player  score\_update       → every 30 min during live games, if matchup within 20 pts                       Body: "You're up by 12.4 with 2 players left 🔥"  lineup\_reminder    → 1 hr before first game, if lineup unchanged from prior week                       Body: "⚠️ Set your lineup — kickoff in 1 hour"  waiver\_processed   → Wednesday after waiver run  trade\_offer        → on trade creation  coach\_challenge\_opp→ player \< 40% of projection, game \> 50%, token remaining  weekly\_recap\_ready → Tuesday after week endsD1 TABLES:  user\_devices           (user\_id, fcm\_token, platform, updated\_at)  user\_notification\_prefs(user\_id, injury\_alerts bool, score\_updates bool,                           lineup\_reminder bool, waiver\_processed bool,                           trade\_offer bool, coach\_challenge\_opp bool,                           weekly\_recap\_ready bool)POST /notifications/register → upsert device token─── POSTHOG ANALYTICS ───lib/core/analytics/analytics\_service.dart — typed wrapper:EVENTS:  User lifecycle: app\_opened, onboarding\_completed, league\_created, league\_joined  Engagement:     lineup\_set{auto\_optimized}, substitution\_attempted{type,success},                  trade\_sent/accepted/declined, ai\_coach\_used{feature},                  draft\_completed{auto\_picked\_count}  Monetization:   paywall\_shown{trigger}, subscription\_started{tier},                  coach\_token\_purchased{package}Workers: POST latency, D1 query time, WebSocket events → PostHog HTTP API─── CI/CD — .github/workflows/deploy.yml ───  On push to main:    1\. dart test (unit tests)    2\. flutter build ios \--release (no-code-sign) \+ flutter build apk \--release    3\. wrangler deploy \--env production (all Workers)  On pull\_request:    1\. dart test only    2\. wrangler deploy \--env stagingSecrets in GitHub Actions: CF\_API\_TOKEN, AZURE\_AI\_KEY, POSTHOG\_KEY,SPORTSDATA\_API\_KEY, FIREBASE\_SERVICE\_ACCOUNT |

# **17\. Quick Reference**

**D1 TABLES MASTER LIST**

| players | NFL player roster \+ injury \+ depth chart position |
| :---- | :---- |
| **games** | NFL game scores, status, quarter, clock |
| **player\_stats** | Weekly player stat lines \+ fantasy\_points |
| **injuries** | In-game and practice injury statuses |
| **depth\_charts** | Positional depth per team |
| **sync\_log** | Data sync history \+ error log |
| **leagues** | League config, scoring type, season |
| **teams** | Manager teams, record, points |
| **rosters** | Player-to-team assignments \+ slot type |
| **waivers** | Pending waiver claims \+ FAAB bids |
| **matchups** | H2H matchup results per week |
| **standings** | Win/loss, points, playoff seed |
| **drafts / draft\_picks** | Draft state \+ pick history |
| **substitution\_tokens** | Weekly Injury Insurance \+ Coach Challenge usage |
| **substitution\_log** | Every sub request with outcome |
| **coach\_profiles** | XP, level, archetype, reputation |
| **bench\_heat** | Consecutive bench weeks \+ accumulated bonus |
| **ai\_response\_cache** | Cached AI responses (1-hr TTL) |
| **ai\_usage** | Token usage \+ cost estimates per AI call |
| **user\_devices** | FCM push tokens per user |
| **user\_notification\_prefs** | Per-user notification toggles |

**ENVIRONMENT VARIABLES / SECRETS**

| SPORTSDATA\_API\_KEY | ee36220d6dbc4fcbb4184020f38cffdc |
| :---- | :---- |
| **AZURE\_AI\_ENDPOINT** | Your Azure AI Foundry endpoint URL |
| **AZURE\_AI\_KEY** | Your Azure AI Foundry API key |
| **POSTHOG\_KEY** | Your PostHog project API key |
| **FIREBASE\_SA\_JSON** | Firebase service account JSON (GitHub Actions secret) |
| **CF\_API\_TOKEN** | Cloudflare API token (GitHub Actions secret) |
| **JWT\_SECRET** | Secret for signing auth tokens |

**BUILD ORDER (CRITICAL PATH)**

1. Prompt 1 — D1 schema \+ SportsDataIO fetcher (everything depends on data)

2. Prompt 2 — Scoring engine (needed before any fantasy logic)

3. Prompt 3 — Durable Objects live room (needed before live features)

4. Prompt 4 — Draft \+ waiver \+ rosters

5. Prompt 5 — Live substitution engine (signature feature)

6. Prompt 6 — Matchups, standings, schedule

7. Prompt 7 — AI Coach (requires data layer complete)

8. Prompt 8 — AI Commissioner \+ News Analyst

9. Prompt 9 — Flutter architecture \+ design system

10. Prompt 10 — Live Game Center screen

11. Prompt 11 — AI Coach screen \+ Draft Room

12. Prompt 12 — Coach XP, archetypes, bench heat

13. Prompt 13 — RevenueCat subscriptions \+ IAP

14. Prompt 14 — Push notifications, PostHog, CI/CD

**KEY EXTERNAL REFERENCES**

| SportsDataIO API Docs | sportsdata.io/developers/api-documentation/nfl |
| :---- | :---- |
| **SportsDataIO Dictionary** | sportsdata.io/developers/data-dictionary/nfl |
| **SportsDataIO Integrations** | sportsdata.io/developers/integration-tools |
| **NFL Ref Gist (nntrn)** | gist.github.com/nntrn/ee26cb2a0716de0947a0a4e9a157bc1c |
| **sportsdataverse** | Multi-sport data, NFLverse coverage |
| **nflreadpy** | Python access to NFLverse data |
| **nfl-data-pipeline** | Open-source ETL project for NFL data |
| **LeagueLogs API** | Free fantasy-focused project, player values |
| **nflmeta.org** | Free tier NFL metadata |
| **CF Workers Docs** | developers.cloudflare.com/workers/ |
| **CF Durable Objects** | developers.cloudflare.com/durable-objects/ |
| **Flutter Pub.dev** | pub.dev — all Flutter package docs |
| **Azure AI Foundry** | ai.azure.com — configure GPT-4o endpoint |
| **RevenueCat Docs** | docs.revenuecat.com — Flutter SDK setup |
| **PostHog Docs** | posthog.com/docs — Flutter integration |
| **Firebase FCM** | firebase.google.com/docs/cloud-messaging |

*4th & Inches  ·  Developer Build Guide  ·  v1.0*