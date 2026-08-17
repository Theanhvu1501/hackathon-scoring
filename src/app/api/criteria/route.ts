import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { audit } from '@/lib/audit';
import { listCriteria, createCriterion } from '@/lib/services/criteria';

export async function GET() { return NextResponse.json(await listCriteria()); }

export async function POST(req: Request) {
  const u = await requireRole('admin', 'superadmin');
  if (!u) return NextResponse.json({ error:'forbidden' }, { status:403 });
  const body = await req.json();
  if (!body?.name || typeof body?.maxScore !== 'number') {
    return NextResponse.json({ error:'name and maxScore required' }, { status:400 });
  }
  const c = await createCriterion(body);
  await audit(u, 'criterion.create', {
    entity:'criterion', entityId:c.id, target:c.name, detail:`maxScore: ${c.maxScore}`,
  });
  return NextResponse.json(c, { status:201 });
}

export const dynamic = 'force-dynamic';
