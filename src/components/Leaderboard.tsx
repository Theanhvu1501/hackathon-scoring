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

  return (
    <div className="glist" ref={containerRef}>
      {rows.map((r) => {
        const leader = r.rank === 1 && phase === 'final';
        return (
          <div data-row={r.team.id} key={r.team.id} className={'grow' + (leader ? ' is-leader' : '') + (r.rank <= 3 ? ' rank-' + r.rank : '')}>
            <div className="grank">{r.tie ? 'T' : ''}{r.rank}<span>.</span></div>
            <div className="gava">
              {r.team.logoUrl ? <img src={r.team.logoUrl} alt="" /> : <span className="gava-code">{r.team.code}</span>}
            </div>
            <div className="gname">
              <span className="gn">{r.team.name}</span>
              <span className="gt">{r.team.tag}</span>
            </div>
            <div className="gscore tnum">{r.score === null ? '—' : r.score.toFixed(1)}<span className="gof"> / {baremTotal}</span></div>
          </div>
        );
      })}
    </div>
  );
}
