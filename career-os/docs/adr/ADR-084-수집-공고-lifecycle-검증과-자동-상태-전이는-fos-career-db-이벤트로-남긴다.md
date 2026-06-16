## ADR-084 — 수집 공고 lifecycle 검증과 자동 상태 전이는 fos-career DB 이벤트로 남긴다

- Status: Accepted
- Date: 2026-06-15

### 맥락

plan075 이후 fos-career는 수집처 registry, 수집 실행, 수집 실행별 등장 이력, 전체 수집 공고 pool을 DB로 관리하게 됐다.
다음 문제는 공고 lifecycle이다.

수집된 공고는 시간이 지나면 닫히거나 사라진다.
사람이 대시보드에서 명시적으로 닫아야 하는 경우도 있고, validator가 여러 수집 실행에서 보이지 않는 공고를 자동으로 닫을 수 있어야 한다.
반대로 이미 닫힌 공고가 다시 수집되면 현재 수집 상태를 우선해 다시 열어야 한다.

사용자는 수동 닫기와 validator 자동 닫기 모두를 원하며, 다시 수집된 공고는 자동으로 열리길 원한다.
동시에 상태 변경 이유와 이전 상태는 추적 가능해야 한다.

### 결정

- plan076 이름은 `plan076-fos-career-position-lifecycle-validation`으로 둔다.
- `collected_positions.postingStatus`를 공고의 현재 상태 정본으로 직접 갱신한다.
- 별도 override table로 현재 상태를 덮어쓰지 않는다.
- 상태 변경 이력은 전용 `position_status_events` 테이블에 남긴다.
- 상태 이벤트는 최소한 다음 유형을 지원한다.
  - `manual_closed`
  - `validator_closed`
  - `validator_reopened`
  - `validation_checked`
  - `validation_skipped`
- 각 이벤트는 before/after status, reason, collectionRunId, sourceId, validator run id, actor 정보를 남긴다.
- 수동 닫기는 `/dashboard/positions`에서 modal로 제공한다.
- 수동 닫기 modal은 사유 입력을 필수로 한다.
- 상세 페이지는 plan076 범위 밖이며, 필요하면 후속 plan에서 만든다.
- validator script는 기본 dry-run이다.
- 실제 상태 변경은 명시적으로 `--apply`를 붙였을 때만 수행한다.
- validator는 한 번에 자동 변경할 수 있는 최대 개수를 둔다.
  기본 상한은 20개다.
- 자동 닫기 기준은 `collected_position_run_items` 기준으로 판단한다.
- 기본 자동 닫기 조건은 다음과 같다.
  - 최신 수집 실행 기준 3회 이상 미등장
  - 해당 source diagnostics가 정상 계열
  - source가 `blocked`, `parser_changed`, `failed`, `skipped`, `unknown` 계열이 아님
- source 상태가 불안정하면 자동 닫지 않고 validation skipped 이벤트만 남긴다.
- 이미 닫힌 공고가 다시 수집되면 자동으로 active/open으로 복구한다.
- 복구 status는 새 snapshot의 `posting_status` 값을 사용한다.
- 자동 복구도 상태 이벤트로 남긴다.
- 최신/신규/과거 판단은 `collected_positions.collectionRunId`가 아니라 `collected_position_run_items`를 정본으로 사용한다.
- Naver Careers와 KakaoPay Securities adapter 자체 분석은 plan076 범위 밖이다.
  별도 source adapter 조사 plan에서 다룬다.
- 사용자에게 보이는 label, 버튼, 필터, 상태 설명은 한국어를 우선한다.
  내부 식별자와 raw log는 필요할 때만 상세 영역에 둔다.

### 결과

- 전체 수집 공고 pool이 오래된 공고와 닫힌 공고를 운영 가능한 상태로 다룰 수 있다.
- 수동 상태 변경과 자동 상태 변경이 같은 이벤트 모델로 추적된다.
- validator는 기본적으로 안전한 dry-run으로 실행되고, 실제 변경은 명시 옵션에서만 수행된다.
- source 장애나 parser 변경을 closed로 오판하는 위험을 줄인다.
- 다시 열린 공고도 상태 이벤트로 남아 lifecycle을 추적할 수 있다.
- 단점은 validator가 상태를 직접 변경하므로 검증 기준과 source diagnostics 품질이 중요해진다는 점이다.

### 적용

- `docs/prd.md`
- `docs/data-schema.md`
- `docs/flow.md`
- `docs/code-architecture.md`
- `tasks/plan076-fos-career-position-lifecycle-validation/`
