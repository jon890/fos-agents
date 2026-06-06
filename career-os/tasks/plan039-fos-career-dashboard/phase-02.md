# Phase 02 — Next.js 읽기 전용 대시보드 MVP 라우트 및 career-os 파일 어댑터

**Model**: sonnet
**Status**: pending

---

## 목표

career-os 파일을 읽기 전용으로 읽는 서버 사이드 어댑터를 구현하고, frontdoor queue·ledger·position recommendation을 표시하는 MVP 라우트를 만든다.

**범위 외**: 관리자 인증, MySQL 연결, LLM 채팅, Docker 설정은 다음 phase에서 한다.
이 phase의 라우트는 인증 미들웨어 없이 로컬 개발 환경에서만 접근한다.
career-os 파일을 수정하는 코드를 추가하지 않는다.

---

## 사전 cwd 설정

```bash
cd "$(git rev-parse --show-toplevel)"
pwd  # 기대: /home/bifos/ai-nodes
```

---

## 관련 docs

실행 전 반드시 읽는다.

- `career-os/docs/adr.md` — ADR-046
- `career-os/docs/data-schema.md` — frontdoor-queue.jsonl 스키마, ledger.jsonl 스키마
- `career-os/docs/code-architecture.md` — Planned: fos-career 웹 대시보드 섹션

---

## 작업 항목

### 1. career-os 파일 어댑터 (`lib/career-os/adapter.ts`)

`~/services/fos-career/lib/career-os/adapter.ts`를 작성한다.

핵심 규칙:

- `CAREER_OS_ROOT` 환경 변수에서 루트 경로를 읽는다.
- 미설정 시 로컬 기본값 `${process.env.HOME}/ai-nodes/career-os`를 사용한다.
- **읽기 전용 함수만 export한다. 쓰기 함수 없음.**
- 파일이 없으면 빈 배열 또는 빈 문자열을 반환한다. 예외를 throw하지 않는다.

export할 함수:

- `getFrontdoorQueue(): Promise<FrontdoorQueueRecord[]>` — `data/runtime/application-agent/frontdoor-queue.jsonl` 파싱
- `getLedger(): Promise<LedgerRecord[]>` — `data/applications/ledger.jsonl` 파싱
- `getPositionRecommendation(): Promise<string>` — `data/runtime/position-recommendation.md` 전체 텍스트
- `getCandidateProfile(): Promise<string>` — `config/candidate-profile.md` 전체 텍스트

JSONL 파싱 규칙: 한 줄씩 `JSON.parse` 시도. 빈 줄이나 파싱 실패 줄은 건너뛴다.

### 2. career-os TypeScript 타입 (`lib/career-os/types.ts`)

`~/services/fos-career/lib/career-os/types.ts`를 작성한다.

`FrontdoorQueueRecord` 최소 필수 필드 (career-os/docs/data-schema.md 기준):

```typescript
export interface FrontdoorQueueRecord {
  queueId: string
  rank: number
  company: string
  role: string
  trackLabel: string
  source: string
  url: string
  status: 'collected' | 'shortlisted' | 'needs_user_start_approval' | 'start_approved' | 'promoted_to_ledger' | 'rejected' | 'expired'
  fitScore?: number
  recommendationTier?: string
  sourceFreshness?: string
  selectedAt?: string | null
  promotedApplicationId?: string | null
  decisionReason?: string
  nextActions?: string[]
}
```

`LedgerRecord` 최소 필수 필드 (career-os/docs/data-schema.md 기준):

```typescript
export interface LedgerRecord {
  id: string
  company: string
  role: string
  source: string
  url: string
  status: string
  statusUpdatedAt: string
  applicationDir: string
  riskFlags?: string[]
  nextActions?: string[]
  discoveredAt?: string
  postingPath?: string
  fitAnalysisPath?: string
  applicationPackagePath?: string
  reviewPath?: string
  userDecision?: string
  notes?: string
}
```

### 3. 홈 페이지 (`app/page.tsx`)

서버 컴포넌트. 어댑터로 데이터를 읽어 요약을 표시한다.

표시 항목:

- 오늘 날짜 (서버 사이드에서 읽음)
- frontdoor queue 요약: `needs_user_start_approval` 상태 count
- ledger 요약: 진행 중인 application count (status: analyzing, preparing_application, needs_revision, ready_for_user_review)
- position recommendation 첫 200자 요약
- 각 섹션에서 `/dashboard/positions`, `/dashboard/applications`, `/dashboard/chat`로 이동하는 링크

### 4. Positions 페이지 (`app/dashboard/positions/page.tsx`)

서버 컴포넌트. frontdoor queue 전체 목록을 테이블로 표시한다.

컬럼: rank, company, role, trackLabel, status, fitScore, recommendationTier.
상태별 Tailwind 색상:

- `needs_user_start_approval`: 노란색
- `start_approved`: 초록색
- `promoted_to_ledger`: 파란색
- `rejected` / `expired`: 회색

### 5. Applications 페이지 (`app/dashboard/applications/page.tsx`)

서버 컴포넌트. ledger.jsonl 목록을 테이블로 표시한다.

컬럼: company, role, status, discoveredAt, nextActions (최대 2개 표시).
각 행은 `/dashboard/applications/[id]`로 이동하는 링크.

### 6. Application 상세 페이지 (`app/dashboard/applications/[id]/page.tsx`)

서버 컴포넌트.

- `id` param으로 ledger record를 찾는다. 없으면 404 반환.
- 모든 필드를 key-value 목록으로 표시한다.
- `postingPath`, `fitAnalysisPath`, `applicationPackagePath`가 있으면 해당 파일 내용도 어댑터로 읽어 표시한다.
  - 어댑터에 `readCareerOsFile(relativePath: string): Promise<string>` 함수를 추가해 임의 경로를 읽도록 한다.
  - 보안: `relativePath`가 `CAREER_OS_ROOT` 밖을 가리키면 빈 문자열을 반환한다 (경로 탈출 방지).

---

## 검증

보고 직전 반드시 실행한다.

```bash
cd ~/services/fos-career

# TypeScript 타입 확인
pnpm tsc --noEmit

# 파일 존재 확인
ls lib/career-os/adapter.ts
ls lib/career-os/types.ts
ls app/page.tsx
ls app/dashboard/positions/page.tsx
ls app/dashboard/applications/page.tsx
ls "app/dashboard/applications/[id]/page.tsx"

# 안전 경계: adapter에 쓰기 함수 없음 확인
grep -n "writeFile\|appendFile\|fs\.write\|createWriteStream" lib/career-os/adapter.ts \
  && echo "PHASE_FAILED: write operation found in adapter" \
  || echo "OK: adapter is read-only"
```

## Blocked 조건

- phase-01이 완료되지 않아 `~/services/fos-career/package.json`이 없으면 `PHASE_BLOCKED: phase-01 not complete`를 출력하고 exit 2.
- `pnpm tsc --noEmit`이 에러를 반환하면 `PHASE_FAILED: TypeScript type check failed`를 출력하고 exit 1.
- career-os 어댑터에 쓰기 함수가 포함되면 `PHASE_FAILED: adapter must be read-only`를 출력하고 exit 1.
