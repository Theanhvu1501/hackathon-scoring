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
  it('provisional excludes head, final includes head, ranking changes', async () => {
    await setRevealState('provisional');
    expect(await getRevealState()).toBe('provisional');
    const prov = await getResults();
    const provLeader = prov.rows[0].team.code;

    await setRevealState('final');
    const fin = await getResults();
    const finLeader = fin.rows[0].team.code;

    expect(prov.baremTotal).toBe(50);
    // seed is designed so provisional leader (CV) differs from final leader (EV)
    expect(provLeader).toBe('CV');
    expect(finLeader).toBe('EV');

    // Denominator follows the judges the phase counts: 4 of 5 while provisional
    // (head held back), all 5 once final.
    expect(prov.judgeCount).toBe(4);
    expect(prov.maxTotal).toBe(200);
    expect(fin.judgeCount).toBe(5);
    expect(fin.maxTotal).toBe(250);

    // Scores are sums, not averages: seed gives CV four judges at 47.5 each.
    const provCV = prov.rows.find((r) => r.team.code === 'CV')!;
    expect(provCV.score).toBeCloseTo(190, 5);

    await setRevealState('drafting'); // reset
  });
});
