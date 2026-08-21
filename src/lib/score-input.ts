/**
 * Đọc nghĩa của MỘT ô nhập điểm, và cố ý không sửa chữ giám khảo đang gõ.
 *
 * Hai bài học từ phiên bản trước, cả hai đều đến từ việc ô nhập chỉ lưu được
 * `number`:
 *  - Ô trống bị ép thành 0, nên xoá số đi là nó lập tức mọc lại — muốn nhập 40
 *    thì gõ ra "040".
 *  - Nhập quá trần thì bị kẹp thẳng về trần ngay lúc gõ, người chấm không hề
 *    biết điểm mình vừa nhập đã bị đổi.
 * Nên ở đây ô trống là một trạng thái thật, và số vượt trần trả về lỗi để giao
 * diện tô đỏ, chứ không lẳng lặng đổi số.
 */
export type ParsedScore =
  | { kind: 'empty' }
  | { kind: 'ok'; value: number }
  | { kind: 'error'; message: string };

export function parseScoreInput(raw: string, maxScore: number): ParsedScore {
  // Bàn phím số trên máy Việt cho ra dấu phẩy; "8,3" là cách viết bình thường
  // của người dùng chứ không phải lỗi nhập.
  const t = raw.trim().replace(',', '.');
  if (t === '') return { kind: 'empty' };
  // Chặn cả những thứ Number() vẫn nuốt được như "1e3", "0x10", " 5 ".
  if (!/^-?\d*\.?\d*$/.test(t)) return { kind: 'error', message: 'Chỉ nhập số' };
  const n = Number(t);
  if (!Number.isFinite(n)) return { kind: 'error', message: 'Chỉ nhập số' };
  if (n < 0) return { kind: 'error', message: 'Không được âm' };
  if (n > maxScore) return { kind: 'error', message: `Tối đa ${maxScore}đ` };
  return { kind: 'ok', value: Math.round(n * 10) / 10 };
}

/**
 * Chuẩn hoá chữ trong ô, gọi lúc RỜI ô chứ không phải lúc đang gõ: sửa chữ giữa
 * lúc người ta gõ là con trỏ nhảy lung tung. "040" thành "40", "8,37" thành
 * "8.4". Chữ sai thì giữ nguyên để ô vẫn đỏ và giám khảo còn thấy mình gõ gì.
 */
export function formatScoreInput(raw: string, maxScore: number): string {
  const p = parseScoreInput(raw, maxScore);
  return p.kind === 'ok' ? String(p.value) : raw.trim();
}
