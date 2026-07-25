export type TeamLite = { id: string; name: string; code: string; logoUrl?: string | null; tag?: string | null };
export type ScoreLite = { judgeId: string; teamId: string; criterionId: string; value: number };
export type Phase = 'provisional' | 'final';
export type RankedRow = { team: TeamLite; score: number | null; judgeCount: number; rank: number; tie: boolean };

export function judgeTotal(scores: ScoreLite[], teamId: string, judgeId: string): number | null {
  const rows = scores.filter((s) => s.teamId === teamId && s.judgeId === judgeId);
  if (rows.length === 0) return null;
  return round1(rows.reduce((a, s) => a + s.value, 0));
}

// Team score is the SUM of every counted judge's total — deliberately not an
// average. A team only one judge has scored therefore sits far below a fully
// scored one, which is what the live board should show.
export function teamTotal(
  scores: ScoreLite[],
  teamId: string,
  opts: { excludeJudgeId?: string | null } = {},
): { total: number | null; judgeCount: number } {
  const judgeIds = [...new Set(
    scores.filter((s) => s.teamId === teamId && s.judgeId !== opts.excludeJudgeId).map((s) => s.judgeId),
  )];
  const totals = judgeIds
    .map((jid) => judgeTotal(scores, teamId, jid))
    .filter((t): t is number => t !== null);
  if (totals.length === 0) return { total: null, judgeCount: 0 };
  return { total: round1(totals.reduce((a, b) => a + b, 0)), judgeCount: totals.length };
}

// How many judges the phase counts — the head judge's card stays face down
// until the final reveal. Drives the display denominator (barem × this).
export function countedJudges(judges: { isHead: boolean }[], phase: Phase): number {
  return judges.filter((j) => phase === 'final' || !j.isHead).length;
}

export function computeLeaderboard(input: {
  teams: TeamLite[]; scores: ScoreLite[]; headJudgeId: string | null; phase: Phase;
}): RankedRow[] {
  const { teams, scores, headJudgeId, phase } = input;
  const exclude = phase === 'provisional' ? headJudgeId : null;
  const rows = teams.map((team) => {
    const { total, judgeCount } = teamTotal(scores, team.id, { excludeJudgeId: exclude });
    return { team, score: total, judgeCount, rank: 0, tie: false };
  });
  // sort: score desc (null last), then name asc
  rows.sort((a, b) => {
    if (a.score === null && b.score === null) return a.team.name.localeCompare(b.team.name);
    if (a.score === null) return 1;
    if (b.score === null) return -1;
    if (b.score !== a.score) return b.score - a.score;
    return a.team.name.localeCompare(b.team.name);
  });
  // golf ranks
  let lastScoreKey: string | null = null;
  let lastRank = 0;
  rows.forEach((r, i) => {
    const key = r.score === null ? 'null' : String(r.score);
    if (key === lastScoreKey) { r.rank = lastRank; } else { r.rank = i + 1; lastRank = r.rank; lastScoreKey = key; }
  });
  const rankCounts: Record<number, number> = {};
  rows.forEach((r) => { rankCounts[r.rank] = (rankCounts[r.rank] || 0) + 1; });
  rows.forEach((r) => { r.tie = rankCounts[r.rank] > 1; });
  return rows;
}

function round1(n: number): number { return Math.round(n * 10) / 10; }
