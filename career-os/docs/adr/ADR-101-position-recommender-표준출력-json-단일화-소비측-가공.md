## ADR-101 — position-recommender 산출물을 표준 출력 JSON으로 단일화하고 소비측이 가공한다

- Status: Accepted; consumer backend parts superseded by [[ADR-102]]
- Date: 2026-06-19
- Supersedes: ADR-094(포지션 추천 산출물 JSON 정본 전환, 2026-06-17) — 본 ADR에 통합, 파일 제거(plan094)

### 맥락

**JSON 정본 전환 배경(구 ADR-094, 2026-06-17)**

position-recommender는 과거 `report.md`를 정본으로 두고, HTML·items.json·DB ingest가 각각 markdown을 다시 파싱했다.
실사용 고도화 세션(2026-06-17)에서 이 구조의 한계가 드러났다.

- **markdown 3중 파싱**: 같은 report.md를 HTML 렌더러·items 추출기·DB ingest가 각각 재파싱한다.
- **자체 파서 fragility**: HTML 렌더러가 들여쓴 하위 항목을 평탄화하거나 `<ol><li>` 안에 `<ul>`을 형제로 붙이는 부정확한 구조를 만든다.
- **정보 손실**: SKILL self-check는 14개 라벨을 강제하는데, items.json은 그중 6개만 추출해 나머지가 DB·Discord로 전달되지 못한다.
- **단일 구조 출처 부재**: HTML·Discord 카드·DB가 모두 구조화 데이터를 요구하지만 공통 정본이 없어 변환이 흩어져 있다.

산문 markdown은 사람이 읽기엔 좋지만, 기계가 여러 출력으로 파생하기엔 깨지기 쉬운 중간 표현이다.
이 문제의 해결로 산출물 정본을 **구조화 JSON**(`recommendation.json`, schemaVersion 2)으로 올렸다.

**이어지는 문제(2026-06-19)**

정본 전환 이후에도 정본 이전의 적재 흐름이 남아 JSON 두 개가 공존하는 어중간한 상태가 됐다.

- 정본 `recommendation.json`(에이전트 작성)과 파생 `items.json`(`structured_recommendation_items.ts`가 코드로 생성)이 동시에 존재한다.
- 실측(2026-06-19): cron은 Codex가 SKILL을 직접 실행하고, backend는 hermes API endpoint로 호출한다. 두 경로 모두 `run_daily_with_claude.ts` runner를 호출하지 않는다. runner와 `items.json` 생성은 호출 0이다.
- `items.json`은 이미 2026-06-19 산출물부터 생성되지 않는다.

정본에는 적재에 필요한 진실 데이터가 빠져 있다.

- 당시 backend 소비측은 `source`를 필수로 요구하고, candidate identity 키가 `company_title_source_close_date`였다.
- 정본에는 `source`와 구조화된 `closeDate`가 없어, 정본만으로는 candidate 동일성 판정이 깨지고 중복이 쌓인다.
- `source`를 URL 도메인으로 추측하는 방식은 부정확하다. 여러 회사가 공유하는 ATS 도메인은 URL만으로 수집 adapter를 특정할 수 없다.

로컬 개발에서 파일 공유에 의존하면 검증이 막힌다.

- 당시 운영안은 외부 소비측이 career-os 디렉터리를 공유 볼륨으로 마운트해 산출물 파일을 직접 읽는 구조였다.
- 로컬 개발 머신에는 그 마운트가 없어 파일 기반 적재를 재현할 수 없다.

### 결정

position-recommender의 산출물 계약을 **표준 출력 JSON(`recommendation.json`) 하나로 단일화**하고, **표현·적재·알림 가공은 호출자가 맡는다**.

- 에이전트는 자유 산문 대신 **고정 스키마 JSON을 채운다**. SKILL이 이미 14개 라벨을 강제하므로 실질 제약 증가는 작다.
- 스킬은 표준 출력 JSON 생성까지만 책임진다. Discord 요약, 파일 기록, 외부 소비측 가공은 호출자가 맡는다.
- 렌더러가 JSON 하나에서 **HTML·Markdown·Discord 카드·DB items를 파생**한다. 템플릿은 **디자인·스타일만 정의**하고 데이터 바인딩만 한다. fragile한 자체 markdown 파서는 폐기한다.
- SKILL self-check를 markdown grep에서 **zod 스키마 검증**으로 전환한다.
- `report.md`는 폐기하지 않고 JSON에서 파생하는 **사람 읽기용 산출물**로 둔다. 기존 freshness 가드와 기록 호환을 유지하기 위함이다.
- 정본이 적재에 필요한 진실 데이터를 담는다. `source`(수집 adapter 식별자)와 구조화된 `closeDate`를 정본 항목에 추가한다. 진실의 출처는 career-os의 수집 snapshot이므로 정본이 직접 담는 것이 정확하다.
- 표준 출력 JSON의 전달 매체는 두 가지를 둔다. 운영은 공유 볼륨의 파일, 로컬과 분산 환경은 hermes API 응답(`response_format: json_object` 지원 확인)이다. 파일시스템 공유에 의존하지 않아 로컬에서도 검증할 수 있다.
- `items.json` 파생과 daily runner(`run_daily_with_claude.ts`·`run_daily_with_claude.sh`·`structured_recommendation_items.ts`)를 폐기한다.

핵심 전환: **정본을 산문에서 구조로 옮기고, 그 구조 하나로 모든 소비측을 닫는다.** 구조가 정본이면 렌더링이 깨질 수 없고, 모든 출력이 한 소스에서 일관되게 나온다.

거절한 대안:

- markdown을 정본으로 유지하고 자체 파서만 개선 — 산문은 구조화 데이터로 안정적으로 파생하기 어려워 근본 해결이 안 된다(구 ADR-094).
- LLM 채팅 응답에 산문 요약과 JSON을 섞어 반환 — cron의 Discord 자동 전달과 충돌하고, 순수 JSON 보장이 불안정하다.
- backend가 URL 도메인으로 `source`를 추측 — 공유 ATS 도메인에서 부정확하고 adapter 변경 시 drift한다.

본 결정은 ADR-075(daily runner ts 정본·sh shim)를 폐기한다.
[[ADR-036]]의 freshness 가드 중 reportDate 검증 책임은 스킬 self-check와 소비측 검증으로 이전한다.
본 결정은 [[ADR-030]](agent skill 직접 읽기/쓰기)의 산출물 책임을 구조화 정본으로 구체화한다.

### 결과

- markdown 3중 파싱이 사라져 렌더링이 입력 형식에 흔들리지 않는다.
- 14개 라벨이 손실 없이 items·DB·Discord로 전달된다.
- 스타일과 데이터가 분리돼 디자인 변경이 템플릿 한 곳에서 끝난다.
- zod 검증이 텍스트 grep보다 견고해 누락·형식 오류를 구조적으로 막는다.
- JSON 두 개 공존이 해소되고 정본 하나가 모든 소비측의 단일 입력이 된다.
- 정본이 적재에 자족적이어서 candidate identity가 정본만으로 닫힌다.
- backend가 hermes API 응답으로 JSON을 받을 수 있어 파일 공유 없이 로컬에서 적재를 검증한다.
- 호출 0인 runner와 파생을 제거해 코드 표면이 줄고 유지 비용이 낮아진다.
- 단점: `json_object`는 유효한 JSON만 보장하고 스키마 일치는 보장하지 않는다. 소비측 zod 검증으로 보강한다.
- 단점: cron 환경에 bun이 없어 `render_recommendation.ts`의 zod self-check가 실행되지 않는다. 스킬 자체 점검과 소비측 검증으로 보강한다.

### 적용

- 스키마는 `scripts/position-recommender/recommendation_schema.ts`의 `PositionItem`에 둔다([[ADR-019]] scripts 분리, [[ADR-031]] `_lib` 폐기 원칙에 따라 skill scripts 내부에 둔다). 필드 정의는 `docs/data-schema.md`가 단일 출처다.
- 표준 출력 JSON을 채우는 절차와 응답 모드는 `position-recommender` SKILL.md를 따른다.
- 폐기 자산은 git에서 제거한다.
- 데이터 스키마 변경(`recommendation.json` 구조, items.json 관계)은 `docs/data-schema.md`에 반영한다.
- backend 적재 소비측 전환은 [[ADR-102]] 이후 현재 범위에서 제외됐다.
