# Phase 05 — 카드 클릭 지원 시작 transaction

**Model**: sonnet
**Status**: completed

---

## 목표

지원 후보 카드 전체 클릭을 내부 `지원 시작` workflow로 연결하고, DB transaction 안에서 state transition과 outbox job 생성을 idempotent하게 처리한다.

**범위 외**: worker 실행, 회사/공고/fit 분석 실제 수행, legacy cleanup, career-os docs/ADR 수정.

---

## 사전 cwd 설정

```bash
cd "$(git rev-parse --show-toplevel)"
pwd  # 기대: /home/bifos/ai-nodes
```

---

## 관련 docs

실행 전 반드시 읽는다.

- `career-os/docs/adr.md`의 ADR-081
- `career-os/docs/flow.md`의 Application Candidate State outbox worker
- `career-os/docs/data-schema.md`의 `application_candidate_states`, `career_outbox_jobs`
- `/home/bifos/services/fos-career/app/api/applications/actions/route.ts`
- `/home/bifos/services/fos-career/app/dashboard/reports/position/[date]/page.tsx`
- `/home/bifos/services/fos-career/db/schema.ts`

---

## 작업 항목

### 1. start workflow API 추가

지원 후보 candidate id를 받아 `user.start_application` transition을 수행하는 route 또는 server action을 만든다.
외부 제출, 업로드, 로그인, 공개 발행은 어떤 payload에도 포함하지 않는다.

### 2. transaction과 idempotency guard

하나의 DB transaction에서 다음을 함께 처리한다.

- `application_candidate_states.currentState`를 `started`로 변경.
- `currentStage`를 첫 실행 묶음의 시작 stage로 설정.
- `career_outbox_jobs`에 `application.start` job 생성.
- 같은 candidate에 이미 started 상태 또는 동일 idempotency key job이 있으면 중복 생성하지 않음.

### 3. dashboard 카드 연결

recommended 카드 전체 클릭 또는 명확한 버튼으로 `지원 시작`을 요청한다.
held, excluded, started, closed는 다시 클릭할 수 없게 한다.

### 4. audit log 추가

관리자 action과 request 결과를 `audit_logs` 또는 기존 action history 패턴에 남긴다.
민감한 private 본문은 저장하지 않는다.

### 5. phase commit

API/action, dashboard 연결, 필요한 helper만 stage하고 commit한다.

---

## Critical Files

| 파일 | 변경 |
|---|---|
| `/home/bifos/services/fos-career/app/api/applications/*` | 지원 시작 API 추가 또는 확장 |
| `/home/bifos/services/fos-career/app/dashboard/reports/position/[date]/page.tsx` | 카드 클릭 연결 |
| `/home/bifos/services/fos-career/lib/*` | transition/helper 추가 |
| `/home/bifos/services/fos-career/db/schema.ts` | 필요한 import/type 보강만 |

---

## 검증

보고 직전 반드시 아래 bash 블록을 실행하고 raw 값을 출력한다.

```bash
cd "$(git rev-parse --show-toplevel)"
cd /home/bifos/services/fos-career

pnpm exec tsc --noEmit
pnpm build
rg -n "application.start|user.start_application|idempotencyKey|지원 시작|external|upload|login" app lib scripts
git diff --check
git status --short
```

가능하면 DB fixture로 card click smoke를 실행한다.

```bash
cd /home/bifos/services/fos-career
pnpm run smoke:start-application -- --dry-run
```

---

## 성공 기준

- `recommended` 지원 후보에서만 `지원 시작` 요청이 가능하다.
- transaction 안에서 state transition과 outbox job 생성이 함께 처리된다.
- 중복 클릭이 동일 candidate에 중복 job을 만들지 않는다.
- `career_outbox_jobs` payload는 worker 입력에 필요한 요약만 담고 private 본문을 저장하지 않는다.
- `pnpm exec tsc --noEmit`와 `pnpm build`가 통과한다.

---

## PHASE_BLOCKED

다음 경우에는 반드시 Bash 도구로 직접 `echo 'PHASE_BLOCKED: ...' && exit 2`를 실행한다.

- start transition의 정확한 `currentStage` sentinel 또는 초기 stage 결정이 docs와 다르다.
- 기존 auth/session boundary 때문에 action route 설계 결정이 추가로 필요하다.
- idempotency key 구성에 새 정책 결정이 필요하다.
- 구현 중 career-os docs/ADR 수정 필요가 드러난다.

## PHASE_FAILED

다음 경우에는 반드시 Bash 도구로 직접 `echo 'PHASE_FAILED: ...' && exit 1`를 실행한다.

- DB transaction 없이 state와 outbox를 따로 갱신하는 경우.
- started/excluded/held 후보를 다시 클릭 가능하게 둔 경우.
- 외부 제출, 업로드, 로그인, 공개 발행을 job으로 만들 경우.
- 검증 명령을 실행하지 못한 경우.

---

## common-pitfalls self-check

- [x] 성공 기준은 `pnpm`, `rg`, smoke command로 판정 가능하다.
- [x] HTML report나 legacy queue를 action source로 쓰지 않는다.
- [x] docs/ADR 수정은 범위 밖이다.
- [x] idempotency guard를 검증한다.
- [x] 첫 bash 블록에서 ai-nodes 루트로 이동한다.

---

## 완료 기록

- 완료 시각: 2026-06-14T16:09:33Z
- fos-career commit: `78baeb8 feat(fos-career): 지원 시작 transaction 추가`
- 변경 요약:
  - `/api/applications/start`와 `startApplicationForCandidate` transaction helper를 추가했다.
  - `recommended` 후보만 내부 `지원 시작` 요청이 가능하며, `started`, `held`, `excluded`, `closed`는 다시 시작할 수 없다.
  - 하나의 DB transaction 안에서 state를 `started`, stage를 `company_analysis`로 갱신하고 `career_outbox_jobs`에 `application.start` job을 생성한다.
  - idempotency key `application.start:${candidateId}`로 중복 job 생성을 방지한다.
  - `actionHistory`, `auditLogs`에 `user.start_application` 결과를 남기되 private 본문은 저장하지 않는다.
  - recommended 카드 전체가 submit target이 되도록 보정했다.
- 검증:
  - `pnpm exec tsc --noEmit`
  - `DATABASE_URL='mysql://user:pass@127.0.0.1:3306/fos_career' SESSION_SECRET='0123456789abcdef0123456789abcdef' pnpm build`
  - `pnpm run smoke:start-application -- --dry-run`
  - `rg -n "application.start|user.start_application|idempotencyKey|지원 시작|external|upload|login" app lib scripts`
  - `git diff --check`
- 비고:
  - env 없이 `pnpm build`는 기존 app 요구사항인 `DATABASE_URL` 누락으로 실패하므로 dummy env를 주입해 build를 확인했다.
  - `rg` 결과에 기존 auth login route와 legacy application preparation 코드가 함께 잡혔지만, 신규 start workflow payload에는 외부 제출, 업로드, 로그인 작업이 없다.
