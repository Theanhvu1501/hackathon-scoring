import { describe, it, expect } from 'vitest';
import { awardOf, PROMISING_COUNT } from '@/lib/award';

describe('awardOf', () => {
  it('hai giải đích danh không có số', () => {
    expect(awardOf(1).full).toBe('Quán quân');
    expect(awardOf(2).full).toBe('Á quân');
    expect(awardOf(1).index).toBeNull();
    expect(awardOf(2).index).toBeNull();
  });

  it('Triển vọng đánh số từ hạng 3', () => {
    expect(awardOf(3).full).toBe('Giải Triển vọng 1');
    expect(awardOf(4).full).toBe('Giải Triển vọng 2');
    expect(awardOf(2 + PROMISING_COUNT).full).toBe(`Giải Triển vọng ${PROMISING_COUNT}`);
  });

  it('ngoài cơ cấu thì trả về thứ hạng, không bịa thêm giải', () => {
    const out = awardOf(3 + PROMISING_COUNT);
    expect(out.title).toBe('Hạng');
    expect(out.full).toBe(`Hạng ${3 + PROMISING_COUNT}`);
  });

  it('nhãn ngắn của thang giải là duy nhất', () => {
    const shorts = [1, 2, 3, 4, 5, 6, 7, 8].map((r) => awardOf(r).short);
    expect(new Set(shorts).size).toBe(shorts.length);
  });
});
