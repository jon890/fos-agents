# Phase 03. `position-recommender` 연동과 운영 검증

**Execution profile**: deep

## 목표

매일 cron이 평가할 회사만 조사하고 회사 tier를 반영한 뒤 공고 분석을 이어가며,
사용자가 최종 HTML에서 tier의 출처와 근거를 확인할 수 있게 한다.

**범위 외**: 홈서버 container 배포, migration 실행과 cron 설정 변경은 인프라 저장소에서 별도로 수행한다.
NestJS와 Drizzle로의 이전은 실제 검증 후 별도 계획으로 다룬다.

## 컨텍스트

스킬은 현재 수집 뒤 바로 공고 분석 큐를 읽는다.
이 phase는 사용자에게 추가 승인을 묻지 않고,
회사 tier 큐가 있을 때만 그 평가를 앞에 끼워 넣는다.

**근거 문서**: `docs/flow.md`의 「포지션 추천」,
`docs/code-architecture.md`의 「공고 추천」,
`docs/data-schema.md`의 「공고별 분석 이력」,
`docs/adr/ADR-118-추천-상태는-career-os-api와-mysql이-관리한다.md`

## 의도 메모

- 회사 tier 평가는 한 회사에 한 번씩 수행하고 유효기간 안에는 다시 분석하지 않는다.
- Tier 3는 제외가 아니다. 오래 기다린 공고 보장 슬롯은 유지한다.
- 사용자가 궁금해하지 않는 회사는 모델이 자동 숨기지 않고 기존 `company_preferences` 제외로만 처리한다.
- 공개 회사 사실은 `state/company-research/`에 계속 재사용하고, 후보자 기준의 tier 판정만 MySQL에 저장한다.
- 최종 답변은 평가 실패 건수와 기본 tier 적용 건수를 숨기지 않는다.

## 작업 항목

### 1. API client에 회사 tier 결과 전송을 추가한다

`scripts/position-recommender/recommendation-api/client.ts`에 다음 method를 추가한다.

- `saveCompanyTierResults(companyTierRunId, body, idempotencyKey)`

`saveCollection`의 응답 계약 변경과 `createPositionAnalysisRun`은 Phase 02가 이미 했다.
여기서는 그 둘을 다시 만들지 말고 회사 tier 결과 전송만 더한다.
기존 재시도 3회, timeout, 4xx·5xx 분기, Bearer token과 멱등 키 처리를 재사용한다.

### 2. 회사 tier 임시 계약과 CLI를 추가한다

`company-tier-analysis/schema.ts`에 API 큐와 `company-tier-updates.json`의 계약을 둔다.
`prepare_position_analysis.ts`는 수집 응답에 회사 큐가 있으면 `company-tier-queue.json`만 남기고,
비었으면 바로 공고 분석 run을 요청해 `analysis-queue.json`을 남긴다.

`complete_company_tier_assessment.ts`를 추가한다.
이 명령은 평가 JSON을 검증해 Backend에 반영하고,
run이 `completed` 또는 `partial`이면 이어서 공고 분석 run을 요청해 `analysis-queue.json`을 남긴다.
stdout에는 회사명, 개인 기준, 평가 이유를 출력하지 않고 상태별 건수와 임시 파일 경로만 출력한다.

### 3. `position-recommender` 스킬을 2단계 분석으로 바꾼다

`.claude/skills/position-recommender/SKILL.md`를 `skill-creator` 절차로 수정한다.
수집 뒤 다음 순서를 따른다.

1. 회사 tier 큐가 비었으면 회사 조사를 생략한다.
2. 큐가 있으면 선택한 회사의 유효한 공개 사실만 읽고, 부족하거나 만료된 근거만 조사한다.
3. 세 기회 축을 평가하되 근거가 없는 축을 `unknown`으로 남기고, 종합 tier와 신뢰도를 정한다.
4. 실패한 회사는 `failures`에 넣어 전체 run을 끝낼 수 있게 한다.
5. tier 반영과 공고 큐 생성을 명령 하나로 실행한 뒤 기존 공고 분석을 계속한다.

스킬은 회사 tier를 `company_preferences`에 쓰거나 사용자 승인을 기다리지 않는다.

### 4. 추천 JSON과 HTML에 tier 출처를 표시한다

`recommendation/schema.ts`의 추천과 대기 항목에 `companyTierSource`,
`companyTierAssessmentId`, tier 평가 시각·만료일과 간결한 이유를 추가하고 schema version을 올린다.
`companyTierAssessmentId`는 모델 출처일 때만 있다.

HTML의 공고 항목에 `Tier 1 · 모델 평가`, `Tier 2 · 사람 override`, `Tier 3 · 기본값`처럼 값과 출처를 함께 표시한다.
모델 평가에는 요약 이유, 신뢰도와 HTTPS 출처를 연결한다.
기본 tier와 tier 평가 실패 건수를 추천 요약에 보여준다.

### 5. 반복 cron과 실패 경로를 회귀 검증한다

다음 subprocess·fixture 시나리오를 추가한다.

- 첫 실행은 상한만큼만 평가하고 나머지 회사를 기본 tier로 둔다.
- 둘째 실행은 전날 유효 평가를 다시 모델에 넘기지 않고 다른 신규 회사를 고른다.
- 모든 회사 평가가 유효하면 회사 모델 분석을 전혀 실행하지 않는다.
- 사람 override를 추가하면 기존 모델 tier가 있어도 다음 공고 큐와 추천에서 즉시 우선한다.
- 평가 전체 실패는 `partial`로 남고 기본 tier로 공고 큐를 만든다.
- 소스 HTTP 429와 회사 tier 평가 실패를 최종 HTML에서 서로 다른 경고로 표시한다.

## 검증

```bash
bun test career-os/scripts/position-recommender \
  career-os/services/recommendation-api
bun run format:position-recommender:check
bunx tsc --noEmit
python3 ~/.claude/scripts/korean-style-check.py \
  career-os/.claude/skills/position-recommender/SKILL.md
python3 ~/.claude/scripts/check-readability.py \
  career-os/.claude/skills/position-recommender/SKILL.md
```

스킬 구조 검증은 경로를 직접 부르지 않는다.
`skill-creator`는 plugin으로 설치돼 있어 `quick_validate.py`의 실제 경로에 갱신마다 바뀌는 해시가 들어간다.
`skill-creator` 스킬을 호출해 `career-os/.claude/skills/position-recommender`를 검증한다.

`~/.claude/scripts/korean-style-check.sh`는 없다.
위 두 `.py`가 실재하는 진입점이고, 둘을 함께 돌리려면 `korean-check` 스킬의 `scripts/check.sh`를 쓴다.

## 계획 마감

위 검증을 모두 통과한 뒤 `index.json`의 `status`를 `completed`, `current_phase`를 3으로 바꾼다.

## Critical Files

| 파일 | 변경 |
| --- | --- |
| `.claude/skills/position-recommender/SKILL.md` | 수정 |
| `scripts/position-recommender/recommendation-api/client.ts` | 수정 |
| `scripts/position-recommender/company-tier-analysis/schema.ts` | 신규 |
| `scripts/position-recommender/prepare_position_analysis.ts` | 수정 |
| `scripts/position-recommender/complete_company_tier_assessment.ts` | 신규 |
| `scripts/position-recommender/recommendation/schema.ts` | 수정 |
| `scripts/position-recommender/render/recommendation-html.ts` | 수정 |
| `scripts/position-recommender/render/validate-report-html.ts` | 수정 |
| `scripts/position-recommender/**/*.test.ts` | 수정 |
