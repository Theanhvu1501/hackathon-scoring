'use client';
import { useEffect, useState } from 'react';
import { fetcher } from '@/lib/ui';
export default function Barem() {
  const [crits,setCrits]=useState<any[]>([]); const [form,setForm]=useState({name:'',maxScore:10,description:''});
  async function load(){ setCrits(await fetcher('/api/criteria')); }
  useEffect(()=>{ load(); },[]);
  const total = crits.reduce((a,c)=>a+c.maxScore,0);
  async function add(){ if(!form.name) return; await fetcher('/api/criteria',{method:'POST',body:JSON.stringify({...form,maxScore:Number(form.maxScore)})}); setForm({name:'',maxScore:10,description:''}); load(); }
  async function del(id:string){ await fetcher('/api/criteria/'+id,{method:'DELETE'}); load(); }
  return (<>
    <div className="page-head"><div><div className="eyebrow">Admin CMS</div><div className="page-title">Cấu hình barem chấm điểm</div></div></div>
    <div className="card card-pad">
      {crits.map(c=>(<div className="crit" key={c.id}>
        <div><div className="crit-name">{c.name}</div><div className="crit-desc">{c.description}</div></div>
        <div className="score-in"><span className="crit-max">{c.maxScore}đ</span><button className="btn btn-ghost btn-sm" onClick={()=>del(c.id)}>✕</button></div>
      </div>))}
      <div className="crit">
        <div style={{display:'flex',gap:10}}>
          <input className="input" placeholder="Tên tiêu chí" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/>
          <input className="input" placeholder="Mô tả" value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/>
        </div>
        <div className="score-in"><input className="input" style={{width:74}} type="number" value={form.maxScore} onChange={e=>setForm({...form,maxScore:Number(e.target.value)})}/><button className="btn btn-primary btn-sm" onClick={add}>＋</button></div>
      </div>
      <div className="total-box"><span className="tl">TỔNG ĐIỂM TỐI ĐA</span><span className="tv tnum">{total}<small> điểm</small></span></div>
    </div>
  </>);
}
