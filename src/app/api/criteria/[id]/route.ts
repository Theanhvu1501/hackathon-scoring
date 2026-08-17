import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { audit } from '@/lib/audit';
import { prisma } from '@/lib/db';
import { updateCriterion, deleteCriterion } from '@/lib/services/criteria';

export async function PATCH(req: Request, { params }:{ params:{ id:string } }) {
  const u = await requireRole('admin', 'superadmin');
  if (!u) return NextResponse.json({ error:'forbidden' }, { status:403 });
  const body = await req.json();
  const before = await prisma.criterion.findUnique({ where:{ id:params.id } });
  const after = await updateCriterion(params.id, body);
  // Đổi barem là thay đổi nhạy cảm nhất ở đây: ghi rõ trước/sau thay vì chỉ tên field.
  const detail = before && before.maxScore !== after.maxScore
    ? `maxScore: ${before.maxScore} -> ${after.maxScore}`
    : Object.keys(body).join(', ');
  await audit(u, 'criterion.update', { entity:'criterion', entityId:after.id, target:after.name, detail });
  return NextResponse.json(after);
}

export async function DELETE(_req: Request, { params }:{ params:{ id:string } }) {
  const u = await requireRole('admin', 'superadmin');
  if (!u) return NextResponse.json({ error:'forbidden' }, { status:403 });
  const before = await prisma.criterion.findUnique({ where:{ id:params.id }, select:{ name:true } });
  await deleteCriterion(params.id);
  await audit(u, 'criterion.delete', { entity:'criterion', entityId:params.id, target:before?.name ?? params.id });
  return NextResponse.json({ ok:true });
}
