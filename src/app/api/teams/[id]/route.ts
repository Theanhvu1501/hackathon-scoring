import { NextResponse } from 'next/server';
import { getCurrentUser, requireRole } from '@/lib/auth';
import { audit } from '@/lib/audit';
import { prisma } from '@/lib/db';
import { updateTeam, deleteTeam, getTeamForJudge } from '@/lib/services/teams';

// Mở cho cả giám khảo: họ cần xem thông tin đội trước khi chấm. Bản này không
// trả email/điện thoại thành viên — xem getTeamForJudge.
export async function GET(_req: Request, { params }: { params:{ id:string } }) {
  const u = await getCurrentUser();
  if (!u) return NextResponse.json({ error:'forbidden' }, { status:403 });
  const team = await getTeamForJudge(params.id);
  if (!team) return NextResponse.json({ error:'not found' }, { status:404 });
  return NextResponse.json(team);
}

export async function PATCH(req: Request, { params }: { params:{ id:string } }) {
  const u = await requireRole('admin', 'superadmin');
  if (!u) return NextResponse.json({ error:'forbidden' }, { status:403 });
  const body = await req.json();
  const team = await updateTeam(params.id, body);
  await audit(u, 'team.update', {
    entity:'team', entityId:team.id, target:team.name, detail:Object.keys(body).join(', '),
  });
  return NextResponse.json(team);
}

export async function DELETE(_req: Request, { params }: { params:{ id:string } }) {
  const u = await requireRole('admin', 'superadmin');
  if (!u) return NextResponse.json({ error:'forbidden' }, { status:403 });
  // Đọc tên TRƯỚC khi xoá: sau khi xoá là không còn gì để ghi vào target.
  const before = await prisma.team.findUnique({ where:{ id:params.id }, select:{ name:true } });
  await deleteTeam(params.id);
  await audit(u, 'team.delete', { entity:'team', entityId:params.id, target:before?.name ?? params.id });
  return NextResponse.json({ ok:true });
}

export const dynamic = 'force-dynamic';
