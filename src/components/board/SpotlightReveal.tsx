'use client';
import { useEffect } from 'react';
import { teamMark } from '@/lib/team-art';

export const SPOTLIGHT_MS = 6000;

type SpotRow = {
  rank: number; tie: boolean; score: number | null;
  team: { name: string; code: string; logoUrl?: string | null; tag?: string | null };
};

/** Màn hình phủ toàn board khi ban tổ chức vừa công bố một đội: hạng cỡ lớn,
 *  logo, tên, tổng điểm. Tự tắt sau SPOTLIGHT_MS rồi đội rơi vào timing tower. */
export default function SpotlightReveal({
  row, maxTotal, onDone,
}: { row: SpotRow; maxTotal: number; onDone: () => void }) {
  useEffect(() => {
    const id = setTimeout(onDone, SPOTLIGHT_MS);
    return () => clearTimeout(id);
  }, [onDone]);

  return (
    <div className="pw-spot" role="status" aria-live="polite">
      <div className="pw-spot-in">
        <div className="pw-spot-rank">
          <span className="k">HẠNG</span>
          <b>{row.tie ? 'T' : ''}{String(row.rank).padStart(2, '0')}</b>
        </div>
        <img className="pw-spot-logo" src={row.team.logoUrl || teamMark(row.team.code)} alt="" />
        <h2 className="pw-spot-name">{row.team.name}</h2>
        {row.team.tag && <p className="pw-spot-tag">{row.team.tag}</p>}
        <div className="pw-spot-score">
          {row.score === null ? '—' : row.score.toFixed(1)}<small>/ {maxTotal}</small>
        </div>
      </div>
    </div>
  );
}
