# Tổng điểm, banner màn chờ, popup chi tiết điểm BGK

Ngày: 2026-07-25

Ba thay đổi độc lập nhau, gộp vào một lần triển khai.

## A. Xếp hạng theo tổng điểm thay vì trung bình cộng

### Hiện tại

`teamAverage()` trong `src/lib/scoring.ts` cộng tổng điểm của từng giám khảo rồi
chia cho số giám khảo đã chấm. Bảng điểm hiển thị `score / baremTotal`, trong đó
`baremTotal` là tổng barem của **một** giám khảo (5 tiêu chí × 10đ = 50).

### Sau thay đổi

`teamAverage()` đổi tên thành `teamTotal()`, bỏ phép chia, trả về
`{ total, judgeCount }`. Không đụng vào cơ chế loại trưởng BGK — phase
`provisional` vẫn loại, phase `final` vẫn tính.

Mẫu số hiển thị đổi thành:

```
maxTotal = baremTotal × số giám khảo được tính ở phase đó
```

Số giám khảo được tính là **số giám khảo đang active trong hệ thống**, không phải
số giám khảo đã chấm đội đó:

- phase `provisional`: tất cả giám khảo active trừ trưởng BGK
- phase `final`: tất cả giám khảo active

Hệ quả có chủ ý: đội mới được 1 trong 4 giám khảo chấm sẽ hiện `43.0 / 200` với
thanh bar ngắn. Đây là hành vi mong muốn — nó cho thấy đội chưa chấm xong, và
thanh bar giữa các đội vẫn so sánh được với nhau vì chung mẫu số.

### Chỗ phải sửa

- `src/lib/scoring.ts` — `teamAverage` → `teamTotal`
- `src/lib/services/reveal.ts` — `getResults()` trả thêm `maxTotal`
- `src/components/Leaderboard.tsx:45` — mẫu số
- `src/components/board/LeaderBand.tsx:55` — mẫu số
- `src/components/board/TimingTower.tsx:76,77,111` — mẫu số và tỉ lệ thanh bar
- `src/app/(judge)/judge/results/page.tsx:15` — nhãn "Điểm TB" → "Tổng điểm"
- `tests/scoring.test.ts` — cập nhật kỳ vọng

`baremTotal` vẫn được trả về vì `BoardRail` dùng nó cho phần chú thích thang điểm.

## B. Banner ở màn hình chờ

### Phạm vi

Chỉ đổi màn hình khi `revealState === 'drafting'` (chưa bật realtime). Trạng thái
`provisional` và `final` giữ nguyên hoàn toàn giao diện pitwall hiện tại.

### Thiết kế

Thêm cột `bannerImageUrl` vào `Settings` — **không** dùng lại `heroImageUrl`.
Lý do: `heroImageUrl` vẫn đang phục vụ panel ảnh **dọc** bên trái của `LeaderBand`
khi chạy realtime, còn banner là ảnh **ngang** phủ toàn màn hình. Một ảnh không
gánh được cả hai khung hình.

Màn chờ mới: ảnh banner phủ kín viewport (`object-fit: cover`), chỉ còn link
"Ban tổ chức · Đăng nhập" ở góc.

Chưa upload banner thì rơi về màn chờ chữ hiện tại. Đây cũng chính là cách giữ
lại giao diện cũ để dùng lại — không cần thêm cờ bật/tắt.

### Chỗ phải sửa

- `prisma/schema.prisma` + migration mới — thêm `Settings.bannerImageUrl`
- `src/lib/services/reveal.ts` — getter/setter cho banner, `getResults()` trả thêm
- `src/app/api/board/image/route.ts` — nhận thêm `bannerImageUrl`
- `src/app/(admin)/admin/publish/page.tsx` — thêm ô upload thứ hai
- `src/app/board/page.tsx` — nhánh `drafting` hiện banner nếu có
- `src/app/board/board.css` — style cho banner

## C. Popup chi tiết điểm của một giám khảo

### Thiết kế

Admin bấm "Xem điểm" ở một dòng trong `admin/judges` → mở `Modal` (component có
sẵn) chứa bảng:

| Đội | mỗi tiêu chí một cột | Tổng | Trạng thái |
|---|---|---|---|

Trạng thái mỗi đội:

- **Đã nộp** — có điểm và tất cả bản ghi `submitted = true`
- **Nháp** — có điểm nhưng chưa nộp
- **Chưa chấm** — không có bản ghi điểm nào

Chỉ đọc. Admin không sửa được điểm của giám khảo từ đây.

### Chỗ phải sửa

- `src/lib/services/scores.ts` — thêm `judgeScoreDetail(judgeId)`
- `src/app/api/judges/[id]/scores/route.ts` — route mới, chặn non-admin
- `src/app/(admin)/admin/judges/page.tsx` — nút + modal
- `tests/services.scores.test.ts` — test cho service mới

## Ngoài phạm vi

`getResults()` không trả `criteria`, `judges`, `teamCount` trong khi
`board/page.tsx:144-150` có đọc ba trường này, nên khi chạy dữ liệu thật panel
"Tiến độ chấm" bị ẩn và thanh bar không tách màu theo tiêu chí. Đã báo cho chủ dự
án, chưa được yêu cầu sửa nên để nguyên.
