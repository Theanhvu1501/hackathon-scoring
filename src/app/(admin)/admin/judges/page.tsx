'use client';
import { useEffect, useState } from 'react';
import { fetcher } from '@/lib/ui';
export default function Judges() {
  const [judges,setJudges]=useState<any[]>([]); const [form,setForm]=useState({name:'',isHead:false});
  async function load(){ setJudges(await fetcher('/api/judges')); }
  useEffect(()=>{ load(); },[]);
  async function add(){ if(!form.name) return; await fetcher('/api/judges',{method:'POST',body:JSON.stringify(form)}); setForm({name:'',isHead:false}); load(); }
  async function regen(id:string){ await fetcher('/api/judges/'+id,{method:'POST',body:JSON.stringify({action:'regen'})}); load(); }
  async function setHead(id:string){ await fetcher('/api/judges/'+id,{method:'POST',body:JSON.stringify({action:'setHead'})}); load(); }
  async function del(id:string){ await fetcher('/api/judges/'+id,{method:'DELETE'}); load(); }
  return (<>
    <div className="page-head"><div><div className="eyebrow">Admin CMS</div><div className="page-title">Tài khoản ban giám khảo</div></div></div>
    <div className="card card-pad" style={{marginBottom:16,display:'flex',gap:10,alignItems:'flex-end'}}>
      <div className="field" style={{margin:0,flex:1}}><label>Tên giám khảo</label><input className="input" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></div>
      <label style={{display:'flex',gap:6,alignItems:'center',fontSize:13,color:'var(--muted)'}}><input type="checkbox" checked={form.isHead} onChange={e=>setForm({...form,isHead:e.target.checked})}/> Trưởng BGK</label>
      <button className="btn btn-primary" onClick={add}>＋ Thêm</button>
    </div>
    <div className="card"><table>
      <thead><tr><th>Giám khảo</th><th>Mã truy cập</th><th style={{textAlign:'right'}}>Thao tác</th></tr></thead>
      <tbody>{judges.map(j=>(<tr key={j.id}>
        <td><b>{j.name}</b> {j.isHead && <span className="badge-head">♛ Trưởng BGK</span>}</td>
        <td><span className="code-chip">{j.accessCode}</span></td>
        <td style={{textAlign:'right'}}>
          <button className="btn btn-sm" onClick={()=>regen(j.id)}>↻ Đổi mã</button>{' '}
          {!j.isHead && <button className="btn btn-sm" onClick={()=>setHead(j.id)}>Đặt Trưởng BGK</button>}{' '}
          {!j.isHead && <button className="btn btn-sm btn-danger" onClick={()=>del(j.id)}>Xoá</button>}
        </td>
      </tr>))}</tbody>
    </table></div>
  </>);
}
