import { prisma } from '@/lib/db';
import { computeLeaderboard, judgeTotal, ScoreLite, TeamLite } from '@/lib/scoring';
import { anonymizeJudges } from '@/lib/judge-label';
import { broadcast } from '@/lib/events';

export type BoardState = 'waiting' | 'revealing';

async function settings() {
  return prisma.settings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
}

/** Trạng thái board suy ra từ dữ liệu, không lưu cột riêng — hai nguồn chân lý
 *  sẽ lệch nhau ngay lần đầu ai đó thu hồi một đội. */
export function deriveState(input: { revealedCount: number }): BoardState {
  return input.revealedCount > 0 ? 'revealing' : 'waiting';
}

export async function getRevealStatus() {
  // Board chỉ chiếu MỘT đội: đội được công bố gần nhất, và giữ nguyên đó cho tới
  // lần công bố tiếp theo. Nên thứ tự revealedAt là dữ liệu, không phải trang trí.
  const revealed = await prisma.team.findMany({
    where: { revealedAt: { not: null } },
    select: { id: true, name: true },
    orderBy: { revealedAt: 'asc' },
  });
  const current = revealed.length ? revealed[revealed.length - 1] : null;
  return {
    state: deriveState({ revealedCount: revealed.length }),
    revealedTeamIds: revealed.map((t) => t.id),
    currentTeamId: current?.id ?? null,
    currentTeamName: current?.name ?? null,
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

export async function resetReveal() {
  await prisma.team.updateMany({ where: { revealedAt: { not: null } }, data: { revealedAt: null } });
  broadcast('reveal', { reset: true });
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

  const revealedInOrder = teams
    .filter((t) => t.revealedAt !== null)
    .sort((a, b) => a.revealedAt!.getTime() - b.revealedAt!.getTime());
  const revealedIds = revealedInOrder.map((t) => t.id);
  const currentTeamId = revealedIds.length ? revealedIds[revealedIds.length - 1] : null;
  const state = deriveState({ revealedCount: revealedIds.length });

  const teamsLite: TeamLite[] = teams.map((t) => ({
    id: t.id, name: t.name, code: t.code, logoUrl: t.logoUrl, tag: t.tag,
  }));
  const scores: ScoreLite[] = scoreRows;
  // Hạng tính trên TOÀN BỘ đội — công bố đội hạng 4 trước thì nó vẫn là #4.
  const ranked = computeLeaderboard({ teams: teamsLite, scores });
  const membersByTeam = Object.fromEntries(teams.map((t) => [t.id, t.members]));

  const labelled = anonymizeJudges(judges);
  // Điểm từng BGK đi CÙNG lúc với thứ hạng — không còn bước công bố riêng. Với
  // đội chưa công bố thì cả hàng đã bị lọc khỏi API công khai, nên không rò rỉ.
  // Giám khảo bị tắt vẫn hiện nếu đã chấm, vì điểm của họ nằm trong tổng và bỏ
  // đi thì các thẻ không cộng lại thành tổng nữa.
  const judgeScoresFor = (teamId: string) => labelled
    .map((j) => ({
      judgeId: j.id, label: j.label, isHead: j.isHead, active: j.active,
      total: judgeTotal(scores, teamId, j.id),
    }))
    .filter((j) => j.active || j.total !== null)
    .map(({ judgeId, label, isHead, total }) => ({ judgeId, label, isHead, total }));

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
    currentTeamId,
    teamCount: teams.length,
    baremTotal,
    maxTotal,
    judgeCount,
    bannerImageUrl: s.bannerImageUrl ?? null,
  };
}
