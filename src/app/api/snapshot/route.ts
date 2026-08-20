import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { audit } from '@/lib/audit';
import { buildPayload, captureSnapshot, listSnapshots } from '@/lib/services/snapshot';

export async function GET() {
  const u = await requireRole('superadmin');
  if (!u) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  return NextResponse.json({ snapshots: await listSnapshots() });
}

export async function POST(req: Request) {
  const u = await requireRole('superadmin');
  if (!u) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const { label } = await req.json().catch(() => ({ label: null }));
  const name = typeof label === 'string' && label.trim() ? label.trim().slice(0, 80) : 'Bản chụp thủ công';

  const snap = await captureSnapshot({ label: name, actorName: u.name });
  await audit(u, 'snapshot.create', {
    entity: 'snapshot', entityId: snap.id, target: name,
    detail: `${snap.teamCount} đội · ${snap.judgeCount} BGK · ${snap.criterionCount} tiêu chí`,
  });

  // Trả kèm payload để trang tải luôn một bản .json về máy: bản chụp nằm cùng
  // database với dữ liệu thật, nên nó cứu được 'ai đó sửa nhầm' chứ không cứu
  // được 'database hỏng'. File trên máy người dùng mới là bản sống sót.
  return NextResponse.json({ snapshot: snap, payload: await buildPayload() }, { status: 201 });
}

export const dynamic = 'force-dynamic';
