# Phase 01. 공통 유틸과 수집 정책 분리

**Execution profile**: standard

## 목표

공통 텍스트·날짜 처리를 `scripts/lib`로 옮기고, 직무 키워드와 판정 로직을 서로 다른 모듈로 분리한다.

**범위 외**: 현재 수집 후보의 포함·제외 결과 변경과 새로운 외부 의존성 추가.

## 컨텍스트

수집기는 소스별 정규화를 마친 뒤 공통 eligibility 정책을 다시 적용한다.
일반 문자열 처리와 날짜 계산은 공용 유틸이고, 목표 직무와 제외 직무 목록은 포지션 추천의 도메인 정책이다.

**근거 문서**: `career-os/docs/code-architecture.md`의 「CLI와 핵심 로직 경계」와 「포지션 추천 수집」 절.

## 의도 메모

- 소스 어댑터의 사전 필터는 상세 페이지 요청 수를 줄이거나 소스 고유 상태를 판정하므로 유지한다.
- 공통 validator는 모든 소스에 같은 최종 안전 경계를 적용하므로 유지한다.
- 중복된 역할 키워드는 한 설정 파일에서 가져오게 하고, 소스 고유 필드명과 상태값만 어댑터에 둔다.

## 작업 항목

### 1. 공통 유틸 분리

텍스트 정규화, 키워드 포함 검사, HTML 제거와 날짜 파싱·남은 날짜 계산을 `career-os/scripts/lib`로 옮긴다.
현재 시각에 의존하는 함수에는 기준 시각을 주입할 수 있게 한다.

### 2. 정책 상수와 로직 분리

직무·고용형태·분류 키워드는 `live-postings/policy/keywords.ts`, 역할 판정은 `role.ts`, 분류는 `classification.ts`, 마감 변환은 `lifecycle.ts`로 나눈다.
기존 `policy.ts`는 호출부 호환을 위한 얇은 진입점으로 유지한다.

### 3. 회귀 테스트

기존 policy와 adapter 테스트로 후보 포함·제외가 바뀌지 않았는지 확인한다.
공통 유틸은 공백·대소문자·HTML entity·주입 시각을 별도 테스트로 고정한다.

## 검증

```bash
# cwd: 저장소 루트
bun test career-os/scripts/lib career-os/scripts/position-recommender
bunx tsc --noEmit
```

## Critical Files

| 파일                                                             | 변경                 |
| ---------------------------------------------------------------- | -------------------- |
| `career-os/scripts/lib/text.ts`, `text.test.ts`                  | 신규                 |
| `career-os/scripts/lib/date-format.ts`, `date-format.test.ts`    | 수정                 |
| `career-os/scripts/position-recommender/live-postings/policy/`   | 신규                 |
| `career-os/scripts/position-recommender/live-postings/policy.ts` | 호환 진입점으로 축소 |
