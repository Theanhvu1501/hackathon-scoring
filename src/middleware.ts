import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifySession, SESSION_COOKIE } from '@/lib/auth';

// Board and login are public. /admin requires a session; role is enforced in pages/handlers.
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isProtected = pathname.startsWith('/admin') || pathname.startsWith('/judge');
  if (!isProtected) return NextResponse.next();
  const userId = verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!userId) {
    const url = req.nextUrl.clone(); url.pathname = '/login';
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}
export const config = { matcher: ['/admin/:path*', '/judge/:path*'] };
