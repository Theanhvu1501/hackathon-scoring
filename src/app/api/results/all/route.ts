import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getResults } from '@/lib/services/reveal';

// Bản đủ đội, CHỈ cho người đã đăng nhập. /api/results (công khai) phải giữ
// nguyên bộ lọc — đó là chốt chặn duy nhất giữ kết quả kín trước giờ công bố.
export async function GET() {
  const u = await getCurrentUser();
  if (!u) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  return NextResponse.json(await getResults({ includeUnrevealed: true }));
}

export const dynamic = 'force-dynamic';
