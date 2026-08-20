import { prisma } from '@/lib/db';
import { broadcast } from '@/lib/events';

/**
 * Đặt lại phần THI ĐẤU của sự kiện: điểm, nhận xét, trạng thái công bố.
 *
 * Ranh giới của module này là điều quan trọng nhất ở đây: nó KHÔNG bao giờ được
 * đụng tới Team, Member, User, Criterion hay Settings. Ban tổ chức chạy thử
 * trước sự kiện rồi reset để chạy thật — nếu reset cuốn theo danh sách đội và
 * ban giám khảo thì họ mất toàn bộ dữ liệu đã nhập tay, đúng lúc không còn thời
 * gian nhập lại. Xem test 'GIỮ NGUYÊN đội, thành viên, giám khảo và tiêu chí'.
 */

export type ResetPreview = {
  // Sắp bị xoá
  scoreCount: number;
  cardCount: number;       // số phiếu = số cặp (giám khảo × đội) đã có điểm
  submittedCards: number;  // trong đó bao nhiêu phiếu đã nộp
  commentCount: number;
  revealedTeams: number;
  // Được giữ — dùng dựng checklist 'sẵn sàng chạy' sau khi reset
  teamCount: number;
  memberCount: number;
  judgeCount: number;
  activeJudgeCount: number;
  criterionCount: number;
  baremTotal: number;
  bannerImageUrl: string | null;
};

export async function resetPreview(): Promise<ResetPreview> {
  const [cards, comments, revealedTeams, teamCount, memberCount, judges, criteria, settings] =
    await Promise.all([
      // distinct thay vì groupBy(_max: submitted): Postgres không có max(boolean).
      // Cùng lý do đã ghi ở judgeProgress() trong services/scores.ts.
      prisma.score.findMany({ select: { judgeId: true, teamId: true, submitted: true } }),
      prisma.scoreComment.count(),
      prisma.team.count({ where: { revealedAt: { not: null } } }),
      prisma.team.count(),
      prisma.member.count(),
      prisma.user.findMany({ where: { role: 'judge' }, select: { active: true } }),
      prisma.criterion.findMany({ select: { maxScore: true } }),
      prisma.settings.findUnique({ where: { id: 1 }, select: { bannerImageUrl: true } }),
    ]);

  // Một phiếu chỉ tính là 'đã nộp' khi MỌI dòng của nó mang cờ submitted — lưu
  // nháp một phần thì vẫn là nháp, giống hệt cách judgeScoreDetail() phân loại.
  const byCard = new Map<string, boolean>();
  for (const s of cards) {
    const key = `${s.judgeId}:${s.teamId}`;
    byCard.set(key, (byCard.get(key) ?? true) && s.submitted);
  }

  return {
    scoreCount: cards.length,
    cardCount: byCard.size,
    submittedCards: [...byCard.values()].filter(Boolean).length,
    commentCount: comments,
    revealedTeams,
    teamCount,
    memberCount,
    judgeCount: judges.length,
    activeJudgeCount: judges.filter((j) => j.active).length,
    criterionCount: criteria.length,
    baremTotal: Math.round(criteria.reduce((a, c) => a + c.maxScore, 0) * 10) / 10,
    bannerImageUrl: settings?.bannerImageUrl ?? null,
  };
}

export type BackupScore = {
  judgeName: string; teamName: string; criterionName: string;
  value: number; submitted: boolean;
};
export type BackupComment = { judgeName: string; teamName: string; text: string };
export type ScoresBackup = {
  scores: BackupScore[];
  comments: BackupComment[];
};

/**
 * Ảnh chụp toàn bộ điểm trước khi xoá, để người bấm reset tải về máy.
 *
 * Cố ý xuất TÊN chứ không phải id: file này tồn tại để người ta đọc và nhập lại
 * bằng tay khi có sự cố, mà id cuid thì sau khi xoá không còn trỏ tới đâu cả.
 */
export async function exportScores(): Promise<ScoresBackup> {
  const [scores, comments] = await Promise.all([
    prisma.score.findMany({
      select: {
        value: true, submitted: true,
        judge: { select: { name: true } },
        team: { select: { name: true } },
        criterion: { select: { name: true, order: true } },
      },
    }),
    prisma.scoreComment.findMany({
      select: { text: true, judge: { select: { name: true } }, team: { select: { name: true } } },
    }),
  ]);

  return {
    scores: scores
      .sort((a, b) =>
        a.team.name.localeCompare(b.team.name) ||
        a.judge.name.localeCompare(b.judge.name) ||
        a.criterion.order - b.criterion.order)
      .map((s) => ({
        judgeName: s.judge.name, teamName: s.team.name, criterionName: s.criterion.name,
        value: s.value, submitted: s.submitted,
      })),
    comments: comments.map((c) => ({
      judgeName: c.judge.name, teamName: c.team.name, text: c.text,
    })),
  };
}

export type ResetCounts = { scores: number; comments: number; unrevealed: number };

/**
 * Xoá trong MỘT transaction: một sự kiện dở dang — điểm đã bay mà board vẫn còn
 * chiếu đội cũ — là trạng thái không ai gỡ được giữa lúc chạy chương trình.
 */
export async function resetScores(): Promise<ResetCounts> {
  const [comments, scores, teams] = await prisma.$transaction([
    prisma.scoreComment.deleteMany(),
    prisma.score.deleteMany(),
    prisma.team.updateMany({ where: { revealedAt: { not: null } }, data: { revealedAt: null } }),
  ]);

  // Hai sự kiện riêng: board đang mở cần quay về màn chờ, còn các tab admin đang
  // mở cần bỏ bảng điểm cũ trong bộ nhớ đi.
  broadcast('reveal', { reset: true });
  broadcast('update', { reason: 'reset' });

  return { scores: scores.count, comments: comments.count, unrevealed: teams.count };
}
