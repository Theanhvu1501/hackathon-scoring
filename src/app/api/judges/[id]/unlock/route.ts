import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { audit } from '@/lib/audit';
import { prisma } from '@/lib/db';
import { unlockCard } from '@/lib/services/scores';
import { broadcast } from '@/lib/events';

// Mở khoá một phiếu (giám khảo, đội) để giám khảo chấm lại. Điểm đã nhập giữ
// nguyên — chỉ bỏ cờ submitted.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const u = await requireRole('admin', 'superadmin');
  if (!u) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const { teamId } = await req.json();
  if (typeof teamId !== 'string' || !teamId) {
    return NextResponse.json({ error: 'teamId required' }, { status: 400 });
  }

  const count = await unlockCard(params.id, teamId);
  const [judge, team] = await Promise.all([
    prisma.user.findUnique({ where: { id: params.id }, select: { name: true } }),
    prisma.team.findUnique({ where: { id: teamId }, select: { name: true } }),
  ]);
  await audit(u, 'score.unlock', {
    entity: 'score', entityId: `${params.id}:${teamId}`,
    target: `${judge?.name ?? params.id} / ${team?.name ?? teamId}`,
    detail: `${count} dòng`,
  });
  broadcast('update', { reason: 'unlock', teamId });
  return NextResponse.json({ ok: true, count });
}
