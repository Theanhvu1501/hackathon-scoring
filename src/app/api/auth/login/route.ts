import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { signSession, SESSION_COOKIE } from '@/lib/auth';
import { audit } from '@/lib/audit';

export async function POST(req: Request) {
  const { code } = await req.json();
  const normalized = (code || '').trim().toUpperCase();
  const user = await prisma.user.findUnique({ where:{ accessCode: normalized } });
  if (!user || !user.active) {
    // KHÔNG ghi mã đầy đủ vào nhật ký — làm vậy là biến nhật ký thành kho mã.
    await audit(null, 'auth.login_failed', {
      entity:'auth', detail: normalized.slice(0, 4) + '***',
    });
    return NextResponse.json({ error:'Mã truy cập không hợp lệ' }, { status:401 });
  }
  await audit({ id:user.id, name:user.name, role:user.role }, 'auth.login', { entity:'auth' });
  const res = NextResponse.json({ role:user.role, name:user.name });
  res.cookies.set(SESSION_COOKIE, signSession(user.id), {
    httpOnly:true, sameSite:'lax', path:'/', maxAge:60*60*24,
    secure: process.env.NODE_ENV === 'production',
  });
  return res;
}
