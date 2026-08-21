import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import { execSync } from 'node:child_process';
import { prisma, disconnect } from './helpers/db';
import {
  deriveState, getRevealStatus, revealTeam, unrevealTeam, resetReveal, getResults,
} from '@/lib/services/reveal';
import { anonymizeJudges } from '@/lib/judge-label';

afterAll(disconnect);
// Seed lại về trạng thái biết trước; các test tích hợp khác dùng chung DB.
// SEED_FORCE + SEED_SCORES là bắt buộc: seed từ chối xoá một database đã có dữ
// liệu, còn test này assert trên chính bộ điểm mẫu nó tạo ra.
beforeAll(() => {
  execSync('npx tsx prisma/seed.ts', {
    stdio: 'ignore',
    env: { ...process.env, SEED_FORCE: '1', SEED_SCORES: '1' },
  });
}, 120000);

describe('anonymizeJudges', () => {
  it('đánh số 1..n theo thứ tự đầu vào, mọi giám khảo ngang nhau', () => {
    const out = anonymizeJudges([{ id: 'a' }, { id: 'b' }, { id: 'c' }]);
    expect(out.map((j) => j.label)).toEqual(['BGK 1', 'BGK 2', 'BGK 3']);
  });
  it('giữ nguyên các trường khác của giám khảo', () => {
    const out = anonymizeJudges([{ id: 'a', active: true }]);
    expect(out[0]).toEqual({ id: 'a', active: true, label: 'BGK 1' });
  });
});

describe('deriveState', () => {
  it('không đội nào công bố thì waiting', () => {
    expect(deriveState({ revealedCount: 0 })).toBe('waiting');
  });
  it('có đội đã công bố thì revealing', () => {
    expect(deriveState({ revealedCount: 1 })).toBe('revealing');
  });
});

describe('reveal flow', () => {
  it('reset đưa board về waiting và xoá hết đội đã công bố', async () => {
    await resetReveal();
    const st = await getRevealStatus();
    expect(st.state).toBe('waiting');
    expect(st.revealedTeamIds).toEqual([]);
    expect(st.currentTeamId).toBeNull();
  });

  it('/api/results công khai không lộ đội chưa công bố', async () => {
    await resetReveal();
    const empty = await getResults();
    expect(empty.rows).toHaveLength(0);
    expect(empty.teamCount).toBeGreaterThan(0); // vẫn biết có bao nhiêu đội

    const all = await getResults({ includeUnrevealed: true });
    const last = all.rows[all.rows.length - 1];
    await revealTeam(last.team.id);

    const one = await getResults();
    expect(one.rows).toHaveLength(1);
    expect(one.state).toBe('revealing');
    expect(one.currentTeamId).toBe(last.team.id);
    // hạng là hạng thật trên toàn bộ đội, không phải hạng 1 của nhóm đã công bố
    expect(one.rows[0].rank).toBe(last.rank);
    expect(one.rows[0].rank).toBeGreaterThan(1);
  });

  it('đội đang chiếu là đội công bố GẦN NHẤT, không phải đội hạng cao nhất', async () => {
    await resetReveal();
    const all = await getResults({ includeUnrevealed: true });
    const worst = all.rows[all.rows.length - 1];
    const best = all.rows[0];

    // công bố hạng bét trước, rồi hạng nhất — board phải đang chiếu hạng nhất
    await revealTeam(worst.team.id);
    expect((await getRevealStatus()).currentTeamId).toBe(worst.team.id);
    await revealTeam(best.team.id);
    expect((await getRevealStatus()).currentTeamId).toBe(best.team.id);

    // công bố lại đội hạng bét thì nó thành đội đang chiếu, dù hạng thấp hơn
    await revealTeam(worst.team.id);
    const st = await getRevealStatus();
    expect(st.currentTeamId).toBe(worst.team.id);
    expect(st.currentTeamName).toBe(worst.team.name);
    expect(st.revealedTeamIds).toHaveLength(2);

    await resetReveal();
  });

  it('thu hồi đưa đội đó ra khỏi board', async () => {
    const all = await getResults({ includeUnrevealed: true });
    const t = all.rows[0].team.id;
    await revealTeam(t);
    expect((await getRevealStatus()).revealedTeamIds).toContain(t);
    await unrevealTeam(t);
    expect((await getRevealStatus()).revealedTeamIds).not.toContain(t);
  });

  it('điểm BGK đi cùng thứ hạng và không kèm tên thật', async () => {
    await resetReveal();
    const all = await getResults({ includeUnrevealed: true });
    await revealTeam(all.rows[0].team.id);

    const after = await getResults();
    expect(after.state).toBe('revealing');
    expect(after.rows[0].judgeScores.length).toBeGreaterThan(0);

    const labels = after.rows[0].judgeScores.map((j) => j.label);
    expect(labels).toEqual(['BGK 1', 'BGK 2', 'BGK 3', 'BGK 4', 'BGK 5']);
    // tên thật trong seed không được lọt ra
    const names = (await prisma.user.findMany({ where: { role: 'judge' } })).map((u) => u.name);
    const blob = JSON.stringify(after);
    for (const n of names) expect(blob).not.toContain(n);

    await resetReveal();
  });

  it('maxTotal = barem × số giám khảo active, không phụ thuộc trạng thái', async () => {
    const r = await getResults({ includeUnrevealed: true });
    expect(r.baremTotal).toBe(50);
    expect(r.judgeCount).toBe(5);
    expect(r.maxTotal).toBe(250);
  });
});
