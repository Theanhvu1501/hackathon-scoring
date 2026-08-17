import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { audit } from '@/lib/audit';
import { getJudgeScores, upsertScores, validateScoreValues } from '@/lib/services/scores';
import { broadcast } from '@/lib/events';
import { prisma } from '@/lib/db';

export async function GET(req: Request) {
  const u = await requireRole('judge');
  if (!u) return NextResponse.json({ error:'forbidden' }, { status:403 });
  const teamId = new URL(req.url).searchParams.get('teamId');
  if (!teamId) return NextResponse.json({ error:'teamId required' }, { status:400 });
  return NextResponse.json(await getJudgeScores(u.id, teamId));
}

export async function POST(req: Request) {
  const u = await requireRole('judge');
  if (!u) return NextResponse.json({ error:'forbidden' }, { status:403 });
  const { teamId, values, submitted } = await req.json();
  if (typeof teamId !== 'string' || !teamId || !Array.isArray(values)) {
    return NextResponse.json({ error:'teamId and values required' }, { status:400 });
  }
  const criteria = await prisma.criterion.findMany({ select:{ id:true, maxScore:true } });
  const maxById: Record<string, number> = Object.fromEntries(criteria.map(c => [c.id, c.maxScore]));
  const validationError = validateScoreValues(values, maxById);
  if (validationError) return NextResponse.json({ error: validationError }, { status:400 });

  await upsertScores(u.id, teamId, values, !!submitted);

  const team = await prisma.team.findUnique({ where:{ id:teamId }, select:{ name:true } });
  const total = values.reduce((a: number, v: any) => a + v.value, 0);
  await audit(u, submitted ? 'score.submit' : 'score.save', {
    entity:'score', entityId:`${u.id}:${teamId}`, target:team?.name ?? teamId,
    detail:`tổng ${Math.round(total * 10) / 10}`,
  });
  broadcast('update', { reason:'score', teamId });
  return NextResponse.json({ ok:true });
}
