import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { updateCriterion, deleteCriterion } from '@/lib/services/criteria';
async function admin(){ const u=await getCurrentUser(); return u?.role==='admin'; }
export async function PATCH(req: Request, { params }:{ params:{ id:string } }) {
  if (!(await admin())) return NextResponse.json({ error:'forbidden' }, { status:403 });
  return NextResponse.json(await updateCriterion(params.id, await req.json()));
}
export async function DELETE(_req: Request, { params }:{ params:{ id:string } }) {
  if (!(await admin())) return NextResponse.json({ error:'forbidden' }, { status:403 });
  await deleteCriterion(params.id); return NextResponse.json({ ok:true });
}
