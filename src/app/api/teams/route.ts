import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { listTeams, createTeam } from '@/lib/services/teams';

async function requireAdmin() { const u = await getCurrentUser(); return u?.role === 'admin' ? u : null; }

export async function GET() { return NextResponse.json(await listTeams()); }
export async function POST(req: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error:'forbidden' }, { status:403 });
  const body = await req.json();
  if (!body?.name || !body?.code) return NextResponse.json({ error:'name and code required' }, { status:400 });
  return NextResponse.json(await createTeam(body), { status:201 });
}
