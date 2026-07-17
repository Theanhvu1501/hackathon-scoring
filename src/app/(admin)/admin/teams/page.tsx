'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { fetcher } from '@/lib/ui';
export default function Teams() {
  const [teams,setTeams]=useState<any[]>([]);
  const [form,setForm]=useState({name:'',code:'',tag:''});
  async function load(){ setTeams(await fetcher('/api/teams')); }
  useEffect(()=>{ load(); },[]);
  async function add(){ if(!form.name||!form.code) return;
    await fetcher('/api/teams',{method:'POST',body:JSON.stringify(form)}); setForm({name:'',code:'',tag:''}); load(); }
  async function del(id:string){ await fetcher('/api/teams/'+id,{method:'DELETE'}); load(); }
  return (<>
    <div className="page-head"><div><div className="eyebrow">Admin CMS</div><div className="page-title">Quản lý đội thi</div></div></div>
    <div className="card card-pad" style={{marginBottom:16,display:'flex',gap:10,alignItems:'flex-end',flexWrap:'wrap'}}>
      <div className="field" style={{margin:0}}><label>Tên đội</label><input className="input" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></div>
      <div className="field" style={{margin:0,maxWidth:120}}><label>Mã (badge)</label><input className="input" value={form.code} onChange={e=>setForm({...form,code:e.target.value.toUpperCase()})}/></div>
      <div className="field" style={{margin:0,flex:1}}><label>Mô tả ngắn</label><input className="input" value={form.tag} onChange={e=>setForm({...form,tag:e.target.value})}/></div>
      <button className="btn btn-primary" onClick={add}>＋ Thêm đội</button>
    </div>
    <div className="card"><table>
      <thead><tr><th>Đội</th><th>Thành viên</th><th>Mô tả</th><th style={{textAlign:'right'}}>Thao tác</th></tr></thead>
      <tbody>{teams.map(t=>(<tr key={t.id}>
        <td><div className="tcell"><span className="team-ava" style={{background:'linear-gradient(135deg,#f37021,#ff9730)'}}>{t.code}</span><b>{t.name}</b></div></td>
        <td className="tnum">{t.members?.length||0} người</td><td style={{color:'var(--muted)'}}>{t.tag}</td>
        <td style={{textAlign:'right'}}><Link className="btn btn-sm" href={'/admin/teams/'+t.id}>Chi tiết</Link> <button className="btn btn-sm btn-danger" onClick={()=>del(t.id)}>Xoá</button></td>
      </tr>))}</tbody>
    </table></div>
  </>);
}
