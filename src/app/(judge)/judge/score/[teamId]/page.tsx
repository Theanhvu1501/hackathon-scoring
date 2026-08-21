'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { fetcher } from '@/lib/ui';
import { useConfirm } from '@/components/ConfirmProvider';
import { parseScoreInput, formatScoreInput } from '@/lib/score-input';

type Crit = { id: string; name: string; description?: string | null; maxScore: number };

const COMMENT_MAX = 2000;

export default function Score({ params }: { params: { teamId: string } }) {
  const [crits, setCrits] = useState<Crit[]>([]);
  // Giữ ĐÚNG chữ giám khảo gõ, không phải số đã diễn giải: có vậy ô mới trống
  // được, và số vượt trần mới hiện nguyên như người ta nhập để mà báo đỏ.
  const [raw, setRaw] = useState<Record<string, string>>({});
  const [comment, setComment] = useState('');
  const [team, setTeam] = useState<any>(null);
  const [locked, setLocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const router = useRouter();
  const confirm = useConfirm();

  useEffect(() => { (async () => {
    const [c, teams, mine] = await Promise.all([
      fetcher<Crit[]>('/api/criteria'),
      fetcher<any[]>('/api/teams'),
      fetcher<{ scores: any[]; comment: string; locked: boolean }>('/api/scores?teamId=' + params.teamId),
    ]);
    setCrits(c);
    setTeam(teams.find((t) => t.id === params.teamId));
    setLocked(mine.locked);
    setComment(mine.comment || '');
    const map: Record<string, string> = {};
    mine.scores.forEach((s) => { map[s.criterionId] = String(s.value); });
    setRaw(map);
  })(); }, [params.teamId]);

  const fields = crits.map((c) => ({ c, p: parseScoreInput(raw[c.id] ?? '', c.maxScore) }));
  const total = fields.reduce((a, f) => a + (f.p.kind === 'ok' ? f.p.value : 0), 0);
  const maxTotal = crits.reduce((a, c) => a + c.maxScore, 0);
  const hasError = fields.some((f) => f.p.kind === 'error');
  const emptyCount = fields.filter((f) => f.p.kind === 'empty').length;

  async function save(submitted: boolean) {
    if (hasError) return;
    // Ô trống vẫn nộp được — có đội thực sự đáng 0 điểm ở một tiêu chí. Nhưng
    // phiếu đã nộp thì không tự sửa lại được, nên bỏ sót do vô ý phải bị chặn
    // lại một nhịp ở đây thay vì phát hiện ra lúc đã khoá.
    if (submitted && !(await confirm({
      title: 'Nộp điểm · ' + team.name,
      message: `Sau khi nộp, bạn KHÔNG thể sửa điểm đội này nữa — chỉ ban tổ chức mới mở khoá được. `
             + `Tổng điểm bạn chấm: ${total.toFixed(1)}/${maxTotal}. `
             + (emptyCount ? `Còn ${emptyCount} tiêu chí chưa nhập, sẽ tính 0 điểm. ` : '')
             + `Xác nhận nộp?`,
      confirmText: 'Nộp điểm',
    }))) return;

    setBusy(true); setErr('');
    try {
      const values = fields.map((f) => ({
        criterionId: f.c.id, value: f.p.kind === 'ok' ? f.p.value : 0,
      }));
      await fetcher('/api/scores', {
        method: 'POST',
        body: JSON.stringify({ teamId: params.teamId, values, submitted, comment }),
      });
      if (submitted) router.push('/judge');
    } catch (e: any) {
      // 409 nghĩa là phiếu đã bị khoá ở đâu đó khác — khoá luôn giao diện cho khớp.
      setErr(e.message);
      setLocked(true);
    } finally { setBusy(false); }
  }

  if (!team) return <div className="loading-box"><span className="spin-lg" />Đang tải…</div>;

  return (
    <>
      <div className="page-head">
        <div className="page-title">Chấm điểm · {team.name}</div>
        <Link className="btn btn-sm" href={'/judge/team/' + team.id}>Xem thông tin đội</Link>
      </div>

      {locked && (
        <div className="note" style={{ marginBottom: 16, maxWidth: 720 }}>
          <span style={{ color: 'var(--green)' }}>✓</span>
          <div>
            <b style={{ color: 'var(--text)' }}>Phiếu đã nộp — không thể sửa.</b>{' '}
            Nếu cần chấm lại, đề nghị ban tổ chức mở khoá phiếu này.
          </div>
        </div>
      )}
      {err && (
        <div className="note" style={{ marginBottom: 16, maxWidth: 720 }}>
          <span>!</span><div>{err}</div>
        </div>
      )}

      <div className="card card-pad" style={{ maxWidth: 720 }}>
        {fields.map(({ c, p }) => (
          <div className="crit" key={c.id}>
            <div>
              <div className="crit-name">{c.name} <span className="crit-max">/ {c.maxScore}đ</span></div>
              <div className="crit-desc">{c.description}</div>
            </div>
            <div className="score-in">
              <div className="score-in-row">
                {/* Ô text chứ không phải type=number: nút mũi tên của ô number
                    khiến cuộn chuột ngang qua là đổi điểm, và mỗi trình duyệt
                    hiển thị số thập phân một kiểu theo locale.
                    Bấm vào ô là bôi đen sẵn số cũ: chấm điểm là THAY số chứ không
                    phải sửa vài ký tự, mà đặt con trỏ cuối số 8 rồi gõ 10 thì ra
                    "810". Gõ là đè, không phải chèn thêm. */}
                <input
                  className={'input' + (p.kind === 'error' ? ' is-bad' : '')}
                  type="text" inputMode="decimal" placeholder="—"
                  disabled={locked}
                  value={raw[c.id] ?? ''}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setRaw({ ...raw, [c.id]: e.target.value })}
                  onBlur={() => setRaw({ ...raw, [c.id]: formatScoreInput(raw[c.id] ?? '', c.maxScore) })}
                />
                <span>/ {c.maxScore}</span>
              </div>
              {p.kind === 'error' && <small className="score-err">{p.message}</small>}
            </div>
          </div>
        ))}

        <div className="total-box">
          <span className="tl">TỔNG ĐIỂM CỦA BẠN</span>
          <span className="tv tnum">{total.toFixed(1)}<small>/{maxTotal}</small></span>
        </div>

        <div className="field" style={{ marginTop: 18, marginBottom: 0 }}>
          <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span>Nhận xét của bạn <span className="crit-max">(không bắt buộc)</span></span>
            {!locked && (
              <small style={{ color: comment.length > COMMENT_MAX ? 'var(--red, #c0392b)' : 'var(--muted-2)' }}>
                {comment.length}/{COMMENT_MAX}
              </small>
            )}
          </label>
          {locked
            ? <div className="comment-ro">{comment || <i style={{ color: 'var(--muted-2)' }}>Không có nhận xét.</i>}</div>
            : <textarea className="input" rows={4} maxLength={COMMENT_MAX}
                style={{ resize: 'vertical', lineHeight: 1.55 }}
                placeholder="Điểm mạnh, điểm cần cải thiện, góp ý cho đội…"
                value={comment} onChange={(e) => setComment(e.target.value)} />}
          <div className="hint">
            Chỉ bạn và ban tổ chức đọc được nhận xét này. Các giám khảo khác không xem được.
          </div>
        </div>

        {!locked && (
          <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
            <button className="btn" style={{ flex: 1, justifyContent: 'center' }}
              disabled={busy || hasError} onClick={() => save(false)}>Lưu nháp</button>
            <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }}
              disabled={busy || hasError} onClick={() => save(true)}>Nộp điểm đội này</button>
          </div>
        )}
      </div>
    </>
  );
}
