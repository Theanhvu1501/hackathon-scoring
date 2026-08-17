import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { audit } from '@/lib/audit';
import { prisma } from '@/lib/db';
import { addMember } from '@/lib/services/teams';

export async function POST(req: Request) {
  const u = await requireRole('admin', 'superadmin');
  if (!u) return NextResponse.json({ error:'forbidden' }, { status:403 });
  const body = await req.json();
  if (!body?.teamId || !body?.name) return NextResponse.json({ error:'teamId and name required' }, { status:400 });
  const { teamId, ...data } = body;
  const member = await addMember(teamId, data);
  const team = await prisma.team.findUnique({ where:{ id:teamId }, select:{ name:true } });
  await audit(u, 'member.create', {
    entity:'member', entityId:member.id, target:member.name, detail:`đội ${team?.name ?? teamId}`,
  });
  return NextResponse.json(member, { status:201 });
}
