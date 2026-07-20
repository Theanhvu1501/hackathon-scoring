'use client';
import type { BoardCriterion } from './TimingTower';

type Judge = { id: string; name: string; isHead: boolean; submitted: number };

// Context for the tower: what the bar segments mean, and how much
// of the field each judge has actually scored.
export default function BoardRail({
  criteria = [], judges = [], teamCount, isFinal,
}: { criteria?: BoardCriterion[]; judges?: Judge[]; teamCount: number; isFinal: boolean }) {
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
              const held = j.isHead && !isFinal;
              return (
                <div className={'pw-judge' + (held ? ' held' : '')} key={j.id}>
                  <span className="nm">
                    {j.name}
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
          {!isFinal && <> <b>Điểm tạm chưa tính phiếu của Trưởng ban giám khảo.</b></>}
        </p>
      </section>
    </aside>
  );
}
