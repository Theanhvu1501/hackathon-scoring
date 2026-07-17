import { prisma } from '@/lib/db';
export function getJudgeScores(judgeId:string, teamId:string) {
  return prisma.score.findMany({ where:{ judgeId, teamId } });
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
