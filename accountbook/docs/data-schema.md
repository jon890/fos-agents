# Data Schema: accountbook

이 문서는 비공개 OCR 후보와 등록 상태의 단일 소스다.
실제 값은 사용자별 비공개 루트에만 저장하고 git에 커밋하지 않는다.
경로 표의 `private/`는 `ACCOUNTBOOK_PRIVATE_DIR`가 지정한 루트를 뜻한다.
비우면 기존 `accountbook/private/`를 사용한다.

## 환경 변수

| 이름 | 필수 | 내용 |
|---|:---:|---|
| `ACCOUNTBOOK_API_BASE_URL` | 예 | `/api/v1`까지 포함한 공인 HTTPS 주소 |
| `ACCOUNTBOOK_API_TOKEN` | 예 | 사용자별 `fab_` 연동 토큰. 환경 변수로만 전달 |
| `ACCOUNTBOOK_FAMILY_UUID` | 이미지 등록만 | 거래를 등록할 가족 UUID. MCP에서 비우면 가족 목록으로 선택 |
| `ACCOUNTBOOK_PRIVATE_DIR` | 아니오 | 이미지 스킬의 사용자별 비공개 루트. 비우면 `accountbook/private/` |
| `ACCOUNTBOOK_DEFAULT_CATEGORY_NAME` | 아니오 | 후보에 분류가 없을 때 사용할 이름, 기본값 `미분류` |
| `ACCOUNTBOOK_EXCLUDE_FROM_BUDGET` | 아니오 | OCR 지출의 예산 제외 기본값, 기본값 `false` |

## 비공개 경로

| 경로 | 내용 | 삭제 기준 |
|---|---|---|
| `private/inbox/` | 처리할 원본 이미지 | 등록 완료 뒤 사용자 정책에 따라 삭제 |
| `private/inbox/new/` | 새 PNG와 보조 정보 파일 | 주간 실행이 가져갈 때 |
| `private/inbox/processing/` | 현재 처리 중인 입력 묶음 | 성공 또는 예외 판정 때 |
| `private/inbox/processed/` | 등록 완료 입력 묶음 | 사용자 정리 때 |
| `private/inbox/needs-review/` | 자동 등록 차단 입력 묶음 | 사용자 해결 때 |
| `private/inbox/failed/` | 형식 또는 확정 실행 실패 입력 묶음 | 사용자 해결 때 |
| `private/imports/<batch-id>/extracted.json` | 이미지 인식이 만든 원본 후보 | 원본 이미지와 같은 보존 기간 |
| `private/imports/<batch-id>/validated.json` | 정규화와 합계 검증 결과 | 등록 이력 확인 기간 |
| `private/imports/<batch-id>/approved.json` | 사용자 또는 주간 정책이 승인한 등록 입력 | 등록 이력 확인 기간 |
| `private/imports/<batch-id>/weekly-policy.json` | 주간 자동 승인 판정과 사유 | 등록 이력 확인 기간 |
| `private/state/submissions.json` | 후보별 API 전송 상태 | 등록 이력 확인 기간 |
| `private/state/weekly-import.json` | 이미지별 주간 처리 상태 | 등록 이력 확인 기간 |
| `private/state/<run-id>-<attempt-id>-plan.json` | 검증된 주간 입력과 실행 순서 | 주간 실행 확인 기간 |
| `private/state/locks/` | 실행 중 묶음 잠금 | 정상 종료 시 제거 |
| `private/state/locks/weekly-import.lock` | 주간 스킬 전체 실행 잠금 | 정상 종료 또는 만료 잠금 인계 시 제거 |

## 입력함 보조 정보 파일

업로드 어댑터는 같은 기본 이름의 PNG와 JSON을 함께 저장한다.
임시 확장자로 두 파일을 모두 쓴 뒤 JSON을 마지막에 최종 이름으로 바꿔 완성된 입력임을 표시한다.

| 필드 | 형식 | 제약 |
|---|---|---|
| `schemaVersion` | `1` | 고정 |
| `source` | `ios-shortcut`, `hermes-discord` | 입력 경로 |
| `imageFile` | 기본 파일명 | 절대 경로와 경로 구분자 금지 |
| `capturedAt` | RFC 3339 datetime | iPhone 원본 생성 시각 또는 Discord 수신 시각 |
| `receivedAt` | RFC 3339 datetime | 홈서버 수신 시각 |

PNG의 SHA-256은 서버가 직접 계산한다.
보조 정보 파일이 없거나 `capturedAt`이 유효하지 않으면 대화형 검토는 가능하지만 주간 자동 승인에는 사용할 수 없다.
`ios-shortcut`은 사진 원본 생성 시각을 `capturedAt`에 기록한다.
`hermes-discord`는 Discord가 원본 생성 시각을 보장하지 않으므로 Hermes가 첨부 파일을 받은 시각을 `capturedAt`과 `receivedAt`에 기록한다.
Discord 입력은 `Asia/Seoul` 달력 날짜를 수신일로 사용한다.
선택한 거래 날짜가 이 수신일 기준 최근 14일 안에 있을 때만 연도를 자동 판단한다.

## 추출 입력

`extracted.json`은 다음 최상위 필드를 가진다.

| 필드 | 형식 | 제약 |
|---|---|---|
| `schemaVersion` | `1` | 고정 |
| `source` | `toss-consumption-screenshot` | 고정 |
| `sourceImage` | 객체 | 파일명, SHA-256, 생성 시각, 크기 |
| `extraction` | 객체 | `engine`, `runtime`, 추출 시각 |
| `reviewStatus` | `pending` 또는 `approved` | 추출 시 `pending` |
| `days` | 배열 | 날짜별 추출 결과 |

`sourceImage`에는 절대 경로를 저장하지 않는다.

## 날짜와 거래

날짜 객체는 다음 필드를 가진다.

| 필드 | 형식 | 제약 |
|---|---|---|
| `date` | `YYYY-MM-DD` | 유효한 날짜 |
| `dateSource` | `screen`, `file-metadata`, `upload-metadata`, `user-confirmed` | 연도 근거 포함 |
| `dateEvidence` | 객체 또는 `null` | 화면에서 읽은 월·일과 연도 근거 |
| `completeness` | `complete`, `partial` | 잘린 날짜 구분 |
| `selectedForImport` | boolean | `partial`은 `false` |
| `expectedTotals` | 객체 또는 `null` | 화면 일별 수입·지출 합계 |
| `transactions` | 배열 | 화면 위에서 아래 순서 |

`dateEvidence`는 기존 대화형 산출물 호환을 위해 `null`을 허용하지만 주간 자동 승인에는 필수다.

| 필드 | 형식 | 제약 |
|---|---|---|
| `screenMonth` | 1~12 정수 | 화면 월 선택 영역에서 읽은 값 |
| `screenDay` | 1~31 정수 | 화면 날짜 제목에서 읽은 값 |
| `yearSource` | `screen`, `file-metadata`, `upload-metadata`, `user-confirmed` | 정규화한 연도의 근거 |

주간 자동 승인은 `screenMonth`와 `screenDay`가 정규화된 `date`의 월·일과 같아야 한다.
`yearSource`가 `screen`이면 날짜 `high`, `upload-metadata`이면 날짜 `medium`만 허용한다.
전체 날짜를 보조 정보 파일의 원본 생성 시각에서 만든 후보는 승인하지 않는다.

거래 객체는 다음 필드를 가진다.

| 필드 | 형식 | 제약 |
|---|---|---|
| `rowIndex` | 양의 정수 | 같은 날짜에서 유일 |
| `type` | `expense`, `income` | 필수 |
| `amount` | 양의 정수 | 원 단위 |
| `description` | 문자열 | 화면의 거래 설명 |
| `paymentMethod` | 문자열 또는 `null` | 화면에 있을 때만 |
| `categoryName` | 문자열 또는 `null` | 없으면 기본 카테고리 사용 |
| `confidence` | 객체 | amount, description, date별 `high`, `medium`, `low` |
| `evidence` | 객체 | 금액과 상세 OCR 원문 |

화면에 거래 시각이 없으면 accountbook API의 `date`에는 해당 날짜 `12:00:00`을 사용한다.
이 값은 실제 거래 시각이 아니라 날짜 보존을 위한 기술 값이다.

## 검증 결과

검증기는 `batchId`, 거래별 `candidateId`와 다음 상태를 추가한다.

| 상태 | 의미 |
|---|---|
| `exact` | 상세 합계와 화면 요약이 일치 |
| `mismatch` | 수입 또는 지출 합계 불일치 |
| `incomplete` | 날짜가 화면에서 잘림 |
| `unavailable` | 화면 요약을 추출하지 못함 |

`submissionReady`는 선택된 날짜가 모두 `exact`이고 필수 필드에 `low`가 없으며, 선택 거래가 하나 이상일 때만 `true`다.
`medium` 필드는 미리보기에서 확인 사유로 표시한다.

## 전송 상태

`submissions.json`은 묶음과 후보별 상태를 저장한다.

| 상태 | 의미 |
|---|---|
| `pending` | 전송 전 |
| `submitting` | POST 직전 상태 기록 완료 |
| `submitted` | API가 원격 UUID를 반환 |
| `recovered` | 불명확한 전송 뒤 기존 거래 조회로 성공 확인 |
| `needs_review` | 기존 동일 거래 또는 복구 모호성 발견 |
| `failed` | 확정된 API 실패 |

승인된 후보는 다음 필드를 가진다.

| 필드 | 형식 | 제약 |
|---|---|---|
| `approvalSource` | `user`, `weekly-policy` | 승인 주체 |
| `approvalPolicyVersion` | 문자열 또는 `null` | 주간 자동 승인은 `weekly-safe-v1`, 사용자 승인은 `null` |
| `reviewedAt` | RFC 3339 datetime | 승인 시각 |

사용자 승인과 주간 정책 승인은 모두 `approved.json`을 만들고 `submit_import.ts`는 이 파일만 입력으로 받는다.
`weekly-policy.json`은 판정 근거를 보존하는 감사용 산출물이며 등록 입력으로 사용하지 않는다.

`weekly-policy.json`은 다음 필드를 가진다.

| 필드 | 형식 | 제약 |
|---|---|---|
| `policyVersion` | `weekly-safe-v1` | 고정 |
| `eligible` | boolean | 모든 자동 승인 조건 통과 여부 |
| `reasons` | 문자열 배열 | 민감 본문이 없는 안정된 차단 사유 코드 |
| `evaluatedAt` | RFC 3339 datetime | 판정 시각 |

주간 실행 계획은 `schemaVersion: 1`, `runId`, `queuePath`와 `items` 배열을 가진다.
각 항목은 `imageSha256`과 `validatedPath`를 포함하며 모든 경로는 `private/` 안에 있어야 한다.
실행기는 작업 목록에서 아직 `processing`인 이미지 집합과 실행 계획의 이미지 집합이 정확히 같은지 확인하고 보조 정보 파일 경로는 작업 목록에서만 가져온다.
결정적 주간 실행기는 모든 항목의 날짜 충돌 검사를 끝낸 뒤에만 등록을 시작한다.
주간 등록은 `approvalSource: weekly-policy`, `approvalPolicyVersion: weekly-safe-v1` 조합만 허용한다.

## 주간 처리 상태

`weekly-import.json`은 `schemaVersion: 1`, `policyVersion: weekly-safe-v1`과 이미지 SHA-256을 키로 하는 `items` 객체를 가진다.

| 필드 | 형식 | 제약 |
|---|---|---|
| `status` | `queued`, `processing`, `submitted`, `needs_review`, `failed` | 이미지 처리 상태 |
| `batchId` | 문자열 또는 `null` | 추출 뒤 생성된 묶음 ID |
| `attempts` | 0 이상의 정수 | 처리 시작 횟수 |
| `lastErrorCode` | 허용된 문자열 또는 `null` | 민감 본문이 없는 안정된 오류 코드 |
| `selectedDates` | `YYYY-MM-DD` 문자열 배열 | 검증기가 선택한 날짜, 중복 없는 정렬값 |
| `updatedAt` | RFC 3339 datetime | 마지막 상태 변경 시각 |

주간 상태 JSON은 원자적으로 교체하고 마지막 줄바꿈을 포함한다.

`lastErrorCode`는 스크립트가 정의한 열거값만 허용한다.
OCR 원문, 거래 설명, API 응답 본문과 예외 메시지를 그대로 저장하지 않는다.

`weekly-import.lock`은 `schemaVersion: 1`, `runId`, `lockedAt`을 가진 권한 `0600` JSON이다.
`runId`는 한 번의 스킬 실행에서 고정하며 잠금 해제 때 일치해야 한다.
다른 실행 ID는 `lockedAt`부터 24시간 동안 잠금을 인계할 수 없다.

모든 JSON 파일은 마지막 줄바꿈을 포함한다.
`private/` 하위 디렉터리는 `0700`, 파일은 `0600` 권한을 사용한다.

## 사용자 격리와 인증 이관

fos-assistant는 profile마다 다른 `ACCOUNTBOOK_API_TOKEN`과 `ACCOUNTBOOK_PRIVATE_DIR`를 전달한다.
공용 fos-agents 마운트의 `accountbook/private`를 여러 profile이 공유하지 않는다.
이미지 스킬은 `resolve_private_root.ts`로 선택된 루트를 확인하고, 모든 입력함·작업 경로·상태 경로를 그 아래에 둔다.
이 분리는 실행 환경이 맡으며, 루트만 바꾸면 기존 상태가 자동 이관되지는 않는다.
기존 이미지와 전송 상태를 옮길 때는 해당 사용자의 비공개 루트로 함께 옮긴다.
과거 인증 상태 파일은 읽거나 갱신하지 않는다. 기존 파일은 사용자 확인 뒤 삭제한다.
MCP 서버는 파일 상태를 저장하지 않으며 profile마다 별도 프로세스와 환경 변수로 실행한다.
Hermes가 치환하지 못해 값이 `${`로 시작하면 설정되지 않은 변수로 다룬다.
선택 변수는 기본값을 사용하고 필수 변수는 `ACCOUNTBOOK_CONFIG`로 중단한다.
연동 토큰은 가계부에서 발급하고 폐기하며, 자동 갱신하거나 파일에 저장하지 않는다.

## MCP 계약

입력 스키마 정본은 [tools.ts](../plugin/src/tools.ts)에 있다.
도구 이름은 `list_families`, `list_categories`, `list_expenses`, `list_incomes`,
`get_expense`, `get_income`, `create_expense`, `create_income`, `update_expense`, `update_income`, `delete_expense`, `delete_income`이다.
Hermes에서는 서버 이름 `accountbook`을 사용해 `mcp__accountbook__<도구>`로 노출한다.

- 가족은 선택 입력 `familyUuid`, 거래 대상은 `transactionUuid`로 지정한다. UUID는 조회 결과에서 고른다.
- 목록은 `startDate`, `endDate`(유효한 `YYYY-MM-DD`), `limit`(1~100, 기본 20), `page`(0부터)를 받는다.
- 등록은 양수 `amount`(정수 최대 10자리, 소수 최대 2자리), `date`(timezone 없는 `LocalDateTime`), `categoryUuid` 또는 `categoryName` 중 하나를 받는다.
- `description`은 최대 1000자이며, 지출만 `excludeFromBudget`을 받는다.
- 수정은 바꿀 필드만 받으며 카테고리 UUID와 이름을 동시에 받지 않는다. 수정과 삭제의 `confirmed: true`는 스킬이 사용자의 확인을 받은 뒤에만 전달한다.
- 가족 목록은 `{ families, defaultFamilyUuid }`, 카테고리는 `{ uuid, name }[]`를 반환한다.
- 거래 응답은 REST API의 `data`를 MCP text JSON으로 전달한다. 목록은 `items`, `totalElements`, `totalPages`, `currentPage`를 가진다.
- 삭제는 HTTP 2xx 응답의 `data`가 없거나 `null`이면 성공으로 처리한다. HTTP 204도 성공으로 처리한다.
- 오류는 MCP `isError: true`와 `{ error: { code, message } }`로 반환한다. 입력 단계의 프로토콜 스키마 오류는 SDK가 MCP 오류로 반환한다.

| 오류 코드 | 조건 |
|---|---|
| `ACCOUNTBOOK_UNAUTHORIZED` | 401. 가계부 설정에서 토큰 재발급과 fos-assistant 재등록 안내 |
| `ACCOUNTBOOK_FORBIDDEN` | 403 또는 접근할 수 없는 기본 가족 |
| `ACCOUNTBOOK_NOT_FOUND` | 404 |
| `ACCOUNTBOOK_BAD_REQUEST` | 나머지 HTTP 4xx |
| `ACCOUNTBOOK_UNAVAILABLE` | HTTP 5xx |
| `ACCOUNTBOOK_NETWORK` | 연결, redirect, timeout 실패. 변경 결과 재조회 필요 |
| `ACCOUNTBOOK_INVALID_RESPONSE` | JSON 또는 필수 응답 구조를 확인할 수 없음 |
| `ACCOUNTBOOK_CONFIG` | 주소, 토큰, 기본 가족 설정 오류 |
| `ACCOUNTBOOK_INVALID_INPUT` | 도구 입력 검증 실패 |
| `ACCOUNTBOOK_FAMILY_SELECTION`, `ACCOUNTBOOK_NO_FAMILY` | 가족 선택 필요 또는 가족 없음 |
| `ACCOUNTBOOK_CATEGORY_SELECTION` | 카테고리가 없거나 이름이 중복됨 |
| `ACCOUNTBOOK_UNKNOWN_TOOL`, `ACCOUNTBOOK_INTERNAL` | 지원하지 않는 도구 또는 내부 처리 실패 |
