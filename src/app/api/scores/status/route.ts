import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { judgeSubmittedTeamIds } from '@/lib/services/scores';

export const dynamic = 'force-dynamic';

export async function GET() {
  const u = await getCurrentUser();
  if (u?.role !== 'judge') return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  return NextResponse.json({ submittedTeamIds: await judgeSubmittedTeamIds(u.id) });
}
