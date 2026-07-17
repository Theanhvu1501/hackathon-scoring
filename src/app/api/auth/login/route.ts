import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { signSession, SESSION_COOKIE } from '@/lib/auth';
export async function POST(req: Request) {
  const { code } = await req.json();
  const user = await prisma.user.findUnique({ where:{ accessCode: (code||'').trim().toUpperCase() } });
  if (!user || !user.active) return NextResponse.json({ error:'Mã truy cập không hợp lệ' }, { status:401 });
  const res = NextResponse.json({ role:user.role, name:user.name });
  res.cookies.set(SESSION_COOKIE, signSession(user.id), { httpOnly:true, sameSite:'lax', path:'/', maxAge:60*60*24 });
  return res;
}
