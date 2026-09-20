# Phase 02. 포지션 API와 분석 재사용 client

**Execution profile**: deep

## 목표

수집 실행을 한 transaction으로 저장하고 제한된 분석 큐를 반환하며,
모델 분석과 추천 실행을 멱등하게 반영하는 포지션 API와 client를 만든다.

**범위 외**: 학습자료 API, 홈서버 배포, 운영 DB 적용과 HTML 화면 변경은 다음 작업이 담당한다.

## 컨텍스트

개인 제외 규칙은 현재 `scripts/position-recommender/feedback/exclusions.ts`가 수집 전에 적용한다.
전환 때 기존 회사 제외 규칙을 API에 한 번 import한 뒤 `company_preferences`를 기준 저장소로 사용한다.
쿠팡 상세 HTTP 429 같은 소스 실패는 수집 실행 진단으로 저장하고 최종 추천 입력에 포함해야 한다.

**근거 문서**: `docs/flow.md`의 「포지션 추천」,
`docs/code-architecture.md`의 「공고 추천」과 「추천 상태 Backend」,
`docs/data-schema.md`의 「포지션 분석 정책」과 「공고별 분석 이력」

## 의도 메모

- 전체 후보풀은 HTTP 요청 한 번으로 저장하며 모델 입력으로 다시 출력하지 않는다.
- Backend가 반환한 최대 20건만 상세 본문을 가진다.
- 회사 티어는 분석 순서만 정하고 추천 결론을 만들지 않는다.
- `exclude` 회사는 모델 입력, 분석 큐와 추천 결과에 포함하지 않는다.
- 소스가 부분 실패하면 보이지 않는 기존 공고를 닫힌 공고로 바꾸지 않는다.

## 작업 항목

### 1. 포지션 HTTP 계약 추가

다음 endpoint와 Zod 계약을 `services/recommendation-api/routes/positions.ts`에 추가한다.

| endpoint                                                | 책임                                                  |
| ------------------------------------------------------- | ----------------------------------------------------- |
| `PUT /api/positions/v1/analysis-policy`                 | fresh DB의 분석 정책을 인증된 멱등 요청으로 명시 설정 |
| `POST /api/positions/v1/collection-runs`                | 후보풀과 소스 진단 저장, 분석 실행과 제한된 큐 반환   |
| `POST /api/positions/v1/analysis-runs/:id/results`      | 선택된 모든 항목의 분석 결과 원자 반영                |
| `POST /api/positions/v1/recommendation-runs`            | 유효 분석 순위, 분석 대기와 수집 진단 조립            |
| `GET /api/positions/v1/runs/:id`                        | 재시도 때 실행 상태와 저장된 응답 조회                |
| `GET /api/positions/v1/company-preferences`             | 회사 tier와 제외 정책 조회                            |
| `PUT /api/positions/v1/company-preferences/:companyKey` | 사용자가 정한 회사 정책 멱등 갱신                     |

모든 쓰기 endpoint는 `Idempotency-Key`를 요구한다.
응답에는 원본 token, DB 정보와 비공개 제외 사유 전문을 포함하지 않는다.

### 2. 수집 실행과 공고 version 저장

후보 하나를 `source_key`와 `identity_hash`로 upsert하고 `content_hash`가 새로울 때만 version을 추가한다.
수집 실행, 실행 항목과 소스 진단을 같은 transaction으로 저장한다.
성공한 소스에서 사라진 활성 공고만 `not_seen`으로 바꾸고 `partial` 또는 `failed` 소스는 기존 lifecycle을 유지한다.

개인 제외 집계와 공개 가능한 실패 요약을 수집 실행에 보존한다.
실패 원본 URL 목록과 외부 응답 전문은 추천 응답에 반환하지 않는다.

### 3. 분석 상태와 우선순위 큐 구현

본문 hash, `candidateContextVersion`, `analysisContractVersion`과 유효기간으로
`fresh`, `new`, `changed`, `stale`을 분류한다.
일일 기본 20건 중 16건은 tier와 상태, 마감 긴급도 순으로 고르고,
4건은 tier와 무관하게 대기 시각이 오래된 순서로 고른다.
한쪽 대상이 부족하면 다른 쪽이 남은 자리를 사용한다.

분석 실행과 선택 항목을 먼저 저장한 뒤 응답한다.
큐 응답은 선택된 공고의 상세 본문과 전체 집계만 포함하고 전체 후보 상세를 포함하지 않는다.

### 4. 분석 결과와 추천 실행 저장

분석 결과는 해당 실행에 선택된 모든 `position_id`가 한 번씩 있을 때만 반영한다.
`decision`, 점수 범위와 합계, 이유, 상세 근거와 다음 행동을 검증한다.
같은 공고 version과 기준·계약 버전 분석을 다시 보내면 기존 행을 반환한다.

추천 실행은 `recommend`, `consider`, `hold`, 점수 내림차순, tier, 마감 긴급도와 공고 ID로 결정적으로 정렬한다.
분석하지 않은 공고는 임의 점수를 만들지 않고 대기 목록에 넣는다.
응답에는 이번 실행 분석, 재사용, 대기, 개인 제외와 부분 실패 소스 집계를 포함한다.

### 5. position-recommender API client 추가

`scripts/position-recommender/recommendation-api/client.ts`에 fetch, 인증, timeout,
재시도와 응답 Zod 검증을 구현한다.
네트워크 오류와 `5xx`는 같은 본문과 같은 멱등 키로 최대 두 번 재시도하고 `4xx`는 재시도하지 않는다.

`prepare_position_analysis.ts`, `commit_position_analysis.ts`와
`finalize_position_recommendation.ts`는 DB에 직접 연결하지 않고 client만 사용한다.
`configure_position_analysis_policy.ts`도 정책 JSON을 검증한 뒤 같은 client로 정책 endpoint만 호출한다.
`configure_position_company_preferences.ts`는 명시 JSON의 회사명을 정규화해 회사 정책 endpoint를 순서대로 호출한다.
같은 입력에는 같은 멱등 키를 사용하며 기존 개인 제외 설정을 자동으로 import하지 않는다.
stdout에는 집계와 임시 파일 경로만 쓰고 후보 상세 본문을 출력하지 않는다.

### 6. 포지션 API와 client 회귀 테스트

새 공고, 같은 본문 재수집, 본문 변경, 분석 만료, 후보자 기준 변경과 회사 제외를 테스트한다.
16개 우선 슬롯과 4개 보장 슬롯, 슬롯 넘김, 결정적 동점 순서와 중복 제거를 확인한다.
부분 실패 소스 lifecycle 보존, 분석 결과 누락 rollback, 멱등 재시도와 `409` 충돌을 확인한다.
client가 전체 후보 상세를 stdout에 쓰지 않는지도 검사한다.

## 검증

```bash
# cwd: 저장소 루트
bun test career-os/services/recommendation-api/position career-os/scripts/position-recommender/recommendation-api career-os/scripts/position-recommender/*position_analysis*.test.ts
bunx tsc --noEmit
bun run format:position-recommender:check
git diff --check
```

같은 수집과 분석 요청을 같은 멱등 키로 두 번 보내도 두 번째 요청이 새 version과 분석을 만들지 않아야 한다.

## Critical Files

| 파일                                                                     | 변경 |
| ------------------------------------------------------------------------ | ---- |
| `services/recommendation-api/routes/positions.ts`                        | 신규 |
| `services/recommendation-api/position/*.ts`                              | 신규 |
| `services/recommendation-api/position/*.test.ts`                         | 신규 |
| `scripts/position-recommender/recommendation-api/*.ts`                   | 신규 |
| `scripts/position-recommender/configure_position_analysis_policy.ts`     | 신규 |
| `scripts/position-recommender/configure_position_company_preferences.ts` | 신규 |
| `scripts/position-recommender/prepare_position_analysis.ts`              | 신규 |
| `scripts/position-recommender/commit_position_analysis.ts`               | 신규 |
| `scripts/position-recommender/finalize_position_recommendation.ts`       | 신규 |
| `scripts/position-recommender/*position_analysis*.test.ts`               | 신규 |
