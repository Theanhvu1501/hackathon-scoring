import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// KHÔNG phá dữ liệu. Chạy được trên database đang có sự kiện thật, chạy nhiều
// lần vẫn an toàn. Khác hẳn prisma/seed.ts — cái đó XOÁ SẠCH team/member/
// criterion/user/score trước khi tạo lại dữ liệu mẫu.
//
// Dùng khi nâng cấp một bản đang chạy: `npm run accounts`.

const SUPER_CODE = process.env.SUPERADMIN_ACCESS_CODE;
const ADMIN_CODE = process.env.ADMIN_ACCESS_CODE;
const SUPER_NAME = process.env.SUPERADMIN_NAME || 'Super Admin';
const ADMIN_NAME = process.env.ADMIN_NAME || 'Ban tổ chức';

async function ensure(role: 'superadmin' | 'admin', name: string, code: string) {
  const wanted = code.trim().toUpperCase();

  // Mã phải là duy nhất toàn bảng User — nếu một giám khảo đang giữ mã này thì
  // dừng lại, đừng cướp mã của người ta rồi để họ không đăng nhập được.
  const holder = await prisma.user.findUnique({ where: { accessCode: wanted }, select: { id: true, role: true, name: true } });

  const existing = await prisma.user.findFirst({ where: { role }, orderBy: { createdAt: 'asc' } });
  if (holder && holder.id !== existing?.id) {
    throw new Error(
      `Mã ${wanted} đang được tài khoản "${holder.name}" (${holder.role}) dùng. Chọn mã khác cho ${role}.`,
    );
  }

  if (existing) {
    const u = await prisma.user.update({
      where: { id: existing.id },
      data: { accessCode: wanted, active: true },
    });
    console.log(`[cập nhật] ${role}: ${u.name} — mã ${u.accessCode}`);
    return;
  }
  const u = await prisma.user.create({ data: { name, role, accessCode: wanted } });
  console.log(`[tạo mới]  ${role}: ${u.name} — mã ${u.accessCode}`);
}

async function main() {
  if (!SUPER_CODE) throw new Error('Thiếu SUPERADMIN_ACCESS_CODE trong môi trường');
  if (!ADMIN_CODE) throw new Error('Thiếu ADMIN_ACCESS_CODE trong môi trường');
  if (SUPER_CODE.trim().toUpperCase() === ADMIN_CODE.trim().toUpperCase()) {
    throw new Error('SUPERADMIN_ACCESS_CODE và ADMIN_ACCESS_CODE không được giống nhau');
  }
  await ensure('superadmin', SUPER_NAME, SUPER_CODE);
  await ensure('admin', ADMIN_NAME, ADMIN_CODE);
  console.log('\nXong. Dữ liệu đội / thành viên / điểm không bị đụng tới.');
}

main().catch((e) => { console.error('\n' + e.message + '\n'); process.exit(1); }).finally(() => prisma.$disconnect());
