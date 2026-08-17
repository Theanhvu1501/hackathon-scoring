import { describe, it, expect, afterAll } from 'vitest';
import { prisma, disconnect } from './helpers/db';
import { createJudge, listJudges, regenerateCode, setHead, deleteJudge } from '@/lib/services/judges';
import { createCriterion, listCriteria, updateCriterion, deleteCriterion, baremTotal } from '@/lib/services/criteria';
import { normalizeAccessCode, validateAccessCode } from '@/lib/access-code';
import { setUserAccessCode } from '@/lib/services/access';
afterAll(disconnect);

describe('judges service', () => {
  it('creates judge with a unique access code', async () => {
    const j = await createJudge({ name:'Judge X' });
    expect(j.accessCode).toMatch(/^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
    const old = j.accessCode;
    const j2 = await regenerateCode(j.id);
    expect(j2.accessCode).not.toBe(old);
    await deleteJudge(j.id);
  });
  it('enforces a single head judge', async () => {
    const a = await createJudge({ name:'Head A', isHead:true });
    const b = await createJudge({ name:'Head B', isHead:true });
    const heads = (await listJudges()).filter(j => j.isHead);
    expect(heads.length).toBe(1);
    expect(heads[0].id).toBe(b.id);
    await deleteJudge(a.id); await deleteJudge(b.id);
  });
});
describe('access code', () => {
  it('chuẩn hoá về uppercase và bỏ khoảng trắng', () => {
    expect(normalizeAccessCode('  abcd-1234 ')).toBe('ABCD-1234');
  });

  it('từ chối mã quá ngắn, quá dài, ký tự lạ', () => {
    expect(validateAccessCode('')).not.toBeNull();
    expect(validateAccessCode('ABC')).not.toBeNull();
    expect(validateAccessCode('A'.repeat(33))).not.toBeNull();
    expect(validateAccessCode('ABCD_1234')).not.toBeNull();
    expect(validateAccessCode('ABCD 1234')).not.toBeNull();
    expect(validateAccessCode('ABCD-1234')).toBeNull();
    expect(validateAccessCode('BGK2026')).toBeNull();
  });

  it('setUserAccessCode lưu mã đã chuẩn hoá', async () => {
    const j = await createJudge({ name:'BGK doi ma' });
    const r = await setUserAccessCode(j.id, 'bgk9-2026');
    expect(r).toEqual({ ok:true, code:'BGK9-2026' });
    const after = await prisma.user.findUnique({ where:{ id:j.id } });
    expect(after?.accessCode).toBe('BGK9-2026');
    await deleteJudge(j.id);
  });

  it('từ chối mã đã có người khác dùng', async () => {
    const a = await createJudge({ name:'BGK A' });
    const b = await createJudge({ name:'BGK B' });
    await setUserAccessCode(a.id, 'DUP1-0001');
    const r = await setUserAccessCode(b.id, 'DUP1-0001');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/đã có tài khoản khác/);
    // mã của b không bị đổi
    const bAfter = await prisma.user.findUnique({ where:{ id:b.id } });
    expect(bAfter?.accessCode).not.toBe('DUP1-0001');
    await deleteJudge(a.id); await deleteJudge(b.id);
  });

  it('đặt lại chính mã của mình thì không báo trùng', async () => {
    const a = await createJudge({ name:'BGK C' });
    await setUserAccessCode(a.id, 'SAME-0001');
    expect(await setUserAccessCode(a.id, 'same-0001')).toEqual({ ok:true, code:'SAME-0001' });
    await deleteJudge(a.id);
  });

  it('mã sai định dạng thì không ghi gì vào DB', async () => {
    const a = await createJudge({ name:'BGK D' });
    const before = a.accessCode;
    const r = await setUserAccessCode(a.id, 'x');
    expect(r.ok).toBe(false);
    const after = await prisma.user.findUnique({ where:{ id:a.id } });
    expect(after?.accessCode).toBe(before);
    await deleteJudge(a.id);
  });
});

describe('criteria service', () => {
  it('CRUD + total', async () => {
    const c1 = await createCriterion({ name:'A', maxScore:10 });
    const c2 = await createCriterion({ name:'B', maxScore:15 });
    const list = await listCriteria();
    expect(list.length).toBeGreaterThanOrEqual(2);
    expect(baremTotal([{maxScore:10},{maxScore:15}])).toBe(25);
    await updateCriterion(c1.id, { maxScore:20 });
    await deleteCriterion(c1.id); await deleteCriterion(c2.id);
  });
});
