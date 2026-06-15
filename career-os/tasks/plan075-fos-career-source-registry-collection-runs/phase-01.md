# Phase 01 — fos-career DB schema와 seed 도입

**Model**: sonnet
**Status**: pending

## 목표

fos-career MySQL에 source registry와 collection run을 저장할 DB schema, migration, 초기 seed를 도입한다.
migration 파일 생성만으로 완료하지 않고 기존 fos-career MySQL 또는 명시 smoke DB에 실제 적용을 검증한다.

**범위 외**: collection snapshot parser, dashboard UI 변경, career-os docs/ADR 수정, 외부 채용 사이트 제출·로그인·업로드·공개 발행.

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

- `career-os/AGENTS.md`의 Docs-first and Task Files, Validation and Git, 웹 대시보드 경계
- `career-os/docs/prd.md`의 plan075 섹션
- `career-os/docs/data-schema.md`의 fos-career MySQL 스키마와 plan075 planned tables
- `career-os/docs/flow.md`의 plan075 이후 목표 흐름
- `career-os/docs/code-architecture.md`의 fos-career 웹 대시보드와 plan075 source/collection 구조
- `career-os/docs/adr.md`의 ADR-083
- `career-os/tasks/plan075-fos-career-source-registry-collection-runs/index.json`
- `~/services/fos-career/AGENTS.md`

---

## 작업 항목

### 1. fos-career dirty state와 DB tooling 확인

`~/services/fos-career`에서 `git status --short`, 현재 branch, Drizzle schema/migration 명령, 기존 MySQL env를 확인한다.
unrelated dirty 변경은 수정, stage, revert하지 않고 phase 보고에 분리한다.

### 2. schema 확장

fos-career `db/schema.ts`에 다음 테이블과 relation/index를 기존 naming pattern에 맞춰 추가한다.

- `position_sources`
- `position_collection_runs`
- `position_source_run_diagnostics`

기존 테이블도 docs 결정과 맞게 확장한다.

- `position_recommendation_runs.collectionRunId`
- `collected_positions.collectionRunId`
- `collected_positions.sourceId`

### 3. migration 생성

fos-career의 기존 Drizzle migration 패턴으로 migration 파일을 생성한다.
이미 생성된 migration naming 규칙과 snapshot 파일 구조를 따른다.

### 4. source registry seed 추가

초기 registry seed는 최신 live-postings source 기준 7개를 포함한다.

- `wanted`
- `toss-careers`
- `coupang-careers`
- `kakaopay`
- `kakaopay-securities`
- `kakaomobility`
- `naver-careers`

seed는 재실행 가능해야 하며, existing row를 덮어쓰기보다 upsert 또는 idempotent insert 패턴을 사용한다.

### 5. 실제 DB 적용 검증

새 DB 컨테이너를 만들지 않는다.
기존 fos-career MySQL 연결 또는 명시 smoke DB 연결로 migration을 실제 적용하고, 신규 table/index/seed와 `collectionRunId` 컬럼 존재를 query로 확인한다.
DB 연결이 불가능하면 fixture나 dry-run으로 대체 완료하지 말고 `PHASE_BLOCKED`로 처리한다.

---

## Critical Files

| 저장소 | 파일 | 변경 |
|---|---|---|
| fos-career | `db/schema.ts` | source registry, collection run, source diagnostics, collectionRunId/sourceId 필드 |
| fos-career | `db/migrations/*` | Drizzle migration 추가 |
| fos-career | `db/*seed*` 또는 기존 seed 위치 | source registry idempotent seed |

읽기 전용 확인 파일:

- `career-os/docs/data-schema.md`
- `career-os/docs/adr.md`
- `career-os/tasks/plan075-fos-career-source-registry-collection-runs/index.json`

---

## 검증

보고 직전 반드시 아래 bash 블록을 실행하고 raw 값을 출력한다.

```bash
cd "$(git rev-parse --show-toplevel)"
cd ~/services/fos-career

pnpm exec tsc --noEmit
pnpm build

# 기존 fos-career MySQL 연결을 사용한다. 프로젝트의 실제 migrate 명령으로 대체 가능하다.
pnpm drizzle-kit migrate
pnpm drizzle-kit migrate

# 프로젝트의 DB query helper 또는 mysql client로 신규 객체를 확인한다.
# 아래 문자열은 실제 DB 검증 결과와 함께 phase 보고에 남긴다.
grep -R "position_sources\|position_collection_runs\|position_source_run_diagnostics\|collectionRunId\|sourceId" -n db lib app | head -50

git diff --cached --name-only
git status --short
```

---

## 성공 기준

- fos-career schema에 `position_sources`, `position_collection_runs`, `position_source_run_diagnostics`가 추가된다.
- `position_recommendation_runs.collectionRunId`, `collected_positions.collectionRunId`, `collected_positions.sourceId`가 DB schema와 migration에 반영된다.
- 초기 source registry seed가 7개 source를 재실행 가능하게 넣는다.
- 기존 fos-career MySQL 또는 명시 smoke DB에서 migration 1회 적용과 재실행 성공이 확인된다.
- 신규 table/index/seed/컬럼 존재가 실제 DB query로 확인된다.
- career-os docs/ADR/AGENTS는 수정하지 않는다.

---

## PHASE_BLOCKED

다음 경우에는 반드시 Bash 도구로 직접 `echo 'PHASE_BLOCKED: ...' && exit 2`를 실행한다.
prose만 출력하면 success로 잘못 처리될 수 있다.

- 기존 fos-career MySQL 연결 정보를 찾을 수 없어 실제 migration 적용을 검증할 수 없다.
- schema 설계가 docs/ADR에 없는 새 정책 결정을 요구한다.
- 새 DB 컨테이너 생성 없이는 검증할 수 없다고 판단된다.
- 구현 중 career-os docs/ADR 수정 필요가 드러난다.
- unrelated dirty 변경 때문에 DB schema 변경을 안전하게 분리할 수 없다.

## PHASE_FAILED

다음 경우에는 반드시 Bash 도구로 직접 `echo 'PHASE_FAILED: ...' && exit 1`를 실행한다.
prose만 출력하면 success로 잘못 처리될 수 있다.

- migration 파일 생성만 하고 실제 DB 적용 검증 없이 완료하려는 경우.
- `pnpm exec tsc --noEmit` 또는 `pnpm build`를 실행하지 못한 경우.
- 신규 source registry seed가 7개 초기 source를 포함하지 않는 경우.
- 새 DB 컨테이너를 만든 경우.
- unrelated dirty 파일을 stage하거나 revert한 경우.
- career-os docs/ADR/AGENTS를 수정한 경우.

---

## common-pitfalls self-check

- [ ] 첫 bash 블록이 `cd "$(git rev-parse --show-toplevel)"`로 시작한다.
- [ ] DB migration은 실제 적용과 재실행 검증을 포함한다.
- [ ] 성공 기준은 build, migrate, DB query, git status로 판정 가능하다.
- [ ] phase 안에서 docs/ADR을 수정하지 않는다.
- [ ] unrelated dirty 변경을 stage하지 않는다.
