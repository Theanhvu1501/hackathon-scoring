'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { fetcher } from '@/lib/ui';
export default function JudgeTeams() {
  const [teams,setTeams]=useState<any[]>([]);
  useEffect(()=>{ fetcher('/api/teams').then(setTeams); },[]);
  return (<>
    <div className="page-head"><div><div className="eyebrow" style={{color:'var(--cyan)'}}>Ban giám khảo</div><div className="page-title">Danh sách đội thi</div>
      <div className="page-desc">Chọn đội để xem hồ sơ và chấm điểm. Bạn chỉ thấy điểm của mình cho tới khi công bố.</div></div></div>
    <div className="grid" style={{gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))'}}>
      {teams.map(t=>(<Link key={t.id} href={'/judge/score/'+t.id} className="card card-pad" style={{cursor:'pointer'}}>
        <div className="tcell"><span className="team-ava" style={{background:'linear-gradient(135deg,#2563eb,#00d4ff)'}}>{t.code}</span>
        <div><b style={{fontFamily:'Space Grotesk',fontSize:16}}>{t.name}</b><small style={{display:'block',color:'var(--muted-2)'}}>{t.members?.length||0} thành viên</small></div></div>
        <p style={{fontSize:12.5,color:'var(--muted)',marginTop:14}}>{t.tag}</p>
      </Link>))}
    </div>
  </>);
}
