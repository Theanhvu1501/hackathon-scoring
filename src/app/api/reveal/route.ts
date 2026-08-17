import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import {
  getRevealStatus, revealTeam, unrevealTeam, revealJudgeScores, resetReveal,
} from '@/lib/services/reveal';

export async function GET() { return NextResponse.json(await getRevealStatus()); }

export async function POST(req: Request) {
  const u = await getCurrentUser();
  if (u?.role !== 'admin') return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const { action, teamId } = await req.json();

  if (action === 'revealTeam' || action === 'unrevealTeam') {
    if (typeof teamId !== 'string' || !teamId) {
      return NextResponse.json({ error: 'teamId required' }, { status: 400 });
    }
    if (action === 'revealTeam') await revealTeam(teamId); else await unrevealTeam(teamId);
    return NextResponse.json({ ok: true, ...(await getRevealStatus()) });
  }
  if (action === 'revealJudges') {
    await revealJudgeScores();
    return NextResponse.json({ ok: true, ...(await getRevealStatus()) });
  }
  if (action === 'reset') {
    await resetReveal();
    return NextResponse.json({ ok: true, ...(await getRevealStatus()) });
  }
  return NextResponse.json({ error: 'unknown action' }, { status: 400 });
}

export const dynamic = 'force-dynamic';
