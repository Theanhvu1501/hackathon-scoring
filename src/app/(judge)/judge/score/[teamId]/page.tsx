'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetcher } from '@/lib/ui';
export default function Score({ params }:{ params:{ teamId:string } }) {
  const [crits,setCrits]=useState<any[]>([]); const [vals,setVals]=useState<Record<string,number>>({});
  const [team,setTeam]=useState<any>(null); const router=useRouter();
  useEffect(()=>{ (async()=>{
    const [c, teams, existing] = await Promise.all([
      fetcher('/api/criteria'), fetcher('/api/teams'), fetcher('/api/scores?teamId='+params.teamId),
    ]);
    setCrits(c); setTeam(teams.find((t:any)=>t.id===params.teamId));
    const map:Record<string,number>={}; existing.forEach((s:any)=>map[s.criterionId]=s.value); setVals(map);
  })(); },[params.teamId]);
  const total = crits.reduce((a,c)=>a+(vals[c.id]||0),0);
  const maxTotal = crits.reduce((a,c)=>a+c.maxScore,0);
  async function save(submitted:boolean){
    const values = crits.map(c=>({criterionId:c.id, value: Math.min(c.maxScore, vals[c.id]||0)}));
    await fetcher('/api/scores',{method:'POST',body:JSON.stringify({teamId:params.teamId, values, submitted})});
    if(submitted) router.push('/judge');
  }
  if(!team) return <div>Đang tải…</div>;
  return (<>
    <div className="page-head"><div><div className="page-title">Chấm điểm · {team.name}</div></div></div>
    <div className="card card-pad" style={{maxWidth:720}}>
      {crits.map(c=>(<div className="crit" key={c.id}>
        <div><div className="crit-name">{c.name} <span className="crit-max">/ {c.maxScore}đ</span></div><div className="crit-desc">{c.description}</div></div>
        <div className="score-in"><input className="input" style={{width:80}} type="number" step="0.5" min={0} max={c.maxScore}
          value={vals[c.id] ?? ''} onChange={e=>setVals({...vals,[c.id]:Number(e.target.value)})}/><span>/ {c.maxScore}</span></div>
      </div>))}
      <div className="total-box"><span className="tl">TỔNG ĐIỂM CỦA BẠN</span><span className="tv tnum">{total.toFixed(1)}<small>/{maxTotal}</small></span></div>
      <div style={{display:'flex',gap:10,marginTop:18}}>
        <button className="btn" style={{flex:1,justifyContent:'center'}} onClick={()=>save(false)}>Lưu nháp</button>
        <button className="btn btn-primary" style={{flex:1,justifyContent:'center'}} onClick={()=>save(true)}>Nộp điểm đội này</button>
      </div>
    </div>
  </>);
}
