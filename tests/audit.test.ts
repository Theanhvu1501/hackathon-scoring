import { describe, it, expect, afterAll } from 'vitest';
import { prisma, disconnect } from './helpers/db';
import { audit } from '@/lib/audit';

afterAll(disconnect);

describe('audit', () => {
  it('ghi đủ actor, action và đối tượng', async () => {
    await audit({ id: 'u1', name: 'Ban tổ chức', role: 'admin' }, 'team.create', {
      entity: 'team', entityId: 't1', target: 'EV Nexus', detail: 'code: EV',
    });
    const row = await prisma.auditLog.findFirst({ orderBy: { createdAt: 'desc' } });
    expect(row).toMatchObject({
      actorId: 'u1', actorName: 'Ban tổ chức', actorRole: 'admin',
      action: 'team.create', entity: 'team', entityId: 't1',
      target: 'EV Nexus', detail: 'code: EV',
    });
  });

  it('actor null vẫn ghi được (đăng nhập thất bại, thao tác hệ thống)', async () => {
    await audit(null, 'auth.login_failed', { entity: 'auth', detail: 'ABCD***' });
    const row = await prisma.auditLog.findFirst({ orderBy: { createdAt: 'desc' } });
    expect(row?.action).toBe('auth.login_failed');
    expect(row?.actorId).toBeNull();
    expect(row?.actorName).toBeNull();
  });

  it('không throw khi ghi lỗi — thao tác chính không được hỏng vì log', async () => {
    // action là number: Prisma ném lỗi validate, audit() phải nuốt nó.
    await expect(
      audit({ id: 'u1', name: 'x', role: 'admin' }, 123 as any),
    ).resolves.toBeUndefined();
  });
});
