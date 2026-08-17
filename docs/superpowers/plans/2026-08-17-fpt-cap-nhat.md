# Cập nhật nhánh `fpt` — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Công bố kết quả theo 2 bước với reveal lần lượt từng đội, thêm role `superadmin` + audit log, cho sửa mã login bằng tay, mở khu xem đội/xem điểm chéo cho BGK, và khoá phiếu chấm sau khi nộp.

**Architecture:** Giữ nguyên kiến trúc hiện có — logic nghiệp vụ nằm ở service thuần trong `src/lib/services/*` (test được bằng vitest trên DB thật), route handler chỉ làm auth + JSON, realtime qua SSE in-process. Thay đổi lớn nhất về dữ liệu: bỏ enum `RevealState` một-nguồn-chân-lý và chuyển sang suy ra trạng thái từ `Team.revealedAt` + `Settings.judgeScoresRevealed`.

**Tech Stack:** Next.js 14 (App Router), React 18, TypeScript 5.5, Prisma 5.18 + PostgreSQL, Vitest 2, TailwindCSS 3.

**Spec:** `docs/superpowers/specs/2026-08-17-fpt-cap-nhat-cong-bo-quyen-audit-design.md`

## Global Constraints

- **Nhánh:** `fpt`. Không merge vào `master` trong phạm vi plan này.
- **Roles:** ba role — `superadmin`, `admin`, `judge`. `admin` = tài khoản khách hàng: toàn quyền vận hành, **không** thấy audit log, **không** quản lý tài khoản admin. `superadmin` làm được mọi thứ `admin` làm cộng hai mục đó.
- **Auth:** vẫn chỉ mã truy cập, không mật khẩu. Mã luôn lưu **uppercase** — `/api/auth/login` tra `code.trim().toUpperCase()`, mã chữ thường sẽ không đăng nhập được.
- **Trạng thái board:** `'waiting' | 'ranks' | 'judges'`, **suy ra**, không lưu cột riêng.
- **Xếp hạng:** hạng tính trên **toàn bộ** đội, không phụ thuộc đội nào đã công bố. Không còn cơ chế loại điểm Trưởng BGK. `isHead` chỉ còn là nhãn.
- **`/api/results` là API công khai** (không đăng nhập). Nó **không được** trả đội chưa công bố, và **không được** trả tên thật của giám khảo. Rò rỉ ở đây là rò rỉ toàn bộ kết quả trước giờ G.
- **Nhãn giám khảo trên board:** `BGK Chính` (isHead) và `BGK 1`, `BGK 2`, … theo thứ tự `createdAt`.
- **Audit log:** mọi thao tác ghi dữ liệu đều gọi `audit()`. Hàm `audit()` **không bao giờ throw**.
- **Điểm:** `Float`, một chữ số thập phân, `0 ≤ value ≤ criterion.maxScore`.
- **API GET đọc DB** phải có `export const dynamic = 'force-dynamic'` — image build chạy khi không có DB.
- **Commits:** conventional commits, ít nhất một commit mỗi task.
- **Chạy test:** `npm test` (vitest, DB thật theo `DATABASE_URL` trong `.env`).

## File Structure

```
prisma/schema.prisma                       # bỏ RevealState, thêm superadmin, Team.revealedAt,
                                           #   Settings.judgeScoresRevealed, AuditLog mở rộng
prisma/ensure-accounts.ts                  # MỚI — upsert superadmin + admin, không phá dữ liệu
prisma/seed.ts                             # thêm superadmin

src/lib/scoring.ts                         # bỏ Phase / head-exclusion / countedJudges
src/lib/judge-label.ts                     # MỚI — ẩn tên giám khảo cho view công khai
src/lib/audit.ts                           # MỚI — hàm audit() ghi log, không throw
src/lib/access-code.ts                     # + normalizeAccessCode, validateAccessCode
src/lib/auth.ts                            # + requireRole, isAdminish

src/lib/services/reveal.ts                 # reveal per-team, deriveState, getResults(opts)
src/lib/services/access.ts                 # MỚI — setUserAccessCode, regenerateUserCode
src/lib/services/accounts.ts               # MỚI — CRUD tài khoản admin/superadmin
src/lib/services/audit.ts                  # MỚI — truy vấn + phân trang audit log
src/lib/services/scores.ts                 # + isCardLocked, unlockCard, saveScoreCard, scoreMatrix
src/lib/services/teams.ts                  # + getTeamForJudge
src/lib/services/judges.ts                 # dùng access.ts

src/app/api/reveal/route.ts                # 4 action
src/app/api/results/route.ts               # công khai, lọc đội chưa công bố
src/app/api/results/all/route.ts           # MỚI — admin/judge, đủ đội
src/app/api/accounts/route.ts              # MỚI
src/app/api/accounts/[id]/route.ts         # MỚI
src/app/api/audit/route.ts                 # MỚI
src/app/api/scores/matrix/route.ts         # MỚI
src/app/api/judges/[id]/unlock/route.ts    # MỚI
src/app/api/teams/[id]/route.ts            # + GET cho judge

src/app/(admin)/admin/publish/page.tsx     # viết lại: 2 bước
src/app/(admin)/admin/accounts/page.tsx    # MỚI
src/app/(admin)/admin/audit/page.tsx       # MỚI
src/app/(admin)/admin/judges/page.tsx      # sửa mã tay, confirm đổi mã, nút mở khoá

src/app/(judge)/judge/page.tsx             # card tách 2 đường + badge đã khoá
src/app/(judge)/judge/team/[id]/page.tsx   # MỚI
src/app/(judge)/judge/scores/page.tsx      # MỚI
src/app/(judge)/judge/score/[teamId]/page.tsx  # confirm nộp, read-only, clamp

src/components/Shell.tsx                   # role mới, nav theo role, breadcrumb mới
src/components/board/BoardScreen.tsx       # màn spotlight, lọc rows, đọc payload SSE
src/components/board/SpotlightReveal.tsx   # MỚI
src/components/board/TimingTower.tsx       # dải chip điểm BGK ẩn tên
src/components/board/JudgeScoresModal.tsx  # nhãn ẩn tên
src/lib/mock-board.ts                      # state mới

tests/scoring.test.ts, tests/reveal-flow.test.ts, tests/services.scores.test.ts,
tests/services.judges.test.ts, tests/auth.test.ts
tests/services.accounts.test.ts            # MỚI
tests/audit.test.ts                        # MỚI
```

## Phases

Ba phase, mỗi phase deploy được độc lập:

- **Phase 1 (Task 1–6)** — luồng công bố 2 bước. Xong là dùng được cho sự kiện.
- **Phase 2 (Task 7–13)** — superadmin, audit log, sửa mã login.
- **Phase 3 (Task 14–18)** — khu BGK và khoá phiếu chấm.

---

# Phase 1 — Luồng công bố 2 bước

### Task 1: Bỏ cơ chế giữ kín điểm Trưởng BGK khỏi `scoring.ts`

**Files:**
- Modify: `src/lib/scoring.ts`
- Test: `tests/scoring.test.ts`

**Interfaces:**
- Consumes: — (task đầu tiên)
- Produces:
  - `type RankedRow = { team: TeamLite; score: number | null; judgeCount: number; rank: number; tie: boolean }`
  - `judgeTotal(scores: ScoreLite[], teamId: string, judgeId: string): number | null` (không đổi)
  - `teamTotal(scores: ScoreLite[], teamId: string): { total: number | null; judgeCount: number }` — **bỏ tham số `opts`**
  - `computeLeaderboard(input: { teams: TeamLite[]; scores: ScoreLite[] }): RankedRow[]` — **bỏ `headJudgeId` và `phase`**
  - `type Phase` và `countedJudges` **bị xoá**

- [ ] **Step 1: Viết test thất bại**

Thay toàn bộ `tests/scoring.test.ts` bằng:

```ts
import { describe, it, expect } from 'vitest';
import { computeLeaderboard, judgeTotal, teamTotal, ScoreLite, TeamLite } from '@/lib/scoring';

const teams: TeamLite[] = [
  { id: 'a', name: 'Alpha', code: 'AL' },
  { id: 'b', name: 'Beta', code: 'BE' },
  { id: 'c', name: 'Chưa chấm', code: 'CC' },
];
// j1, j2 thường; jh là trưởng BGK — sau thay đổi, jh được tính như mọi người.
const scores: ScoreLite[] = [
  { judgeId: 'j1', teamId: 'a', criterionId: 'c1', value: 8 },
  { judgeId: 'j2', teamId: 'a', criterionId: 'c1', value: 7 },
  { judgeId: 'jh', teamId: 'a', criterionId: 'c1', value: 5 },
  { judgeId: 'j1', teamId: 'b', criterionId: 'c1', value: 6 },
  { judgeId: 'j2', teamId: 'b', criterionId: 'c1', value: 6 },
  { judgeId: 'jh', teamId: 'b', criterionId: 'c1', value: 10 },
];

describe('scoring', () => {
  it('judgeTotal cộng các tiêu chí của đúng một giám khảo', () => {
    expect(judgeTotal(scores, 'a', 'j1')).toBe(8);
    expect(judgeTotal(scores, 'a', 'jx')).toBeNull();
  });

  it('teamTotal cộng đủ mọi giám khảo, kể cả trưởng BGK', () => {
    expect(teamTotal(scores, 'a')).toEqual({ total: 20, judgeCount: 3 });
    expect(teamTotal(scores, 'b')).toEqual({ total: 22, judgeCount: 3 });
    expect(teamTotal(scores, 'c')).toEqual({ total: null, judgeCount: 0 });
  });

  it('xếp hạng theo tổng điểm, đội chưa chấm xuống cuối', () => {
    const rows = computeLeaderboard({ teams, scores });
    expect(rows.map((r) => r.team.code)).toEqual(['BE', 'AL', 'CC']);
    expect(rows[0].rank).toBe(1);
    expect(rows[1].rank).toBe(2);
    expect(rows[2].score).toBeNull();
  });

  it('đồng điểm dùng golf rank và được đánh dấu tie', () => {
    const tied: ScoreLite[] = [
      { judgeId: 'j1', teamId: 'a', criterionId: 'c1', value: 9 },
      { judgeId: 'j1', teamId: 'b', criterionId: 'c1', value: 9 },
    ];
    const rows = computeLeaderboard({ teams, scores: tied });
    expect(rows[0].rank).toBe(1);
    expect(rows[1].rank).toBe(1);
    expect(rows[0].tie).toBe(true);
    expect(rows[1].tie).toBe(true);
  });
});
```

- [ ] **Step 2: Chạy test để chắc chắn nó fail**

Run: `npx vitest run tests/scoring.test.ts`
Expected: FAIL — TypeScript báo `computeLeaderboard` thiếu `headJudgeId`/`phase`.

- [ ] **Step 3: Sửa `src/lib/scoring.ts`**

Xoá `export type Phase` và `export function countedJudges`. Sửa hai hàm:

```ts
// Team score is the SUM of every judge's total — deliberately not an average.
// A team only one judge has scored therefore sits far below a fully scored one,
// which is what the live board should show.
export function teamTotal(
  scores: ScoreLite[],
  teamId: string,
): { total: number | null; judgeCount: number } {
  const judgeIds = [...new Set(scores.filter((s) => s.teamId === teamId).map((s) => s.judgeId))];
  const totals = judgeIds
    .map((jid) => judgeTotal(scores, teamId, jid))
    .filter((t): t is number => t !== null);
  if (totals.length === 0) return { total: null, judgeCount: 0 };
  return { total: round1(totals.reduce((a, b) => a + b, 0)), judgeCount: totals.length };
}

export function computeLeaderboard(input: {
  teams: TeamLite[]; scores: ScoreLite[];
}): RankedRow[] {
  const { teams, scores } = input;
  const rows = teams.map((team) => {
    const { total, judgeCount } = teamTotal(scores, team.id);
    return { team, score: total, judgeCount, rank: 0, tie: false };
  });
  // phần sort + golf rank + tie giữ nguyên y như cũ
  ...
}
```

- [ ] **Step 4: Sửa các chỗ gọi để `tsc` sạch**

`src/lib/services/reveal.ts` và `src/lib/mock-board.ts` đang gọi hàm cũ; task 3 và 6 viết lại chúng. Tạm thời sửa tối thiểu cho biên dịch được: bỏ `headJudgeId`/`phase` khi gọi `computeLeaderboard`, thay `countedJudges(judges, phase)` bằng `judges.length`.

Run: `npx tsc --noEmit`
Expected: không lỗi.

- [ ] **Step 5: Chạy test**

Run: `npx vitest run tests/scoring.test.ts`
Expected: PASS, 4 test.

- [ ] **Step 6: Commit**

```bash
git add src/lib/scoring.ts src/lib/services/reveal.ts src/lib/mock-board.ts tests/scoring.test.ts
git commit -m "refactor(scoring): bỏ cơ chế giữ kín điểm trưởng BGK, tính đủ mọi giám khảo"
```

---

### Task 2: Migration — reveal theo từng đội

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_reveal_per_team/migration.sql` (Prisma sinh ra)

**Interfaces:**
- Consumes: —
- Produces: cột `Team.revealedAt: DateTime?`, cột `Settings.judgeScoresRevealed: Boolean @default(false)`. Enum `RevealState` và cột `Settings.revealState` **không còn tồn tại**.

- [ ] **Step 1: Sửa schema**

Trong `prisma/schema.prisma`: xoá cả khối `enum RevealState { ... }`, rồi:

```prisma
model Team {
  id         String    @id @default(cuid())
  name       String
  code       String
  logoUrl    String?
  tag        String?
  revealedAt DateTime?                  // thời điểm được công bố trên board; null = chưa
  createdAt  DateTime  @default(now())
  members    Member[]
  scores     Score[]
}

model Settings {
  id                  Int      @id @default(1)
  judgeScoresRevealed Boolean  @default(false)  // bước 2: đã lộ điểm từng BGK chưa
  heroImageUrl        String?
  bannerImageUrl      String?
  updatedAt           DateTime @updatedAt
}
```

- [ ] **Step 2: Sinh migration (chưa chạy)**

Run: `npx prisma migrate dev --name reveal_per_team --create-only`
Prisma sẽ cảnh báo mất dữ liệu ở `Settings.revealState` — chấp nhận, cột này bỏ có chủ ý.

- [ ] **Step 3: Kiểm tra file SQL sinh ra**

Mở `prisma/migrations/<timestamp>_reveal_per_team/migration.sql`, xác nhận có đủ 4 câu:

```sql
ALTER TABLE "Team" ADD COLUMN "revealedAt" TIMESTAMP(3);
ALTER TABLE "Settings" ADD COLUMN "judgeScoresRevealed" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Settings" DROP COLUMN "revealState";
DROP TYPE "RevealState";
```

Thiếu câu `DROP TYPE` thì thêm tay vào cuối file.

- [ ] **Step 4: Áp migration + sinh client**

Run: `npx prisma migrate dev && npx prisma generate`
Expected: migration applied, client sinh lại.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(db): reveal theo từng đội, bỏ enum RevealState"
```

---

### Task 3: Viết lại `services/reveal.ts` — state suy ra + reveal từng đội

**Files:**
- Modify: `src/lib/services/reveal.ts`
- Create: `src/lib/judge-label.ts`
- Test: `tests/reveal-flow.test.ts`

**Interfaces:**
- Consumes: `computeLeaderboard({ teams, scores })`, `teamTotal`, `judgeTotal` (Task 1); cột DB mới (Task 2)
- Produces:
  - `src/lib/judge-label.ts`: `anonymizeJudges<T extends { id: string; isHead: boolean }>(judges: T[]): (T & { label: string })[]`
  - `type BoardState = 'waiting' | 'ranks' | 'judges'`
  - `deriveState(input: { revealedCount: number; judgeScoresRevealed: boolean }): BoardState`
  - `getRevealStatus(): Promise<{ state: BoardState; revealedTeamIds: string[]; judgeScoresRevealed: boolean }>`
  - `revealTeam(teamId: string): Promise<void>`
  - `unrevealTeam(teamId: string): Promise<void>`
  - `revealJudgeScores(): Promise<void>`
  - `resetReveal(): Promise<void>`
  - `getResults(opts?: { includeUnrevealed?: boolean }): Promise<BoardResults>`
  - `getHeroImage`, `setHeroImage`, `getBannerImage`, `setBannerImage` giữ nguyên chữ ký
  - `getRevealState` và `setRevealState` **bị xoá**

`BoardResults`:

```ts
export type PublicJudgeScore = { judgeId: string; label: string; isHead: boolean; total: number | null };
export type BoardResults = {
  state: BoardState;
  rows: {
    team: { id: string; name: string; code: string; logoUrl: string | null; tag: string | null;
            members: { id: string; name: string; photoUrl: string | null; teamRole: string | null }[] };
    score: number | null; judgeCount: number; rank: number; tie: boolean;
    revealed: boolean;
    judgeScores: PublicJudgeScore[];   // [] khi chưa tới bước 2 và người gọi không có quyền
  }[];
  revealedTeamIds: string[];
  teamCount: number;
  baremTotal: number; maxTotal: number; judgeCount: number;
  heroImageUrl: string | null; bannerImageUrl: string | null;
};
```

- [ ] **Step 1: Viết `src/lib/judge-label.ts`**

```ts
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
```

- [ ] **Step 2: Viết test thất bại**

Thay toàn bộ `tests/reveal-flow.test.ts`:

```ts
import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import { execSync } from 'node:child_process';
import { prisma, disconnect } from './helpers/db';
import {
  deriveState, getRevealStatus, revealTeam, unrevealTeam,
  revealJudgeScores, resetReveal, getResults,
} from '@/lib/services/reveal';
import { anonymizeJudges } from '@/lib/judge-label';

afterAll(disconnect);
// Seed lại về trạng thái biết trước; các test tích hợp khác dùng chung DB.
beforeAll(() => {
  execSync('npx tsx prisma/seed.ts', {
    stdio: 'ignore',
    env: { ...process.env, SEED_FORCE: '1', SEED_SCORES: '1' },
  });
}, 120000);

describe('anonymizeJudges', () => {
  it('trưởng BGK thành "BGK Chính", còn lại đánh số từ 1', () => {
    const out = anonymizeJudges([
      { id: 'h', isHead: true }, { id: 'a', isHead: false }, { id: 'b', isHead: false },
    ]);
    expect(out.map((j) => j.label)).toEqual(['BGK Chính', 'BGK 1', 'BGK 2']);
  });
});

describe('deriveState', () => {
  it('không đội nào công bố → waiting', () => {
    expect(deriveState({ revealedCount: 0, judgeScoresRevealed: false })).toBe('waiting');
  });
  it('có đội đã công bố → ranks', () => {
    expect(deriveState({ revealedCount: 1, judgeScoresRevealed: false })).toBe('ranks');
  });
  it('cờ bước 2 bật → judges', () => {
    expect(deriveState({ revealedCount: 3, judgeScoresRevealed: true })).toBe('judges');
  });
});

describe('reveal flow', () => {
  it('reset đưa board về waiting và xoá hết đội đã công bố', async () => {
    await resetReveal();
    const st = await getRevealStatus();
    expect(st.state).toBe('waiting');
    expect(st.revealedTeamIds).toEqual([]);
  });

  it('/api/results công khai không lộ đội chưa công bố', async () => {
    await resetReveal();
    const empty = await getResults();
    expect(empty.rows).toHaveLength(0);
    expect(empty.teamCount).toBeGreaterThan(0);   // vẫn biết có bao nhiêu đội

    const all = await getResults({ includeUnrevealed: true });
    const last = all.rows[all.rows.length - 1];
    await revealTeam(last.team.id);

    const one = await getResults();
    expect(one.rows).toHaveLength(1);
    expect(one.state).toBe('ranks');
    // hạng là hạng thật trên toàn bộ đội, không phải hạng 1 của nhóm đã công bố
    expect(one.rows[0].rank).toBe(last.rank);
    expect(one.rows[0].rank).toBeGreaterThan(1);
  });

  it('thu hồi đưa đội đó ra khỏi board', async () => {
    const all = await getResults({ includeUnrevealed: true });
    const t = all.rows[0].team.id;
    await revealTeam(t);
    expect((await getRevealStatus()).revealedTeamIds).toContain(t);
    await unrevealTeam(t);
    expect((await getRevealStatus()).revealedTeamIds).not.toContain(t);
  });

  it('điểm BGK chỉ xuất hiện sau bước 2, và không kèm tên thật', async () => {
    await resetReveal();
    const all = await getResults({ includeUnrevealed: true });
    await revealTeam(all.rows[0].team.id);

    const before = await getResults();
    expect(before.rows[0].judgeScores).toEqual([]);

    await revealJudgeScores();
    const after = await getResults();
    expect(after.state).toBe('judges');
    expect(after.rows[0].judgeScores.length).toBeGreaterThan(0);

    const labels = after.rows[0].judgeScores.map((j) => j.label);
    expect(labels).toContain('BGK Chính');
    expect(labels).toContain('BGK 1');
    // tên thật trong seed không được lọt ra
    const names = (await prisma.user.findMany({ where: { role: 'judge' } })).map((u) => u.name);
    const blob = JSON.stringify(after);
    for (const n of names) expect(blob).not.toContain(n);

    await resetReveal();
  });

  it('maxTotal = barem × số giám khảo active, không phụ thuộc phase', async () => {
    const r = await getResults({ includeUnrevealed: true });
    expect(r.baremTotal).toBe(50);
    expect(r.judgeCount).toBe(5);
    expect(r.maxTotal).toBe(250);
  });
});
```

- [ ] **Step 3: Chạy test để chắc chắn nó fail**

Run: `npx vitest run tests/reveal-flow.test.ts`
Expected: FAIL — `deriveState`/`revealTeam`/… chưa tồn tại.

- [ ] **Step 4: Viết lại `src/lib/services/reveal.ts`**

```ts
import { prisma } from '@/lib/db';
import { computeLeaderboard, judgeTotal, ScoreLite, TeamLite } from '@/lib/scoring';
import { anonymizeJudges } from '@/lib/judge-label';
import { broadcast } from '@/lib/events';

export type BoardState = 'waiting' | 'ranks' | 'judges';

async function settings() {
  return prisma.settings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
}

/** Trạng thái board suy ra từ dữ liệu, không lưu cột riêng — hai nguồn chân lý
 *  sẽ lệch nhau ngay lần đầu ai đó thu hồi một đội. */
export function deriveState(input: { revealedCount: number; judgeScoresRevealed: boolean }): BoardState {
  if (input.judgeScoresRevealed) return 'judges';
  return input.revealedCount > 0 ? 'ranks' : 'waiting';
}

export async function getRevealStatus() {
  const [s, revealed] = await Promise.all([
    settings(),
    prisma.team.findMany({ where: { revealedAt: { not: null } }, select: { id: true }, orderBy: { revealedAt: 'asc' } }),
  ]);
  return {
    state: deriveState({ revealedCount: revealed.length, judgeScoresRevealed: s.judgeScoresRevealed }),
    revealedTeamIds: revealed.map((t) => t.id),
    judgeScoresRevealed: s.judgeScoresRevealed,
  };
}

export async function revealTeam(teamId: string) {
  await prisma.team.update({ where: { id: teamId }, data: { revealedAt: new Date() } });
  broadcast('reveal', { teamId });
}
export async function unrevealTeam(teamId: string) {
  await prisma.team.update({ where: { id: teamId }, data: { revealedAt: null } });
  broadcast('reveal', { teamId, undo: true });
}
export async function revealJudgeScores() {
  await prisma.settings.upsert({
    where: { id: 1 }, update: { judgeScoresRevealed: true }, create: { id: 1, judgeScoresRevealed: true },
  });
  broadcast('reveal', { judges: true });
}
export async function resetReveal() {
  await prisma.$transaction([
    prisma.team.updateMany({ where: { revealedAt: { not: null } }, data: { revealedAt: null } }),
    prisma.settings.upsert({
      where: { id: 1 }, update: { judgeScoresRevealed: false }, create: { id: 1, judgeScoresRevealed: false },
    }),
  ]);
  broadcast('reveal', { reset: true });
}

export async function getHeroImage() { return (await settings()).heroImageUrl ?? null; }
export async function setHeroImage(url: string | null) {
  await prisma.settings.upsert({ where: { id: 1 }, update: { heroImageUrl: url }, create: { id: 1, heroImageUrl: url } });
  broadcast('reveal', { hero: true });
}
export async function getBannerImage() { return (await settings()).bannerImageUrl ?? null; }
export async function setBannerImage(url: string | null) {
  await prisma.settings.upsert({ where: { id: 1 }, update: { bannerImageUrl: url }, create: { id: 1, bannerImageUrl: url } });
  broadcast('reveal', { banner: true });
}

/**
 * includeUnrevealed CHỈ được bật cho người gọi đã đăng nhập (admin/BGK).
 * /api/results là endpoint công khai: trả đội chưa công bố ở đó là lộ toàn bộ
 * kết quả trước giờ công bố, chỉ cần một lệnh curl.
 */
export async function getResults(opts: { includeUnrevealed?: boolean } = {}) {
  const [teams, scoreRows, judges, criteria, s] = await Promise.all([
    prisma.team.findMany({
      orderBy: { createdAt: 'asc' },
      include: { members: { select: { id: true, name: true, photoUrl: true, teamRole: true } } },
    }),
    prisma.score.findMany({ select: { judgeId: true, teamId: true, criterionId: true, value: true } }),
    prisma.user.findMany({
      where: { role: 'judge' }, orderBy: { createdAt: 'asc' },
      select: { id: true, isHead: true, active: true },
    }),
    prisma.criterion.findMany({ select: { maxScore: true } }),
    settings(),
  ]);

  const revealedIds = teams.filter((t) => t.revealedAt !== null).map((t) => t.id);
  const state = deriveState({ revealedCount: revealedIds.length, judgeScoresRevealed: s.judgeScoresRevealed });

  const teamsLite: TeamLite[] = teams.map((t) => ({ id: t.id, name: t.name, code: t.code, logoUrl: t.logoUrl, tag: t.tag }));
  const scores: ScoreLite[] = scoreRows;
  // Hạng tính trên TOÀN BỘ đội — công bố đội hạng 4 trước thì nó vẫn là #4.
  const ranked = computeLeaderboard({ teams: teamsLite, scores });
  const membersByTeam = Object.fromEntries(teams.map((t) => [t.id, t.members]));

  const labelled = anonymizeJudges(judges);
  const showJudges = state === 'judges' || !!opts.includeUnrevealed;
  const judgeScoresFor = (teamId: string) => {
    if (!showJudges) return [];
    return labelled
      .map((j) => ({ judgeId: j.id, label: j.label, isHead: j.isHead, active: j.active, total: judgeTotal(scores, teamId, j.id) }))
      // giám khảo bị tắt vẫn hiện nếu đã chấm, vì điểm của họ nằm trong tổng
      .filter((j) => j.active || j.total !== null)
      .map(({ judgeId, label, isHead, total }) => ({ judgeId, label, isHead, total }));
  };

  const rows = ranked
    .map((r) => ({
      ...r,
      revealed: revealedIds.includes(r.team.id),
      team: { ...r.team, members: membersByTeam[r.team.id] ?? [] },
      judgeScores: judgeScoresFor(r.team.id),
    }))
    .filter((r) => opts.includeUnrevealed || r.revealed);

  const baremTotal = Math.round(criteria.reduce((a, c) => a + c.maxScore, 0) * 10) / 10;
  const judgeCount = judges.filter((j) => j.active).length;
  const maxTotal = Math.round(baremTotal * judgeCount * 10) / 10;

  return {
    state, rows, revealedTeamIds: revealedIds, teamCount: teams.length,
    baremTotal, maxTotal, judgeCount,
    heroImageUrl: s.heroImageUrl ?? null,
    bannerImageUrl: s.bannerImageUrl ?? null,
  };
}
```

- [ ] **Step 5: Chạy test**

Run: `npx vitest run tests/reveal-flow.test.ts`
Expected: PASS, 8 test.

- [ ] **Step 6: Commit**

```bash
git add src/lib/services/reveal.ts src/lib/judge-label.ts tests/reveal-flow.test.ts
git commit -m "feat(reveal): công bố từng đội, state suy ra, ẩn tên BGK khỏi API công khai"
```

---

### Task 4: API `/api/reveal` bốn action + `/api/results/all`

**Files:**
- Modify: `src/app/api/reveal/route.ts`
- Modify: `src/app/api/results/route.ts`
- Create: `src/app/api/results/all/route.ts`

**Interfaces:**
- Consumes: `getRevealStatus`, `revealTeam`, `unrevealTeam`, `revealJudgeScores`, `resetReveal`, `getResults` (Task 3)
- Produces:
  - `GET /api/reveal` → `{ state, revealedTeamIds, judgeScoresRevealed }`
  - `POST /api/reveal` body `{ action: 'revealTeam' | 'unrevealTeam' | 'revealJudges' | 'reset', teamId? }` → `{ ok: true }`
  - `GET /api/results` → `BoardResults` đã lọc (công khai)
  - `GET /api/results/all` → `BoardResults` đủ đội (admin + judge)

- [ ] **Step 1: Viết `src/app/api/reveal/route.ts`**

```ts
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import {
  getRevealStatus, revealTeam, unrevealTeam, revealJudgeScores, resetReveal,
} from '@/lib/services/reveal';

export async function GET() { return NextResponse.json(await getRevealStatus()); }

export async function POST(req: Request) {
  const u = await getCurrentUser();
  if (u?.role !== 'admin') return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const { action, teamId } = await req.json();

  if (action === 'revealTeam' || action === 'unrevealTeam') {
    if (typeof teamId !== 'string' || !teamId) {
      return NextResponse.json({ error: 'teamId required' }, { status: 400 });
    }
    if (action === 'revealTeam') await revealTeam(teamId); else await unrevealTeam(teamId);
    return NextResponse.json({ ok: true, ...(await getRevealStatus()) });
  }
  if (action === 'revealJudges') { await revealJudgeScores(); return NextResponse.json({ ok: true, ...(await getRevealStatus()) }); }
  if (action === 'reset') { await resetReveal(); return NextResponse.json({ ok: true, ...(await getRevealStatus()) }); }
  return NextResponse.json({ error: 'unknown action' }, { status: 400 });
}

export const dynamic = 'force-dynamic';
```

> Gate quyền ở đây tạm để `'admin'`; Task 8 đổi sang `requireRole('admin', 'superadmin')` cho toàn bộ route một lượt.

- [ ] **Step 2: Viết `src/app/api/results/all/route.ts`**

```ts
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getResults } from '@/lib/services/reveal';

// Bản đủ đội, CHỈ cho người đã đăng nhập. /api/results (công khai) phải giữ
// nguyên bộ lọc — đó là chốt chặn duy nhất giữ kết quả kín trước giờ công bố.
export async function GET() {
  const u = await getCurrentUser();
  if (!u) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  return NextResponse.json(await getResults({ includeUnrevealed: true }));
}

export const dynamic = 'force-dynamic';
```

`src/app/api/results/route.ts` giữ nguyên (`getResults()` không tham số).

- [ ] **Step 3: Kiểm tra biên dịch**

Run: `npx tsc --noEmit`
Expected: không lỗi.

- [ ] **Step 4: Thử tay**

Run: `npm run dev`, rồi ở terminal khác:

```bash
curl -s localhost:3000/api/reveal
curl -s localhost:3000/api/results | head -c 300
```

Expected: `/api/reveal` trả `{"state":"waiting","revealedTeamIds":[],...}`; `/api/results` trả `rows: []`.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/reveal src/app/api/results
git commit -m "feat(api): reveal 4 action, tách /api/results/all cho người đã đăng nhập"
```

---

### Task 5: Trang `/admin/publish` gom còn 2 bước

**Files:**
- Modify: `src/app/(admin)/admin/publish/page.tsx`

Không thêm file CSS: trang này chỉ dùng class có sẵn (`card`, `stepper`, `step`,
`note`, `pill`, `tcell`, `btn*`) cộng style inline, đúng lối file hiện tại.

**Interfaces:**
- Consumes: `GET /api/reveal`, `POST /api/reveal`, `GET /api/results/all`, `GET/POST /api/board/image` (Task 4)
- Produces: — (trang UI, không ai import)

- [ ] **Step 1: Viết lại trang**

```tsx
'use client';
import { useCallback, useEffect, useState } from 'react';
import { fetcher } from '@/lib/ui';
import ImagePicker from '@/components/ImagePicker';
import { TeamLogo } from '@/components/Avatar';
import { useConfirm } from '@/components/ConfirmProvider';

type Row = { team: { id: string; name: string; code: string; logoUrl: string | null }; score: number | null; rank: number; tie: boolean };

export default function Publish() {
  const [rows, setRows] = useState<Row[]>([]);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [judgesShown, setJudgesShown] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [hero, setHero] = useState('');
  const [banner, setBanner] = useState('');
  const confirm = useConfirm();

  const load = useCallback(async () => {
    const [res, rev, img] = await Promise.all([
      fetcher('/api/results/all'), fetcher('/api/reveal'), fetcher('/api/board/image'),
    ]);
    setRows(res.rows);
    setRevealed(new Set(rev.revealedTeamIds));
    setJudgesShown(rev.judgeScoresRevealed);
    setHero(img.heroImageUrl || '');
    setBanner(img.bannerImageUrl || '');
  }, []);
  useEffect(() => { load(); }, [load]);

  async function act(body: any, key: string) {
    setBusy(key);
    try { await fetcher('/api/reveal', { method: 'POST', body: JSON.stringify(body) }); await load(); }
    finally { setBusy(null); }
  }

  async function revealJudges() {
    if (!(await confirm({
      title: 'Công bố điểm ban giám khảo',
      message: 'Board sẽ hiện điểm của từng giám khảo (ẩn tên) cho mọi đội đã công bố. Xác nhận?',
      confirmText: 'Công bố',
    }))) return;
    await act({ action: 'revealJudges' }, 'judges');
  }

  async function reset() {
    if (!(await confirm({
      title: 'Reset về màn chờ',
      message: 'Thu hồi toàn bộ đội đã công bố và tắt điểm BGK. Board quay lại màn chờ. Điểm không bị ảnh hưởng.',
      confirmText: 'Reset', danger: true,
    }))) return;
    await act({ action: 'reset' }, 'reset');
  }

  // Hạng bét lên đầu: ban tổ chức xướng tên từ dưới lên.
  const order = [...rows].sort((a, b) => b.rank - a.rank);
  const doneCount = revealed.size;

  return (
    <>
      <div className="stepper">
        <div className={'step ' + (doneCount > 0 ? 'done' : 'active')}>
          <div className="step-n">{doneCount > 0 ? '✓' : '1'}</div><h4>Công bố thứ hạng</h4>
        </div>
        <div className={'step ' + (judgesShown ? 'done' : doneCount > 0 ? 'active' : '')}>
          <div className="step-n">{judgesShown ? '✓' : '2'}</div><h4>Công bố điểm BGK</h4>
        </div>
      </div>

      <div className="two-col" style={{ gridTemplateColumns: '1.4fr 1fr', alignItems: 'start', marginTop: 20 }}>
        <div style={{ display: 'grid', gap: 16 }}>
          <div className="card card-pad">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ fontSize: 15 }}>Bước 1 · Công bố từng đội</h3>
              <span className="pill pending">Đã công bố {doneCount}/{rows.length}</span>
            </div>
            <p style={{ fontSize: 12.5, color: 'var(--muted-2)', marginBottom: 14 }}>
              Sắp sẵn từ hạng bét lên hạng nhất. Ấn <b>Công bố</b> là board bật màn hình hạng của đội đó
              rồi đọng lại thành bảng xếp hạng.
            </p>
            <table>
              <thead><tr><th style={{ width: 60 }}>Hạng</th><th>Đội</th><th style={{ textAlign: 'right' }}>Điểm</th><th style={{ textAlign: 'right' }}>Thao tác</th></tr></thead>
              <tbody>
                {order.map((r) => {
                  const on = revealed.has(r.team.id);
                  return (
                    <tr key={r.team.id} style={on ? { opacity: .6 } : undefined}>
                      <td className="tnum"><b>{r.tie ? 'T' : ''}{r.rank}</b></td>
                      <td><div className="tcell"><TeamLogo code={r.team.code} logoUrl={r.team.logoUrl} /><b>{r.team.name}</b></div></td>
                      <td className="tnum" style={{ textAlign: 'right' }}>{r.score === null ? '—' : r.score.toFixed(1)}</td>
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {on
                          ? <button className="btn btn-sm" disabled={busy === r.team.id}
                              onClick={() => act({ action: 'unrevealTeam', teamId: r.team.id }, r.team.id)}>↩ Thu hồi</button>
                          : <button className="btn btn-sm btn-primary" disabled={busy === r.team.id}
                              onClick={() => act({ action: 'revealTeam', teamId: r.team.id }, r.team.id)}>▶ Công bố</button>}
                      </td>
                    </tr>
                  );
                })}
                {rows.length === 0 && <tr><td colSpan={4} style={{ color: 'var(--muted-2)' }}>Chưa có đội nào.</td></tr>}
              </tbody>
            </table>
          </div>

          <div className="card card-pad">
            <h3 style={{ fontSize: 15, marginBottom: 6 }}>Bước 2 · Công bố điểm ban giám khảo</h3>
            <p style={{ fontSize: 12.5, color: 'var(--muted-2)', marginBottom: 14 }}>
              Board bung điểm của từng giám khảo dưới mỗi đội, hiện nhãn <b>BGK Chính / BGK 1 / BGK 2…</b>, không hiện tên thật.
            </p>
            {judgesShown
              ? <div className="note"><span style={{ color: 'var(--green)' }}>✓</span><div><b style={{ color: 'var(--text)' }}>Đã công bố điểm BGK.</b></div></div>
              : <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: 12 }}
                  disabled={doneCount === 0 || busy === 'judges'} onClick={revealJudges}>
                  ♛ Công bố điểm ban giám khảo
                </button>}
            {doneCount === 0 && !judgesShown &&
              <div className="hint" style={{ marginTop: 10 }}>Công bố ít nhất một đội trước đã.</div>}
          </div>

          <div className="card card-pad">
            <button className="btn btn-danger btn-sm" disabled={busy === 'reset'} onClick={reset}>↺ Reset về màn chờ</button>
            <a className="btn btn-sm" style={{ marginLeft: 10 }} href="/board" target="_blank">Xem bảng công khai →</a>
          </div>
        </div>

        <div style={{ display: 'grid', gap: 16 }}>
          <div className="card card-pad">
            <h3 style={{ fontSize: 15, marginBottom: 6 }}>Banner màn chờ</h3>
            <p style={{ fontSize: 12.5, color: 'var(--muted-2)', marginBottom: 14 }}>
              Phủ kín trang board khi <b>chưa công bố đội nào</b>. Nên là ảnh ngang 16:9. Bỏ trống thì dùng màn chờ mặc định.
            </p>
            <ImagePicker value={banner} size={120} max={1600} placeholder="＋ Banner"
              onChange={async (v) => { setBanner(v); await fetcher('/api/board/image', { method: 'POST', body: JSON.stringify({ bannerImageUrl: v || null }) }); }} />
          </div>
          <div className="card card-pad">
            <h3 style={{ fontSize: 15, marginBottom: 6 }}>Ảnh nền màn chiếu</h3>
            <p style={{ fontSize: 12.5, color: 'var(--muted-2)', marginBottom: 14 }}>Ảnh ở panel bên trái của bảng điểm (ảnh dọc).</p>
            <ImagePicker value={hero} size={120} max={900} placeholder="＋ Ảnh"
              onChange={async (v) => { setHero(v); await fetcher('/api/board/image', { method: 'POST', body: JSON.stringify({ imageUrl: v || null }) }); }} />
          </div>
        </div>
      </div>
    </>
  );
}
```

- [ ] **Step 2: Kiểm tra biên dịch**

Run: `npx tsc --noEmit`
Expected: không lỗi.

- [ ] **Step 3: Thử tay**

Run: `npm run dev`, đăng nhập admin, vào `/admin/publish`, mở `/board` ở tab khác.
Expected: bảng đội sắp từ hạng bét lên; ấn `Công bố` một đội thì board đổi khỏi banner; ấn `Thu hồi` thì đội biến mất; `Reset` đưa board về banner.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(admin\)/admin/publish/page.tsx
git commit -m "feat(admin): trang công bố gom còn 2 bước, công bố lần lượt từng đội"
```

---

### Task 6: Board — spotlight khi công bố, chip điểm BGK ẩn tên

**Files:**
- Create: `src/components/board/SpotlightReveal.tsx`
- Modify: `src/components/board/BoardScreen.tsx`
- Modify: `src/components/board/TimingTower.tsx`
- Modify: `src/components/board/JudgeScoresModal.tsx`
- Modify: `src/components/board/LeaderBand.tsx` (bỏ prop `isFinal`)
- Modify: `src/app/board/board.css`
- Modify: `src/lib/mock-board.ts`, `src/app/board/page.tsx`
- Modify: `src/app/(judge)/judge/results/page.tsx`

**Interfaces:**
- Consumes: `BoardResults` với `state: 'waiting' | 'ranks' | 'judges'`, `rows[].judgeScores: { judgeId, label, isHead, total }[]`, `rows[].revealed` (Task 3)
- Produces:
  - `SpotlightReveal` props: `{ row: BoardRow; maxTotal: number; onDone: () => void }`
  - `JudgeScore` đổi field `name: string` → `label: string` (export từ `JudgeScoresModal.tsx`)
  - `MockOptions.state: 'waiting' | 'ranks' | 'judges'`

- [ ] **Step 1: Viết `SpotlightReveal.tsx`**

```tsx
'use client';
import { useEffect } from 'react';
import { teamMark } from '@/lib/team-art';

export const SPOTLIGHT_MS = 6000;

/** Màn hình phủ toàn board khi ban tổ chức vừa công bố một đội: hạng cỡ lớn,
 *  logo, tên, tổng điểm. Tự tắt sau SPOTLIGHT_MS rồi đội rơi vào timing tower. */
export default function SpotlightReveal({
  row, maxTotal, onDone,
}: {
  row: { rank: number; tie: boolean; score: number | null;
         team: { name: string; code: string; logoUrl?: string | null; tag?: string | null } };
  maxTotal: number;
  onDone: () => void;
}) {
  useEffect(() => {
    const id = setTimeout(onDone, SPOTLIGHT_MS);
    return () => clearTimeout(id);
  }, [onDone]);

  return (
    <div className="pw-spot" role="status" aria-live="polite">
      <div className="pw-spot-in">
        <div className="pw-spot-rank">
          <span className="k">HẠNG</span>
          <b>{row.tie ? 'T' : ''}{String(row.rank).padStart(2, '0')}</b>
        </div>
        <img className="pw-spot-logo" src={row.team.logoUrl || teamMark(row.team.code)} alt="" />
        <h2 className="pw-spot-name">{row.team.name}</h2>
        {row.team.tag && <p className="pw-spot-tag">{row.team.tag}</p>}
        <div className="pw-spot-score">
          {row.score === null ? '—' : row.score.toFixed(1)}<small>/ {maxTotal}</small>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Style trong `src/app/board/board.css`**

Thêm vào cuối file:

```css
/* ---- Spotlight khi công bố một đội ---------------------------------- */
.pw-spot{
  position:fixed; inset:0; z-index:60; display:grid; place-items:center;
  background:radial-gradient(120% 120% at 50% 40%, rgba(8,14,32,.94), rgba(4,7,18,.99));
  backdrop-filter:blur(6px); animation:pw-spot-in .55s cubic-bezier(.22,1,.36,1) both;
}
.pw-spot-in{ text-align:center; display:grid; gap:14px; justify-items:center; padding:24px; }
.pw-spot-rank{ display:grid; gap:2px; justify-items:center; }
.pw-spot-rank .k{ font-size:14px; letter-spacing:.42em; color:var(--pw-muted,#7f8dae); }
.pw-spot-rank b{
  font-family:'Space Grotesk',sans-serif; font-size:clamp(88px,16vw,190px); line-height:.9;
  background:linear-gradient(180deg,#fff,#8fb4ff); -webkit-background-clip:text; color:transparent;
}
.pw-spot-logo{ width:96px; height:96px; border-radius:22px; object-fit:cover; }
.pw-spot-name{ font-family:'Space Grotesk',sans-serif; font-size:clamp(32px,5vw,64px); color:#fff; }
.pw-spot-tag{ font-size:15px; color:var(--pw-muted,#7f8dae); max-width:44ch; }
.pw-spot-score{ font-size:clamp(28px,4vw,48px); color:#8fb4ff; font-variant-numeric:tabular-nums; }
.pw-spot-score small{ font-size:.42em; color:var(--pw-muted,#7f8dae); margin-left:6px; }
@keyframes pw-spot-in{ from{ opacity:0; transform:scale(.94); } to{ opacity:1; transform:none; } }
@media (prefers-reduced-motion: reduce){ .pw-spot{ animation:none; } }

/* ---- Dải chip điểm BGK dưới mỗi dòng -------------------------------- */
.pw-jchips{ grid-column:1/-1; display:flex; flex-wrap:wrap; gap:6px; margin-top:6px; }
.pw-jchip{
  display:inline-flex; align-items:baseline; gap:6px; padding:3px 9px; border-radius:999px;
  background:rgba(143,180,255,.10); border:1px solid rgba(143,180,255,.18); font-size:12px;
  color:var(--pw-muted,#7f8dae);
}
.pw-jchip b{ color:#dce6ff; font-variant-numeric:tabular-nums; }
.pw-jchip.is-head{ background:rgba(255,196,84,.12); border-color:rgba(255,196,84,.28); }
.pw-jchip.is-head b{ color:#ffd479; }
```

- [ ] **Step 3: Sửa `TimingTower.tsx`**

Đổi type và thêm dải chip:

```tsx
// đầu file
import JudgeScoresModal, { type JudgeScore } from './JudgeScoresModal';

type Row = {
  rank: number; tie: boolean; score: number | null; judgeCount: number;
  team: { id: string; name: string; code: string; tag?: string | null; logoUrl?: string | null };
  breakdown?: { criterionId: string; value: number }[];
  judgeScores?: JudgeScore[];
};

export default function TimingTower({
  rows, maxTotal, baremTotal = 0, criteria = [], interactive = true, showJudges = false,
}: {
  rows: Row[]; maxTotal: number; baremTotal?: number;
  criteria?: BoardCriterion[];
  interactive?: boolean;
  /** bước 2 đã mở: hiện dải chip điểm từng BGK và nút mở popup */
  showJudges?: boolean;
}) {
```

Trong phần render mỗi dòng, ngay sau `<div className="pw-barline">…</div>`, thêm:

```tsx
{showJudges && r.judgeScores && r.judgeScores.length > 0 && (
  <div className="pw-jchips">
    {r.judgeScores.map((j) => (
      <span key={j.judgeId} className={'pw-jchip' + (j.isHead ? ' is-head' : '')}>
        {j.label} <b>{j.total === null ? '—' : j.total.toFixed(1)}</b>
      </span>
    ))}
  </div>
)}
```

Và đổi điều kiện nút mở popup từ `interactive && r.judgeScores…` thành:

```tsx
{interactive && showJudges && r.judgeScores && r.judgeScores.length > 0 && (
  <button type="button" className="pw-jbtn" onClick={() => setOpenTeam(r.team.id)}
    aria-label={`Xem điểm ban giám khảo của ${r.team.name}`}>Điểm BGK</button>
)}
```

- [ ] **Step 4: Sửa `JudgeScoresModal.tsx`**

Đổi type và chỗ hiển thị tên:

```tsx
export type JudgeScore = { judgeId: string; label: string; isHead: boolean; total: number | null };
```

```tsx
<span className="nm">
  {j.label}
  {j.isHead && <em className="role">Trưởng BGK</em>}
</span>
```

Và đổi dòng phụ đề trong header từ `Điểm từng giám khảo` thành `Điểm từng giám khảo (ẩn tên)`.

- [ ] **Step 5: Sửa `BoardScreen.tsx`**

Ba thay đổi:

```tsx
import SpotlightReveal from '@/components/board/SpotlightReveal';

type Screen = 'banner' | 'wait' | 'board';
function screenOf(d: any): Screen {
  if (!d || d.state === 'waiting') return d?.bannerImageUrl ? 'banner' : 'wait';
  return 'board';
}
```

(1) Đọc payload SSE để bật spotlight — thay khối `useEffect` "Live data":

```tsx
const [spotlightId, setSpotlightId] = useState<string | null>(null);

useEffect(() => {
  if (mock) return;
  let alive = true;
  const load = async () => {
    const d = await fetcher('/api/results');
    if (alive) setData(d);
  };
  load();
  const es = new EventSource('/api/stream');
  // Spotlight bám vào SỰ KIỆN, không phải so sánh state: F5 lại trang board sau
  // khi đã công bố sẽ không chiếu lại màn hình của đội công bố lúc trước.
  es.addEventListener('reveal', (e: MessageEvent) => {
    let p: any = {};
    try { p = JSON.parse(e.data); } catch { /* payload rỗng */ }
    if (p.teamId && !p.undo) setSpotlightId(p.teamId);
    if (p.reset || p.undo) setSpotlightId(null);
    if (p.judges) setCelebrate((c) => c + 1);
    load();
  });
  es.addEventListener('update', load);
  return () => { alive = false; es.close(); };
}, [mock]);
```

(2) Bỏ biến `isFinal`, dùng `d.state === 'judges'`; truyền `showJudges` xuống tower và bỏ prop `isFinal` của `LeaderBand`/`BoardRail`:

```tsx
const showJudges = d.state === 'judges';
...
<LeaderBand row={leader} maxTotal={d.maxTotal} heroImageUrl={d.heroImageUrl} />
<TimingTower rows={rows} maxTotal={d.maxTotal} baremTotal={d.baremTotal}
  criteria={d.criteria} interactive={entering} showJudges={showJudges} />
<BoardRail criteria={d.criteria} judges={d.judges} teamCount={d.teamCount ?? rows.length} />
```

Trong `Strip`, nhãn: `state==='judges' ? 'ĐIỂM BAN GIÁM KHẢO' : state==='ranks' ? 'ĐANG CÔNG BỐ' : 'CHỜ CÔNG BỐ'`, và ô "Đội" hiện `${rows.length}/${d.teamCount}`.

(3) Render overlay spotlight ở cuối, trên mọi thứ khác:

```tsx
const spotRow = spotlightId ? data.rows.find((r: any) => r.team.id === spotlightId) : null;

return (
  <>
    {view(screen, data, true)}
    {leaving && <div className="pw-xfade" aria-hidden>{view(leaving.screen, leaving.data, false)}</div>}
    {spotRow && (
      <SpotlightReveal row={spotRow} maxTotal={data.maxTotal} onDone={() => setSpotlightId(null)} />
    )}
  </>
);
```

`LeaderBand.tsx` và `BoardRail.tsx`: xoá prop `isFinal` và mọi nhánh dùng nó (giữ nhánh "final" làm mặc định — sau thay đổi, mọi điểm đã hiện đều là điểm chính thức).

- [ ] **Step 6: Sửa `mock-board.ts` và `board/page.tsx`**

`mock-board.ts`:

```ts
export type MockOptions = {
  state?: 'waiting' | 'ranks' | 'judges';
  tick?: number;
  unscoredCount?: number;
};

export function buildMockResults(opts: MockOptions = {}) {
  const { state = 'ranks', tick = 0, unscoredCount = state === 'judges' ? 0 : 1 } = opts;
  ...
  // bỏ activeJudges lọc theo phase — dùng cả MOCK_JUDGES
  const activeJudges = MOCK_JUDGES;
  ...
  const ranked = computeLeaderboard({ teams, scores });
  // breakdownFor: bỏ điều kiện loại head
  ...
  judgeScores: anonymizeJudges(MOCK_JUDGES).map((j) => ({
    judgeId: j.id, label: j.label, isHead: j.isHead, total: judgeTotal(scores, r.team.id, j.id),
  })),
  ...
  return {
    state,
    rows: state === 'waiting' ? [] : rows,
    revealedTeamIds: state === 'waiting' ? [] : rows.map((r) => r.team.id),
    teamCount: SEEDS.length,
    baremTotal: MOCK_CRITERIA.reduce((a, c) => a + c.max, 0),
    maxTotal: MOCK_CRITERIA.reduce((a, c) => a + c.max, 0) * MOCK_JUDGES.length,
    heroImageUrl: null, bannerImageUrl: null,
    criteria: MOCK_CRITERIA,
    judges: MOCK_JUDGES.map((j) => ({ ...j, submitted: new Set(scores.filter((s) => s.judgeId === j.id).map((s) => s.teamId)).size })),
    mock: true,
  };
}
```

`board/page.tsx` — `readMock` map sang state mới:

```ts
function readMock(v?: string | string[]): MockMode {
  const raw = Array.isArray(v) ? v[0] : v;
  if (!raw) return null;
  if (raw === 'judges' || raw === 'final') return 'judges';
  if (raw === 'wait') return 'wait';
  return 'ranks';
}
```

`MockMode` trong `BoardScreen.tsx` đổi thành `'ranks' | 'judges' | 'wait' | null`, và `useEffect` mock map `mock === 'wait' ? 'waiting' : mock`.

- [ ] **Step 7: Sửa `/judge/results`**

Nhãn pill: `data.state === 'judges' ? 'Đã công bố điểm BGK' : data.state === 'ranks' ? 'Đang công bố' : 'Chưa công bố'`, và đổi nguồn dữ liệu sang `/api/results/all` để BGK thấy đủ đội.

- [ ] **Step 8: Kiểm tra biên dịch + build**

Run: `npx tsc --noEmit && npm run build`
Expected: không lỗi.

- [ ] **Step 9: Thử tay**

Run: `npm run dev`
- `/board?mock=wait`, `?mock=ranks`, `?mock=judges` — ba màn hình đúng, `?mock=judges` có dải chip `BGK Chính / BGK 1 …`
- Mở `/board` thật + `/admin/publish` ở hai tab: ấn `Công bố` → tab board bật spotlight ~6s rồi đội rơi vào bảng.
- F5 tab board sau đó → **không** chiếu lại spotlight.

- [ ] **Step 10: Commit**

```bash
git add src/components/board src/app/board src/lib/mock-board.ts src/app/\(judge\)/judge/results/page.tsx
git commit -m "feat(board): spotlight khi công bố từng đội, chip điểm BGK ẩn tên"
```

**Chốt Phase 1:** `npm test && npx tsc --noEmit && npm run build` phải sạch trước khi sang Phase 2.

---

# Phase 2 — Superadmin, audit log, sửa mã login

### Task 7: Migration — role `superadmin` và `AuditLog` mở rộng

**Files:**
- Modify: `prisma/schema.prisma`
- Create: hai thư mục migration do Prisma sinh

**Interfaces:**
- Consumes: —
- Produces: `Role` có thêm `superadmin`; `AuditLog` có `actorName`, `actorRole`, `entity`, `entityId`, `detail` + 2 index.

- [ ] **Step 1: Thêm giá trị enum và sinh migration RIÊNG**

Trong `prisma/schema.prisma`:

```prisma
enum Role {
  superadmin
  admin
  judge
}
```

Run: `npx prisma migrate dev --name add_superadmin_role`

Migration này phải **đứng một mình**. Postgres không cho dùng một giá trị enum
vừa `ADD VALUE` trong cùng transaction đã thêm nó — gộp chung với một migration
có `INSERT ... role = 'superadmin'` là lỗi lúc chạy.

Kiểm tra file SQL sinh ra chỉ có đúng một câu:

```sql
ALTER TYPE "Role" ADD VALUE 'superadmin';
```

- [ ] **Step 2: Mở rộng `AuditLog` và sinh migration thứ hai**

```prisma
model AuditLog {
  id        String   @id @default(cuid())
  actorId   String?
  actorName String?
  actorRole String?
  action    String
  entity    String?
  entityId  String?
  target    String?
  detail    String?
  createdAt DateTime @default(now())

  @@index([createdAt])
  @@index([entity, entityId])
}
```

Ý nghĩa từng cột: `actorName`/`actorRole` là **snapshot** tên và vai trò người
thao tác; `action` dạng `team.create`, `score.unlock`; `entity` + `entityId` trỏ
tới đối tượng; `target` là tên đọc được; `detail` là mô tả ngắn kiểu
`maxScore: 10 -> 15`.

Run: `npx prisma migrate dev --name audit_log_detail && npx prisma generate`

- [ ] **Step 3: Kiểm tra**

Run: `npx tsc --noEmit && npm test`
Expected: sạch — schema mới chưa ai dùng nên không có gì gãy.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(db): them role superadmin va mo rong AuditLog"
```

---

### Task 8: `requireRole` và gate lại toàn bộ route admin

**Files:**
- Modify: `src/lib/auth.ts`
- Modify: `src/app/(admin)/admin/layout.tsx`
- Modify: `src/components/Shell.tsx`
- Modify: 13 route API (liệt kê ở Step 4)
- Test: `tests/auth.test.ts`

**Interfaces:**
- Consumes: `Role` có `superadmin` (Task 7)
- Produces:
  - `type Role = 'superadmin' | 'admin' | 'judge'`
  - `type SessionUser = { id: string; name: string; role: Role; isHead: boolean }`
  - `getCurrentUser(): Promise<SessionUser | null>` — chữ ký cũ, kiểu chặt hơn
  - `requireRole(...roles: Role[]): Promise<SessionUser | null>` — `null` nghĩa là **từ chối**
  - `isAdminish(u: { role: Role } | null | undefined): boolean`

- [ ] **Step 1: Viết test thất bại**

Thêm vào cuối `tests/auth.test.ts`:

```ts
import { isAdminish } from '@/lib/auth';

describe('isAdminish', () => {
  it('nhan admin va superadmin, tu choi judge va null', () => {
    expect(isAdminish({ role: 'admin' })).toBe(true);
    expect(isAdminish({ role: 'superadmin' })).toBe(true);
    expect(isAdminish({ role: 'judge' })).toBe(false);
    expect(isAdminish(null)).toBe(false);
  });
});
```

- [ ] **Step 2: Chạy test để chắc chắn nó fail**

Run: `npx vitest run tests/auth.test.ts`
Expected: FAIL — `isAdminish` chưa được export.

- [ ] **Step 3: Thêm vào `src/lib/auth.ts`**

```ts
export type Role = 'superadmin' | 'admin' | 'judge';
export type SessionUser = { id: string; name: string; role: Role; isHead: boolean };

export function isAdminish(u: { role: Role } | null | undefined): boolean {
  return u?.role === 'admin' || u?.role === 'superadmin';
}

/** Trả về user nếu role nằm trong danh sách cho phép, null nếu không.
 *  Route handler luôn dịch null thành 403 — không bao giờ 401, vì mọi lối vào
 *  đã qua middleware kiểm cookie rồi. */
export async function requireRole(...roles: Role[]): Promise<SessionUser | null> {
  const u = await getCurrentUser();
  if (!u) return null;
  return roles.includes(u.role) ? u : null;
}
```

`getCurrentUser` giữ nguyên phần thân, chỉ ghi thêm kiểu trả về `Promise<SessionUser | null>`.

- [ ] **Step 4: Đổi gate ở mọi route**

Mẫu thay thế — cũ:

```ts
const u = await getCurrentUser();
if (u?.role !== 'admin') return NextResponse.json({ error: 'forbidden' }, { status: 403 });
```

mới:

```ts
const u = await requireRole('admin', 'superadmin');
if (!u) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
```

Áp cho: `api/teams/route.ts`, `api/teams/[id]/route.ts`, `api/members/route.ts`,
`api/members/[id]/route.ts`, `api/criteria/route.ts`, `api/criteria/[id]/route.ts`,
`api/judges/route.ts`, `api/judges/[id]/route.ts`, `api/judges/[id]/scores/route.ts`,
`api/reveal/route.ts`, `api/board/image/route.ts`.

`api/scores/route.ts` và `api/scores/status/route.ts` giữ gate judge, đổi sang
`requireRole('judge')` cho đồng nhất.

`src/app/(admin)/admin/layout.tsx`:

```tsx
const u = await getCurrentUser();
if (!u) redirect('/login');
if (!isAdminish(u)) redirect('/judge');
return <Shell role={u.role} userName={u.name}>{children}</Shell>;
```

- [ ] **Step 5: Sửa `Shell.tsx` nhận role mới**

`ADMIN_NAV` **giữ nguyên 5 mục và nguyên các ký tự `ic` đang có trong file** —
chỉ thêm một mảng mới bên dưới nó:

```tsx
// Chỉ superadmin thấy hai mục này.
const SUPER_NAV = [
  { href: '/admin/accounts', label: 'Tài khoản quản trị', ic: '⚿' },
  { href: '/admin/audit', label: 'Nhật ký thao tác', ic: '≡' },
];

export default function Shell({ role, userName = '', children }: {
  role: 'superadmin' | 'admin' | 'judge'; userName?: string; children: React.ReactNode;
}) {
  const isAdmin = role === 'admin' || role === 'superadmin';
  const nav = role === 'superadmin' ? [...ADMIN_NAV, ...SUPER_NAV] : isAdmin ? ADMIN_NAV : JUDGE_NAV;
  const home = isAdmin ? '/admin' : '/judge';
  ...
}
```

Nhãn role hiển thị ở user menu: `superadmin` là `Super Admin`, `admin` là `Admin`,
`judge` là `Giám khảo`. `buildCrumbs(path, role)` nhận role mới; `LABEL` thêm
`'/admin/accounts': 'Tài khoản quản trị'` và `'/admin/audit': 'Nhật ký thao tác'`.

- [ ] **Step 6: Kiểm tra**

Run: `npx vitest run tests/auth.test.ts && npx tsc --noEmit`
Expected: PASS + không lỗi type.

Rà sót: `grep -rn "role !== 'admin'" src/` phải **không còn kết quả nào**.

- [ ] **Step 7: Commit**

```bash
git add src/lib/auth.ts src/components/Shell.tsx src/app tests/auth.test.ts
git commit -m "feat(auth): requireRole + role superadmin, gate lai toan bo route admin"
```

---

### Task 9: `lib/audit.ts` — ghi log không bao giờ làm hỏng thao tác chính

**Files:**
- Create: `src/lib/audit.ts`
- Create: `tests/audit.test.ts`

**Interfaces:**
- Consumes: `SessionUser` (Task 8), model `AuditLog` mở rộng (Task 7)
- Produces:
  - `type AuditActor = { id: string; name: string; role: string } | null`
  - `audit(actor: AuditActor, action: string, opts?: { entity?: string; entityId?: string; target?: string; detail?: string }): Promise<void>`

- [ ] **Step 1: Viết test thất bại**

Tạo `tests/audit.test.ts`:

```ts
import { describe, it, expect, afterAll } from 'vitest';
import { prisma, disconnect } from './helpers/db';
import { audit } from '@/lib/audit';

afterAll(disconnect);

describe('audit', () => {
  it('ghi du actor, action va doi tuong', async () => {
    await audit({ id: 'u1', name: 'Ban to chuc', role: 'admin' }, 'team.create', {
      entity: 'team', entityId: 't1', target: 'EV Nexus', detail: 'code: EV',
    });
    const row = await prisma.auditLog.findFirst({ orderBy: { createdAt: 'desc' } });
    expect(row).toMatchObject({
      actorId: 'u1', actorName: 'Ban to chuc', actorRole: 'admin',
      action: 'team.create', entity: 'team', entityId: 't1',
      target: 'EV Nexus', detail: 'code: EV',
    });
  });

  it('actor null van ghi duoc', async () => {
    await audit(null, 'auth.login_failed', { detail: 'ABCD***' });
    const row = await prisma.auditLog.findFirst({ orderBy: { createdAt: 'desc' } });
    expect(row?.action).toBe('auth.login_failed');
    expect(row?.actorId).toBeNull();
  });

  it('khong throw khi ghi loi', async () => {
    // action là number: Prisma sẽ ném lỗi validate, audit() phải nuốt nó.
    await expect(
      audit({ id: 'u1', name: 'x', role: 'admin' }, 123 as any),
    ).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Chạy test để chắc chắn nó fail**

Run: `npx vitest run tests/audit.test.ts`
Expected: FAIL — không tìm thấy module `@/lib/audit`.

- [ ] **Step 3: Viết `src/lib/audit.ts`**

```ts
import { prisma } from '@/lib/db';

export type AuditActor = { id: string; name: string; role: string } | null;

/**
 * Ghi một dòng nhật ký. Cố ý KHÔNG bao giờ throw: audit là dữ liệu phụ trợ, còn
 * thao tác đang chạy (tạo đội, nộp điểm, công bố) mới là việc chính — để một lỗi
 * ghi log làm hỏng thao tác chính là đánh đổi sai.
 * actorName/actorRole là snapshot: xoá một BGK không được làm mất dấu vết.
 */
export async function audit(
  actor: AuditActor,
  action: string,
  opts: { entity?: string; entityId?: string; target?: string; detail?: string } = {},
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: actor?.id ?? null,
        actorName: actor?.name ?? null,
        actorRole: actor?.role ?? null,
        action,
        entity: opts.entity ?? null,
        entityId: opts.entityId ?? null,
        target: opts.target ?? null,
        detail: opts.detail ?? null,
      },
    });
  } catch (e) {
    console.error('[audit] ghi nhat ky that bai:', action, e);
  }
}
```

- [ ] **Step 4: Chạy test**

Run: `npx vitest run tests/audit.test.ts`
Expected: PASS, 3 test.

- [ ] **Step 5: Commit**

```bash
git add src/lib/audit.ts tests/audit.test.ts
git commit -m "feat(audit): ham audit() ghi nhat ky, khong throw"
```

---

### Task 10: Gắn `audit()` vào mọi route ghi dữ liệu

**Files:**
- Modify: `src/app/api/teams/route.ts`, `src/app/api/teams/[id]/route.ts`
- Modify: `src/app/api/members/route.ts`, `src/app/api/members/[id]/route.ts`
- Modify: `src/app/api/criteria/route.ts`, `src/app/api/criteria/[id]/route.ts`
- Modify: `src/app/api/judges/route.ts`, `src/app/api/judges/[id]/route.ts`
- Modify: `src/app/api/scores/route.ts`
- Modify: `src/app/api/reveal/route.ts`
- Modify: `src/app/api/board/image/route.ts`
- Modify: `src/app/api/auth/login/route.ts`, `src/app/api/auth/logout/route.ts`

**Interfaces:**
- Consumes: `audit()` (Task 9), `requireRole()` (Task 8)
- Produces: — (không ai import; đầu ra là các dòng trong bảng `AuditLog`)

**Bảng action bắt buộc.** Dùng đúng tên này, trang `/admin/audit` ở Task 13 dịch
theo bảng này:

| entity | action |
|---|---|
| `auth` | `auth.login`, `auth.logout`, `auth.login_failed` |
| `team` | `team.create`, `team.update`, `team.delete` |
| `member` | `member.create`, `member.update`, `member.delete` |
| `judge` | `judge.create`, `judge.update`, `judge.delete`, `judge.regen_code`, `judge.set_code`, `judge.set_head` |
| `criterion` | `criterion.create`, `criterion.update`, `criterion.delete` |
| `score` | `score.save`, `score.submit` |
| `reveal` | `reveal.team`, `reveal.unteam`, `reveal.judges`, `reveal.reset` |
| `settings` | `settings.hero_image`, `settings.banner_image` |

(`score.unlock` và `account.*` do Task 15 và Task 12 thêm.)

- [ ] **Step 1: Mẫu cho một route CRUD**

Mỗi file sửa cần thêm import: `import { audit } from '@/lib/audit';` và
`import { prisma } from '@/lib/db';` (file nào chưa có), cùng `requireRole` từ
`@/lib/auth` thay cho `getCurrentUser`.

`src/app/api/teams/route.ts` POST sau khi sửa:

```ts
export async function POST(req: Request) {
  const u = await requireRole('admin', 'superadmin');
  if (!u) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const body = await req.json();
  const team = await createTeam(body);
  await audit(u, 'team.create', { entity: 'team', entityId: team.id, target: team.name });
  return NextResponse.json(team, { status: 201 });
}
```

`src/app/api/teams/[id]/route.ts`:

```ts
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const u = await requireRole('admin', 'superadmin');
  if (!u) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const body = await req.json();
  const team = await updateTeam(params.id, body);
  await audit(u, 'team.update', {
    entity: 'team', entityId: team.id, target: team.name,
    detail: Object.keys(body).join(', '),      // các trường đã đổi
  });
  return NextResponse.json(team);
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const u = await requireRole('admin', 'superadmin');
  if (!u) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  // đọc tên TRƯỚC khi xoá, sau khi xoá là không còn gì để ghi vào target
  const before = await prisma.team.findUnique({ where: { id: params.id }, select: { name: true } });
  await deleteTeam(params.id);
  await audit(u, 'team.delete', { entity: 'team', entityId: params.id, target: before?.name ?? params.id });
  return NextResponse.json({ ok: true });
}
```

Áp đúng khuôn này cho `member`, `criterion`, `judge`. Với `criterion.update`, đặt
`detail` giàu hơn khi barem đổi:

```ts
const before = await prisma.criterion.findUnique({ where: { id: params.id } });
const after = await updateCriterion(params.id, body);
const detail = before && before.maxScore !== after.maxScore
  ? `maxScore: ${before.maxScore} -> ${after.maxScore}` : Object.keys(body).join(', ');
await audit(u, 'criterion.update', { entity: 'criterion', entityId: after.id, target: after.name, detail });
```

- [ ] **Step 2: `api/reveal/route.ts`**

Thêm sau mỗi action:

```ts
if (action === 'revealTeam' || action === 'unrevealTeam') {
  ...
  const team = await prisma.team.findUnique({ where: { id: teamId }, select: { name: true } });
  await audit(u, action === 'revealTeam' ? 'reveal.team' : 'reveal.unteam',
    { entity: 'reveal', entityId: teamId, target: team?.name ?? teamId });
  ...
}
if (action === 'revealJudges') { await revealJudgeScores(); await audit(u, 'reveal.judges', { entity: 'reveal' }); ... }
if (action === 'reset') { await resetReveal(); await audit(u, 'reveal.reset', { entity: 'reveal' }); ... }
```

- [ ] **Step 3: `api/scores/route.ts`**

```ts
const team = await prisma.team.findUnique({ where: { id: teamId }, select: { name: true } });
const total = values.reduce((a: number, v: any) => a + v.value, 0);
await audit(u, submitted ? 'score.submit' : 'score.save', {
  entity: 'score', entityId: `${u.id}:${teamId}`, target: team?.name ?? teamId,
  detail: `tong ${Math.round(total * 10) / 10}`,
});
```

`score.save` ghi mỗi lần lưu nháp. Chấp nhận có nhiều dòng: đây là dữ liệu cần
truy vết nhất, và cả giải cũng chỉ vài trăm dòng.

- [ ] **Step 4: `api/auth/login/route.ts` và `logout`**

```ts
export async function POST(req: Request) {
  const { code } = await req.json();
  const normalized = (code || '').trim().toUpperCase();
  const user = await prisma.user.findUnique({ where: { accessCode: normalized } });
  if (!user || !user.active) {
    // KHÔNG ghi mã đầy đủ vào log — nhật ký sẽ trở thành kho mã truy cập.
    await audit(null, 'auth.login_failed', {
      entity: 'auth', detail: normalized.slice(0, 4) + '***',
    });
    return NextResponse.json({ error: 'Mã truy cập không hợp lệ' }, { status: 401 });
  }
  await audit({ id: user.id, name: user.name, role: user.role }, 'auth.login', { entity: 'auth' });
  ...
}
```

`logout`: lấy user hiện tại trước khi xoá cookie, ghi `auth.logout`.

- [ ] **Step 5: `api/board/image/route.ts`**

`settings.hero_image` hoặc `settings.banner_image` tuỳ field trong body, `detail`
là `'đặt ảnh'` hoặc `'xoá ảnh'` tuỳ giá trị null.

- [ ] **Step 6: Kiểm tra**

Run: `npx tsc --noEmit && npm test`
Expected: sạch.

Thử tay: `npm run dev`, đăng nhập, sửa một đội, đổi một tiêu chí, công bố một
đội, rồi:

```bash
psql "$DATABASE_URL" -c 'select "createdAt","actorName","action","target","detail" from "AuditLog" order by "createdAt" desc limit 10;'
```

Expected: thấy đủ các dòng vừa tạo, `actorName` đúng người đang đăng nhập.

- [ ] **Step 7: Commit**

```bash
git add src/app/api
git commit -m "feat(audit): ghi nhat ky moi thao tac thay doi du lieu"
```

---

### Task 11: Sửa mã login bằng tay + xác nhận khi đổi mã

**Files:**
- Modify: `src/lib/access-code.ts`
- Create: `src/lib/services/access.ts`
- Modify: `src/lib/services/judges.ts`
- Modify: `src/app/api/judges/[id]/route.ts`
- Modify: `src/app/(admin)/admin/judges/page.tsx`
- Test: `tests/services.judges.test.ts`

**Interfaces:**
- Consumes: `audit()` (Task 9), `requireRole()` (Task 8)
- Produces:
  - `normalizeAccessCode(raw: string): string`
  - `validateAccessCode(code: string): string | null` — `null` là hợp lệ, ngược lại là câu lỗi tiếng Việt
  - `type SetCodeResult = { ok: true; code: string } | { ok: false; error: string }`
  - `setUserAccessCode(id: string, raw: string): Promise<SetCodeResult>`
  - `regenerateUserCode(id: string): Promise<{ code: string }>`
  - `judges.ts`: `regenerateCode(id)` giữ tên cũ nhưng gọi `regenerateUserCode`

- [ ] **Step 1: Viết test thất bại**

Thêm vào `tests/services.judges.test.ts`:

```ts
import { normalizeAccessCode, validateAccessCode } from '@/lib/access-code';
import { setUserAccessCode } from '@/lib/services/access';

describe('access code', () => {
  it('chuan hoa ve uppercase va bo khoang trang', () => {
    expect(normalizeAccessCode('  abcd-1234 ')).toBe('ABCD-1234');
  });

  it('tu choi ma qua ngan, qua dai, ky tu la', () => {
    expect(validateAccessCode('ABC')).not.toBeNull();
    expect(validateAccessCode('A'.repeat(33))).not.toBeNull();
    expect(validateAccessCode('ABCD_1234')).not.toBeNull();
    expect(validateAccessCode('ABCD-1234')).toBeNull();
  });

  it('setUserAccessCode luu ma da chuan hoa', async () => {
    const j = await prisma.user.create({ data: { name: 'BGK test', role: 'judge', accessCode: 'TMP1-TMP1' } });
    const r = await setUserAccessCode(j.id, 'bgk9-2026');
    expect(r).toEqual({ ok: true, code: 'BGK9-2026' });
    const after = await prisma.user.findUnique({ where: { id: j.id } });
    expect(after?.accessCode).toBe('BGK9-2026');
    await prisma.user.delete({ where: { id: j.id } });
  });

  it('tu choi ma da co nguoi khac dung', async () => {
    const a = await prisma.user.create({ data: { name: 'A', role: 'judge', accessCode: 'DUP1-0001' } });
    const b = await prisma.user.create({ data: { name: 'B', role: 'judge', accessCode: 'DUP1-0002' } });
    const r = await setUserAccessCode(b.id, 'DUP1-0001');
    expect(r.ok).toBe(false);
    await prisma.user.deleteMany({ where: { id: { in: [a.id, b.id] } } });
  });

  it('dat lai chinh ma cua minh thi khong bao trung', async () => {
    const a = await prisma.user.create({ data: { name: 'C', role: 'judge', accessCode: 'SAME-0001' } });
    expect(await setUserAccessCode(a.id, 'same-0001')).toEqual({ ok: true, code: 'SAME-0001' });
    await prisma.user.delete({ where: { id: a.id } });
  });
});
```

- [ ] **Step 2: Chạy test để chắc chắn nó fail**

Run: `npx vitest run tests/services.judges.test.ts`
Expected: FAIL — chưa có `normalizeAccessCode` / `setUserAccessCode`.

- [ ] **Step 3: Bổ sung `src/lib/access-code.ts`**

```ts
const CODE_RE = /^[A-Z0-9-]{4,32}$/;

/** Mã LUÔN lưu uppercase: /api/auth/login tra cứu bằng code.trim().toUpperCase(),
 *  nên một mã lưu chữ thường sẽ vĩnh viễn không đăng nhập được. */
export function normalizeAccessCode(raw: string): string {
  return (raw || '').trim().toUpperCase();
}

export function validateAccessCode(code: string): string | null {
  if (!code) return 'Mã truy cập không được để trống';
  if (code.length < 4) return 'Mã truy cập cần ít nhất 4 ký tự';
  if (code.length > 32) return 'Mã truy cập tối đa 32 ký tự';
  if (!CODE_RE.test(code)) return 'Mã chỉ gồm chữ A-Z, số 0-9 và dấu gạch ngang';
  return null;
}
```

- [ ] **Step 4: Viết `src/lib/services/access.ts`**

```ts
import { prisma } from '@/lib/db';
import { generateAccessCode, normalizeAccessCode, validateAccessCode } from '@/lib/access-code';

export type SetCodeResult = { ok: true; code: string } | { ok: false; error: string };

/** Export vì Task 12 (accounts.ts) dùng chung để sinh mã cho tài khoản quản trị. */
export async function uniqueCode(): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const c = generateAccessCode();
    if (!(await prisma.user.findUnique({ where: { accessCode: c } }))) return c;
  }
  return generateAccessCode() + Math.floor(Math.random() * 9);
}

/** Dùng chung cho cả tài khoản BGK và tài khoản quản trị. */
export async function setUserAccessCode(id: string, raw: string): Promise<SetCodeResult> {
  const code = normalizeAccessCode(raw);
  const err = validateAccessCode(code);
  if (err) return { ok: false, error: err };
  const owner = await prisma.user.findUnique({ where: { accessCode: code }, select: { id: true } });
  if (owner && owner.id !== id) return { ok: false, error: 'Mã này đã có tài khoản khác dùng' };
  await prisma.user.update({ where: { id }, data: { accessCode: code } });
  return { ok: true, code };
}

export async function regenerateUserCode(id: string): Promise<{ code: string }> {
  const code = await uniqueCode();
  await prisma.user.update({ where: { id }, data: { accessCode: code } });
  return { code };
}
```

`src/lib/services/judges.ts`: xoá bản `uniqueCode` cục bộ, đổi
`regenerateCode(id)` thành `return regenerateUserCode(id)`, `createJudge` dùng
`uniqueCode` từ `access.ts` (export thêm nếu cần).

- [ ] **Step 5: Chạy test**

Run: `npx vitest run tests/services.judges.test.ts`
Expected: PASS.

- [ ] **Step 6: Route nhận `accessCode`**

`src/app/api/judges/[id]/route.ts`:

```ts
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const u = await requireRole('admin', 'superadmin');
  if (!u) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const { name, isHead, accessCode } = await req.json();

  if (typeof accessCode === 'string' && accessCode.trim()) {
    const r = await setUserAccessCode(params.id, accessCode);
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
    const j = await prisma.user.findUnique({ where: { id: params.id }, select: { name: true } });
    await audit(u, 'judge.set_code', { entity: 'judge', entityId: params.id, target: j?.name ?? params.id });
  }
  if (typeof name === 'string' && name.trim()) {
    await updateJudge(params.id, { name: name.trim() });
    await audit(u, 'judge.update', { entity: 'judge', entityId: params.id, target: name.trim() });
  }
  if (isHead === true) {
    await setHead(params.id);
    await audit(u, 'judge.set_head', { entity: 'judge', entityId: params.id });
  }
  return NextResponse.json({ ok: true });
}
```

POST action `regen` ghi `judge.regen_code`.

Lưu ý: `judge.set_code` và `judge.regen_code` **không** ghi mã mới vào `detail` —
nhật ký không được biến thành danh bạ mã truy cập.

- [ ] **Step 7: UI `/admin/judges`**

Thêm `accessCode` vào state form và ô nhập trong modal Sửa:

```tsx
const [form, setForm] = useState({ name: '', isHead: false, accessCode: '' });
function openEdit(j: Judge) { setForm({ name: j.name, isHead: j.isHead, accessCode: j.accessCode }); setModal(j); }
```

```tsx
{modal !== 'add' && (
  <div className="field">
    <label>Mã truy cập</label>
    <input className="input" value={form.accessCode} style={{ fontFamily: 'monospace', letterSpacing: '.08em' }}
      onChange={(e) => setForm({ ...form, accessCode: e.target.value.toUpperCase() })} />
    <div className="hint">4-32 ký tự, chỉ A-Z, 0-9 và dấu gạch ngang. Đổi mã là mã cũ hết hiệu lực ngay.</div>
  </div>
)}
```

`save()` hỏi xác nhận khi mã thay đổi, và hiện lỗi trả về từ API:

```tsx
async function save() {
  if (!form.name) return;
  const j = modal !== 'add' ? (modal as Judge) : null;
  if (j && form.accessCode !== j.accessCode) {
    if (!(await confirm({
      title: 'Đổi mã truy cập',
      message: `Mã ${j.accessCode} sẽ hết hiệu lực ngay. Giám khảo phải dùng mã mới để đăng nhập lần sau. Xác nhận?`,
      confirmText: 'Đổi mã', danger: true,
    }))) return;
  }
  setBusy(true);
  try {
    if (modal === 'add') await fetcher('/api/judges', { method: 'POST', body: JSON.stringify({ name: form.name, isHead: form.isHead }) });
    else await fetcher('/api/judges/' + j!.id, { method: 'PATCH', body: JSON.stringify(form) });
    setModal(null); setErr(''); await load();
  } catch (e: any) { setErr(e.message); }
  finally { setBusy(false); }
}
```

Thêm state `const [err, setErr] = useState('')` và hiện `err` trong modal.

Nút `Đổi mã` trong bảng cũng phải xác nhận:

```tsx
async function regen(j: Judge) {
  if (!(await confirm({
    title: 'Đổi mã truy cập',
    message: `Sinh mã mới cho "${j.name}". Mã hiện tại ${j.accessCode} hết hiệu lực ngay. Xác nhận?`,
    confirmText: 'Đổi mã', danger: true,
  }))) return;
  await fetcher('/api/judges/' + j.id, { method: 'POST', body: JSON.stringify({ action: 'regen' }) });
  load();
}
```

và cột thao tác gọi `onClick={() => regen(j)}`.

- [ ] **Step 8: Kiểm tra + thử tay**

Run: `npx tsc --noEmit && npm test`

`npm run dev`: vào `/admin/judges`, sửa mã một BGK thành `TEST-9999` → hiện hộp
xác nhận → lưu → đăng xuất, đăng nhập bằng `test-9999` (chữ thường) phải vào được.
Nhập mã trùng của BGK khác → hiện lỗi, không lưu.

- [ ] **Step 9: Commit**

```bash
git add src/lib/access-code.ts src/lib/services/access.ts src/lib/services/judges.ts src/app tests
git commit -m "feat(admin): sua ma login bang tay, xac nhan khi doi ma"
```

---

### Task 12: Tài khoản quản trị — service, API, script tạo tài khoản

**Files:**
- Create: `src/lib/services/accounts.ts`
- Create: `src/app/api/accounts/route.ts`, `src/app/api/accounts/[id]/route.ts`
- Create: `prisma/ensure-accounts.ts`
- Modify: `prisma/seed.ts`, `package.json`, `.env.example`, `docs/DEPLOY.md`
- Create: `tests/services.accounts.test.ts`

**Interfaces:**
- Consumes: `setUserAccessCode`, `regenerateUserCode` (Task 11); `requireRole` (Task 8); `audit` (Task 9)
- Produces:
  - `type AccountRow = { id: string; name: string; role: 'superadmin' | 'admin'; accessCode: string; active: boolean; createdAt: Date }`
  - `listAccounts(): Promise<AccountRow[]>`
  - `createAccount(data: { name: string; role: 'superadmin' | 'admin' }): Promise<AccountRow>`
  - `updateAccount(id: string, data: { name?: string; active?: boolean }): Promise<AccountRow>`
  - `deleteAccount(id: string): Promise<void>`
  - `checkAccountMutable(id: string, actorId: string, next: { active?: boolean; deleting?: boolean }): Promise<string | null>` — `null` là cho phép, ngược lại là câu lỗi

- [ ] **Step 1: Viết test thất bại**

Tạo `tests/services.accounts.test.ts`:

```ts
import { describe, it, expect, afterAll } from 'vitest';
import { prisma, disconnect } from './helpers/db';
import { checkAccountMutable, createAccount, deleteAccount, listAccounts } from '@/lib/services/accounts';

afterAll(disconnect);

describe('accounts', () => {
  it('createAccount sinh ma tu dong va role dung', async () => {
    const a = await createAccount({ name: 'Khach hang', role: 'admin' });
    expect(a.role).toBe('admin');
    expect(a.accessCode).toMatch(/^[A-Z0-9-]{4,32}$/);
    expect((await listAccounts()).some((x) => x.id === a.id)).toBe(true);
    await deleteAccount(a.id);
  });

  it('khong cho tu xoa chinh minh', async () => {
    const a = await createAccount({ name: 'Tu xoa', role: 'admin' });
    expect(await checkAccountMutable(a.id, a.id, { deleting: true })).not.toBeNull();
    await deleteAccount(a.id);
  });

  it('khong cho xoa superadmin active cuoi cung', async () => {
    await prisma.user.deleteMany({ where: { role: 'superadmin' } });
    const s = await createAccount({ name: 'Super duy nhat', role: 'superadmin' });
    expect(await checkAccountMutable(s.id, 'nguoi-khac', { deleting: true })).not.toBeNull();
    expect(await checkAccountMutable(s.id, 'nguoi-khac', { active: false })).not.toBeNull();

    const s2 = await createAccount({ name: 'Super thu hai', role: 'superadmin' });
    expect(await checkAccountMutable(s.id, 'nguoi-khac', { deleting: true })).toBeNull();

    await prisma.user.deleteMany({ where: { id: { in: [s.id, s2.id] } } });
  });
});
```

- [ ] **Step 2: Chạy test để chắc chắn nó fail**

Run: `npx vitest run tests/services.accounts.test.ts`
Expected: FAIL — chưa có module `@/lib/services/accounts`.

- [ ] **Step 3: Viết `src/lib/services/accounts.ts`**

```ts
import { prisma } from '@/lib/db';
import { uniqueCode } from '@/lib/services/access';

export type AccountRole = 'superadmin' | 'admin';
export type AccountRow = {
  id: string; name: string; role: AccountRole; accessCode: string; active: boolean; createdAt: Date;
};

const SELECT = { id: true, name: true, role: true, accessCode: true, active: true, createdAt: true } as const;

export async function listAccounts(): Promise<AccountRow[]> {
  const rows = await prisma.user.findMany({
    where: { role: { in: ['superadmin', 'admin'] } },
    orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
    select: SELECT,
  });
  return rows as AccountRow[];
}

export async function createAccount(data: { name: string; role: AccountRole }): Promise<AccountRow> {
  const row = await prisma.user.create({
    data: { name: data.name, role: data.role, accessCode: await uniqueCode() },
    select: SELECT,
  });
  return row as AccountRow;
}

export async function updateAccount(id: string, data: { name?: string; active?: boolean }): Promise<AccountRow> {
  const row = await prisma.user.update({ where: { id }, data, select: SELECT });
  return row as AccountRow;
}

export async function deleteAccount(id: string): Promise<void> {
  await prisma.user.delete({ where: { id } });
}

/**
 * Hai chốt an toàn, kiểm ở service chứ không chỉ ở UI:
 *  1. không ai tự khoá/xoá chính mình (tự nhốt mình ngoài cửa),
 *  2. luôn còn ít nhất một superadmin active (nếu không thì trang tài khoản
 *     và nhật ký thao tác thành vùng không ai vào được nữa).
 * Trả null nếu cho phép, ngược lại trả câu lỗi hiển thị thẳng cho người dùng.
 */
export async function checkAccountMutable(
  id: string,
  actorId: string,
  next: { active?: boolean; deleting?: boolean },
): Promise<string | null> {
  const target = await prisma.user.findUnique({ where: { id }, select: { role: true, active: true } });
  if (!target) return 'Không tìm thấy tài khoản';
  const losing = next.deleting === true || next.active === false;
  if (!losing) return null;
  if (id === actorId) return 'Không thể xoá hoặc khoá chính tài khoản bạn đang đăng nhập';
  if (target.role === 'superadmin' && target.active) {
    const others = await prisma.user.count({
      where: { role: 'superadmin', active: true, id: { not: id } },
    });
    if (others === 0) return 'Phải còn ít nhất một Super Admin đang hoạt động';
  }
  return null;
}
```

`uniqueCode` đã được export từ `access.ts` ở Task 11 — import trực tiếp, không
viết lại bản thứ hai.

- [ ] **Step 4: Chạy test**

Run: `npx vitest run tests/services.accounts.test.ts`
Expected: PASS, 3 test.

- [ ] **Step 5: API**

`src/app/api/accounts/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { audit } from '@/lib/audit';
import { listAccounts, createAccount } from '@/lib/services/accounts';

export async function GET() {
  const u = await requireRole('superadmin');
  if (!u) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  return NextResponse.json(await listAccounts());
}

export async function POST(req: Request) {
  const u = await requireRole('superadmin');
  if (!u) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const { name, role } = await req.json();
  if (typeof name !== 'string' || !name.trim()) return NextResponse.json({ error: 'name required' }, { status: 400 });
  if (role !== 'admin' && role !== 'superadmin') return NextResponse.json({ error: 'role không hợp lệ' }, { status: 400 });
  const acc = await createAccount({ name: name.trim(), role });
  await audit(u, 'account.create', { entity: 'account', entityId: acc.id, target: acc.name, detail: acc.role });
  return NextResponse.json(acc, { status: 201 });
}

export const dynamic = 'force-dynamic';
```

`src/app/api/accounts/[id]/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { audit } from '@/lib/audit';
import { prisma } from '@/lib/db';
import { checkAccountMutable, deleteAccount, updateAccount } from '@/lib/services/accounts';
import { setUserAccessCode, regenerateUserCode } from '@/lib/services/access';

// Vai trò cố ý KHÔNG sửa được ở đây: hạ một superadmin xuống admin là đường ngắn
// nhất tới trạng thái không còn superadmin nào, mà checkAccountMutable chỉ canh
// nhánh xoá/khoá. Muốn đổi vai trò thì xoá rồi tạo lại.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const u = await requireRole('superadmin');
  if (!u) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const { name, active, accessCode } = await req.json();

  if (active === false || active === true) {
    const blocked = await checkAccountMutable(params.id, u.id, { active });
    if (blocked) return NextResponse.json({ error: blocked }, { status: 400 });
    const a = await updateAccount(params.id, { active });
    await audit(u, 'account.update', {
      entity: 'account', entityId: a.id, target: a.name, detail: active ? 'mở khoá' : 'khoá',
    });
  }
  if (typeof accessCode === 'string' && accessCode.trim()) {
    const r = await setUserAccessCode(params.id, accessCode);
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
    const a = await prisma.user.findUnique({ where: { id: params.id }, select: { name: true } });
    // KHÔNG ghi mã mới vào detail — nhật ký không được thành danh bạ mã truy cập.
    await audit(u, 'account.set_code', { entity: 'account', entityId: params.id, target: a?.name ?? params.id });
  }
  if (typeof name === 'string' && name.trim()) {
    const a = await updateAccount(params.id, { name: name.trim() });
    await audit(u, 'account.update', { entity: 'account', entityId: a.id, target: a.name, detail: 'đổi tên' });
  }
  return NextResponse.json({ ok: true });
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const u = await requireRole('superadmin');
  if (!u) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const { action } = await req.json();
  if (action !== 'regen') return NextResponse.json({ error: 'unknown action' }, { status: 400 });
  await regenerateUserCode(params.id);
  const a = await prisma.user.findUnique({ where: { id: params.id }, select: { name: true } });
  await audit(u, 'account.regen_code', { entity: 'account', entityId: params.id, target: a?.name ?? params.id });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const u = await requireRole('superadmin');
  if (!u) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const blocked = await checkAccountMutable(params.id, u.id, { deleting: true });
  if (blocked) return NextResponse.json({ error: blocked }, { status: 400 });
  const before = await prisma.user.findUnique({ where: { id: params.id }, select: { name: true } });
  await deleteAccount(params.id);
  await audit(u, 'account.delete', { entity: 'account', entityId: params.id, target: before?.name ?? params.id });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 6: Script `prisma/ensure-accounts.ts`**

```ts
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// KHÔNG phá dữ liệu. Chạy được trên database đang có sự kiện thật, chạy nhiều
// lần vẫn an toàn. Khác hẳn prisma/seed.ts — cái đó xoá sạch.
const SUPER_CODE = process.env.SUPERADMIN_ACCESS_CODE;
const ADMIN_CODE = process.env.ADMIN_ACCESS_CODE;
const SUPER_NAME = process.env.SUPERADMIN_NAME || 'Super Admin';
const ADMIN_NAME = process.env.ADMIN_NAME || 'Ban tổ chức';

async function ensure(role: 'superadmin' | 'admin', name: string, code: string) {
  const existing = await prisma.user.findFirst({ where: { role } });
  if (existing) {
    const u = await prisma.user.update({
      where: { id: existing.id }, data: { accessCode: code.trim().toUpperCase(), active: true },
    });
    console.log(`[cập nhật] ${role}: ${u.name} — mã ${u.accessCode}`);
    return;
  }
  const u = await prisma.user.create({
    data: { name, role, accessCode: code.trim().toUpperCase() },
  });
  console.log(`[tạo mới] ${role}: ${u.name} — mã ${u.accessCode}`);
}

async function main() {
  if (!SUPER_CODE) throw new Error('Thiếu SUPERADMIN_ACCESS_CODE');
  if (!ADMIN_CODE) throw new Error('Thiếu ADMIN_ACCESS_CODE');
  await ensure('superadmin', SUPER_NAME, SUPER_CODE);
  await ensure('admin', ADMIN_NAME, ADMIN_CODE);
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
```

`package.json` scripts thêm: `"accounts": "tsx prisma/ensure-accounts.ts"`.

- [ ] **Step 7: Seed + env + docs**

`prisma/seed.ts`: thêm

```ts
const SUPER_CODE = process.env.SUPERADMIN_ACCESS_CODE || 'SUPER-2026';
...
const superadmin = await prisma.user.create({ data: { name: 'Super Admin', role: 'superadmin', accessCode: SUPER_CODE } });
...
console.log('SUPERADMIN access code:', superadmin.accessCode);
```

`.env.example`: thêm `SUPERADMIN_ACCESS_CODE=` (kèm ghi chú bắt buộc đổi khi deploy).

`docs/DEPLOY.md`: thêm vào mục nâng cấp:

```
# sau khi deploy bản mới
docker compose exec app npx prisma migrate deploy
docker compose exec app npm run accounts
```

kèm một câu: `npm run accounts` an toàn với database đang có dữ liệu, còn
`npm run seed` thì **xoá sạch** — không bao giờ chạy seed trên production.

- [ ] **Step 8: Kiểm tra**

Run: `npx tsc --noEmit && npm test`
Thử tay: `SUPERADMIN_ACCESS_CODE=SUPER-TEST ADMIN_ACCESS_CODE=ADMIN-TEST npm run accounts`
rồi chạy lại lần nữa — lần hai in `[cập nhật]`, không tạo bản sao.

- [ ] **Step 9: Commit**

```bash
git add src/lib/services/accounts.ts src/app/api/accounts prisma package.json .env.example docs/DEPLOY.md tests/services.accounts.test.ts
git commit -m "feat(accounts): quan ly tai khoan quan tri + script ensure-accounts"
```

---

### Task 13: Trang `/admin/accounts` và `/admin/audit`

**Files:**
- Create: `src/lib/services/audit.ts`
- Create: `src/app/api/audit/route.ts`
- Create: `src/app/(admin)/admin/accounts/page.tsx`
- Create: `src/app/(admin)/admin/audit/page.tsx`

**Interfaces:**
- Consumes: API `/api/accounts*` (Task 12), model `AuditLog` (Task 7), `requireRole` (Task 8)
- Produces:
  - `type AuditEntry = { id: string; actorName: string | null; actorRole: string | null; action: string; entity: string | null; entityId: string | null; target: string | null; detail: string | null; createdAt: Date }`
  - `listAudit(opts: { page?: number; pageSize?: number; entity?: string; q?: string }): Promise<{ entries: AuditEntry[]; total: number; page: number; pageCount: number }>`
  - `GET /api/audit?page=&entity=&q=` (chỉ superadmin)

- [ ] **Step 1: Viết `src/lib/services/audit.ts`**

```ts
import { prisma } from '@/lib/db';
import type { Prisma } from '@prisma/client';

export type AuditEntry = {
  id: string; actorName: string | null; actorRole: string | null;
  action: string; entity: string | null; entityId: string | null;
  target: string | null; detail: string | null; createdAt: Date;
};

export async function listAudit(opts: {
  page?: number; pageSize?: number; entity?: string; q?: string;
} = {}) {
  const pageSize = opts.pageSize ?? 50;
  const page = Math.max(1, opts.page ?? 1);
  const where: Prisma.AuditLogWhereInput = {};
  if (opts.entity) where.entity = opts.entity;
  if (opts.q?.trim()) {
    const q = opts.q.trim();
    where.OR = [
      { actorName: { contains: q, mode: 'insensitive' } },
      { target: { contains: q, mode: 'insensitive' } },
      { action: { contains: q, mode: 'insensitive' } },
    ];
  }
  const [total, entries] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where, orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize, take: pageSize,
      select: {
        id: true, actorName: true, actorRole: true, action: true,
        entity: true, entityId: true, target: true, detail: true, createdAt: true,
      },
    }),
  ]);
  return { entries: entries as AuditEntry[], total, page, pageCount: Math.max(1, Math.ceil(total / pageSize)) };
}
```

- [ ] **Step 2: `src/app/api/audit/route.ts`**

```ts
import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { listAudit } from '@/lib/services/audit';

export async function GET(req: Request) {
  const u = await requireRole('superadmin');
  if (!u) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const sp = new URL(req.url).searchParams;
  return NextResponse.json(await listAudit({
    page: Number(sp.get('page')) || 1,
    entity: sp.get('entity') || undefined,
    q: sp.get('q') || undefined,
  }));
}

export const dynamic = 'force-dynamic';
```

- [ ] **Step 3: Trang `/admin/accounts`**

```tsx
'use client';
import { useEffect, useState } from 'react';
import { fetcher } from '@/lib/ui';
import DataTable, { Column } from '@/components/DataTable';
import Modal from '@/components/Modal';
import { useConfirm } from '@/components/ConfirmProvider';

type Account = {
  id: string; name: string; role: 'superadmin' | 'admin';
  accessCode: string; active: boolean; createdAt: string;
};

export default function Accounts() {
  const [rows, setRows] = useState<Account[]>([]);
  const [modal, setModal] = useState<null | 'add' | Account>(null);
  const [form, setForm] = useState<{ name: string; role: 'superadmin' | 'admin'; accessCode: string }>(
    { name: '', role: 'admin', accessCode: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const confirm = useConfirm();

  async function load() { setRows(await fetcher('/api/accounts')); }
  useEffect(() => { load(); }, []);

  function openAdd() { setForm({ name: '', role: 'admin', accessCode: '' }); setErr(''); setModal('add'); }
  function openEdit(a: Account) { setForm({ name: a.name, role: a.role, accessCode: a.accessCode }); setErr(''); setModal(a); }

  async function save() {
    if (!form.name.trim()) return;
    const a = modal !== 'add' ? (modal as Account) : null;
    if (a && form.accessCode !== a.accessCode) {
      if (!(await confirm({
        title: 'Đổi mã truy cập',
        message: `Mã ${a.accessCode} sẽ hết hiệu lực ngay. Người dùng phải đăng nhập bằng mã mới. Xác nhận?`,
        confirmText: 'Đổi mã', danger: true,
      }))) return;
    }
    setBusy(true); setErr('');
    try {
      if (modal === 'add') {
        await fetcher('/api/accounts', { method: 'POST', body: JSON.stringify({ name: form.name.trim(), role: form.role }) });
      } else {
        await fetcher('/api/accounts/' + a!.id, {
          method: 'PATCH', body: JSON.stringify({ name: form.name.trim(), accessCode: form.accessCode }),
        });
      }
      setModal(null); await load();
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  }

  async function regen(a: Account) {
    if (!(await confirm({
      title: 'Đổi mã truy cập',
      message: `Sinh mã mới cho "${a.name}". Mã hiện tại ${a.accessCode} hết hiệu lực ngay. Xác nhận?`,
      confirmText: 'Đổi mã', danger: true,
    }))) return;
    try { await fetcher('/api/accounts/' + a.id, { method: 'POST', body: JSON.stringify({ action: 'regen' }) }); await load(); }
    catch (e: any) { setErr(e.message); }
  }

  async function toggleActive(a: Account) {
    if (a.active && !(await confirm({
      title: 'Khoá tài khoản',
      message: `Khoá "${a.name}"? Người này không đăng nhập được nữa cho tới khi được mở lại.`,
      confirmText: 'Khoá', danger: true,
    }))) return;
    try { await fetcher('/api/accounts/' + a.id, { method: 'PATCH', body: JSON.stringify({ active: !a.active }) }); await load(); }
    catch (e: any) { setErr(e.message); }
  }

  async function del(a: Account) {
    if (!(await confirm({
      title: 'Xoá tài khoản', danger: true, confirmText: 'Xoá',
      message: `Xoá tài khoản "${a.name}"? Người này sẽ không đăng nhập được nữa. `
             + `Nhật ký thao tác cũ vẫn giữ tên họ.`,
    }))) return;
    try { await fetcher('/api/accounts/' + a.id, { method: 'DELETE' }); await load(); }
    catch (e: any) { setErr(e.message); }
  }

  const columns: Column<Account>[] = [
    { key: 'name', header: 'Tài khoản', filterText: (a) => a.name, render: (a) => (
      <span><b>{a.name}</b>{' '}
        <span className="badge-head">{a.role === 'superadmin' ? 'Super Admin' : 'Admin'}</span></span>
    ) },
    { key: 'code', header: 'Mã truy cập', filterText: (a) => a.accessCode,
      render: (a) => <span className="code-chip">{a.accessCode}</span> },
    { key: 'active', header: 'Trạng thái', render: (a) => (
      <span className={'pill ' + (a.active ? 'done' : 'pending')}>{a.active ? 'Hoạt động' : 'Đã khoá'}</span>
    ) },
    { key: 'created', header: 'Ngày tạo', render: (a) => new Date(a.createdAt).toLocaleDateString('vi-VN') },
    { key: 'act', header: 'Thao tác', align: 'right', render: (a) => (
      <span style={{ whiteSpace: 'nowrap' }}>
        <button className="btn btn-sm" onClick={() => openEdit(a)}>Sửa</button>{' '}
        <button className="btn btn-sm" onClick={() => regen(a)}>↻ Đổi mã</button>{' '}
        <button className="btn btn-sm" onClick={() => toggleActive(a)}>{a.active ? 'Khoá' : 'Mở'}</button>{' '}
        <button className="btn btn-sm btn-danger" onClick={() => del(a)}>Xoá</button>
      </span>
    ) },
  ];

  return (
    <>
      {err && <div className="note" style={{ marginBottom: 14 }}><span>!</span><div>{err}</div></div>}

      <DataTable
        columns={columns} rows={rows} getId={(a) => a.id}
        searchPlaceholder="Tìm theo tên hoặc mã…"
        toolbarRight={<button className="btn btn-primary" onClick={openAdd}>＋ Thêm tài khoản</button>}
      />

      {modal && (
        <Modal
          title={modal === 'add' ? 'Thêm tài khoản quản trị' : 'Sửa tài khoản'}
          onClose={() => setModal(null)}
          footer={<>
            <button className="btn" onClick={() => setModal(null)}>Huỷ</button>
            <button className="btn btn-primary" disabled={busy} onClick={save}>{modal === 'add' ? 'Thêm' : 'Lưu'}</button>
          </>}
        >
          <div className="field"><label>Tên tài khoản</label>
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>

          {modal === 'add' && (
            <div className="field"><label>Vai trò</label>
              <select className="input" value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value as 'admin' | 'superadmin' })}>
                <option value="admin">Admin (khách hàng) — không thấy nhật ký thao tác</option>
                <option value="superadmin">Super Admin — toàn quyền</option>
              </select>
              <div className="hint">Mã truy cập sẽ tự sinh sau khi tạo.</div>
            </div>
          )}

          {modal !== 'add' && (
            <div className="field"><label>Mã truy cập</label>
              <input className="input" value={form.accessCode} style={{ fontFamily: 'monospace', letterSpacing: '.08em' }}
                onChange={(e) => setForm({ ...form, accessCode: e.target.value.toUpperCase() })} />
              <div className="hint">4-32 ký tự, chỉ A-Z, 0-9 và dấu gạch ngang.</div>
            </div>
          )}

          {err && <div className="hint" style={{ color: 'var(--red, #c0392b)' }}>{err}</div>}
        </Modal>
      )}
    </>
  );
}
```

Vai trò **không sửa được sau khi tạo**: hạ một superadmin xuống admin là đường
ngắn nhất tới trạng thái không còn superadmin nào, và `checkAccountMutable` chỉ
canh xoá/khoá. Cần đổi vai trò thì xoá và tạo lại.

- [ ] **Step 4: Trang `/admin/audit`**

```tsx
'use client';
import { useCallback, useEffect, useState } from 'react';
import { fetcher } from '@/lib/ui';

const ACTION_LABEL: Record<string, string> = {
  'auth.login': 'Đăng nhập', 'auth.logout': 'Đăng xuất', 'auth.login_failed': 'Đăng nhập thất bại',
  'team.create': 'Tạo đội', 'team.update': 'Sửa đội', 'team.delete': 'Xoá đội',
  'member.create': 'Thêm thành viên', 'member.update': 'Sửa thành viên', 'member.delete': 'Xoá thành viên',
  'judge.create': 'Thêm giám khảo', 'judge.update': 'Sửa giám khảo', 'judge.delete': 'Xoá giám khảo',
  'judge.regen_code': 'Đổi mã giám khảo', 'judge.set_code': 'Sửa mã giám khảo', 'judge.set_head': 'Đặt Trưởng BGK',
  'account.create': 'Tạo tài khoản', 'account.update': 'Sửa tài khoản', 'account.delete': 'Xoá tài khoản',
  'account.regen_code': 'Đổi mã tài khoản', 'account.set_code': 'Sửa mã tài khoản',
  'criterion.create': 'Thêm tiêu chí', 'criterion.update': 'Sửa tiêu chí', 'criterion.delete': 'Xoá tiêu chí',
  'score.save': 'Lưu nháp điểm', 'score.submit': 'Nộp điểm', 'score.unlock': 'Mở khoá phiếu chấm',
  'reveal.team': 'Công bố đội', 'reveal.unteam': 'Thu hồi đội', 'reveal.judges': 'Công bố điểm BGK',
  'reveal.reset': 'Reset công bố',
  'settings.hero_image': 'Đổi ảnh màn chiếu', 'settings.banner_image': 'Đổi banner',
};

const ENTITIES = [
  ['', 'Tất cả'], ['auth', 'Đăng nhập'], ['team', 'Đội thi'], ['member', 'Thành viên'],
  ['judge', 'Giám khảo'], ['account', 'Tài khoản'], ['criterion', 'Barem'],
  ['score', 'Điểm'], ['reveal', 'Công bố'], ['settings', 'Cấu hình'],
];

export default function Audit() {
  const [data, setData] = useState<any>(null);
  const [page, setPage] = useState(1);
  const [entity, setEntity] = useState('');
  const [q, setQ] = useState('');

  const load = useCallback(async () => {
    const sp = new URLSearchParams({ page: String(page) });
    if (entity) sp.set('entity', entity);
    if (q.trim()) sp.set('q', q.trim());
    setData(await fetcher('/api/audit?' + sp.toString()));
  }, [page, entity, q]);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="card">
      <div className="table-tools">
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flex: 1 }}>
          <div className="table-search">
            <span className="s-ic">?</span>
            <input value={q} placeholder="Tìm theo người thao tác hoặc đối tượng…"
              onChange={(e) => { setQ(e.target.value); setPage(1); }} />
          </div>
          <select className="filter-select" value={entity}
            onChange={(e) => { setEntity(e.target.value); setPage(1); }}>
            {ENTITIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        {data && <span style={{ fontSize: 12.5, color: 'var(--muted-2)' }}>{data.total} bản ghi</span>}
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table>
          <thead><tr><th>Thời điểm</th><th>Người thao tác</th><th>Hành động</th><th>Đối tượng</th><th>Chi tiết</th></tr></thead>
          <tbody>
            {!data && <tr><td colSpan={5} style={{ color: 'var(--muted-2)' }}>Đang tải…</td></tr>}
            {data?.entries.map((e: any) => (
              <tr key={e.id}>
                <td className="tnum" style={{ whiteSpace: 'nowrap' }}>
                  {new Date(e.createdAt).toLocaleString('vi-VN')}
                </td>
                <td>{e.actorName || <i style={{ color: 'var(--muted-2)' }}>—</i>}
                  {e.actorRole && <small style={{ display: 'block', color: 'var(--muted-2)' }}>{e.actorRole}</small>}</td>
                <td>{ACTION_LABEL[e.action] || e.action}</td>
                <td>{e.target || '—'}</td>
                <td style={{ color: 'var(--muted-2)' }}>{e.detail || '—'}</td>
              </tr>
            ))}
            {data?.entries.length === 0 && <tr><td colSpan={5}><div className="empty-row">Không có bản ghi</div></td></tr>}
          </tbody>
        </table>
      </div>

      {data && data.pageCount > 1 && (
        <div className="pagination">
          <span className="info">Trang {data.page}/{data.pageCount}</span>
          <div className="page-btns">
            <button className="page-btn" disabled={page <= 1} onClick={() => setPage(page - 1)}>‹</button>
            <button className="page-btn" disabled={page >= data.pageCount} onClick={() => setPage(page + 1)}>›</button>
          </div>
        </div>
      )}
    </div>
  );
}
```

Dùng `DataTable` không hợp ở đây vì nó lọc và phân trang phía client trên mảng
đã tải; audit log phân trang phía server.

- [ ] **Step 5: Kiểm tra**

Run: `npx tsc --noEmit && npm run build`

Thử tay: đăng nhập bằng **superadmin** → thấy 2 mục nav mới, `/admin/audit` có
dữ liệu, lọc theo `Công bố` ra đúng các dòng reveal. Đăng nhập bằng **admin
khách hàng** → **không** thấy 2 mục đó, gõ thẳng URL `/admin/audit` thì
`/api/audit` trả 403 và trang hiện lỗi (không rơi vào màn trắng).

- [ ] **Step 6: Commit**

```bash
git add src/lib/services/audit.ts src/app/api/audit src/app/\(admin\)/admin/accounts src/app/\(admin\)/admin/audit
git commit -m "feat(admin): trang tai khoan quan tri va nhat ky thao tac"
```

**Chốt Phase 2:** `npm test && npx tsc --noEmit && npm run build` phải sạch.

---

# Phase 3 — Khu ban giám khảo và khoá phiếu chấm

### Task 14: BGK xem chi tiết từng đội

**Files:**
- Modify: `src/lib/services/teams.ts`
- Modify: `src/app/api/teams/[id]/route.ts`
- Create: `src/app/(judge)/judge/team/[id]/page.tsx`
- Modify: `src/app/(judge)/judge/page.tsx`
- Modify: `src/components/Shell.tsx` (breadcrumb)

**Interfaces:**
- Consumes: `requireRole` (Task 8)
- Produces:
  - `type JudgeTeamView = { id: string; name: string; code: string; tag: string | null; logoUrl: string | null; members: { id: string; name: string; teamRole: string | null; photoUrl: string | null; org: string | null; intro: string | null }[] }`
  - `getTeamForJudge(id: string): Promise<JudgeTeamView | null>`
  - `GET /api/teams/[id]` → `JudgeTeamView` (judge) hoặc bản đầy đủ (admin)

- [ ] **Step 1: Thêm vào `src/lib/services/teams.ts`**

```ts
export type JudgeTeamView = {
  id: string; name: string; code: string; tag: string | null; logoUrl: string | null;
  members: { id: string; name: string; teamRole: string | null; photoUrl: string | null;
             org: string | null; intro: string | null }[];
};

/** Bản dành cho giám khảo: KHÔNG có email và số điện thoại thành viên. Đó là dữ
 *  liệu liên hệ của ban tổ chức, không phục vụ việc chấm. */
export async function getTeamForJudge(id: string): Promise<JudgeTeamView | null> {
  const t = await prisma.team.findUnique({
    where: { id },
    select: {
      id: true, name: true, code: true, tag: true, logoUrl: true,
      members: {
        select: { id: true, name: true, teamRole: true, photoUrl: true, org: true, intro: true },
      },
    },
  });
  return t;
}
```

- [ ] **Step 2: `GET` trong `src/app/api/teams/[id]/route.ts`**

```ts
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const u = await getCurrentUser();
  if (!u) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const team = await getTeamForJudge(params.id);
  if (!team) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json(team);
}

export const dynamic = 'force-dynamic';
```

Admin đã có view riêng ở `/admin/teams/[id]` nên dùng chung bản này là đủ.

- [ ] **Step 3: Trang `/judge/team/[id]`**

```tsx
'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { fetcher } from '@/lib/ui';
import { TeamLogo, MemberAvatar } from '@/components/Avatar';

export default function JudgeTeamDetail({ params }: { params: { id: string } }) {
  const [team, setTeam] = useState<any>(null);
  useEffect(() => { fetcher('/api/teams/' + params.id).then(setTeam); }, [params.id]);
  if (!team) return <div>Đang tải…</div>;

  return (
    <>
      <div className="page-head">
        <div className="tcell">
          <TeamLogo code={team.code} logoUrl={team.logoUrl} />
          <div>
            <div className="page-title">{team.name}</div>
            <small style={{ color: 'var(--muted-2)' }}>{team.tag}</small>
          </div>
        </div>
        <Link className="btn btn-primary" href={'/judge/score/' + team.id}>Chấm điểm đội này →</Link>
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))' }}>
        {team.members.map((m: any) => (
          <div key={m.id} className="card card-pad">
            <div className="tcell">
              <MemberAvatar name={m.name} photoUrl={m.photoUrl} />
              <div>
                <b>{m.name}</b>
                <small style={{ display: 'block', color: 'var(--muted-2)' }}>{m.teamRole || '—'}</small>
              </div>
            </div>
            {m.org && <p style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 12 }}>{m.org}</p>}
            {m.intro && <p style={{ fontSize: 12.5, color: 'var(--muted-2)', marginTop: 6 }}>{m.intro}</p>}
          </div>
        ))}
        {team.members.length === 0 && <div className="card card-pad" style={{ color: 'var(--muted-2)' }}>Đội chưa có thành viên.</div>}
      </div>
    </>
  );
}
```

`TeamLogo` và `MemberAvatar` là đúng tên đang export từ
`src/components/Avatar.tsx` (`/admin/teams/[id]/page.tsx:8` dùng cặp này).

- [ ] **Step 4: `/judge` tách hai đường**

Card không còn là `<Link>` bao ngoài; thân card dẫn tới chi tiết đội, nút dẫn tới
chấm điểm:

```tsx
<div key={t.id} className="card card-pad" style={{ borderColor: done ? 'rgba(31,157,85,.4)' : undefined }}>
  <Link href={'/judge/team/' + t.id} style={{ display: 'block' }}>
    ... phần logo, tên, số thành viên, pill trạng thái, tagline như cũ ...
  </Link>
  <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
    <Link className="btn btn-sm" href={'/judge/team/' + t.id} style={{ flex: 1, justifyContent: 'center' }}>Xem đội</Link>
    <Link className="btn btn-sm btn-primary" href={'/judge/score/' + t.id} style={{ flex: 1, justifyContent: 'center' }}>
      {done ? 'Xem phiếu' : 'Chấm điểm'}
    </Link>
  </div>
</div>
```

- [ ] **Step 5: Breadcrumb**

`buildCrumbs` thêm nhánh:

```ts
} else if (path.startsWith('/judge/team/')) {
  items.push({ label: 'Danh sách đội', href: '/judge' }, { label: 'Chi tiết đội' });
}
```

- [ ] **Step 6: Kiểm tra**

Run: `npx tsc --noEmit`
Thử tay: đăng nhập BGK, `/judge` → `Xem đội` → thấy thành viên, **không** thấy
email/điện thoại. `curl` `/api/teams/<id>` khi chưa đăng nhập phải trả 403.

- [ ] **Step 7: Commit**

```bash
git add src/lib/services/teams.ts src/app/api/teams src/app/\(judge\)/judge src/components/Shell.tsx
git commit -m "feat(judge): xem chi tiet doi va thanh vien"
```

---

### Task 15: BGK xem điểm của giám khảo khác

**Files:**
- Modify: `src/lib/services/scores.ts`
- Create: `src/app/api/scores/matrix/route.ts`
- Create: `src/app/(judge)/judge/scores/page.tsx`
- Modify: `src/components/Shell.tsx` (nav + breadcrumb)
- Test: `tests/services.scores.test.ts`

**Interfaces:**
- Consumes: `judgeTotal` (Task 1), `requireRole` (Task 8)
- Produces:
  - `type MatrixCell = { judgeId: string; total: number | null; status: 'submitted' | 'draft' | 'none' }`
  - `type MatrixRow = { teamId: string; teamName: string; teamCode: string; cells: MatrixCell[]; total: number | null }`
  - `scoreMatrix(viewerId: string): Promise<{ judges: { id: string; name: string; isHead: boolean; isMe: boolean }[]; rows: MatrixRow[] }>`
  - `GET /api/scores/matrix` (judge + admin + superadmin)

- [ ] **Step 1: Viết test thất bại**

Thêm vào `tests/services.scores.test.ts`:

```ts
import { scoreMatrix } from '@/lib/services/scores';

describe('scoreMatrix', () => {
  it('tra ve day du doi x giam khao, danh dau nguoi dang xem', async () => {
    const judges = await prisma.user.findMany({ where: { role: 'judge' }, orderBy: { createdAt: 'asc' } });
    const teams = await prisma.team.findMany();
    const m = await scoreMatrix(judges[0].id);

    expect(m.judges).toHaveLength(judges.length);
    expect(m.judges[0].isMe).toBe(true);
    expect(m.judges[1].isMe).toBe(false);
    expect(m.rows).toHaveLength(teams.length);
    // mỗi hàng có đúng một ô cho mỗi giám khảo, theo đúng thứ tự cột
    expect(m.rows[0].cells.map((c) => c.judgeId)).toEqual(m.judges.map((j) => j.id));
  });

  it('o chua cham co status none va total null', async () => {
    const judges = await prisma.user.findMany({ where: { role: 'judge' }, orderBy: { createdAt: 'asc' } });
    const team = await prisma.team.create({ data: { name: 'Doi khong diem', code: 'ZZ' } });
    const m = await scoreMatrix(judges[0].id);
    const row = m.rows.find((r) => r.teamId === team.id)!;
    expect(row.total).toBeNull();
    expect(row.cells.every((c) => c.status === 'none' && c.total === null)).toBe(true);
    await prisma.team.delete({ where: { id: team.id } });
  });
});
```

- [ ] **Step 2: Chạy test để chắc chắn nó fail**

Run: `npx vitest run tests/services.scores.test.ts`
Expected: FAIL — `scoreMatrix` chưa tồn tại.

- [ ] **Step 3: Thêm `scoreMatrix` vào `src/lib/services/scores.ts`**

```ts
export type MatrixCell = { judgeId: string; total: number | null; status: JudgeScoreStatus };
export type MatrixRow = {
  teamId: string; teamName: string; teamCode: string;
  cells: MatrixCell[]; total: number | null;
};

/**
 * Bảng đội x giám khảo, TÊN THẬT. Đây là view sau đăng nhập của ban giám khảo và
 * ban tổ chức — việc ẩn tên chỉ áp dụng cho board công khai (xem judge-label.ts).
 * Sắp theo createdAt của đội, không theo hạng: đây là bảng đối chiếu phiếu chấm,
 * không phải bảng xếp hạng.
 */
export async function scoreMatrix(viewerId: string) {
  const [judges, teams, scores] = await Promise.all([
    prisma.user.findMany({
      where: { role: 'judge' }, orderBy: { createdAt: 'asc' },
      select: { id: true, name: true, isHead: true },
    }),
    prisma.team.findMany({ orderBy: { createdAt: 'asc' }, select: { id: true, name: true, code: true } }),
    prisma.score.findMany({ select: { judgeId: true, teamId: true, value: true, submitted: true } }),
  ]);

  const rows: MatrixRow[] = teams.map((team) => {
    const cells: MatrixCell[] = judges.map((j) => {
      const mine = scores.filter((s) => s.teamId === team.id && s.judgeId === j.id);
      if (mine.length === 0) return { judgeId: j.id, total: null, status: 'none' };
      const total = Math.round(mine.reduce((a, s) => a + s.value, 0) * 10) / 10;
      return { judgeId: j.id, total, status: mine.every((s) => s.submitted) ? 'submitted' : 'draft' };
    });
    const scored = cells.filter((c) => c.total !== null).map((c) => c.total!);
    return {
      teamId: team.id, teamName: team.name, teamCode: team.code, cells,
      total: scored.length ? Math.round(scored.reduce((a, b) => a + b, 0) * 10) / 10 : null,
    };
  });

  return {
    judges: judges.map((j) => ({ ...j, isMe: j.id === viewerId })),
    rows,
  };
}
```

- [ ] **Step 4: Chạy test**

Run: `npx vitest run tests/services.scores.test.ts`
Expected: PASS.

- [ ] **Step 5: `src/app/api/scores/matrix/route.ts`**

```ts
import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { scoreMatrix } from '@/lib/services/scores';

export async function GET() {
  const u = await requireRole('judge', 'admin', 'superadmin');
  if (!u) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  return NextResponse.json(await scoreMatrix(u.id));
}

export const dynamic = 'force-dynamic';
```

- [ ] **Step 6: Trang `/judge/scores`**

```tsx
'use client';
import { useEffect, useState } from 'react';
import { fetcher } from '@/lib/ui';

export default function JudgeScores() {
  const [d, setD] = useState<any>(null);
  useEffect(() => {
    const load = () => fetcher('/api/scores/matrix').then(setD);
    load();
    const es = new EventSource('/api/stream');
    es.addEventListener('update', load);
    return () => es.close();
  }, []);
  if (!d) return <div>Đang tải…</div>;

  return (
    <>
      <div className="page-head">
        <div className="page-title">Điểm ban giám khảo</div>
        <small style={{ color: 'var(--muted-2)' }}>Tổng điểm mỗi giám khảo chấm cho từng đội. Ô mờ là phiếu nháp.</small>
      </div>
      <div className="card"><div className="matrix" style={{ overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th>Đội</th>
              {d.judges.map((j: any) => (
                <th key={j.id} style={{ textAlign: 'center', color: j.isMe ? 'var(--orange-lt)' : undefined }}>
                  {j.name}{j.isHead ? ' (Trưởng BGK)' : ''}{j.isMe ? ' · bạn' : ''}
                </th>
              ))}
              <th style={{ textAlign: 'right' }}>Tổng đội</th>
            </tr>
          </thead>
          <tbody>
            {d.rows.map((r: any) => (
              <tr key={r.teamId}>
                <td><b>{r.teamName}</b> <span className="code-chip">{r.teamCode}</span></td>
                {r.cells.map((c: any) => (
                  <td key={c.judgeId} className="tnum"
                    style={{ textAlign: 'center', opacity: c.status === 'draft' ? .5 : 1 }}
                    title={c.status === 'draft' ? 'Phiếu nháp, chưa nộp' : c.status === 'none' ? 'Chưa chấm' : 'Đã nộp'}>
                    {c.total === null ? '—' : c.total.toFixed(1)}
                  </td>
                ))}
                <td className="tnum" style={{ textAlign: 'right' }}>
                  <b>{r.total === null ? '—' : r.total.toFixed(1)}</b>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div></div>
    </>
  );
}
```

`JUDGE_NAV` trong `Shell.tsx` thêm `{ href: '/judge/scores', label: 'Điểm ban giám khảo' }`,
và `LABEL` thêm `'/judge/scores': 'Điểm ban giám khảo'`.

- [ ] **Step 7: Kiểm tra**

Run: `npx tsc --noEmit && npm test`
Thử tay: đăng nhập BGK → `/judge/scores` thấy đủ cột, cột của mình được nhấn màu.

- [ ] **Step 8: Commit**

```bash
git add src/lib/services/scores.ts src/app/api/scores/matrix src/app/\(judge\)/judge/scores src/components/Shell.tsx tests/services.scores.test.ts
git commit -m "feat(judge): bang doi x giam khao, xem duoc diem cua BGK khac"
```

---

### Task 16: Khoá phiếu chấm ở tầng service và API

**Files:**
- Modify: `src/lib/services/scores.ts`
- Modify: `src/app/api/scores/route.ts`, `src/app/api/scores/status/route.ts`
- Create: `src/app/api/judges/[id]/unlock/route.ts`
- Test: `tests/services.scores.test.ts`

**Interfaces:**
- Consumes: `validateScoreValues`, `upsertScores` (đã có); `requireRole` (Task 8); `audit` (Task 9)
- Produces:
  - `isCardLocked(judgeId: string, teamId: string): Promise<boolean>`
  - `type SaveResult = { ok: true } | { ok: false; error: 'locked' }`
  - `saveScoreCard(judgeId: string, teamId: string, values: { criterionId: string; value: number }[], submitted: boolean): Promise<SaveResult>`
  - `unlockCard(judgeId: string, teamId: string): Promise<number>` — số dòng được mở khoá
  - `judgeSubmittedTeamIds(judgeId)` giữ nguyên
  - `POST /api/judges/[id]/unlock` body `{ teamId }`

- [ ] **Step 1: Viết test thất bại**

Thêm vào `tests/services.scores.test.ts`:

```ts
import { isCardLocked, saveScoreCard, unlockCard } from '@/lib/services/scores';

describe('khoa phieu cham', () => {
  it('nop xong la khoa, luu tiep bi tu choi', async () => {
    const judge = (await prisma.user.findFirst({ where: { role: 'judge' } }))!;
    const team = await prisma.team.create({ data: { name: 'Doi khoa', code: 'LK' } });
    const crit = (await prisma.criterion.findFirst())!;

    expect(await isCardLocked(judge.id, team.id)).toBe(false);
    expect(await saveScoreCard(judge.id, team.id, [{ criterionId: crit.id, value: 5 }], false)).toEqual({ ok: true });
    expect(await isCardLocked(judge.id, team.id)).toBe(false);   // nháp chưa khoá

    expect(await saveScoreCard(judge.id, team.id, [{ criterionId: crit.id, value: 7 }], true)).toEqual({ ok: true });
    expect(await isCardLocked(judge.id, team.id)).toBe(true);

    expect(await saveScoreCard(judge.id, team.id, [{ criterionId: crit.id, value: 9 }], true))
      .toEqual({ ok: false, error: 'locked' });
    const after = await prisma.score.findFirst({ where: { judgeId: judge.id, teamId: team.id, criterionId: crit.id } });
    expect(after?.value).toBe(7);   // giá trị cũ không bị ghi đè

    await prisma.team.delete({ where: { id: team.id } });
  });

  it('mo khoa giu nguyen diem, cho sua lai', async () => {
    const judge = (await prisma.user.findFirst({ where: { role: 'judge' } }))!;
    const team = await prisma.team.create({ data: { name: 'Doi mo khoa', code: 'UK' } });
    const crit = (await prisma.criterion.findFirst())!;

    await saveScoreCard(judge.id, team.id, [{ criterionId: crit.id, value: 6 }], true);
    expect(await unlockCard(judge.id, team.id)).toBeGreaterThan(0);
    expect(await isCardLocked(judge.id, team.id)).toBe(false);

    const kept = await prisma.score.findFirst({ where: { judgeId: judge.id, teamId: team.id, criterionId: crit.id } });
    expect(kept?.value).toBe(6);   // mở khoá KHÔNG xoá điểm

    expect(await saveScoreCard(judge.id, team.id, [{ criterionId: crit.id, value: 8 }], true)).toEqual({ ok: true });
    await prisma.team.delete({ where: { id: team.id } });
  });
});
```

- [ ] **Step 2: Chạy test để chắc chắn nó fail**

Run: `npx vitest run tests/services.scores.test.ts`
Expected: FAIL — `isCardLocked` chưa tồn tại.

- [ ] **Step 3: Thêm vào `src/lib/services/scores.ts`**

```ts
export type SaveResult = { ok: true } | { ok: false; error: 'locked' };

/** Một phiếu bị khoá khi giám khảo đã bấm Nộp cho đội đó. */
export async function isCardLocked(judgeId: string, teamId: string): Promise<boolean> {
  const n = await prisma.score.count({ where: { judgeId, teamId, submitted: true } });
  return n > 0;
}

/**
 * Chốt khoá nằm ở đây chứ không chỉ ở giao diện: giao diện có disable nút mà API
 * vẫn nhận ghi thì phiếu không hề bị khoá.
 */
export async function saveScoreCard(
  judgeId: string, teamId: string,
  values: { criterionId: string; value: number }[], submitted: boolean,
): Promise<SaveResult> {
  if (await isCardLocked(judgeId, teamId)) return { ok: false, error: 'locked' };
  await upsertScores(judgeId, teamId, values, submitted);
  return { ok: true };
}

/** Mở khoá GIỮ NGUYÊN điểm đã nhập — chỉ bỏ cờ submitted để giám khảo sửa lại. */
export async function unlockCard(judgeId: string, teamId: string): Promise<number> {
  const r = await prisma.score.updateMany({
    where: { judgeId, teamId, submitted: true }, data: { submitted: false },
  });
  return r.count;
}
```

- [ ] **Step 4: Chạy test**

Run: `npx vitest run tests/services.scores.test.ts`
Expected: PASS.

- [ ] **Step 5: `src/app/api/scores/route.ts`**

```ts
export async function GET(req: Request) {
  const u = await requireRole('judge');
  if (!u) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const teamId = new URL(req.url).searchParams.get('teamId');
  if (!teamId) return NextResponse.json({ error: 'teamId required' }, { status: 400 });
  return NextResponse.json({
    scores: await getJudgeScores(u.id, teamId),
    locked: await isCardLocked(u.id, teamId),
  });
}

export async function POST(req: Request) {
  const u = await requireRole('judge');
  if (!u) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const { teamId, values, submitted } = await req.json();
  if (typeof teamId !== 'string' || !teamId || !Array.isArray(values)) {
    return NextResponse.json({ error: 'teamId and values required' }, { status: 400 });
  }
  const criteria = await prisma.criterion.findMany({ select: { id: true, maxScore: true } });
  const maxById: Record<string, number> = Object.fromEntries(criteria.map((c) => [c.id, c.maxScore]));
  const validationError = validateScoreValues(values, maxById);
  if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });

  const r = await saveScoreCard(u.id, teamId, values, !!submitted);
  if (!r.ok) {
    return NextResponse.json(
      { error: 'Phiếu chấm đội này đã nộp và bị khoá. Liên hệ ban tổ chức nếu cần sửa.' },
      { status: 409 },
    );
  }

  const team = await prisma.team.findUnique({ where: { id: teamId }, select: { name: true } });
  const total = values.reduce((a: number, v: any) => a + v.value, 0);
  await audit(u, submitted ? 'score.submit' : 'score.save', {
    entity: 'score', entityId: `${u.id}:${teamId}`, target: team?.name ?? teamId,
    detail: `tong ${Math.round(total * 10) / 10}`,
  });
  broadcast('update', { reason: 'score', teamId });
  return NextResponse.json({ ok: true });
}
```

**GET đổi shape trả về** (`{ scores, locked }` thay vì mảng thuần) — trang chấm
điểm ở Task 17 phải sửa theo, không có nơi nào khác gọi endpoint này.

- [ ] **Step 6: `src/app/api/judges/[id]/unlock/route.ts`**

```ts
import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { audit } from '@/lib/audit';
import { prisma } from '@/lib/db';
import { unlockCard } from '@/lib/services/scores';
import { broadcast } from '@/lib/events';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const u = await requireRole('admin', 'superadmin');
  if (!u) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const { teamId } = await req.json();
  if (typeof teamId !== 'string' || !teamId) return NextResponse.json({ error: 'teamId required' }, { status: 400 });

  const count = await unlockCard(params.id, teamId);
  const [judge, team] = await Promise.all([
    prisma.user.findUnique({ where: { id: params.id }, select: { name: true } }),
    prisma.team.findUnique({ where: { id: teamId }, select: { name: true } }),
  ]);
  await audit(u, 'score.unlock', {
    entity: 'score', entityId: `${params.id}:${teamId}`,
    target: `${judge?.name ?? params.id} / ${team?.name ?? teamId}`,
    detail: `${count} dong`,
  });
  broadcast('update', { reason: 'unlock', teamId });
  return NextResponse.json({ ok: true, count });
}
```

- [ ] **Step 7: Kiểm tra**

Run: `npx tsc --noEmit && npm test`
Expected: sạch.

- [ ] **Step 8: Commit**

```bash
git add src/lib/services/scores.ts src/app/api/scores src/app/api/judges tests/services.scores.test.ts
git commit -m "feat(scores): khoa phieu sau khi nop, admin mo khoa duoc"
```

---

### Task 17: Trang chấm điểm — cảnh báo trước khi nộp, read-only sau khi nộp, chặn quá max

**Files:**
- Modify: `src/app/(judge)/judge/score/[teamId]/page.tsx`

**Interfaces:**
- Consumes: `GET /api/scores?teamId=` trả `{ scores, locked }`, `POST /api/scores` trả 409 khi khoá (Task 16)
- Produces: — (trang UI)

- [ ] **Step 1: Viết lại trang**

```tsx
'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { fetcher } from '@/lib/ui';
import { useConfirm } from '@/components/ConfirmProvider';

type Crit = { id: string; name: string; description?: string | null; maxScore: number };

export default function Score({ params }: { params: { teamId: string } }) {
  const [crits, setCrits] = useState<Crit[]>([]);
  const [vals, setVals] = useState<Record<string, number>>({});
  const [over, setOver] = useState<Record<string, boolean>>({});
  const [team, setTeam] = useState<any>(null);
  const [locked, setLocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const router = useRouter();
  const confirm = useConfirm();

  useEffect(() => { (async () => {
    const [c, teams, mine] = await Promise.all([
      fetcher<Crit[]>('/api/criteria'),
      fetcher<any[]>('/api/teams'),
      fetcher<{ scores: any[]; locked: boolean }>('/api/scores?teamId=' + params.teamId),
    ]);
    setCrits(c);
    setTeam(teams.find((t) => t.id === params.teamId));
    setLocked(mine.locked);
    const map: Record<string, number> = {};
    mine.scores.forEach((s) => { map[s.criterionId] = s.value; });
    setVals(map);
  })(); }, [params.teamId]);

  const total = crits.reduce((a, c) => a + (vals[c.id] || 0), 0);
  const maxTotal = crits.reduce((a, c) => a + c.maxScore, 0);
  const hasOver = Object.values(over).some(Boolean);

  /** Kẹp ngay lúc nhập và BÁO cho giám khảo biết. Trước đây giá trị vượt trần bị
   *  Math.min hạ xuống âm thầm lúc lưu — người chấm không hề biết điểm đã đổi. */
  function setVal(c: Crit, raw: string) {
    const n = Number(raw);
    if (raw === '' || Number.isNaN(n)) {
      setVals({ ...vals, [c.id]: 0 });
      setOver({ ...over, [c.id]: false });
      return;
    }
    const clamped = Math.min(c.maxScore, Math.max(0, n));
    setVals({ ...vals, [c.id]: clamped });
    setOver({ ...over, [c.id]: n > c.maxScore || n < 0 });
  }

  async function save(submitted: boolean) {
    if (hasOver) return;
    if (submitted && !(await confirm({
      title: 'Nộp điểm · ' + team.name,
      message: `Sau khi nộp, bạn KHÔNG thể sửa điểm đội này nữa — chỉ ban tổ chức mới mở khoá được. `
             + `Tổng điểm bạn chấm: ${total.toFixed(1)}/${maxTotal}. Xác nhận nộp?`,
      confirmText: 'Nộp điểm',
    }))) return;

    setBusy(true); setErr('');
    try {
      const values = crits.map((c) => ({ criterionId: c.id, value: vals[c.id] || 0 }));
      await fetcher('/api/scores', { method: 'POST', body: JSON.stringify({ teamId: params.teamId, values, submitted }) });
      if (submitted) router.push('/judge');
    } catch (e: any) { setErr(e.message); setLocked(true); }
    finally { setBusy(false); }
  }

  if (!team) return <div>Đang tải…</div>;

  return (
    <>
      <div className="page-head">
        <div className="page-title">Chấm điểm · {team.name}</div>
        <Link className="btn btn-sm" href={'/judge/team/' + team.id}>Xem thông tin đội</Link>
      </div>

      {locked && (
        <div className="note" style={{ marginBottom: 16, maxWidth: 720 }}>
          <span style={{ color: 'var(--green)' }}>✓</span>
          <div><b style={{ color: 'var(--text)' }}>Phiếu đã nộp — không thể sửa.</b>{' '}
            Nếu cần chấm lại, đề nghị ban tổ chức mở khoá phiếu này.</div>
        </div>
      )}
      {err && <div className="note" style={{ marginBottom: 16, maxWidth: 720, color: 'var(--red, #c0392b)' }}>{err}</div>}

      <div className="card card-pad" style={{ maxWidth: 720 }}>
        {crits.map((c) => (
          <div className="crit" key={c.id}>
            <div>
              <div className="crit-name">{c.name} <span className="crit-max">/ {c.maxScore}đ</span></div>
              <div className="crit-desc">{c.description}</div>
            </div>
            <div className="score-in">
              <input className="input" style={{ width: 80, borderColor: over[c.id] ? 'var(--red, #c0392b)' : undefined }}
                type="number" step="0.5" min={0} max={c.maxScore} disabled={locked}
                value={vals[c.id] ?? ''} onChange={(e) => setVal(c, e.target.value)} />
              <span>/ {c.maxScore}</span>
              {over[c.id] && <small style={{ color: 'var(--red, #c0392b)', display: 'block' }}>Tối đa {c.maxScore}đ</small>}
            </div>
          </div>
        ))}

        <div className="total-box">
          <span className="tl">TỔNG ĐIỂM CỦA BẠN</span>
          <span className="tv tnum">{total.toFixed(1)}<small>/{maxTotal}</small></span>
        </div>

        {!locked && (
          <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
            <button className="btn" style={{ flex: 1, justifyContent: 'center' }}
              disabled={busy || hasOver} onClick={() => save(false)}>Lưu nháp</button>
            <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }}
              disabled={busy || hasOver} onClick={() => save(true)}>Nộp điểm đội này</button>
          </div>
        )}
      </div>
    </>
  );
}
```

- [ ] **Step 2: Kiểm tra**

Run: `npx tsc --noEmit`

- [ ] **Step 3: Thử tay**

`npm run dev`, đăng nhập BGK:
- Gõ `99` vào ô có max 10 → ô về `10`, viền đỏ, dòng `Tối đa 10đ`, hai nút bị chặn.
- `Lưu nháp` → quay lại vẫn sửa được.
- `Nộp điểm` → hiện hộp xác nhận có đúng câu "KHÔNG thể sửa" và tổng điểm.
- Sau khi nộp, mở lại phiếu → mọi ô `disabled`, hai nút biến mất, có banner đã nộp.
- Gọi thẳng API để chắc chắn khoá thật:

```bash
curl -s -X POST localhost:3000/api/scores -H 'Content-Type: application/json' \
  -b 'hs_session=<cookie BGK>' \
  -d '{"teamId":"<id>","values":[{"criterionId":"<id>","value":10}],"submitted":true}'
```

Expected: HTTP 409 kèm câu lỗi tiếng Việt.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(judge\)/judge/score
git commit -m "feat(judge): canh bao truoc khi nop, khoa phieu sau khi nop, chan diem qua barem"
```

---

### Task 18: Admin mở khoá phiếu + badge trạng thái ở danh sách đội

**Files:**
- Modify: `src/app/(admin)/admin/judges/page.tsx`
- Modify: `src/app/(judge)/judge/page.tsx`

**Interfaces:**
- Consumes: `POST /api/judges/[id]/unlock` (Task 16), `GET /api/judges/[id]/scores` (đã có)
- Produces: — (UI)

- [ ] **Step 1: Nút mở khoá trong modal *Phiếu chấm***

Trong `/admin/judges`, bảng chi tiết thêm một cột thao tác; dòng có
`status === 'submitted'` mới có nút:

```tsx
async function unlock(teamId: string, teamName: string) {
  if (!detailOf) return;
  if (!(await confirm({
    title: 'Mở khoá phiếu chấm',
    message: `Mở khoá phiếu của "${detailOf.name}" cho đội "${teamName}". Điểm đã nhập được giữ nguyên, `
           + `giám khảo sẽ sửa và nộp lại được. Thao tác này được ghi vào nhật ký.`,
    confirmText: 'Mở khoá', danger: true,
  }))) return;
  await fetcher('/api/judges/' + detailOf.id + '/unlock', {
    method: 'POST', body: JSON.stringify({ teamId }),
  });
  setDetail(await fetcher('/api/judges/' + detailOf.id + '/scores'));
}
```

```tsx
<td style={{ textAlign: 'right' }}>
  {r.status === 'submitted'
    ? <button className="btn btn-sm" onClick={() => unlock(r.teamId, r.teamName)}>Mở khoá</button>
    : <span style={{ color: 'var(--muted-2)' }}>—</span>}
</td>
```

Nhớ tăng `colSpan` của dòng "Chưa có đội nào" lên `detail.criteria.length + 4`.

- [ ] **Step 2: Badge ở `/judge`**

Pill trạng thái đổi nhãn: `done ? 'Đã nộp · đã khoá' : 'Chưa chấm'`, và nút bên
dưới đổi chữ theo Task 14 (`Xem phiếu` khi đã nộp).

- [ ] **Step 3: Kiểm tra + thử tay**

Run: `npx tsc --noEmit && npm run build`

Thử tay: admin mở `/admin/judges` → `Xem điểm` một BGK → dòng `Đã nộp` có nút
`Mở khoá` → xác nhận → trạng thái đổi thành `Nháp`, điểm vẫn còn. BGK đăng nhập
lại thì sửa và nộp lại được. `/admin/audit` có dòng `Mở khoá phiếu chấm`.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(admin\)/admin/judges/page.tsx src/app/\(judge\)/judge/page.tsx
git commit -m "feat(admin): mo khoa phieu cham tu man hinh giam khao"
```

---

## Kiểm tra tổng thể trước khi bàn giao

- [ ] `npm test` — toàn bộ test xanh
- [ ] `npx tsc --noEmit` — không lỗi type
- [ ] `npm run build` — build sạch
- [ ] `grep -rn "revealState\|countedJudges\|isFinal" src/` — không còn dấu vết cơ chế cũ
- [ ] `grep -rn "role !== 'admin'" src/` — không còn gate cũ
- [ ] Diễn tập một lượt: reset công bố → công bố lần lượt vài đội (kiểm spotlight)
      → công bố điểm BGK (kiểm nhãn ẩn tên) → mở `/admin/audit` xem đủ vết
- [ ] `curl -s localhost:3000/api/results` khi chưa công bố đội nào — `rows` rỗng,
      không có tên giám khảo nào trong payload
- [ ] Đăng nhập bằng tài khoản `admin` khách hàng — không thấy 2 mục superadmin,
      gõ thẳng `/admin/audit` không lấy được dữ liệu
- [ ] Cập nhật `docs/DEPLOY.md`: `npm run prisma:migrate` rồi `npm run accounts`
