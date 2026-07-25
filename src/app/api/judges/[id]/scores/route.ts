import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { judgeScoreDetail } from '@/lib/services/scores';

export const dynamic = 'force-dynamic';

// Admin-only: the full scorecard one judge gave, team by team.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const u = await getCurrentUser();
  if (u?.role !== 'admin') return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  return NextResponse.json(await judgeScoreDetail(params.id));
}
