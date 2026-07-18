'use client';
import { useLayoutEffect, useRef } from 'react';

export default function Leaderboard({ rows, phase, baremTotal }: { rows: any[]; phase: string; baremTotal: number }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const posRef = useRef<Map<string, number>>(new Map());

  // FLIP: slide rows to their new positions when the ranking reorders.
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const nodes = Array.from(container.querySelectorAll<HTMLElement>('[data-row]'));
    if (!reduce) {
      for (const node of nodes) {
        const id = node.dataset.row!;
        const prev = posRef.current.get(id);
        const now = node.offsetTop;
        if (prev !== undefined && prev !== now) {
          node.animate(
            [{ transform: `translateY(${prev - now}px)` }, { transform: 'translateY(0)' }],
            { duration: 750, easing: 'cubic-bezier(.22,1,.36,1)' },
          );
        }
      }
    }
    posRef.current.clear();
    for (const node of nodes) posRef.current.set(node.dataset.row!, node.offsetTop);
  });

  const maxShown = Math.max(1, baremTotal);

  return (
    <div className="rlist" ref={containerRef}>
      {rows.map((r) => {
        const pct = r.score === null ? 0 : Math.max(0, Math.min(100, (r.score / maxShown) * 100));
        const leader = r.rank === 1 && phase === 'final';
        return (
          <div data-row={r.team.id} key={r.team.id} className={'rrow rank-' + (r.rank <= 3 ? r.rank : 'n') + (leader ? ' is-leader' : '')}>
            <div className="pos">{r.tie ? 'T' : ''}{r.rank}</div>
            <div className="rbody">
              <div className="rhead">
                <span className="r-logo" style={{ background: r.team.logoUrl ? 'var(--navy-950)' : 'var(--orange)', padding: 0, overflow: 'hidden' }}>
                  {r.team.logoUrl ? <img src={r.team.logoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : r.team.code}
                </span>
                <div style={{ minWidth: 0 }}>
                  <div className="rname">{r.team.name}</div>
                  <div className="rtag">{r.team.tag}</div>
                </div>
                <div className="rscore tnum">{r.score === null ? '—' : r.score.toFixed(1)}<small>/{baremTotal}</small></div>
              </div>
              <div className="rtrack"><div className="rtrack-fill" style={{ width: pct + '%' }} /></div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
