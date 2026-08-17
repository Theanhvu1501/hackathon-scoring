'use client';
import { useEffect, useState } from 'react';
import { fetcher } from '@/lib/ui';

type Cell = { judgeId: string; total: number | null; status: 'submitted' | 'draft' | 'none' };
type Row = { teamId: string; teamName: string; teamCode: string; cells: Cell[]; total: number | null };
type Matrix = { judges: { id: string; name: string; isHead: boolean; isMe: boolean }[]; rows: Row[] };

const CELL_TITLE: Record<Cell['status'], string> = {
  submitted: 'Đã nộp', draft: 'Phiếu nháp, chưa nộp', none: 'Chưa chấm',
};

export default function JudgeScores() {
  const [d, setD] = useState<Matrix | null>(null);

  useEffect(() => {
    const load = () => fetcher<Matrix>('/api/scores/matrix').then(setD);
    load();
    const es = new EventSource('/api/stream');
    es.addEventListener('update', load);
    return () => es.close();
  }, []);

  if (!d) return <div>Đang tải…</div>;

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-title">Điểm ban giám khảo</div>
          <small style={{ color: 'var(--muted-2)' }}>
            Tổng điểm mỗi giám khảo chấm cho từng đội. Ô mờ là phiếu còn nháp, chưa nộp.
          </small>
        </div>
      </div>

      <div className="card">
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Đội</th>
                {d.judges.map((j) => (
                  <th key={j.id} style={{ textAlign: 'center', whiteSpace: 'nowrap',
                    color: j.isMe ? 'var(--orange-lt)' : undefined }}>
                    {j.name}
                    {j.isHead && <small style={{ display: 'block', fontWeight: 400, color: 'var(--muted-2)' }}>Trưởng BGK</small>}
                    {j.isMe && <small style={{ display: 'block', fontWeight: 400 }}>bạn</small>}
                  </th>
                ))}
                <th style={{ textAlign: 'right' }}>Tổng đội</th>
              </tr>
            </thead>
            <tbody>
              {d.rows.map((r) => (
                <tr key={r.teamId}>
                  <td><b>{r.teamName}</b> <span className="code-chip">{r.teamCode}</span></td>
                  {r.cells.map((c) => (
                    <td key={c.judgeId} className="tnum" title={CELL_TITLE[c.status]}
                      style={{ textAlign: 'center', opacity: c.status === 'draft' ? .5 : 1 }}>
                      {c.total === null ? '—' : c.total.toFixed(1)}
                    </td>
                  ))}
                  <td className="tnum" style={{ textAlign: 'right' }}>
                    <b style={{ color: 'var(--orange-lt)' }}>{r.total === null ? '—' : r.total.toFixed(1)}</b>
                  </td>
                </tr>
              ))}
              {d.rows.length === 0 && (
                <tr><td colSpan={d.judges.length + 2}><div className="empty-row">Chưa có đội nào</div></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
