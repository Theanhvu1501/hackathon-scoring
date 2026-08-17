import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { listAudit } from '@/lib/services/audit';

export async function GET(req: Request) {
  const u = await requireRole('superadmin');
  if (!u) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const sp = new URL(req.url).searchParams;
  return NextResponse.json(await listAudit({
    page: Number(sp.get('page')) || 1,
    entity: sp.get('entity') || undefined,
    q: sp.get('q') || undefined,
  }));
}

export const dynamic = 'force-dynamic';
