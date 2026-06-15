# Phase 01 - DB schema와 migration

**Model**: sonnet
**Status**: pending

---

## 목표

fos-career MySQL과 Drizzle schema에 공고 lifecycle 검증용 테이블을 추가한다.
현재 상태의 단일 출처는 `collected_positions.postingStatus`로 유지한다.
상태 변경 이력과 validator 실행 이력은 새 테이블에 누적한다.

**범위 외**: 수동 닫힘 UI, validator script, 재오픈 import 로직, career-os docs/ADR 수정, plan075 산출물 수정.

---

## 사전 cwd 설정

```bash
cd "$(git rev-parse --show-toplevel)"
pwd
```

---

## 관련 docs

실행 전 반드시 읽는다.

- `career-os/AGENTS.md`의 Docs-first and Task Files, Validation and Git, 웹 대시보드 경계
- `career-os/docs/adr.md`의 ADR-084
- `career-os/docs/prd.md`의 plan076 섹션
- `career-os/docs/data-schema.md`의 `position_status_events`, `position_validation_runs`
- `career-os/docs/flow.md`의 plan076 lifecycle 흐름
- `career-os/docs/code-architecture.md`의 plan076 lifecycle 구조
- `career-os/tasks/plan076-fos-career-position-lifecycle-validation/index.json`
- `~/services/fos-career/AGENTS.md`

---

## 작업 항목

### 1. fos-career dirty state와 DB tooling 확인

`~/services/fos-career`에서 branch, `git status --short`, Drizzle schema 위치, migration 명령, DB env를 확인한다.
unrelated dirty 변경은 수정, stage, revert하지 않는다.

### 2. Drizzle schema 추가

기존 naming pattern에 맞춰 다음 테이블을 추가한다.

- `position_status_events`
- `position_validation_runs`

`position_status_events`는 최소 필드를 포함한다.

- `collectedPositionId`
- `eventType`
- `previousStatus`
- `nextStatus`
- `reason`
- `collectionRunId`
- `sourceId`
- `validationRunId`
- `actorAdminUserId`
- `evidenceJson`
- `createdAt`

`position_validation_runs`는 최소 필드를 포함한다.

- `id`
- `mode`
- `maxChanges`
- `checkedCount`
- `closedCount`
- `reopenedCount`
- `skippedCount`
- `startedAt`
- `finishedAt`
- `summaryJson`

### 3. index와 relation 추가

조회와 감사에 필요한 index를 추가한다.

- `collectedPositionId`, `createdAt`
- `eventType`
- `validationRunId`
- `collectionRunId`
- `sourceId`

`collected_positions.postingStatus`를 현재 상태 정본으로 둔다.
별도 override table은 만들지 않는다.

### 4. migration 생성

fos-career의 기존 Drizzle migration naming과 snapshot 구조를 따른다.
수동 SQL을 작성해야 하면 schema와 migration이 서로 어긋나지 않게 확인한다.

### 5. 실제 DB 적용 검증

새 DB 컨테이너를 만들지 않는다.
기존 fos-career MySQL 또는 명시 smoke DB에 migration을 실제 적용한다.
`drizzle-kit migrate`를 2회 실행해 재실행 성공을 확인한다.

---

## Critical Files

| 저장소 | 파일 | 변경 |
|---|---|---|
| fos-career | `db/schema.ts` 또는 기존 schema 파일 | lifecycle table, relation, index 추가 |
| fos-career | `db/migrations/*` | Drizzle migration 추가 |

읽기 전용 확인 파일:

- `career-os/docs/data-schema.md`
- `career-os/docs/adr.md`
- `career-os/tasks/plan076-fos-career-position-lifecycle-validation/index.json`

---

## 검증

보고 직전 반드시 아래 bash 블록을 실행하고 raw 값을 출력한다.

```bash
cd "$(git rev-parse --show-toplevel)"
cd ~/services/fos-career

pnpm exec tsc --noEmit
pnpm build
pnpm drizzle-kit migrate
pnpm drizzle-kit migrate

rg -n "position_status_events|position_validation_runs|validationRunId|validator_reopened|manual_closed" db lib app scripts
git diff --check
git status --short
```

---

## 성공 기준

- `position_status_events`와 `position_validation_runs`가 Drizzle schema와 migration에 추가된다.
- 상태 이벤트는 before/after status, reason, collectionRunId, sourceId, validator run id, actor, evidence를 저장할 수 있다.
- 현재 상태 정본은 `collected_positions.postingStatus`로 유지된다.
- 실제 DB 또는 명시 smoke DB에서 migration 1회 적용과 재실행이 성공한다.
- 신규 table/index 존재가 query 또는 migration 결과로 확인된다.
- career-os docs/ADR/AGENTS와 plan075 산출물은 수정하지 않는다.

---

## PHASE_BLOCKED

다음 경우에는 반드시 Bash 도구로 직접 `echo 'PHASE_BLOCKED: ...' && exit 2`를 실행한다.

- 기존 fos-career MySQL 연결 정보를 찾을 수 없어 실제 migration 적용을 검증할 수 없다.
- schema 설계가 ADR-084에 없는 새 정책 결정을 요구한다.
- 구현 중 career-os docs/ADR 수정 필요가 드러난다.
- unrelated dirty 변경 때문에 schema 변경을 안전하게 분리할 수 없다.

## PHASE_FAILED

다음 경우에는 반드시 Bash 도구로 직접 `echo 'PHASE_FAILED: ...' && exit 1`를 실행한다.

- migration 파일 생성만 하고 실제 DB 적용 검증 없이 완료하려는 경우.
- `pnpm exec tsc --noEmit`, `pnpm build`, `drizzle-kit migrate`를 실행하지 못한 경우.
- 별도 override table을 현재 상태 정본으로 만든 경우.
- 새 DB 컨테이너를 만든 경우.
- plan075 산출물 또는 career-os docs/ADR/AGENTS를 수정한 경우.
- unrelated dirty 파일을 stage하거나 revert한 경우.

---

## common-pitfalls self-check

- [ ] 첫 bash 블록이 `cd "$(git rev-parse --show-toplevel)"`로 시작한다.
- [ ] DB migration은 실제 적용과 재실행 검증을 포함한다.
- [ ] `collected_positions.postingStatus`를 현재 상태 정본으로 유지한다.
- [ ] phase 안에서 docs/ADR과 plan075를 수정하지 않는다.
- [ ] unrelated dirty 변경을 stage하지 않는다.
