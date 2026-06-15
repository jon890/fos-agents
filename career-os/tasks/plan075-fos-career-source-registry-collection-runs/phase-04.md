# Phase 04 — runner integration과 실제 smoke 검증

**Model**: sonnet
**Status**: pending

## 목표

position recommender daily runner가 Claude 추천 생성 전에 collection snapshot DB import를 수행하게 연결한다.
recommendation run은 `collectionRunId`를 참조하고, 실제 수집/import/recommendation ingest smoke와 Docker app health, DB query 검증을 끝낸다.

**범위 외**: source adapter 무제한 확장, 추천 후보 개수 정책 변경, 새 DB 컨테이너 생성, career-os docs/ADR 수정, 외부 채용 사이트 제출·로그인·업로드·공개 발행.

---

## 사전 cwd 설정

run-phases.py는 cwd=workspace로 phase를 실행한다.
본 phase는 ai-nodes 루트 기준 path를 쓰므로 첫 bash에서 cwd를 ai-nodes 루트로 변경한다.

```bash
cd "$(git rev-parse --show-toplevel)"
pwd
```

---

## 관련 docs

실행 전 반드시 읽는다.

- `career-os/AGENTS.md`의 Background Execution, Validation and Git, 웹 대시보드 경계
- `career-os/docs/flow.md`의 `/position-recommender` runner 흐름과 plan075 이후 목표 흐름
- `career-os/docs/code-architecture.md`의 `scripts/position-recommender/run_daily_with_claude.ts`와 fos-career DB interface
- `career-os/docs/data-schema.md`의 `position_recommendation_runs.collectionRunId`와 collection run tables
- `career-os/docs/adr.md`의 ADR-083
- `career-os/tasks/plan075-fos-career-source-registry-collection-runs/index.json`
- `~/services/fos-career/AGENTS.md`

---

## 작업 항목

### 1. daily runner 연결점 확인

`career-os/scripts/position-recommender/run_daily_with_claude.ts`와 기존 report ingest helper를 읽는다.
collect 완료 후 Claude native skill 호출 전에 phase 02 import CLI를 호출할 위치를 확정한다.

### 2. collection import를 추천 생성 전 실행

runner가 `data/runtime/live-position-postings.md` 생성 뒤 fos-career import CLI를 실행하게 한다.
import 실패는 stale recommendation으로 넘어가지 않게 실패 처리한다.
단, Claude 추천 생성 또는 recommendation ingest 실패가 나도 이미 성공한 collection run과 source diagnostics는 DB에 남아야 한다.

### 3. recommendation ingest 연결

structured recommendation ingest가 `position_recommendation_runs.collectionRunId`를 저장하게 한다.
recommendation item과 application candidate 갱신은 기존 plan073/plan074 경로를 유지한다.

### 4. Docker app rebuild와 health 확인

fos-career Docker app을 기존 compose 또는 운영 명령으로 rebuild/restart한다.
새 DB 컨테이너는 만들지 않는다.
dashboard health와 `/dashboard/sources`, `/dashboard/positions`, latest recommendation route를 확인한다.

### 5. 실제 smoke와 DB query 검증

실제 collection/import/recommendation ingest smoke를 수행한다.
최소한 다음을 query로 확인한다.

- latest `position_collection_runs`
- latest run의 source diagnostics row 7개 이상 또는 configured enabled source 수와 일치
- `collected_positions.collectionRunId`
- `position_recommendation_runs.collectionRunId`
- Naver Careers와 KakaoPay Securities가 0건이면 zero/failure reason이 비어 있지 않은지

---

## Critical Files

| 저장소 | 파일 | 변경 |
|---|---|---|
| career-os | `scripts/position-recommender/run_daily_with_claude.ts` | collect 이후, Claude 추천 전 import 호출 |
| fos-career | `db/import-positions.ts` 또는 phase 02 import entrypoint | runner 호출 가능하도록 안정화 |
| fos-career | recommendation ingest helper | `collectionRunId` 저장 |
| fos-career | Docker/health 관련 설정 | 필요 시 app rebuild 명령 확인. 새 DB 컨테이너 생성 금지 |

읽기 전용 확인 파일:

- `career-os/docs/flow.md`
- `career-os/docs/data-schema.md`
- `career-os/tasks/plan075-fos-career-source-registry-collection-runs/index.json`

---

## 검증

보고 직전 반드시 아래 bash 블록을 실행하고 raw 값을 출력한다.

```bash
cd "$(git rev-parse --show-toplevel)"
AI_NODES_ROOT="$(pwd)"

bun --version
bun run --cwd . tsc --noEmit || true

cd ~/services/fos-career

pnpm exec tsc --noEmit
pnpm build

# 기존 compose/app 운영 명령을 사용한다. 새 DB 컨테이너는 만들지 않는다.
docker compose build app
docker compose up -d app
docker compose ps

cd "$AI_NODES_ROOT/career-os"

# 실제 smoke 명령은 runner의 안전한 옵션 또는 기존 daily runner 계약에 맞춘다.
# Claude 추천 호출이 너무 길면 명시 smoke mode가 있는지 먼저 확인하고, 없으면 PHASE_BLOCKED로 멈춘다.
bun scripts/position-recommender/run_daily_with_claude.ts --help || true

rg -n "collectionRunId|import-positions|position_collection_runs|position_source_run_diagnostics" scripts/position-recommender ~/services/fos-career/db ~/services/fos-career/lib ~/services/fos-career/app

git status --short
git -C ~/services/fos-career status --short
```

실제 DB query와 smoke 결과는 phase 보고에 raw count로 남긴다.
쿼리 예시는 프로젝트 DB helper 또는 mysql client에 맞춰 실행한다.

---

## 성공 기준

- daily runner가 collection snapshot DB import를 Claude 추천 생성 전에 실행한다.
- import 성공 뒤 추천 생성 또는 recommendation ingest가 실패해도 collection run과 source diagnostics는 DB에 남는다.
- latest `position_recommendation_runs.collectionRunId`가 latest 또는 사용한 collection run을 참조한다.
- 실제 수집/import/recommendation ingest smoke가 수행된다.
- fos-career Docker app rebuild와 health 확인이 통과한다.
- DB query로 collection run, source diagnostics, collected positions, recommendation run 연결이 확인된다.
- 새 DB 컨테이너를 만들지 않는다.
- career-os docs/ADR/AGENTS는 수정하지 않는다.

---

## PHASE_BLOCKED

다음 경우에는 반드시 Bash 도구로 직접 `echo 'PHASE_BLOCKED: ...' && exit 2`를 실행한다.
prose만 출력하면 success로 잘못 처리될 수 있다.

- 실제 smoke를 수행할 안전한 runner 옵션이 없고, daily runner 전체 실행이 사용자 승인 없이 너무 위험하거나 오래 걸린다.
- 기존 fos-career MySQL 연결 또는 Docker app 운영 명령을 확인할 수 없다.
- recommendation ingest의 `collectionRunId` 연결이 docs/ADR에 없는 새 schema 결정을 요구한다.
- 구현 중 career-os docs/ADR 수정 필요가 드러난다.

## PHASE_FAILED

다음 경우에는 반드시 Bash 도구로 직접 `echo 'PHASE_FAILED: ...' && exit 1`를 실행한다.
prose만 출력하면 success로 잘못 처리될 수 있다.

- collection import가 Claude 추천 생성 뒤에 실행되는 경우.
- `position_recommendation_runs.collectionRunId`가 저장되지 않는 경우.
- 실제 DB query 없이 smoke 완료로 보고하는 경우.
- Docker app rebuild/health 확인 없이 완료하는 경우.
- 새 DB 컨테이너를 만든 경우.
- unrelated dirty 파일을 stage하거나 revert한 경우.
- career-os docs/ADR/AGENTS를 수정한 경우.

---

## common-pitfalls self-check

- [ ] 첫 bash 블록이 `cd "$(git rev-parse --show-toplevel)"`로 시작한다.
- [ ] runner integration은 import before recommendation 순서를 검증한다.
- [ ] DB query raw count를 phase 보고에 남긴다.
- [ ] 새 DB 컨테이너를 만들지 않는다.
- [ ] phase 안에서 docs/ADR을 수정하지 않는다.
