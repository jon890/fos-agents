# Phase 04 — 통합 검증과 당일 추천 재실행

**Model**: sonnet
**Status**: pending

## 목표

plan074 변경을 통합 검증한다.
정적 검증, build, dry-run ingest, 당일 position recommender 재실행, fos-career DB ingest, dashboard 확인을 수행한다.

**범위 외**: 새 기능 구현, docs/ADR 수정, 외부 채용 사이트 제출/로그인/업로드, 공개 발행.

---

## 사전 cwd 설정

검증은 career-os와 fos-career를 모두 확인한다.
첫 bash에서 career-os로 이동하고, fos-career 명령은 `cd ~/services/fos-career`를 명시해 실행한다.

```bash
cd ~/ai-nodes/career-os
pwd
```

---

## 관련 docs

실행 전 반드시 읽는다.

- `career-os/docs/prd.md`의 plan074 MVP 범위
- `career-os/docs/flow.md`의 `/position-recommender`와 fos-career mobile dashboard 흐름
- `career-os/docs/adr.md`의 ADR-082
- `career-os/tasks/plan074-fos-career-mobile-position-explorer/index.json`
- `~/services/fos-career/AGENTS.md`

---

## 작업 항목

### 1. 정적 검증과 build 실행

career-os runner check와 fos-career typecheck/build를 실행한다.
Docker build가 현재 배포 경로의 필수 검증이면 실행하고, 필수가 아니면 이유를 보고에 남긴다.

### 2. dry-run ingest 검증

fos-career ingest helper를 dry-run으로 실행해 추천 후보 구조화 필드 누락 summary를 확인한다.
누락 count와 대상 item을 raw output 또는 짧은 요약으로 남긴다.

### 3. 당일 position recommender 재실행

`/position-recommender` daily runner를 당일 기준으로 재실행한다.
Toss 계열 쿨다운 해제 여부와 active/open snapshot freshness를 확인한다.

### 4. DB ingest와 dashboard 확인

재실행 결과를 fos-career DB로 ingest한다.
`application_candidates.latestSnapshotJson`에 `priorityReason`, `nextAction`, `riskFlags`, `evidenceUrls`가 반영됐는지 확인하고, `/dashboard`, `/dashboard/positions`, 후보 화면을 확인한다.

### 5. task 완료 기록 정리

검증 결과를 이 phase 문서 또는 plan runner 결과에 남긴다.
`index.json`의 status/current_phase 갱신은 plan-and-build runner가 처리하지 못한 경우에만 최소 수정한다.

---

## Critical Files

| 저장소 | 파일 | 변경 |
|---|---|---|
| career-os | `data/runtime/position-recommendation.md` | 당일 추천 재실행 결과 |
| career-os | `data/runtime/position-recommendation.html` | 당일 추천 HTML mirror |
| career-os | `data/reports/daily/YYYY-MM-DD/position-recommendation/report.md` | 당일 보존 리포트 |
| career-os | `data/reports/daily/YYYY-MM-DD/position-recommendation/report.html` | 당일 HTML 보존 리포트 |
| fos-career | DB `position_recommendation_items`, `application_candidates` | ingest 결과 확인 |
| fos-career | `app/dashboard/positions/page.tsx` | 검증 중 추가 구현은 하지 않음 |

읽기 전용 확인 파일:

- `career-os/docs/prd.md`
- `career-os/docs/flow.md`
- `career-os/docs/adr.md`
- `career-os/tasks/plan074-fos-career-mobile-position-explorer/index.json`
- `~/services/fos-career/AGENTS.md`

---

## 검증

보고 직전 반드시 아래 bash 블록을 실행하고 raw 값을 출력한다.
실제 ingest command는 `~/services/fos-career/package.json`과 script help를 확인한 뒤 정확한 옵션으로 실행한다.

```bash
cd ~/ai-nodes/career-os

bun --check scripts/position-recommender/structured_recommendation_items.ts
bun --check scripts/position-recommender/run_daily_with_claude.ts
test -f data/runtime/position-recommendation.md
test -f data/runtime/position-recommendation.html

cd ~/services/fos-career

pnpm exec tsc --noEmit
pnpm build
pnpm exec tsx scripts/ingest-position-recommendations.ts --help || true

git status --short
cd ~/ai-nodes/career-os
git status --short
```

추가로 실행해야 하는 검증:

- fos-career ingest dry-run.
- 당일 `position-recommender` 재실행.
- fos-career DB ingest.
- dashboard desktop/mobile smoke.
- Docker build가 배포 필수이면 `docker build` 또는 compose build.

---

## 성공 기준

- career-os runner check와 fos-career typecheck/build가 통과한다.
- dry-run ingest가 카드 필수 필드 누락을 summary로 보여준다.
- 당일 position recommender 리포트와 HTML mirror가 생성된다.
- Toss 계열 쿨다운 해제와 active/open snapshot freshness를 확인한다.
- 재실행 결과가 fos-career DB로 ingest되고 후보 카드 구조화 필드가 dashboard에서 확인된다.
- `/dashboard/positions`와 후보 화면이 모바일에서 탐색 가능한 상태다.
- career-os docs/ADR/AGENTS는 수정하지 않는다.

---

## PHASE_BLOCKED

다음 경우에는 반드시 Bash 도구로 직접 `echo 'PHASE_BLOCKED: ...' && exit 2`를 실행한다.
prose만 출력하면 success로 잘못 처리될 수 있다.

- 당일 position recommender 재실행이 외부 사이트 로그인, 수동 제출, 업로드, 공개 발행을 요구한다.
- DB migration이 필요한데 실제 DB 적용/검증을 할 수 없고 문서 결정도 추가로 필요하다.
- Docker build가 배포 필수인지 판단하려면 별도 운영 결정이 필요하다.
- dashboard 확인에 필요한 인증/환경 정보가 없어 검증을 재현할 수 없다.
- 구현 중 career-os docs/ADR 수정 필요가 드러난다.

## PHASE_FAILED

다음 경우에는 반드시 Bash 도구로 직접 `echo 'PHASE_FAILED: ...' && exit 1`를 실행한다.
prose만 출력하면 success로 잘못 처리될 수 있다.

- 당일 추천 재실행 또는 대체 검증 이유 없이 완료 보고하려는 경우.
- dry-run ingest와 DB ingest 중 하나 이상을 확인하지 않은 경우.
- 후보 카드 구조화 필드가 계속 null인데 성공 처리하는 경우.
- 검증 명령 raw output 없이 성공 보고하려는 경우.
- unrelated dirty 파일을 stage하거나 revert한 경우.

---

## common-pitfalls self-check

- [ ] 검증 명령을 실제로 실행하고 raw output을 보고한다.
- [ ] 당일 재실행 산출물과 DB ingest 결과를 분리해 확인한다.
- [ ] Docker build 필요 여부를 명시한다.
- [ ] career-os docs/ADR 수정은 범위 밖이다.
- [ ] 두 저장소 status를 각각 보고한다.
