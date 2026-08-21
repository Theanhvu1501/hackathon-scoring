import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/db';

export const SESSION_COOKIE = 'hs_session';

export type Role = 'superadmin' | 'admin' | 'judge';
export type SessionUser = { id: string; name: string; role: Role };
function secret(): string { return process.env.SESSION_SECRET || 'dev-secret-change-me'; }

export function signSession(userId: string): string {
  const mac = createHmac('sha256', secret()).update(userId).digest('hex');
  return `${userId}.${mac}`;
}
export function verifySession(token: string | undefined): string | null {
  if (!token || !token.includes('.')) return null;
  const idx = token.lastIndexOf('.');
  const userId = token.slice(0, idx);
  const mac = token.slice(idx + 1);
  const expected = createHmac('sha256', secret()).update(userId).digest('hex');
  try {
    if (mac.length === expected.length && timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) return userId;
  } catch { /* fallthrough */ }
  return null;
}
export async function getCurrentUser(): Promise<SessionUser | null> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  const userId = verifySession(token);
  if (!userId) return null;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, role: true, active: true },
  });
  if (!user || !user.active) return null;
  const { active, ...rest } = user;
  return rest;
}

/** `admin` là tài khoản khách hàng, `superadmin` là tài khoản nội bộ. Mọi thứ
 *  vận hành đều mở cho cả hai; chỉ audit log và quản lý tài khoản là riêng
 *  superadmin. */
export function isAdminish(u: { role: Role } | null | undefined): boolean {
  return u?.role === 'admin' || u?.role === 'superadmin';
}

/** Trả về user nếu role nằm trong danh sách cho phép, null nếu không.
 *  Route handler luôn dịch null thành 403 — không bao giờ 401, vì mọi lối vào
 *  đã qua middleware kiểm cookie rồi. */
export async function requireRole(...roles: Role[]): Promise<SessionUser | null> {
  const u = await getCurrentUser();
  if (!u) return null;
  return roles.includes(u.role) ? u : null;
}
