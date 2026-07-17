import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { listJudges, createJudge } from '@/lib/services/judges';
export async function GET() {
  const u = await getCurrentUser(); if (u?.role !== 'admin') return NextResponse.json({ error:'forbidden' }, { status:403 });
  return NextResponse.json(await listJudges());
}
export async function POST(req: Request) {
  const u = await getCurrentUser(); if (u?.role !== 'admin') return NextResponse.json({ error:'forbidden' }, { status:403 });
  const body = await req.json();
  if (!body?.name) return NextResponse.json({ error:'name required' }, { status:400 });
  return NextResponse.json(await createJudge(body), { status:201 });
}

export const dynamic = 'force-dynamic';
