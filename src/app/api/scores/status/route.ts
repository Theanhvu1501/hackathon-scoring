import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { judgeSubmittedTeamIds } from '@/lib/services/scores';

export const dynamic = 'force-dynamic';

export async function GET() {
  const u = await requireRole('judge');
  if (!u) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  return NextResponse.json({ submittedTeamIds: await judgeSubmittedTeamIds(u.id) });
}
