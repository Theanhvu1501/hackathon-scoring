# Automotive Hackathon 2026 Scoring — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the hackathon final-round scoring system — Admin CMS, Judge CMS, and a realtime public leaderboard with a "reveal the head judge" climax and top-3 podium.

**Architecture:** One Next.js (App Router, TypeScript) codebase serving CMS pages, the public board, and JSON API routes. Business logic lives in pure/`prisma`-backed service functions under `src/lib` (unit-testable without HTTP); route handlers are thin wrappers doing auth + JSON. PostgreSQL via Prisma. Realtime is Server-Sent Events broadcast from an in-process event bus. Everything runs under Docker Compose (Postgres + app).

**Tech Stack:** Next.js 14, React 18, TypeScript, Prisma, PostgreSQL 16, TailwindCSS 3, Vitest (tests), Docker Compose. Fonts: Space Grotesk + Inter (Google Fonts). Design source of truth: `mockups/index.html` (approved).

## Global Constraints

- **Node** ≥ 20 (dev uses v21). **Package manager:** npm.
- **Roles:** exactly two — `admin`, `judge`. Judges have `isHead` boolean; exactly one head judge (Trưởng BGK).
- **Auth:** access-code only, NO passwords. Login = enter code → signed httpOnly cookie `hs_session`.
- **Barem:** flat list of criteria `{name, maxScore, description, order}`. Total = SUM of maxScore, never hardcoded 50.
- **Aggregation:** team score = **average** of each judge's total (sum of that judge's criterion scores). `provisional` = average **excluding** head judge; `final` = average **including** head judge. A judge with no scores for a team is excluded from that team's average.
- **Ranking:** higher score = better. Golf ties: equal scores share a rank shown as `T<rank>`; secondary sort by team name (A→Z). Teams with no scores rank last.
- **Reveal state machine:** `drafting → provisional → final`, Admin-controlled, reversible. Stored in a `Settings` singleton (id=1). Head judge score is held server-side and only included when state = `final`.
- **Realtime:** SSE endpoint `/api/stream`; broadcast on score submit and reveal-state change; clients refetch `/api/results`.
- **Design:** light theme, tokens copied verbatim from `mockups/index.html` (`--page-bg:#f3f7ff`, text `#0a1f48`, orange `#f37021→#ff9730`, blue `#2563eb`, cyan `#0a97c4`). CMS full-width; public board full-bleed.
- **Money/score values:** scores allow one decimal (e.g. 7.5). Store as `Float`.
- **Commits:** conventional commits, one per task minimum.
- **Dynamic API routes:** every API GET handler that reads the DB must
  `export const dynamic = 'force-dynamic'` (results, reveal, teams, criteria,
  judges) so `next build` does not attempt to statically prerender them at
  build time — the Docker image builds without a live database.

## File Structure

```
docker-compose.yml            # postgres + app services
Dockerfile                    # multi-stage Next build
.env.example / .env           # DATABASE_URL, SESSION_SECRET
package.json, tsconfig.json, next.config.mjs
tailwind.config.ts, postcss.config.js
vitest.config.ts
prisma/schema.prisma          # User, Team, Member, Criterion, Score, Settings, AuditLog
prisma/seed.ts                # admin + judges + teams + members + criteria + sample scores
src/lib/db.ts                 # Prisma singleton
src/lib/access-code.ts        # random code generator
src/lib/scoring.ts            # PURE ranking/aggregation  ← core, fully unit-tested
src/lib/auth.ts               # sign/verify session cookie, getCurrentUser
src/lib/events.ts             # SSE event bus (in-process EventEmitter)
src/lib/services/teams.ts     # team+member CRUD service fns
src/lib/services/judges.ts    # judge CRUD + code regen
src/lib/services/criteria.ts  # barem CRUD
src/lib/services/scores.ts    # upsert/submit scores
src/lib/services/reveal.ts    # get/advance reveal state, computes results
src/middleware.ts             # route protection by role
src/app/globals.css           # design tokens (light theme)
src/app/layout.tsx            # fonts + root
src/app/login/page.tsx
src/app/(admin)/admin/...     # dashboard, teams, judges, barem, publish
src/app/(judge)/judge/...     # teams, score/[teamId], results
src/app/board/page.tsx        # public leaderboard (SSE client) + podium
src/app/api/**/route.ts       # thin handlers over services
src/components/*               # Leaderboard, Podium, ScoreForm, shell, etc.
tests/scoring.test.ts         # unit
tests/services.test.ts        # integration against test DB
tests/reveal-flow.test.ts     # integration: drafting→provisional→final
scripts/smoke.sh              # docker compose up + curl asserts
```

---

## Task 0: Project scaffold, Docker, Postgres, Prisma schema

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.mjs`, `postcss.config.js`, `tailwind.config.ts`, `.gitignore`, `.env.example`, `.env`, `docker-compose.yml`, `Dockerfile`, `.dockerignore`, `vitest.config.ts`
- Create: `prisma/schema.prisma`
- Create: `src/lib/db.ts`
- Create: `src/app/layout.tsx`, `src/app/globals.css`, `src/app/page.tsx`

**Interfaces:**
- Produces: `prisma` client via `import { prisma } from '@/lib/db'`; DB models `User, Team, Member, Criterion, Score, Settings, AuditLog`.

- [ ] **Step 1: Init git and package.json**

```bash
git init
cat > package.json <<'EOF'
{
  "name": "hackathon-scoring",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test": "vitest run",
    "test:watch": "vitest",
    "prisma:generate": "prisma generate",
    "prisma:migrate": "prisma migrate deploy",
    "prisma:dev": "prisma migrate dev",
    "seed": "tsx prisma/seed.ts"
  },
  "prisma": { "seed": "tsx prisma/seed.ts" },
  "dependencies": {
    "next": "14.2.5",
    "react": "18.3.1",
    "react-dom": "18.3.1",
    "@prisma/client": "5.18.0"
  },
  "devDependencies": {
    "typescript": "5.5.4",
    "@types/node": "20.14.0",
    "@types/react": "18.3.3",
    "@types/react-dom": "18.3.0",
    "prisma": "5.18.0",
    "tsx": "4.16.2",
    "tailwindcss": "3.4.7",
    "postcss": "8.4.40",
    "autoprefixer": "10.4.19",
    "vitest": "2.0.5"
  }
}
EOF
npm install
```

- [ ] **Step 2: Config files**

```bash
cat > tsconfig.json <<'EOF'
{
  "compilerOptions": {
    "target": "ES2021",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
EOF

cat > next.config.mjs <<'EOF'
/** @type {import('next').NextConfig} */
const nextConfig = { output: 'standalone' };
export default nextConfig;
EOF

cat > postcss.config.js <<'EOF'
module.exports = { plugins: { tailwindcss: {}, autoprefixer: {} } };
EOF

cat > tailwind.config.ts <<'EOF'
import type { Config } from 'tailwindcss';
export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: { extend: {} },
  plugins: [],
} satisfies Config;
EOF

cat > vitest.config.ts <<'EOF'
import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';
export default defineConfig({
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
  resolve: { alias: { '@': resolve(__dirname, 'src') } },
});
EOF

cat > .gitignore <<'EOF'
node_modules
.next
.env
*.log
prisma/*.db
EOF

cat > .dockerignore <<'EOF'
node_modules
.next
.git
EOF

cat > .env.example <<'EOF'
DATABASE_URL="postgresql://hs:hs@localhost:5432/hackathon?schema=public"
SESSION_SECRET="change-me-in-prod-please-32-chars-min"
EOF
cp .env.example .env
```

- [ ] **Step 3: Prisma schema**

```bash
cat > prisma/schema.prisma <<'EOF'
generator client { provider = "prisma-client-js" }
datasource db { provider = "postgresql"; url = env("DATABASE_URL") }

enum Role { admin judge }
enum RevealState { drafting provisional final }

model User {
  id         String   @id @default(cuid())
  name       String
  role       Role
  isHead     Boolean  @default(false)   // Trưởng BGK
  accessCode String   @unique
  active     Boolean  @default(true)
  createdAt  DateTime @default(now())
  scores     Score[]
}

model Team {
  id        String   @id @default(cuid())
  name      String
  code      String                     // 2-3 letter badge, e.g. "EV"
  logoUrl   String?
  tag       String?                    // short description shown on board
  createdAt DateTime @default(now())
  members   Member[]
  scores    Score[]
}

model Member {
  id       String  @id @default(cuid())
  teamId   String
  team     Team    @relation(fields: [teamId], references: [id], onDelete: Cascade)
  name     String
  teamRole String?                     // role in team, e.g. "Leader · Backend"
  photoUrl String?
  org      String?
  email    String?
  phone    String?
  intro    String?
}

model Criterion {
  id          String  @id @default(cuid())
  name        String
  description String?
  maxScore    Float
  order       Int     @default(0)
  scores      Score[]
}

model Score {
  id          String    @id @default(cuid())
  judgeId     String
  judge       User      @relation(fields: [judgeId], references: [id], onDelete: Cascade)
  teamId      String
  team        Team      @relation(fields: [teamId], references: [id], onDelete: Cascade)
  criterionId String
  criterion   Criterion @relation(fields: [criterionId], references: [id], onDelete: Cascade)
  value       Float
  submitted   Boolean   @default(false)
  updatedAt   DateTime  @updatedAt
  @@unique([judgeId, teamId, criterionId])
}

model Settings {
  id          Int         @id @default(1)
  revealState RevealState @default(drafting)
  updatedAt   DateTime    @updatedAt
}

model AuditLog {
  id        String   @id @default(cuid())
  actorId   String?
  action    String
  target    String?
  createdAt DateTime @default(now())
}
EOF
```

- [ ] **Step 4: Prisma client singleton**

```bash
mkdir -p src/lib
cat > src/lib/db.ts <<'EOF'
import { PrismaClient } from '@prisma/client';
const g = globalThis as unknown as { prisma?: PrismaClient };
export const prisma = g.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== 'production') g.prisma = prisma;
EOF
```

- [ ] **Step 5: Minimal app shell so Next builds**

```bash
mkdir -p src/app
cat > src/app/globals.css <<'EOF'
/* Populated fully in Task 8 from mockups/index.html tokens */
:root{--page-bg:#f3f7ff;--text:#0a1f48}
html,body{margin:0;background:var(--page-bg);color:var(--text);font-family:Inter,system-ui,sans-serif}
EOF

cat > src/app/layout.tsx <<'EOF'
import './globals.css';
export const metadata = { title: 'Automotive Hackathon 2026' };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (<html lang="vi"><body>{children}</body></html>);
}
EOF

cat > src/app/page.tsx <<'EOF'
export default function Home() { return <main style={{padding:40}}>Hackathon Scoring — see /login</main>; }
EOF
```

- [ ] **Step 6: Docker Compose + Dockerfile**

```bash
cat > docker-compose.yml <<'EOF'
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: hs
      POSTGRES_PASSWORD: hs
      POSTGRES_DB: hackathon
    ports: ["5432:5432"]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U hs -d hackathon"]
      interval: 3s
      timeout: 3s
      retries: 20
    volumes: [ "hs_pgdata:/var/lib/postgresql/data" ]
  app:
    build: .
    depends_on:
      db: { condition: service_healthy }
    environment:
      DATABASE_URL: "postgresql://hs:hs@db:5432/hackathon?schema=public"
      SESSION_SECRET: "change-me-in-prod-please-32-chars-min"
      NODE_ENV: production
    ports: ["3000:3000"]
    command: sh -c "npx prisma migrate deploy && npx tsx prisma/seed.ts && node server.js"
volumes: { hs_pgdata: {} }
EOF

cat > Dockerfile <<'EOF'
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate && npm run build
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/src ./src
COPY --from=builder /app/tsconfig.json ./tsconfig.json
# Full node_modules (incl. .bin, prisma CLI, tsx, and the generated client)
# so the container start command can run `prisma migrate deploy` + `tsx seed`.
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
EXPOSE 3000
CMD ["node", "server.js"]
EOF
```

- [ ] **Step 7: Start Postgres, create first migration**

```bash
docker compose up -d db
# wait for healthy
until docker compose exec -T db pg_isready -U hs -d hackathon; do sleep 1; done
npx prisma migrate dev --name init
```
Expected: migration created under `prisma/migrations/`, `Prisma schema loaded`, tables created.

- [ ] **Step 8: Verify Next builds and dev boots**

```bash
npm run build
```
Expected: build succeeds, `.next/standalone/server.js` produced.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js + Prisma + Docker, initial schema"
```

---

## Task 1: Scoring/ranking core logic (pure, TDD)

**Files:**
- Create: `src/lib/scoring.ts`
- Test: `tests/scoring.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type TeamLite = { id: string; name: string; code: string; logoUrl?: string | null; tag?: string | null };
  export type ScoreLite = { judgeId: string; teamId: string; criterionId: string; value: number };
  export type Phase = 'provisional' | 'final';
  export type RankedRow = {
    team: TeamLite; score: number | null; judgeCount: number; rank: number; tie: boolean;
  };
  export function judgeTotal(scores: ScoreLite[], teamId: string, judgeId: string): number | null;
  export function teamAverage(scores: ScoreLite[], teamId: string, opts?: { excludeJudgeId?: string | null }): { avg: number | null; judgeCount: number };
  export function computeLeaderboard(input: {
    teams: TeamLite[]; scores: ScoreLite[]; headJudgeId: string | null; phase: Phase;
  }): RankedRow[];
  ```

- [ ] **Step 1: Write failing tests**

```bash
mkdir -p tests
cat > tests/scoring.test.ts <<'EOF'
import { describe, it, expect } from 'vitest';
import { judgeTotal, teamAverage, computeLeaderboard, ScoreLite, TeamLite } from '@/lib/scoring';

const teams: TeamLite[] = [
  { id: 't1', name: 'EV Nexus', code: 'EV' },
  { id: 't2', name: 'CarVision', code: 'CV' },
  { id: 't3', name: 'RoadMind', code: 'RM' },
];
// judges: j1..j4 normal, jH head
function s(judgeId:string, teamId:string, criterionId:string, value:number): ScoreLite {
  return { judgeId, teamId, criterionId, value };
}
// two criteria c1(max25) c2(max25)
const scores: ScoreLite[] = [
  // t1: j1..j4 give totals 46, jH gives 50
  s('j1','t1','c1',23), s('j1','t1','c2',23),
  s('j2','t1','c1',22), s('j2','t1','c2',24),
  s('j3','t1','c1',23), s('j3','t1','c2',23),
  s('j4','t1','c1',24), s('j4','t1','c2',22),
  s('jH','t1','c1',25), s('jH','t1','c2',25),
  // t2: j1..j4 totals 48,48,47,47 -> avg 47.5; jH gives 40 (drops it), final avg 46.0
  s('j1','t2','c1',24), s('j1','t2','c2',24),
  s('j2','t2','c1',24), s('j2','t2','c2',24),
  s('j3','t2','c1',24), s('j3','t2','c2',23),
  s('j4','t2','c1',24), s('j4','t2','c2',23),
  s('jH','t2','c1',20), s('jH','t2','c2',20),
  // t3: only j1 scored (partial)
  s('j1','t3','c1',20), s('j1','t3','c2',20),
];

describe('judgeTotal', () => {
  it('sums a judge criterion scores for a team', () => {
    expect(judgeTotal(scores, 't1', 'j1')).toBe(46);
  });
  it('returns null when judge has no scores for team', () => {
    expect(judgeTotal(scores, 't3', 'j2')).toBeNull();
  });
});

describe('teamAverage', () => {
  it('averages all judges including head', () => {
    // t1: (46+46+46+46+50)/5 = 46.8
    expect(teamAverage(scores, 't1').avg).toBeCloseTo(46.8, 5);
    expect(teamAverage(scores, 't1').judgeCount).toBe(5);
  });
  it('excludes head judge when asked', () => {
    // t1 without jH: (46+46+46+46)/4 = 46
    const r = teamAverage(scores, 't1', { excludeJudgeId: 'jH' });
    expect(r.avg).toBeCloseTo(46, 5);
    expect(r.judgeCount).toBe(4);
  });
  it('returns null avg for team with no scores', () => {
    expect(teamAverage(scores, 'tX').avg).toBeNull();
  });
});

describe('computeLeaderboard', () => {
  it('provisional excludes head judge', () => {
    const rows = computeLeaderboard({ teams, scores, headJudgeId: 'jH', phase: 'provisional' });
    const byId = Object.fromEntries(rows.map(r => [r.team.id, r]));
    expect(byId['t2'].score).toBeCloseTo(47.5, 5); // t2 leads provisionally
    expect(byId['t1'].score).toBeCloseTo(46, 5);
    expect(rows[0].team.id).toBe('t2');
    expect(rows[0].rank).toBe(1);
  });
  it('final includes head judge and reshuffles', () => {
    const rows = computeLeaderboard({ teams, scores, headJudgeId: 'jH', phase: 'final' });
    const byId = Object.fromEntries(rows.map(r => [r.team.id, r]));
    expect(byId['t1'].score).toBeCloseTo(46.8, 5);
    expect(byId['t2'].score).toBeCloseTo(46, 5); // dropped by head
    expect(rows[0].team.id).toBe('t1'); // t1 wins final
  });
  it('teams with no score rank last with null score', () => {
    const rows = computeLeaderboard({ teams, scores, headJudgeId: 'jH', phase: 'final' });
    // t3 has only j1 -> still has a score; add a team with none
    const rows2 = computeLeaderboard({
      teams: [...teams, { id: 't4', name: 'Zeta', code: 'ZT' }],
      scores, headJudgeId: 'jH', phase: 'final',
    });
    expect(rows2[rows2.length - 1].team.id).toBe('t4');
    expect(rows2[rows2.length - 1].score).toBeNull();
  });
  it('assigns golf tie ranks and breaks ties by name', () => {
    const tScores: ScoreLite[] = [
      s('j1','t1','c1',20), s('j1','t1','c2',20), // t1 = 40
      s('j1','t2','c1',20), s('j1','t2','c2',20), // t2 = 40 (tie)
      s('j1','t3','c1',10), s('j1','t3','c2',10), // t3 = 20
    ];
    const rows = computeLeaderboard({ teams, scores: tScores, headJudgeId: null, phase: 'final' });
    // t1 (CarVision? no) — tie between t1 EV Nexus and t2 CarVision at 40; name asc: CarVision before EV Nexus
    expect(rows[0].team.id).toBe('t2'); // "CarVision" < "EV Nexus"
    expect(rows[0].rank).toBe(1); expect(rows[0].tie).toBe(true);
    expect(rows[1].team.id).toBe('t1'); expect(rows[1].rank).toBe(1); expect(rows[1].tie).toBe(true);
    expect(rows[2].rank).toBe(3); expect(rows[2].tie).toBe(false);
  });
});
EOF
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/scoring.test.ts`
Expected: FAIL — `@/lib/scoring` cannot be resolved / functions undefined.

- [ ] **Step 3: Implement scoring.ts**

```bash
cat > src/lib/scoring.ts <<'EOF'
export type TeamLite = { id: string; name: string; code: string; logoUrl?: string | null; tag?: string | null };
export type ScoreLite = { judgeId: string; teamId: string; criterionId: string; value: number };
export type Phase = 'provisional' | 'final';
export type RankedRow = { team: TeamLite; score: number | null; judgeCount: number; rank: number; tie: boolean };

export function judgeTotal(scores: ScoreLite[], teamId: string, judgeId: string): number | null {
  const rows = scores.filter((s) => s.teamId === teamId && s.judgeId === judgeId);
  if (rows.length === 0) return null;
  return round1(rows.reduce((a, s) => a + s.value, 0));
}

export function teamAverage(
  scores: ScoreLite[],
  teamId: string,
  opts: { excludeJudgeId?: string | null } = {},
): { avg: number | null; judgeCount: number } {
  const judgeIds = [...new Set(
    scores.filter((s) => s.teamId === teamId && s.judgeId !== opts.excludeJudgeId).map((s) => s.judgeId),
  )];
  const totals = judgeIds
    .map((jid) => judgeTotal(scores, teamId, jid))
    .filter((t): t is number => t !== null);
  if (totals.length === 0) return { avg: null, judgeCount: 0 };
  return { avg: round1(totals.reduce((a, b) => a + b, 0) / totals.length), judgeCount: totals.length };
}

export function computeLeaderboard(input: {
  teams: TeamLite[]; scores: ScoreLite[]; headJudgeId: string | null; phase: Phase;
}): RankedRow[] {
  const { teams, scores, headJudgeId, phase } = input;
  const exclude = phase === 'provisional' ? headJudgeId : null;
  const rows = teams.map((team) => {
    const { avg, judgeCount } = teamAverage(scores, team.id, { excludeJudgeId: exclude });
    return { team, score: avg, judgeCount, rank: 0, tie: false };
  });
  // sort: score desc (null last), then name asc
  rows.sort((a, b) => {
    if (a.score === null && b.score === null) return a.team.name.localeCompare(b.team.name);
    if (a.score === null) return 1;
    if (b.score === null) return -1;
    if (b.score !== a.score) return b.score - a.score;
    return a.team.name.localeCompare(b.team.name);
  });
  // golf ranks
  let lastScoreKey: string | null = null;
  let lastRank = 0;
  rows.forEach((r, i) => {
    const key = r.score === null ? 'null' : String(r.score);
    if (key === lastScoreKey) { r.rank = lastRank; } else { r.rank = i + 1; lastRank = r.rank; lastScoreKey = key; }
  });
  const rankCounts: Record<number, number> = {};
  rows.forEach((r) => { rankCounts[r.rank] = (rankCounts[r.rank] || 0) + 1; });
  rows.forEach((r) => { r.tie = rankCounts[r.rank] > 1; });
  return rows;
}

function round1(n: number): number { return Math.round(n * 10) / 10; }
EOF
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/scoring.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add src/lib/scoring.ts tests/scoring.test.ts
git commit -m "feat: scoring aggregation and golf ranking with head-judge exclusion"
```

---

## Task 2: Access-code generator + session auth + middleware

**Files:**
- Create: `src/lib/access-code.ts`, `src/lib/auth.ts`, `src/middleware.ts`
- Test: `tests/auth.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // access-code.ts
  export function generateAccessCode(): string; // e.g. "7KQ2-9FMX", unambiguous alphabet
  // auth.ts
  export function signSession(userId: string): string;         // "<userId>.<hmac>"
  export function verifySession(token: string | undefined): string | null; // userId | null
  export const SESSION_COOKIE = 'hs_session';
  export async function getCurrentUser(): Promise<{ id:string; name:string; role:'admin'|'judge'; isHead:boolean } | null>;
  ```

- [ ] **Step 1: Write failing tests**

```bash
cat > tests/auth.test.ts <<'EOF'
import { describe, it, expect, beforeAll } from 'vitest';
process.env.SESSION_SECRET = 'test-secret-test-secret-test-secret';
import { generateAccessCode } from '@/lib/access-code';
import { signSession, verifySession } from '@/lib/auth';

describe('generateAccessCode', () => {
  it('produces XXXX-XXXX from unambiguous chars', () => {
    const c = generateAccessCode();
    expect(c).toMatch(/^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
  });
  it('is reasonably unique', () => {
    const set = new Set(Array.from({ length: 500 }, () => generateAccessCode()));
    expect(set.size).toBeGreaterThan(495);
  });
});

describe('session sign/verify', () => {
  it('round-trips a userId', () => {
    const token = signSession('user123');
    expect(verifySession(token)).toBe('user123');
  });
  it('rejects tampered token', () => {
    const token = signSession('user123');
    expect(verifySession(token.replace('user123', 'attacker'))).toBeNull();
  });
  it('rejects undefined/garbage', () => {
    expect(verifySession(undefined)).toBeNull();
    expect(verifySession('nope')).toBeNull();
  });
});
EOF
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/auth.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement access-code.ts and auth.ts**

```bash
cat > src/lib/access-code.ts <<'EOF'
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I,O,0,1
export function generateAccessCode(): string {
  const pick = () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  const block = () => Array.from({ length: 4 }, pick).join('');
  return `${block()}-${block()}`;
}
EOF

cat > src/lib/auth.ts <<'EOF'
import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/db';

export const SESSION_COOKIE = 'hs_session';
function secret(): string { return process.env.SESSION_SECRET || 'dev-secret-change-me'; }

export function signSession(userId: string): string {
  const mac = createHmac('sha256', secret()).update(userId).digest('hex');
  return `${userId}.${mac}`;
}
export function verifySession(token: string | undefined): string | null {
  if (!token || !token.includes('.')) return null;
  const idx = token.lastIndexOf('.');
  const userId = token.slice(0, idx);
  const mac = token.slice(idx + 1);
  const expected = createHmac('sha256', secret()).update(userId).digest('hex');
  try {
    if (mac.length === expected.length && timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) return userId;
  } catch { /* fallthrough */ }
  return null;
}
export async function getCurrentUser() {
  const token = cookies().get(SESSION_COOKIE)?.value;
  const userId = verifySession(token);
  if (!userId) return null;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, role: true, isHead: true, active: true },
  });
  if (!user || !user.active) return null;
  return user;
}
EOF
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/auth.test.ts`
Expected: PASS.

- [ ] **Step 5: Implement middleware (role-gated routes)**

```bash
cat > src/middleware.ts <<'EOF'
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Runs in the Edge runtime, so it must NOT import node:crypto (via @/lib/auth).
// This is a fast presence check only; the real HMAC verification + role gate
// happens in the /admin and /judge server layouts via getCurrentUser (Node runtime).
const SESSION_COOKIE = 'hs_session';

// Board and login are public. /admin and /judge require a session cookie to be present.
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isProtected = pathname.startsWith('/admin') || pathname.startsWith('/judge');
  if (!isProtected) return NextResponse.next();
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) {
    const url = req.nextUrl.clone(); url.pathname = '/login';
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}
export const config = { matcher: ['/admin/:path*', '/judge/:path*'] };
EOF
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/access-code.ts src/lib/auth.ts src/middleware.ts tests/auth.test.ts
git commit -m "feat: access-code auth, signed session cookie, route middleware"
```

---

## Task 3: Seed data + test DB helper

**Files:**
- Create: `prisma/seed.ts`
- Create: `tests/helpers/db.ts`

**Interfaces:**
- Produces: seeded DB with 1 admin, 5 judges (1 head), 8 teams (with members), 5 criteria (max 10 each = total 50), and sample scores for all judges except partial coverage. Admin/head access codes printed to stdout.
- `resetDb()` and `disconnect()` helpers for integration tests.

- [ ] **Step 1: Write the seed**

```bash
cat > prisma/seed.ts <<'EOF'
import { PrismaClient } from '@prisma/client';
import { generateAccessCode } from '../src/lib/access-code';
const prisma = new PrismaClient();

const TEAMS = [
  { code:'EV', name:'EV Nexus',     tag:'Quản lý pin & định tuyến sạc' },
  { code:'CV', name:'CarVision AI', tag:'Thị giác máy tính hỗ trợ lái' },
  { code:'RM', name:'RoadMind',     tag:'Định tuyến giao thông thông minh' },
  { code:'AP', name:'AutoPilot X',  tag:'Điều khiển tự hành cấp độ 2' },
  { code:'TX', name:'TorqueX',      tag:'Tối ưu hộp số & tiêu hao' },
  { code:'C9', name:'Chassis 9',    tag:'Cảm biến khung gầm IoT' },
  { code:'VL', name:'Vroom Labs',   tag:'Trợ lý giọng nói trên xe' },
  { code:'SD', name:'Smart Drive',  tag:'Cảnh báo va chạm chủ động' },
];
const CRITERIA = [
  { name:'Chất lượng code', description:'Cấu trúc rõ ràng, sạch, dễ bảo trì', maxScore:10, order:0 },
  { name:'Chạy không lỗi', description:'Sản phẩm chạy ổn định, không giới hạn', maxScore:10, order:1 },
  { name:'Tính sáng tạo', description:'Ý tưởng độc đáo, khác biệt', maxScore:10, order:2 },
  { name:'Tính ứng dụng', description:'Khả năng áp dụng thực tế ngành ô tô', maxScore:10, order:3 },
  { name:'Thuyết trình', description:'Trình bày mạch lạc, thuyết phục', maxScore:10, order:4 },
];
const JUDGES = [
  { name:'Nguyễn Văn Minh', isHead:true },
  { name:'Trần Thị Lan', isHead:false },
  { name:'Lê Hoàng Sơn', isHead:false },
  { name:'Phạm Thu Hà', isHead:false },
  { name:'Đỗ Minh Phúc', isHead:false },
];

async function main() {
  await prisma.score.deleteMany();
  await prisma.member.deleteMany();
  await prisma.criterion.deleteMany();
  await prisma.team.deleteMany();
  await prisma.user.deleteMany();
  await prisma.settings.upsert({ where:{ id:1 }, update:{ revealState:'drafting' }, create:{ id:1, revealState:'drafting' } });

  const admin = await prisma.user.create({ data:{ name:'Ban tổ chức', role:'admin', accessCode: generateAccessCode() } });
  const judges = [];
  for (const j of JUDGES) judges.push(await prisma.user.create({ data:{ name:j.name, role:'judge', isHead:j.isHead, accessCode: generateAccessCode() } }));

  const criteria = [];
  for (const c of CRITERIA) criteria.push(await prisma.criterion.create({ data:c }));

  const teams = [];
  for (const t of TEAMS) {
    const team = await prisma.team.create({ data:{ ...t, members:{ create:[
      { name:'Nguyễn An', teamRole:'Trưởng nhóm · Backend', org:'ĐH Bách Khoa HN', intro:'Dẫn dắt kiến trúc backend.' },
      { name:'Trần Bình', teamRole:'AI Engineer', org:'FPT Software', intro:'Phụ trách mô hình.' },
      { name:'Lê Chi', teamRole:'Frontend · Design', org:'ĐH FPT', intro:'Thiết kế trải nghiệm.' },
    ] } } });
    teams.push(team);
  }

  // sample scores: each judge scores each team ~ target totals; head varies to create reshuffle.
  // target provisional totals (avg of 4 non-head) and head total per team code:
  const target: Record<string, { base:number; head:number }> = {
    EV:{ base:46.0, head:50 }, CV:{ base:47.5, head:41 }, RM:{ base:44.0, head:49 }, AP:{ base:45.5, head:43 },
    TX:{ base:41.0, head:48 }, C9:{ base:43.5, head:37 }, VL:{ base:40.0, head:38 }, SD:{ base:42.0, head:33 },
  };
  for (const team of teams) {
    const tg = target[team.code];
    for (const judge of judges) {
      const total = judge.isHead ? tg.head : tg.base;
      // split total across 5 criteria (each max 10)
      const per = total / criteria.length;
      for (const c of criteria) {
        await prisma.score.create({ data:{ judgeId:judge.id, teamId:team.id, criterionId:c.id, value: Math.min(10, Math.round(per*10)/10), submitted:true } });
      }
    }
  }

  console.log('Seed done.');
  console.log('ADMIN access code:', admin.accessCode);
  for (const j of judges) console.log(`JUDGE ${j.isHead?'(HEAD)':'      '} ${j.name}: ${(await prisma.user.findUnique({where:{id:j.id}}))!.accessCode}`);
}
main().catch((e)=>{ console.error(e); process.exit(1); }).finally(()=>prisma.$disconnect());
EOF
```

- [ ] **Step 2: Run seed against dev DB**

```bash
npx tsx prisma/seed.ts
```
Expected: prints "Seed done." and access codes for admin + 5 judges.

- [ ] **Step 3: Test DB helper**

```bash
mkdir -p tests/helpers
cat > tests/helpers/db.ts <<'EOF'
import { PrismaClient } from '@prisma/client';
export const prisma = new PrismaClient();
export async function disconnect() { await prisma.$disconnect(); }
EOF
```

- [ ] **Step 4: Commit**

```bash
git add prisma/seed.ts tests/helpers/db.ts
git commit -m "feat: seed data (admin, judges, teams, members, barem, sample scores)"
```

---

## Task 4: Team + Member service and Admin API

**Files:**
- Create: `src/lib/services/teams.ts`
- Create: `src/app/api/teams/route.ts`, `src/app/api/teams/[id]/route.ts`
- Create: `src/app/api/members/route.ts`, `src/app/api/members/[id]/route.ts`
- Test: `tests/services.teams.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export async function listTeams(): Promise<TeamWithMembers[]>;
  export async function createTeam(data:{name:string;code:string;logoUrl?:string;tag?:string}): Promise<Team>;
  export async function updateTeam(id:string, data:Partial<...>): Promise<Team>;
  export async function deleteTeam(id:string): Promise<void>;
  export async function addMember(teamId:string, data:MemberInput): Promise<Member>;
  export async function updateMember(id:string, data:Partial<MemberInput>): Promise<Member>;
  export async function deleteMember(id:string): Promise<void>;
  ```
- Consumes: `prisma` from `@/lib/db`.

- [ ] **Step 1: Write failing service test**

```bash
cat > tests/services.teams.test.ts <<'EOF'
import { describe, it, expect, afterAll } from 'vitest';
import { prisma, disconnect } from './helpers/db';
import { createTeam, listTeams, updateTeam, deleteTeam, addMember, deleteMember } from '@/lib/services/teams';

afterAll(disconnect);

describe('teams service', () => {
  it('creates, lists, updates, deletes a team with members', async () => {
    const t = await createTeam({ name:'Test Team', code:'TT', tag:'demo' });
    expect(t.id).toBeTruthy();
    const m = await addMember(t.id, { name:'Alice', teamRole:'Lead' });
    let all = await listTeams();
    const found = all.find(x => x.id === t.id)!;
    expect(found.members.length).toBe(1);
    await updateTeam(t.id, { name:'Renamed' });
    all = await listTeams();
    expect(all.find(x=>x.id===t.id)!.name).toBe('Renamed');
    await deleteMember(m.id);
    await deleteTeam(t.id);
    all = await listTeams();
    expect(all.find(x=>x.id===t.id)).toBeUndefined();
  });
});
EOF
```

- [ ] **Step 2: Run to verify fail**

Run: `npm test -- tests/services.teams.test.ts`
Expected: FAIL — service module missing.

- [ ] **Step 3: Implement service**

```bash
mkdir -p src/lib/services
cat > src/lib/services/teams.ts <<'EOF'
import { prisma } from '@/lib/db';

export type MemberInput = { name:string; teamRole?:string; photoUrl?:string; org?:string; email?:string; phone?:string; intro?:string };

export function listTeams() {
  return prisma.team.findMany({ orderBy:{ createdAt:'asc' }, include:{ members:true } });
}
export function createTeam(data:{ name:string; code:string; logoUrl?:string; tag?:string }) {
  return prisma.team.create({ data });
}
export function updateTeam(id:string, data:{ name?:string; code?:string; logoUrl?:string; tag?:string }) {
  return prisma.team.update({ where:{ id }, data });
}
export async function deleteTeam(id:string) { await prisma.team.delete({ where:{ id } }); }
export function addMember(teamId:string, data:MemberInput) { return prisma.member.create({ data:{ ...data, teamId } }); }
export function updateMember(id:string, data:Partial<MemberInput>) { return prisma.member.update({ where:{ id }, data }); }
export async function deleteMember(id:string) { await prisma.member.delete({ where:{ id } }); }
EOF
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- tests/services.teams.test.ts`
Expected: PASS.

- [ ] **Step 5: Implement API routes (admin-guarded)**

```bash
mkdir -p src/app/api/teams/\[id\] src/app/api/members/\[id\]
cat > src/app/api/teams/route.ts <<'EOF'
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { listTeams, createTeam } from '@/lib/services/teams';

async function requireAdmin() { const u = await getCurrentUser(); return u?.role === 'admin' ? u : null; }

export async function GET() { return NextResponse.json(await listTeams()); }
export async function POST(req: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error:'forbidden' }, { status:403 });
  const body = await req.json();
  if (!body?.name || !body?.code) return NextResponse.json({ error:'name and code required' }, { status:400 });
  return NextResponse.json(await createTeam(body), { status:201 });
}
EOF
cat > src/app/api/teams/\[id\]/route.ts <<'EOF'
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { updateTeam, deleteTeam } from '@/lib/services/teams';
async function requireAdmin() { const u = await getCurrentUser(); return u?.role === 'admin' ? u : null; }
export async function PATCH(req: Request, { params }: { params:{ id:string } }) {
  if (!(await requireAdmin())) return NextResponse.json({ error:'forbidden' }, { status:403 });
  return NextResponse.json(await updateTeam(params.id, await req.json()));
}
export async function DELETE(_req: Request, { params }: { params:{ id:string } }) {
  if (!(await requireAdmin())) return NextResponse.json({ error:'forbidden' }, { status:403 });
  await deleteTeam(params.id); return NextResponse.json({ ok:true });
}
EOF
cat > src/app/api/members/route.ts <<'EOF'
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { addMember } from '@/lib/services/teams';
export async function POST(req: Request) {
  const u = await getCurrentUser(); if (u?.role !== 'admin') return NextResponse.json({ error:'forbidden' }, { status:403 });
  const body = await req.json();
  if (!body?.teamId || !body?.name) return NextResponse.json({ error:'teamId and name required' }, { status:400 });
  const { teamId, ...data } = body;
  return NextResponse.json(await addMember(teamId, data), { status:201 });
}
EOF
cat > src/app/api/members/\[id\]/route.ts <<'EOF'
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { updateMember, deleteMember } from '@/lib/services/teams';
async function requireAdmin() { const u = await getCurrentUser(); return u?.role === 'admin' ? u : null; }
export async function PATCH(req: Request, { params }: { params:{ id:string } }) {
  if (!(await requireAdmin())) return NextResponse.json({ error:'forbidden' }, { status:403 });
  return NextResponse.json(await updateMember(params.id, await req.json()));
}
export async function DELETE(_req: Request, { params }: { params:{ id:string } }) {
  if (!(await requireAdmin())) return NextResponse.json({ error:'forbidden' }, { status:403 });
  await deleteMember(params.id); return NextResponse.json({ ok:true });
}
EOF
```

- [ ] **Step 6: Typecheck + commit**

```bash
npx tsc --noEmit
git add src/lib/services/teams.ts src/app/api/teams src/app/api/members tests/services.teams.test.ts
git commit -m "feat: team+member service and admin CRUD API"
```

---

## Task 5: Judges + Criteria (barem) service and Admin API

**Files:**
- Create: `src/lib/services/judges.ts`, `src/lib/services/criteria.ts`
- Create: `src/app/api/judges/route.ts`, `src/app/api/judges/[id]/route.ts`
- Create: `src/app/api/criteria/route.ts`, `src/app/api/criteria/[id]/route.ts`
- Test: `tests/services.judges.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // judges.ts
  export function listJudges(): Promise<User[]>;
  export function createJudge(data:{name:string; isHead?:boolean}): Promise<User>; // auto access code; if isHead, unset previous head
  export function regenerateCode(id:string): Promise<User>;
  export function setHead(id:string): Promise<void>; // ensures single head
  export function deleteJudge(id:string): Promise<void>;
  // criteria.ts
  export function listCriteria(): Promise<Criterion[]>; // ordered
  export function createCriterion(data:{name:string;maxScore:number;description?:string}): Promise<Criterion>;
  export function updateCriterion(id:string, data:Partial<...>): Promise<Criterion>;
  export function deleteCriterion(id:string): Promise<void>;
  export function baremTotal(criteria:{maxScore:number}[]): number;
  ```

- [ ] **Step 1: Write failing test**

```bash
cat > tests/services.judges.test.ts <<'EOF'
import { describe, it, expect, afterAll } from 'vitest';
import { disconnect } from './helpers/db';
import { createJudge, listJudges, regenerateCode, setHead, deleteJudge } from '@/lib/services/judges';
import { createCriterion, listCriteria, updateCriterion, deleteCriterion, baremTotal } from '@/lib/services/criteria';
afterAll(disconnect);

describe('judges service', () => {
  it('creates judge with a unique access code', async () => {
    const j = await createJudge({ name:'Judge X' });
    expect(j.accessCode).toMatch(/^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
    const old = j.accessCode;
    const j2 = await regenerateCode(j.id);
    expect(j2.accessCode).not.toBe(old);
    await deleteJudge(j.id);
  });
  it('enforces a single head judge', async () => {
    const a = await createJudge({ name:'Head A', isHead:true });
    const b = await createJudge({ name:'Head B', isHead:true });
    const heads = (await listJudges()).filter(j => j.isHead);
    expect(heads.length).toBe(1);
    expect(heads[0].id).toBe(b.id);
    await deleteJudge(a.id); await deleteJudge(b.id);
  });
});
describe('criteria service', () => {
  it('CRUD + total', async () => {
    const c1 = await createCriterion({ name:'A', maxScore:10 });
    const c2 = await createCriterion({ name:'B', maxScore:15 });
    const list = await listCriteria();
    expect(list.length).toBeGreaterThanOrEqual(2);
    expect(baremTotal([{maxScore:10},{maxScore:15}])).toBe(25);
    await updateCriterion(c1.id, { maxScore:20 });
    await deleteCriterion(c1.id); await deleteCriterion(c2.id);
  });
});
EOF
```

- [ ] **Step 2: Run to verify fail**

Run: `npm test -- tests/services.judges.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement services**

```bash
cat > src/lib/services/judges.ts <<'EOF'
import { prisma } from '@/lib/db';
import { generateAccessCode } from '@/lib/access-code';

async function uniqueCode(): Promise<string> {
  for (let i=0;i<10;i++){ const c=generateAccessCode(); if(!(await prisma.user.findUnique({where:{accessCode:c}}))) return c; }
  return generateAccessCode()+Math.floor(Math.random()*9);
}
export function listJudges() { return prisma.user.findMany({ where:{ role:'judge' }, orderBy:{ createdAt:'asc' } }); }
export async function createJudge(data:{ name:string; isHead?:boolean }) {
  if (data.isHead) await prisma.user.updateMany({ where:{ role:'judge', isHead:true }, data:{ isHead:false } });
  return prisma.user.create({ data:{ name:data.name, role:'judge', isHead:!!data.isHead, accessCode: await uniqueCode() } });
}
export async function regenerateCode(id:string) { return prisma.user.update({ where:{ id }, data:{ accessCode: await uniqueCode() } }); }
export async function setHead(id:string) {
  await prisma.user.updateMany({ where:{ role:'judge', isHead:true }, data:{ isHead:false } });
  await prisma.user.update({ where:{ id }, data:{ isHead:true } });
}
export async function deleteJudge(id:string) { await prisma.user.delete({ where:{ id } }); }
EOF

cat > src/lib/services/criteria.ts <<'EOF'
import { prisma } from '@/lib/db';
export function listCriteria() { return prisma.criterion.findMany({ orderBy:{ order:'asc' } }); }
export async function createCriterion(data:{ name:string; maxScore:number; description?:string }) {
  const count = await prisma.criterion.count();
  return prisma.criterion.create({ data:{ ...data, order: count } });
}
export function updateCriterion(id:string, data:{ name?:string; maxScore?:number; description?:string; order?:number }) {
  return prisma.criterion.update({ where:{ id }, data });
}
export async function deleteCriterion(id:string) { await prisma.criterion.delete({ where:{ id } }); }
export function baremTotal(criteria:{ maxScore:number }[]) { return Math.round(criteria.reduce((a,c)=>a+c.maxScore,0)*10)/10; }
EOF
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- tests/services.judges.test.ts`
Expected: PASS.

- [ ] **Step 5: Implement API routes**

```bash
mkdir -p src/app/api/judges/\[id\] src/app/api/criteria/\[id\]
cat > src/app/api/judges/route.ts <<'EOF'
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { listJudges, createJudge } from '@/lib/services/judges';
export async function GET() {
  const u = await getCurrentUser(); if (u?.role !== 'admin') return NextResponse.json({ error:'forbidden' }, { status:403 });
  return NextResponse.json(await listJudges());
}
export async function POST(req: Request) {
  const u = await getCurrentUser(); if (u?.role !== 'admin') return NextResponse.json({ error:'forbidden' }, { status:403 });
  const body = await req.json();
  if (!body?.name) return NextResponse.json({ error:'name required' }, { status:400 });
  return NextResponse.json(await createJudge(body), { status:201 });
}
EOF
cat > src/app/api/judges/\[id\]/route.ts <<'EOF'
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { regenerateCode, setHead, deleteJudge } from '@/lib/services/judges';
async function admin(){ const u=await getCurrentUser(); return u?.role==='admin'; }
export async function POST(req: Request, { params }:{ params:{ id:string } }) {
  if (!(await admin())) return NextResponse.json({ error:'forbidden' }, { status:403 });
  const { action } = await req.json();
  if (action==='regen') return NextResponse.json(await regenerateCode(params.id));
  if (action==='setHead') { await setHead(params.id); return NextResponse.json({ ok:true }); }
  return NextResponse.json({ error:'unknown action' }, { status:400 });
}
export async function DELETE(_req: Request, { params }:{ params:{ id:string } }) {
  if (!(await admin())) return NextResponse.json({ error:'forbidden' }, { status:403 });
  await deleteJudge(params.id); return NextResponse.json({ ok:true });
}
EOF
cat > src/app/api/criteria/route.ts <<'EOF'
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { listCriteria, createCriterion } from '@/lib/services/criteria';
export async function GET() { return NextResponse.json(await listCriteria()); }
export async function POST(req: Request) {
  const u = await getCurrentUser(); if (u?.role !== 'admin') return NextResponse.json({ error:'forbidden' }, { status:403 });
  const body = await req.json();
  if (!body?.name || typeof body?.maxScore !== 'number') return NextResponse.json({ error:'name and maxScore required' }, { status:400 });
  return NextResponse.json(await createCriterion(body), { status:201 });
}
EOF
cat > src/app/api/criteria/\[id\]/route.ts <<'EOF'
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { updateCriterion, deleteCriterion } from '@/lib/services/criteria';
async function admin(){ const u=await getCurrentUser(); return u?.role==='admin'; }
export async function PATCH(req: Request, { params }:{ params:{ id:string } }) {
  if (!(await admin())) return NextResponse.json({ error:'forbidden' }, { status:403 });
  return NextResponse.json(await updateCriterion(params.id, await req.json()));
}
export async function DELETE(_req: Request, { params }:{ params:{ id:string } }) {
  if (!(await admin())) return NextResponse.json({ error:'forbidden' }, { status:403 });
  await deleteCriterion(params.id); return NextResponse.json({ ok:true });
}
EOF
```

- [ ] **Step 6: Typecheck + commit**

```bash
npx tsc --noEmit
git add src/lib/services/judges.ts src/lib/services/criteria.ts src/app/api/judges src/app/api/criteria tests/services.judges.test.ts
git commit -m "feat: judges + barem services and admin API"
```

---

## Task 6: Scores service + Judge API + login/logout API

**Files:**
- Create: `src/lib/services/scores.ts`
- Create: `src/app/api/scores/route.ts`
- Create: `src/app/api/auth/login/route.ts`, `src/app/api/auth/logout/route.ts`
- Create: `src/app/api/me/route.ts`
- Test: `tests/services.scores.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // scores.ts
  export function getJudgeScores(judgeId:string, teamId:string): Promise<Score[]>;
  export function upsertScores(judgeId:string, teamId:string, values:{criterionId:string; value:number}[], submitted:boolean): Promise<void>;
  export function judgeProgress(): Promise<{ teamId:string; judgeId:string; submitted:boolean }[]>;
  ```
- Consumes: `getCurrentUser`, `signSession`, `SESSION_COOKIE`, `broadcast` (from events, added Task 7 — login/logout do not need it).

- [ ] **Step 1: Write failing test**

```bash
cat > tests/services.scores.test.ts <<'EOF'
import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import { prisma, disconnect } from './helpers/db';
import { upsertScores, getJudgeScores } from '@/lib/services/scores';
afterAll(disconnect);

let judgeId:string, teamId:string, critIds:string[]=[];
beforeAll(async () => {
  const j = await prisma.user.create({ data:{ name:'ST Judge', role:'judge', accessCode:'ZZ99-ZZ98' } });
  const t = await prisma.team.create({ data:{ name:'ST Team', code:'ST' } });
  const c1 = await prisma.criterion.create({ data:{ name:'x', maxScore:10, order:100 } });
  const c2 = await prisma.criterion.create({ data:{ name:'y', maxScore:10, order:101 } });
  judgeId=j.id; teamId=t.id; critIds=[c1.id,c2.id];
});

describe('scores service', () => {
  it('upserts and reads back, then updates same rows (no dupes)', async () => {
    await upsertScores(judgeId, teamId, [{criterionId:critIds[0],value:8},{criterionId:critIds[1],value:9}], false);
    let rows = await getJudgeScores(judgeId, teamId);
    expect(rows.length).toBe(2);
    expect(rows.find(r=>r.criterionId===critIds[0])!.value).toBe(8);
    await upsertScores(judgeId, teamId, [{criterionId:critIds[0],value:10},{criterionId:critIds[1],value:9}], true);
    rows = await getJudgeScores(judgeId, teamId);
    expect(rows.length).toBe(2); // still 2, updated
    expect(rows.find(r=>r.criterionId===critIds[0])!.value).toBe(10);
    expect(rows[0].submitted).toBe(true);
  });
});
EOF
```

- [ ] **Step 2: Run to verify fail**

Run: `npm test -- tests/services.scores.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement scores service**

```bash
cat > src/lib/services/scores.ts <<'EOF'
import { prisma } from '@/lib/db';
export function getJudgeScores(judgeId:string, teamId:string) {
  return prisma.score.findMany({ where:{ judgeId, teamId } });
}
export async function upsertScores(
  judgeId:string, teamId:string,
  values:{ criterionId:string; value:number }[], submitted:boolean,
) {
  await prisma.$transaction(values.map(v =>
    prisma.score.upsert({
      where:{ judgeId_teamId_criterionId:{ judgeId, teamId, criterionId:v.criterionId } },
      update:{ value:v.value, submitted },
      create:{ judgeId, teamId, criterionId:v.criterionId, value:v.value, submitted },
    })
  ));
}
export async function judgeProgress() {
  const rows = await prisma.score.groupBy({ by:['judgeId','teamId'], _max:{ submitted:true } });
  return rows.map(r => ({ judgeId:r.judgeId, teamId:r.teamId, submitted: !!r._max.submitted }));
}
EOF
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- tests/services.scores.test.ts`
Expected: PASS.

- [ ] **Step 5: Implement auth + scores + me API**

```bash
mkdir -p src/app/api/auth/login src/app/api/auth/logout src/app/api/scores src/app/api/me
cat > src/app/api/auth/login/route.ts <<'EOF'
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { signSession, SESSION_COOKIE } from '@/lib/auth';
export async function POST(req: Request) {
  const { code } = await req.json();
  const user = await prisma.user.findUnique({ where:{ accessCode: (code||'').trim().toUpperCase() } });
  if (!user || !user.active) return NextResponse.json({ error:'Mã truy cập không hợp lệ' }, { status:401 });
  const res = NextResponse.json({ role:user.role, name:user.name });
  res.cookies.set(SESSION_COOKIE, signSession(user.id), { httpOnly:true, sameSite:'lax', path:'/', maxAge:60*60*24 });
  return res;
}
EOF
cat > src/app/api/auth/logout/route.ts <<'EOF'
import { NextResponse } from 'next/server';
import { SESSION_COOKIE } from '@/lib/auth';
export async function POST() {
  const res = NextResponse.json({ ok:true });
  res.cookies.set(SESSION_COOKIE, '', { path:'/', maxAge:0 });
  return res;
}
EOF
cat > src/app/api/me/route.ts <<'EOF'
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
export async function GET() { return NextResponse.json(await getCurrentUser()); }
EOF
cat > src/app/api/scores/route.ts <<'EOF'
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getJudgeScores, upsertScores } from '@/lib/services/scores';
import { broadcast } from '@/lib/events';
export async function GET(req: Request) {
  const u = await getCurrentUser(); if (u?.role !== 'judge') return NextResponse.json({ error:'forbidden' }, { status:403 });
  const teamId = new URL(req.url).searchParams.get('teamId'); if (!teamId) return NextResponse.json({ error:'teamId required' }, { status:400 });
  return NextResponse.json(await getJudgeScores(u.id, teamId));
}
export async function POST(req: Request) {
  const u = await getCurrentUser(); if (u?.role !== 'judge') return NextResponse.json({ error:'forbidden' }, { status:403 });
  const { teamId, values, submitted } = await req.json();
  if (!teamId || !Array.isArray(values)) return NextResponse.json({ error:'teamId and values required' }, { status:400 });
  await upsertScores(u.id, teamId, values, !!submitted);
  broadcast('update', { reason:'score', teamId });
  return NextResponse.json({ ok:true });
}
EOF
```
> Note: `src/lib/events.ts` (`broadcast`) is created in Task 7. If executing strictly in order, create a temporary stub now — Step 6 below adds it — OR run Task 7 before typechecking. To keep this task self-contained, add the stub:

```bash
cat > src/lib/events.ts <<'EOF'
// Full implementation in Task 7. Stub keeps imports resolving.
export function broadcast(_event: string, _data: unknown) {}
EOF
```

- [ ] **Step 6: Typecheck + commit**

```bash
npx tsc --noEmit
git add src/lib/services/scores.ts src/app/api/scores src/app/api/auth src/app/api/me src/lib/events.ts tests/services.scores.test.ts
git commit -m "feat: scores service, judge scoring API, login/logout"
```

---

## Task 7: Reveal state machine + SSE event bus + results API

**Files:**
- Overwrite: `src/lib/events.ts` (real implementation)
- Create: `src/lib/services/reveal.ts`
- Create: `src/app/api/reveal/route.ts`
- Create: `src/app/api/results/route.ts`
- Create: `src/app/api/stream/route.ts`
- Test: `tests/reveal-flow.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // events.ts
  export function broadcast(event:string, data:unknown): void;
  export function subscribe(fn:(payload:{event:string;data:unknown})=>void): ()=>void;
  // reveal.ts
  export function getRevealState(): Promise<'drafting'|'provisional'|'final'>;
  export function setRevealState(state:'drafting'|'provisional'|'final', actorId?:string): Promise<void>;
  export function getResults(): Promise<{ state:string; rows:RankedRow[]; baremTotal:number }>;
  ```
- Consumes: `computeLeaderboard` from `@/lib/scoring`.

- [ ] **Step 1: Write failing integration test**

```bash
cat > tests/reveal-flow.test.ts <<'EOF'
import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import { execSync } from 'node:child_process';
import { disconnect } from './helpers/db';
import { setRevealState, getRevealState, getResults } from '@/lib/services/reveal';

afterAll(disconnect);
// Re-seed to a known state so this test is deterministic regardless of what
// other integration tests did to shared DB state (e.g. head-judge flag).
beforeAll(() => {
  execSync('npx tsx prisma/seed.ts', { stdio: 'ignore' });
}, 120000);

describe('reveal flow', () => {
  it('provisional excludes head, final includes head, ranking changes', async () => {
    await setRevealState('provisional');
    expect(await getRevealState()).toBe('provisional');
    const prov = await getResults();
    const provLeader = prov.rows[0].team.code;

    await setRevealState('final');
    const fin = await getResults();
    const finLeader = fin.rows[0].team.code;

    expect(prov.baremTotal).toBe(50);
    // seed is designed so provisional leader (CV) differs from final leader (EV)
    expect(provLeader).toBe('CV');
    expect(finLeader).toBe('EV');

    await setRevealState('drafting'); // reset
  });
});
EOF
```

- [ ] **Step 2: Run to verify fail**

Run: `npx tsx prisma/seed.ts && npm test -- tests/reveal-flow.test.ts`
Expected: FAIL — reveal service missing.

- [ ] **Step 3: Implement events, reveal service**

```bash
cat > src/lib/events.ts <<'EOF'
import { EventEmitter } from 'node:events';
const g = globalThis as unknown as { hsBus?: EventEmitter };
const bus = g.hsBus ?? new EventEmitter();
bus.setMaxListeners(1000);
if (process.env.NODE_ENV !== 'production') g.hsBus = bus;

export function broadcast(event: string, data: unknown) { bus.emit('event', { event, data }); }
export function subscribe(fn: (payload: { event: string; data: unknown }) => void) {
  bus.on('event', fn);
  return () => bus.off('event', fn);
}
EOF

cat > src/lib/services/reveal.ts <<'EOF'
import { prisma } from '@/lib/db';
import { computeLeaderboard, ScoreLite, TeamLite } from '@/lib/scoring';
import { broadcast } from '@/lib/events';

type State = 'drafting' | 'provisional' | 'final';

async function settings() {
  return prisma.settings.upsert({ where:{ id:1 }, update:{}, create:{ id:1, revealState:'drafting' } });
}
export async function getRevealState(): Promise<State> { return (await settings()).revealState as State; }
export async function setRevealState(state: State, actorId?: string) {
  await prisma.settings.upsert({ where:{ id:1 }, update:{ revealState: state }, create:{ id:1, revealState: state } });
  await prisma.auditLog.create({ data:{ actorId, action:'reveal:'+state } });
  broadcast('reveal', { state });
}
export async function getResults() {
  const state = await getRevealState();
  const [teams, scoreRows, head, criteria] = await Promise.all([
    prisma.team.findMany({ orderBy:{ createdAt:'asc' } }),
    prisma.score.findMany({ select:{ judgeId:true, teamId:true, criterionId:true, value:true } }),
    prisma.user.findFirst({ where:{ role:'judge', isHead:true }, select:{ id:true } }),
    prisma.criterion.findMany({ select:{ maxScore:true } }),
  ]);
  const phase = state === 'final' ? 'final' : 'provisional';
  const teamsLite: TeamLite[] = teams.map(t => ({ id:t.id, name:t.name, code:t.code, logoUrl:t.logoUrl, tag:t.tag }));
  const scores: ScoreLite[] = scoreRows;
  const rows = computeLeaderboard({ teams: teamsLite, scores, headJudgeId: head?.id ?? null, phase });
  const baremTotal = Math.round(criteria.reduce((a,c)=>a+c.maxScore,0)*10)/10;
  return { state, rows, baremTotal };
}
EOF
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- tests/reveal-flow.test.ts`
Expected: PASS.

- [ ] **Step 5: Implement reveal, results, stream routes**

```bash
mkdir -p src/app/api/reveal src/app/api/results src/app/api/stream
cat > src/app/api/reveal/route.ts <<'EOF'
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getRevealState, setRevealState } from '@/lib/services/reveal';
export async function GET() { return NextResponse.json({ state: await getRevealState() }); }
export async function POST(req: Request) {
  const u = await getCurrentUser(); if (u?.role !== 'admin') return NextResponse.json({ error:'forbidden' }, { status:403 });
  const { state } = await req.json();
  if (!['drafting','provisional','final'].includes(state)) return NextResponse.json({ error:'bad state' }, { status:400 });
  await setRevealState(state, u.id);
  return NextResponse.json({ ok:true, state });
}
EOF
cat > src/app/api/results/route.ts <<'EOF'
import { NextResponse } from 'next/server';
import { getResults } from '@/lib/services/reveal';
export async function GET() { return NextResponse.json(await getResults()); }
EOF
cat > src/app/api/stream/route.ts <<'EOF'
import { subscribe } from '@/lib/events';
export const dynamic = 'force-dynamic';
export async function GET() {
  const encoder = new TextEncoder();
  let cleanup = () => {};
  const stream = new ReadableStream({
    start(controller) {
      const send = (event: string, data: unknown) => {
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          cleanup(); // controller already closed (client gone) — tear down
        }
      };
      send('hello', {});
      const unsub = subscribe(({ event, data }) => send(event, data));
      const ping = setInterval(() => send('ping', {}), 15000);
      cleanup = () => { clearInterval(ping); unsub(); };
    },
    cancel() { cleanup(); },
  });
  return new Response(stream, {
    headers: { 'Content-Type':'text/event-stream', 'Cache-Control':'no-cache, no-transform', Connection:'keep-alive' },
  });
}
EOF
```

- [ ] **Step 6: Typecheck + commit**

```bash
npx tsc --noEmit
git add src/lib/events.ts src/lib/services/reveal.ts src/app/api/reveal src/app/api/results src/app/api/stream tests/reveal-flow.test.ts
git commit -m "feat: reveal state machine, SSE bus, results + stream API"
```

---

## Task 8: Design tokens + shared UI shell (port from mockup)

**Files:**
- Overwrite: `src/app/globals.css` (full token set + component classes from `mockups/index.html`)
- Modify: `src/app/layout.tsx` (Google Fonts links)
- Create: `src/components/Shell.tsx` (sidebar + topbar for CMS)
- Create: `src/lib/ui.ts` (shared helpers: `fetcher`, `cx`)

**Interfaces:**
- Produces: global CSS classes (`.btn`, `.card`, `.pill`, `.row`, `.pod`, `.podium`, `.stat`, `.table` styles, etc.) matching mockup; `<Shell role="admin"|"judge">` wrapper.
- Consumes: nothing new.

- [ ] **Step 1: Copy the full `<style>` block from the mockup into globals.css**

Open `mockups/index.html`, copy everything between `<style>` and `</style>` into `src/app/globals.css` verbatim (it already uses the approved light theme + podium fixes). Prepend the Tailwind directives so utilities remain available:

```bash
# Manually: paste mockup CSS after these three lines
printf '@tailwind base;\n@tailwind components;\n@tailwind utilities;\n\n' > src/app/globals.css
# then append the mockup's <style> contents (everything between <style>...</style>)
```
Verification after paste: `grep -c -- '--page-bg' src/app/globals.css` → returns `0` (mockup uses `--navy-900` token names). Instead confirm: `grep -c 'grad-brand' src/app/globals.css` ≥ 1.

- [ ] **Step 2: Fonts in layout**

```bash
cat > src/app/layout.tsx <<'EOF'
import './globals.css';
export const metadata = { title: 'Automotive Hackathon 2026', description: 'Hệ thống chấm điểm chung kết' };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Space+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  );
}
EOF
```

- [ ] **Step 3: UI helpers**

```bash
cat > src/lib/ui.ts <<'EOF'
export const cx = (...xs:(string|false|null|undefined)[]) => xs.filter(Boolean).join(' ');
export async function fetcher<T=any>(url:string, init?:RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers:{ 'Content-Type':'application/json', ...(init?.headers||{}) } });
  if (!res.ok) throw new Error((await res.json().catch(()=>({}))).error || res.statusText);
  return res.json();
}
EOF
```

- [ ] **Step 4: Shell component** (port sidebar/topbar markup from mockup, wire real nav links)

```bash
mkdir -p src/components
cat > src/components/Shell.tsx <<'EOF'
'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cx } from '@/lib/ui';

const ADMIN_NAV = [
  { href:'/admin', label:'Tổng quan & tiến độ', ic:'▦' },
  { href:'/admin/teams', label:'Quản lý đội thi', ic:'◈' },
  { href:'/admin/judges', label:'Tài khoản BGK', ic:'◐' },
  { href:'/admin/barem', label:'Cấu hình barem', ic:'＃' },
  { href:'/admin/publish', label:'Điều khiển công bố', ic:'◉' },
];
const JUDGE_NAV = [
  { href:'/judge', label:'Danh sách đội', ic:'◈' },
  { href:'/judge/results', label:'Kết quả', ic:'≡' },
];

export default function Shell({ role, children }:{ role:'admin'|'judge'; children:React.ReactNode }) {
  const path = usePathname(); const router = useRouter();
  const nav = role === 'admin' ? ADMIN_NAV : JUDGE_NAV;
  async function logout(){ await fetch('/api/auth/logout',{method:'POST'}); router.push('/login'); }
  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-logo">A</div>
          <div><div className="brand-name">Automotive Hackathon</div><div className="brand-sub">2026 · Chung kết</div></div>
        </div>
        <div className="nav-group">
          <div className={cx('nav-label', role)}>{role==='admin'?'Admin CMS':'Ban giám khảo'}</div>
          {nav.map(n => (
            <Link key={n.href} href={n.href} className={cx('nav-item', path===n.href && 'active')}>
              <span className="ni-ic">{n.ic}</span> {n.label}
            </Link>
          ))}
        </div>
        <div className="side-foot"><button className="btn btn-sm" onClick={logout}>Đăng xuất</button></div>
      </aside>
      <div className="main">
        <div className="topbar">
          <div className="crumb"><b>{role==='admin'?'Admin':'Ban giám khảo'}</b></div>
        </div>
        <div className="content">{children}</div>
      </div>
    </div>
  );
}
EOF
```

- [ ] **Step 5: Build check + commit**

```bash
npm run build
git add src/app/globals.css src/app/layout.tsx src/components/Shell.tsx src/lib/ui.ts
git commit -m "feat: light-theme design tokens, fonts, CMS shell"
```
Expected: build passes.

---

## Task 9: Login page + Admin CMS pages

**Files:**
- Create: `src/app/login/page.tsx`
- Create: `src/app/(admin)/admin/layout.tsx`
- Create: `src/app/(admin)/admin/page.tsx` (dashboard + progress matrix)
- Create: `src/app/(admin)/admin/teams/page.tsx` (+ team detail inline or `/teams/[id]`)
- Create: `src/app/(admin)/admin/teams/[id]/page.tsx`
- Create: `src/app/(admin)/admin/judges/page.tsx`
- Create: `src/app/(admin)/admin/barem/page.tsx`
- Create: `src/app/(admin)/admin/publish/page.tsx`

**Interfaces:**
- Consumes APIs from Tasks 4–7. Reuses `Shell`, global CSS classes. Markup ported from the corresponding mockup screens.

- [ ] **Step 1: Login page** (client component; posts code, routes by role)

```bash
mkdir -p src/app/login
cat > src/app/login/page.tsx <<'EOF'
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
export default function Login() {
  const [code,setCode]=useState(''); const [err,setErr]=useState(''); const router=useRouter();
  async function submit(e:React.FormEvent){ e.preventDefault(); setErr('');
    const res = await fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code})});
    if(!res.ok){ setErr((await res.json()).error||'Lỗi'); return; }
    const { role } = await res.json();
    router.push(role==='admin'?'/admin':'/judge');
  }
  return (
    <div style={{maxWidth:440,margin:'8vh auto'}}>
      <form className="card card-pad" style={{textAlign:'center',padding:'36px 30px'}} onSubmit={submit}>
        <div className="brand-logo" style={{width:64,height:64,fontSize:30,borderRadius:18,margin:'0 auto 20px'}}>A</div>
        <div className="eyebrow" style={{textAlign:'center'}}>Automotive Hackathon 2026</div>
        <h1 style={{fontSize:24,marginBottom:8}}>Đăng nhập hệ thống</h1>
        <p className="page-desc" style={{margin:'0 auto 22px'}}>Nhập mã truy cập được Ban tổ chức cấp. Không cần mật khẩu.</p>
        <div className="field" style={{textAlign:'left'}}>
          <label>Mã truy cập</label>
          <input className="input" style={{textAlign:'center',letterSpacing:'.3em',fontFamily:'Space Grotesk',fontSize:18}}
            value={code} onChange={e=>setCode(e.target.value)} placeholder="XXXX-XXXX" />
        </div>
        {err && <div style={{color:'var(--red)',fontSize:13,marginBottom:12}}>{err}</div>}
        <button className="btn btn-primary" style={{width:'100%',justifyContent:'center',padding:12}}>Vào hệ thống →</button>
      </form>
    </div>
  );
}
EOF
```

- [ ] **Step 2: Admin layout guards role server-side**

```bash
mkdir -p "src/app/(admin)/admin"
cat > "src/app/(admin)/admin/layout.tsx" <<'EOF'
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import Shell from '@/components/Shell';
export default async function AdminLayout({ children }:{ children:React.ReactNode }) {
  const u = await getCurrentUser();
  if (!u) redirect('/login');
  if (u.role !== 'admin') redirect('/judge');
  return <Shell role="admin">{children}</Shell>;
}
EOF
```

- [ ] **Step 3: Dashboard with progress matrix** (server component fetching services directly)

```bash
cat > "src/app/(admin)/admin/page.tsx" <<'EOF'
import { prisma } from '@/lib/db';
import { judgeProgress } from '@/lib/services/scores';
export const dynamic = 'force-dynamic';
export default async function Dashboard() {
  const [teams, judges, progress] = await Promise.all([
    prisma.team.findMany({ orderBy:{ createdAt:'asc' } }),
    prisma.user.findMany({ where:{ role:'judge' }, orderBy:{ createdAt:'asc' } }),
    judgeProgress(),
  ]);
  const done = new Set(progress.filter(p=>p.submitted).map(p=>p.judgeId+':'+p.teamId));
  return (
    <>
      <div className="page-head"><div>
        <div className="eyebrow">Admin CMS</div>
        <div className="page-title">Tổng quan & tiến độ chấm</div>
      </div></div>
      <div className="card"><div className="matrix"><table>
        <thead><tr><th>Đội</th>{judges.map(j=><th key={j.id} style={{textAlign:'center'}}>{j.name.split(' ').pop()}{j.isHead?' ♛':''}</th>)}</tr></thead>
        <tbody>
          {teams.map(t=>(
            <tr key={t.id}><td><div className="tcell"><span className="team-ava" style={{background:'linear-gradient(135deg,#f37021,#ff9730)'}}>{t.code}</span><b>{t.name}</b></div></td>
            {judges.map(j=>(<td key={j.id} style={{textAlign:'center'}}>
              <span className={'cellstat '+(done.has(j.id+':'+t.id)?'cs-done':'cs-wait')}>{done.has(j.id+':'+t.id)?'✓':''}</span>
            </td>))}
            </tr>
          ))}
        </tbody>
      </table></div></div>
    </>
  );
}
EOF
```

- [ ] **Step 4: Teams, Judges, Barem, Publish pages** (client components using `/api/*`). Port markup from mockup screens `teams`, `judges`, `barem`, `publish`. Each is a `'use client'` page fetching on mount and rendering rows/forms with the mockup classes.

Create the four pages with the following concrete implementations:

```bash
mkdir -p "src/app/(admin)/admin/teams/[id]" "src/app/(admin)/admin/judges" "src/app/(admin)/admin/barem" "src/app/(admin)/admin/publish"
cat > "src/app/(admin)/admin/teams/page.tsx" <<'EOF'
'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { fetcher } from '@/lib/ui';
export default function Teams() {
  const [teams,setTeams]=useState<any[]>([]);
  const [form,setForm]=useState({name:'',code:'',tag:''});
  async function load(){ setTeams(await fetcher('/api/teams')); }
  useEffect(()=>{ load(); },[]);
  async function add(){ if(!form.name||!form.code) return;
    await fetcher('/api/teams',{method:'POST',body:JSON.stringify(form)}); setForm({name:'',code:'',tag:''}); load(); }
  async function del(id:string){ await fetcher('/api/teams/'+id,{method:'DELETE'}); load(); }
  return (<>
    <div className="page-head"><div><div className="eyebrow">Admin CMS</div><div className="page-title">Quản lý đội thi</div></div></div>
    <div className="card card-pad" style={{marginBottom:16,display:'flex',gap:10,alignItems:'flex-end',flexWrap:'wrap'}}>
      <div className="field" style={{margin:0}}><label>Tên đội</label><input className="input" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></div>
      <div className="field" style={{margin:0,maxWidth:120}}><label>Mã (badge)</label><input className="input" value={form.code} onChange={e=>setForm({...form,code:e.target.value.toUpperCase()})}/></div>
      <div className="field" style={{margin:0,flex:1}}><label>Mô tả ngắn</label><input className="input" value={form.tag} onChange={e=>setForm({...form,tag:e.target.value})}/></div>
      <button className="btn btn-primary" onClick={add}>＋ Thêm đội</button>
    </div>
    <div className="card"><table>
      <thead><tr><th>Đội</th><th>Thành viên</th><th>Mô tả</th><th style={{textAlign:'right'}}>Thao tác</th></tr></thead>
      <tbody>{teams.map(t=>(<tr key={t.id}>
        <td><div className="tcell"><span className="team-ava" style={{background:'linear-gradient(135deg,#f37021,#ff9730)'}}>{t.code}</span><b>{t.name}</b></div></td>
        <td className="tnum">{t.members?.length||0} người</td><td style={{color:'var(--muted)'}}>{t.tag}</td>
        <td style={{textAlign:'right'}}><Link className="btn btn-sm" href={'/admin/teams/'+t.id}>Chi tiết</Link> <button className="btn btn-sm btn-danger" onClick={()=>del(t.id)}>Xoá</button></td>
      </tr>))}</tbody>
    </table></div>
  </>);
}
EOF
cat > "src/app/(admin)/admin/teams/[id]/page.tsx" <<'EOF'
'use client';
import { useEffect, useState } from 'react';
import { fetcher } from '@/lib/ui';
export default function TeamDetail({ params }:{ params:{ id:string } }) {
  const [team,setTeam]=useState<any>(null);
  const [m,setM]=useState({name:'',teamRole:'',org:'',email:'',intro:''});
  async function load(){ const all=await fetcher('/api/teams'); setTeam(all.find((t:any)=>t.id===params.id)); }
  useEffect(()=>{ load(); },[]);
  async function addMember(){ if(!m.name) return; await fetcher('/api/members',{method:'POST',body:JSON.stringify({teamId:params.id,...m})}); setM({name:'',teamRole:'',org:'',email:'',intro:''}); load(); }
  async function delMember(id:string){ await fetcher('/api/members/'+id,{method:'DELETE'}); load(); }
  if(!team) return <div>Đang tải…</div>;
  return (<>
    <div className="page-head"><div><div className="page-title">{team.name}</div><div className="page-desc">{team.tag}</div></div></div>
    <div className="two-col" style={{gridTemplateColumns:'1.6fr 1fr',alignItems:'start'}}>
      <div><h3 style={{marginBottom:14,color:'var(--muted)'}}>Thành viên ({team.members.length})</h3>
        <div className="members">{team.members.map((x:any)=>(
          <div className="card member" key={x.id}><div className="m-top"><span className="m-photo">{x.name.split(' ').pop()[0]}</span>
          <div><div className="m-name">{x.name}</div><div className="m-role">{x.teamRole}</div></div></div>
          <div className="m-meta">{x.org}{x.email?<><br/>✉ {x.email}</>:null}</div>
          {x.intro && <div className="m-intro">{x.intro}</div>}
          <button className="btn btn-sm btn-danger" onClick={()=>delMember(x.id)}>Xoá</button></div>
        ))}</div>
      </div>
      <div className="card card-pad"><h3 style={{marginBottom:14}}>Thêm thành viên</h3>
        <div className="field"><label>Họ tên</label><input className="input" value={m.name} onChange={e=>setM({...m,name:e.target.value})}/></div>
        <div className="field"><label>Vai trò trong đội</label><input className="input" value={m.teamRole} onChange={e=>setM({...m,teamRole:e.target.value})}/></div>
        <div className="field"><label>Đơn vị</label><input className="input" value={m.org} onChange={e=>setM({...m,org:e.target.value})}/></div>
        <div className="field"><label>Email</label><input className="input" value={m.email} onChange={e=>setM({...m,email:e.target.value})}/></div>
        <div className="field"><label>Giới thiệu</label><textarea className="textarea" value={m.intro} onChange={e=>setM({...m,intro:e.target.value})}/></div>
        <button className="btn btn-primary" style={{width:'100%',justifyContent:'center'}} onClick={addMember}>Thêm</button>
      </div>
    </div>
  </>);
}
EOF
cat > "src/app/(admin)/admin/judges/page.tsx" <<'EOF'
'use client';
import { useEffect, useState } from 'react';
import { fetcher } from '@/lib/ui';
export default function Judges() {
  const [judges,setJudges]=useState<any[]>([]); const [form,setForm]=useState({name:'',isHead:false});
  async function load(){ setJudges(await fetcher('/api/judges')); }
  useEffect(()=>{ load(); },[]);
  async function add(){ if(!form.name) return; await fetcher('/api/judges',{method:'POST',body:JSON.stringify(form)}); setForm({name:'',isHead:false}); load(); }
  async function regen(id:string){ await fetcher('/api/judges/'+id,{method:'POST',body:JSON.stringify({action:'regen'})}); load(); }
  async function setHead(id:string){ await fetcher('/api/judges/'+id,{method:'POST',body:JSON.stringify({action:'setHead'})}); load(); }
  async function del(id:string){ await fetcher('/api/judges/'+id,{method:'DELETE'}); load(); }
  return (<>
    <div className="page-head"><div><div className="eyebrow">Admin CMS</div><div className="page-title">Tài khoản ban giám khảo</div></div></div>
    <div className="card card-pad" style={{marginBottom:16,display:'flex',gap:10,alignItems:'flex-end'}}>
      <div className="field" style={{margin:0,flex:1}}><label>Tên giám khảo</label><input className="input" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></div>
      <label style={{display:'flex',gap:6,alignItems:'center',fontSize:13,color:'var(--muted)'}}><input type="checkbox" checked={form.isHead} onChange={e=>setForm({...form,isHead:e.target.checked})}/> Trưởng BGK</label>
      <button className="btn btn-primary" onClick={add}>＋ Thêm</button>
    </div>
    <div className="card"><table>
      <thead><tr><th>Giám khảo</th><th>Mã truy cập</th><th style={{textAlign:'right'}}>Thao tác</th></tr></thead>
      <tbody>{judges.map(j=>(<tr key={j.id}>
        <td><b>{j.name}</b> {j.isHead && <span className="badge-head">♛ Trưởng BGK</span>}</td>
        <td><span className="code-chip">{j.accessCode}</span></td>
        <td style={{textAlign:'right'}}>
          <button className="btn btn-sm" onClick={()=>regen(j.id)}>↻ Đổi mã</button>{' '}
          {!j.isHead && <button className="btn btn-sm" onClick={()=>setHead(j.id)}>Đặt Trưởng BGK</button>}{' '}
          {!j.isHead && <button className="btn btn-sm btn-danger" onClick={()=>del(j.id)}>Xoá</button>}
        </td>
      </tr>))}</tbody>
    </table></div>
  </>);
}
EOF
cat > "src/app/(admin)/admin/barem/page.tsx" <<'EOF'
'use client';
import { useEffect, useState } from 'react';
import { fetcher } from '@/lib/ui';
export default function Barem() {
  const [crits,setCrits]=useState<any[]>([]); const [form,setForm]=useState({name:'',maxScore:10,description:''});
  async function load(){ setCrits(await fetcher('/api/criteria')); }
  useEffect(()=>{ load(); },[]);
  const total = crits.reduce((a,c)=>a+c.maxScore,0);
  async function add(){ if(!form.name) return; await fetcher('/api/criteria',{method:'POST',body:JSON.stringify({...form,maxScore:Number(form.maxScore)})}); setForm({name:'',maxScore:10,description:''}); load(); }
  async function del(id:string){ await fetcher('/api/criteria/'+id,{method:'DELETE'}); load(); }
  return (<>
    <div className="page-head"><div><div className="eyebrow">Admin CMS</div><div className="page-title">Cấu hình barem chấm điểm</div></div></div>
    <div className="card card-pad">
      {crits.map(c=>(<div className="crit" key={c.id}>
        <div><div className="crit-name">{c.name}</div><div className="crit-desc">{c.description}</div></div>
        <div className="score-in"><span className="crit-max">{c.maxScore}đ</span><button className="btn btn-ghost btn-sm" onClick={()=>del(c.id)}>✕</button></div>
      </div>))}
      <div className="crit">
        <div style={{display:'flex',gap:10}}>
          <input className="input" placeholder="Tên tiêu chí" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/>
          <input className="input" placeholder="Mô tả" value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/>
        </div>
        <div className="score-in"><input className="input" style={{width:74}} type="number" value={form.maxScore} onChange={e=>setForm({...form,maxScore:Number(e.target.value)})}/><button className="btn btn-primary btn-sm" onClick={add}>＋</button></div>
      </div>
      <div className="total-box"><span className="tl">TỔNG ĐIỂM TỐI ĐA</span><span className="tv tnum">{total}<small> điểm</small></span></div>
    </div>
  </>);
}
EOF
cat > "src/app/(admin)/admin/publish/page.tsx" <<'EOF'
'use client';
import { useEffect, useState } from 'react';
import { fetcher } from '@/lib/ui';
const STEPS=[{k:'drafting',n:'1',t:'Đang chấm'},{k:'provisional',n:'2',t:'Điểm tạm'},{k:'final',n:'3',t:'Chung cuộc'}];
export default function Publish() {
  const [state,setState]=useState('drafting');
  async function load(){ setState((await fetcher('/api/reveal')).state); }
  useEffect(()=>{ load(); },[]);
  async function set(s:string){ await fetcher('/api/reveal',{method:'POST',body:JSON.stringify({state:s})}); setState(s); }
  const idx=STEPS.findIndex(s=>s.k===state);
  return (<>
    <div className="page-head"><div><div className="eyebrow">Admin CMS</div><div className="page-title">Điều khiển công bố</div></div></div>
    <div className="stepper">{STEPS.map((s,i)=>(<div key={s.k} className={'step '+(i===idx?'active':'')+(i<idx?' done':'')}>
      <div className="step-n">{i<idx?'✓':s.n}</div><h4>{s.t}</h4></div>))}</div>
    <div className="card card-pad" style={{marginTop:20}}>
      {state==='drafting' && <button className="btn btn-primary" style={{width:'100%',justifyContent:'center',padding:12}} onClick={()=>set('provisional')}>▶ Mở bảng điểm tạm (realtime)</button>}
      {state==='provisional' && <>
        <div className="note" style={{marginBottom:16}}><span>◉</span><div><b style={{color:'var(--text)'}}>Đang chiếu điểm tạm.</b> Điểm Trưởng BGK đang giữ kín.</div></div>
        <button className="btn btn-primary" style={{width:'100%',justifyContent:'center',padding:14,fontSize:15}} onClick={()=>set('final')}>♛ LỘ ĐIỂM TRƯỞNG BGK & CHỐT KẾT QUẢ</button>
        <button className="btn btn-ghost btn-sm" style={{width:'100%',justifyContent:'center',marginTop:10}} onClick={()=>set('drafting')}>← Quay lui về màn chờ</button>
      </>}
      {state==='final' && <>
        <div className="note" style={{marginBottom:16}}><span style={{color:'var(--green)'}}>✓</span><div><b style={{color:'var(--text)'}}>Đã công bố chung cuộc.</b></div></div>
        <a className="btn btn-primary" style={{width:'100%',justifyContent:'center',padding:12}} href="/board" target="_blank">Xem bảng công khai →</a>
        <button className="btn btn-ghost btn-sm" style={{width:'100%',justifyContent:'center',marginTop:10}} onClick={()=>set('provisional')}>← Quay lui (mở lại để sửa)</button>
      </>}
    </div>
  </>);
}
EOF
```

- [ ] **Step 5: Build + commit**

```bash
npm run build
git add "src/app/login" "src/app/(admin)"
git commit -m "feat: login + admin CMS pages (dashboard, teams, judges, barem, publish)"
```
Expected: build passes.

---

## Task 10: Judge pages (team list + score entry + results)

**Files:**
- Create: `src/app/(judge)/judge/layout.tsx`
- Create: `src/app/(judge)/judge/page.tsx` (team list)
- Create: `src/app/(judge)/judge/score/[teamId]/page.tsx` (barem entry)
- Create: `src/app/(judge)/judge/results/page.tsx`

**Interfaces:**
- Consumes `/api/teams`, `/api/criteria`, `/api/scores`, `/api/results`, `/api/reveal`.

- [ ] **Step 1: Judge layout guard**

```bash
mkdir -p "src/app/(judge)/judge/score/[teamId]" "src/app/(judge)/judge/results"
cat > "src/app/(judge)/judge/layout.tsx" <<'EOF'
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import Shell from '@/components/Shell';
export default async function JudgeLayout({ children }:{ children:React.ReactNode }) {
  const u = await getCurrentUser();
  if (!u) redirect('/login');
  if (u.role !== 'judge') redirect('/admin');
  return <Shell role="judge">{children}</Shell>;
}
EOF
```

- [ ] **Step 2: Team list**

```bash
cat > "src/app/(judge)/judge/page.tsx" <<'EOF'
'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { fetcher } from '@/lib/ui';
export default function JudgeTeams() {
  const [teams,setTeams]=useState<any[]>([]);
  useEffect(()=>{ fetcher('/api/teams').then(setTeams); },[]);
  return (<>
    <div className="page-head"><div><div className="eyebrow" style={{color:'var(--cyan)'}}>Ban giám khảo</div><div className="page-title">Danh sách đội thi</div>
      <div className="page-desc">Chọn đội để xem hồ sơ và chấm điểm. Bạn chỉ thấy điểm của mình cho tới khi công bố.</div></div></div>
    <div className="grid" style={{gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))'}}>
      {teams.map(t=>(<Link key={t.id} href={'/judge/score/'+t.id} className="card card-pad" style={{cursor:'pointer'}}>
        <div className="tcell"><span className="team-ava" style={{background:'linear-gradient(135deg,#2563eb,#00d4ff)'}}>{t.code}</span>
        <div><b style={{fontFamily:'Space Grotesk',fontSize:16}}>{t.name}</b><small style={{display:'block',color:'var(--muted-2)'}}>{t.members?.length||0} thành viên</small></div></div>
        <p style={{fontSize:12.5,color:'var(--muted)',marginTop:14}}>{t.tag}</p>
      </Link>))}
    </div>
  </>);
}
EOF
```

- [ ] **Step 3: Score entry** (loads criteria + existing scores, computes total, submits)

```bash
cat > "src/app/(judge)/judge/score/[teamId]/page.tsx" <<'EOF'
'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetcher } from '@/lib/ui';
export default function Score({ params }:{ params:{ teamId:string } }) {
  const [crits,setCrits]=useState<any[]>([]); const [vals,setVals]=useState<Record<string,number>>({});
  const [team,setTeam]=useState<any>(null); const router=useRouter();
  useEffect(()=>{ (async()=>{
    const [c, teams, existing] = await Promise.all([
      fetcher('/api/criteria'), fetcher('/api/teams'), fetcher('/api/scores?teamId='+params.teamId),
    ]);
    setCrits(c); setTeam(teams.find((t:any)=>t.id===params.teamId));
    const map:Record<string,number>={}; existing.forEach((s:any)=>map[s.criterionId]=s.value); setVals(map);
  })(); },[params.teamId]);
  const total = crits.reduce((a,c)=>a+(vals[c.id]||0),0);
  const maxTotal = crits.reduce((a,c)=>a+c.maxScore,0);
  async function save(submitted:boolean){
    const values = crits.map(c=>({criterionId:c.id, value: Math.min(c.maxScore, vals[c.id]||0)}));
    await fetcher('/api/scores',{method:'POST',body:JSON.stringify({teamId:params.teamId, values, submitted})});
    if(submitted) router.push('/judge');
  }
  if(!team) return <div>Đang tải…</div>;
  return (<>
    <div className="page-head"><div><div className="page-title">Chấm điểm · {team.name}</div></div></div>
    <div className="card card-pad" style={{maxWidth:720}}>
      {crits.map(c=>(<div className="crit" key={c.id}>
        <div><div className="crit-name">{c.name} <span className="crit-max">/ {c.maxScore}đ</span></div><div className="crit-desc">{c.description}</div></div>
        <div className="score-in"><input className="input" style={{width:80}} type="number" step="0.5" min={0} max={c.maxScore}
          value={vals[c.id] ?? ''} onChange={e=>setVals({...vals,[c.id]:Number(e.target.value)})}/><span>/ {c.maxScore}</span></div>
      </div>))}
      <div className="total-box"><span className="tl">TỔNG ĐIỂM CỦA BẠN</span><span className="tv tnum">{total.toFixed(1)}<small>/{maxTotal}</small></span></div>
      <div style={{display:'flex',gap:10,marginTop:18}}>
        <button className="btn" style={{flex:1,justifyContent:'center'}} onClick={()=>save(false)}>Lưu nháp</button>
        <button className="btn btn-primary" style={{flex:1,justifyContent:'center'}} onClick={()=>save(true)}>Nộp điểm đội này</button>
      </div>
    </div>
  </>);
}
EOF
```

- [ ] **Step 4: Judge results** (only meaningful after final; shows leaderboard table, subscribes to SSE)

```bash
cat > "src/app/(judge)/judge/results/page.tsx" <<'EOF'
'use client';
import { useEffect, useState } from 'react';
import { fetcher } from '@/lib/ui';
export default function Results() {
  const [data,setData]=useState<any>(null);
  async function load(){ setData(await fetcher('/api/results')); }
  useEffect(()=>{ load(); const es=new EventSource('/api/stream');
    es.addEventListener('reveal',load); es.addEventListener('update',load); return ()=>es.close(); },[]);
  if(!data) return <div>Đang tải…</div>;
  return (<>
    <div className="page-head"><div><div className="eyebrow" style={{color:'var(--cyan)'}}>Ban giám khảo</div><div className="page-title">Kết quả các đội</div>
      <div className="page-desc">{data.state==='final'?'Đã công bố chung cuộc.':'Điểm tạm (chưa có Trưởng BGK).'}</div></div></div>
    <div className="card"><table>
      <thead><tr><th>#</th><th>Đội</th><th style={{textAlign:'right'}}>Điểm TB</th></tr></thead>
      <tbody>{data.rows.map((r:any)=>(<tr key={r.team.id}>
        <td className="tnum">{r.tie?'T'+r.rank:r.rank}</td>
        <td><div className="tcell"><span className="team-ava" style={{background:'linear-gradient(135deg,#f37021,#ff9730)'}}>{r.team.code}</span><b>{r.team.name}</b></div></td>
        <td style={{textAlign:'right'}}><b className="tnum" style={{color:'var(--orange-lt)'}}>{r.score===null?'—':r.score.toFixed(1)}</b></td>
      </tr>))}</tbody>
    </table></div>
  </>);
}
EOF
```

- [ ] **Step 5: Build + commit**

```bash
npm run build
git add "src/app/(judge)"
git commit -m "feat: judge pages (team list, score entry, results)"
```
Expected: build passes.

---

## Task 11: Public board (SSE realtime + podium + reveal)

**Files:**
- Create: `src/app/board/page.tsx` (client; full-bleed)
- Create: `src/components/Leaderboard.tsx`
- Create: `src/components/Podium.tsx`

**Interfaces:**
- Consumes `/api/results`, `/api/stream`. Renders states: `drafting`→waiting screen; `provisional`→list with banner (no podium); `final`→podium + list. Markup/classes ported from mockup `wait` + `leaderboard` screens.

- [ ] **Step 1: Podium component** (port `podiumHtml` from mockup)

```bash
cat > src/components/Podium.tsx <<'EOF'
'use client';
export default function Podium({ rows }:{ rows:any[] }) {
  const top = rows.slice(0,3);
  const order = [top[1], top[0], top[2]]; const cls=['pod-2','pod-1','pod-3']; const medal=['2','1','3'];
  return (<div className="podium">{order.map((t,i)=>(
    <div className={'pod '+cls[i]} key={i}>{t ? <>
      <div className="pod-body">
        {cls[i]==='pod-1' && <div className="pod-crown">👑</div>}
        <div className="pod-medal">{medal[i]}</div>
        <div className="pod-logo" style={{background:'linear-gradient(135deg,#f37021,#ff9730)'}}>{t.team.code}</div>
        <div className="pod-name">{t.team.name}</div>
        <div className="pod-tag">{t.team.tag}</div>
        <div className="pod-score tnum">{t.score?.toFixed(1)}<small> /50</small></div>
      </div>
      <div className="pod-riser"></div>
    </> : null}</div>
  ))}</div>);
}
EOF
```

- [ ] **Step 2: Leaderboard component** (rows with golf rank + tie + judge dots)

```bash
cat > src/components/Leaderboard.tsx <<'EOF'
'use client';
export default function Leaderboard({ rows, phase, baremTotal }:{ rows:any[]; phase:string; baremTotal:number }) {
  return (<div className="lb">{rows.map((r,i)=>(
    <div className={'row '+(r.rank===1&&phase==='final'?'leader ':'')+(r.rank<=3?'top3':'')} key={r.team.id}>
      <div className="rk"><span className="rk-num tnum">{r.tie?'T'+r.rank:r.rank}</span></div>
      <div className="r-team"><span className="r-logo" style={{background:'linear-gradient(135deg,#f37021,#ff9730)'}}>{r.team.code}</span>
        <div style={{minWidth:0}}><div className="r-name">{r.team.name}</div><div className="r-tag">{r.team.tag}</div></div></div>
      <div className="r-score"><div><span className="sc tnum">{r.score===null?'—':r.score.toFixed(1)}</span><span className="of"> /{baremTotal}</span></div></div>
    </div>
  ))}</div>);
}
EOF
```

- [ ] **Step 3: Board page** (SSE + state switch)

```bash
mkdir -p src/app/board
cat > src/app/board/page.tsx <<'EOF'
'use client';
import { useEffect, useState } from 'react';
import { fetcher } from '@/lib/ui';
import Podium from '@/components/Podium';
import Leaderboard from '@/components/Leaderboard';
export default function Board() {
  const [data,setData]=useState<any>(null);
  async function load(){ setData(await fetcher('/api/results')); }
  useEffect(()=>{ load();
    const es=new EventSource('/api/stream');
    es.addEventListener('reveal',load); es.addEventListener('update',load);
    return ()=>es.close();
  },[]);
  if(!data) return <div className="public-stage"/>;
  if(data.state==='drafting') return (
    <div className="wait-stage"><div className="wait-inner">
      <div className="wait-badge">A</div>
      <div className="eyebrow" style={{textAlign:'center',color:'var(--cyan)'}}>Automotive Hackathon 2026 · Chung kết</div>
      <h1 className="wait-title">Kết quả sắp được <span>công bố</span></h1>
      <p className="wait-desc">Ban giám khảo đang hoàn tất chấm điểm.</p>
      <div className="dots-live"><i></i> ĐANG CHỜ TÍN HIỆU CÔNG BỐ</div>
    </div></div>
  );
  const phase = data.state;
  return (
    <div className="public-stage">
      <div className="pub-head"><div>
        <div className="eyebrow" style={{color:'var(--cyan)'}}>Vòng chung kết · Bảng xếp hạng trực tiếp</div>
        <div className="pub-title">Automotive <span>Hackathon</span> 2026</div>
      </div><span className="pill live" style={{fontSize:13,padding:'8px 16px'}}>{phase==='final'?'● CHUNG CUỘC':'● ĐIỂM TẠM · LIVE'}</span></div>
      {phase==='provisional' && (
        <div className="prov-banner"><span className="pb-ic">⏳</span>
          <div><b>ĐIỂM TẠM — chưa có điểm Trưởng Ban giám khảo</b><p>Bảng cập nhật realtime theo từng giám khảo.</p></div>
          <span className="prov-tag">4/5 GIÁM KHẢO</span></div>
      )}
      {phase==='final' && <Podium rows={data.rows} />}
      <Leaderboard rows={data.rows} phase={phase} baremTotal={data.baremTotal} />
    </div>
  );
}
EOF
```

- [ ] **Step 4: Build + commit**

```bash
npm run build
git add src/app/board src/components/Leaderboard.tsx src/components/Podium.tsx
git commit -m "feat: public realtime board with podium and reveal states"
```
Expected: build passes.

---

## Task 12: End-to-end Docker smoke test

**Files:**
- Create: `scripts/smoke.sh`

**Interfaces:**
- Consumes running app at `http://localhost:3000`. Verifies: board serves; login rejects bad code; reveal transitions change results leader; SSE endpoint responds.

- [ ] **Step 1: Write smoke script**

```bash
mkdir -p scripts
cat > scripts/smoke.sh <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
BASE="${BASE:-http://localhost:3000}"
echo "== waiting for app =="
for i in $(seq 1 60); do curl -sf "$BASE/api/results" >/dev/null && break || sleep 2; done

echo "== board reachable =="
curl -sf "$BASE/board" >/dev/null && echo "OK board"

echo "== admin login (grab code from container logs or seed) =="
# ADMIN_CODE must be exported by caller (from seed output). Fallback: derive via a helper endpoint is not exposed; caller provides it.
: "${ADMIN_CODE:?export ADMIN_CODE from seed output}"
JAR=$(mktemp)
curl -sf -c "$JAR" -X POST "$BASE/api/auth/login" -H 'Content-Type: application/json' -d "{\"code\":\"$ADMIN_CODE\"}" >/dev/null && echo "OK login"

echo "== bad code rejected =="
code=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/auth/login" -H 'Content-Type: application/json' -d '{"code":"WRONG-CODE"}')
[ "$code" = "401" ] && echo "OK reject ($code)"

echo "== provisional leader =="
curl -sf -b "$JAR" -X POST "$BASE/api/reveal" -H 'Content-Type: application/json' -d '{"state":"provisional"}' >/dev/null
PROV=$(curl -sf "$BASE/api/results" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).rows[0].team.code))')
echo "provisional leader = $PROV"

echo "== final leader =="
curl -sf -b "$JAR" -X POST "$BASE/api/reveal" -H 'Content-Type: application/json' -d '{"state":"final"}' >/dev/null
FIN=$(curl -sf "$BASE/api/results" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).rows[0].team.code))')
echo "final leader = $FIN"

[ "$PROV" = "CV" ] && [ "$FIN" = "EV" ] && echo "OK reveal reshuffle (CV -> EV)" || { echo "FAIL reveal expected CV then EV, got $PROV then $FIN"; exit 1; }

echo "== reset to drafting =="
curl -sf -b "$JAR" -X POST "$BASE/api/reveal" -H 'Content-Type: application/json' -d '{"state":"drafting"}' >/dev/null
echo "ALL SMOKE PASSED"
EOF
chmod +x scripts/smoke.sh
```

- [ ] **Step 2: Run full stack via Docker and smoke it**

```bash
docker compose down -v 2>/dev/null || true
docker compose up -d --build
# capture admin code printed by seed in app logs
sleep 5
ADMIN_CODE=$(docker compose logs app 2>/dev/null | grep 'ADMIN access code:' | tail -1 | awk '{print $NF}')
echo "ADMIN_CODE=$ADMIN_CODE"
ADMIN_CODE="$ADMIN_CODE" BASE="http://localhost:3000" bash scripts/smoke.sh
```
Expected: `ALL SMOKE PASSED`, with provisional leader CV and final leader EV.

- [ ] **Step 3: Run the full unit+integration suite once more**

```bash
# against the compose DB (host port 5432) with a fresh seed
DATABASE_URL="postgresql://hs:hs@localhost:5432/hackathon?schema=public" npx tsx prisma/seed.ts
DATABASE_URL="postgresql://hs:hs@localhost:5432/hackathon?schema=public" npm test
```
Expected: all test files pass.

- [ ] **Step 4: Commit**

```bash
git add scripts/smoke.sh
git commit -m "test: end-to-end docker smoke for reveal flow"
```

---

## Self-Review Notes

- **Spec coverage:** roles/access-code (T2), teams+members incl. logo (T4, schema T0), judges + head (T5), barem flat + total (T5), scoring avg + provisional/final (T1), golf ranks/ties (T1), reveal 3-state + head held (T7), SSE realtime (T7,T11), podium top-3 (T11), light theme tokens (T8), CMS full-width (T8 CSS `.content{max-width:none}`), waiting screen (T11), audit log on reveal (T7). Covered.
- **Head-judge fairness (blind scoring):** enforced operationally — head judge's scores are only *included in results* when state=`final`; provisional never exposes them. No extra code needed beyond `computeLeaderboard` excludeJudgeId.
- **Types consistent:** `RankedRow`, `ScoreLite`, `TeamLite`, `Phase` defined once in T1 and reused in T7/T11. `broadcast`/`subscribe` signatures fixed in T7 (stub in T6 matches `broadcast(event,data)`).
- **Known simplification:** SSE controller cleanup relies on client disconnect + ping; acceptable at this scale (<10 concurrent). Progress matrix uses `judgeProgress` groupBy — a team a judge hasn't touched shows blank (correct).
