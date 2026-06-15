# Phase 03 - validator script

**Model**: sonnet
**Status**: completed

---

## 목표

수집 공고 lifecycle validator를 만든다.
기본 실행은 dry-run이다.
`--apply`가 있을 때만 `validator_closed` 또는 `validation_skipped` 이벤트와 상태 변경을 적용한다.
`--max-changes` 기본값은 20이다.

**범위 외**: source adapter 구현/수정, 재수집 자동 재오픈, cron 자동 apply, career-os docs/ADR 수정, plan075 산출물 수정.

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
- `career-os/docs/prd.md`의 plan076 validator 범위
- `career-os/docs/flow.md`의 validator 흐름
- `career-os/docs/data-schema.md`의 `position_validation_runs`, `position_status_events`
- `career-os/docs/code-architecture.md`의 plan076 lifecycle 구조
- `career-os/tasks/plan076-fos-career-position-lifecycle-validation/phase-01.md`
- `career-os/tasks/plan076-fos-career-position-lifecycle-validation/phase-02.md`
- `~/services/fos-career/AGENTS.md`

---

## 작업 항목

### 1. CLI skeleton 추가

fos-career scripts에 validator entrypoint를 추가한다.
package script 이름은 기존 convention에 맞춘다.
기본 실행은 dry-run으로 표시한다.

필수 옵션:

- `--apply`
- `--max-changes <number>` 기본 20
- 필요하면 `--source <sourceId>` 또는 `--limit <number>` 같은 좁은 검증 옵션

### 2. validation run 기록

각 실행은 `position_validation_runs`에 기록한다.
dry-run도 checked/closed/reopened/skipped 예정 count와 summary를 남기거나 dry-run summary를 명확히 출력한다.
DB에 dry-run run을 저장하지 않는 설계를 택하면 이유와 대체 증거를 phase 보고에 남긴다.

### 3. 자동 닫힘 후보 산출

`collected_position_run_items`를 기준으로 최신 수집 실행에서 3회 이상 미등장한 공고를 찾는다.
`collected_positions.collectionRunId`만으로 latest 여부를 판단하지 않는다.

### 4. source diagnostics 기반 skip

source가 정상 계열일 때만 자동 닫기 후보로 둔다.
아래 계열은 자동 닫지 않는다.

- `blocked`
- `parser_changed`
- `failed`
- `skipped`
- `unknown`

불안정 source는 `validation_skipped` 이벤트를 남긴다.

### 5. apply 경계

`--apply`가 없으면 `collected_positions.postingStatus`를 바꾸지 않는다.
`--apply`가 있으면 `--max-changes` 상한 안에서만 `validator_closed`를 적용한다.

---

## Critical Files

| 저장소 | 파일 | 변경 |
|---|---|---|
| fos-career | `scripts/*position*validator*` | validator CLI |
| fos-career | `package.json` | validator script |
| fos-career | `lib/*position*` | 후보 산출과 event write helper |
| fos-career | `test` 또는 `fixtures` | dry-run/apply/source failure fixture |

---

## 검증

보고 직전 반드시 아래 bash 블록을 실행하고 raw 값을 출력한다.

```bash
cd "$(git rev-parse --show-toplevel)"
cd ~/services/fos-career

pnpm exec tsc --noEmit
pnpm build
pnpm run validate:positions -- --dry-run
pnpm run validate:positions -- --dry-run --max-changes 1

rg -n "validate:positions|validator_closed|validation_skipped|max-changes|collected_position_run_items|position_validation_runs" package.json scripts lib db
git diff --check
git status --short
```

---

## 성공 기준

- validator는 기본 dry-run이며 dry-run에서 공고 상태를 바꾸지 않는다.
- `--apply`가 있을 때만 상태 변경과 `validator_closed` 이벤트가 적용된다.
- `--max-changes` 기본값이 20이고 옵션으로 낮출 수 있다.
- 3회 이상 미등장 판정은 `collected_position_run_items`를 기준으로 한다.
- source diagnostics가 불안정하면 자동 닫지 않고 `validation_skipped`로 남긴다.
- Naver/KakaoPay Securities adapter 구현이나 0건 원인 보강을 하지 않는다.

---

## PHASE_BLOCKED

다음 경우에는 반드시 Bash 도구로 직접 `echo 'PHASE_BLOCKED: ...' && exit 2`를 실행한다.

- `collected_position_run_items` 또는 source diagnostics를 신뢰할 수 있는 형태로 읽을 수 없다.
- 정상 source와 불안정 source 분류가 docs보다 더 많은 정책 결정을 요구한다.
- phase-01 schema가 없어 validation run 또는 event를 기록할 수 없다.
- 구현 중 career-os docs/ADR 수정 필요가 드러난다.

## PHASE_FAILED

다음 경우에는 반드시 Bash 도구로 직접 `echo 'PHASE_FAILED: ...' && exit 1`를 실행한다.

- dry-run이 DB 상태를 변경하는 경우.
- `--apply` 없이 자동 닫힘이 적용되는 경우.
- 불안정 source의 공고를 closed로 바꾸는 경우.
- `collected_positions.collectionRunId`만으로 3회 미등장을 판정하는 경우.
- cron 자동 apply를 추가하는 경우.
- plan075 산출물 또는 career-os docs/ADR/AGENTS를 수정한 경우.

---

## common-pitfalls self-check

- [x] 첫 bash 블록이 `cd "$(git rev-parse --show-toplevel)"`로 시작한다.
- [x] validator 기본값은 dry-run이다.
- [x] `--apply`와 `--max-changes` 경계가 테스트된다.
- [x] run item 기반으로 latest/absence를 판정한다.
- [x] source adapter 개선을 하지 않는다.

## 완료 기록

- 완료 시각: 2026-06-15 KST
- fos-career branch: `plan076-position-lifecycle-validation`
- 변경 요약:
  - `pnpm run validate:positions` CLI를 추가했다.
  - 기본 실행은 dry-run이며 `--apply`가 있을 때만 상태 변경과 이벤트를 적용한다.
  - `--max-changes` 기본값은 20이고 옵션으로 낮출 수 있다.
  - 최근 3회 미등장 판정은 `collected_position_run_items` 기준으로 구현했다.
  - `failed`, `skipped`, `blocked`, `parser_changed`, `unknown` 진단은 `validation_skipped` 대상으로 분리했다.
- 검증:
  - `pnpm exec tsc --noEmit`: 성공
  - `pnpm build`: 성공
  - `pnpm run validate:positions -- --dry-run`: 성공, `validationRunId=1`, `checkedCount=137`, 상태 변경 0건
  - `pnpm run validate:positions -- --dry-run --max-changes 1`: 성공, `validationRunId=2`, 상태 변경 0건
  - `git diff --check`: 성공
