# Công bố 2 bước, phân quyền superadmin, audit log, khoá phiếu chấm

Ngày: 2026-08-17 · Nhánh: `fpt`

Bảy yêu cầu cập nhật, gộp vào một lần triển khai. Chúng chia thành bốn khối
tương đối độc lập: **luồng công bố** (A), **phân quyền + audit** (B, C, D),
**khu ban giám khảo** (E, F), **chấm điểm** (G).

Quyết định đã chốt với người dùng trong lúc brainstorm được ghi lại ở mục
[Các lựa chọn đã chốt](#các-lựa-chọn-đã-chốt) cuối tài liệu.

---

## A. Màn hình công bố còn 2 bước, công bố lần lượt từng đội

### Hiện tại

`Settings.revealState` là enum ba trạng thái `drafting → provisional → final`:

- `drafting` — board hiện banner (nếu admin up ảnh) hoặc màn chờ mặc định
- `provisional` — board hiện bảng điểm realtime, **loại điểm Trưởng BGK**
- `final` — lộ điểm Trưởng BGK, thứ hạng có thể đảo lại

Trang `/admin/publish` là một stepper 3 bước bám đúng ba trạng thái này.

### Sau thay đổi

Bỏ enum `RevealState` và cột `Settings.revealState`. Thay bằng hai mảnh dữ liệu:

| Schema | Ý nghĩa |
|---|---|
| `Team.revealedAt DateTime?` | đội đã được công bố lúc nào; `null` = chưa |
| `Settings.judgeScoresRevealed Boolean @default(false)` | bước 2 đã mở chưa |

Trạng thái board **suy ra** từ hai mảnh đó, không lưu riêng:

```
state = judgeScoresRevealed ? 'judges'
      : (có ít nhất 1 đội revealedAt != null) ? 'ranks'
      : 'waiting'
```

`getResults()` vẫn trả field `state` với ba giá trị mới này, nên board và trang
kết quả BGK không phải viết lại phần điều phối màn hình.

Lý do chọn cách suy ra thay vì thêm enum mới: hai bước công bố **không phải là
một chuỗi tuyến tính** — bước 1 diễn ra dần dần qua nhiều lần ấn (mỗi đội một
lần), nên trạng thái thật nằm ở tập các đội đã công bố, không nằm ở một cột enum.
Lưu enum song song sẽ tạo hai nguồn chân lý có thể lệch nhau.

### Xếp hạng

**Hạng là hạng thật trên toàn bộ đội**, tính từ mọi điểm trong DB, không phụ
thuộc đội nào đã được công bố. Công bố đội hạng 4 trước thì board hiện `#4`.

Bỏ hẳn cơ chế giữ kín điểm Trưởng BGK:

- `scoring.ts`: bỏ `Phase`, bỏ tham số `phase`/`headJudgeId` của
  `computeLeaderboard`, bỏ `opts.excludeJudgeId` của `teamTotal`, bỏ hàm
  `countedJudges` (thay bằng `số giám khảo active`).
- `maxTotal = baremTotal × số giám khảo active` — không còn phụ thuộc phase.
- `User.isHead` **giữ lại**, chỉ còn dùng để hiện nhãn `BGK Chính`.

### Board (`/board`)

Bốn màn hình thay cho ba màn hình hiện tại:

1. **`banner`** — `state === 'waiting'` và có `bannerImageUrl`. Giữ nguyên.
2. **`wait`** — `state === 'waiting'`, không có banner. Giữ nguyên màn chờ hiện tại.
3. **`board`** — `state === 'ranks'` hoặc `'judges'`. Timing tower chỉ chứa các
   đội **đã công bố**, sắp theo hạng thật.
4. **`spotlight`** — overlay phủ lên `board`, hiện khi vừa có đội được công bố.

Overlay spotlight: `HẠNG #n` cỡ lớn + logo + tên đội + tổng điểm, tự tắt sau
`SPOTLIGHT_MS = 6000`, rồi đội đó xuất hiện trong tower bên dưới.

Cơ chế trigger là **event SSE**, không phải so sánh state:

```ts
es.addEventListener('reveal', (e) => {
  const d = JSON.parse(e.data);          // { teamId?: string, judges?: true, reset?: true }
  if (d.teamId) setSpotlight(d.teamId);
  load();
});
```

Chọn cách này vì nó cho đúng ngữ nghĩa "vừa xảy ra": F5 lại trang board sẽ
**không** chiếu lại spotlight của đội đã công bố từ trước, còn nếu so sánh
`revealedAt` giữa hai lần fetch thì sẽ phát lại sai lúc.

Khi `state === 'judges'`: mỗi dòng trong tower hiện thêm **một dải chip inline**
dưới thanh bar — `BGK Chính 9.5 · BGK 1 9.0 · BGK 2 9.5 · …` — nhãn theo thứ tự
`createdAt`, **không hiện tên thật**. Chọn inline thay vì bắt bấm mở modal vì đây
là khoảnh khắc cả phòng đang xem, không ai bấm chuột.

`JudgeScoresModal` giữ lại cho ai muốn xem to hơn, cũng đổi sang nhãn ẩn tên, và
nút mở nó **chỉ hiện khi `state === 'judges'`** — trước bước 2 thì điểm BGK chưa
được công bố, nút không được tồn tại.

Tên thật của giám khảo **không được gửi xuống** `/api/results` nữa: đây là API
công khai, không đăng nhập, nên ẩn ở tầng UI là không đủ. `getResults()` trả
`{ judgeId, label, isHead, total }` với `label` đã ẩn danh.

### Trang `/admin/publish`

Stepper 2 bước:

**Bước 1 — Công bố thứ hạng.** Bảng các đội sắp theo **hạng giảm dần** (hạng bét
lên đầu) để admin xướng tên từ dưới lên. Mỗi dòng: hạng, tên đội, tổng điểm, và
nút `Công bố` (hoặc `↩ Thu hồi` nếu đã công bố). Có badge đếm `đã công bố 3/12`.

**Bước 2 — Công bố điểm BGK.** Nút bật `judgeScoresRevealed`. Chỉ bật được khi
đã công bố ít nhất một đội.

Ngoài stepper: nút `Reset về màn chờ` (xoá hết `revealedAt` + tắt cờ bước 2),
có confirm. Hai ô `ImagePicker` cho banner và ảnh hero giữ nguyên.

### API

`/api/reveal` đổi từ `POST { state }` sang bốn action:

| Request | Việc làm |
|---|---|
| `POST { action: 'revealTeam', teamId }` | set `revealedAt = now()`, broadcast `{ teamId }` |
| `POST { action: 'unrevealTeam', teamId }` | set `revealedAt = null`, broadcast `{ teamId, undo: true }` |
| `POST { action: 'revealJudges' }` | set cờ, broadcast `{ judges: true }` |
| `POST { action: 'reset' }` | xoá hết `revealedAt` + tắt cờ, broadcast `{ reset: true }` |

`GET /api/reveal` trả `{ state, revealedTeamIds, judgeScoresRevealed }`.

Mọi action ghi audit log (mục C).

### Chỗ phải sửa

- `prisma/schema.prisma` — bỏ enum `RevealState` + `Settings.revealState`, thêm
  `Team.revealedAt`, `Settings.judgeScoresRevealed`
- `src/lib/scoring.ts` — bỏ phase/head-exclusion, bỏ `countedJudges`
- `src/lib/services/reveal.ts` — `revealTeam` / `unrevealTeam` / `revealJudgeScores`
  / `resetReveal` / `deriveState`; `getResults()` trả thêm `revealedTeamIds`,
  nhãn giám khảo ẩn danh
- `src/app/api/reveal/route.ts` — bốn action
- `src/app/(admin)/admin/publish/page.tsx` — viết lại thành 2 bước
- `src/components/board/BoardScreen.tsx` — thêm màn `spotlight`, lọc rows theo
  đội đã công bố, đọc payload SSE
- `src/components/board/SpotlightReveal.tsx` — **mới**
- `src/components/board/TimingTower.tsx` + `JudgeScoresModal.tsx` — nhãn ẩn danh,
  chỉ hiện nút "Điểm BGK" khi `state === 'judges'`
- `src/components/board/LeaderBand.tsx` — bỏ prop `isFinal`
- `src/app/board/board.css` — style spotlight
- `src/lib/mock-board.ts` — `MockOptions.state` đổi sang `'waiting' | 'ranks' | 'judges'`,
  bỏ logic loại head, thêm `revealedTeamIds`
- `src/app/board/page.tsx` — `?mock=wait|ranks|judges`
- `src/app/(judge)/judge/results/page.tsx` — nhãn theo state mới
- `src/components/Leaderboard.tsx` — mẫu số không còn phụ thuộc phase
- `tests/scoring.test.ts`, `tests/reveal-flow.test.ts` — viết lại theo state mới

---

## B. Role `superadmin` và tài khoản admin cho khách hàng

### Hiện tại

`enum Role { admin, judge }`. Seed tạo đúng một user `admin` tên "Ban tổ chức"
với mã từ `ADMIN_ACCESS_CODE`. Mọi API admin kiểm tra `u?.role !== 'admin'`.

### Sau thay đổi

Thêm giá trị `superadmin` vào enum `Role`.

- `superadmin` — tài khoản nội bộ. Làm được **mọi thứ** `admin` làm, cộng thêm:
  xem `/admin/audit`, quản lý tài khoản admin ở `/admin/accounts`.
- `admin` — tài khoản khách hàng. Toàn quyền vận hành (đội, thành viên, BGK,
  barem, công bố, mở khoá phiếu) nhưng **không** thấy audit log và **không**
  tạo/sửa/xoá được tài khoản admin nào.

Layout `/admin` nhận cả hai role. `Shell` nhận `role: 'admin' | 'superadmin' | 'judge'`;
nav admin thêm 2 mục chỉ hiện với `superadmin`.

### Helper quyền

Thêm vào `src/lib/auth.ts`:

```ts
export type SessionUser = { id, name, role, isHead, active };
export async function requireRole(...roles: Role[]): Promise<SessionUser | null>;
export const isAdminish = (u) => u?.role === 'admin' || u?.role === 'superadmin';
```

Mọi route API đổi từ `if (u?.role !== 'admin')` sang `requireRole('admin', 'superadmin')`.
Đây là refactor bắt buộc — bỏ sót một route là admin khách hàng mất quyền hoặc
superadmin bị chặn.

### Tạo tài khoản trên DB đang chạy

`prisma/seed.ts` **xoá sạch** dữ liệu, không dùng được trên production. Thêm
script mới **không phá dữ liệu**:

`prisma/ensure-accounts.ts` → `npm run accounts`

- Upsert 1 superadmin, mã từ `SUPERADMIN_ACCESS_CODE` (bắt buộc, không có default)
- Upsert 1 admin khách hàng, mã từ `ADMIN_ACCESS_CODE`
- Chạy nhiều lần vẫn an toàn; in ra mã của từng tài khoản
- Không đụng vào team / member / criterion / score

`prisma/seed.ts` cũng cập nhật để tạo cả superadmin (cho môi trường local).

`.env.example` + `docs/DEPLOY.md` thêm `SUPERADMIN_ACCESS_CODE` và bước
`npm run accounts` khi nâng cấp bản đang chạy.

### Trang `/admin/accounts` (chỉ superadmin)

`DataTable` các user role `admin` + `superadmin`: tên, role, mã truy cập, trạng
thái active, thao tác. Tạo / sửa tên / sửa mã tay / đổi mã / bật-tắt active / xoá.

Chốt an toàn: **không xoá và không tắt active chính mình**, và **luôn phải còn
lại ít nhất một superadmin active**. Kiểm ở tầng service, không chỉ ở UI.

### API mới

`/api/accounts` (GET, POST) và `/api/accounts/[id]` (PATCH, POST action `regen`,
DELETE) — tất cả `requireRole('superadmin')`.

### Chỗ phải sửa

- `prisma/schema.prisma` — enum `Role` thêm `superadmin`
- `src/lib/auth.ts` — `requireRole`, `isAdminish`
- `src/app/(admin)/admin/layout.tsx` — nhận cả hai role
- `src/components/Shell.tsx` — role mới, nav theo role, nhãn "Super Admin"
- 12 route API admin — đổi sang `requireRole`
- `src/lib/services/accounts.ts` — **mới**
- `src/app/api/accounts/route.ts`, `src/app/api/accounts/[id]/route.ts` — **mới**
- `src/app/(admin)/admin/accounts/page.tsx` — **mới**
- `prisma/ensure-accounts.ts` — **mới**; `package.json` thêm script `accounts`
- `prisma/seed.ts`, `.env.example`, `docs/DEPLOY.md`

---

## C. Audit log — ghi mọi thay đổi dữ liệu

### Hiện tại

Model `AuditLog { id, actorId, action, target, createdAt }` đã có sẵn nhưng chỉ
được ghi ở đúng một chỗ: `setRevealState()`. Không có UI xem.

### Sau thay đổi

Mở rộng model:

```prisma
model AuditLog {
  id        String   @id @default(cuid())
  actorId   String?
  actorName String?                      // snapshot: user có thể bị xoá sau đó
  actorRole String?
  action    String                       // 'team.create', 'score.unlock', …
  entity    String?                      // 'team' | 'member' | 'judge' | …
  entityId  String?
  target    String?                      // tên người-đọc-được của đối tượng
  detail    String?                      // mô tả ngắn, ví dụ 'maxScore: 10 → 15'
  createdAt DateTime @default(now())
  @@index([createdAt])
  @@index([entity, entityId])
}
```

`actorName` là **snapshot** cố ý: xoá một BGK không được làm mất dấu vết ai đã
thao tác gì.

### Helper

`src/lib/audit.ts`:

```ts
export async function audit(
  actor: { id: string; name: string; role: string } | null,
  action: string,
  opts?: { entity?, entityId?, target?, detail? },
): Promise<void>;
```

Không bao giờ throw — một lỗi ghi log không được làm hỏng thao tác chính. Bọc
`try/catch` và `console.error` bên trong.

### Điểm ghi log

| entity | action |
|---|---|
| `auth` | `auth.login`, `auth.logout`, `auth.login_failed` |
| `team` | `team.create`, `team.update`, `team.delete` |
| `member` | `member.create`, `member.update`, `member.delete` |
| `judge` | `judge.create`, `judge.update`, `judge.delete`, `judge.regen_code`, `judge.set_code`, `judge.set_head` |
| `account` | `account.create`, `account.update`, `account.delete`, `account.regen_code`, `account.set_code` |
| `criterion` | `criterion.create`, `criterion.update`, `criterion.delete` |
| `score` | `score.save`, `score.submit`, `score.unlock` |
| `reveal` | `reveal.team`, `reveal.unteam`, `reveal.judges`, `reveal.reset` |
| `settings` | `settings.hero_image`, `settings.banner_image` |

`auth.login_failed` chỉ ghi mã đã thử **4 ký tự đầu** + `***`, không ghi mã đầy đủ.

`score.save` (lưu nháp) ghi mỗi lần lưu — có thể nhiều. Chấp nhận: đây là dữ
liệu quan trọng nhất cần truy vết, và một sự kiện chấm điểm là vài trăm dòng cho
cả giải, không phải vấn đề dung lượng.

### Trang `/admin/audit` (chỉ superadmin)

Bảng: thời điểm, người thao tác (+ role), hành động (nhãn tiếng Việt), đối tượng,
chi tiết. Tìm kiếm theo tên người / đối tượng, lọc theo `entity`, phân trang 50
dòng (`GET /api/audit?page=&entity=&q=`). Sắp mới nhất trước.

### Chỗ phải sửa

- `prisma/schema.prisma` — mở rộng `AuditLog`
- `src/lib/audit.ts` — **mới**
- `src/lib/services/audit.ts` — **mới** (truy vấn + phân trang)
- `src/app/api/audit/route.ts` — **mới**
- `src/app/(admin)/admin/audit/page.tsx` — **mới**
- Toàn bộ route mutation: `api/teams`, `api/teams/[id]`, `api/members`,
  `api/members/[id]`, `api/criteria`, `api/criteria/[id]`, `api/judges`,
  `api/judges/[id]`, `api/scores`, `api/reveal`, `api/board/image`,
  `api/auth/login`, `api/auth/logout`

---

## D. Mã login sửa được bằng tay, đổi mã phải xác nhận

### Hiện tại

`generateAccessCode()` sinh mã dạng `XXXX-XXXX`. Nút `↻ Đổi mã` ở
`/admin/judges` gọi API **đổi ngay lập tức, không hỏi gì**. Không có đường nào
sửa mã bằng tay.

### Sau thay đổi

**Validate mã** — hàm mới trong `src/lib/access-code.ts`:

```ts
export function normalizeAccessCode(raw: string): string;   // trim + uppercase
export function validateAccessCode(code: string): string | null;  // null = hợp lệ
```

Ràng buộc: 4–32 ký tự, chỉ `A–Z`, `0–9`, `-`. Không kiểm trùng ở đây (trùng là
việc của service, cần DB).

Chuẩn hoá về uppercase là bắt buộc vì `/api/auth/login` đang tra
`accessCode: code.trim().toUpperCase()` — mã lưu chữ thường sẽ **không đăng nhập
được**. Service trả lỗi rõ ràng khi trùng, không ghi đè im lặng.

**Sửa tay:** `PATCH /api/judges/[id]` nhận thêm `accessCode`; ô input nằm trong
modal *Sửa giám khảo*, hiện mã hiện tại làm giá trị mặc định. Tương tự cho
`/api/accounts/[id]`.

**Xác nhận khi đổi mã:** nút `↻ Đổi mã` bọc `useConfirm()` (đã có
`ConfirmProvider`):

> **Đổi mã truy cập** — Mã hiện tại `ABCD-EFGH` sẽ hết hiệu lực ngay. Nếu giám
> khảo này đang đăng nhập, phiên của họ vẫn còn hạn nhưng mã cũ không dùng lại
> được. Xác nhận đổi?

Ô sửa tay cũng confirm khi mã thay đổi so với mã cũ.

Quyền: mã BGK — `admin` + `superadmin`; mã tài khoản admin — chỉ `superadmin`.

### Chỗ phải sửa

- `src/lib/access-code.ts` — `normalizeAccessCode`, `validateAccessCode`
- `src/lib/services/judges.ts` — `setAccessCode(id, code)` với kiểm trùng
- `src/lib/services/accounts.ts` — dùng lại
- `src/app/api/judges/[id]/route.ts` — PATCH nhận `accessCode`
- `src/app/(admin)/admin/judges/page.tsx` — ô sửa mã + confirm cho `Đổi mã`
- `tests/services.judges.test.ts` — ca sửa tay, trùng, sai format

---

## E. BGK xem danh sách từng đội

### Hiện tại

`/judge` là lưới card các đội, click vào là **vào luôn trang chấm điểm**. Không
có đường nào xem thông tin đội / thành viên. Admin thì có `/admin/teams/[id]`.

### Sau thay đổi

Trang mới `/judge/team/[id]` — read-only: tên đội, code, tagline, logo, và danh
sách thành viên (ảnh, tên, vai trò trong đội, đơn vị, giới thiệu). Không có
email/điện thoại — đó là dữ liệu liên hệ, không cần cho việc chấm.

Card ở `/judge` tách thành hai đường: bấm vào thân card → xem chi tiết đội; nút
`Chấm điểm` → trang chấm. Trang chi tiết đội có nút `Chấm điểm đội này`.

API: `GET /api/teams/[id]` mở cho cả `judge` (hiện chỉ admin). Không trả
`email` / `phone` của thành viên khi người gọi là `judge`.

### Chỗ phải sửa

- `src/lib/services/teams.ts` — `getTeamForJudge(id)` (bỏ field liên hệ)
- `src/app/api/teams/[id]/route.ts` — GET cho judge
- `src/app/(judge)/judge/team/[id]/page.tsx` — **mới**
- `src/app/(judge)/judge/page.tsx` — card tách 2 đường
- `src/components/Shell.tsx` — breadcrumb `/judge/team/`

---

## F. BGK xem điểm của BGK khác

### Sau thay đổi

Trang mới `/judge/scores` — bảng **đội × giám khảo**:

- Hàng: đội (sắp theo `createdAt`, **không** theo hạng — trang này để đối chiếu
  phiếu, không phải bảng xếp hạng)
- Cột: từng giám khảo, **tên thật** (ẩn tên chỉ áp dụng cho board công khai)
- Ô: tổng điểm của giám khảo đó cho đội đó, hoặc `—` nếu chưa chấm; ô nháp có
  dấu hiệu riêng
- Cột cuối: tổng của đội
- Cột của chính người đang đăng nhập được tô nhấn

Không có breakdown từng tiêu chí — người dùng chốt mức "tổng theo đội".

API mới `GET /api/scores/matrix`, mở cho `judge` + `admin` + `superadmin`. Trả:

```ts
{
  judges: { id, name, isHead, isMe }[],
  rows: { teamId, teamName, teamCode,
          cells: { judgeId, total: number | null, status: 'submitted'|'draft'|'none' }[],
          total: number | null }[]
}
```

Nav BGK thêm mục `Điểm ban giám khảo`.

### Chỗ phải sửa

- `src/lib/services/scores.ts` — `scoreMatrix(viewerId)`
- `src/app/api/scores/matrix/route.ts` — **mới**
- `src/app/(judge)/judge/scores/page.tsx` — **mới**
- `src/components/Shell.tsx` — nav + breadcrumb
- `tests/services.scores.test.ts` — ca ma trận

---

## G. Nộp điểm là khoá, và không nhập quá điểm max

### G1. Cảnh báo + khoá sau khi nộp

**Hiện tại:** `POST /api/scores` upsert vô điều kiện với `submitted` lấy từ
body. BGK nộp rồi vào lại vẫn sửa và nộp lại được, không có cảnh báo nào.

**Sau thay đổi:**

- Trước khi nộp, confirm:

  > **Nộp điểm · {tên đội}** — Sau khi nộp, bạn **không thể sửa** điểm đội này
  > nữa. Chỉ ban tổ chức mới mở khoá được. Tổng điểm bạn chấm: **{total}/{max}**.
  > Xác nhận nộp?

- Server: `POST /api/scores` trả **409 `{ error: 'locked' }`** nếu cặp
  (judge, team) đã có bất kỳ dòng `submitted = true`. Chốt ở tầng service
  (`isCardLocked(judgeId, teamId)`), không chỉ ở UI — UI chặn được nhưng API
  vẫn mở là không khoá gì cả.
- Trang chấm điểm: phiếu đã nộp → mọi input `disabled`, banner
  *"Phiếu đã nộp lúc {thời điểm} · không thể sửa"*, ẩn hai nút lưu/nộp.
- `/judge` card đội đã nộp: badge `Đã nộp · đã khoá`.

**Mở khoá:** `admin` + `superadmin`. Trong modal *Phiếu chấm · {BGK}* ở
`/admin/judges`, mỗi dòng đội có trạng thái `Đã nộp` thêm nút `Mở khoá` →
confirm → `POST /api/judges/[id]/unlock { teamId }` → set `submitted = false`
cho cặp đó → ghi audit `score.unlock` → broadcast `update`.

Mở khoá **giữ nguyên giá trị điểm đã nhập**, chỉ bỏ cờ khoá.

### G2. Không nhập quá điểm max đã config

**Hiện tại:** input có `max={c.maxScore}` nhưng browser không ép; gõ `99` vào ô
max 10 thì UI hiện `99`, tổng hiện sai, và lúc lưu `Math.min(c.maxScore, …)`
**âm thầm** hạ về 10 — BGK không hề biết điểm mình nhập đã bị đổi.

**Sau thay đổi:** clamp ngay tại thời điểm nhập, và báo cho người dùng:

- `onChange` kẹp giá trị vào `[0, maxScore]`
- Nếu người dùng gõ quá max: ô viền đỏ + dòng `Tối đa {maxScore}đ`, tự động về
  đúng `maxScore`
- Nút `Nộp điểm`/`Lưu nháp` bị chặn khi còn ô không hợp lệ
- Bỏ `Math.min` âm thầm ở `save()` — giá trị gửi lên đã đúng, và server đã có
  `validateScoreValues` chặn tầng cuối (giữ nguyên)

### Chỗ phải sửa

- `src/lib/services/scores.ts` — `isCardLocked`, `unlockCard`, chặn trong `upsertScores`
- `src/app/api/scores/route.ts` — 409 khi khoá; audit `score.save` / `score.submit`
- `src/app/api/judges/[id]/unlock/route.ts` — **mới**
- `src/app/(judge)/judge/score/[teamId]/page.tsx` — confirm, read-only, clamp
- `src/app/(judge)/judge/page.tsx` — badge đã khoá
- `src/app/(admin)/admin/judges/page.tsx` — nút mở khoá trong modal
- `tests/services.scores.test.ts` — khoá / mở khoá

`ConfirmProvider` đã được `Shell` bọc quanh mọi trang admin và BGK
(`Shell.tsx:146`), nên `useConfirm()` dùng được ngay ở trang chấm điểm, không
phải thêm provider.

---

## Migration

Ba file migration, theo thứ tự:

1. `add_superadmin_role` — chỉ `ALTER TYPE "Role" ADD VALUE 'superadmin';`
   Tách riêng vì Postgres không cho dùng giá trị enum mới trong cùng transaction
   đã thêm nó.
2. `reveal_per_team` — `Team.revealedAt`, `Settings.judgeScoresRevealed`,
   `DROP COLUMN Settings.revealState`, `DROP TYPE "RevealState"`.
3. `audit_log_detail` — các cột mới + 2 index của `AuditLog`.

Dữ liệu cũ: `revealState` bị bỏ không cần chuyển đổi — sau khi nâng cấp, board
về màn chờ và ban tổ chức công bố lại từ đầu. Điểm và đội không bị ảnh hưởng.

Sau khi deploy: `npm run prisma:migrate` rồi `npm run accounts`.

## Kiểm thử

Repo đã có vitest + `tests/helpers/db.ts` chạy trên DB thật.

| File | Ca cần có |
|---|---|
| `tests/scoring.test.ts` | hạng tính trên toàn bộ đội, không loại head; `maxTotal` theo số BGK active; đồng điểm → tie |
| `tests/reveal-flow.test.ts` | `deriveState` cho 3 trạng thái; reveal 1 đội không đổi hạng của đội khác; unreveal; reset xoá hết; nhãn BGK ẩn danh và **không chứa tên thật** |
| `tests/services.scores.test.ts` | `isCardLocked`; `upsertScores` bị chặn khi đã khoá; `unlockCard` giữ giá trị điểm; `scoreMatrix` đúng status |
| `tests/services.judges.test.ts` | `setAccessCode` hợp lệ / trùng / sai format; chuẩn hoá uppercase |
| `tests/services.accounts.test.ts` | **mới** — không xoá được superadmin cuối cùng; không tự xoá mình |
| `tests/audit.test.ts` | **mới** — `audit()` ghi đủ field, không throw khi DB lỗi |
| `tests/auth.test.ts` | `requireRole` cho từng role |
| `tests/scores-validation.test.ts` | giữ nguyên |

## Các lựa chọn đã chốt

1. **Luồng công bố:** màn chờ (banner) → bước 1 công bố **lần lượt từng đội**,
   mỗi đội hiện spotlight rồi **đọng lại thành bảng** → bước 2 công bố điểm BGK.
   Bước 1 hiện **cả tổng điểm**, không chỉ số thứ tự.
2. **Trưởng BGK:** bỏ hẳn cơ chế giữ kín điểm, tính đủ mọi giám khảo từ đầu.
   `isHead` chỉ còn là nhãn.
3. **Phân quyền:** thêm role `superadmin`; `admin` là tài khoản khách hàng,
   không thấy audit log, không quản lý tài khoản admin.
4. **Khoá điểm:** nộp là khoá; `admin` và `superadmin` mở khoá được.
5. **Audit log:** ghi **mọi** thay đổi dữ liệu (không cần diff trước/sau đầy đủ,
   chỉ mô tả ngắn ở `detail`).
6. **BGK xem nhau:** tổng theo đội, **tên thật**. Ẩn tên chỉ ở board công khai.
7. **Sửa mã login:** `admin` sửa mã BGK; chỉ `superadmin` sửa mã tài khoản admin.

## Ngoài phạm vi

- Không đổi cơ chế session (vẫn là cookie HMAC không hết hạn theo phiên).
- Không thêm mật khẩu / 2FA — vẫn là mã truy cập một yếu tố.
- Không làm audit log diff đầy đủ trước/sau cho mọi field.
- Không đổi thiết kế board ngoài phần spotlight và nhãn ẩn danh.
