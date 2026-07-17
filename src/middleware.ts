import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Runs in the Edge runtime, so it must NOT import node:crypto (via @/lib/auth).
// This is a fast presence check only; the real HMAC verification + role gate
// happens in the /admin and /judge server layouts via getCurrentUser (Node runtime).
const SESSION_COOKIE = 'hs_session';

// Board and login are public. /admin and /judge require a session cookie to be present.
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isProtected = pathname.startsWith('/admin') || pathname.startsWith('/judge');
  if (!isProtected) return NextResponse.next();
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) {
    const url = req.nextUrl.clone(); url.pathname = '/login';
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}
export const config = { matcher: ['/admin/:path*', '/judge/:path*'] };
