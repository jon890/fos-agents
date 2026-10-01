# Data Schema: accountbook

이 문서는 화면 추출 입력과 MCP 계약의 단일 소스다.
이미지, 거래 후보와 등록 결과는 파일로 저장하지 않는다.

## 환경 변수

| 이름 | 필수 | 내용 |
|---|:---:|---|
| `ACCOUNTBOOK_API_BASE_URL` | 예 | `/api/v1`까지 포함한 공인 HTTPS 주소 |
| `ACCOUNTBOOK_API_TOKEN` | 예 | 사용자별 `fab_` 연동 토큰. 환경 변수로만 전달 |
| `ACCOUNTBOOK_FAMILY_UUID` | 아니오 | 기본 가족 UUID. 비우면 가족 목록으로 선택 |

MCP 서버는 profile마다 별도 프로세스와 환경 변수로 실행하며 파일 상태를 저장하지 않는다.
값이 `${`로 시작하면 치환되지 않은 변수 참조이므로 설정되지 않은 것으로 다룬다.
선택 변수는 기본값을 사용하고 필수 변수는 `ACCOUNTBOOK_CONFIG`로 중단한다.
연동 토큰은 가계부에서 발급하고 폐기하며, 자동 갱신하거나 파일에 저장하지 않는다.

## 화면 추출 입력

스키마 정본은 [screenshot-contracts.ts](../plugin/src/screenshot-contracts.ts)다.
`preview_screenshot_import`와 `submit_screenshot_import`는 같은 입력을 받는다.

| 필드 | 형식 | 제약 |
|---|---|---|
| `familyUuid` | UUID | 선택. 없으면 기본 가족 |
| `days` | 배열 | 1~31개의 날짜별 추출 결과 |
| `defaultCategoryName` | 문자열 | 선택. `categoryName`이 없는 거래에 쓰며 거래 종류와 같은 카테고리만 허용 |
| `confirmBatchId` | `toss-` 뒤 16자리 hex | 등록 도구만. 사용자가 확인한 미리보기의 묶음 ID |
| `confirmed` | `true` | 등록 도구만. 사용자 확인을 받은 때에만 전달 |

날짜 객체는 다음 필드를 가진다.

| 필드 | 형식 | 제약 |
|---|---|---|
| `date` | `YYYY-MM-DD` | 유효한 날짜. 선택한 날짜는 오늘의 한국 날짜보다 미래일 수 없다 |
| `dateSource` | `screen`, `received-date`, `user-confirmed` | 연도의 근거 |
| `dateEvidence` | 객체 | 화면에서 읽은 `screenMonth`, `screenDay`와 `yearSource`. 월·일이 `date`와 같아야 한다 |
| `completeness` | `complete`, `partial` | 잘린 날짜 구분 |
| `selectedForImport` | boolean | 선택. `partial`은 값과 관계없이 제외 |
| `expectedTotals` | 객체 또는 `null` | 화면 일별 수입·지출 합계 |
| `transactions` | 배열 | 화면 위에서 아래 순서. 날짜당 최대 200건 |

`received-date`는 화면에 연도가 없어 요청을 받은 날의 한국 날짜로 연도를 추정했다는 뜻이다.

거래 객체는 다음 필드를 가진다.

| 필드 | 형식 | 제약 |
|---|---|---|
| `rowIndex` | 양의 정수 | 같은 날짜에서 유일 |
| `type` | `expense`, `income` | 필수 |
| `amount` | 양의 정수 | 원 단위. 9,999,999,999 이하 |
| `description` | 문자열 | 화면의 거래 설명. 1~1000자 |
| `paymentMethod` | 문자열 또는 `null` | 화면에 있을 때만. 200자 이하. 등록할 때 `설명 \| 결제수단`으로 합친다 |
| `categoryName` | 문자열 또는 `null` | 50자 이하. 없으면 `defaultCategoryName` 사용 |
| `confidence` | 객체 | `amount`, `description`, `date`별 `high`, `medium`, `low` |
| `evidence` | 객체 | 화면에서 읽은 금액과 설명 원문. 묶음 ID에 들어가지 않는다 |

화면에 거래 시각이 없으므로 accountbook API의 `date`에는 해당 날짜 `12:00:00`을 사용한다.
이 값은 실제 거래 시각이 아니라 날짜 보존을 위한 기술 값이다.
화면 가져오기는 지출의 `excludeFromBudget`을 보내지 않으므로 API 기본값을 따른다.
설명과 카테고리 이름은 앞뒤 공백을 떼고 연속 공백을 하나로 줄여 비교하고 등록한다.

## 미리보기 결과

| 필드 | 내용 |
|---|---|
| `batchId` | 가족, 기본 카테고리, 날짜별 거래 내용과 새로 등록할 후보 목록의 SHA-256 앞 16자리에 `toss-`를 붙인 값 |
| `submissionReady` | `blockers`가 없고 새로 등록할 거래가 하나 이상일 때만 `true` |
| `pendingCount` | 새로 등록할 거래 수 |
| `alreadyRegisteredCount` | 기존 기록과 짝이 지어져 건너뛸 거래 수 |
| `blockers` | 등록을 막는 사유 |
| `warnings` | 확인이 필요한 사유 |
| `days` | 날짜별 `status`, 화면 합계, 계산 합계와 수입·지출 건수 |
| `candidates` | 선택된 거래의 `candidateId`, 날짜, 종류, 금액, 설명, 카테고리, `reviewReasons`, `existingMatch`, `existingUuid`, `existingMatchKind` |

날짜의 `status`는 다음과 같다.

| 상태 | 의미 |
|---|---|
| `exact` | 상세 합계와 화면 요약이 일치 |
| `mismatch` | 수입 또는 지출 합계 불일치 |
| `incomplete` | 날짜가 화면에서 잘림 |
| `unavailable` | 화면 요약을 추출하지 못함 |

`blockers`의 사유는 다음과 같다. 날짜 단위 사유는 `<날짜>:`, 거래 단위 사유는 `<candidateId>:`가 앞에 붙는다.
`no_complete_day_selected`와 `too_many_transactions`는 묶음 전체의 사유라 접두어가 없다.

| 사유 | 조건 |
|---|---|
| `no_complete_day_selected` | 선택된 완전한 날짜가 없음 |
| `daily_totals_mismatch`, `expected_totals_unavailable` | 일별 합계가 다르거나 화면 요약이 없음 |
| `low_confidence_required_field` | 선택된 거래에 `low` 신뢰도 필드가 있음 |
| `duplicate_row_index`, `no_transactions`, `duplicate_date` | 행 번호 중복, 거래 없는 날짜, 같은 날짜가 두 번 |
| `date_in_future`, `date_evidence_mismatch` | 미래 날짜 또는 화면 월·일과 다른 날짜 |
| `date_source_mismatch` | `dateSource`와 `dateEvidence.yearSource`가 다름 |
| `inferred_year_too_old` | 연도를 추정했는데 날짜가 오늘보다 1년 이상 앞섬 |
| `category_required`, `category_not_found` | 카테고리가 없거나 해당 거래 종류의 목록에서 하나로 정해지지 않음 |
| `description_too_long` | 결제수단을 합친 설명이 1000자를 넘음 |
| `too_many_transactions` | 선택된 거래가 100건을 넘음 |

`warnings`는 `partial_day_excluded`, `year_inferred_from_received_date`, `field_confidence_requires_review`다.

`existingMatch`가 `true`인 거래는 같은 날짜와 금액의 기존 기록 가운데 설명이 같은 것과 짝이 지어진 거래다.
결제수단까지 합친 설명이 같은 기록을 먼저 짝짓고(`existingMatchKind: exact`), 남은 거래를 결제수단을 뺀 설명이 같은 기록과 짝짓는다(`description-only`).
기록 하나는 거래 한 건과만 짝이 된다.
짝이 지어진 거래는 등록하지 않으며 카테고리 사유로 막지 않는다.
`blockers`가 없고 `pendingCount`가 0이면 화면의 거래가 모두 이미 등록된 상태다.

## 등록 결과

성공하면 `{ batchId, status: "completed", submitted, created }`를 반환한다.
새로 등록할 거래가 없으면 등록 요청 없이 `submitted: 0`으로 성공한다.
`created`의 각 항목은 `candidateId`, `date`, `type`, `amount`와 원격 `uuid`다.

| 오류 코드 | 조건 | 추가 필드 |
|---|---|---|
| `ACCOUNTBOOK_IMPORT_CONFIRMATION_MISMATCH` | 다시 계산한 묶음 ID가 `confirmBatchId`와 다름 | 없음 |
| `ACCOUNTBOOK_IMPORT_IN_PROGRESS` | 같은 가족과 같은 내용의 등록 요청이 같은 프로세스에서 진행 중임 | 없음 |
| `ACCOUNTBOOK_IMPORT_NOT_SUBMITTABLE` | `blockers`가 있음 | `batchId`, `blockers` |
| `ACCOUNTBOOK_IMPORT_PARTIAL` | 등록 도중 요청이 실패함 | `batchId`, `cause`, `created`, `uncertain`, `notSubmitted` |

`ACCOUNTBOOK_IMPORT_PARTIAL`을 뺀 오류는 이 호출에서 등록 요청을 하나도 보내지 않는다.
불일치 오류는 새 묶음 ID를 알려 주지 않는다. 묶음 ID는 미리보기에서만 얻는다.
`ACCOUNTBOOK_IMPORT_PARTIAL`의 `uncertain`은 네트워크 오류나 5xx로 실패해 저장됐는지 알 수 없는 한 건이다.
4xx로 거절된 건은 저장되지 않았으므로 `uncertain`은 `null`이고 그 건이 `notSubmitted`의 첫 항목이다.
첫 요청이 4xx로 거절되면 등록된 것이 없으므로 `ACCOUNTBOOK_UNAUTHORIZED` 같은 원래 오류 코드를 반환한다.
서버는 실패 뒤 남은 거래를 보내지 않고 자동으로 다시 시도하지 않는다.
미리보기를 다시 만들면 등록된 거래가 `existingMatch`로 나오므로 남은 거래만 새 묶음 ID로 등록한다.
기존 기록이 달라지면 묶음 ID도 달라지므로, 앞서 확인한 ID로 다시 보내면 불일치 오류다.
기존 기록 조회가 날짜당 100페이지를 넘으면 `ACCOUNTBOOK_SUMMARY_LIMIT`로 중단한다.

## MCP 계약

입력 스키마 정본은 [tools.ts](../plugin/src/tools.ts)에 있다.
도구 이름은 `list_families`, `list_categories`, `list_expenses`, `list_incomes`,
`summarize_expenses`, `summarize_incomes`,
`get_expense`, `get_income`, `create_expense`, `create_income`, `update_expense`, `update_income`, `delete_expense`, `delete_income`,
`preview_screenshot_import`, `submit_screenshot_import`다.
Hermes에서는 서버 이름 `accountbook`을 사용해 `mcp__accountbook__<도구>`로 노출한다.
`list_`, `get_`, `summarize_`, `preview_`로 시작하는 도구는 읽기 전용으로 표시한다. 기록을 바꾸는 도구는 `create_`, `update_`, `delete_`, `submit_`이다.

- 가족은 선택 입력 `familyUuid`, 거래 대상은 `transactionUuid`로 지정한다. UUID는 조회 결과에서 고른다.
- 목록은 `startDate`, `endDate`(유효한 `YYYY-MM-DD`), `limit`(1~100, 기본 20), `page`(0부터)를 받는다.
- 기간 합계는 `startDate`, `endDate`가 필수이며 시작일은 종료일보다 늦을 수 없다.
  기존 목록 API를 페이지당 100건으로 최대 100페이지까지 읽고 카테고리 목록은 한 번 읽는다.
  응답은 `familyUuid`, `startDate`, `endDate`, `count`, `totalAmount`, `excludedFromBudgetAmount`, `categories`를 가진다.
  `categories`의 각 항목은 `categoryUuid`, `categoryName`, `count`, `totalAmount`를 가진다. 이름을 찾지 못하면 `categoryName`은 `null`이다.
  금액은 소수 둘째 자리까지 있는 문자열이다. 각 금액을 정수로 변환해 더하므로 소수 오차가 없다.
  전체 합계에는 예산 제외 지출도 포함되며 `excludedFromBudgetAmount`는 그 지출만 합산한다. 수입에서는 `0.00`이다.
  상한 초과, 페이지 오류, 중복 기록이나 조회 중 건수 변경이 발견되면 부분 합계를 반환하지 않는다.
- 등록은 양수 `amount`(정수 최대 10자리, 소수 최대 2자리), `date`(timezone 없는 `LocalDateTime`), `categoryUuid` 또는 `categoryName` 중 하나를 받는다.
- 지출 등록·수정은 `EXPENSE`, 수입 등록·수정은 `INCOME` 카테고리에서만 이름이나 UUID를 찾는다.
  다른 종류를 선택하면 변경 요청 없이 `ACCOUNTBOOK_CATEGORY_SELECTION`과 해당 종류의 이름 목록을 반환한다.
  화면 가져오기도 거래의 `expense`와 `income`에 따라 같은 종류에서 이름을 찾는다.
  수입과 지출이 섞인 화면에서는 거래별 `categoryName`을 지정한다.
- `description`은 최대 1000자이며, 지출만 `excludeFromBudget`을 받는다.
- 수정은 바꿀 필드만 받으며 카테고리 UUID와 이름을 동시에 받지 않는다.
  MCP 입력 스키마에서 수정과 삭제는 `confirmed: true`가 필수다.
  스킬은 승인 기능이 제공된 환경에서만 사용자 확인 뒤 수정 도구에 이 값을 전달하며 사용자 승인 절차를 따른다.
  삭제 도구는 호출하지 않고 가계부 앱에서 직접 지우도록 안내한다.
- 가족 목록은 `{ families, defaultFamilyUuid }`, 카테고리는 `{ uuid, name, type }[]`를 반환한다.
  카테고리의 `type`은 `EXPENSE` 또는 `INCOME`이며 API 응답에 반드시 있어야 한다.
  가족별 기본 카테고리는 지출 「미분류」와 수입 「기타 수입」이다.
  이름이나 UUID를 생략하면 기본 카테고리를 자동 선택하지 않는다.
- 거래 응답은 REST API의 `data`를 MCP text JSON으로 전달한다. 목록은 `items`, `totalElements`, `totalPages`, `currentPage`를 가진다.
- 삭제는 HTTP 2xx 응답의 `data`가 없거나 `null`이면 성공으로 처리한다. HTTP 204도 성공으로 처리한다.
- 화면 가져오기 도구의 입력과 결과는 위 「화면 추출 입력」, 「미리보기 결과」, 「등록 결과」를 따른다.
- 오류는 MCP `isError: true`와 `{ error: { code, message } }`로 반환한다. 화면 가져오기 오류는 같은 객체에 추가 필드를 더한다. 입력 단계의 프로토콜 스키마 오류는 SDK가 MCP 오류로 반환한다.

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
| `ACCOUNTBOOK_CATEGORY_SELECTION` | 거래 종류에 맞는 카테고리가 없거나 같은 종류 안에서 이름이 중복됨 |
| `ACCOUNTBOOK_SUMMARY_LIMIT` | 합계 조회나 화면 가져오기의 기존 기록 조회가 100페이지를 초과함 |
| `ACCOUNTBOOK_UNKNOWN_TOOL`, `ACCOUNTBOOK_INTERNAL` | 지원하지 않는 도구 또는 내부 처리 실패 |
