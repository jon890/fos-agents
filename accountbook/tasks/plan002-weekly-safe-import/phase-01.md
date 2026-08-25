# Phase 01: 주간 inbox queue와 상태 전이 구현

**Execution profile**: standard

## 목표

sidecar manifest가 완성된 신규 PNG를 SHA-256 기준으로 한 번만 claim하고, 주간 실행의 성공·검토·실패 상태를 private 파일에 원자적으로 기록한다.

**범위 외**: vision 추출, `weekly-safe-v1` 판정과 accountbook API 호출은 이 phase에서 구현하지 않는다.

## 작업 항목 (5)

### 1. inbox와 상태 계약

`accountbook/scripts/accountbook-weekly-import/contracts.ts`에 `accountbook/docs/data-schema.md`와 일치하는 sidecar manifest, `selectedDates`를 포함한 weekly state, queue item Zod schema와 TypeScript 타입을 구현한다.

### 2. 신규 입력 scan과 claim

`accountbook/scripts/accountbook-weekly-import/scan_inbox.ts`에 `scanAndClaimInbox(options): WeeklyWorkItem[]`을 구현한다.
같은 basename의 PNG와 JSON이 모두 있어야 하며, manifest의 basename·시각을 검증하고 PNG SHA-256을 서버에서 계산한다.
처리 이력이 없는 입력 묶음만 `new`에서 `processing`으로 원자 이동하고, 빈 queue는 오류가 아닌 빈 배열을 반환한다.
`scan_inbox.ts --private-root <path> --run-id <id> --output <queue.json>` CLI는 mode `0600` queue JSON을 쓰고 skill 전체 수명 동안 유지되는 lease lock을 획득한다.
같은 run ID는 재개를 허용하고 다른 run ID는 24시간 전 lock이면 `WEEKLY_IMPORT_LOCKED`로 차단한다.

### 3. 상태 완료 helper

`accountbook/scripts/accountbook-weekly-import/finalize_inbox.ts`에 `recordValidatedDates(options): void`와 `finalizeInboxItem(options): void`를 구현한다.
`recordValidatedDates`는 validator가 선택한 날짜를 중복 없는 정렬 배열로 상태에 기록한다.
허용 상태는 `submitted`, `needs_review`, `failed`이며 이미지와 manifest를 대응 디렉터리로 이동하고 `weekly-import.json`을 mode `0600` 임시 파일로 쓴 뒤 원자 교체한다.
CLI는 `record-dates`, `finalize`, `release-lock` action을 제공하고 lock 해제는 생성한 run ID가 일치할 때만 허용한다.

### 4. 중단 복구 reconciliation

scan 시작 시 `new`, `processing`, terminal 디렉터리와 `weekly-import.json`을 대조한다.
두 rename 사이에 갈라진 pair는 `processing`으로 모으고, state write 전에 모두 이동된 pair는 SHA-256 기준 `processing` item으로 복원한다.
terminal state인데 pair가 `processing`에 있으면 이동을 끝내고, terminal 디렉터리의 pair가 state에서 `processing`이면 디렉터리 상태로 state를 보정한다.
복구는 accountbook API를 호출하지 않으며 결정할 수 없는 입력은 `failed`로 격리한다.

### 5. 잠금·복구·권한 회귀 테스트

`accountbook/scripts/accountbook-weekly-import/inbox_queue.test.ts`에서 빈 inbox, 미완성 pair, 정상 claim, SHA-256 재실행 skip, 선택 날짜 기록, 같은 run ID 재개, 다른 run ID 충돌, stale lock 인계와 디렉터리 `0700`·파일 `0600`을 검증한다.
image만 이동된 split pair, pair 이동 뒤 state 누락, terminal 이동 뒤 state가 `processing`인 fixture를 각각 만들어 다음 scan에서 stuck 없이 수렴하는지 검증한다.
lock 생성 실패는 `EEXIST`만 `WEEKLY_IMPORT_LOCKED`로 변환하고 다른 파일시스템 오류는 보존한다.

## Critical Files

| 파일 | 변경 |
|---|---|
| `accountbook/scripts/accountbook-weekly-import/contracts.ts` | 신규 |
| `accountbook/scripts/accountbook-weekly-import/scan_inbox.ts` | 신규 |
| `accountbook/scripts/accountbook-weekly-import/finalize_inbox.ts` | 신규 |
| `accountbook/scripts/accountbook-weekly-import/inbox_queue.test.ts` | 신규 |

## 검증

보고 직전 반드시 다음 명령을 실행하고 원시 결과를 확인한다.

```bash
# cwd: fos-agents root
cd "$(git rev-parse --show-toplevel)"
pwd
bun test accountbook/scripts/accountbook-weekly-import/inbox_queue.test.ts
bunx tsc --noEmit --strict --skipLibCheck --target ESNext --module ESNext --moduleResolution bundler --allowImportingTsExtensions --types bun-types accountbook/scripts/accountbook-weekly-import/*.ts
```

## 의도 메모

- 디렉터리 이동과 private 상태를 queue로 사용해 별도 DB와 workflow 서버를 도입하지 않는다.
- 이미지 본문과 OCR 원문은 stdout과 오류 코드에 포함하지 않는다.
