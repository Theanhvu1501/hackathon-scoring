import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getJudgeScores, upsertScores } from '@/lib/services/scores';
import { broadcast } from '@/lib/events';
export async function GET(req: Request) {
  const u = await getCurrentUser(); if (u?.role !== 'judge') return NextResponse.json({ error:'forbidden' }, { status:403 });
  const teamId = new URL(req.url).searchParams.get('teamId'); if (!teamId) return NextResponse.json({ error:'teamId required' }, { status:400 });
  return NextResponse.json(await getJudgeScores(u.id, teamId));
}
export async function POST(req: Request) {
  const u = await getCurrentUser(); if (u?.role !== 'judge') return NextResponse.json({ error:'forbidden' }, { status:403 });
  const { teamId, values, submitted } = await req.json();
  if (!teamId || !Array.isArray(values)) return NextResponse.json({ error:'teamId and values required' }, { status:400 });
  await upsertScores(u.id, teamId, values, !!submitted);
  broadcast('update', { reason:'score', teamId });
  return NextResponse.json({ ok:true });
}
