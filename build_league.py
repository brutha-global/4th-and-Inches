#!/usr/bin/env python3
"""
4th & Inches — League Builder / Seed generator.

Reads cached SportsData player + team JSON (.sd_players.json / .sd_teams.json),
selects fantasy-relevant players, builds a full 12-team league (2 conferences x
2 divisions x 3 teams), runs an ADP-ordered SNAKE auto-draft to fill every team's
starters + bench, seeds standings + one week of matchups, and emits a single
idempotent SQL file (seed_league.sql) that can be applied to D1 (local or remote).

Rosters follow standard lineup: QB, RB, RB, WR, WR, WR, TE, FLEX, K, DEF + 6 bench.
"""
import json, os, random, html

HERE = os.path.dirname(os.path.abspath(__file__))
PLAYERS = json.load(open(os.path.join(HERE, ".sd_players.json")))
TEAMS   = json.load(open(os.path.join(HERE, ".sd_teams.json")))

random.seed(4)  # deterministic league every run

LEAGUE_ID = "L_TEST"
SEASON, WEEK = 2026, 5
FANTASY_POS = {"QB", "RB", "WR", "TE", "K"}

# Starting lineup template (slot_type, is_starter always 1 here)
STARTER_SLOTS = ["QB", "RB", "RB", "WR", "WR", "WR", "TE", "FLEX", "K", "DEF"]
FLEX_OK = {"RB", "WR", "TE"}
BENCH_COUNT = 6

# ── 12 managers across 2 conferences x 2 divisions ──────────────────────
# team_id T_TEST_1 is the human user's team (matches existing nav / demo).
DIVISIONS = {
    ("American", "Gridiron"): [
        ("T_TEST_1", "Gridiron Giants", "Coach Alex"),
        ("T_02", "Steel Curtain", "Marcus"),
        ("T_03", "Motor City Maulers", "Deshawn"),
    ],
    ("American", "Blitz"): [
        ("T_04", "Blitz Brigade", "Priya"),
        ("T_05", "Red Zone Raiders", "Tommy"),
        ("T_06", "Fourth Down Kings", "Sofia"),
    ],
    ("National", "Hurry-Up"): [
        ("T_07", "Rushing Royalty", "Jordan"),
        ("T_08", "End Zone Elite", "Kenji"),
        ("T_09", "Hail Mary Heroes", "Bianca"),
    ],
    ("National", "Trench"): [
        ("T_10", "Trench Titans", "Malik"),
        ("T_11", "Pocket Passers", "Elena"),
        ("T_12", "Two-Minute Drill", "Chris"),
    ],
}

def adp(p):
    a = p.get("AverageDraftPosition")
    return a if isinstance(a, (int, float)) and a > 0 else 9999.0

def sql_str(s):
    if s is None:
        return "NULL"
    return "'" + str(s).replace("'", "''") + "'"

# ── Build player pool ───────────────────────────────────────────────────
pool = [p for p in PLAYERS if p.get("Position") in FANTASY_POS and p.get("Active")]
pool.sort(key=adp)

# Team defenses as synthetic DEF "players"
def_players = []
for t in TEAMS:
    def_players.append({
        "PlayerID": f"DEF_{t['Key']}",
        "Name": f"{t['Name']} D/ST",
        "Position": "DEF",
        "Team": t["Key"],
        "Status": "Active",
        "InjuryStatus": None,
        "PhotoUrl": t.get("WikipediaLogoUrl") or "",
        "ByeWeek": t.get("ByeWeek"),
        "AverageDraftPosition": 150.0 + random.random() * 40,
        "UpcomingGameOpponent": None,
    })
# Rank defenses roughly by a random-but-stable strength
def_players.sort(key=lambda d: d["AverageDraftPosition"])

# ── Normalize into a clean player record ────────────────────────────────
def norm(p):
    inj = p.get("InjuryStatus")
    if inj in ("Scrambled", "", None):
        inj = None
    status = "Active"
    # small share of skill players get a realistic injury tag
    return {
        "player_id": str(p["PlayerID"]),
        "name": p["Name"],
        "position": p["Position"],
        "team": p.get("Team") or "FA",
        "status": status,
        "injury_status": inj,
        "depth": p.get("DepthOrder") if isinstance(p.get("DepthOrder"), int) else None,
        "headshot": (p.get("PhotoUrl") or "").replace("'", ""),
        "adp": adp(p),
        "bye": p.get("ByeWeek"),
        "opp": p.get("UpcomingGameOpponent"),
    }

norm_pool = [norm(p) for p in pool]
norm_def  = [norm(p) for p in def_players]

# Assign a handful of injuries deterministically for realism (OUT / Questionable)
INJ_TAGS = ["Questionable", "Questionable", "Out", "Doubtful", "Questionable"]
for i, pl in enumerate(norm_pool):
    if i % 37 == 11:
        pl["injury_status"] = INJ_TAGS[i % len(INJ_TAGS)]

# players we will persist = everyone drafted + a free-agent buffer for waivers/FA
DRAFT_ROUNDS = len(STARTER_SLOTS) + BENCH_COUNT  # 16
NUM_TEAMS = 12

# ── Snake draft ─────────────────────────────────────────────────────────
# Build per-position queues sorted by ADP, plus an overall ADP queue.
teams_order = []
for div, roster in DIVISIONS.items():
    for tid, name, mgr in roster:
        teams_order.append(tid)
# draft order = ADP-fair random but stable
random.shuffle(teams_order)

# Roster requirements per team
NEED = {"QB": 1, "RB": 2, "WR": 3, "TE": 1, "K": 1, "DEF": 1}  # starters
# bench: flexible best-available skill players
rosters = {tid: {"starters": [], "bench": []} for tid in teams_order}
taken = set()

by_pos = {}
for pl in norm_pool:
    by_pos.setdefault(pl["position"], []).append(pl)
def_queue = list(norm_def)
overall = list(norm_pool)  # already ADP sorted

def draft_best(need_pos=None, exclude_pos=None):
    """Pop the best available (lowest ADP) player, optionally constrained to a position set."""
    for pl in overall:
        if pl["player_id"] in taken:
            continue
        if need_pos and pl["position"] not in need_pos:
            continue
        if exclude_pos and pl["position"] in exclude_pos:
            continue
        taken.add(pl["player_id"])
        return pl
    return None

def draft_def(tid):
    for d in def_queue:
        if d["player_id"] not in taken:
            taken.add(d["player_id"])
            return d
    return None

# Snake: fill required starters first in a sensible priority, then FLEX, K, DEF, then bench.
# Target starter composition per team: 1 QB, 2 RB, 3 WR, 1 TE, 1 FLEX, 1 K, 1 DEF = 9 (+ FLEX = 10 slots).
STARTER_CAP = {"QB": 1, "RB": 2, "WR": 3, "TE": 1, "FLEX": 1, "K": 1, "DEF": 1}
# Draft priority: skill positions by ADP value first, K/DEF late (as in real drafts).
FILL_PRIORITY = ["RB", "WR", "RB", "WR", "QB", "WR", "TE", "FLEX", "DEF", "K"]
# Bench composition target: ensure a backup QB + balanced skill depth.
BENCH_TARGET = ["QB", "RB", "RB", "WR", "WR", "TE"]

for rnd in range(DRAFT_ROUNDS):
    order = teams_order if rnd % 2 == 0 else list(reversed(teams_order))
    for tid in order:
        r = rosters[tid]
        filled = [s["slot"] for s in r["starters"]]
        # next starter slot whose cap isn't met, in priority order
        next_slot = None
        for slot in FILL_PRIORITY:
            if filled.count(slot) < STARTER_CAP[slot]:
                next_slot = slot
                break
        if next_slot == "DEF":
            pl = draft_def(tid)
            if pl:
                r["starters"].append({"slot": "DEF", **pl})
            continue
        if next_slot == "K":
            pl = draft_best(need_pos={"K"})
            if pl: r["starters"].append({"slot": "K", **pl})
            continue
        if next_slot == "FLEX":
            pl = draft_best(need_pos=FLEX_OK)
            if pl: r["starters"].append({"slot": "FLEX", **pl})
            continue
        if next_slot in ("QB", "TE", "RB", "WR"):
            pl = draft_best(need_pos={next_slot})
            if pl: r["starters"].append({"slot": next_slot, **pl})
            continue
        # all starters filled -> bench: fill toward BENCH_TARGET composition
        bench_pos = [b["position"] for b in r["bench"]]
        want = None
        for tp in BENCH_TARGET:
            need_ct = BENCH_TARGET.count(tp)
            if bench_pos.count(tp) < need_ct:
                want = tp
                break
        pl = draft_best(need_pos={want}) if want else None
        if pl is None:
            pl = draft_best(exclude_pos={"K", "DEF"})
        if pl:
            r["bench"].append(pl)

# ── Emit SQL ────────────────────────────────────────────────────────────
out = []
out.append("-- AUTO-GENERATED by build_league.py — full 12-team league on real SportsData players.")
out.append("-- Idempotent: clears L_TEST league data then rebuilds. Safe to re-run.")
out.append("-- NOTE: no BEGIN/COMMIT — D1 remote manages its own transaction per file.\n")

# Clear prior league state (but keep players table growing / upsert)
for tbl, col in [("rosters", None), ("standings", "league_id"), ("matchups", "league_id"),
                 ("teams", "league_id")]:
    if tbl == "rosters":
        out.append("DELETE FROM rosters WHERE team_id IN (SELECT team_id FROM teams WHERE league_id='L_TEST');")
    else:
        out.append(f"DELETE FROM {tbl} WHERE {col}='L_TEST';")
out.append("DELETE FROM leagues WHERE league_id='L_TEST';\n")

# All players we reference (drafted set + free-agent buffer of next 120 by ADP)
persisted = {}
for r in rosters.values():
    for s in r["starters"]: persisted[s["player_id"]] = s
    for b in r["bench"]:     persisted[b["player_id"]] = b
# free agent buffer for Free Agency screen
fa_buffer = [pl for pl in norm_pool if pl["player_id"] not in persisted][:120]
for pl in fa_buffer: persisted[pl["player_id"]] = pl
for d in norm_def:
    persisted.setdefault(d["player_id"], d)

now = 1782735122
out.append("-- Players (upsert) --")
for pl in persisted.values():
    out.append(
        "INSERT INTO players (player_id,name,position,team,status,injury_status,depth_chart_position,headshot_url,updated_at) "
        f"VALUES ({sql_str(pl['player_id'])},{sql_str(pl['name'])},{sql_str(pl['position'])},{sql_str(pl['team'])},"
        f"{sql_str(pl.get('status') or 'Active')},{sql_str(pl.get('injury_status'))},{sql_str(pl.get('depth'))},{sql_str(pl.get('headshot'))},{now}) "
        "ON CONFLICT(player_id) DO UPDATE SET name=excluded.name,position=excluded.position,team=excluded.team,"
        "status=excluded.status,injury_status=excluded.injury_status,headshot_url=excluded.headshot_url,updated_at=excluded.updated_at;"
    )

# League
out.append("\n-- League --")
out.append(
    "INSERT INTO leagues (league_id,name,commissioner_id,scoring_type,roster_size,bench_size,season,week,status,league_type) "
    f"VALUES ('L_TEST','Dynasty Warriors','OWNER_1','PPR',16,6,{SEASON},{WEEK},'Active','classic');"
)

# Teams (+ records) and standings
out.append("\n-- Teams + standings --")
# fabricate plausible records that sum sensibly
records = {}
base_records = [(4,0),(3,1),(3,1),(2,2),(2,2),(2,2),(1,3),(1,3),(1,3),(3,1),(2,2),(0,4)]
random.shuffle(base_records)
team_meta = []
for div, roster in DIVISIONS.items():
    conf, division = div
    for (tid, name, mgr) in roster:
        team_meta.append((tid, name, mgr, conf, division))

for i, (tid, name, mgr, conf, division) in enumerate(team_meta):
    w, l = base_records[i]
    pf = round(420 + random.random()*110, 1)
    pa = round(410 + random.random()*100, 1)
    logo = ""
    out.append(
        "INSERT INTO teams (team_id,league_id,owner_id,name,logo_url,wins,losses,points_for,points_against) "
        f"VALUES ({sql_str(tid)},'L_TEST',{sql_str('OWNER_'+tid)},{sql_str(name)},{sql_str(logo)},{w},{l},{pf},{pa});"
    )
    streak = random.choice(["W1","W2","W3","L1","L2"])
    seed = i+1
    out.append(
        "INSERT INTO standings (standing_id,league_id,team_id,wins,losses,ties,points_for,points_against,streak,playoff_seed,updated_at) "
        f"VALUES ({sql_str('ST_'+tid)},'L_TEST',{sql_str(tid)},{w},{l},0,{pf},{pa},{sql_str(streak)},{seed},{now});"
    )
    records[tid] = (w,l,pf,pa,conf,division)

# Rosters
out.append("\n-- Rosters (starters + bench) --")
rid = 0
for tid, r in rosters.items():
    for s in r["starters"]:
        rid += 1
        out.append(
            "INSERT INTO rosters (roster_id,team_id,player_id,slot_type,week,is_starter) "
            f"VALUES ({sql_str('RS_'+str(rid))},{sql_str(tid)},{sql_str(s['player_id'])},{sql_str(s['slot'])},{WEEK},1);"
        )
    for b in r["bench"]:
        rid += 1
        out.append(
            "INSERT INTO rosters (roster_id,team_id,player_id,slot_type,week,is_starter) "
            f"VALUES ({sql_str('RS_'+str(rid))},{sql_str(tid)},{sql_str(b['player_id'])},'BENCH',{WEEK},0);"
        )

# Matchups for the week (pair within schedule)
out.append("\n-- Matchups (current week) --")
tids = [t[0] for t in team_meta]
random.shuffle(tids)
pairs = list(zip(tids[::2], tids[1::2]))
for i,(a,b) in enumerate(pairs):
    s1 = round(80+random.random()*60,1); s2 = round(80+random.random()*60,1)
    out.append(
        "INSERT INTO matchups (matchup_id,league_id,week,team1_id,team2_id,team1_score,team2_score,winner_id,status) "
        f"VALUES ({sql_str('MU_'+str(i))},'L_TEST',{WEEK},{sql_str(a)},{sql_str(b)},{s1},{s2},NULL,'InProgress');"
    )

out.append("\n-- done (no COMMIT — D1 wraps the file).")

sql = "\n".join(out)
path = os.path.join(HERE, "seed_league.sql")
open(path,"w").write(sql)

# Summary
print(f"SQL written: {path} ({len(sql):,} bytes, {sql.count(chr(10))} lines)")
print(f"Players persisted: {len(persisted)} (drafted+FA buffer+DEF)")
print(f"Teams: {len(team_meta)}  Rosters rows: {rid}  Matchups: {len(pairs)}")
print("\nSample — Gridiron Giants (T_TEST_1) starters:")
for s in rosters["T_TEST_1"]["starters"]:
    print(f"  {s['slot']:4} {s['position']:3} {s['name']:24} {s['team']}  ADP {s['adp']:.1f}")
print("  BENCH:", ", ".join(f"{b['name']}({b['position']})" for b in rosters["T_TEST_1"]["bench"]))
