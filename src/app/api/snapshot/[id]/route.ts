import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { audit } from '@/lib/audit';
import { deleteSnapshot, getSnapshotPayload } from '@/lib/services/snapshot';

/** Tải payload của một bản chụp về máy. Superadmin-only: payload chứa TOÀN BỘ
 *  mã truy cập của ban giám khảo. */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const u = await requireRole('superadmin');
  if (!u) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  try {
    return NextResponse.json(await getSnapshotPayload(params.id));
  } catch {
    return NextResponse.json({ error: 'Không tìm thấy bản chụp' }, { status: 404 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const u = await requireRole('superadmin');
  if (!u) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  await deleteSnapshot(params.id);
  await audit(u, 'snapshot.delete', { entity: 'snapshot', entityId: params.id });
  return NextResponse.json({ ok: true });
}

export const dynamic = 'force-dynamic';
