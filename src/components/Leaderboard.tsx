'use client';
import { useLayoutEffect, useRef } from 'react';

export default function Leaderboard({ rows, phase, baremTotal }: { rows: any[]; phase: string; baremTotal: number }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const posRef = useRef<Map<string, number>>(new Map());

  // FLIP: animate rows sliding to their new vertical positions when the order changes.
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

  return (
    <div className="lb" ref={containerRef}>
      {rows.map((r) => (
        <div data-row={r.team.id} key={r.team.id}
          className={'row ' + (r.rank === 1 && phase === 'final' ? 'leader ' : '') + (r.rank <= 3 ? 'top3' : '')}>
          <div className="rk"><span className="rk-num tnum">{r.tie ? 'T' + r.rank : r.rank}</span></div>
          <div className="r-team">
            <span className="r-logo" style={{ background: r.team.logoUrl ? 'var(--navy-950)' : 'var(--orange)', padding: 0, overflow: 'hidden' }}>
              {r.team.logoUrl ? <img src={r.team.logoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : r.team.code}
            </span>
            <div style={{ minWidth: 0 }}><div className="r-name">{r.team.name}</div><div className="r-tag">{r.team.tag}</div></div>
          </div>
          <div className="r-score"><div><span className="sc tnum">{r.score === null ? '—' : r.score.toFixed(1)}</span><span className="of"> /{baremTotal}</span></div></div>
        </div>
      ))}
    </div>
  );
}
