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
export async function judgeProgress() {
  const rows = await prisma.score.groupBy({ by:['judgeId','teamId'], _max:{ submitted:true } });
  return rows.map(r => ({ judgeId:r.judgeId, teamId:r.teamId, submitted: !!r._max.submitted }));
}
