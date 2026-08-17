import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import { prisma, disconnect } from './helpers/db';
import {
  upsertScores, getJudgeScores, judgeProgress, judgeScoreDetail, scoreMatrix,
  isCardLocked, saveScoreCard, unlockCard,
} from '@/lib/services/scores';
// Fixture dùng tên/mã cố định nên PHẢI tự dọn trước khi tạo: không dọn thì lần
// chạy thứ hai trên cùng database sẽ đụng unique constraint của accessCode.
// Trước đây file này chỉ qua được nhờ test reveal-flow tình cờ seed xoá sạch user.
const FIXTURE_TEAMS = ['ST Team', 'ST Untouched', 'ST Draft'];
async function cleanFixtures() {
  await prisma.user.deleteMany({ where:{ accessCode:'ZZ99-ZZ98' } });
  await prisma.team.deleteMany({ where:{ name:{ in: FIXTURE_TEAMS } } });
  await prisma.criterion.deleteMany({ where:{ order:{ in:[100, 101] } } });
}

afterAll(async () => { await cleanFixtures(); await disconnect(); });

let judgeId:string, teamId:string, critIds:string[]=[];
beforeAll(async () => {
  await cleanFixtures();
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

describe('scoreMatrix', () => {
  it('trả về đủ đội × giám khảo và đánh dấu người đang xem', async () => {
    const judges = await prisma.user.findMany({ where: { role: 'judge' }, orderBy: { createdAt: 'asc' } });
    const teamCount = await prisma.team.count();
    const m = await scoreMatrix(judges[0].id);

    expect(m.judges).toHaveLength(judges.length);
    expect(m.judges[0].isMe).toBe(true);
    expect(m.judges.filter((j) => j.isMe)).toHaveLength(1);
    expect(m.rows).toHaveLength(teamCount);
    // mỗi hàng có đúng một ô cho mỗi giám khảo, theo đúng thứ tự cột
    expect(m.rows[0].cells.map((c) => c.judgeId)).toEqual(m.judges.map((j) => j.id));
  });

  it('phân biệt đã nộp / nháp / chưa chấm và cộng đúng tổng đội', async () => {
    const m = await scoreMatrix(judgeId);
    const mine = m.rows.find((r) => r.teamId === teamId)!;
    const myCell = mine.cells.find((c) => c.judgeId === judgeId)!;
    expect(myCell.total).toBe(19);        // 10 + 9 từ test ở trên
    expect(myCell.status).toBe('submitted');

    const draft = m.rows.find((r) => r.teamName === 'ST Draft')!;
    expect(draft.cells.find((c) => c.judgeId === judgeId)!.status).toBe('draft');

    const untouched = m.rows.find((r) => r.teamName === 'ST Untouched')!;
    expect(untouched.total).toBeNull();
    expect(untouched.cells.every((c) => c.status === 'none' && c.total === null)).toBe(true);

    // tổng đội = tổng các ô có điểm
    const sum = mine.cells.reduce((a, c) => a + (c.total ?? 0), 0);
    expect(mine.total).toBeCloseTo(Math.round(sum * 10) / 10, 5);
  });

  it('sắp đội theo createdAt, không theo hạng — đây là bảng đối chiếu phiếu', async () => {
    const teams = await prisma.team.findMany({ orderBy: { createdAt: 'asc' }, select: { id: true } });
    const m = await scoreMatrix(judgeId);
    expect(m.rows.map((r) => r.teamId)).toEqual(teams.map((t) => t.id));
  });
});

describe('khoá phiếu chấm', () => {
  it('nộp xong là khoá, lưu tiếp bị từ chối và điểm cũ không bị ghi đè', async () => {
    const team = await prisma.team.create({ data: { name: 'ST Locked', code: 'SL' } });

    expect(await isCardLocked(judgeId, team.id)).toBe(false);
    expect(await saveScoreCard(judgeId, team.id, [{ criterionId: critIds[0], value: 5 }], false))
      .toEqual({ ok: true });
    // nháp thì CHƯA khoá
    expect(await isCardLocked(judgeId, team.id)).toBe(false);

    expect(await saveScoreCard(judgeId, team.id, [{ criterionId: critIds[0], value: 7 }], true))
      .toEqual({ ok: true });
    expect(await isCardLocked(judgeId, team.id)).toBe(true);

    expect(await saveScoreCard(judgeId, team.id, [{ criterionId: critIds[0], value: 9 }], true))
      .toEqual({ ok: false, error: 'locked' });
    const after = await prisma.score.findFirst({
      where: { judgeId, teamId: team.id, criterionId: critIds[0] },
    });
    expect(after?.value).toBe(7);

    await prisma.team.delete({ where: { id: team.id } });
  });

  it('mở khoá giữ nguyên điểm và cho nộp lại', async () => {
    const team = await prisma.team.create({ data: { name: 'ST Unlock', code: 'SX' } });
    await saveScoreCard(judgeId, team.id, [{ criterionId: critIds[0], value: 6 }], true);

    expect(await unlockCard(judgeId, team.id)).toBeGreaterThan(0);
    expect(await isCardLocked(judgeId, team.id)).toBe(false);

    const kept = await prisma.score.findFirst({
      where: { judgeId, teamId: team.id, criterionId: critIds[0] },
    });
    expect(kept?.value).toBe(6); // mở khoá KHÔNG xoá điểm

    expect(await saveScoreCard(judgeId, team.id, [{ criterionId: critIds[0], value: 8 }], true))
      .toEqual({ ok: true });

    await prisma.team.delete({ where: { id: team.id } });
  });

  it('khoá là theo từng cặp (giám khảo, đội) — không lan sang đội khác', async () => {
    const a = await prisma.team.create({ data: { name: 'ST Pair A', code: 'PA' } });
    const b = await prisma.team.create({ data: { name: 'ST Pair B', code: 'PB' } });
    await saveScoreCard(judgeId, a.id, [{ criterionId: critIds[0], value: 5 }], true);

    expect(await isCardLocked(judgeId, a.id)).toBe(true);
    expect(await isCardLocked(judgeId, b.id)).toBe(false);
    expect(await saveScoreCard(judgeId, b.id, [{ criterionId: critIds[0], value: 5 }], true))
      .toEqual({ ok: true });

    await prisma.team.deleteMany({ where: { id: { in: [a.id, b.id] } } });
  });

  it('unlockCard trên phiếu chưa nộp thì không đổi gì', async () => {
    const team = await prisma.team.create({ data: { name: 'ST NoLock', code: 'NL' } });
    await saveScoreCard(judgeId, team.id, [{ criterionId: critIds[0], value: 4 }], false);
    expect(await unlockCard(judgeId, team.id)).toBe(0);
    await prisma.team.delete({ where: { id: team.id } });
  });
});
