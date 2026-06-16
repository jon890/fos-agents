## ADR-045 — 지원 후보 frontdoor queue를 ledger와 분리한다

- Status: Accepted
- Date: 2026-06-06

### 맥락

현재 `/position-recommender`는 활성 공고를 수집하고 추천 순위를 만들 수 있고, `ingest-position-report`는 추천 결과를 `data/applications/ledger.jsonl`로 넣을 수 있다. 그러나 사용자가 원하는 앞단 경험은 "추천 후보 순위 확인 → 사용자가 N번 준비 시작 선택 → 선택된 공고만 상세 분석/학습/지원 준비로 승격"이다.

기존 ledger는 실제 지원 준비가 시작된 공고 원장과 agent 실행 상태가 섞여 있다. 추천 후보를 곧바로 ledger에 넣으면 사용자가 고르기 전에 상세 분석이나 지원 패키지 생성 흐름으로 넘어갈 수 있고, "아직 선택 전 후보" 상태가 선명하지 않다.

### 결정

- `data/applications/ledger.jsonl`은 실제 지원 준비가 시작된 공고 원장으로 유지한다.
- 추천 후보 순위와 사용자 선택 대기 상태는 별도 runtime 파일 `data/runtime/application-agent/frontdoor-queue.jsonl`에 저장한다.
- frontdoor queue 상태는 `collected`, `shortlisted`, `needs_user_start_approval`, `start_approved`, `promoted_to_ledger`, `rejected`, `expired`를 기본값으로 한다.
- 사용자가 "N번 준비 시작"처럼 명시적으로 선택한 후보만 `start_approved`가 되고, 이후 ledger로 승격한다.
- 승격 후 자동 생성 범위는 상세 공고 분석, fit/gap 분석, 공부 우선순위, 예상 면접 질문까지로 제한한다.
- 최종 지원 패키지 생성, 제출 승인, 외부 사이트 입력/전송은 기존 사용자 검토 gate를 유지한다.
- Next.js 대시보드와 관리자 로그인은 별도 `plan039` 범위로 분리한다.

### 초기 검증 대상

- KakaoPay AI track: 현재 로컬 추천 리포트 기준 `카카오페이 서버 개발자 (144295)` 공고를 임시 사용한다. AI 전용 KakaoPay 공고 URL이 별도로 확인되면 이 후보를 교체한다.
- KakaoPay Securities AI/workplatform track: `카카오페이증권 워크플랫폼 백엔드 개발자 (시니어)` 공고를 사용한다.
- TossPlace AI track: `TossPlace Applied AI Engineer` 공고를 사용한다. 이미 ledger에 있는 후보이므로 plan038은 중복 승격을 막고 "already promoted" 상태를 다뤄야 한다.

### 결과

- 추천 후보와 실제 지원 준비 공고의 책임이 분리된다.
- 사용자는 항상 앞단에서 어떤 공고를 시작할지 선택할 수 있다.
- application-flow-agent는 사용자가 승인한 후보만 상세 분석/학습/지원 준비 흐름으로 처리한다.
- plan039 대시보드는 frontdoor queue와 ledger를 함께 읽는 읽기 전용 MVP 위에 얹을 수 있다.

### 적용

- `AGENTS.md` — planning/plan-and-build/Claude 위임/메인 세션 검증/shadow 운영 규칙.
- `tasks/plan037-position-recommender-source-adapters/` — 이 패턴을 적용한 첫 position-recommender source adapter 고도화 plan.
- `scripts/position-recommender/collect_live_postings.ts`와 `run_daily_with_claude.sh` — 메인 세션 검증 대상이 된 collector/runner gate.
