/**
 * Nhãn hiển thị cho board công khai. Tên thật của giám khảo không bao giờ rời
 * server qua /api/results — board chỉ nhận "BGK 1" / "BGK 2"…
 * Số thứ tự chạy theo thứ tự mảng đầu vào (gọi bằng danh sách đã sort createdAt),
 * nên nhãn của một người không đổi giữa các lần tải trang.
 */
export function anonymizeJudges<T extends { id: string }>(
  judges: T[],
): (T & { label: string })[] {
  return judges.map((j, i) => ({ ...j, label: `BGK ${i + 1}` }));
}
