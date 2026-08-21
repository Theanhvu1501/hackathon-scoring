import { describe, it, expect } from 'vitest';
import { parseScoreInput, formatScoreInput } from '@/lib/score-input';

describe('parseScoreInput', () => {
  it('ô trống là một trạng thái thật, không phải 0', () => {
    // Chính chỗ này là gốc của lỗi "xoá số đi thì nó mọc lại": ép trống thành 0
    // là ô không bao giờ rỗng được, gõ 40 vào đuôi số 0 ra "040".
    expect(parseScoreInput('', 10)).toEqual({ kind: 'empty' });
    expect(parseScoreInput('   ', 10)).toEqual({ kind: 'empty' });
  });

  it('nhận điểm lẻ 0.1', () => {
    expect(parseScoreInput('8.3', 10)).toEqual({ kind: 'ok', value: 8.3 });
    expect(parseScoreInput('0', 10)).toEqual({ kind: 'ok', value: 0 });
    expect(parseScoreInput('10', 10)).toEqual({ kind: 'ok', value: 10 });
  });

  it('nhận dấu phẩy như dấu chấm', () => {
    expect(parseScoreInput('8,4', 10)).toEqual({ kind: 'ok', value: 8.4 });
  });

  it('làm tròn về 1 chữ số thập phân', () => {
    expect(parseScoreInput('8.37', 10)).toEqual({ kind: 'ok', value: 8.4 });
  });

  it('vượt trần thì BÁO LỖI chứ không kẹp về trần', () => {
    // Kẹp âm thầm nghĩa là gõ 50 vào ô /40 thì ô nhảy về 40, người chấm tưởng
    // mình đã cho 50. Thà chặn nộp còn hơn ghi một con số họ không hề chọn.
    expect(parseScoreInput('50', 40)).toEqual({ kind: 'error', message: 'Tối đa 40đ' });
    expect(parseScoreInput('10.1', 10)).toEqual({ kind: 'error', message: 'Tối đa 10đ' });
  });

  it('số âm báo lỗi riêng', () => {
    expect(parseScoreInput('-1', 10)).toEqual({ kind: 'error', message: 'Không được âm' });
  });

  it('chữ không phải số thì báo lỗi', () => {
    for (const bad of ['abc', '8a', '1e3', '0x10', '..']) {
      expect(parseScoreInput(bad, 10).kind).toBe('error');
    }
  });

  it('cho gõ dở dang mà chưa kêu ầm lên', () => {
    // Gõ "8." là bước trung gian trên đường tới "8.3" — tô đỏ ngay lúc đó thì ô
    // nào cũng chớp đỏ một cái giữa lúc nhập.
    expect(parseScoreInput('8.', 10)).toEqual({ kind: 'ok', value: 8 });
  });
});

describe('formatScoreInput', () => {
  it('dọn số 0 thừa ở đầu', () => {
    expect(formatScoreInput('040', 40)).toBe('40');
  });
  it('đổi dấu phẩy và làm tròn', () => {
    expect(formatScoreInput('8,37', 10)).toBe('8.4');
  });
  it('để yên ô trống', () => {
    expect(formatScoreInput('', 10)).toBe('');
  });
  it('giữ nguyên chữ sai để ô vẫn đỏ', () => {
    expect(formatScoreInput('50', 40)).toBe('50');
    expect(formatScoreInput('abc', 10)).toBe('abc');
  });
});
