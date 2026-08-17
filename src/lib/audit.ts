import { prisma } from '@/lib/db';

export type AuditActor = { id: string; name: string; role: string } | null;

/**
 * Ghi một dòng nhật ký. Cố ý KHÔNG bao giờ throw: audit là dữ liệu phụ trợ, còn
 * thao tác đang chạy (tạo đội, nộp điểm, công bố) mới là việc chính — để một lỗi
 * ghi log làm hỏng thao tác chính là đánh đổi sai.
 *
 * actorName/actorRole là snapshot có chủ ý: xoá một giám khảo không được làm mất
 * dấu vết những gì người đó đã làm.
 */
export async function audit(
  actor: AuditActor,
  action: string,
  opts: { entity?: string; entityId?: string; target?: string; detail?: string } = {},
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: actor?.id ?? null,
        actorName: actor?.name ?? null,
        actorRole: actor?.role ?? null,
        action,
        entity: opts.entity ?? null,
        entityId: opts.entityId ?? null,
        target: opts.target ?? null,
        detail: opts.detail ?? null,
      },
    });
  } catch (e) {
    console.error('[audit] ghi nhật ký thất bại:', action, e);
  }
}
