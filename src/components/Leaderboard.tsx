'use client';
export default function Leaderboard({ rows, phase, baremTotal }:{ rows:any[]; phase:string; baremTotal:number }) {
  return (<div className="lb">{rows.map((r,i)=>(
    <div className={'row '+(r.rank===1&&phase==='final'?'leader ':'')+(r.rank<=3?'top3':'')} key={r.team.id}>
      <div className="rk"><span className="rk-num tnum">{r.tie?'T'+r.rank:r.rank}</span></div>
      <div className="r-team"><span className="r-logo" style={{background:r.team.logoUrl?'var(--navy-950)':'var(--orange)',padding:0,overflow:'hidden'}}>
        {r.team.logoUrl ? <img src={r.team.logoUrl} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/> : r.team.code}</span>
        <div style={{minWidth:0}}><div className="r-name">{r.team.name}</div><div className="r-tag">{r.team.tag}</div></div></div>
      <div className="r-score"><div><span className="sc tnum">{r.score===null?'—':r.score.toFixed(1)}</span><span className="of"> /{baremTotal}</span></div></div>
    </div>
  ))}</div>);
}
