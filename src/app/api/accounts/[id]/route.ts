import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { audit } from '@/lib/audit';
import { prisma } from '@/lib/db';
import { checkAccountMutable, deleteAccount, updateAccount } from '@/lib/services/accounts';
import { setUserAccessCode, regenerateUserCode } from '@/lib/services/access';

function accountName(id: string) {
  return prisma.user.findUnique({ where: { id }, select: { name: true } });
}

// Vai trò cố ý KHÔNG sửa được ở đây: hạ một superadmin xuống admin là đường ngắn
// nhất tới trạng thái không còn superadmin nào, mà checkAccountMutable chỉ canh
// nhánh xoá/khoá. Muốn đổi vai trò thì xoá rồi tạo lại.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const u = await requireRole('superadmin');
  if (!u) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const { name, active, accessCode } = await req.json();

  if (active === true || active === false) {
    const blocked = await checkAccountMutable(params.id, u.id, { active });
    if (blocked) return NextResponse.json({ error: blocked }, { status: 400 });
    const a = await updateAccount(params.id, { active });
    await audit(u, 'account.update', {
      entity: 'account', entityId: a.id, target: a.name, detail: active ? 'mở khoá' : 'khoá',
    });
  }
  if (typeof accessCode === 'string' && accessCode.trim()) {
    const r = await setUserAccessCode(params.id, accessCode);
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
    const a = await accountName(params.id);
    // KHÔNG ghi mã mới vào detail — nhật ký không được thành danh bạ mã truy cập.
    await audit(u, 'account.set_code', { entity: 'account', entityId: params.id, target: a?.name ?? params.id });
  }
  if (typeof name === 'string' && name.trim()) {
    const a = await updateAccount(params.id, { name: name.trim() });
    await audit(u, 'account.update', { entity: 'account', entityId: a.id, target: a.name, detail: 'đổi tên' });
  }
  return NextResponse.json({ ok: true });
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const u = await requireRole('superadmin');
  if (!u) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const { action } = await req.json();
  if (action !== 'regen') return NextResponse.json({ error: 'unknown action' }, { status: 400 });
  await regenerateUserCode(params.id);
  const a = await accountName(params.id);
  await audit(u, 'account.regen_code', { entity: 'account', entityId: params.id, target: a?.name ?? params.id });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const u = await requireRole('superadmin');
  if (!u) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const blocked = await checkAccountMutable(params.id, u.id, { deleting: true });
  if (blocked) return NextResponse.json({ error: blocked }, { status: 400 });
  const before = await accountName(params.id);
  await deleteAccount(params.id);
  await audit(u, 'account.delete', { entity: 'account', entityId: params.id, target: before?.name ?? params.id });
  return NextResponse.json({ ok: true });
}
