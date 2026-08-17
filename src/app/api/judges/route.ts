import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { audit } from '@/lib/audit';
import { listJudges, createJudge } from '@/lib/services/judges';

export async function GET() {
  const u = await requireRole('admin', 'superadmin');
  if (!u) return NextResponse.json({ error:'forbidden' }, { status:403 });
  return NextResponse.json(await listJudges());
}

export async function POST(req: Request) {
  const u = await requireRole('admin', 'superadmin');
  if (!u) return NextResponse.json({ error:'forbidden' }, { status:403 });
  const body = await req.json();
  if (!body?.name) return NextResponse.json({ error:'name required' }, { status:400 });
  const j = await createJudge(body);
  // KHÔNG ghi mã truy cập vào nhật ký — nếu ghi thì nhật ký thành danh bạ mã.
  await audit(u, 'judge.create', {
    entity:'judge', entityId:j.id, target:j.name, detail:j.isHead ? 'Trưởng BGK' : undefined,
  });
  return NextResponse.json(j, { status:201 });
}

export const dynamic = 'force-dynamic';
