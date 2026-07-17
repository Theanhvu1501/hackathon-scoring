import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import { execSync } from 'node:child_process';
import { disconnect } from './helpers/db';
import { setRevealState, getRevealState, getResults } from '@/lib/services/reveal';

afterAll(disconnect);
// Re-seed to a known state so this test is deterministic regardless of what
// other integration tests did to shared DB state (e.g. head-judge flag).
beforeAll(() => {
  execSync('npx tsx prisma/seed.ts', { stdio: 'ignore' });
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

    await setRevealState('drafting'); // reset
  });
});
