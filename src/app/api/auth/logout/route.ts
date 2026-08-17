import { NextResponse } from 'next/server';
import { SESSION_COOKIE, getCurrentUser } from '@/lib/auth';
import { audit } from '@/lib/audit';

export async function POST() {
  // Đọc user TRƯỚC khi xoá cookie, nếu không thì không biết ai vừa đăng xuất.
  const u = await getCurrentUser();
  if (u) await audit(u, 'auth.logout', { entity:'auth' });
  const res = NextResponse.json({ ok:true });
  res.cookies.set(SESSION_COOKIE, '', { path:'/', maxAge:0 });
  return res;
}
