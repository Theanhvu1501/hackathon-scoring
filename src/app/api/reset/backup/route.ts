import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { exportScores } from '@/lib/services/reset';

/**
 * Bản sao lưu điểm để tải về TRƯỚC khi xoá. Superadmin-only vì đây là toàn bộ
 * điểm chưa công bố của mọi đội — endpoint này rò ra là lộ kết quả trước giờ G,
 * đúng mối lo đã ghi ở getResults() trong services/reveal.ts.
 */
export async function GET() {
  const u = await requireRole('superadmin');
  if (!u) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  return NextResponse.json(await exportScores());
}

export const dynamic = 'force-dynamic';
