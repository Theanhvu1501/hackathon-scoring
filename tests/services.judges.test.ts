import { describe, it, expect, afterAll } from 'vitest';
import { disconnect } from './helpers/db';
import { createJudge, listJudges, regenerateCode, setHead, deleteJudge } from '@/lib/services/judges';
import { createCriterion, listCriteria, updateCriterion, deleteCriterion, baremTotal } from '@/lib/services/criteria';
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
