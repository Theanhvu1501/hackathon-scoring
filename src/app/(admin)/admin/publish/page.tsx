'use client';
import { useEffect, useState } from 'react';
import { fetcher } from '@/lib/ui';
const STEPS=[{k:'drafting',n:'1',t:'Đang chấm'},{k:'provisional',n:'2',t:'Điểm tạm'},{k:'final',n:'3',t:'Chung cuộc'}];
export default function Publish() {
  const [state,setState]=useState('drafting');
  async function load(){ setState((await fetcher('/api/reveal')).state); }
  useEffect(()=>{ load(); },[]);
  async function set(s:string){ await fetcher('/api/reveal',{method:'POST',body:JSON.stringify({state:s})}); setState(s); }
  const idx=STEPS.findIndex(s=>s.k===state);
  return (<>
    <div className="page-head"><div><div className="eyebrow">Admin CMS</div><div className="page-title">Điều khiển công bố</div></div></div>
    <div className="stepper">{STEPS.map((s,i)=>(<div key={s.k} className={'step '+(i===idx?'active':'')+(i<idx?' done':'')}>
      <div className="step-n">{i<idx?'✓':s.n}</div><h4>{s.t}</h4></div>))}</div>
    <div className="card card-pad" style={{marginTop:20}}>
      {state==='drafting' && <button className="btn btn-primary" style={{width:'100%',justifyContent:'center',padding:12}} onClick={()=>set('provisional')}>▶ Mở bảng điểm tạm (realtime)</button>}
      {state==='provisional' && <>
        <div className="note" style={{marginBottom:16}}><span>◉</span><div><b style={{color:'var(--text)'}}>Đang chiếu điểm tạm.</b> Điểm Trưởng BGK đang giữ kín.</div></div>
        <button className="btn btn-primary" style={{width:'100%',justifyContent:'center',padding:14,fontSize:15}} onClick={()=>set('final')}>♛ LỘ ĐIỂM TRƯỞNG BGK & CHỐT KẾT QUẢ</button>
        <button className="btn btn-ghost btn-sm" style={{width:'100%',justifyContent:'center',marginTop:10}} onClick={()=>set('drafting')}>← Quay lui về màn chờ</button>
      </>}
      {state==='final' && <>
        <div className="note" style={{marginBottom:16}}><span style={{color:'var(--green)'}}>✓</span><div><b style={{color:'var(--text)'}}>Đã công bố chung cuộc.</b></div></div>
        <a className="btn btn-primary" style={{width:'100%',justifyContent:'center',padding:12}} href="/board" target="_blank">Xem bảng công khai →</a>
        <button className="btn btn-ghost btn-sm" style={{width:'100%',justifyContent:'center',marginTop:10}} onClick={()=>set('provisional')}>← Quay lui (mở lại để sửa)</button>
      </>}
    </div>
  </>);
}
