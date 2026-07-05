import { Env, fetchPlayers, fetchWeeklyScoreboard, fetchPlayerGameStats, fetchInjuries, fetchDepthCharts } from "../lib/sportsdata";

export async function syncAllData(env: Env, season: number, week: number): Promise<{ success: boolean; message: string }> {
  try {
    console.log(`Starting full data sync for season ${season}, week ${week}...`);

    // 1. Sync players (Static data, TTL 24h handled internally)
    console.log("Syncing players...");
    const players = await fetchPlayers(env, season);
    console.log(`Synced ${players.length} players.`);

    // 2. Sync depth charts (Static data, TTL 24h handled internally)
    console.log("Syncing depth charts...");
    const depthCharts = await fetchDepthCharts(env);
    console.log(`Synced ${depthCharts.length} depth chart entries.`);

    // 3. Sync weekly scoreboard/games (Live data, TTL 60s handled internally)
    console.log("Syncing scoreboard/games...");
    const games = await fetchWeeklyScoreboard(env, season, week);
    console.log(`Synced ${games.length} games.`);

    // 4. Sync player game stats (Live data, TTL 60s handled internally)
    console.log("Syncing player game stats...");
    const stats = await fetchPlayerGameStats(env, season, week);
    console.log(`Synced ${stats.length} player stats.`);

    // 5. Sync injuries (Live data, TTL 60s handled internally)
    console.log("Syncing injuries...");
    const injuries = await fetchInjuries(env, season, week);
    console.log(`Synced ${injuries.length} injuries.`);

    return {
      success: true,
      message: `Successfully synced season ${season} week ${week} data. Players: ${players.length}, Depth Charts: ${depthCharts.length}, Games: ${games.length}, Stats: ${stats.length}, Injuries: ${injuries.length}.`,
    };
  } catch (error: any) {
    console.error("Sync pipeline execution failed", error);
    return {
      success: false,
      message: `Sync failed: ${error.message || String(error)}`,
    };
  }
}
