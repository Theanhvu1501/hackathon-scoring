'use client';
import { useLayoutEffect, useRef } from 'react';
import { teamMark, teamHue } from '@/lib/team-art';

export type BoardCriterion = { id: string; label: string; short: string; max: number; color: string };
type Row = {
  rank: number; tie: boolean; score: number | null; judgeCount: number;
  team: { id: string; name: string; code: string; tag?: string | null; logoUrl?: string | null };
  breakdown?: { criterionId: string; value: number }[];
};

const FALLBACK = '#0047FF';

export default function TimingTower({
  rows, baremTotal, criteria = [],
}: { rows: Row[]; baremTotal: number; criteria?: BoardCriterion[] }) {
  const towerRef = useRef<HTMLDivElement>(null);
  const offsets = useRef<Map<string, number>>(new Map());
  const prevRank = useRef<Map<string, number>>(new Map());
  const delta = useRef<Map<string, number>>(new Map());

  // Positions gained/lost since the last update — computed during render so the
  // arrow lands on the same frame as the reorder.
  for (const r of rows) {
    const before = prevRank.current.get(r.team.id);
    if (before !== undefined && before !== r.rank) delta.current.set(r.team.id, before - r.rank);
    else if (before === undefined) delta.current.set(r.team.id, 0);
  }

  // FLIP: slide each row from where it was to where it now is.
  useLayoutEffect(() => {
    const tower = towerRef.current;
    if (!tower) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const nodes = Array.from(tower.querySelectorAll<HTMLElement>('[data-team]'));
    if (!reduce) {
      for (const node of nodes) {
        const was = offsets.current.get(node.dataset.team!);
        const now = node.offsetTop;
        if (was !== undefined && was !== now) {
          node.animate(
            [{ transform: `translateY(${was - now}px)` }, { transform: 'translateY(0)' }],
            { duration: 780, easing: 'cubic-bezier(.22,1,.36,1)' },
          );
        }
      }
    }
    offsets.current.clear();
    for (const node of nodes) offsets.current.set(node.dataset.team!, node.offsetTop);
    for (const r of rows) prevRank.current.set(r.team.id, r.rank);
  });

  const leaderScore = rows.find((r) => r.score !== null)?.score ?? null;
  const colorOf = (id: string) => criteria.find((c) => c.id === id)?.color ?? FALLBACK;
  const labelOf = (id: string) => criteria.find((c) => c.id === id)?.label ?? '';

  if (!rows.length) {
    return (
      <div className="pw-tower">
        <p className="pw-empty">
          Chưa có đội nào được chấm.<br />Bảng tự cập nhật ngay khi giám khảo gửi phiếu đầu tiên.
        </p>
      </div>
    );
  }

  return (
    <div className="pw-tower" ref={towerRef}>
      <div className="pw-head" aria-hidden>
        <span>Hạng</span><span /><span>Đội</span>
        <span className="ta-r">Điểm</span><span className="ta-r">Δ</span>
      </div>

      {rows.map((r) => {
        const scored = r.score !== null;
        const pct = scored ? (r.score! / baremTotal) * 100 : 0;
        const markPct = leaderScore ? (leaderScore / baremTotal) * 100 : 100;
        const moved = delta.current.get(r.team.id) ?? 0;
        const gap = scored && leaderScore !== null ? r.score! - leaderScore : null;
        const segments = r.breakdown?.length
          ? r.breakdown
          : scored ? [{ criterionId: '_', value: r.score! }] : [];

        return (
          <div
            key={r.team.id}
            data-team={r.team.id}
            style={{ ['--pw-hue' as any]: teamHue(r.team.code) }}
            className={
              'pw-row' +
              (scored && r.rank <= 3 ? ` is-p${r.rank}` : '') +
              (scored ? '' : ' is-unscored')
            }
          >
            <div className="pw-pos">
              {r.tie && <span className="tie">T</span>}
              {scored ? String(r.rank).padStart(2, '0') : '—'}
            </div>

            <div className="pw-ava">
              <img src={r.team.logoUrl || teamMark(r.team.code)} alt="" />
            </div>

            <div className="pw-name">
              <b>{r.team.name}</b>
              <small><em className="pw-code">{r.team.code}</em>{r.team.tag ? ` · ${r.team.tag}` : ''}</small>
            </div>

            <div className="pw-score">
              {scored ? r.score!.toFixed(1) : '—'}
              <span className="of">/ {baremTotal}</span>
            </div>

            <div
              className={'pw-delta' + (moved > 0 ? ' up' : moved < 0 ? ' down' : '')}
              title={moved === 0 ? 'Giữ hạng' : moved > 0 ? `Tăng ${moved} hạng` : `Giảm ${-moved} hạng`}
            >
              {moved > 0 ? `▲${moved}` : moved < 0 ? `▼${-moved}` : '▬'}
            </div>

            <div className="pw-barline">
              <div className="pw-bar" style={{ ['--pw-fill' as any]: `${pct}%` }}>
                <div className="pw-bar-fill">
                  {segments.map((s, i) => (
                    <i
                      key={s.criterionId + i}
                      style={{ flexGrow: Math.max(s.value, 0.001), background: colorOf(s.criterionId) }}
                      title={labelOf(s.criterionId) ? `${labelOf(s.criterionId)}: ${s.value.toFixed(1)}` : undefined}
                    />
                  ))}
                </div>
                {scored && r.rank !== 1 && (
                  <div className="pw-bar-mark" style={{ ['--pw-mark' as any]: `${markPct}%` }} />
                )}
              </div>
              <div className={'pw-gap' + (gap === 0 ? ' lead' : '')}>
                {gap === null ? 'chưa chấm' : gap === 0 ? 'LEADER' : gap.toFixed(1)}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
