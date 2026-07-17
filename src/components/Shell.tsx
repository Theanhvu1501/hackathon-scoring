'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { cx } from '@/lib/ui';
import ConfirmProvider from '@/components/ConfirmProvider';

const ADMIN_NAV = [
  { href: '/admin', label: 'Tổng quan & tiến độ', ic: '▦' },
  { href: '/admin/teams', label: 'Quản lý đội thi', ic: '◈' },
  { href: '/admin/judges', label: 'Tài khoản BGK', ic: '◐' },
  { href: '/admin/barem', label: 'Cấu hình barem', ic: '＃' },
  { href: '/admin/publish', label: 'Điều khiển công bố', ic: '◉' },
];
const JUDGE_NAV = [
  { href: '/judge', label: 'Danh sách đội', ic: '◈' },
  { href: '/judge/results', label: 'Kết quả', ic: '≡' },
];

type Crumb = { label: string; href?: string };

function buildCrumbs(path: string, role: 'admin' | 'judge'): Crumb[] {
  const home = role === 'admin' ? '/admin' : '/judge';
  const items: Crumb[] = [{ label: role === 'admin' ? 'Admin' : 'Ban giám khảo', href: home }];
  const LABEL: Record<string, string> = {
    '/admin': 'Tổng quan', '/admin/teams': 'Quản lý đội thi', '/admin/judges': 'Tài khoản BGK',
    '/admin/barem': 'Cấu hình barem', '/admin/publish': 'Điều khiển công bố',
    '/judge': 'Danh sách đội', '/judge/results': 'Kết quả',
  };
  if (path.startsWith('/admin/teams/')) {
    items.push({ label: 'Quản lý đội thi', href: '/admin/teams' }, { label: 'Chi tiết đội' });
  } else if (path.startsWith('/judge/score/')) {
    items.push({ label: 'Danh sách đội', href: '/judge' }, { label: 'Chấm điểm' });
  } else {
    items.push({ label: LABEL[path] || '' });
  }
  return items;
}

export default function Shell({
  role, userName = '', children,
}: {
  role: 'admin' | 'judge';
  userName?: string;
  children: React.ReactNode;
}) {
  const path = usePathname();
  const router = useRouter();
  const nav = role === 'admin' ? ADMIN_NAV : JUDGE_NAV;
  const crumbs = buildCrumbs(path, role);
  const home = role === 'admin' ? '/admin' : '/judge';
  const rest = crumbs.slice(1);
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  }

  const initials = userName ? userName.trim().split(' ').pop()!.slice(0, 1).toUpperCase() : '👤';

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-logo">A</div>
          <div><div className="brand-name">Automotive Hackathon</div><div className="brand-sub">2026 · Chung kết</div></div>
        </div>
        <div className="side-body">
          <div className="nav-group" style={{ marginTop: 0 }}>
            <div className={cx('nav-label', role)}>{role === 'admin' ? 'Admin CMS' : 'Ban giám khảo'}</div>
            {nav.map((n) => {
              const active = (n.href === '/admin' || n.href === '/judge') ? path === n.href : path.startsWith(n.href);
              return (
                <Link key={n.href} href={n.href} className={cx('nav-item', active && 'active')}>
                  <span className="ni-ic">{n.ic}</span> {n.label}
                </Link>
              );
            })}
          </div>
        </div>
      </aside>

      <div className="main">
        <div className="topbar">
          <div className="top-actions" style={{ marginLeft: 'auto' }}>
            <div className="usermenu" ref={menuRef}>
              <button className="usermenu-btn" onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open}>
                <span className="avatar">{initials}</span>
                <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2, textAlign: 'left' }}>
                  <span className="nm">{userName || 'Người dùng'}</span>
                  <span className="rl">{role === 'admin' ? 'Admin' : 'Giám khảo'}</span>
                </span>
                <span style={{ color: 'var(--muted-2)', fontSize: 11 }}>▾</span>
              </button>
              {open && (
                <div className="usermenu-pop" role="menu">
                  <div className="u-head"><b>{userName || 'Người dùng'}</b><small>{role === 'admin' ? 'Quản trị viên' : 'Ban giám khảo'}</small></div>
                  <button className="menu-item danger" role="menuitem" onClick={logout}>
                    <span>⎋</span> Đăng xuất
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="subbar">
          <nav className="breadcrumb" aria-label="Breadcrumb">
            <Link href={home} className="crumb-home">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 11l9-8 9 8" /><path d="M5 9.5V21h14V9.5" />
              </svg>
              Trang chủ
            </Link>
            {rest.map((c, i) => {
              const last = i === rest.length - 1;
              return (
                <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  <span className="sep">›</span>
                  {c.href && !last ? <Link href={c.href}>{c.label}</Link> : <span className={last ? 'cur' : undefined}>{c.label}</span>}
                </span>
              );
            })}
          </nav>
        </div>

        <div className="content"><ConfirmProvider>{children}</ConfirmProvider></div>
      </div>
    </div>
  );
}
