'use client';
import { useEffect, useState } from 'react';
import { fetcher } from '@/lib/ui';
export default function Results() {
  const [data,setData]=useState<any>(null);
  async function load(){ setData(await fetcher('/api/results')); }
  useEffect(()=>{ load(); const es=new EventSource('/api/stream');
    es.addEventListener('reveal',load); es.addEventListener('update',load); return ()=>es.close(); },[]);
  if(!data) return <div>Đang tải…</div>;
  return (<>
    <div className="page-head"><div><div className="eyebrow" style={{color:'var(--cyan)'}}>Ban giám khảo</div><div className="page-title">Kết quả các đội</div>
      <div className="page-desc">{data.state==='final'?'Đã công bố chung cuộc.':'Điểm tạm (chưa có Trưởng BGK).'}</div></div></div>
    <div className="card"><table>
      <thead><tr><th>#</th><th>Đội</th><th style={{textAlign:'right'}}>Điểm TB</th></tr></thead>
      <tbody>{data.rows.map((r:any)=>(<tr key={r.team.id}>
        <td className="tnum">{r.tie?'T'+r.rank:r.rank}</td>
        <td><div className="tcell"><span className="team-ava" style={{background:'linear-gradient(135deg,#f37021,#ff9730)'}}>{r.team.code}</span><b>{r.team.name}</b></div></td>
        <td style={{textAlign:'right'}}><b className="tnum" style={{color:'var(--orange-lt)'}}>{r.score===null?'—':r.score.toFixed(1)}</b></td>
      </tr>))}</tbody>
    </table></div>
  </>);
}
