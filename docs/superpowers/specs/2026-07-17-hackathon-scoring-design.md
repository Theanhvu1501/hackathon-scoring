# Hệ thống chấm điểm — Automotive Hackathon 2026 (Chung kết)

**Ngày:** 2026-07-17
**Trạng thái:** Spec đã duyệt sơ bộ, chờ user review

## 1. Mục tiêu

Xây dựng hệ thống chấm điểm cho vòng **chung kết** (vòng duy nhất) của cuộc thi
Automotive Hackathon 2026. Hệ thống gồm ba mặt trong một codebase:

- **Admin CMS** — quản trị toàn bộ.
- **BGK CMS** — ban giám khảo nhập điểm và xem kết quả.
- **Frontend công khai** — bảng xếp hạng realtime cho khán giả / màn chiếu sự kiện.

Trang gốc tham chiếu: https://fptautomotive-hackathon.com/ (dùng để bám ngôn ngữ thiết kế).

## 2. Vai trò (Role)

Chỉ có **2 role**: `admin` và `judge` (ban giám khảo).

- Tài khoản BGK do Admin tạo.
- **Không dùng mật khẩu.** Mỗi tài khoản (admin & judge) có một **access_code ngẫu nhiên**
  (magic link hoặc code 8 ký tự) do Admin cấp. Đăng nhập = nhập/click 1 lần.
  → Quyết định này thay cho spec gốc "chọn tên tài khoản là vào", để tránh việc bất kỳ ai
  biết tên tài khoản đều chấm điểm được.
- **Thành viên đội KHÔNG phải user** — không đăng nhập, chỉ là dữ liệu do Admin nhập.

## 3. Mô hình dữ liệu

```
User        : id, họ tên, role (admin | judge), is_head (Trưởng BGK — người quyết định),
              access_code (unique, random), active, created_at
Team        : id, tên đội, logo (URL/upload), mô tả ngắn, created_at
Member      : id, team_id, họ tên, vai_trò_trong_đội, ảnh_đại_diện (URL/upload),
              đơn_vị (trường/công ty), email, sđt, intro (đoạn giới thiệu tự do)
Criterion   : id, tên tiêu chí, điểm_tối_đa, mô tả, thứ_tự      ← cấu trúc "barem"
Score       : id, judge_id, team_id, criterion_id, điểm         ← 1 điểm / BGK / tiêu chí
Submission  : judge_id, team_id, submitted (bool), submitted_at ← BGK đã chốt đội này chưa
Settings    : reveal_state (drafting | provisional | final)     ← bước công bố (xem mục 4.4)
AuditLog    : id, actor_id, action, target, timestamp           ← ghi sửa điểm / publish
```

Ghi chú:
- **Không có** entity `Round` (vòng thi) hay `Submission/bài thi` riêng: **1 đội = 1 bài**,
  chấm theo **1 barem duy nhất**.
- **Barem là danh sách tiêu chí phẳng**. Tổng điểm tối đa = tổng các `điểm_tối_đa`
  (KHÔNG hardcode 50). Mai lấy barem thật về chỉ cần nhập, không sửa code.
- Ví dụ barem: `[{code đẹp, 10}, {chạy không limit, 10}, ...]`.
- Điểm cho phép số lẻ (0.5).

## 4. Luồng nghiệp vụ

### 4.1 Admin
- CRUD đội thi (gồm logo đội).
- CRUD thành viên (thuộc đội).
- CRUD tài khoản BGK → sinh access_code, đưa cho từng BGK.
- Cấu hình barem: thêm/sửa/xoá tiêu chí, đặt điểm tối đa và thứ tự.
- Xem tiến độ chấm (BGK nào đã submit đội nào).
- Điều khiển **cơ chế công bố 3 trạng thái** (mục 4.4): mở điểm tạm, và lộ điểm Trưởng BGK.
- Có thể **quay lui** để BGK sửa điểm rồi công bố lại. Mọi thao tác ghi vào AuditLog.

### 4.2 Ban giám khảo (Judge)
- Đăng nhập bằng access_code.
- Xem danh sách đội + profile thành viên.
- Nhập điểm theo barem cho từng đội (mỗi tiêu chí một ô điểm ≤ điểm tối đa).
- **Submit** điểm cho từng đội (chốt). Có thể sửa trước khi Admin publish (nếu Admin cho phép).
- **Trong lúc chấm chỉ thấy điểm của chính mình.** Chỉ sau khi Admin Public mới xem được
  bảng kết quả tổng hợp của tất cả đội.
  → Thay cho spec gốc "public theo tất cả tài khoản bgk", để tránh neo điểm theo người chấm trước.

### 4.3 Công thức xếp hạng
- Điểm 1 đội = **trung bình cộng** điểm tổng của các BGK **đã chấm** đội đó
  (giữ nguyên thang barem). Điểm tổng của 1 BGK cho 1 đội = tổng điểm các tiêu chí.
- **Điểm tạm** (trạng thái `provisional`) = trung bình các BGK **trừ Trưởng BGK**.
- **Điểm chung cuộc** (trạng thái `final`) = trung bình gồm **cả Trưởng BGK**.
- Xếp hạng: **điểm cao đứng trước** (điểm cao thắng).
- **Hoà điểm:** cùng hạng, hiển thị `T2` kiểu golf; thứ tự phụ theo tên đội (A→Z).

### 4.4 Cơ chế công bố "reveal" (kết hợp realtime + kịch tính MC)

Máy trạng thái 3 bước, do Admin điều khiển, phát realtime tới màn công khai:

| Bước | reveal_state | Màn công khai | Ghi chú |
|---|---|---|---|
| 1 | `drafting` | Màn chờ "Sắp công bố" | BGK đang chấm, chưa lộ gì |
| 2 | `provisional` | **Bảng điểm tạm nhảy realtime** — trung bình các BGK *trừ Trưởng BGK*, nhãn rõ "Điểm tạm · chờ Trưởng BGK" | Khán giả thấy điểm nhảy khi từng BGK nộp |
| 3 | `final` | Admin bấm **"Lộ điểm Trưởng BGK"** (MC hô) → điểm Trưởng BGK rơi vào **tất cả đội cùng lúc** → bảng reshuffle → **bục huy chương top 3** hiện ra | Khoá kết quả chung cuộc |

**Công bằng — chống neo điểm:** Trưởng BGK phải **chấm "mù"** (nộp điểm trước, không nhìn bảng
điểm tạm). Hệ thống giữ kín điểm Trưởng BGK ở server tới bước 3; lúc "lộ" chỉ là hiệu ứng trình
diễn, không ai sửa được nữa → kịch tính nhưng kết quả đã cố định từ trước.

**Quay lui:** Admin có thể lùi `final → provisional → drafting` để chỉnh, rồi tiến lại.

## 5. Frontend công khai (Leaderboard)

- **Bục huy chương top 3:** khi vào bước `final`, phía trên bảng hiện **podium** —
  hạng 2 (bạc) · hạng 1 (vàng, cao nhất, giữa) · hạng 3 (đồng), kèm logo + tên + điểm đội.
- Bên dưới podium là **bảng xếp hạng đầy đủ kiểu golf:** hạng `1`, `T2`, `T2`, `4`...;
  hàng tự **trượt lên/xuống** khi đổi hạng; có cột biến động ▲/▼.
- **Điểm cao thắng** (mượn giao diện golf, không mượn luật điểm thấp thắng).
- Ở bước `provisional`: chỉ có bảng đầy đủ (điểm tạm, chưa có podium), nhãn "ĐIỂM TẠM".
  Podium chỉ xuất hiện ở bước `final`.
- **Realtime:** Admin đổi trạng thái / BGK nộp điểm → server phát sự kiện qua **SSE** →
  mọi trình duyệt FE đang mở cập nhật ngay, bảng animate vào vị trí.
- Mỗi hàng hiển thị **logo đội** + tên đội + điểm.
- Thiết kế cho **màn chiếu lớn**: số điểm to, tương phản cao, đọc từ xa.

## 6. Thiết kế giao diện (bám theme **sáng** của trang gốc)

Lấy đúng bộ token light của https://fptautomotive-hackathon.com/ :

- **Nền trang:** `#f3f7ff`; nền phụ `#e8eeff`; card/panel: `#ffffff`.
- **Chữ:** chính `#0a1f48`, phụ `#334769`, nhạt `#788caa`.
- **Màu chủ đạo:** cam FPT `#f37021` → `#ff9730` (gradient) — dùng cho CTA, nhấn mạnh, hạng 1.
- **Accent:** xanh `#2563eb` / `#001af0`, cyan `#0099cc`.
- **Gradient đặc trưng:** cam→xanh (`linear-gradient(135deg,#f37021,#2563eb)`).
- **Font:** `Space Grotesk` (tiêu đề, số điểm), `Inter` (nội dung).
- **CMS full-width** (không giới hạn bề ngang); màn công khai full-bleed cho màn chiếu.
- Podium top 3: hạng 2 (bạc) trái · hạng 1 (vàng, cao nhất, có vương miện) giữa · hạng 3 (đồng) phải.

Mockup tham chiếu đã duyệt: `mockups/index.html` (12 màn, có demo reveal + podium).

## 7. Công nghệ

- **Next.js** (App Router) — 1 codebase cho CMS + FE + API routes.
- **PostgreSQL + Prisma** — ORM, migration.
- **Realtime:** SSE (Server-Sent Events) — đủ cho quy mô nhỏ.
- **Tailwind CSS** — khớp phong cách trang gốc.
- **Deploy:** Vercel/Railway.

## 8. Quy mô

Nhỏ: < 20 đội, < 10 BGK, vài trăm người xem realtime đồng thời.

## 9. Những điểm khác biệt so với spec gốc (cần user xác nhận)

1. **Login BGK:** access_code ngẫu nhiên thay vì "chọn tên là vào".
2. **Công bố:** dùng cơ chế **reveal 3 bước do Admin điều khiển** (điểm tạm → lộ Trưởng BGK),
   thay vì "sau khi BGK bấm public". BGK chỉ có nút Submit.
3. **BGK xem điểm nhau:** chỉ sau khi vào bước `final`, thay vì công khai ngay giữa các BGK.
4. **Trưởng BGK** là lá bài quyết định, chấm "mù", điểm được giữ kín tới phút chót.

## 10. Ngoài phạm vi (YAGNI)

- Quản lý nhiều vòng thi.
- Nhiều bài thi / đội.
- Đăng nhập cho thành viên đội.
- Trọng số BGK, loại điểm cao/thấp nhất (có thể thêm sau nếu barem yêu cầu).
