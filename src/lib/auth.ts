import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/db';

export const SESSION_COOKIE = 'hs_session';
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
export async function getCurrentUser() {
  const token = cookies().get(SESSION_COOKIE)?.value;
  const userId = verifySession(token);
  if (!userId) return null;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, role: true, isHead: true, active: true },
  });
  if (!user || !user.active) return null;
  return user;
}
