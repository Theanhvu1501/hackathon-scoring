/**
 * Nhãn hiển thị cho board công khai. Tên thật của giám khảo không bao giờ rời
 * server qua /api/results — board chỉ nhận "BGK Chính" / "BGK 1" / "BGK 2"…
 * Số thứ tự chạy theo thứ tự mảng đầu vào (gọi bằng danh sách đã sort createdAt),
 * và bỏ qua trưởng BGK để "BGK 1" luôn là người thường đầu tiên.
 */
export function anonymizeJudges<T extends { id: string; isHead: boolean }>(
  judges: T[],
): (T & { label: string })[] {
  let n = 0;
  return judges.map((j) => ({ ...j, label: j.isHead ? 'BGK Chính' : `BGK ${++n}` }));
}
