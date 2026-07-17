'use client';
import { useEffect, useState } from 'react';
import { fetcher } from '@/lib/ui';
export default function TeamDetail({ params }:{ params:{ id:string } }) {
  const [team,setTeam]=useState<any>(null);
  const [m,setM]=useState({name:'',teamRole:'',org:'',email:'',intro:''});
  async function load(){ const all=await fetcher('/api/teams'); setTeam(all.find((t:any)=>t.id===params.id)); }
  useEffect(()=>{ load(); },[]);
  async function addMember(){ if(!m.name) return; await fetcher('/api/members',{method:'POST',body:JSON.stringify({teamId:params.id,...m})}); setM({name:'',teamRole:'',org:'',email:'',intro:''}); load(); }
  async function delMember(id:string){ await fetcher('/api/members/'+id,{method:'DELETE'}); load(); }
  if(!team) return <div>Đang tải…</div>;
  return (<>
    <div className="page-head"><div><div className="page-title">{team.name}</div><div className="page-desc">{team.tag}</div></div></div>
    <div className="two-col" style={{gridTemplateColumns:'1.6fr 1fr',alignItems:'start'}}>
      <div><h3 style={{marginBottom:14,color:'var(--muted)'}}>Thành viên ({team.members.length})</h3>
        <div className="members">{team.members.map((x:any)=>(
          <div className="card member" key={x.id}><div className="m-top"><span className="m-photo">{x.name.split(' ').pop()[0]}</span>
          <div><div className="m-name">{x.name}</div><div className="m-role">{x.teamRole}</div></div></div>
          <div className="m-meta">{x.org}{x.email?<><br/>✉ {x.email}</>:null}</div>
          {x.intro && <div className="m-intro">{x.intro}</div>}
          <button className="btn btn-sm btn-danger" onClick={()=>delMember(x.id)}>Xoá</button></div>
        ))}</div>
      </div>
      <div className="card card-pad"><h3 style={{marginBottom:14}}>Thêm thành viên</h3>
        <div className="field"><label>Họ tên</label><input className="input" value={m.name} onChange={e=>setM({...m,name:e.target.value})}/></div>
        <div className="field"><label>Vai trò trong đội</label><input className="input" value={m.teamRole} onChange={e=>setM({...m,teamRole:e.target.value})}/></div>
        <div className="field"><label>Đơn vị</label><input className="input" value={m.org} onChange={e=>setM({...m,org:e.target.value})}/></div>
        <div className="field"><label>Email</label><input className="input" value={m.email} onChange={e=>setM({...m,email:e.target.value})}/></div>
        <div className="field"><label>Giới thiệu</label><textarea className="textarea" value={m.intro} onChange={e=>setM({...m,intro:e.target.value})}/></div>
        <button className="btn btn-primary" style={{width:'100%',justifyContent:'center'}} onClick={addMember}>Thêm</button>
      </div>
    </div>
  </>);
}
