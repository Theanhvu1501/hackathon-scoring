// Mock data for the public board, enabled with ?mock=1.
// Produces the exact shape of /api/results plus the optional extras the
// timing tower can render (criteria, per-team breakdown, judge roster).
import { computeLeaderboard, judgeTotal, ScoreLite, TeamLite } from '@/lib/scoring';
import { anonymizeJudges } from '@/lib/judge-label';

export type BoardCriterion = { id: string; label: string; short: string; max: number; color: string };

export const MOCK_CRITERIA: BoardCriterion[] = [
  { id: 'c1', label: 'Giải pháp AI', short: 'AI', max: 35, color: '#0047FF' },
  { id: 'c2', label: 'Tính khả thi', short: 'KT', max: 25, color: '#00A3FF' },
  { id: 'c3', label: 'Trải nghiệm', short: 'TN', max: 20, color: '#22C55E' },
  { id: 'c4', label: 'Trình bày', short: 'TB', max: 20, color: '#F97322' },
];

export const MOCK_JUDGES = [
  { id: 'j1', name: 'Nguyễn Minh Quân' },
  { id: 'j2', name: 'Trần Thu Hà' },
  { id: 'j3', name: 'Lê Đức Anh' },
  { id: 'j4', name: 'Phạm Bảo Ngọc' },
  { id: 'j5', name: 'Đỗ Hoàng Nam' },
];

type Seed = {
  code: string; name: string; tag: string;
  members: string[];
  base: [number, number, number, number]; // per-criterion baseline, out of each max
};

const SEEDS: Seed[] = [
  { code: 'ND', name: 'NeuroDrive', tag: 'Dự đoán va chạm bằng vision transformer', members: ['Vũ Trí Hậu', 'Ngô Lan Chi', 'Bùi Quang Huy', 'Hà Mỹ Linh'], base: [31.5, 22.0, 17.5, 16.5] },
  { code: 'LK', name: 'LaneKeeper', tag: 'Giữ làn thích ứng cho đường đô thị Việt Nam', members: ['Đặng Tuấn Kiệt', 'Lý Thanh Vân', 'Trịnh Bảo Long'], base: [29.0, 21.5, 18.0, 15.5] },
  { code: 'CX', name: 'Copilot X', tag: 'Trợ lý giọng nói trong xe, ngoại tuyến', members: ['Phan Hải Đăng', 'Nguyễn Khánh Vy', 'Tạ Minh Khôi', 'Dương Thu Trang'], base: [28.0, 20.0, 19.0, 16.0] },
  { code: 'SF', name: 'Sensor Fusion', tag: 'Hợp nhất LiDAR và camera thời gian thực', members: ['Hoàng Việt Anh', 'Mai Phương Thảo', 'Lê Gia Bảo'], base: [30.0, 19.0, 15.5, 15.0] },
  { code: 'TQ', name: 'Tứ Quý AI', tag: 'Chẩn đoán lỗi động cơ từ âm thanh', members: ['Chu Nhật Minh', 'Đinh Hà My', 'Võ Thành Đạt', 'Lâm Tuệ Nhi'], base: [27.5, 21.0, 16.0, 15.0] },
  { code: 'DX', name: 'Đèn Xanh', tag: 'Tối ưu luồng giao thông theo pha đèn', members: ['Trương Anh Tú', 'Nguyễn Diệu Linh', 'Phạm Đức Duy'], base: [26.0, 20.5, 16.5, 14.5] },
  { code: 'VX', name: 'VoxAuto', tag: 'Nhận lệnh tiếng Việt trong tiếng ồn cabin', members: ['Đỗ Khánh Huyền', 'Cao Minh Hiếu', 'Nguyễn Trung Kiên'], base: [25.5, 19.5, 17.0, 15.5] },
  { code: 'PC', name: 'Pit Crew', tag: 'Lập lịch bảo dưỡng dự đoán cho đội xe', members: ['Lưu Bảo Trâm', 'Hồ Sỹ Nguyên', 'Trần Gia Hân'], base: [24.0, 22.5, 15.0, 14.0] },
  { code: 'TA', name: 'Torque.ai', tag: 'Tinh chỉnh hộp số bằng học tăng cường', members: ['Nguyễn Hữu Phước', 'Đoàn Thanh Mai', 'Vương Chí Dũng'], base: [26.5, 17.5, 15.5, 13.5] },
  { code: 'CZ', name: 'Chassis Zero', tag: 'Mô phỏng khung gầm rút ngắn thử nghiệm', members: ['Phùng Nam Sơn', 'Tô Ngọc Ánh', 'Bạch Đình Trung'], base: [23.5, 18.5, 14.5, 14.0] },
  { code: 'HP', name: 'Hải Phòng Drive', tag: 'Bản đồ ổ gà bằng cảm biến điện thoại', members: ['Nguyễn Thế Vinh', 'Lê Hà Giang', 'Đỗ Quốc Bảo'], base: [22.0, 19.0, 15.0, 13.0] },
  { code: 'AG', name: 'Alpha Garage', tag: 'Báo giá sửa chữa từ ảnh chụp hư hỏng', members: ['Trần Mỹ Duyên', 'Nguyễn Xuân Lộc', 'Phạm Thùy Dương'], base: [21.5, 17.0, 14.0, 13.5] },
];

// Deterministic wobble so ranks reshuffle between ticks without Math.random.
function wobble(teamIndex: number, critIndex: number, tick: number): number {
  const a = Math.sin((tick + 1) * 1.7 + teamIndex * 2.3 + critIndex * 0.9);
  const b = Math.cos((tick + 1) * 0.8 + teamIndex * 1.1 - critIndex * 1.6);
  return (a + b) * 1.15;
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export type MockOptions = {
  state?: 'waiting' | 'revealing';
  /** Đã công bố mấy đội, tính từ hạng bét lên. Đội đang chiếu là đội tốt nhất
   *  trong số đã công bố — giống hệt cách board thật chọn currentTeamId. */
  revealedCount?: number;
  tick?: number;
  /** Teams still awaiting any score — they render as "chưa chấm". */
  unscoredCount?: number;
};

export function buildMockResults(opts: MockOptions = {}) {
  const { state = 'revealing', tick = 0, unscoredCount = 0 } = opts;
  const revealedCount = opts.revealedCount ?? (state === 'waiting' ? 0 : 9);

  const teams: TeamLite[] = SEEDS.map((s, i) => ({
    id: 't' + i, name: s.name, code: s.code, tag: s.tag, logoUrl: null,
  }));

  const scored = SEEDS.length - unscoredCount;

  const scores: ScoreLite[] = [];
  SEEDS.forEach((seed, ti) => {
    if (ti >= scored) return;
    MOCK_JUDGES.forEach((judge, ji) => {
      // Late judges lag on the tail of the field — a real board is never fully filled.
      MOCK_CRITERIA.forEach((crit, ci) => {
        const spread = ((ji - MOCK_JUDGES.length / 2) * 0.45) + wobble(ti, ci, tick) * 0.55;
        scores.push({
          judgeId: judge.id, teamId: 't' + ti, criterionId: crit.id,
          value: Math.round(clamp(seed.base[ci] + spread, 0, crit.max) * 10) / 10,
        });
      });
    });
  });

  const ranked = computeLeaderboard({ teams, scores });
  const labelled = anonymizeJudges(MOCK_JUDGES);

  const rows = ranked.map((r) => ({
    ...r,
    team: { ...r.team, members: [] },
    revealed: true,
    judgeScores: labelled.map((j) => ({
      judgeId: j.id, label: j.label,
      total: judgeTotal(scores, r.team.id, j.id),
    })),
  }));

  // Công bố từ hạng bét lên: nhóm đã công bố là K đội cuối bảng.
  const k = Math.max(0, Math.min(revealedCount, rows.length));
  const revealedRows = state === 'waiting' ? [] : rows.slice(rows.length - k);
  const current = revealedRows.length ? revealedRows[0] : null;

  return {
    state,
    rows: revealedRows,
    revealedTeamIds: revealedRows.map((r) => r.team.id),
    currentTeamId: current?.team.id ?? null,
    baremTotal: MOCK_CRITERIA.reduce((a, c) => a + c.max, 0),
    maxTotal: MOCK_CRITERIA.reduce((a, c) => a + c.max, 0) * MOCK_JUDGES.length,
    judgeCount: MOCK_JUDGES.length,
    bannerImageUrl: null,
    teamCount: SEEDS.length,
    mock: true,
  };
}
