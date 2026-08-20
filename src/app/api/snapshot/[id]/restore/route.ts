import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { audit } from '@/lib/audit';
import { restoreSnapshot } from '@/lib/services/snapshot';

const CONFIRM_PHRASE = 'KHOI PHUC';

/**
 * Khôi phục dữ liệu chuẩn bị về đúng một bản chụp. Chỉ superadmin, và phải gõ
 * đúng câu xác nhận — thao tác này ghi đè dữ liệu đang chạy và không hoàn tác
 * được, giống hệt lập luận ở /api/reset.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const u = await requireRole('superadmin');
  if (!u) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const { confirm } = await req.json().catch(() => ({ confirm: null }));
  if (typeof confirm !== 'string' || confirm.trim().toUpperCase() !== CONFIRM_PHRASE) {
    return NextResponse.json(
      { error: `Chưa xác nhận. Gõ đúng ${CONFIRM_PHRASE} để tiếp tục.` },
      { status: 400 },
    );
  }

  // keepUserId là chốt chống tự khoá mình ra ngoài — xem ghi chú ở restoreSnapshot.
  let counts;
  try {
    counts = await restoreSnapshot(params.id, { keepUserId: u.id });
  } catch {
    return NextResponse.json({ error: 'Không tìm thấy bản chụp' }, { status: 404 });
  }
  await audit(u, 'snapshot.restore', {
    entity: 'snapshot', entityId: params.id,
    detail: `khôi phục ${counts.teamsRestored} đội · ${counts.usersRestored} tài khoản · `
      + `xoá ${counts.teamsDeleted} đội và ${counts.usersDeleted} tài khoản thêm sau`,
  });

  return NextResponse.json({ ok: true, counts });
}

export const dynamic = 'force-dynamic';
