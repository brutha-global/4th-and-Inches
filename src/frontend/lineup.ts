import { renderPage, SPARK } from "./theme";
import {
  getTeam,
  getRoster,
  getLeague,
  injuryMeta,
  initials,
  esc,
  DIVISION_MAP,
  CURRENT_WEEK,
  type DBPlayer,
} from "./data";

function hash(s: string): number {
  let h = 2166136261;
  for (const ch of s) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function projFor(p: DBPlayer): number {
  const base: Record<string, [number, number]> = {
    QB: [14, 26], RB: [6, 22], WR: [5, 20], TE: [4, 14], K: [6, 12], DEF: [3, 13],
  };
  const [lo, hi] = base[p.position] || [4, 16];
  const h = hash(p.player_id + p.name);
  return Math.round((lo + ((h % 1000) / 1000) * (hi - lo)) * 10) / 10;
}
/** Deterministic "game has started" lock — QB/some slots lock earlier for demo. */
function isLocked(p: DBPlayer): boolean {
  return (hash(p.player_id + "lock") % 5) === 0; // ~20% of players locked
}
/** Deterministic bye flag for demo (small chance). */
function isBye(p: DBPlayer): boolean {
  return (hash(p.player_id + "bye2") % 11) === 0;
}

const DRAG_HANDLE = `<span class="drag-h" title="Drag to reorder" aria-hidden="true">⋮⋮</span>`;
const LOCK_ICON = `<span class="lock-h" title="Game started — slot locked">🔒</span>`;

function lineupRow(p: DBPlayer, isStarter: boolean): string {
  const slot = p.slot_type || p.position;
  const inj = injuryMeta(p.injury_status);
  const proj = projFor(p);
  const locked = isStarter && isLocked(p);
  const bye = isBye(p);
  let border = "";
  let warning = "";
  if (isStarter && inj.isOut) {
    border = "border-left:3px solid var(--neon-red);padding-left:9px;";
    warning = `<span class="text-2xs text-red" style="display:block;margin-top:2px;">⚠ Ruled OUT — you're starting 0 points here.</span>`;
  } else if (isStarter && bye) {
    border = "border-left:3px solid var(--neon-red);padding-left:9px;";
    warning = `<span class="text-2xs text-red" style="display:block;margin-top:2px;">⚠ On bye — you're starting 0 points here.</span>`;
  } else if (isStarter && inj.isRisk) {
    border = "border-left:3px solid var(--neon-amber);padding-left:9px;";
    warning = `<span class="text-2xs text-amber" style="display:block;margin-top:2px;">Questionable — check status before kickoff.</span>`;
  }
  const badgeClass = slot === "FLEX" ? "WR" : slot;
  const handle = isStarter ? (locked ? LOCK_ICON : DRAG_HANDLE) : "";
  const action = isStarter
    ? `<button class="chip lu-act" onclick="lineupChange(this)" ${locked ? "disabled style=\"opacity:.4;cursor:not-allowed;color:var(--text-muted);\"" : "style=\"cursor:pointer;color:var(--text-muted);\""}>Bench</button>`
    : `<button class="chip lu-act" onclick="lineupChange(this)" style="cursor:pointer;color:var(--neon-green);border-color:rgba(34,197,94,.4);">Swap in</button>`;
  return `
    <div class="player-row lu-row" style="${border}">
      <div class="flex items-center gap-2" style="flex:1;min-width:0;">
        ${handle}
        <span class="position-badge pos-${esc(badgeClass)}" style="min-width:38px;flex-shrink:0;">${esc(slot)}</span>
        <div class="avatar" style="width:36px;height:36px;font-size:12px;flex-shrink:0;">${esc(initials(p.name))}</div>
        <div class="flex-col" style="min-width:0;">
          <span class="font-semibold text-sm" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(p.name)}</span>
          <span class="text-2xs text-muted">${esc(p.team)}${inj.isRisk && !isStarter ? ` · <span class="${inj.chipClass === "pill-red" ? "text-red" : "text-amber"}">${esc(inj.label)}</span>` : ""}</span>
          ${warning}
        </div>
      </div>
      <div class="flex items-center gap-3" style="flex-shrink:0;padding-left:8px;">
        <span class="outfit-font mono-num font-bold text-sm">${proj.toFixed(1)}</span>
        ${action}
      </div>
    </div>`;
}

function emptyState(): string {
  const body = `
    <div class="page-header fade-up fade-up-1">
      <a href="/roster/T_TEST_1" class="header-back">←</a>
      <span class="outfit-font font-black text-lg">Lineup</span>
      <span style="width:36px;"></span>
    </div>
    <div class="card fade-up fade-up-2" style="text-align:center;padding:40px 20px;">
      <span class="section-label" style="justify-content:center;">Nothing to set yet</span>
      <p class="text-sm text-muted" style="margin-top:8px;line-height:1.5;">
        This team hasn't drafted a roster. Once the draft wraps, set your starting lineup here.
      </p>
      <a href="/roster/T_TEST_1" class="btn-secondary" style="margin-top:16px;max-width:200px;">Back to My Team</a>
    </div>`;
  return renderPage({ title: "Lineup", body, active: "roster" });
}

const EXTRA_CSS = `
  .drag-h { color: var(--text-muted); cursor: grab; font-size:14px; letter-spacing:-2px; width:16px; text-align:center; flex-shrink:0; }
  .drag-h:active { cursor: grabbing; }
  .lock-h { width:16px; text-align:center; flex-shrink:0; font-size:12px; opacity:.8; }
  details.ai-panel > summary { list-style:none; cursor:pointer; }
  details.ai-panel > summary::-webkit-details-marker { display:none; }
  details.ai-panel > summary .chev { transition: transform .2s; }
  details.ai-panel[open] > summary .chev { transform: rotate(90deg); }
  #saveBar { transform: translateX(-50%) translateY(120%); transition: transform .28s cubic-bezier(.2,.7,.2,1); }
  #saveBar.show { transform: translateX(-50%) translateY(0); }
  @media (min-width:900px){
    #saveBar { position: static !important; transform: none !important; width:100% !important; max-width:none !important; padding:0 !important; margin-top:16px; display:none; }
    #saveBar.show { display:block; }
  }
`;

export async function renderLineup(db: D1Database, teamId: string): Promise<string> {
  const team = await getTeam(db, teamId);
  const league = await getLeague(db, "L_TEST");
  const week = league?.week ?? CURRENT_WEEK;
  if (!team) return emptyState();

  const roster = await getRoster(db, teamId, week);
  if (roster.length === 0) return emptyState();

  const starters = roster.filter((p) => p.is_starter === 1);
  const bench = roster.filter((p) => p.is_starter !== 1);

  // AI optimal: find bench players that outproject a same-eligibility starter.
  const FLEX_OK = new Set(["RB", "WR", "TE"]);
  const suggestions: { out: DBPlayer; in: DBPlayer; delta: number }[] = [];
  const usedBench = new Set<string>();
  for (const s of starters) {
    const slot = s.slot_type || s.position;
    const eligible = bench.filter((b) => {
      if (usedBench.has(b.player_id)) return false;
      if (slot === "FLEX") return FLEX_OK.has(b.position);
      return b.position === slot;
    });
    let best: DBPlayer | null = null;
    let bestProj = projFor(s);
    for (const b of eligible) {
      const bp = projFor(b);
      if (bp > bestProj + 1.5) { best = b; bestProj = bp; }
    }
    if (best) {
      suggestions.push({ out: s, in: best, delta: Math.round((bestProj - projFor(s)) * 10) / 10 });
      usedBench.add(best.player_id);
    }
  }
  suggestions.sort((a, b) => b.delta - a.delta);
  const topSuggestions = suggestions.slice(0, 2);
  const netDelta = topSuggestions.reduce((a, s) => a + s.delta, 0);

  const aiPanel =
    topSuggestions.length > 0
      ? `<details class="ai-panel card fade-up fade-up-2" open style="border-color:rgba(168,85,247,.34);">
          <summary class="flex-between mb-2">
            <span class="section-label" style="margin:0;color:var(--neon-purple);">${SPARK} AI Optimal Lineup <span class="chev text-muted" style="display:inline-block;">›</span></span>
            <span class="pill pill-green" style="padding:3px 10px;">+${netDelta.toFixed(1)} pts</span>
          </summary>
          ${topSuggestions
            .map(
              (s) => `<div class="player-row" style="border:none;padding:8px 0;">
                <div class="flex-col" style="min-width:0;flex:1;">
                  <span class="text-sm"><span class="text-muted">Bench</span> ${esc(s.out.name)} <span class="text-muted mono-num">(${projFor(s.out).toFixed(1)})</span></span>
                  <span class="text-sm"><span class="text-green">Start</span> ${esc(s.in.name)} <span class="text-green mono-num">(${projFor(s.in).toFixed(1)})</span></span>
                </div>
                <button class="chip lu-act" onclick="lineupChange(this)" style="cursor:pointer;color:var(--neon-purple);border-color:rgba(168,85,247,.4);flex-shrink:0;">Apply</button>
              </div>`
            )
            .join("")}
          <button class="btn-purple" onclick="lineupChange(this, ${topSuggestions.length})" style="margin-top:10px;">Apply all changes</button>
        </details>`
      : `<div class="card fade-up fade-up-2" style="border-color:rgba(34,197,94,.28);">
          <span class="section-label" style="color:var(--neon-green);">${SPARK} AI Optimal Lineup</span>
          <p class="text-sm text-muted" style="line-height:1.5;">Your lineup is already optimal — no bench player outprojects a starter this week. Nice work, coach.</p>
        </div>`;

  const meta = DIVISION_MAP[teamId];

  const body = `
    <div class="page-header fade-up fade-up-1">
      <a href="/roster/${esc(teamId)}" class="header-back">←</a>
      <span class="outfit-font font-black text-lg">Lineup & Changes</span>
      <span style="width:36px;"></span>
    </div>

    <div class="glass-card flex-between fade-up fade-up-1">
      <div class="flex-col">
        <span class="outfit-font font-black text-base">${esc(team.name)}</span>
        <span class="text-2xs text-muted">${esc(meta?.manager || "")} · Week ${week}</span>
      </div>
      <a href="/roster/${esc(teamId)}" class="chip" style="text-decoration:none;">View roster</a>
    </div>

    ${aiPanel}

    <div class="desk-grid">
      <div class="desk-main">
        <div class="card fade-up fade-up-3">
          <span class="section-label">Starting lineup</span>
          ${starters.map((p) => lineupRow(p, true)).join("")}
        </div>
      </div>
      <div class="desk-side">
        <div class="card fade-up fade-up-3">
          <span class="section-label">Bench</span>
          ${bench.map((p) => lineupRow(p, false)).join("")}
        </div>
        <a href="#" class="text-2xs text-muted" style="display:block;text-align:center;margin-bottom:12px;">View recent lineup changes →</a>
      </div>
    </div>

    <!-- Spacer so the last row clears the sticky save bar + tab bar -->
    <div style="height:72px;"></div>

    <!-- Sticky save bar (hidden until a change is made) -->
    <div id="saveBar" style="position:fixed;bottom:76px;left:50%;width:100%;max-width:480px;padding:0 16px;z-index:90;">
      <button class="btn-primary" onclick="saveLineup()" style="box-shadow:0 8px 28px rgba(34,197,94,.4);">Save lineup <span id="changeCount"></span></button>
    </div>
  `;

  const extraJs = `
    var _changes = 0;
    function refreshBar(){
      var bar = document.getElementById('saveBar');
      var lbl = document.getElementById('changeCount');
      if (_changes > 0){ bar.classList.add('show'); lbl.textContent = '· ' + _changes + ' change' + (_changes>1?'s':''); }
      else { bar.classList.remove('show'); lbl.textContent=''; }
    }
    function lineupChange(el, n){ _changes += (n||1); refreshBar(); if(navigator.vibrate)navigator.vibrate(12); }
    function saveLineup(){ _changes = 0; refreshBar(); }
  `;

  return renderPage({ title: "Lineup", body, active: "roster", extraCss: EXTRA_CSS, extraJs });
}
