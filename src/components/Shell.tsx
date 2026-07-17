'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cx } from '@/lib/ui';

const ADMIN_NAV = [
  { href:'/admin', label:'Tổng quan & tiến độ', ic:'▦' },
  { href:'/admin/teams', label:'Quản lý đội thi', ic:'◈' },
  { href:'/admin/judges', label:'Tài khoản BGK', ic:'◐' },
  { href:'/admin/barem', label:'Cấu hình barem', ic:'＃' },
  { href:'/admin/publish', label:'Điều khiển công bố', ic:'◉' },
];
const JUDGE_NAV = [
  { href:'/judge', label:'Danh sách đội', ic:'◈' },
  { href:'/judge/results', label:'Kết quả', ic:'≡' },
];

export default function Shell({ role, children }:{ role:'admin'|'judge'; children:React.ReactNode }) {
  const path = usePathname(); const router = useRouter();
  const nav = role === 'admin' ? ADMIN_NAV : JUDGE_NAV;
  async function logout(){ await fetch('/api/auth/logout',{method:'POST'}); router.push('/login'); }
  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-logo">A</div>
          <div><div className="brand-name">Automotive Hackathon</div><div className="brand-sub">2026 · Chung kết</div></div>
        </div>
        <div className="nav-group">
          <div className={cx('nav-label', role)}>{role==='admin'?'Admin CMS':'Ban giám khảo'}</div>
          {nav.map(n => (
            <Link key={n.href} href={n.href} className={cx('nav-item', path===n.href && 'active')}>
              <span className="ni-ic">{n.ic}</span> {n.label}
            </Link>
          ))}
        </div>
        <div className="side-foot"><button className="btn btn-sm" onClick={logout}>Đăng xuất</button></div>
      </aside>
      <div className="main">
        <div className="topbar">
          <div className="crumb"><b>{role==='admin'?'Admin':'Ban giám khảo'}</b></div>
        </div>
        <div className="content">{children}</div>
      </div>
    </div>
  );
}
