import { prisma } from '@/lib/db';
import type { Prisma } from '@prisma/client';

export type AuditEntry = {
  id: string; actorName: string | null; actorRole: string | null;
  action: string; entity: string | null; entityId: string | null;
  target: string | null; detail: string | null; createdAt: Date;
};

export const AUDIT_PAGE_SIZE = 50;

/** Phân trang phía SERVER: nhật ký của một sự kiện thật có thể lên vài nghìn
 *  dòng, tải hết về client rồi mới lọc là sai cách. */
export async function listAudit(opts: {
  page?: number; pageSize?: number; entity?: string; q?: string;
} = {}) {
  const pageSize = opts.pageSize ?? AUDIT_PAGE_SIZE;
  const page = Math.max(1, opts.page ?? 1);

  const where: Prisma.AuditLogWhereInput = {};
  if (opts.entity) where.entity = opts.entity;
  if (opts.q?.trim()) {
    const q = opts.q.trim();
    where.OR = [
      { actorName: { contains: q, mode: 'insensitive' } },
      { target: { contains: q, mode: 'insensitive' } },
      { action: { contains: q, mode: 'insensitive' } },
    ];
  }

  const [total, entries] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true, actorName: true, actorRole: true, action: true,
        entity: true, entityId: true, target: true, detail: true, createdAt: true,
      },
    }),
  ]);

  return {
    entries: entries as AuditEntry[],
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
}
