import { prisma } from '@/lib/db';
export function getJudgeScores(judgeId:string, teamId:string) {
  return prisma.score.findMany({ where:{ judgeId, teamId } });
}

export const COMMENT_MAX = 2000;

/** Nhận xét của CHÍNH giám khảo này cho đội này. Trả '' khi chưa có — người gọi
 *  không phải phân biệt null với chuỗi rỗng. */
export async function getJudgeComment(judgeId:string, teamId:string): Promise<string> {
  const row = await prisma.scoreComment.findUnique({
    where:{ judgeId_teamId:{ judgeId, teamId } }, select:{ text:true },
  });
  return row?.text ?? '';
}

/** `undefined` nghĩa là lần lưu này không đụng tới nhận xét — hợp lệ. */
export function validateComment(comment: unknown): string | null {
  if (comment === undefined || comment === null) return null;
  if (typeof comment !== 'string') return 'nhận xét phải là chuỗi ký tự';
  if (comment.length > COMMENT_MAX) return `nhận xét tối đa ${COMMENT_MAX} ký tự`;
  return null;
}
export function validateScoreValues(
  values:{ criterionId:string; value:number }[],
  maxById:Record<string,number>,
): string | null {
  if (!Array.isArray(values) || values.length === 0) return 'values must be a non-empty array';
  for (const v of values) {
    if (!v || typeof v.criterionId !== 'string' || !v.criterionId) return 'each value requires a criterionId';
    if (!Object.prototype.hasOwnProperty.call(maxById, v.criterionId)) return `unknown criterionId: ${v.criterionId}`;
    const max = maxById[v.criterionId];
    if (typeof v.value !== 'number' || !Number.isFinite(v.value)) return `value for ${v.criterionId} must be a finite number`;
    if (v.value < 0) return `value for ${v.criterionId} must be >= 0`;
    if (v.value > max) return `value for ${v.criterionId} must be <= ${max}`;
  }
  return null;
}
export async function upsertScores(
  judgeId:string, teamId:string,
  values:{ criterionId:string; value:number }[], submitted:boolean,
  comment?: string,
) {
  const ops: any[] = values.map(v =>
    prisma.score.upsert({
      where:{ judgeId_teamId_criterionId:{ judgeId, teamId, criterionId:v.criterionId } },
      update:{ value:v.value, submitted },
      create:{ judgeId, teamId, criterionId:v.criterionId, value:v.value, submitted },
    })
  );
  // Nhận xét đi CÙNG transaction với điểm: không bao giờ có cảnh điểm đã lưu mà
  // nhận xét rớt, hoặc ngược lại.
  if (comment !== undefined) {
    const text = comment.trim();
    ops.push(text
      // Xoá trắng thì gỡ hẳn dòng, không lưu chuỗi rỗng — 'chưa nhận xét' và
      // 'nhận xét rỗng' là cùng một trạng thái, đừng để DB có hai cách biểu diễn.
      ? prisma.scoreComment.upsert({
          where:{ judgeId_teamId:{ judgeId, teamId } },
          update:{ text },
          create:{ judgeId, teamId, text },
        })
      : prisma.scoreComment.deleteMany({ where:{ judgeId, teamId } }));
  }
  await prisma.$transaction(ops);
}
export type SaveResult = { ok: true } | { ok: false; error: 'locked' };

/** Một phiếu bị khoá khi giám khảo đã bấm Nộp cho đội đó. Lưu nháp không khoá. */
export async function isCardLocked(judgeId: string, teamId: string): Promise<boolean> {
  const n = await prisma.score.count({ where: { judgeId, teamId, submitted: true } });
  return n > 0;
}

/**
 * Chốt khoá nằm ở TẦNG NÀY chứ không chỉ ở giao diện: giao diện có disable nút mà
 * API vẫn nhận ghi thì phiếu không hề bị khoá — chỉ cần một lệnh curl là sửa được.
 */
export async function saveScoreCard(
  judgeId: string, teamId: string,
  values: { criterionId: string; value: number }[], submitted: boolean,
  comment?: string,
): Promise<SaveResult> {
  if (await isCardLocked(judgeId, teamId)) return { ok: false, error: 'locked' };
  await upsertScores(judgeId, teamId, values, submitted, comment);
  return { ok: true };
}

/** Mở khoá GIỮ NGUYÊN điểm đã nhập — chỉ bỏ cờ submitted để giám khảo sửa lại.
 *  Trả về số dòng vừa mở khoá (0 nghĩa là phiếu vốn chưa nộp). */
export async function unlockCard(judgeId: string, teamId: string): Promise<number> {
  const r = await prisma.score.updateMany({
    where: { judgeId, teamId, submitted: true },
    data: { submitted: false },
  });
  return r.count;
}

// Team ids the given judge has already SUBMITTED (used to mark done teams in the judge UI).
export async function judgeSubmittedTeamIds(judgeId: string): Promise<string[]> {
  const rows = await prisma.score.findMany({
    where: { judgeId, submitted: true },
    select: { teamId: true },
    distinct: ['teamId'],
  });
  return rows.map((r) => r.teamId);
}

export type JudgeScoreStatus = 'submitted' | 'draft' | 'none';
export type JudgeScoreRow = {
  teamId: string; teamName: string; teamCode: string;
  values: Record<string, number>;   // criterionId -> value, missing key = not scored
  total: number | null;             // null when the judge has not scored this team at all
  status: JudgeScoreStatus;
  comment: string;                  // '' khi giám khảo chưa nhận xét đội này
};

// Every team crossed with one judge's card, for the admin detail popup. Teams the
// judge never opened are still returned (status 'none') so the admin can see the
// gaps, not just what was filled in.
export async function judgeScoreDetail(judgeId: string): Promise<{
  criteria: { id: string; name: string; maxScore: number; order: number }[];
  rows: JudgeScoreRow[];
}> {
  const [criteria, teams, scores, comments] = await Promise.all([
    prisma.criterion.findMany({
      orderBy: { order: 'asc' },
      select: { id: true, name: true, maxScore: true, order: true },
    }),
    prisma.team.findMany({ orderBy: { createdAt: 'asc' }, select: { id: true, name: true, code: true } }),
    prisma.score.findMany({
      where: { judgeId },
      select: { teamId: true, criterionId: true, value: true, submitted: true },
    }),
    prisma.scoreComment.findMany({ where: { judgeId }, select: { teamId: true, text: true } }),
  ]);
  const commentByTeam: Record<string, string> = {};
  for (const c of comments) commentByTeam[c.teamId] = c.text;

  const rows = teams.map((team) => {
    const mine = scores.filter((s) => s.teamId === team.id);
    const values: Record<string, number> = {};
    for (const s of mine) values[s.criterionId] = s.value;
    const total = mine.length
      ? Math.round(mine.reduce((a, s) => a + s.value, 0) * 10) / 10
      : null;
    // A card counts as submitted only when every row the judge saved is flagged —
    // a partial save leaves it a draft.
    const status: JudgeScoreStatus =
      mine.length === 0 ? 'none' : mine.every((s) => s.submitted) ? 'submitted' : 'draft';
    return {
      teamId: team.id, teamName: team.name, teamCode: team.code, values, total, status,
      comment: commentByTeam[team.id] ?? '',
    };
  });

  return { criteria, rows };
}

export type MatrixCell = { judgeId: string; total: number | null; status: JudgeScoreStatus };
export type MatrixRow = {
  teamId: string; teamName: string; teamCode: string;
  cells: MatrixCell[]; total: number | null;
};

/**
 * Bảng đội × giám khảo, TÊN THẬT. Đây là view sau đăng nhập của ban giám khảo và
 * ban tổ chức — việc ẩn tên chỉ áp dụng cho board công khai (xem lib/judge-label.ts).
 *
 * Sắp đội theo createdAt, KHÔNG theo hạng: đây là bảng đối chiếu phiếu chấm, thứ
 * tự phải ổn định giữa các lần mở, không nhảy mỗi khi có người nộp điểm.
 */
export async function scoreMatrix(viewerId: string): Promise<{
  judges: { id: string; name: string; isHead: boolean; isMe: boolean }[];
  rows: MatrixRow[];
}> {
  const [judges, teams, scores] = await Promise.all([
    prisma.user.findMany({
      where: { role: 'judge' }, orderBy: { createdAt: 'asc' },
      select: { id: true, name: true, isHead: true },
    }),
    prisma.team.findMany({ orderBy: { createdAt: 'asc' }, select: { id: true, name: true, code: true } }),
    prisma.score.findMany({ select: { judgeId: true, teamId: true, value: true, submitted: true } }),
  ]);

  const rows: MatrixRow[] = teams.map((team) => {
    const cells: MatrixCell[] = judges.map((j) => {
      const mine = scores.filter((s) => s.teamId === team.id && s.judgeId === j.id);
      if (mine.length === 0) return { judgeId: j.id, total: null, status: 'none' };
      const total = Math.round(mine.reduce((a, s) => a + s.value, 0) * 10) / 10;
      return { judgeId: j.id, total, status: mine.every((s) => s.submitted) ? 'submitted' : 'draft' };
    });
    const scored = cells.filter((c) => c.total !== null).map((c) => c.total!);
    return {
      teamId: team.id, teamName: team.name, teamCode: team.code, cells,
      total: scored.length ? Math.round(scored.reduce((a, b) => a + b, 0) * 10) / 10 : null,
    };
  });

  return { judges: judges.map((j) => ({ ...j, isMe: j.id === viewerId })), rows };
}

// Returns the (judge, team) pairs a judge has SUBMITTED. Uses distinct instead of
// groupBy(_max: boolean) because Postgres has no max(boolean) aggregate.
export async function judgeProgress() {
  const rows = await prisma.score.findMany({
    where: { submitted: true },
    select: { judgeId: true, teamId: true },
    distinct: ['judgeId', 'teamId'],
  });
  return rows.map(r => ({ judgeId: r.judgeId, teamId: r.teamId, submitted: true }));
}
