## ADR-101 — position-recommender 산출물을 표준 출력 JSON으로 단일화하고 소비측이 가공한다

- Status: Accepted
- Date: 2026-06-19

### 맥락

[[ADR-094]]로 `recommendation.json`을 산출물 정본(표준 출력 JSON, schemaVersion 2)으로 도입했다.
그러나 정본 이전의 적재 흐름이 남아 JSON 두 개가 공존하는 어중간한 상태가 됐다.

- 정본 `recommendation.json`(에이전트 작성)과 파생 `items.json`(`structured_recommendation_items.ts`가 코드로 생성)이 동시에 존재한다.
- 실측(2026-06-19): cron은 Codex가 SKILL을 직접 실행하고, backend는 hermes API endpoint로 호출한다. 두 경로 모두 `run_daily_with_claude.ts` runner를 호출하지 않는다. runner와 `items.json` 생성은 호출 0이다.
- `items.json`은 이미 2026-06-19 산출물부터 생성되지 않는다.

정본에는 적재에 필요한 진실 데이터가 빠져 있다.

- fos-career `application_candidates`는 `source`를 `NOT NULL`로 요구하고, candidate identity 키가 `company_title_source_close_date`다.
- 정본에는 `source`와 구조화된 `closeDate`가 없어, 정본만으로는 candidate 동일성 판정이 깨지고 중복이 쌓인다.
- `source`를 URL 도메인으로 추측하는 방식은 부정확하다. 여러 회사가 공유하는 ATS 도메인은 URL만으로 수집 adapter를 특정할 수 없다.

로컬 개발에서 파일 공유에 의존하면 검증이 막힌다.

- 운영은 fos-career가 career-os 디렉터리를 공유 볼륨으로 마운트해 산출물 파일을 직접 읽는다.
- 로컬 개발 머신에는 그 마운트가 없어 파일 기반 적재를 재현할 수 없다.

### 결정

position-recommender의 산출물 계약을 **표준 출력 JSON(`recommendation.json`) 하나로 단일화**하고, **표현·적재·알림 가공은 호출자가 맡는다**.

- 스킬은 표준 출력 JSON 생성까지만 책임진다. Discord 요약은 cron 호출자가, DB 적재는 backend 호출자가 가공한다.
- 정본이 적재에 필요한 진실 데이터를 담는다. `source`(수집 adapter 식별자)와 구조화된 `closeDate`를 정본 항목에 추가한다. 진실의 출처는 career-os의 수집 snapshot이므로 정본이 직접 담는 것이 정확하다.
- 표준 출력 JSON의 전달 매체는 두 가지를 둔다. 운영은 공유 볼륨의 파일, 로컬과 분산 환경은 hermes API 응답(`response_format: json_object` 지원 확인)이다. 파일시스템 공유에 의존하지 않아 로컬에서도 검증할 수 있다.
- `items.json` 파생과 daily runner(`run_daily_with_claude.ts`·`run_daily_with_claude.sh`·`structured_recommendation_items.ts`)를 폐기한다.

거절한 대안:

- LLM 채팅 응답에 산문 요약과 JSON을 섞어 반환 — cron의 Discord 자동 전달과 충돌하고, 순수 JSON 보장이 불안정하다.
- backend가 URL 도메인으로 `source`를 추측 — 공유 ATS 도메인에서 부정확하고 adapter 변경 시 drift한다.

본 결정은 [[ADR-075]](daily runner ts 정본·sh shim)를 폐기한다.
[[ADR-036]]의 freshness 가드 중 reportDate 검증 책임은 스킬 self-check와 소비측 검증으로 이전한다.

### 결과

- JSON 두 개 공존이 해소되고 정본 하나가 모든 소비측의 단일 입력이 된다.
- 정본이 적재에 자족적이어서 candidate identity가 정본만으로 닫힌다.
- backend가 hermes API 응답으로 JSON을 받을 수 있어 파일 공유 없이 로컬에서 적재를 검증한다.
- 호출 0인 runner와 파생을 제거해 코드 표면이 줄고 유지 비용이 낮아진다.
- 단점: `json_object`는 유효한 JSON만 보장하고 스키마 일치는 보장하지 않는다. 소비측 zod 검증으로 보강한다.
- 단점: cron 환경에 bun이 없어 `render_recommendation.ts`의 zod self-check가 실행되지 않는다. 스킬 자체 점검과 소비측 검증으로 보강한다.

### 적용

- 스키마는 `scripts/position-recommender/recommendation_schema.ts`의 `PositionItem`에 둔다. 필드 정의는 `docs/data-schema.md`가 단일 출처다.
- 표준 출력 JSON을 채우는 절차와 응답 모드는 `position-recommender` SKILL.md를 따른다.
- 폐기 자산은 git에서 제거한다. 후속 backend 적재 전환은 fos-career repo가 맡는다.
