import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { audit } from '@/lib/audit';
import { resetPreview, resetScores } from '@/lib/services/reset';

/** Người bấm phải gõ đúng chuỗi này — xem ghi chú ở POST. */
const CONFIRM_PHRASE = 'RESET';

export async function GET() {
  const u = await requireRole('superadmin');
  if (!u) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  return NextResponse.json(await resetPreview());
}

/**
 * Chỉ superadmin. Gate nằm ở ĐÂY chứ không chỉ ở chỗ ẩn mục menu: giấu link mà
 * API vẫn nhận thì bất kỳ ai đăng nhập được cũng xoá sạch điểm bằng một lệnh
 * curl. Cùng lập luận với chốt khoá phiếu trong services/scores.ts.
 *
 * Đòi gõ đúng chữ RESET là ma sát CỐ Ý. Thao tác này không hoàn tác được và trang
 * này sẽ được mở ngay giữa lúc chạy sự kiện — một cú bấm nhầm là mất toàn bộ
 * điểm ban giám khảo đã chấm.
 */
export async function POST(req: Request) {
  const u = await requireRole('superadmin');
  if (!u) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const { confirm } = await req.json().catch(() => ({ confirm: null }));
  if (confirm !== CONFIRM_PHRASE) {
    return NextResponse.json(
      { error: `Chưa xác nhận. Gõ đúng ${CONFIRM_PHRASE} để tiếp tục.` },
      { status: 400 },
    );
  }

  const counts = await resetScores();
  await audit(u, 'event.reset', {
    entity: 'event',
    detail: `xoá ${counts.scores} điểm · ${counts.comments} nhận xét · thu hồi ${counts.unrevealed} đội`,
  });

  // Trả luôn trạng thái sau reset để trang dựng checklist mà không phải gọi lại.
  return NextResponse.json({ ok: true, counts, preview: await resetPreview() });
}

export const dynamic = 'force-dynamic';
