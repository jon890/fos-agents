# Phase 02: weekly-safe-v1 자동 승인 정책 구현

**Execution profile**: standard

## 목표

사용자가 확인한 `weekly-safe-v1` 조건을 결정적 함수로 판정하고, 통과한 후보에만 정책 승인 출처를 기록한다.

**범위 외**: inbox scan과 agent skill 작성은 각각 phase 01과 phase 03의 책임이다.

## 작업 항목 (5)

### 1. 날짜와 승인 계약 확장

`accountbook/scripts/accountbook-screenshot-import/contracts.ts`의 `dateSource`에 `upload-metadata`를 추가한다.
날짜 객체에는 화면에서 읽은 `screenMonth`, `screenDay`와 `yearSource`를 가진 nullable `dateEvidence`를 추가해 기존 대화형 JSON을 호환한다.
승인 후보에 `approvalSource: user | weekly-policy`, `approvalPolicyVersion: weekly-safe-v1 | null`을 추가하고 기존 대화형 승인 JSON을 호환한다.

### 2. 원본 생성 시각 입력

`accountbook/scripts/accountbook-screenshot-import/inspect_source.ts`에 RFC 3339 `--captured-at` 선택 인자를 추가한다.
주간 실행은 sidecar 값을 전달하고, 인자가 없으면 기존 파일 metadata 동작을 유지한다.

### 3. 자동 승인 정책 함수

`accountbook/scripts/accountbook-weekly-import/evaluate_policy.ts`에 `evaluateWeeklySafePolicy(validated, manifest, now): WeeklyPolicyDecision`과 정책 승인 파일 생성 함수를 구현한다.
`submissionReady`, 선택 날짜 `exact`, 필수 `dateEvidence`의 화면 월·일 일치, 금액·설명 `high`, 화면 연도 기반 날짜 `high` 또는 `upload-metadata` 연도 기반 날짜 `medium`, 원본 생성 시각의 미래·14일 초과 여부를 각각 안정된 reason code로 판정한다.
판정 결과는 감사용 `weekly-policy.json`에 기록하고 통과하면 submit 전용 `approved.json`을 별도로 만든다.
두 파일은 mode `0600`이며 차단은 exit code `3`, 입력 오류는 exit code `2`를 사용한다.

### 4. 기존 승인과 submit 연결

`accountbook/scripts/accountbook-screenshot-import/approve_import.ts`는 대화형 승인에 `approvalSource: user`를 기록한다.
`submit_import.ts`는 사용자 승인과 `weekly-safe-v1` 정책 승인을 모두 허용하되 승인 출처·정책 버전 조합이 잘못되면 API 호출 전에 차단한다.

### 5. 정책 회귀 테스트

금액·설명 `high`와 날짜만 화면 월·일 및 `upload-metadata` 연도 기반 `medium`인 후보의 승인, 날짜 `high` 승인, 전체 날짜를 upload metadata로 만든 후보 차단, 화면 월·일 불일치, 설명 `medium`, `low`, stale·future 생성 시각 차단을 검증한다.
정책 승인 조합 변조, `weekly-policy.json`을 submit에 직접 전달한 경우와 미승인 입력은 API 호출 0회인지 검증한다.

## Critical Files

| 파일 | 변경 |
|---|---|
| `accountbook/scripts/accountbook-screenshot-import/contracts.ts` | 수정 |
| `accountbook/scripts/accountbook-screenshot-import/inspect_source.ts` | 수정 |
| `accountbook/scripts/accountbook-screenshot-import/approve_import.ts` | 수정 |
| `accountbook/scripts/accountbook-screenshot-import/submit_import.ts` | 수정 |
| `accountbook/scripts/accountbook-weekly-import/evaluate_policy.ts` | 신규 |
| `accountbook/scripts/accountbook-weekly-import/evaluate_policy.test.ts` | 신규 |

## 검증

보고 직전 반드시 다음 명령을 실행하고 원시 결과를 확인한다.

```bash
# cwd: fos-agents root
cd "$(git rev-parse --show-toplevel)"
pwd
bun test accountbook/scripts/accountbook-screenshot-import accountbook/scripts/accountbook-weekly-import
bunx tsc --noEmit --strict --skipLibCheck --target ESNext --module ESNext --moduleResolution bundler --allowImportingTsExtensions --types bun-types accountbook/scripts/accountbook-screenshot-import/*.ts accountbook/scripts/accountbook-weekly-import/*.ts
```

## 의도 메모

- 정책 판정은 agent 문장이 아니라 버전이 고정된 TypeScript 함수가 소유한다.
- 화면의 월·일과 원본 생성 시각의 연도 조합만 허용하고 서버 수신 시각으로 날짜를 확정하지 않는다.
