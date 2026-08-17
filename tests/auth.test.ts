import { describe, it, expect, beforeAll } from 'vitest';
process.env.SESSION_SECRET = 'test-secret-test-secret-test-secret';
import { generateAccessCode } from '@/lib/access-code';
import { signSession, verifySession, isAdminish } from '@/lib/auth';

describe('generateAccessCode', () => {
  it('produces XXXX-XXXX from unambiguous chars', () => {
    const c = generateAccessCode();
    expect(c).toMatch(/^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
  });
  it('is reasonably unique', () => {
    const set = new Set(Array.from({ length: 500 }, () => generateAccessCode()));
    expect(set.size).toBeGreaterThan(495);
  });
});

describe('session sign/verify', () => {
  it('round-trips a userId', () => {
    const token = signSession('user123');
    expect(verifySession(token)).toBe('user123');
  });
  it('rejects tampered token', () => {
    const token = signSession('user123');
    expect(verifySession(token.replace('user123', 'attacker'))).toBeNull();
  });
  it('rejects undefined/garbage', () => {
    expect(verifySession(undefined)).toBeNull();
    expect(verifySession('nope')).toBeNull();
  });
});

describe('isAdminish', () => {
  it('nhận admin và superadmin, từ chối judge và null', () => {
    expect(isAdminish({ role: 'admin' })).toBe(true);
    expect(isAdminish({ role: 'superadmin' })).toBe(true);
    expect(isAdminish({ role: 'judge' })).toBe(false);
    expect(isAdminish(null)).toBe(false);
    expect(isAdminish(undefined)).toBe(false);
  });
});
