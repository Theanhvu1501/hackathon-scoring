import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getRevealState, setRevealState } from '@/lib/services/reveal';
export async function GET() { return NextResponse.json({ state: await getRevealState() }); }
export async function POST(req: Request) {
  const u = await getCurrentUser(); if (u?.role !== 'admin') return NextResponse.json({ error:'forbidden' }, { status:403 });
  const { state } = await req.json();
  if (!['drafting','provisional','final'].includes(state)) return NextResponse.json({ error:'bad state' }, { status:400 });
  await setRevealState(state, u.id);
  return NextResponse.json({ ok:true, state });
}
