import { prisma } from '@/lib/db';
import { uniqueCode } from '@/lib/services/access';

export type AccountRole = 'superadmin' | 'admin';
export type AccountRow = {
  id: string; name: string; role: AccountRole; accessCode: string; active: boolean; createdAt: Date;
};

const SELECT = { id: true, name: true, role: true, accessCode: true, active: true, createdAt: true } as const;

export async function listAccounts(): Promise<AccountRow[]> {
  const rows = await prisma.user.findMany({
    where: { role: { in: ['superadmin', 'admin'] } },
    orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
    select: SELECT,
  });
  return rows as AccountRow[];
}

export async function createAccount(data: { name: string; role: AccountRole }): Promise<AccountRow> {
  const row = await prisma.user.create({
    data: { name: data.name, role: data.role, accessCode: await uniqueCode() },
    select: SELECT,
  });
  return row as AccountRow;
}

export async function updateAccount(
  id: string, data: { name?: string; active?: boolean },
): Promise<AccountRow> {
  const row = await prisma.user.update({ where: { id }, data, select: SELECT });
  return row as AccountRow;
}

export async function deleteAccount(id: string): Promise<void> {
  await prisma.user.delete({ where: { id } });
}

/**
 * Hai chốt an toàn, kiểm ở service chứ không chỉ ở giao diện:
 *  1. không ai tự khoá hay tự xoá chính mình (tự nhốt mình ngoài cửa),
 *  2. luôn còn ít nhất một superadmin đang hoạt động — nếu không thì trang tài
 *     khoản và nhật ký thao tác thành vùng không ai vào được nữa, và chỉ còn
 *     đường sửa trực tiếp trong database.
 * Trả null nếu cho phép, ngược lại trả câu lỗi hiển thị thẳng cho người dùng.
 */
export async function checkAccountMutable(
  id: string,
  actorId: string,
  next: { active?: boolean; deleting?: boolean },
): Promise<string | null> {
  const target = await prisma.user.findUnique({ where: { id }, select: { role: true, active: true } });
  if (!target) return 'Không tìm thấy tài khoản';
  // Chỉ chặn khi tài khoản MẤT quyền truy cập; bật active lại thì luôn cho.
  const losing = next.deleting === true || next.active === false;
  if (!losing) return null;
  if (id === actorId) return 'Không thể xoá hoặc khoá chính tài khoản bạn đang đăng nhập';
  if (target.role === 'superadmin' && target.active) {
    const others = await prisma.user.count({
      where: { role: 'superadmin', active: true, id: { not: id } },
    });
    if (others === 0) return 'Phải còn ít nhất một Super Admin đang hoạt động';
  }
  return null;
}
