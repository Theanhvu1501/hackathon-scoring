'use client';
import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { teamMark, teamHue } from '@/lib/team-art';
import JudgeScoresModal, { type JudgeScore } from './JudgeScoresModal';

export type BoardCriterion = { id: string; label: string; short: string; max: number; color: string };
type Row = {
  rank: number; tie: boolean; score: number | null; judgeCount: number;
  team: { id: string; name: string; code: string; tag?: string | null; logoUrl?: string | null };
  breakdown?: { criterionId: string; value: number }[];
  judgeScores?: JudgeScore[];
};

const FALLBACK = '#0047FF';

export default function TimingTower({
  rows, maxTotal, baremTotal = 0, criteria = [], interactive = true, showJudges = false,
}: {
  rows: Row[]; maxTotal: number; baremTotal?: number;
  criteria?: BoardCriterion[];
  /** false on the frozen copy rendered during a screen crossfade. */
  interactive?: boolean;
  /** Bước 2 đã mở: hiện dải chip điểm từng BGK và nút mở popup. Trước đó điểm
   *  BGK chưa được công bố, nên cả chip lẫn nút đều không được tồn tại. */
  showJudges?: boolean;
}) {
  const [openTeam, setOpenTeam] = useState<string | null>(null);
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

  const opened = openTeam ? rows.find((r) => r.team.id === openTeam) : null;

  return (
    <div className="pw-tower" ref={towerRef}>
      <div className="pw-head" aria-hidden>
        <span>Hạng</span><span /><span>Đội</span>
        <span className="ta-r">Điểm</span><span className="ta-r">Δ</span>
      </div>

      {rows.map((r, i) => {
        const scored = r.score !== null;
        const pct = scored ? (r.score! / maxTotal) * 100 : 0;
        const markPct = leaderScore ? (leaderScore / maxTotal) * 100 : 100;
        const moved = delta.current.get(r.team.id) ?? 0;
        const gap = scored && leaderScore !== null ? r.score! - leaderScore : null;
        const segments = r.breakdown?.length
          ? r.breakdown
          : scored ? [{ criterionId: '_', value: r.score! }] : [];

        return (
          <div
            key={r.team.id}
            data-team={r.team.id}
            style={{ ['--pw-hue' as any]: teamHue(r.team.code), ['--pw-i' as any]: Math.min(i, 18) }}
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
              <span className="of">/ {maxTotal}</span>
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
              {interactive && showJudges && r.judgeScores && r.judgeScores.length > 0 && (
                <button
                  type="button"
                  className="pw-jbtn"
                  onClick={() => setOpenTeam(r.team.id)}
                  aria-label={`Xem điểm ban giám khảo của ${r.team.name}`}
                >
                  Điểm BGK
                </button>
              )}
            </div>

            {/* Inline chứ không bắt bấm mở popup: đây là khoảnh khắc cả phòng
                đang xem màn hình, không ai bấm chuột. */}
            {showJudges && r.judgeScores && r.judgeScores.length > 0 && (
              <div className="pw-jchips">
                {r.judgeScores.map((j) => (
                  <span key={j.judgeId} className={'pw-jchip' + (j.isHead ? ' is-head' : '')}>
                    {j.label} <b>{j.total === null ? '—' : j.total.toFixed(1)}</b>
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* Portalled to <body>: the tower is a clipping, animated ancestor and
          would otherwise cut the overlay off. */}
      {opened && createPortal(
        <JudgeScoresModal
          team={opened.team}
          judgeScores={opened.judgeScores ?? []}
          baremTotal={baremTotal}
          score={opened.score}
          maxTotal={maxTotal}
          onClose={() => setOpenTeam(null)}
        />,
        document.body,
      )}
    </div>
  );
}
