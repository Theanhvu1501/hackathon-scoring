import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { updateMember, deleteMember } from '@/lib/services/teams';
async function requireAdmin() { const u = await getCurrentUser(); return u?.role === 'admin' ? u : null; }
export async function PATCH(req: Request, { params }: { params:{ id:string } }) {
  if (!(await requireAdmin())) return NextResponse.json({ error:'forbidden' }, { status:403 });
  return NextResponse.json(await updateMember(params.id, await req.json()));
}
export async function DELETE(_req: Request, { params }: { params:{ id:string } }) {
  if (!(await requireAdmin())) return NextResponse.json({ error:'forbidden' }, { status:403 });
  await deleteMember(params.id); return NextResponse.json({ ok:true });
}
