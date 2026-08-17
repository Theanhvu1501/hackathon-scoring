'use client';
import { useEffect, useState } from 'react';
import { fetcher } from '@/lib/ui';

const STATE_LABEL: Record<string, string> = {
  waiting: 'Chưa công bố',
  ranks: 'Đang công bố',
  judges: 'Đã công bố điểm BGK',
};

export default function Results() {
  const [data, setData] = useState<any>(null);
  // /api/results/all: ban giám khảo thấy đủ đội, kể cả đội chưa được công bố
  // trên board — họ cần đối chiếu, còn bộ lọc kia chỉ để giữ kín với khán giả.
  async function load() { setData(await fetcher('/api/results/all')); }
  useEffect(() => {
    load();
    const es = new EventSource('/api/stream');
    es.addEventListener('reveal', load);
    es.addEventListener('update', load);
    return () => es.close();
  }, []);
  if (!data) return <div>Đang tải…</div>;

  return (<>
    <div className="page-head" style={{ justifyContent: 'flex-end' }}>
      <span className={'pill ' + (data.state === 'judges' ? 'live' : 'pending')}>
        {STATE_LABEL[data.state] ?? data.state}
      </span>
    </div>
    <div className="card"><table>
      <thead>
        <tr>
          <th>#</th><th>Đội</th>
          <th style={{ textAlign: 'right' }}>Tổng điểm</th>
          <th style={{ textAlign: 'right' }}>Trên board</th>
        </tr>
      </thead>
      <tbody>{data.rows.map((r: any) => (
        <tr key={r.team.id}>
          <td className="tnum">{r.tie ? 'T' + r.rank : r.rank}</td>
          <td>
            <div className="tcell">
              <span className="team-ava" style={{ background: 'linear-gradient(135deg,#f37021,#ff9730)' }}>{r.team.code}</span>
              <b>{r.team.name}</b>
            </div>
          </td>
          <td style={{ textAlign: 'right' }}>
            <b className="tnum" style={{ color: 'var(--orange-lt)' }}>
              {r.score === null ? '—' : r.score.toFixed(1)}
            </b>
          </td>
          <td style={{ textAlign: 'right' }}>
            <span className={'pill ' + (r.revealed ? 'done' : 'pending')}>
              {r.revealed ? 'Đã công bố' : 'Chưa'}
            </span>
          </td>
        </tr>
      ))}</tbody>
    </table></div>
  </>);
}
