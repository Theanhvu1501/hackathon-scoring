import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { audit } from '@/lib/audit';
import { listAccounts, createAccount } from '@/lib/services/accounts';

export async function GET() {
  const u = await requireRole('superadmin');
  if (!u) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  return NextResponse.json(await listAccounts());
}

export async function POST(req: Request) {
  const u = await requireRole('superadmin');
  if (!u) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const { name, role } = await req.json();
  if (typeof name !== 'string' || !name.trim()) {
    return NextResponse.json({ error: 'Tên tài khoản không được để trống' }, { status: 400 });
  }
  if (role !== 'admin' && role !== 'superadmin') {
    return NextResponse.json({ error: 'Vai trò không hợp lệ' }, { status: 400 });
  }
  const acc = await createAccount({ name: name.trim(), role });
  await audit(u, 'account.create', {
    entity: 'account', entityId: acc.id, target: acc.name, detail: acc.role,
  });
  return NextResponse.json(acc, { status: 201 });
}

export const dynamic = 'force-dynamic';
