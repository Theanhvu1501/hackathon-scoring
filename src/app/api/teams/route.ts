import { NextResponse } from 'next/server';
import { getCurrentUser, requireRole } from '@/lib/auth';
import { audit } from '@/lib/audit';
import { listTeams, createTeam } from '@/lib/services/teams';

export async function GET() {
  const u = await getCurrentUser();
  if (!u) return NextResponse.json({ error:'forbidden' }, { status:403 });
  return NextResponse.json(await listTeams());
}
export async function POST(req: Request) {
  const u = await requireRole('admin', 'superadmin');
  if (!u) return NextResponse.json({ error:'forbidden' }, { status:403 });
  const body = await req.json();
  if (!body?.name || !body?.code) return NextResponse.json({ error:'name and code required' }, { status:400 });
  const team = await createTeam(body);
  await audit(u, 'team.create', { entity:'team', entityId:team.id, target:team.name, detail:`code: ${team.code}` });
  return NextResponse.json(team, { status:201 });
}

export const dynamic = 'force-dynamic';
