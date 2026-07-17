'use client';
import { useEffect, useState } from 'react';
import { fetcher } from '@/lib/ui';
import Podium from '@/components/Podium';
import Leaderboard from '@/components/Leaderboard';
export default function Board() {
  const [data,setData]=useState<any>(null);
  async function load(){ setData(await fetcher('/api/results')); }
  useEffect(()=>{ load();
    const es=new EventSource('/api/stream');
    es.addEventListener('reveal',load); es.addEventListener('update',load);
    return ()=>es.close();
  },[]);
  if(!data) return <div className="public-stage"/>;
  if(data.state==='drafting') return (
    <div className="wait-stage"><div className="wait-inner">
      <div className="wait-badge">A</div>
      <div className="eyebrow" style={{textAlign:'center',color:'var(--cyan)'}}>Automotive Hackathon 2026 · Chung kết</div>
      <h1 className="wait-title">Kết quả sắp được <span>công bố</span></h1>
      <p className="wait-desc">Ban giám khảo đang hoàn tất chấm điểm.</p>
      <div className="dots-live"><i></i> ĐANG CHỜ TÍN HIỆU CÔNG BỐ</div>
    </div></div>
  );
  const phase = data.state;
  return (
    <div className="public-stage">
      <div className="pub-head"><div>
        <div className="eyebrow" style={{color:'var(--cyan)'}}>Vòng chung kết · Bảng xếp hạng trực tiếp</div>
        <div className="pub-title">Automotive <span>Hackathon</span> 2026</div>
      </div><span className="pill live" style={{fontSize:13,padding:'8px 16px'}}>{phase==='final'?'● CHUNG CUỘC':'● ĐIỂM TẠM · LIVE'}</span></div>
      {phase==='provisional' && (
        <div className="prov-banner"><span className="pb-ic">⏳</span>
          <div><b>ĐIỂM TẠM — chưa có điểm Trưởng Ban giám khảo</b><p>Bảng cập nhật realtime theo từng giám khảo.</p></div>
          <span className="prov-tag">4/5 GIÁM KHẢO</span></div>
      )}
      {phase==='final' && <Podium rows={data.rows} baremTotal={data.baremTotal} />}
      <Leaderboard rows={data.rows} phase={phase} baremTotal={data.baremTotal} />
    </div>
  );
}
