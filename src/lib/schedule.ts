export interface MockMatchup {
  matchup_id: string;
  league_id: string;
  week: number;
  team1_id: string;
  team2_id: string;
}

/**
 * Generates a round-robin schedule for a league of teams over a number of weeks.
 * Uses the Circle Method to ensure every team plays each other.
 */
export function generateSchedule(
  leagueId: string,
  teamIds: string[],
  weeks: number
): MockMatchup[] {
  const list = [...teamIds];
  if (list.length % 2 !== 0) {
    list.push("BYE");
  }
  
  const n = list.length;
  const schedule: MockMatchup[] = [];

  for (let w = 1; w <= weeks; w++) {
    const r = (w - 1) % (n - 1);
    for (let i = 0; i < n / 2; i++) {
      const t1 = list[(r + i) % (n - 1)];
      const t2 = i === 0 ? list[n - 1] : list[(r + n - 1 - i) % (n - 1)];

      if (t1 !== "BYE" && t2 !== "BYE") {
        schedule.push({
          matchup_id: `match_${leagueId}_w${w}_${t1}_vs_${t2}`,
          league_id: leagueId,
          week: w,
          team1_id: t1,
          team2_id: t2
        });
      }
    }
  }
  return schedule;
}

/**
 * Resolves playoff seeding and schedules the bracket matches for weeks 15-17.
 * Seeding sorts teams by record (wins) with a tiebreaker of points_for.
 */
export function generatePlayoffBracket(
  leagueId: string,
  teams: { team_id: string; wins: number; points_for: number }[],
  playoffSize: 4 | 6,
  startWeek: number = 15
): MockMatchup[] {
  // Sort teams by seeding rules
  const seeded = [...teams].sort((a, b) => {
    if (b.wins !== a.wins) {
      return b.wins - a.wins;
    }
    return b.points_for - a.points_for;
  });

  const bracket: MockMatchup[] = [];

  if (playoffSize === 4) {
    // Week 15: Semifinals
    bracket.push({
      matchup_id: `playoff_${leagueId}_w${startWeek}_s1_vs_s4`,
      league_id: leagueId,
      week: startWeek,
      team1_id: seeded[0].team_id,
      team2_id: seeded[3].team_id
    });
    bracket.push({
      matchup_id: `playoff_${leagueId}_w${startWeek}_s2_vs_s3`,
      league_id: leagueId,
      week: startWeek,
      team1_id: seeded[1].team_id,
      team2_id: seeded[2].team_id
    });
  } else if (playoffSize === 6) {
    // Week 15: Quarterfinals (Seed 1 & 2 have Byes)
    bracket.push({
      matchup_id: `playoff_${leagueId}_w${startWeek}_s3_vs_s6`,
      league_id: leagueId,
      week: startWeek,
      team1_id: seeded[2].team_id,
      team2_id: seeded[5].team_id
    });
    bracket.push({
      matchup_id: `playoff_${leagueId}_w${startWeek}_s4_vs_s5`,
      league_id: leagueId,
      week: startWeek,
      team1_id: seeded[3].team_id,
      team2_id: seeded[4].team_id
    });
  }

  return bracket;
}
