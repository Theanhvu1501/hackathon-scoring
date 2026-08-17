import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { scoreMatrix } from '@/lib/services/scores';

// Mở cho ban giám khảo và ban tổ chức — tên thật ở đây là có chủ ý, việc ẩn tên
// chỉ áp dụng cho board công khai.
export async function GET() {
  const u = await requireRole('judge', 'admin', 'superadmin');
  if (!u) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  return NextResponse.json(await scoreMatrix(u.id));
}

export const dynamic = 'force-dynamic';
