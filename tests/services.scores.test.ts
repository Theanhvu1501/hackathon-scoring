import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import { prisma, disconnect } from './helpers/db';
import { upsertScores, getJudgeScores, judgeProgress, judgeScoreDetail } from '@/lib/services/scores';
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

  it('judgeProgress returns submitted (judge,team) pairs without a max(boolean) error', async () => {
    // depends on the submitted upsert above
    const progress = await judgeProgress();
    expect(Array.isArray(progress)).toBe(true);
    const mine = progress.find(p => p.judgeId === judgeId && p.teamId === teamId);
    expect(mine).toBeTruthy();
    expect(mine!.submitted).toBe(true);
  });
});

describe('judgeScoreDetail', () => {
  it('reports one row per team, marking teams the judge never opened', async () => {
    const untouched = await prisma.team.create({ data: { name: 'ST Untouched', code: 'SU' } });
    const detail = await judgeScoreDetail(judgeId);

    const mine = detail.rows.find((r) => r.teamId === teamId)!;
    // upserted above as 10 + 9, submitted
    expect(mine.total).toBe(19);
    expect(mine.status).toBe('submitted');
    expect(mine.values[critIds[0]]).toBe(10);
    expect(mine.values[critIds[1]]).toBe(9);

    const blank = detail.rows.find((r) => r.teamId === untouched.id)!;
    expect(blank.total).toBeNull();
    expect(blank.status).toBe('none');
    expect(blank.values).toEqual({});
  });

  it('marks a team with unsubmitted scores as a draft', async () => {
    const draftTeam = await prisma.team.create({ data: { name: 'ST Draft', code: 'SD' } });
    await upsertScores(judgeId, draftTeam.id, [{ criterionId: critIds[0], value: 7 }], false);

    const detail = await judgeScoreDetail(judgeId);
    const row = detail.rows.find((r) => r.teamId === draftTeam.id)!;
    expect(row.status).toBe('draft');
    expect(row.total).toBe(7);
  });

  it('lists criteria in barem order so the table columns line up', async () => {
    const detail = await judgeScoreDetail(judgeId);
    const orders = detail.criteria.map((c) => c.order);
    expect(orders).toEqual([...orders].sort((a, b) => a - b));
  });
});
