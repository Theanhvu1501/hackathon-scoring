import { describe, it, expect, afterAll } from 'vitest';
import { prisma, disconnect } from './helpers/db';
import {
  checkAccountMutable, createAccount, deleteAccount, listAccounts, updateAccount,
} from '@/lib/services/accounts';

afterAll(disconnect);

describe('accounts service', () => {
  it('createAccount sinh mã tự động và đúng role', async () => {
    const a = await createAccount({ name: 'Khách hàng', role: 'admin' });
    expect(a.role).toBe('admin');
    expect(a.accessCode).toMatch(/^[A-Z0-9-]{4,32}$/);
    expect(a.active).toBe(true);
    expect((await listAccounts()).some((x) => x.id === a.id)).toBe(true);
    await deleteAccount(a.id);
  });

  it('listAccounts không trả tài khoản giám khảo', async () => {
    const rows = await listAccounts();
    expect(rows.every((r) => r.role === 'admin' || r.role === 'superadmin')).toBe(true);
  });

  it('không cho tự xoá hoặc tự khoá chính mình', async () => {
    const a = await createAccount({ name: 'Tự xoá', role: 'admin' });
    expect(await checkAccountMutable(a.id, a.id, { deleting: true })).toMatch(/chính tài khoản/);
    expect(await checkAccountMutable(a.id, a.id, { active: false })).toMatch(/chính tài khoản/);
    // người khác thao tác thì được
    expect(await checkAccountMutable(a.id, 'nguoi-khac', { deleting: true })).toBeNull();
    await deleteAccount(a.id);
  });

  it('không cho xoá hay khoá superadmin active cuối cùng', async () => {
    // Để dựng ca "người cuối cùng" thì không được còn superadmin active nào khác.
    // TẠM tắt active của các superadmin đang có rồi bật lại ở cuối — xoá sạch
    // họ sẽ làm database dev không còn ai đăng nhập được vào trang tài khoản.
    const existing = await prisma.user.findMany({
      where: { role: 'superadmin', active: true }, select: { id: true },
    });
    await prisma.user.updateMany({
      where: { id: { in: existing.map((e) => e.id) } }, data: { active: false },
    });

    const s = await createAccount({ name: 'Super duy nhất', role: 'superadmin' });

    expect(await checkAccountMutable(s.id, 'nguoi-khac', { deleting: true })).toMatch(/ít nhất một Super Admin/);
    expect(await checkAccountMutable(s.id, 'nguoi-khac', { active: false })).toMatch(/ít nhất một Super Admin/);
    // bật active thì không bị chặn
    expect(await checkAccountMutable(s.id, 'nguoi-khac', { active: true })).toBeNull();

    const s2 = await createAccount({ name: 'Super thứ hai', role: 'superadmin' });
    expect(await checkAccountMutable(s.id, 'nguoi-khac', { deleting: true })).toBeNull();

    // superadmin thứ hai bị khoá thì lại chỉ còn một người active
    await updateAccount(s2.id, { active: false });
    expect(await checkAccountMutable(s.id, 'nguoi-khac', { deleting: true })).toMatch(/ít nhất một Super Admin/);

    await prisma.user.deleteMany({ where: { id: { in: [s.id, s2.id] } } });
    // trả lại trạng thái như lúc vào
    await prisma.user.updateMany({
      where: { id: { in: existing.map((e) => e.id) } }, data: { active: true },
    });
  });

  it('checkAccountMutable báo lỗi khi không tìm thấy tài khoản', async () => {
    expect(await checkAccountMutable('khong-ton-tai', 'ai-do', { deleting: true }))
      .toMatch(/Không tìm thấy/);
  });
});
