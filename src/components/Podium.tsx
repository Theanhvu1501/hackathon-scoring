'use client';
export default function Podium({ rows, baremTotal }:{ rows:any[]; baremTotal:number }) {
  const top = rows.filter(r => r.score !== null).slice(0,3);
  const order = [top[1], top[0], top[2]]; const cls=['pod-2','pod-1','pod-3']; const medal=['2','1','3'];
  return (<div className="podium">{order.map((t,i)=>(
    <div className={'pod '+cls[i]} key={i}>{t ? <>
      <div className="pod-body">
        {cls[i]==='pod-1' && <div className="pod-crown">👑</div>}
        <div className="pod-medal">{medal[i]}</div>
        <div className="pod-logo" style={{background:'linear-gradient(135deg,#f37021,#ff9730)'}}>{t.team.code}</div>
        <div className="pod-name">{t.team.name}</div>
        <div className="pod-tag">{t.team.tag}</div>
        <div className="pod-score tnum">{t.score?.toFixed(1)}<small> /{baremTotal}</small></div>
      </div>
      <div className="pod-riser"></div>
    </> : null}</div>
  ))}</div>);
}
