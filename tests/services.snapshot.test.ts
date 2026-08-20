import { describe, it, expect, afterAll, beforeEach } from 'vitest';
import { prisma, disconnect } from './helpers/db';
import {
  captureSnapshot, listSnapshots, getSnapshotPayload, restoreSnapshot,
} from '@/lib/services/snapshot';

const TEAMS = ['SN Alpha', 'SN Beta', 'SN ThemSau'];
const CODES = ['ZS01-ZS01', 'ZS02-ZS02', 'ZS03-ZS03'];
const ORDERS = [300, 301];

async function cleanFixtures() {
  await prisma.snapshot.deleteMany({ where: { label: { startsWith: 'SN ' } } });
  await prisma.user.deleteMany({ where: { accessCode: { in: CODES } } });
  await prisma.team.deleteMany({ where: { name: { in: TEAMS } } });
  await prisma.criterion.deleteMany({ where: { order: { in: ORDERS } } });
}

afterAll(async () => { await cleanFixtures(); await disconnect(); });

let teamA: string, teamB: string, judgeA: string, critA: string, actorId: string;

beforeEach(async () => {
  await cleanFixtures();
  const actor = await prisma.user.create({
    data: { name: 'SN Super', role: 'superadmin', accessCode: CODES[2] },
  });
  const ja = await prisma.user.create({ data: { name: 'SN Judge', role: 'judge', accessCode: CODES[0] } });
  const ta = await prisma.team.create({
    data: { name: TEAMS[0], code: 'SA', tag: 'tag gốc', members: { create: [{ name: 'SN Mem' }] } },
  });
  const tb = await prisma.team.create({ data: { name: TEAMS[1], code: 'SB' } });
  const ca = await prisma.criterion.create({ data: { name: 'SN crit', maxScore: 10, order: ORDERS[0] } });
  actorId = actor.id; judgeA = ja.id; teamA = ta.id; teamB = tb.id; critA = ca.id;
});

async function capture() {
  return captureSnapshot({ label: 'SN ban dau', actorName: 'SN Super' });
}

describe('captureSnapshot', () => {
  it('chụp lại đội, thành viên, giám khảo và tiêu chí đang có', async () => {
    const snap = await capture();
    const p = await getSnapshotPayload(snap.id);
    expect(p.teams.map((t) => t.name)).toEqual(expect.arrayContaining([TEAMS[0], TEAMS[1]]));
    expect(p.members.some((m) => m.name === 'SN Mem')).toBe(true);
    expect(p.users.some((u) => u.accessCode === CODES[0])).toBe(true);
    expect(p.criteria.some((c) => c.id === critA)).toBe(true);
  });

  it('KHÔNG chụp điểm — bản chụp là dữ liệu chuẩn bị, không phải kết quả thi', async () => {
    const p = await getSnapshotPayload((await capture()).id);
    expect(p).not.toHaveProperty('scores');
  });

  it('liệt kê bản mới nhất lên đầu', async () => {
    await captureSnapshot({ label: 'SN cu', actorName: 'x' });
    await captureSnapshot({ label: 'SN moi', actorName: 'x' });
    const list = await listSnapshots();
    expect(list[0].label).toBe('SN moi');
  });
});

describe('restoreSnapshot', () => {
  it('trả tên đội bị sửa nhầm về như cũ', async () => {
    const snap = await capture();
    await prisma.team.update({ where: { id: teamA }, data: { name: 'SN Bi Sua Nham', tag: 'tag sai' } });

    await restoreSnapshot(snap.id, { keepUserId: actorId });

    const t = await prisma.team.findUnique({ where: { id: teamA } });
    expect(t?.name).toBe(TEAMS[0]);
    expect(t?.tag).toBe('tag gốc');
  });

  it('tạo lại đội bị xoá với ĐÚNG id cũ', async () => {
    const snap = await capture();
    await prisma.team.delete({ where: { id: teamB } });

    await restoreSnapshot(snap.id, { keepUserId: actorId });

    const t = await prisma.team.findUnique({ where: { id: teamB } });
    expect(t?.name).toBe(TEAMS[1]);
  });

  it('tạo lại thành viên bị xoá', async () => {
    const snap = await capture();
    await prisma.member.deleteMany({ where: { teamId: teamA } });

    await restoreSnapshot(snap.id, { keepUserId: actorId });

    expect(await prisma.member.count({ where: { teamId: teamA } })).toBe(1);
  });

  it('trả barem bị sửa về như cũ', async () => {
    const snap = await capture();
    await prisma.criterion.update({ where: { id: critA }, data: { maxScore: 99 } });

    await restoreSnapshot(snap.id, { keepUserId: actorId });

    expect((await prisma.criterion.findUnique({ where: { id: critA } }))?.maxScore).toBe(10);
  });

  it('trả mã truy cập giám khảo bị đổi về như cũ', async () => {
    const snap = await capture();
    await prisma.user.update({ where: { id: judgeA }, data: { accessCode: 'ZZ-DOI-NHAM' } });

    await restoreSnapshot(snap.id, { keepUserId: actorId });

    expect((await prisma.user.findUnique({ where: { id: judgeA } }))?.accessCode).toBe(CODES[0]);
  });

  /**
   * Điểm đã chấm KHÔNG được đụng tới. Khôi phục theo id chính là để có tính chất
   * này: đội không bị xoá đi tạo lại nên Score cascade không kích hoạt. Đây là
   * điều kiện để dám bấm khôi phục giữa lúc ban giám khảo đang chấm.
   */
  it('giữ nguyên điểm của đội có trong bản chụp', async () => {
    const snap = await capture();
    await prisma.score.create({
      data: { judgeId: judgeA, teamId: teamA, criterionId: critA, value: 9, submitted: true },
    });
    await prisma.team.update({ where: { id: teamA }, data: { name: 'SN Bi Sua Nham' } });

    await restoreSnapshot(snap.id, { keepUserId: actorId });

    const s = await prisma.score.findFirst({ where: { teamId: teamA, judgeId: judgeA } });
    expect(s?.value).toBe(9);
    expect(s?.submitted).toBe(true);
  });

  it('xoá đội được thêm SAU lúc chụp', async () => {
    const snap = await capture();
    const them = await prisma.team.create({ data: { name: TEAMS[2], code: 'ST' } });

    await restoreSnapshot(snap.id, { keepUserId: actorId });

    expect(await prisma.team.findUnique({ where: { id: them.id } })).toBeNull();
  });

  /**
   * Chặn đúng một cách tự khoá mình ra ngoài: tài khoản superadmin tạo sau lúc
   * chụp mà bị xoá khi khôi phục thì người đang bấm nút mất quyền ngay giữa sự
   * kiện, và không còn tài khoản nào để vào sửa.
   */
  it('KHÔNG BAO GIỜ xoá tài khoản đang thực hiện khôi phục', async () => {
    const them = await prisma.user.create({
      data: { name: 'SN Super Moi', role: 'superadmin', accessCode: CODES[1] },
    });
    const snap = await capture();   // chụp khi đã có `them`
    // Rồi chụp lại một bản KHÔNG có `them` bằng cách xoá trước khi chụp
    await prisma.user.delete({ where: { id: them.id } });
    const snapKhongCo = await capture();
    const themLai = await prisma.user.create({
      data: { name: 'SN Super Moi', role: 'superadmin', accessCode: CODES[1] },
    });

    await restoreSnapshot(snapKhongCo.id, { keepUserId: themLai.id });

    expect(await prisma.user.findUnique({ where: { id: themLai.id } })).not.toBeNull();
    expect(snap.id).toBeTruthy();
  });

  it('trả về số liệu thay đổi để ghi nhật ký', async () => {
    const snap = await capture();
    await prisma.team.update({ where: { id: teamA }, data: { name: 'SN Bi Sua Nham' } });
    const them = await prisma.team.create({ data: { name: TEAMS[2], code: 'ST' } });

    const r = await restoreSnapshot(snap.id, { keepUserId: actorId });

    // teamsRestored đo theo bản chụp (database dev còn dữ liệu demo), còn
    // teamsDeleted phải đúng bằng 1 — đội duy nhất được thêm sau lúc chụp.
    expect(r.teamsRestored).toBe(snap.teamCount);
    expect(r.teamsDeleted).toBe(1);
    expect(await prisma.team.findUnique({ where: { id: them.id } })).toBeNull();
  });
});
