# Data Schema: accountbook

이 문서는 private OCR 후보와 등록 상태의 단일 소스다.
실제 값은 `accountbook/private/`에만 저장하고 git에 커밋하지 않는다.

## 환경 변수

| 이름 | 필수 | 내용 |
|---|:---:|---|
| `ACCOUNTBOOK_API_BASE_URL` | 예 | `/api/v1`까지 포함한 accountbook 내부 주소 |
| `ACCOUNTBOOK_FAMILY_UUID` | 예 | 거래를 등록할 가족 UUID |
| `ACCOUNTBOOK_REFRESH_TOKEN` | 최초 | private auth state가 없을 때 사용할 token |
| `ACCOUNTBOOK_DEFAULT_CATEGORY_NAME` | 아니오 | 후보에 분류가 없을 때 사용할 이름, 기본값 `미분류` |
| `ACCOUNTBOOK_EXCLUDE_FROM_BUDGET` | 아니오 | OCR 지출의 예산 제외 기본값, 기본값 `false` |

## private 경로

| 경로 | 내용 | 삭제 기준 |
|---|---|---|
| `private/inbox/` | 처리할 원본 이미지 | 등록 완료 뒤 사용자 정책에 따라 삭제 |
| `private/imports/<batch-id>/extracted.json` | vision이 만든 원본 후보 | 원본 이미지와 같은 보존 기간 |
| `private/imports/<batch-id>/validated.json` | 정규화와 합계 검증 결과 | 등록 이력 확인 기간 |
| `private/state/auth.json` | 갱신된 refresh token | token 교체 또는 폐기 시 |
| `private/state/submissions.json` | 후보별 API 전송 상태 | 등록 이력 확인 기간 |
| `private/state/locks/` | 실행 중 batch 잠금 | 정상 종료 시 제거 |

## 추출 입력

`extracted.json`은 다음 최상위 필드를 가진다.

| 필드 | 형식 | 제약 |
|---|---|---|
| `schemaVersion` | `1` | 고정 |
| `source` | `toss-consumption-screenshot` | 고정 |
| `sourceImage` | 객체 | 파일명, SHA-256, 생성 시각, 크기 |
| `extraction` | 객체 | engine, runtime, 추출 시각 |
| `reviewStatus` | `pending` 또는 `approved` | 추출 시 `pending` |
| `days` | 배열 | 날짜별 추출 결과 |

`sourceImage`에는 절대 경로를 저장하지 않는다.

## 날짜와 거래

날짜 객체는 다음 필드를 가진다.

| 필드 | 형식 | 제약 |
|---|---|---|
| `date` | `YYYY-MM-DD` | 유효한 날짜 |
| `dateSource` | `screen`, `file-metadata`, `user-confirmed` | 연도 근거 포함 |
| `completeness` | `complete`, `partial` | 잘린 날짜 구분 |
| `selectedForImport` | boolean | `partial`은 `false` |
| `expectedTotals` | 객체 또는 `null` | 화면 일별 수입·지출 합계 |
| `transactions` | 배열 | 화면 위에서 아래 순서 |

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

validator는 `batchId`, 거래별 `candidateId`와 다음 상태를 추가한다.

| 상태 | 의미 |
|---|---|
| `exact` | 상세 합계와 화면 요약이 일치 |
| `mismatch` | 수입 또는 지출 합계 불일치 |
| `incomplete` | 날짜가 화면에서 잘림 |
| `unavailable` | 화면 요약을 추출하지 못함 |

`submissionReady`는 선택된 날짜가 모두 `exact`이고 필수 필드에 `low`가 없으며, 선택 거래가 하나 이상일 때만 `true`다.
`medium` 필드는 미리보기에서 확인 사유로 표시한다.

## 전송 상태

`submissions.json`은 batch와 후보별 상태를 저장한다.

| 상태 | 의미 |
|---|---|
| `pending` | 전송 전 |
| `submitting` | POST 직전 상태 기록 완료 |
| `submitted` | API가 remote UUID를 반환 |
| `recovered` | 불명확한 전송 뒤 기존 거래 조회로 성공 확인 |
| `needs_review` | 기존 동일 거래 또는 복구 모호성 발견 |
| `failed` | 확정된 API 실패 |

모든 JSON 파일은 마지막 줄바꿈을 포함한다.
`private/` 하위 디렉터리는 `0700`, 파일은 `0600` 권한을 사용한다.
