import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { broadcast } from '@/lib/events';

/**
 * Ảnh chụp DỮ LIỆU CHUẨN BỊ và khôi phục lại nó.
 *
 * Ranh giới với services/reset.ts: file này lo phần ban tổ chức nhập tay trước
 * sự kiện (đội, thành viên, ban giám khảo, tiêu chí, banner); reset.ts lo phần
 * thi đấu (điểm, nhận xét, trạng thái công bố). Hai vòng đời tách biệt, và giữ
 * chúng tách biệt chính là điều cho phép khôi phục danh sách đội ngay giữa lúc
 * ban giám khảo đang chấm mà không đụng một điểm nào.
 */

export type SnapTeam = {
  id: string; name: string; code: string; logoUrl: string | null; tag: string | null;
};
export type SnapMember = {
  id: string; teamId: string; name: string; teamRole: string | null;
  photoUrl: string | null; org: string | null; email: string | null;
  phone: string | null; intro: string | null;
};
export type SnapUser = {
  id: string; name: string; role: 'superadmin' | 'admin' | 'judge';
  accessCode: string; active: boolean;
};
export type SnapCriterion = {
  id: string; name: string; description: string | null; maxScore: number; order: number;
};
export type SnapshotPayload = {
  version: 1;
  teams: SnapTeam[];
  members: SnapMember[];
  users: SnapUser[];
  criteria: SnapCriterion[];
  bannerImageUrl: string | null;
};

export type SnapshotInfo = {
  id: string; label: string; actorName: string | null; createdAt: Date;
  teamCount: number; memberCount: number; judgeCount: number; criterionCount: number;
};

/** Bản chụp là JSON tự do trong DB — schema có thể đã đổi từ lúc chụp tới lúc
 *  khôi phục, nên đọc ra phải lọc về đúng các cột hiện tại. */
function pickUser(u: SnapUser): SnapUser {
  return {
    id: u.id, name: u.name, role: u.role, accessCode: u.accessCode,
    active: u.active ?? true,
  };
}

function summarize(p: SnapshotPayload) {
  return {
    teamCount: p.teams.length,
    memberCount: p.members.length,
    judgeCount: p.users.filter((u) => u.role === 'judge').length,
    criterionCount: p.criteria.length,
  };
}

export async function buildPayload(): Promise<SnapshotPayload> {
  const [teams, members, users, criteria, settings] = await Promise.all([
    prisma.team.findMany({ select: { id: true, name: true, code: true, logoUrl: true, tag: true } }),
    prisma.member.findMany(),
    prisma.user.findMany({
      select: { id: true, name: true, role: true, accessCode: true, active: true },
    }),
    prisma.criterion.findMany({
      select: { id: true, name: true, description: true, maxScore: true, order: true },
    }),
    prisma.settings.findUnique({ where: { id: 1 }, select: { bannerImageUrl: true } }),
  ]);
  return {
    version: 1,
    teams,
    members: members.map(({ id, teamId, name, teamRole, photoUrl, org, email, phone, intro }) =>
      ({ id, teamId, name, teamRole, photoUrl, org, email, phone, intro })),
    users,
    criteria,
    bannerImageUrl: settings?.bannerImageUrl ?? null,
  };
}

export async function captureSnapshot(opts: { label: string; actorName?: string | null }) {
  const payload = await buildPayload();
  const row = await prisma.snapshot.create({
    data: {
      label: opts.label,
      actorName: opts.actorName ?? null,
      payload: payload as unknown as Prisma.InputJsonValue,
    },
    select: { id: true, label: true, actorName: true, createdAt: true },
  });
  return { ...row, ...summarize(payload) };
}

export async function listSnapshots(): Promise<SnapshotInfo[]> {
  const rows = await prisma.snapshot.findMany({ orderBy: { createdAt: 'desc' }, take: 20 });
  return rows.map((r) => ({
    id: r.id, label: r.label, actorName: r.actorName, createdAt: r.createdAt,
    ...summarize(r.payload as unknown as SnapshotPayload),
  }));
}

export async function getSnapshotPayload(id: string): Promise<SnapshotPayload> {
  const row = await prisma.snapshot.findUnique({ where: { id } });
  if (!row) throw new Error('Không tìm thấy bản chụp');
  return row.payload as unknown as SnapshotPayload;
}

export async function deleteSnapshot(id: string) {
  await prisma.snapshot.delete({ where: { id } });
}

export type RestoreCounts = {
  teamsRestored: number; teamsDeleted: number;
  membersRestored: number; membersDeleted: number;
  usersRestored: number; usersDeleted: number;
  criteriaRestored: number; criteriaDeleted: number;
};

/**
 * Khôi phục THEO ID, không xoá-rồi-tạo-lại.
 *
 * Đây là quyết định thiết kế quan trọng nhất của module. Score và ScoreComment
 * đều `onDelete: Cascade` theo teamId và judgeId, nên nếu khôi phục bằng cách
 * xoá sạch đội rồi dựng lại thì toàn bộ điểm ban giám khảo đã chấm sẽ bay theo,
 * kể cả với những đội không hề bị sửa gì. Giữ nguyên id nghĩa là cascade không
 * bao giờ kích hoạt cho phần dữ liệu có trong bản chụp.
 */
export async function restoreSnapshot(
  id: string,
  opts: { keepUserId: string },
): Promise<RestoreCounts> {
  const p = await getSnapshotPayload(id);

  const teamIds = p.teams.map((t) => t.id);
  const memberIds = p.members.map((m) => m.id);
  const userIds = p.users.map((u) => u.id);
  const critIds = p.criteria.map((c) => c.id);

  const ops: Prisma.PrismaPromise<unknown>[] = [];

  // Có thì sửa về giá trị cũ, mất thì dựng lại ĐÚNG id cũ.
  for (const t of p.teams) {
    ops.push(prisma.team.upsert({ where: { id: t.id }, update: t, create: t }));
  }
  for (const c of p.criteria) {
    ops.push(prisma.criterion.upsert({ where: { id: c.id }, update: c, create: c }));
  }
  for (const u of p.users) {
    // Chỉ lấy đúng các cột hiện có: bản chụp cũ còn mang theo `isHead` (cột đã
    // bị xoá), ném nguyên vào upsert là Prisma báo lỗi và cả lần khôi phục hỏng.
    const row = pickUser(u);
    ops.push(prisma.user.upsert({ where: { id: row.id }, update: row, create: row }));
  }
  // Thành viên dựng SAU đội: create cần teamId đã tồn tại.
  for (const m of p.members) {
    ops.push(prisma.member.upsert({ where: { id: m.id }, update: m, create: m }));
  }

  // Xoá phần được thêm sau lúc chụp, để database về đúng y nguyên bản chụp.
  //
  // `keepUserId` là chốt an toàn không được bỏ: tài khoản đang bấm nút mà bị xoá
  // ở đây thì người vận hành mất quyền ngay lập tức, giữa sự kiện, và không còn
  // tài khoản nào để vào sửa. Thà thừa một tài khoản còn hơn khoá mình ra ngoài.
  ops.push(prisma.member.deleteMany({ where: { id: { notIn: memberIds } } }));
  ops.push(prisma.team.deleteMany({ where: { id: { notIn: teamIds } } }));
  ops.push(prisma.criterion.deleteMany({ where: { id: { notIn: critIds } } }));
  ops.push(prisma.user.deleteMany({
    where: { id: { notIn: [...userIds, opts.keepUserId] } },
  }));

  ops.push(prisma.settings.upsert({
    where: { id: 1 },
    update: { bannerImageUrl: p.bannerImageUrl },
    create: { id: 1, bannerImageUrl: p.bannerImageUrl },
  }));

  const results = await prisma.$transaction(ops);

  // Vị trí của 4 deleteMany trong mảng ops, theo đúng thứ tự push ở trên.
  const base = p.teams.length + p.criteria.length + p.users.length + p.members.length;
  const del = (i: number) => (results[base + i] as { count: number }).count;

  broadcast('update', { reason: 'restore' });

  return {
    teamsRestored: p.teams.length, teamsDeleted: del(1),
    membersRestored: p.members.length, membersDeleted: del(0),
    usersRestored: p.users.length, usersDeleted: del(3),
    criteriaRestored: p.criteria.length, criteriaDeleted: del(2),
  };
}
