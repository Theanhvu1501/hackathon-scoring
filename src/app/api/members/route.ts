import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { addMember } from '@/lib/services/teams';
export async function POST(req: Request) {
  const u = await getCurrentUser(); if (u?.role !== 'admin') return NextResponse.json({ error:'forbidden' }, { status:403 });
  const body = await req.json();
  if (!body?.teamId || !body?.name) return NextResponse.json({ error:'teamId and name required' }, { status:400 });
  const { teamId, ...data } = body;
  return NextResponse.json(await addMember(teamId, data), { status:201 });
}
