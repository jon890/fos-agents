# Phase 04 - 재수집 자동 재오픈

**Model**: sonnet
**Status**: pending

---

## 목표

닫힌 공고가 새 collection run에 다시 등장하면 자동으로 열린 상태로 복구한다.
복구 상태는 새 snapshot의 `posting_status` 값을 사용한다.
복구 이력은 `position_status_events`에 `validator_reopened`로 기록한다.

**범위 외**: validator 자동 닫힘 기준 변경, 수동 재오픈 UI, 공고 상세 페이지, source adapter 구현/수정, career-os docs/ADR 수정.

---

## 사전 cwd 설정

```bash
cd "$(git rev-parse --show-toplevel)"
pwd
```

---

## 관련 docs

실행 전 반드시 읽는다.

- `career-os/docs/adr.md`의 ADR-084
- `career-os/docs/prd.md`의 plan076 재수집 자동 복구 범위
- `career-os/docs/flow.md`의 collection run import와 reopen 흐름
- `career-os/docs/data-schema.md`의 `position_status_events`
- `career-os/docs/code-architecture.md`의 collected position lifecycle 구조
- `career-os/tasks/plan076-fos-career-position-lifecycle-validation/phase-03.md`
- `~/services/fos-career/AGENTS.md`

---

## 작업 항목

### 1. collection import path 확인

plan075 이후 collection snapshot import가 `collected_positions`와 `collected_position_run_items`를 갱신하는 지점을 찾는다.
기존 plan075 파일은 수정하지 않는다.

### 2. 닫힌 공고 재등장 감지

import 중 기존 `collected_positions.postingStatus`가 닫힌 상태이고 새 snapshot에 다시 등장하면 재오픈 후보로 본다.
동일 run에서 중복 처리하지 않도록 idempotency를 둔다.

### 3. snapshot status 복원

새 snapshot의 `posting_status` 값을 `nextStatus`로 사용한다.
snapshot status가 비어 있거나 알 수 없으면 새 정책을 임의로 만들지 말고 PHASE_BLOCKED로 처리한다.

### 4. 이벤트 기록

`position_status_events`에 `validator_reopened` 이벤트를 남긴다.
가능한 경우 다음 값을 포함한다.

- `previousStatus`
- `nextStatus`
- `collectionRunId`
- `sourceId`
- `reason`
- `evidenceJson`

### 5. fixture 검증

닫힌 공고가 다음 run에 다시 등장하는 fixture를 만든다.
이미 열린 공고가 다시 등장하는 경우에는 불필요한 reopen 이벤트가 생기지 않아야 한다.

---

## Critical Files

| 저장소 | 파일 | 변경 |
|---|---|---|
| fos-career | collection snapshot import script/helper | 재등장 감지와 status 복원 |
| fos-career | position lifecycle helper | `validator_reopened` 이벤트 기록 |
| fos-career | fixture/test 위치 | reopen fixture |

---

## 검증

보고 직전 반드시 아래 bash 블록을 실행하고 raw 값을 출력한다.

```bash
cd "$(git rev-parse --show-toplevel)"
cd ~/services/fos-career

pnpm exec tsc --noEmit
pnpm build

rg -n "validator_reopened|posting_status|postingStatus|collected_position_run_items|collectionRunId|reopen|재수집" app lib scripts db test fixtures
git diff --check
git status --short
```

---

## 성공 기준

- 닫힌 공고가 새 collection run에 다시 등장하면 snapshot `posting_status`로 복원된다.
- `validator_reopened` 이벤트가 이전 상태, 다음 상태, run/source/evidence를 남긴다.
- 이미 열린 공고의 재등장은 중복 reopen 이벤트를 만들지 않는다.
- latest/new/past 판단을 `collected_position_run_items`와 충돌시키지 않는다.
- Naver/KakaoPay Securities adapter 구현 또는 0건 원인 분석을 하지 않는다.

---

## PHASE_BLOCKED

다음 경우에는 반드시 Bash 도구로 직접 `echo 'PHASE_BLOCKED: ...' && exit 2`를 실행한다.

- collection import path를 찾을 수 없다.
- 새 snapshot에서 복원할 `posting_status`를 얻을 수 없다.
- 재오픈 기준이 ADR-084보다 더 많은 정책 결정을 요구한다.
- 구현 중 career-os docs/ADR 수정 필요가 드러난다.

## PHASE_FAILED

다음 경우에는 반드시 Bash 도구로 직접 `echo 'PHASE_FAILED: ...' && exit 1`를 실행한다.

- 닫힌 공고 재등장에도 status가 복원되지 않는 경우.
- 복원 이벤트를 남기지 않는 경우.
- snapshot status 대신 임의 고정값으로 복원하는 경우.
- 이미 열린 공고에 reopen 이벤트를 반복 생성하는 경우.
- plan075 산출물 또는 career-os docs/ADR/AGENTS를 수정한 경우.

---

## common-pitfalls self-check

- [ ] 첫 bash 블록이 `cd "$(git rev-parse --show-toplevel)"`로 시작한다.
- [ ] 복원 status는 snapshot `posting_status`를 사용한다.
- [ ] `validator_reopened` 이벤트를 남긴다.
- [ ] 중복 reopen 이벤트를 방지한다.
- [ ] source adapter 구현을 하지 않는다.
