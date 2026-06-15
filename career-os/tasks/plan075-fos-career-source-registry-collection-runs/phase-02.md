# Phase 02 — collection snapshot import pipeline

**Model**: sonnet
**Status**: pending

## 목표

`data/runtime/live-position-postings.md` snapshot을 fos-career DB로 import하는 pipeline을 만든다.
추천 생성 전에 source registry, collection run, source별 diagnostics, collected positions를 먼저 갱신할 수 있게 한다.

**범위 외**: DB schema 신설, dashboard UI 변경, daily runner 최종 연결, source adapter 무제한 확장, career-os docs/ADR 수정, 외부 채용 사이트 제출·로그인·업로드·공개 발행.

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

- `career-os/AGENTS.md`의 웹 대시보드 경계와 Background Execution
- `career-os/docs/data-schema.md`의 `data/runtime/live-position-postings.md`, `position_collection_runs`, `position_source_run_diagnostics`, `collected_positions`
- `career-os/docs/flow.md`의 `/position-recommender`와 plan075 이후 목표 흐름
- `career-os/docs/code-architecture.md`의 `scripts/position-recommender/live-postings/`와 fos-career DB interface
- `career-os/docs/adr.md`의 ADR-083
- `career-os/tasks/plan075-fos-career-source-registry-collection-runs/index.json`
- `~/services/fos-career/AGENTS.md`

---

## 작업 항목

### 1. snapshot format 확인

career-os에서 `scripts/position-recommender/collect_live_postings.ts`와 `scripts/position-recommender/live-postings/render.ts`를 읽고, `data/runtime/live-position-postings.md`의 configured sources, source counts, diagnostics, errors, posting rows를 어떻게 파싱할지 확정한다.
snapshot 구조가 파싱 불가능하면 조용히 추정하지 말고 `PHASE_BLOCKED`로 멈춘다.

### 2. import parser 구현

fos-career에 host-side import helper를 추가하거나 기존 import helper를 확장한다.
parser는 다음 정보를 구조화한다.

- 실행 당시 configured sources
- source별 collected/imported/skipped/failed count
- source diagnostics와 errors 요약
- 개별 collected position의 source, URL, title, company, close date, active/open evidence

### 3. DB upsert 구현

import는 한 번 실행해도, 같은 snapshot을 다시 실행해도 안전해야 한다.
다음 순서로 처리한다.

- `position_sources` seed/upsert
- `position_collection_runs` 생성 또는 idempotent 갱신
- `position_source_run_diagnostics` upsert
- `collected_positions` upsert와 `collectionRunId`/`sourceId` 연결

### 4. CLI 또는 runner 연결점 추가

추천 생성 전에 호출할 수 있는 CLI entrypoint를 마련한다.
예: `pnpm tsx db/import-positions.ts --snapshot ... --requested-source all --dry-run`.
실제 runner integration은 phase 04 범위이므로 여기서는 독립 실행 가능한 import 명령을 제공한다.

### 5. dry-run과 실제 import 검증

기존 snapshot 또는 새로 생성한 snapshot으로 dry-run summary와 실제 DB import를 검증한다.
source 하나가 실패해도 다른 source import를 막지 않게 한다.

---

## Critical Files

| 저장소 | 파일 | 변경 |
|---|---|---|
| fos-career | `db/import-positions.ts` 또는 기존 import helper | snapshot parser와 DB import CLI |
| fos-career | `lib/db/*` | 필요한 query/upsert helper |
| career-os | `data/runtime/live-position-postings.md` | 읽기 전용 입력 |
| career-os | `scripts/position-recommender/live-postings/render.ts` | 읽기 전용 format 확인 |

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

test -f career-os/data/runtime/live-position-postings.md

cd ~/services/fos-career

pnpm exec tsc --noEmit
pnpm build

# 실제 CLI 이름은 구현한 entrypoint에 맞춘다.
# dry-run은 source별 count와 zero/failure reason 후보를 stdout에 요약해야 한다.
pnpm tsx db/import-positions.ts --snapshot "$AI_NODES_ROOT/career-os/data/runtime/live-position-postings.md" --requested-source all --dry-run
pnpm tsx db/import-positions.ts --snapshot "$AI_NODES_ROOT/career-os/data/runtime/live-position-postings.md" --requested-source all

# 프로젝트 DB helper 또는 mysql client로 collection run과 diagnostics row를 확인한다.
grep -R "configuredSources\|position_collection_runs\|position_source_run_diagnostics\|collectionRunId\|zeroReason\|failureReason" -n db lib app | head -80

git diff --cached --name-only
git status --short
```

---

## 성공 기준

- snapshot parser가 configured sources, source counts, diagnostics, errors, posting rows를 구조화한다.
- import가 `position_sources`, `position_collection_runs`, `position_source_run_diagnostics`, `collected_positions`를 순서대로 갱신한다.
- `collected_positions` rows가 `collectionRunId`와 `sourceId`를 가진다.
- dry-run summary가 source별 count와 zero/failure reason 후보를 표시한다.
- 실제 DB import 후 collection run과 source diagnostics row가 query로 확인된다.
- 추천 생성 없이도 import CLI만 독립 실행할 수 있다.
- career-os docs/ADR/AGENTS는 수정하지 않는다.

---

## PHASE_BLOCKED

다음 경우에는 반드시 Bash 도구로 직접 `echo 'PHASE_BLOCKED: ...' && exit 2`를 실행한다.
prose만 출력하면 success로 잘못 처리될 수 있다.

- `live-position-postings.md` snapshot 구조만으로 configured sources 또는 source diagnostics를 안정적으로 파싱할 수 없다.
- phase 01 schema가 없거나 migration 적용이 확인되지 않아 import 대상 테이블을 쓸 수 없다.
- import 계약이 docs/ADR에 없는 새 정책 결정을 요구한다.
- 기존 fos-career MySQL 연결로 실제 import를 검증할 수 없다.
- 구현 중 career-os docs/ADR 수정 필요가 드러난다.

## PHASE_FAILED

다음 경우에는 반드시 Bash 도구로 직접 `echo 'PHASE_FAILED: ...' && exit 1`를 실행한다.
prose만 출력하면 success로 잘못 처리될 수 있다.

- dry-run만 만들고 실제 DB import 검증 없이 완료하려는 경우.
- source별 실패가 전체 import 실패로만 처리되는 경우.
- `collectionRunId` 또는 `sourceId` 연결 없이 `collected_positions`만 upsert하는 경우.
- `pnpm exec tsc --noEmit` 또는 `pnpm build`를 실행하지 못한 경우.
- unrelated dirty 파일을 stage하거나 revert한 경우.
- career-os docs/ADR/AGENTS를 수정한 경우.

---

## common-pitfalls self-check

- [ ] 첫 bash 블록이 `cd "$(git rev-parse --show-toplevel)"`로 시작한다.
- [ ] phase는 이전 대화 없이 snapshot format과 import 순서를 알 수 있다.
- [ ] 성공 기준은 dry-run, 실제 import, DB query, build로 판정 가능하다.
- [ ] phase 안에서 docs/ADR을 수정하지 않는다.
- [ ] source adapter 확장은 범위 밖이다.
