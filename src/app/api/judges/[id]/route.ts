import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { regenerateCode, setHead, deleteJudge } from '@/lib/services/judges';
async function admin(){ const u=await getCurrentUser(); return u?.role==='admin'; }
export async function POST(req: Request, { params }:{ params:{ id:string } }) {
  if (!(await admin())) return NextResponse.json({ error:'forbidden' }, { status:403 });
  const { action } = await req.json();
  if (action==='regen') return NextResponse.json(await regenerateCode(params.id));
  if (action==='setHead') { await setHead(params.id); return NextResponse.json({ ok:true }); }
  return NextResponse.json({ error:'unknown action' }, { status:400 });
}
export async function DELETE(_req: Request, { params }:{ params:{ id:string } }) {
  if (!(await admin())) return NextResponse.json({ error:'forbidden' }, { status:403 });
  await deleteJudge(params.id); return NextResponse.json({ ok:true });
}
