# Phase 01. 자동 제외 피드백 반영

**Execution profile**: standard

## 목표

상향 근거가 없고 명확한 하향 근거가 있는 공고와 회사만 다음 추천의 모델 입력에서 제외한다.

**범위 외**: 소스별 외부 요청 자체를 생략하는 최적화와 기존 개인 규칙의 강제 이관.

## 컨텍스트

수집 뒤 모델 호출 전 필터는 `career-os/scripts/position-recommender/feedback/exclusions.ts`에 있다.
판정 기준과 저장 계약은 `career-os/docs/data-schema.md`의 「개인 공고 제외 설정」과
`career-os/docs/adr/ADR-112-현재-직장-대비-업사이드를-축별로-판정한다.md`를 따른다.

**근거 문서**: `career-os/docs/data-schema.md`의 「개인 공고 제외 설정」 절과 `career-os/docs/adr/ADR-112-현재-직장-대비-업사이드를-축별로-판정한다.md`.

## 작업 항목

### 1. 추천과 제외 스키마

추천 결과에 축별 자동 제외 제안을 추가한다.
공고 범위와 회사 범위를 구분하고 회사 범위에는 공개 근거 URL을 두 개 이상 요구한다.

### 2. 제외 반영 CLI

검증된 추천 JSON과 후보풀에서 제안을 읽어 `state/private-config/position-exclusions.json`에 중복 없이 합친다.
기존 버전 1 공고 규칙은 손실 없이 유지한다.

### 3. 회귀 테스트

상향 혼재, 하향 없음, 회사 근거 부족을 거부하고 다음 수집의 후보풀에서 제외되는지 확인한다.

## 검증

```bash
# cwd: 저장소 루트
bun test career-os/scripts/position-recommender/feedback/*.test.ts \
  career-os/scripts/position-recommender/recommendation/validate.test.ts
bunx tsc --noEmit
```

## Critical Files

| 파일                                                                    | 변경 |
| ----------------------------------------------------------------------- | ---- |
| `career-os/scripts/position-recommender/recommendation/schema.ts`       | 수정 |
| `career-os/scripts/position-recommender/feedback/exclusions.ts`         | 수정 |
| `career-os/scripts/position-recommender/apply_exclusion_suggestions.ts` | 신규 |
| `career-os/scripts/position-recommender/feedback/exclusions.test.ts`    | 수정 |
