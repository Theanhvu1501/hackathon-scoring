import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { audit } from '@/lib/audit';
import {
  getJudgeComment, getJudgeScores, isCardLocked, saveScoreCard,
  validateComment, validateScoreValues,
} from '@/lib/services/scores';
import { broadcast } from '@/lib/events';
import { prisma } from '@/lib/db';

export async function GET(req: Request) {
  const u = await requireRole('judge');
  if (!u) return NextResponse.json({ error:'forbidden' }, { status:403 });
  const teamId = new URL(req.url).searchParams.get('teamId');
  if (!teamId) return NextResponse.json({ error:'teamId required' }, { status:400 });
  // u.id, KHÔNG phải judgeId lấy từ query: giám khảo chỉ đọc được phiếu và nhận
  // xét của chính mình, không có tham số nào để trỏ sang người khác.
  return NextResponse.json({
    scores: await getJudgeScores(u.id, teamId),
    comment: await getJudgeComment(u.id, teamId),
    locked: await isCardLocked(u.id, teamId),
  });
}

export async function POST(req: Request) {
  const u = await requireRole('judge');
  if (!u) return NextResponse.json({ error:'forbidden' }, { status:403 });
  const { teamId, values, submitted, comment } = await req.json();
  if (typeof teamId !== 'string' || !teamId || !Array.isArray(values)) {
    return NextResponse.json({ error:'teamId and values required' }, { status:400 });
  }
  const criteria = await prisma.criterion.findMany({ select:{ id:true, maxScore:true } });
  const maxById: Record<string, number> = Object.fromEntries(criteria.map(c => [c.id, c.maxScore]));
  const validationError = validateScoreValues(values, maxById) ?? validateComment(comment);
  if (validationError) return NextResponse.json({ error: validationError }, { status:400 });

  const r = await saveScoreCard(u.id, teamId, values, !!submitted, comment ?? undefined);
  if (!r.ok) {
    return NextResponse.json(
      { error: 'Phiếu chấm đội này đã nộp và bị khoá. Liên hệ ban tổ chức nếu cần sửa.' },
      { status: 409 },
    );
  }

  const team = await prisma.team.findUnique({ where:{ id:teamId }, select:{ name:true } });
  const total = values.reduce((a: number, v: any) => a + v.value, 0);
  await audit(u, submitted ? 'score.submit' : 'score.save', {
    entity:'score', entityId:`${u.id}:${teamId}`, target:team?.name ?? teamId,
    detail:`tổng ${Math.round(total * 10) / 10}${(comment ?? '').trim() ? ' · có nhận xét' : ''}`,
  });
  broadcast('update', { reason:'score', teamId });
  return NextResponse.json({ ok:true });
}
