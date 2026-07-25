import { prisma } from '@/lib/db';
export function getJudgeScores(judgeId:string, teamId:string) {
  return prisma.score.findMany({ where:{ judgeId, teamId } });
}
export function validateScoreValues(
  values:{ criterionId:string; value:number }[],
  maxById:Record<string,number>,
): string | null {
  if (!Array.isArray(values) || values.length === 0) return 'values must be a non-empty array';
  for (const v of values) {
    if (!v || typeof v.criterionId !== 'string' || !v.criterionId) return 'each value requires a criterionId';
    if (!Object.prototype.hasOwnProperty.call(maxById, v.criterionId)) return `unknown criterionId: ${v.criterionId}`;
    const max = maxById[v.criterionId];
    if (typeof v.value !== 'number' || !Number.isFinite(v.value)) return `value for ${v.criterionId} must be a finite number`;
    if (v.value < 0) return `value for ${v.criterionId} must be >= 0`;
    if (v.value > max) return `value for ${v.criterionId} must be <= ${max}`;
  }
  return null;
}
export async function upsertScores(
  judgeId:string, teamId:string,
  values:{ criterionId:string; value:number }[], submitted:boolean,
) {
  await prisma.$transaction(values.map(v =>
    prisma.score.upsert({
      where:{ judgeId_teamId_criterionId:{ judgeId, teamId, criterionId:v.criterionId } },
      update:{ value:v.value, submitted },
      create:{ judgeId, teamId, criterionId:v.criterionId, value:v.value, submitted },
    })
  ));
}
// Team ids the given judge has already SUBMITTED (used to mark done teams in the judge UI).
export async function judgeSubmittedTeamIds(judgeId: string): Promise<string[]> {
  const rows = await prisma.score.findMany({
    where: { judgeId, submitted: true },
    select: { teamId: true },
    distinct: ['teamId'],
  });
  return rows.map((r) => r.teamId);
}

export type JudgeScoreStatus = 'submitted' | 'draft' | 'none';
export type JudgeScoreRow = {
  teamId: string; teamName: string; teamCode: string;
  values: Record<string, number>;   // criterionId -> value, missing key = not scored
  total: number | null;             // null when the judge has not scored this team at all
  status: JudgeScoreStatus;
};

// Every team crossed with one judge's card, for the admin detail popup. Teams the
// judge never opened are still returned (status 'none') so the admin can see the
// gaps, not just what was filled in.
export async function judgeScoreDetail(judgeId: string): Promise<{
  criteria: { id: string; name: string; maxScore: number; order: number }[];
  rows: JudgeScoreRow[];
}> {
  const [criteria, teams, scores] = await Promise.all([
    prisma.criterion.findMany({
      orderBy: { order: 'asc' },
      select: { id: true, name: true, maxScore: true, order: true },
    }),
    prisma.team.findMany({ orderBy: { createdAt: 'asc' }, select: { id: true, name: true, code: true } }),
    prisma.score.findMany({
      where: { judgeId },
      select: { teamId: true, criterionId: true, value: true, submitted: true },
    }),
  ]);

  const rows = teams.map((team) => {
    const mine = scores.filter((s) => s.teamId === team.id);
    const values: Record<string, number> = {};
    for (const s of mine) values[s.criterionId] = s.value;
    const total = mine.length
      ? Math.round(mine.reduce((a, s) => a + s.value, 0) * 10) / 10
      : null;
    // A card counts as submitted only when every row the judge saved is flagged —
    // a partial save leaves it a draft.
    const status: JudgeScoreStatus =
      mine.length === 0 ? 'none' : mine.every((s) => s.submitted) ? 'submitted' : 'draft';
    return { teamId: team.id, teamName: team.name, teamCode: team.code, values, total, status };
  });

  return { criteria, rows };
}

// Returns the (judge, team) pairs a judge has SUBMITTED. Uses distinct instead of
// groupBy(_max: boolean) because Postgres has no max(boolean) aggregate.
export async function judgeProgress() {
  const rows = await prisma.score.findMany({
    where: { submitted: true },
    select: { judgeId: true, teamId: true },
    distinct: ['judgeId', 'teamId'],
  });
  return rows.map(r => ({ judgeId: r.judgeId, teamId: r.teamId, submitted: true }));
}
