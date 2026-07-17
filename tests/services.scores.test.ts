import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import { prisma, disconnect } from './helpers/db';
import { upsertScores, getJudgeScores } from '@/lib/services/scores';
afterAll(disconnect);

let judgeId:string, teamId:string, critIds:string[]=[];
beforeAll(async () => {
  const j = await prisma.user.create({ data:{ name:'ST Judge', role:'judge', accessCode:'ZZ99-ZZ98' } });
  const t = await prisma.team.create({ data:{ name:'ST Team', code:'ST' } });
  const c1 = await prisma.criterion.create({ data:{ name:'x', maxScore:10, order:100 } });
  const c2 = await prisma.criterion.create({ data:{ name:'y', maxScore:10, order:101 } });
  judgeId=j.id; teamId=t.id; critIds=[c1.id,c2.id];
});

describe('scores service', () => {
  it('upserts and reads back, then updates same rows (no dupes)', async () => {
    await upsertScores(judgeId, teamId, [{criterionId:critIds[0],value:8},{criterionId:critIds[1],value:9}], false);
    let rows = await getJudgeScores(judgeId, teamId);
    expect(rows.length).toBe(2);
    expect(rows.find(r=>r.criterionId===critIds[0])!.value).toBe(8);
    await upsertScores(judgeId, teamId, [{criterionId:critIds[0],value:10},{criterionId:critIds[1],value:9}], true);
    rows = await getJudgeScores(judgeId, teamId);
    expect(rows.length).toBe(2); // still 2, updated
    expect(rows.find(r=>r.criterionId===critIds[0])!.value).toBe(10);
    expect(rows[0].submitted).toBe(true);
  });
});
