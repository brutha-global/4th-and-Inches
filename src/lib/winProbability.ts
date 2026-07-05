/**
 * Calculates win probability using a logistic regression formula based on current score differences,
 * remaining active player counts, and projected remaining points.
 */
export function calculateWinProbability(
  team1Score: number,
  team2Score: number,
  playersRemaining1: number,
  playersRemaining2: number,
  projections: { team1ProjectedRemaining: number; team2ProjectedRemaining: number }
): number {
  const totalProjected1 = team1Score + projections.team1ProjectedRemaining;
  const totalProjected2 = team2Score + projections.team2ProjectedRemaining;
  const diff = totalProjected1 - totalProjected2;

  // Estimate variance based on players remaining to play
  const totalRemaining = playersRemaining1 + playersRemaining2;
  const stdDev = Math.max(5.0, Math.sqrt(totalRemaining) * 6.0);

  // Logistic function
  const logit = diff / stdDev;
  const probability1 = 1.0 / (1.0 + Math.exp(-logit));

  // Round and clamp between 1% and 99%
  return Math.max(0.01, Math.min(0.99, parseFloat(probability1.toFixed(3))));
}
