import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { audit } from '@/lib/audit';
import { prisma } from '@/lib/db';
import {
  getRevealStatus, revealTeam, unrevealTeam, revealJudgeScores, resetReveal,
} from '@/lib/services/reveal';

export async function GET() { return NextResponse.json(await getRevealStatus()); }

export async function POST(req: Request) {
  const u = await requireRole('admin', 'superadmin');
  if (!u) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const { action, teamId } = await req.json();

  if (action === 'revealTeam' || action === 'unrevealTeam') {
    if (typeof teamId !== 'string' || !teamId) {
      return NextResponse.json({ error: 'teamId required' }, { status: 400 });
    }
    if (action === 'revealTeam') await revealTeam(teamId); else await unrevealTeam(teamId);
    const team = await prisma.team.findUnique({ where: { id: teamId }, select: { name: true } });
    await audit(u, action === 'revealTeam' ? 'reveal.team' : 'reveal.unteam', {
      entity: 'reveal', entityId: teamId, target: team?.name ?? teamId,
    });
    return NextResponse.json({ ok: true, ...(await getRevealStatus()) });
  }
  if (action === 'revealJudges') {
    await revealJudgeScores();
    await audit(u, 'reveal.judges', { entity: 'reveal' });
    return NextResponse.json({ ok: true, ...(await getRevealStatus()) });
  }
  if (action === 'reset') {
    await resetReveal();
    await audit(u, 'reveal.reset', { entity: 'reveal' });
    return NextResponse.json({ ok: true, ...(await getRevealStatus()) });
  }
  return NextResponse.json({ error: 'unknown action' }, { status: 400 });
}

export const dynamic = 'force-dynamic';
