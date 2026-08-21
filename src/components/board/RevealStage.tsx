'use client';
import { teamMark } from '@/lib/team-art';
import { awardOf, PROMISING_COUNT } from '@/lib/award';

export type StageJudge = { judgeId: string; label: string; total: number | null };
export type StageRow = {
  rank: number; tie: boolean; score: number | null;
  team: { id: string; name: string; code: string; logoUrl?: string | null; tag?: string | null };
  judgeScores?: StageJudge[];
};

/** Màu nhấn theo GIẢI: quán quân lấy cam FPT, á quân lấy xanh thương hiệu, cả
 *  bốn giải Triển vọng dùng chung một màu vì chúng cùng một hạng giải — đổi màu
 *  giữa chúng là bịa ra thứ bậc không có thật. Ngoài cơ cấu giải thì xanh ngọc.
 *  Bộ màu đã hạ độ sáng để ăn được nền giấy sáng — chữ gradient trên nền trắng
 *  phải đủ đậm mới đọc được từ cuối phòng. */
function accentOf(rank: number) {
  if (rank === 1) {
    return { acc: 'linear-gradient(96deg,#FFA224 0%,#F0540A 100%)', solid: '#EE6009', shadow: 'rgba(238,96,9,.34)', tint: 'rgba(249,115,34,.20)' };
  }
  if (rank === 2) {
    return { acc: 'linear-gradient(96deg,#25BCFF 0%,#0057F5 100%)', solid: '#0079EE', shadow: 'rgba(0,121,238,.32)', tint: 'rgba(0,163,255,.20)' };
  }
  if (rank - 2 <= PROMISING_COUNT) {
    return { acc: 'linear-gradient(96deg,#7C9BFF 0%,#3A2FC4 100%)', solid: '#4248C1', shadow: 'rgba(66,72,193,.32)', tint: 'rgba(110,147,255,.20)' };
  }
  return { acc: 'linear-gradient(96deg,#2ED3B7 0%,#0E8FA8 100%)', solid: '#0E9AAE', shadow: 'rgba(14,154,174,.30)', tint: 'rgba(46,211,183,.18)' };
}

/**
 * Đội đang được công bố, chiếm cả màn hình DỌC. Không có bảng xếp hạng ở đây:
 * màn hình này có đúng một việc — cho cả phòng thấy đội vừa xướng tên nhận giải
 * gì — rồi giữ nguyên để MC nói bao lâu cũng được.
 *
 * Nửa trên là giải và đội, nửa dưới là phiếu từng giám khảo dạng danh sách có
 * thanh tỉ lệ, đúng dạng bảng chi tiết ban đầu.
 */
export default function RevealStage({
  row, teamCount, revealedRanks, maxTotal, baremTotal, header,
}: {
  row: StageRow;
  teamCount: number;
  /** Hạng của những đội ĐÃ công bố, để thang giải đầy dần. */
  revealedRanks: number[];
  maxTotal: number;
  /** Barem của một giám khảo — mẫu số của một dòng phiếu. */
  baremTotal: number;
  header: React.ReactNode;
}) {
  const a = accentOf(row.rank);
  const aw = awardOf(row.rank);
  const judges = (row.judgeScores ?? []).filter((j) => j.total !== null);
  const scored = judges.length;
  // Thang giải chỉ vẽ nổi khi số đội còn đếm được bằng mắt; đông hơn thì một
  // dãy vạch dày đặc không nói được gì, dùng tên giải cho gọn.
  const showLadder = teamCount > 0 && teamCount <= 16;
  const positions = Array.from({ length: teamCount }, (_, i) => i + 1);
  const revealed = new Set(revealedRanks);
  const pct = (t: number) => (baremTotal > 0 ? Math.min(100, (t / baremTotal) * 100) : 0);

  return (
    <div
      className="pw-stage pw-enter"
      style={{
        ['--acc' as any]: a.acc,
        ['--acc-solid' as any]: a.solid,
        ['--acc-shadow' as any]: a.shadow,
        ['--acc-tint' as any]: a.tint,
      }}
    >
      {header}

      <div className="pw-hero">
        <div className="pw-hero-rank">
          <span className="pw-rank-k">
            {aw.kicker}{row.tie ? ' · đồng hạng' : ''}
          </span>
          {/* Tên giải là chữ to nhất màn hình: cả phòng nghe MC xướng "Giải
              Triển vọng 2" thì trên màn phải đúng chữ đó, không phải "Hạng 04". */}
          <span className={'pw-award' + (aw.index === null ? ' is-named' : '')}>
            <em>{aw.title}</em>
            {aw.index !== null && <b>{aw.index}</b>}
          </span>

          <div className="pw-ladder" aria-hidden>
            {showLadder
              ? positions.map((p) => {
                  const isNow = p === row.rank;
                  const cls = 'pw-tick' + (isNow ? ' now' : revealed.has(p) ? ' done' : '');
                  return <span key={p} className={cls}><i /><b>{awardOf(p).short}</b></span>;
                })
              : <span className="pw-tick now"><i /><b>{aw.full}</b></span>}
          </div>
        </div>

        <div className="pw-team">
          <img className="pw-team-logo" src={row.team.logoUrl || teamMark(row.team.code)} alt="" />
          <h1 className="pw-team-name">{row.team.name}</h1>
          {row.team.tag && <p className="pw-team-tag">{row.team.tag}</p>}
          <div className="pw-team-total">
            <b>{row.score === null ? '—' : row.score.toFixed(1)}</b>
            <span>/ {maxTotal} điểm</span>
          </div>
        </div>
      </div>

      {judges.length > 0 && (
        <div className="pw-judges">
          <div className="pw-judges-h">
            <span className="k">Phiếu ban giám khảo</span>
            <span className="n">{judges.length} phiếu · mỗi phiếu tối đa {baremTotal}</span>
          </div>
          <div className={'pw-jlist' + (judges.length >= 8 ? ' is-dense' : '')}>
            {judges.map((j, i) => (
              <div
                key={j.judgeId}
                className="pw-jrow"
                style={{ ['--pw-i' as any]: Math.min(i, 18) }}
              >
                <span className="nm">
                  {j.label}
                </span>
                <span className="val">
                  {j.total!.toFixed(1)}
                  <small>/ {baremTotal}</small>
                </span>
                <span className="tr">
                  <i style={{ width: `${pct(j.total!)}%` }} />
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
