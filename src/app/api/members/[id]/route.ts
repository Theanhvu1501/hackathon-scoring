import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { audit } from '@/lib/audit';
import { prisma } from '@/lib/db';
import { updateMember, deleteMember } from '@/lib/services/teams';

export async function PATCH(req: Request, { params }: { params:{ id:string } }) {
  const u = await requireRole('admin', 'superadmin');
  if (!u) return NextResponse.json({ error:'forbidden' }, { status:403 });
  const body = await req.json();
  const member = await updateMember(params.id, body);
  await audit(u, 'member.update', {
    entity:'member', entityId:member.id, target:member.name, detail:Object.keys(body).join(', '),
  });
  return NextResponse.json(member);
}

export async function DELETE(_req: Request, { params }: { params:{ id:string } }) {
  const u = await requireRole('admin', 'superadmin');
  if (!u) return NextResponse.json({ error:'forbidden' }, { status:403 });
  const before = await prisma.member.findUnique({ where:{ id:params.id }, select:{ name:true } });
  await deleteMember(params.id);
  await audit(u, 'member.delete', { entity:'member', entityId:params.id, target:before?.name ?? params.id });
  return NextResponse.json({ ok:true });
}
