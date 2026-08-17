import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import { execSync } from 'node:child_process';
import { disconnect } from './helpers/db';
import { setRevealState, getRevealState, getResults } from '@/lib/services/reveal';

afterAll(disconnect);
// Re-seed to a known state so this test is deterministic regardless of what
// other integration tests did to shared DB state (e.g. head-judge flag).
// SEED_FORCE + SEED_SCORES are required: the seed refuses to wipe a populated
// database on its own, and this test asserts on the sample scores it creates.
beforeAll(() => {
  execSync('npx tsx prisma/seed.ts', {
    stdio: 'ignore',
    env: { ...process.env, SEED_FORCE: '1', SEED_SCORES: '1' },
  });
}, 120000);

describe('reveal flow', () => {
  it('every judge counts in both states — no head-judge hold left', async () => {
    await setRevealState('provisional');
    expect(await getRevealState()).toBe('provisional');
    const prov = await getResults();

    await setRevealState('final');
    const fin = await getResults();

    expect(prov.baremTotal).toBe(50);
    // Cơ chế giữ kín điểm trưởng BGK đã bỏ: hai state cho cùng một bảng xếp hạng.
    // Seed cho EV 4×46 + head 50 = 234, CV 4×47.5 + head 41 = 231.
    expect(prov.rows[0].team.code).toBe('EV');
    expect(fin.rows[0].team.code).toBe('EV');

    // Mẫu số là barem × số giám khảo active, không phụ thuộc state.
    expect(prov.judgeCount).toBe(5);
    expect(prov.maxTotal).toBe(250);
    expect(fin.judgeCount).toBe(5);
    expect(fin.maxTotal).toBe(250);

    // Điểm là tổng, không phải trung bình.
    expect(prov.rows.find((r) => r.team.code === 'CV')!.score).toBeCloseTo(231, 5);
    expect(prov.rows.find((r) => r.team.code === 'EV')!.score).toBeCloseTo(234, 5);

    await setRevealState('drafting'); // reset
  });
});
