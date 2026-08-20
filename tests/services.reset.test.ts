import { describe, it, expect, afterAll, beforeEach } from 'vitest';
import { prisma, disconnect } from './helpers/db';
import { resetPreview, exportScores, resetScores, ResetPreview } from '@/lib/services/reset';

// Fixture cố định tên/mã nên phải tự dọn trước mỗi lần tạo — xem ghi chú cùng
// kiểu ở tests/services.scores.test.ts.
const TEAMS = ['RS Alpha', 'RS Beta'];
const CODES = ['ZR01-ZR01', 'ZR02-ZR02'];
async function cleanFixtures() {
  await prisma.user.deleteMany({ where: { accessCode: { in: CODES } } });
  await prisma.team.deleteMany({ where: { name: { in: TEAMS } } });
  await prisma.criterion.deleteMany({ where: { order: { in: [200, 201] } } });
}

afterAll(async () => { await cleanFixtures(); await disconnect(); });

type Fixture = {
  judgeA: string; judgeB: string; teamA: string; teamB: string; crit: string[];
};
let fx: Fixture;
// Database dev có sẵn dữ liệu demo từ seed, nên đội/BGK/tiêu chí phải đo bằng
// ĐỘ LỆCH so với mốc này. Điểm và nhận xét thì khác — beforeEach xoá sạch chúng
// nên đếm tuyệt đối được, và đó cũng đúng là tiền đề mà resetScores() cần.
let base: ResetPreview;

/**
 * Dựng lại từ đầu trước MỖI test: resetScores() xoá sạch điểm toàn database nên
 * fixture dùng chung giữa các test sẽ bốc hơi ngay sau test reset đầu tiên.
 */
beforeEach(async () => {
  await cleanFixtures();
  await prisma.scoreComment.deleteMany();
  await prisma.score.deleteMany();
  await prisma.team.updateMany({ where: { revealedAt: { not: null } }, data: { revealedAt: null } });
  base = await resetPreview();
  const ja = await prisma.user.create({ data: { name: 'RS Judge A', role: 'judge', isHead: true, accessCode: CODES[0] } });
  const jb = await prisma.user.create({ data: { name: 'RS Judge B', role: 'judge', accessCode: CODES[1] } });
  const ta = await prisma.team.create({
    data: { name: TEAMS[0], code: 'RA', revealedAt: new Date(), members: { create: [{ name: 'RS Mem 1' }, { name: 'RS Mem 2' }] } },
  });
  const tb = await prisma.team.create({ data: { name: TEAMS[1], code: 'RB' } });
  const c1 = await prisma.criterion.create({ data: { name: 'RS c1', maxScore: 10, order: 200 } });
  const c2 = await prisma.criterion.create({ data: { name: 'RS c2', maxScore: 15, order: 201 } });
  fx = { judgeA: ja.id, judgeB: jb.id, teamA: ta.id, teamB: tb.id, crit: [c1.id, c2.id] };

  // Judge A: phiếu ĐÃ NỘP cho team A, kèm nhận xét. Judge B: nháp cho team A.
  await prisma.score.createMany({
    data: [
      { judgeId: ja.id, teamId: ta.id, criterionId: c1.id, value: 8, submitted: true },
      { judgeId: ja.id, teamId: ta.id, criterionId: c2.id, value: 12, submitted: true },
      { judgeId: jb.id, teamId: ta.id, criterionId: c1.id, value: 7, submitted: false },
    ],
  });
  await prisma.scoreComment.create({ data: { judgeId: ja.id, teamId: ta.id, text: 'Sản phẩm chạy tốt.' } });
});

describe('resetPreview', () => {
  it('đếm đúng thứ sắp bị xoá', async () => {
    const p = await resetPreview();
    expect(p.scoreCount).toBe(3);
    expect(p.commentCount).toBe(1);
    expect(p.revealedTeams).toBe(1);
  });

  it('đếm phiếu chấm theo cặp BGK×đội, tách phiếu đã nộp khỏi nháp', async () => {
    const p = await resetPreview();
    expect(p.cardCount).toBe(2);        // A×teamA và B×teamA
    expect(p.submittedCards).toBe(1);   // chỉ A×teamA đã nộp
  });

  it('trả cả thứ được GIỮ để dựng checklist sẵn sàng', async () => {
    const p = await resetPreview();
    expect(p.teamCount).toBe(base.teamCount + 2);
    expect(p.memberCount).toBe(base.memberCount + 2);
    expect(p.judgeCount).toBe(base.judgeCount + 2);
    expect(p.activeJudgeCount).toBe(base.activeJudgeCount + 2);
    expect(p.criterionCount).toBe(base.criterionCount + 2);
    expect(p.baremTotal).toBe(base.baremTotal + 25);   // 10 + 15
  });
});

describe('exportScores', () => {
  it('xuất điểm kèm tên đọc được, không chỉ id', async () => {
    const b = await exportScores();
    expect(b.scores).toHaveLength(3);
    const row = b.scores.find((s) => s.judgeName === 'RS Judge A' && s.criterionName === 'RS c1');
    expect(row).toMatchObject({ teamName: 'RS Alpha', value: 8, submitted: true });
  });

  it('xuất luôn nhận xét của giám khảo', async () => {
    const b = await exportScores();
    expect(b.comments).toContainEqual(
      expect.objectContaining({ judgeName: 'RS Judge A', teamName: 'RS Alpha', text: 'Sản phẩm chạy tốt.' }),
    );
  });
});

describe('resetScores', () => {
  it('xoá sạch điểm và nhận xét', async () => {
    await resetScores();
    expect(await prisma.score.count()).toBe(0);
    expect(await prisma.scoreComment.count()).toBe(0);
  });

  it('đưa mọi đội về chưa công bố', async () => {
    await resetScores();
    expect(await prisma.team.count({ where: { revealedAt: { not: null } } })).toBe(0);
  });

  /**
   * Test quan trọng nhất trong file. Nó chặn đúng một kiểu hồi quy: ai đó sửa
   * reset thành gọi seed, và ban tổ chức mất sạch đội với BGK ngay trước sự kiện.
   */
  it('GIỮ NGUYÊN đội, thành viên, giám khảo và tiêu chí', async () => {
    await resetScores();
    const after = await resetPreview();
    expect(after.teamCount).toBe(base.teamCount + 2);
    expect(after.judgeCount).toBe(base.judgeCount + 2);
    expect(after.criterionCount).toBe(base.criterionCount + 2);
    // Fixture cụ thể, để lỗi chỉ đúng ở đội/BGK khác cũng không lọt qua
    expect(await prisma.team.count({ where: { name: { in: TEAMS } } })).toBe(2);
    expect(await prisma.member.count({ where: { teamId: fx.teamA } })).toBe(2);
    expect(await prisma.user.count({ where: { accessCode: { in: CODES } } })).toBe(2);
    expect(await prisma.criterion.count({ where: { order: { in: [200, 201] } } })).toBe(2);
  });

  it('giữ nguyên mã truy cập để BGK đăng nhập lại bằng mã cũ', async () => {
    await resetScores();
    const j = await prisma.user.findUnique({ where: { id: fx.judgeA } });
    expect(j?.accessCode).toBe(CODES[0]);
  });

  it('trả về số dòng đã xoá để ghi vào nhật ký', async () => {
    const r = await resetScores();
    expect(r).toEqual({ scores: 3, comments: 1, unrevealed: 1 });
  });

  it('chạy trên database đã sạch thì không lỗi và trả 0', async () => {
    await resetScores();
    expect(await resetScores()).toEqual({ scores: 0, comments: 0, unrevealed: 0 });
  });
});
