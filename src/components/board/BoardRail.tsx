'use client';
import type { BoardCriterion } from './TimingTower';

/** `label` chứ không phải `name`: đây là component của board công khai. */
type Judge = { id: string; label: string; isHead: boolean; submitted: number };

// Context for the tower: what the bar segments mean, and how much
// of the field each judge has actually scored.
export default function BoardRail({
  criteria = [], judges = [], teamCount,
}: { criteria?: BoardCriterion[]; judges?: Judge[]; teamCount: number }) {
  return (
    <aside className="pw-rail">
      {criteria.length > 0 && (
        <section className="pw-card">
          <h3>Thang điểm</h3>
          <div className="pw-legend">
            {criteria.map((c) => (
              <div className="pw-legend-item" key={c.id}>
                <i style={{ background: c.color }} />
                <span>{c.label}</span>
                <b>{c.max}</b>
              </div>
            ))}
          </div>
        </section>
      )}

      {judges.length > 0 && (
        <section className="pw-card">
          <h3>Tiến độ chấm</h3>
          <div className="pw-judges">
            {judges.map((j) => {
              return (
                <div className="pw-judge" key={j.id}>
                  <span className="nm">
                    {j.label}
                    {j.isHead && <span className="role"> · Trưởng BGK</span>}
                  </span>
                  <span className="ct">{j.submitted}/{teamCount}</span>
                  <span className="tr">
                    <i style={{ width: `${teamCount ? (j.submitted / teamCount) * 100 : 0}%` }} />
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="pw-card">
        <h3>Cách đọc bảng</h3>
        <p className="pw-note">
          Thanh màu dài theo tổng điểm, chia theo từng tiêu chí. Vạch cam là điểm của đội dẫn đầu —
          phần thiếu so với vạch chính là khoảng cách ở cột bên phải.
          Bảng chỉ hiện những đội đã được công bố; số hạng là hạng chung cuộc trên toàn bộ đội thi.
        </p>
      </section>
    </aside>
  );
}
