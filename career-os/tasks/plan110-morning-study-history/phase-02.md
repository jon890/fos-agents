# Phase 02 커리어 인사이트 중심 공부 주제 리포트

**Execution profile**: standard

---

## 목표

아침 리포트를 카테고리별 자료 목록에서 커리어 판단을 돕는 공부 주제 중심 구조로 바꾸고, 기능 소개나 최신성만 있는 저가치 자료를 추천에서 제외한다.

**범위 외**: 새 외부 저장소, 사용자 커리어 정보를 공개 리포트에 노출하는 변경, YouTube 채널 추가와 외부 게시를 수행하지 않는다.

---

## 작업 항목 (4)

### 1. 공부 주제 선택 계약

`readingSelectionSchema`를 `topics` 배열 중심으로 바꾼다.
각 topic은 `title`, `careerQuestion`, 한 개 이상의 `items`를 가지며 각 item은 `candidateId`, `summary`, `reason`, `careerValue`를 가진다.
`careerValue`는 `current-work`, `target-role`, `engineering-judgment`, `product-business` 중 하나만 허용한다.
추천할 자료가 없으면 빈 `topics` 배열을 허용한다.

### 2. 커리어 연결 검증

선택 검증은 후보 ID, 카테고리, 실행 내 중복, 이전 추천 여부, 문자열 길이와 topic별 항목 수를 검사한다.
스킬의 모델 선별 규칙은 현재 업무 적용, 목표 역할 준비, 구체적인 기술 판단, 제품·조직·수익화 관점 중 하나가 원문에 있어야 통과하도록 정의한다.
API 사용 순서만 나열한 문서, 기능 발표 요약, 전이할 판단이 없는 안전성·업계 소식은 공식 자료여도 제외한다.

### 3. 주제 중심 추천 데이터와 렌더링

`MorningReadingReport`는 카테고리별 배열 대신 `topics` 배열을 기준으로 사용한다.
Markdown과 HTML은 공부 주제, `careerQuestion`, 추천 자료의 종류·출처·제목·요약·추천 이유를 같은 순서로 표시한다.
빈 결과는 과거 자료를 채우지 않고 새로운 추천 자료가 없다는 상태를 표시한다.

### 4. 출력 계약 회귀 테스트

선택 스키마, 후보 연결, 빈 결과, 이전 추천 거부, Markdown과 HTML의 주제 순서, HTML escape와 HTTPS 링크 검증을 갱신한다.
`Collections Search`처럼 기능 흐름만 설명하는 선택 예시는 커리어 연결 근거가 없으면 스킬 완료 조건을 통과하지 못하도록 fixture를 둔다.

## Critical Files

| 파일 | 변경 |
| --- | --- |
| `career-os/scripts/study-topic-recommender/reading_contracts.ts` | 공부 주제와 커리어 연결 스키마 |
| `career-os/scripts/study-topic-recommender/reading_selection.ts` | 주제별 선택 검증과 추천 변환 |
| `career-os/scripts/study-topic-recommender/morning_reading_cli.ts` | 주제 중심 리포트 생성 |
| `career-os/scripts/study-topic-recommender/render/markdown.ts` | 주제 중심 Markdown |
| `career-os/scripts/study-topic-recommender/render/html.ts` | 주제 중심 HTML |
| `career-os/scripts/study-topic-recommender/render/report.ts` | 변경된 리포트 계약 연결 |
| `career-os/scripts/study-topic-recommender/validate_outputs.ts` | 주제와 링크 출력 검증 |
| `career-os/scripts/study-topic-recommender/**/*.test.ts` | 선택과 렌더링 회귀 테스트 |

## 검증

```bash
# cwd: fos-agents root
bun test ./career-os/scripts/study-topic-recommender
bunx tsc --noEmit --pretty false
git diff --check
```

테스트 fixture의 HTML과 Markdown에는 공부 주제와 커리어 질문이 자료 목록보다 먼저 나타나야 한다.
추천이 비어 있을 때 생성과 검증이 통과하고 과거 후보 URL이 출력되지 않아야 한다.

## 의도 메모

- 사용자는 최신 기술 목록보다 현재 경험을 다음 역할로 확장할 판단을 원한다.
- `careerValue`는 추천 이유를 구체화하는 계약이며 점수나 고정 키워드 순위로 사용하지 않는다.
- 공부 주제는 외부 자료에서 도출하고 외부 근거 없는 주제를 만들지 않는다.

## Blocked 조건

- Phase 01의 `contentKey`와 이전 추천 거부 계약이 없으면 `PHASE_BLOCKED: 누적 이력 계약 미완료`로 끝낸다.
