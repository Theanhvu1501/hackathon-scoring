'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
export default function Login() {
  const [code,setCode]=useState(''); const [err,setErr]=useState(''); const router=useRouter();
  async function submit(e:React.FormEvent){ e.preventDefault(); setErr('');
    const res = await fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code})});
    if(!res.ok){ setErr((await res.json()).error||'Lỗi'); return; }
    const { role } = await res.json();
    router.push(role==='admin'?'/admin':'/judge');
  }
  return (
    <div style={{maxWidth:440,margin:'8vh auto'}}>
      <form className="card card-pad" style={{textAlign:'center',padding:'36px 30px'}} onSubmit={submit}>
        <div className="brand-logo" style={{width:64,height:64,fontSize:30,borderRadius:18,margin:'0 auto 20px'}}>A</div>
        <div className="eyebrow" style={{textAlign:'center'}}>Automotive Hackathon 2026</div>
        <h1 style={{fontSize:24,marginBottom:8}}>Đăng nhập hệ thống</h1>
        <p className="page-desc" style={{margin:'0 auto 22px'}}>Nhập mã truy cập được Ban tổ chức cấp. Không cần mật khẩu.</p>
        <div className="field" style={{textAlign:'left'}}>
          <label>Mã truy cập</label>
          <input className="input" style={{textAlign:'center',letterSpacing:'.3em',fontFamily:'Space Grotesk',fontSize:18}}
            value={code} onChange={e=>setCode(e.target.value)} placeholder="XXXX-XXXX" />
        </div>
        {err && <div style={{color:'var(--red)',fontSize:13,marginBottom:12}}>{err}</div>}
        <button className="btn btn-primary" style={{width:'100%',justifyContent:'center',padding:12}}>Vào hệ thống →</button>
      </form>
    </div>
  );
}
