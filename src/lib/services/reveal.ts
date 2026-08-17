import { prisma } from '@/lib/db';
import { computeLeaderboard, judgeTotal, ScoreLite, TeamLite } from '@/lib/scoring';
import { anonymizeJudges } from '@/lib/judge-label';
import { broadcast } from '@/lib/events';

export type BoardState = 'waiting' | 'ranks' | 'judges';

async function settings() {
  return prisma.settings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
}

/** Trạng thái board suy ra từ dữ liệu, không lưu cột riêng — hai nguồn chân lý
 *  sẽ lệch nhau ngay lần đầu ai đó thu hồi một đội. */
export function deriveState(input: { revealedCount: number; judgeScoresRevealed: boolean }): BoardState {
  if (input.judgeScoresRevealed) return 'judges';
  return input.revealedCount > 0 ? 'ranks' : 'waiting';
}

export async function getRevealStatus() {
  const [s, revealed] = await Promise.all([
    settings(),
    prisma.team.findMany({
      where: { revealedAt: { not: null } },
      select: { id: true },
      orderBy: { revealedAt: 'asc' },
    }),
  ]);
  return {
    state: deriveState({ revealedCount: revealed.length, judgeScoresRevealed: s.judgeScoresRevealed }),
    revealedTeamIds: revealed.map((t) => t.id),
    judgeScoresRevealed: s.judgeScoresRevealed,
  };
}

export async function revealTeam(teamId: string) {
  await prisma.team.update({ where: { id: teamId }, data: { revealedAt: new Date() } });
  broadcast('reveal', { teamId });
}

export async function unrevealTeam(teamId: string) {
  await prisma.team.update({ where: { id: teamId }, data: { revealedAt: null } });
  broadcast('reveal', { teamId, undo: true });
}

export async function revealJudgeScores() {
  await prisma.settings.upsert({
    where: { id: 1 },
    update: { judgeScoresRevealed: true },
    create: { id: 1, judgeScoresRevealed: true },
  });
  broadcast('reveal', { judges: true });
}

export async function resetReveal() {
  await prisma.$transaction([
    prisma.team.updateMany({ where: { revealedAt: { not: null } }, data: { revealedAt: null } }),
    prisma.settings.upsert({
      where: { id: 1 },
      update: { judgeScoresRevealed: false },
      create: { id: 1, judgeScoresRevealed: false },
    }),
  ]);
  broadcast('reveal', { reset: true });
}

export async function getHeroImage(): Promise<string | null> { return (await settings()).heroImageUrl ?? null; }
export async function setHeroImage(url: string | null) {
  await prisma.settings.upsert({ where: { id: 1 }, update: { heroImageUrl: url }, create: { id: 1, heroImageUrl: url } });
  broadcast('reveal', { hero: true });
}
export async function getBannerImage(): Promise<string | null> { return (await settings()).bannerImageUrl ?? null; }
export async function setBannerImage(url: string | null) {
  await prisma.settings.upsert({ where: { id: 1 }, update: { bannerImageUrl: url }, create: { id: 1, bannerImageUrl: url } });
  broadcast('reveal', { banner: true });
}

/**
 * includeUnrevealed CHỈ được bật cho người gọi đã đăng nhập (admin/BGK).
 * /api/results là endpoint công khai: trả đội chưa công bố ở đó là lộ toàn bộ
 * kết quả trước giờ công bố, chỉ cần một lệnh curl.
 */
export async function getResults(opts: { includeUnrevealed?: boolean } = {}) {
  const [teams, scoreRows, judges, criteria, s] = await Promise.all([
    prisma.team.findMany({
      orderBy: { createdAt: 'asc' },
      include: { members: { select: { id: true, name: true, photoUrl: true, teamRole: true } } },
    }),
    prisma.score.findMany({ select: { judgeId: true, teamId: true, criterionId: true, value: true } }),
    prisma.user.findMany({
      where: { role: 'judge' },
      orderBy: { createdAt: 'asc' },
      select: { id: true, isHead: true, active: true },
    }),
    prisma.criterion.findMany({ select: { maxScore: true } }),
    settings(),
  ]);

  const revealedIds = teams.filter((t) => t.revealedAt !== null).map((t) => t.id);
  const state = deriveState({ revealedCount: revealedIds.length, judgeScoresRevealed: s.judgeScoresRevealed });

  const teamsLite: TeamLite[] = teams.map((t) => ({
    id: t.id, name: t.name, code: t.code, logoUrl: t.logoUrl, tag: t.tag,
  }));
  const scores: ScoreLite[] = scoreRows;
  // Hạng tính trên TOÀN BỘ đội — công bố đội hạng 4 trước thì nó vẫn là #4.
  const ranked = computeLeaderboard({ teams: teamsLite, scores });
  const membersByTeam = Object.fromEntries(teams.map((t) => [t.id, t.members]));

  const labelled = anonymizeJudges(judges);
  const showJudges = state === 'judges' || !!opts.includeUnrevealed;
  // Giám khảo bị tắt vẫn hiện nếu đã chấm, vì điểm của họ nằm trong tổng và
  // nếu bỏ đi thì các thẻ không cộng lại thành tổng nữa.
  const judgeScoresFor = (teamId: string) => {
    if (!showJudges) return [];
    return labelled
      .map((j) => ({
        judgeId: j.id, label: j.label, isHead: j.isHead, active: j.active,
        total: judgeTotal(scores, teamId, j.id),
      }))
      .filter((j) => j.active || j.total !== null)
      .map(({ judgeId, label, isHead, total }) => ({ judgeId, label, isHead, total }));
  };

  const rows = ranked
    .map((r) => ({
      ...r,
      revealed: revealedIds.includes(r.team.id),
      team: { ...r.team, members: membersByTeam[r.team.id] ?? [] },
      judgeScores: judgeScoresFor(r.team.id),
    }))
    .filter((r) => opts.includeUnrevealed || r.revealed);

  const baremTotal = Math.round(criteria.reduce((a, c) => a + c.maxScore, 0) * 10) / 10;
  // Mẫu số là barem của một giám khảo nhân số giám khảo active — không phải số
  // người đã chấm đội đó, để thanh bar giữa các đội vẫn so sánh được.
  const judgeCount = judges.filter((j) => j.active).length;
  const maxTotal = Math.round(baremTotal * judgeCount * 10) / 10;

  return {
    state,
    rows,
    revealedTeamIds: revealedIds,
    teamCount: teams.length,
    baremTotal,
    maxTotal,
    judgeCount,
    heroImageUrl: s.heroImageUrl ?? null,
    bannerImageUrl: s.bannerImageUrl ?? null,
  };
}
