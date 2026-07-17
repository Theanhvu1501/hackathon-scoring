import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { listCriteria, createCriterion } from '@/lib/services/criteria';
export async function GET() { return NextResponse.json(await listCriteria()); }
export async function POST(req: Request) {
  const u = await getCurrentUser(); if (u?.role !== 'admin') return NextResponse.json({ error:'forbidden' }, { status:403 });
  const body = await req.json();
  if (!body?.name || typeof body?.maxScore !== 'number') return NextResponse.json({ error:'name and maxScore required' }, { status:400 });
  return NextResponse.json(await createCriterion(body), { status:201 });
}

export const dynamic = 'force-dynamic';
