'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { fetcher } from '@/lib/ui';
import { useConfirm } from '@/components/ConfirmProvider';

type Crit = { id: string; name: string; description?: string | null; maxScore: number };

export default function Score({ params }: { params: { teamId: string } }) {
  const [crits, setCrits] = useState<Crit[]>([]);
  const [vals, setVals] = useState<Record<string, number>>({});
  const [over, setOver] = useState<Record<string, boolean>>({});
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
      fetcher<{ scores: any[]; locked: boolean }>('/api/scores?teamId=' + params.teamId),
    ]);
    setCrits(c);
    setTeam(teams.find((t) => t.id === params.teamId));
    setLocked(mine.locked);
    const map: Record<string, number> = {};
    mine.scores.forEach((s) => { map[s.criterionId] = s.value; });
    setVals(map);
  })(); }, [params.teamId]);

  const total = crits.reduce((a, c) => a + (vals[c.id] || 0), 0);
  const maxTotal = crits.reduce((a, c) => a + c.maxScore, 0);
  const hasOver = Object.values(over).some(Boolean);

  /** Kẹp ngay lúc nhập VÀ báo cho giám khảo biết. Trước đây giá trị vượt trần bị
   *  Math.min hạ xuống âm thầm lúc lưu — người chấm không hề biết điểm đã bị đổi. */
  function setVal(c: Crit, raw: string) {
    const n = Number(raw);
    if (raw === '' || Number.isNaN(n)) {
      setVals({ ...vals, [c.id]: 0 });
      setOver({ ...over, [c.id]: false });
      return;
    }
    const clamped = Math.min(c.maxScore, Math.max(0, n));
    setVals({ ...vals, [c.id]: clamped });
    setOver({ ...over, [c.id]: n > c.maxScore || n < 0 });
  }

  async function save(submitted: boolean) {
    if (hasOver) return;
    if (submitted && !(await confirm({
      title: 'Nộp điểm · ' + team.name,
      message: `Sau khi nộp, bạn KHÔNG thể sửa điểm đội này nữa — chỉ ban tổ chức mới mở khoá được. `
             + `Tổng điểm bạn chấm: ${total.toFixed(1)}/${maxTotal}. Xác nhận nộp?`,
      confirmText: 'Nộp điểm',
    }))) return;

    setBusy(true); setErr('');
    try {
      const values = crits.map((c) => ({ criterionId: c.id, value: vals[c.id] || 0 }));
      await fetcher('/api/scores', {
        method: 'POST',
        body: JSON.stringify({ teamId: params.teamId, values, submitted }),
      });
      if (submitted) router.push('/judge');
    } catch (e: any) {
      // 409 nghĩa là phiếu đã bị khoá ở đâu đó khác — khoá luôn giao diện cho khớp.
      setErr(e.message);
      setLocked(true);
    } finally { setBusy(false); }
  }

  if (!team) return <div>Đang tải…</div>;

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
        {crits.map((c) => (
          <div className="crit" key={c.id}>
            <div>
              <div className="crit-name">{c.name} <span className="crit-max">/ {c.maxScore}đ</span></div>
              <div className="crit-desc">{c.description}</div>
            </div>
            <div className="score-in">
              <input className="input" type="number" step="0.5" min={0} max={c.maxScore}
                disabled={locked}
                style={{ width: 80, borderColor: over[c.id] ? 'var(--red, #c0392b)' : undefined }}
                value={vals[c.id] ?? ''} onChange={(e) => setVal(c, e.target.value)} />
              <span>/ {c.maxScore}</span>
              {over[c.id] && (
                <small style={{ color: 'var(--red, #c0392b)', display: 'block' }}>Tối đa {c.maxScore}đ</small>
              )}
            </div>
          </div>
        ))}

        <div className="total-box">
          <span className="tl">TỔNG ĐIỂM CỦA BẠN</span>
          <span className="tv tnum">{total.toFixed(1)}<small>/{maxTotal}</small></span>
        </div>

        {!locked && (
          <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
            <button className="btn" style={{ flex: 1, justifyContent: 'center' }}
              disabled={busy || hasOver} onClick={() => save(false)}>Lưu nháp</button>
            <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }}
              disabled={busy || hasOver} onClick={() => save(true)}>Nộp điểm đội này</button>
          </div>
        )}
      </div>
    </>
  );
}
