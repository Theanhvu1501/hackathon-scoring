'use client';
import { useEffect, useRef } from 'react';
import { teamMark } from '@/lib/team-art';

/** `label` chứ không phải `name`: tên thật của giám khảo không bao giờ được gửi
 *  xuống board công khai — xem src/lib/judge-label.ts. */
export type JudgeScore = { judgeId: string; label: string; isHead: boolean; total: number | null };

type Props = {
  team: { name: string; code: string; logoUrl?: string | null };
  judgeScores: JudgeScore[];
  /** One judge's full barem — the denominator of a single card. */
  baremTotal: number;
  /** The team's total, i.e. the sum of the cards below. */
  score: number | null;
  maxTotal: number;
  onClose: () => void;
};

// Each counted judge's TOTAL for one team — no per-criterion breakdown, that
// stays an admin-only view. Judges the phase does not count (the head judge
// before the final reveal) are already filtered out server-side.
export default function JudgeScoresModal({
  team, judgeScores, baremTotal, score, maxTotal, onClose,
}: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Bars read against one judge's full barem, not against the best card here,
  // so a 40/50 looks like 40/50 and not like a full bar.
  const pct = (t: number) => (baremTotal > 0 ? Math.min(100, (t / baremTotal) * 100) : 0);

  return (
    <div
      className="pw-modal-wrap"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="pw-modal" role="dialog" aria-modal="true" aria-label={`Điểm ban giám khảo · ${team.name}`}>
        <header className="pw-modal-head">
          <span className="pw-modal-ava"><img src={team.logoUrl || teamMark(team.code)} alt="" /></span>
          <div className="pw-modal-id">
            <b>{team.name}</b>
            <span>Điểm từng giám khảo (ẩn tên)</span>
          </div>
          <button ref={closeRef} type="button" className="pw-modal-x" onClick={onClose} aria-label="Đóng">✕</button>
        </header>

        <div className="pw-modal-body">
          {judgeScores.length === 0 && <p className="pw-modal-empty">Chưa có giám khảo nào chấm đội này.</p>}
          {judgeScores.map((j) => (
            <div className={'pw-jrow' + (j.total === null ? ' is-none' : '')} key={j.judgeId}>
              <span className="nm">
                {j.label}
                {j.isHead && <em className="role">Trưởng BGK</em>}
              </span>
              <span className="val">
                {j.total === null ? 'chưa chấm' : j.total.toFixed(1)}
                {j.total !== null && <small>/ {baremTotal}</small>}
              </span>
              <span className="tr">
                <i style={{ width: `${j.total === null ? 0 : pct(j.total)}%` }} />
              </span>
            </div>
          ))}
        </div>

        <footer className="pw-modal-foot">
          <span>Tổng điểm</span>
          <b>{score === null ? '—' : score.toFixed(1)}<small> / {maxTotal}</small></b>
        </footer>
      </div>
    </div>
  );
}
