import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { audit } from '@/lib/audit';
import { prisma } from '@/lib/db';
import { regenerateCode, setHead, deleteJudge, updateJudge } from '@/lib/services/judges';
import { setUserAccessCode } from '@/lib/services/access';

function judgeName(id: string) {
  return prisma.user.findUnique({ where:{ id }, select:{ name:true } });
}

export async function POST(req: Request, { params }:{ params:{ id:string } }) {
  const u = await requireRole('admin', 'superadmin');
  if (!u) return NextResponse.json({ error:'forbidden' }, { status:403 });
  const { action } = await req.json();
  if (action === 'regen') {
    const j = await regenerateCode(params.id);
    // Cố ý không ghi mã mới vào detail.
    await audit(u, 'judge.regen_code', { entity:'judge', entityId:params.id, target:j.name });
    return NextResponse.json(j);
  }
  if (action === 'setHead') {
    await setHead(params.id);
    const j = await judgeName(params.id);
    await audit(u, 'judge.set_head', { entity:'judge', entityId:params.id, target:j?.name ?? params.id });
    return NextResponse.json({ ok:true });
  }
  return NextResponse.json({ error:'unknown action' }, { status:400 });
}

export async function PATCH(req: Request, { params }:{ params:{ id:string } }) {
  const u = await requireRole('admin', 'superadmin');
  if (!u) return NextResponse.json({ error:'forbidden' }, { status:403 });
  const { name, isHead, accessCode } = await req.json();
  // Mã đi trước: nếu mã sai thì trả lỗi ngay, không đổi nửa vời rồi mới báo.
  if (typeof accessCode === 'string' && accessCode.trim()) {
    const r = await setUserAccessCode(params.id, accessCode);
    if (!r.ok) return NextResponse.json({ error: r.error }, { status:400 });
    const j = await judgeName(params.id);
    await audit(u, 'judge.set_code', { entity:'judge', entityId:params.id, target:j?.name ?? params.id });
  }
  if (typeof name === 'string' && name.trim()) {
    await updateJudge(params.id, { name: name.trim() });
    await audit(u, 'judge.update', { entity:'judge', entityId:params.id, target:name.trim() });
  }
  if (isHead === true) {
    await setHead(params.id);
    const j = await judgeName(params.id);
    await audit(u, 'judge.set_head', { entity:'judge', entityId:params.id, target:j?.name ?? params.id });
  }
  return NextResponse.json({ ok:true });
}

export async function DELETE(_req: Request, { params }:{ params:{ id:string } }) {
  const u = await requireRole('admin', 'superadmin');
  if (!u) return NextResponse.json({ error:'forbidden' }, { status:403 });
  const before = await judgeName(params.id);
  await deleteJudge(params.id);
  await audit(u, 'judge.delete', { entity:'judge', entityId:params.id, target:before?.name ?? params.id });
  return NextResponse.json({ ok:true });
}
