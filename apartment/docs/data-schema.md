# Data Schema — apartment

이 문서는 apartment의 config, data, 산출물 구조를 설명한다.

## config

### `config/focus-unit.json`

타깃 단지와 포커스 평형의 단일 출처다.

```text
complexName: string
complexAlias: string
complexLocation: string
primaryFocusUnit.label: string
primaryFocusUnit.exclusiveAreaM2: number
primaryFocusUnit.aliases: string[]
notes: string[]
```

수집기와 정규화기는 이 파일을 기준으로 59A 매칭을 판단한다.

### `config/guri-buy-complexes.json`

Guri 광역 탐색 후보 단지와 제외 기준을 담는다.

```text
purpose: string
budgetManwon.target: number
budgetManwon.nearBudgetCeiling: number
candidateComplexes: object[]
commuteTarget: object
excludedComplexes: object[]
selectionRules: object
```

### `config/interior-reference-digest.json`

인테리어 레퍼런스 검색과 평가 기준을 담는다.

```text
target: object
stylePreferences: string[]
toneReferenceFocus: object
currentDecisionNote: string
outputRoot: string
sourcePriority: object[]
searchQueries: object
scoringRubric: object
dailyReport: object
referenceNotebook: string
evaluationFocus: string[]
```

### `config/lucky-24-floorplan.json`

구리럭키 24평 참고 평면도 메타데이터다.
원본 이미지는 `data/interior/floorplans/lucky-24/`에 두고, config는 경로와 해시만 가리킨다.

## 환경 변수

실제 값은 `apartment/.env`에 둔다.
템플릿은 `apartment/.env.example`을 따른다.

| 변수 | 필수 | 용도 |
|---|---|---|
| `NAVER_COOKIE` | 권장 | Naver Land API 접근용 로그인 쿠키 |
| `NAVER_BEARER` | 선택 | Bearer JWT 수동 주입 fallback |

## 일일 리포트 산출물

`data/YYYY-MM-DD/` 아래에 생성한다.

| 파일 | 설명 |
|---|---|
| `raw-search.json` | 수집기 원본 응답과 source별 상태 |
| `summary.json` | 정규화된 비교·매칭 결과 |
| `report.md` | 사용자 확인용 최종 리포트 |

`summary.json`의 최상위 key:

```text
generatedAt
target
sources
recentTransactions
listingSummary
comparison
notes
focusUnit
focusSummary
```

## 인테리어 산출물

`data/interior-reference-digest/YYYY-MM-DD/` 아래에 생성한다.

| 파일 | 설명 |
|---|---|
| `report.md` | 추천 레퍼런스와 결정 질문 리포트 |
| `decision-view.html` | 확정 결정, 남은 결정, 현장 확인 항목 표시용 HTML |

의사결정 원본은 `docs/interior/*.md`다.
HTML은 표시용 산출물이다.

## 인테리어 원본 문서

| 파일 | 용도 |
|---|---|
| `docs/interior/interior-references.md` | 레퍼런스 후보 목록과 평가 |
| `docs/interior/lucky-5-1004-interior-decisions.md` | 확정 결정 누적 |
| `docs/interior/lucky-5-1004-decision-queue.md` | 검토 대기 결정 항목 |
| `docs/interior/lucky-5-1004-decision-summary.md` | 결정 요약 |
| `docs/interior/lucky-5-1004-field-checklist.md` | 현장 확인 체크리스트 |
| `docs/interior/lucky-5-1004-contractor-brief.md` | 시공사 상담용 브리프 |
