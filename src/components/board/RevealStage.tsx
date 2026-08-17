'use client';
import { teamMark } from '@/lib/team-art';

export type StageJudge = { judgeId: string; label: string; isHead: boolean; total: number | null };
export type StageRow = {
  rank: number; tie: boolean; score: number | null;
  team: { id: string; name: string; code: string; logoUrl?: string | null; tag?: string | null };
  judgeScores?: StageJudge[];
};

/** Màu nhấn theo bục: hạng nhất lấy cam FPT, hạng nhì/ba lấy hai xanh thương
 *  hiệu, ngoài bục thì trung tính. Đây là thông tin (trong bục / ngoài bục),
 *  không phải trang trí. */
function accentOf(rank: number) {
  if (rank === 1) {
    return { acc: 'linear-gradient(92deg,#FFB166 0%,#FF7A1F 100%)', solid: '#FFA054', shadow: 'rgba(249,115,34,.34)', glow: 'rgba(249,115,34,.24)' };
  }
  if (rank === 2) {
    return { acc: 'linear-gradient(92deg,#BFE6FF 0%,#4FBBFF 100%)', solid: '#7FD3FF', shadow: 'rgba(0,163,255,.30)', glow: 'rgba(0,163,255,.22)' };
  }
  if (rank === 3) {
    return { acc: 'linear-gradient(92deg,#C6D6FF 0%,#6E93FF 100%)', solid: '#8FB4FF', shadow: 'rgba(0,71,255,.30)', glow: 'rgba(0,71,255,.20)' };
  }
  return { acc: 'linear-gradient(92deg,#DCE6FF 0%,#9FB4DC 100%)', solid: '#B9C9EA', shadow: 'rgba(11,27,61,.42)', glow: 'rgba(66,72,193,.20)' };
}

/**
 * Đội đang được công bố, chiếm cả màn hình DỌC. Không có bảng xếp hạng ở đây:
 * màn hình này có đúng một việc — cho cả phòng thấy đội vừa xướng tên đứng hạng
 * bao nhiêu — rồi giữ nguyên để MC nói bao lâu cũng được.
 *
 * Nửa trên là hạng và đội, nửa dưới là phiếu từng giám khảo dạng danh sách có
 * thanh tỉ lệ, đúng dạng bảng chi tiết ban đầu.
 */
export default function RevealStage({
  row, teamCount, revealedRanks, maxTotal, baremTotal, header,
}: {
  row: StageRow;
  teamCount: number;
  /** Hạng của những đội ĐÃ công bố, để thang vị trí đầy dần. */
  revealedRanks: number[];
  maxTotal: number;
  /** Barem của một giám khảo — mẫu số của một dòng phiếu. */
  baremTotal: number;
  header: React.ReactNode;
}) {
  const a = accentOf(row.rank);
  const judges = row.judgeScores ?? [];
  const scored = judges.filter((j) => j.total !== null).length;
  // Thang vị trí chỉ vẽ nổi khi số đội còn đếm được bằng mắt; đông hơn thì một
  // dãy vạch dày đặc không nói được gì, dùng phân số cho gọn.
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
        ['--stage-glow' as any]: a.glow,
      }}
    >
      {header}

      <div className="pw-hero">
        <div className="pw-hero-rank">
          <span className="pw-rank-k">
            {row.tie ? 'Đồng hạng' : row.rank === 1 ? 'Vô địch' : 'Hạng'}
          </span>
          <span className="pw-rank">{String(row.rank).padStart(2, '0')}</span>

          <div className="pw-ladder" aria-hidden>
            {showLadder
              ? positions.map((p) => {
                  const isNow = p === row.rank;
                  const cls = 'pw-tick' + (isNow ? ' now' : revealed.has(p) ? ' done' : '');
                  return <span key={p} className={cls}><i /><b>{String(p).padStart(2, '0')}</b></span>;
                })
              : <span className="pw-tick now"><i /><b>{row.rank} / {teamCount}</b></span>}
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
            <span className="n">{scored}/{judges.length} đã chấm · mỗi phiếu tối đa {baremTotal}</span>
          </div>
          <div className={'pw-jlist' + (judges.length >= 8 ? ' is-dense' : '')}>
            {judges.map((j, i) => (
              <div
                key={j.judgeId}
                className={'pw-jrow' + (j.total === null ? ' is-none' : '')}
                style={{ ['--pw-i' as any]: Math.min(i, 18) }}
              >
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
        </div>
      )}
    </div>
  );
}
