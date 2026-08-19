/**
 * Cơ cấu giải của vòng chung kết. MC xướng "Giải Triển vọng 2", không xướng
 * "hạng 4" — nên board và bảng điều khiển phải nói đúng bằng chữ đó. Thứ hạng
 * vẫn là dữ liệu gốc (tính từ điểm), cơ cấu giải chỉ là cách đọc thứ hạng ấy.
 */
export type Award = {
  /** Dòng nhỏ phía trên chữ lớn. */
  kicker: string;
  /** Chữ lớn nhất màn hình công bố. */
  title: string;
  /** Số trong nhóm Triển vọng; null với hai giải đích danh. */
  index: number | null;
  /** Nhãn ngắn cho thang vị trí trên board. */
  short: string;
  /** Một dòng đầy đủ, dùng ở bảng của ban tổ chức và BGK. */
  full: string;
};

/** Số giải Triển vọng, tức hạng 3 → hạng 2 + SỐ GIẢI. */
export const PROMISING_COUNT = 4;

export function awardOf(rank: number): Award {
  if (rank === 1) return { kicker: 'Giải thưởng', title: 'Quán quân', index: null, short: 'QQ', full: 'Quán quân' };
  if (rank === 2) return { kicker: 'Giải thưởng', title: 'Á quân', index: null, short: 'ÁQ', full: 'Á quân' };

  const i = rank - 2;
  if (i <= PROMISING_COUNT) {
    return { kicker: 'Giải', title: 'Triển vọng', index: i, short: `TV${i}`, full: `Giải Triển vọng ${i}` };
  }

  // Ngoài cơ cấu thì không bịa thêm giải — nói đúng thứ hạng.
  return {
    kicker: 'Xếp hạng', title: 'Hạng', index: rank,
    short: String(rank).padStart(2, '0'), full: `Hạng ${rank}`,
  };
}
