# PRD — career-os

career-os 워크스페이스의 **제품 범위·MVP 기능 명세**.
현재 active 워크플로의 단일 출처.
새 기능을 추가하거나 우선순위를 정할 때 이 문서가 기준.

런타임 상태(어느 명령이 최근에 잘 도는지, 무엇이 멈췄는지)는 여기에 박지 않는다.
`logs/task-runs.jsonl`이 단일 출처이고 `skills/workspace-audit`가 그때그때 보고한다.

## 목적

면접 준비·커리어 분석 자동화.
단일 후보자(=본인)의 면접 대비 사이클을 매일 재실행 가능한 로컬 워크플로로 묶는다.

## 현재 MVP 타깃

`config/mvp-target.json`이 **단일 출처**.
`primary`가 현재 집중 타깃, `history`가 폐기된 과거 타깃.
회사명·팀명·면접 일자를 이 문서나 다른 markdown에 박지 않는다 — JSON 한 곳만 수정해서 전환.

## 사용자

후보자 본인 1인.
매일 아침 모닝 추천을 받고, 그 안에서 골라 study-pack / question-bank 같은 학습·면접 자산을 만든다.

## 생성 문서 품질 계약

career-os의 모든 생성 Markdown 산출물은 용도와 공개 범위가 달라도 같은 읽기 품질 기준을 따른다.

- 한국어 우선 섹션 제목을 쓰고, 코드 식별자나 상태값처럼 필요한 경우에만 영어 label을 유지한다.
- 자연스러운 한국어 문장으로 결론, 근거, 다음 행동을 설명한다.
- 첫 10줄 안에 decision, conclusion, recommended action 중 적어도 하나를 둔다.
- 내부 분석 문서와 제출용 또는 공개용 문구를 분리한다.
  private 지원 전략, 후보자 맥락, reviewer 판단은 제출용 초안이나 공개용 study artifact에 섞지 않는다.
- `needs_evidence`는 그대로 남기지 않는다.
  발견 즉시 `보강 필요 / 선택지 / 권장 행동` 루프로 바꿔 사용자나 runner가 다음 행동을 판단할 수 있게 한다.

## 기능 목록

**dispatcher 폐기 완료 (plan023, ADR-031)** — 모든 진입점이 native skill `claude -p "/<skill>"` 직접 호출로 단일화됨.

| 명령 | 산출물 | push | 빈도 |
|---|---|---|---|
| `/position-recommender` | 활성 공고 자동 수집 + 후보자 프로필 매칭 추천<br>3 티어: 강력 / 도전 / 보류·주의<br>`data/runtime/position-recommendation.md`<br>`data/reports/daily/YYYY-MM-DD/position-recommendation/report.md`<br>ADR-030, plan022 | 없음 | 매일 |
| `/interview-prep-analyzer` | 면접 준비 갭 분석과 단계별 면접 준비 (자연어 분기)<br>baseline: 큐레이션 10파일 + 7섹션 고위험 영역 도출<br>daily: 토픽 1개 3-5파일 + 5섹션 + `config/study-progress.json` 갱신<br>stage: first-round / final-round / offer-chat 회사·직무 맥락 + 후보자 이력 기반 예상 질문·답변 리스크·역질문<br>`data/reports/{baseline,daily}/YYYY-MM-DD/report.md` 또는 `data/reports/daily/YYYY-MM-DD/interview-prep-<stage>/report.md`<br>ADR-027, ADR-048, plan017, plan041 | 없음 | baseline: 시즌 시작 시<br>daily: 매일<br>stage: 면접 전 |
| `/study-topic-recommender` | 아침 토픽 추천 10픽 + 오늘의 3선<br>기존 문서 보강 후보 (최대 5개, ADR-033)<br>replenish + live-coding seed 선택<br>`data/runtime/morning-topic-recommendation.md`<br>ADR-026, plan016 | 없음 | 매일 |
| `/study-pack-writer <topic>` | 토픽 1개 풀 마크다운 스터디팩 → fos-study 푸시<br>duplicate guard (ADR-033): high/medium 중복 시 update-existing 전환<br>self-check 내장 (plan014에서 maintain-study-pack 흡수) | ✓ | 토픽별 |
| `/interview-asset-writer <topic>` | 후보자 이력 중심 Q&A 질문 은행 + 마스터 플레이북<br>→ fos-study 푸시<br>plan015 | ✓ | 토픽별 |
| `/candidate-baseline-suggester` | fos-study 학습 이력 기반 자산 자동 갱신<br>대상: candidate-profile.md, baseline-core-files.json, `config/study-progress.json` weak_spots<br>방식: Append + 주석 마킹 (기존 본문 보존)<br>audit trail: `data/runtime/profile-refresh-suggestions/YYYY-MM-DD/`<br>ADR-028, plan020 | 없음 | 2주 1회 이상 |

### 완료 기반: application agent MVP (plan029)

`plan029-application-agent-mvp`는 기존 native skill들을 조립해 지원 전후 케어 루프를 만든다.
공고 탐색부터 지원 패키지 작성, evidence/drift 검토, daily digest, 제출 후 면접 대비까지 이어진다.

MVP 원칙:

- 수집/분석/초안 작성/검토/daily digest는 자동화한다.
- 단계 전환에는 사용자 승인 게이트를 둔다.
- 각 단계 내부에서는 agent가 `draft -> review -> revise` 루프를 최대 3회 수행한다.
- 실제 제출 자동화는 MVP 범위 밖이다.
  - 최종 제출 버튼은 수동 승인 필수.
- 공고별 지원 전략은 `data/applications/` 비공개 산출물로 저장한다.
- 공개 가능한 순수 기술 학습 자료만 기존 `study-pack-writer` 정책으로 `sources/fos-study/`에 발행한다.

첫 fixture는 TossPlace `Applied AI Engineer` 공고다.
이 공고는 이미 ledger에 있는 후보이므로 중복 승격 방지 검증 샘플로 사용한다.

### 완료 기반: application-flow-agent runtime (plan031)

`plan031-application-flow-agent`는 plan029 산출물 위에 상태 기반 자율 실행 계층을 추가한다.
핵심은 native skill을 순서대로 이어 붙이는 것이 아니라, ledger/runtime을 읽고 상태 기반 루프를 수행하는 TypeScript policy decision engine이다.

상태 루프: `state -> policy decision -> action -> validation -> state update`

MVP 원칙:

- 기존 native skill은 tool로만 재사용한다.
  - `/position-recommender`, `application-package-writer`, `application-reviewer`, `daily-application-digest` 등
- LLM은 분석·작성·추천 근거 생성을 담당한다.
- 상태 전이 허용 여부는 TypeScript policy/validator가 결정한다.
- 분기 종류:
  - no actionable candidate
  - needs_more_search
  - scheduled_retry
  - blocked
  - ready_for_user_review
  - study_loop
- 사용자 승인 없이 수행하지 않는 것:
  - actual submission
  - 외부 사이트 입력/전송
  - 계정 로그인
  - 공개 fos-study 발행
  - 원본 candidate-profile 수정
- plan030 position-recommender freshness guard는 후보 입력 품질 prerequisite로 참조한다.

### Legacy: application frontdoor queue (plan038)

`plan038-application-frontdoor-review`는 application-flow-agent 앞단을 "추천 후보 순위 확인 → 사용자가 N번 준비 시작 선택 → 선택된 후보만 상세 분석/학습/지원 준비로 승격" 흐름으로 정리한다.
이 구조는 ADR-081 이후 대시보드 DB 중심 구조로 대체한다.
`frontdoor-queue.jsonl`은 migration 입력으로만 유지하고, DB import 검증 후 삭제한다.

MVP 범위:

- `/position-recommender` 결과에서 사용자에게 보여줄 지원 후보 순위를 만든다.
- 추천 후보는 `data/runtime/application-agent/frontdoor-queue.jsonl`에 저장한다.
- 사용자가 "N번 준비 시작"을 명시한 후보만 `data/applications/ledger.jsonl`로 승격한다.
- 승격 후 자동 생성 범위는 상세 공고 분석, fit/gap, 공부 우선순위, 예상 면접 질문까지로 제한한다.
- 최종 지원 패키지 생성과 제출 관련 action은 기존 사용자 검토 gate를 유지한다.

초기 검증 대상:

- `카카오페이 서버 개발자 (144295)` — KakaoPay AI track 임시 후보. 별도 AI 전용 URL이 확인되면 교체한다.
- `카카오페이증권 워크플랫폼 백엔드 개발자 (시니어)` — AI/workplatform track 후보.
- `TossPlace Applied AI Engineer` — 이미 ledger에 있으므로 중복 승격 방지 검증 후보.

Question bank 범위 밖:

- Next.js 대시보드와 관리자 로그인은 `plan039`로 분리한다.

### 완료 기반: dashboard canonical application workflow (plan073)

`plan073-dashboard-application-candidate-state`는 포지션 추천 리포트와 지원 준비 workflow를 fos-career DB 중심으로 다시 연결한다.
목표는 `frontdoor queue`라는 중간 workflow 용어를 제거하고, 웹 대시보드에서 지원 후보의 현재 상태와 다음 작업을 직접 관리하게 만드는 것이다.

MVP 범위:

- 아침 포지션 추천 run은 Markdown/HTML 리포트와 함께 structured recommendation item을 만든다.
- fos-career는 추천 item을 DB로 ingest하고 `application_candidates`와 현재 `state`/`stage`를 관리한다.
- 같은 공고가 다시 추천되면 `normalizedPostingUrl` 기반 unique key로 기존 후보를 갱신한다.
- URL이 없거나 불안정하면 `company + title + source + closeDate` 보조 hash를 사용한다.
- `excluded` 후보는 다음 추천 화면에서 기본 숨김 처리한다.
- `held` 후보는 보류 섹션으로 분리한다.
- `started` 후보는 지원 준비 중으로 표시하고 다시 클릭할 수 없게 한다.
- 카드 전체 클릭은 내부 `지원 시작` workflow를 요청한다.
- 지원 시작 workflow는 회사 분석, 공고 분석, fit 분석, 공부팩 생성, 이력서 초안, 제출 후 면접 대비로 이어진다.
- 실행은 dependency 순서대로 진행한다.
  첫 단계는 회사 분석, 공고 분석, fit 분석이다.
- 오래 걸리는 작업은 fos-career DB outbox job으로 저장하고 worker가 주기적으로 처리한다.
- HTML 리포트는 그날의 읽기용 스냅샷으로 유지하고, 현재 상태는 DB를 정본으로 본다.
- `frontdoor-queue.jsonl`은 DB import와 diff 검증 후 삭제한다.

범위 밖:

- 외부 채용 사이트 제출, 로그인, 업로드, 브라우저 입력 자동화.
- 사용자 승인 없는 이메일, 외부 메시지, 공개 발행.
- 한 번의 카드 클릭으로 모든 private 산출물을 무조건 병렬 생성하는 일.
- dashboard container가 career-os checkout을 직접 쓰는 일.

### 계획 중: fos-career mobile navigation and position exploration (plan074)

`plan074-fos-career-mobile-position-explorer`는 plan073 이후 대시보드를 모바일에서 실제 운영 화면으로 쓰기 위한 UX 후속 작업이다.
목표는 늘어난 상단 메뉴를 모바일에서 정리하고, 수집 공고 전체와 추천 후보 5개를 분명히 구분해 탐색할 수 있게 하는 것이다.

MVP 범위:

- 모바일 shell은 하단 네비게이션과 햄버거 또는 더보기 메뉴를 함께 사용한다.
- 모바일 1급 메뉴는 `홈`, `공고`, `후보`, `지원`, `더보기`를 기본값으로 둔다.
- `공고`는 `collected_positions` 전체 풀을 보는 화면이다.
- `후보`는 포지션 추천 run에서 선별된 application candidate 화면이다.
- `/dashboard/positions`는 검색, source/status/urgency 필터, 최신 수집 시각, source 진단 접힘 영역을 제공한다.
- 추천 후보로 승격된 공고는 전체 공고 목록에서도 표시하거나 후보 리포트로 연결한다.
- 추천 후보 카드에는 `priorityReason`, `nextAction`, `evidenceUrls` 같은 구조화 필드를 우선 표시한다.
- structured recommendation item 생성 또는 ingest 단계에서 Markdown 리포트의 추천 근거와 다음 행동이 `latestSnapshotJson`에 빠지지 않게 보강한다.
- 작업 완료 후 당일 포지션 추천을 재실행하고, Toss 계열 쿨다운 해제와 구조화 추출 결과가 DB에 반영됐는지 확인한다.

범위 밖:

- 외부 채용 사이트 제출, 로그인, 업로드, 브라우저 입력 자동화.
- 추천 개수를 5개에서 바꾸는 정책 변경.
- 새 DB 컨테이너 생성.
- dashboard container가 career-os checkout을 직접 쓰는 일.

### 계획 중: fos-career source registry and collection runs (plan075)

`plan075-fos-career-source-registry-collection-runs`는 소스 진단 화면과 수집 공고 DB import를 정식 데이터 모델로 승격한다.
목표는 대시보드가 오래된 `collected_positions` 행에서 source diagnostics를 역산하지 않고, 최신 수집 실행과 source별 원인을 직접 보여주는 것이다.

MVP 범위:

- source 목록은 fos-career DB registry로 관리한다.
- 실제 수집 adapter와 official entrypoint는 career-os `live-postings` 코드가 계속 소유한다.
- 매 수집 실행은 `position_collection_runs`로 저장한다.
- source별 결과는 `position_source_run_diagnostics`로 저장한다.
- `collected_positions`는 개별 공고 pool만 담당한다.
- 추천 run은 사용한 `collectionRunId`를 참조한다.
- 수집 snapshot DB import는 Claude 추천 생성보다 먼저 수행한다.
- `/dashboard/sources`는 registry와 최신 collection run diagnostics를 보여준다.
- 0건 source는 정상 0건, 필터 과도, 파서 변경, 차단, 비활성, 알 수 없음으로 구분한다.
- Naver Careers와 KakaoPay Securities의 0건 원인을 후속 진단 대상으로 남긴다.

범위 밖:

- 수집 source를 무제한으로 추가하는 일.
- 외부 채용 사이트 제출, 로그인, 업로드, 브라우저 입력 자동화.
- 새 DB 컨테이너 생성.
- 추천 후보 개수 정책 변경.

### 계획 중: fos-career position lifecycle validation (plan076)

`plan076-fos-career-position-lifecycle-validation`은 전체 수집 공고 pool을 운영 가능한 lifecycle 상태로 관리한다.
목표는 사람이 닫은 공고, validator가 닫은 공고, 다시 수집되어 열린 공고를 모두 fos-career DB에서 추적하는 것이다.

MVP 범위:

- `collected_positions.postingStatus`를 현재 상태 정본으로 직접 갱신한다.
- 모든 상태 변경은 `position_status_events`에 남긴다.
- `/dashboard/positions`에서 modal로 수동 닫기를 제공한다.
- 수동 닫기는 사유 입력을 필수로 한다.
- validator script는 기본 dry-run이고, `--apply`에서만 실제 상태를 바꾼다.
- validator는 한 번에 처리할 수 있는 상태 변경 상한을 둔다. 기본값은 20개다.
- 3회 이상 최신 수집 실행에서 미등장하고 source 상태가 정상 계열인 공고는 자동 닫기 후보가 된다.
- source가 blocked, parser_changed, failed, skipped, unknown 계열이면 자동 닫지 않고 검증 보류 이벤트를 남긴다.
- 닫힌 공고가 다시 수집되면 snapshot의 `posting_status`로 자동 복구한다.
- 최신/신규/과거 판단은 `collected_position_run_items`를 기준으로 한다.
- 사용자에게 보이는 버튼, 필터, badge, 상태 설명은 한국어 표현을 우선한다.

범위 밖:

- Naver Careers와 KakaoPay Securities adapter 자체 개선.
- 공고 상세 페이지 신설.
- 외부 채용 사이트 접속, 로그인, 제출 자동화.
- validator를 승인 없이 cron으로 자동 적용하는 일.

### 완료 기반: position priority + posting/fit analysis workflow (plan050)

`plan050-position-priority-fit-workflow`는 plan048에서 모은 active/open 공고를 지원 행동 우선순위로 연결한다.
목표는 회사를 절대 순위로 줄 세우는 것이 아니라, 각 공고를 지금 어떤 행동으로 다룰지 정하는 것이다.

MVP 범위:

- collected posting을 posting analysis, fit analysis, gap analysis로 정리한다.
- LLM 추천 초안은 `recommendation_snapshot`으로 저장한다.
- 사용자가 확정한 우선순위는 `user_confirmed_priority`에 따로 저장하고 LLM refresh가 덮어쓰지 않는다.
- action stage 기본값은 `prepare-now`, `investigate`, `monitor`, `low-priority`, `hold`, `excluded`다.
- 사용자 표시가 필요하면 `prepare-now=1`, `investigate=2`, `monitor=3`, 나머지 낮은 행동 단계는 `4`로 매핑한다.
- dashboard는 priority badge/filter, fit summary, gap summary, next action, priority 변경 이력을 읽기 전용으로 보여준다.

재사용 우선 자산:

- plan048 collected postings와 active/open evidence.
- `config/candidate-profile.md`와 기존 resume/profile material.
- application-agent frontdoor queue, ledger, 공고별 posting/fit/package/review 파일.
- prior recommendation reports와 manual active-open URL notes.
- study pack / interview asset workflow.

plan060 범위 밖:

- 외부 채용 사이트 제출 자동화.
- 기존 application package generator를 새 generator로 대체하는 일.

### 완료 기반: priority write-action bridge (plan053)

`plan053-priority-write-action-design`은 fos-career에서 사용자가 확정한 priority action을 career-os 상태로 반영하는 안전한 쓰기 경로를 설계한다.
목표는 dashboard 버튼이 career-os 파일을 직접 수정하지 않게 하면서도, 사용자 확인과 감사 이력을 남기는 것이다.

MVP 범위:

- fos-career는 priority 변경 요청을 자기 MySQL pending queue에 저장한다.
- pending request는 record id, record type, stage, rank, reason, 요청자, 생성 시각, 요청 당시 snapshot을 가진다.
- fos-career는 career-os read-only mount를 계속 유지한다.
- career-os mutation은 기존 `application-agent confirm-priority` 계열 명령이 맡는다.
- 실제 적용 runner는 pending request를 명시적으로 집어 실행하고, career-os `_priority-history.jsonl`에 append-only 이력을 남긴다.
- 적용 전 현재 record와 요청 당시 snapshot을 비교해 stale request를 막는다.

범위 밖:

- dashboard container에 writable career-os mount를 주는 일.
- 외부 채용 사이트 제출 자동화.
- candidate-profile.md 수정.
- LLM recommendation refresh와 priority confirmation을 한 버튼에 묶는 일.
- career-os ledger/frontdoor queue를 fos-career MySQL로 옮기는 일.
  이 범위 밖 결정은 plan053 당시 기준이며, ADR-081 이후 별도 migration plan에서 다시 다룬다.

### 완료 기반: fos-career application workbench (plan054)

`plan054-fos-career-application-workbench`는 fos-career를 "수집 공고 확인 화면"에서 "지원 준비 작업대"로 확장한다.
목표는 사용자가 지금 준비해야 할 후보, 준비 산출물 상태, 다음 행동, 차단 사유를 한 화면에서 판단하게 만드는 것이다.

MVP 범위:

- frontdoor queue와 ledger를 하나의 application workbench projection으로 합쳐 보여준다.
- 각 후보에 stage, status, fit score, material readiness, next action, blocker/risk flag를 표시한다.
- 공고/fit 분석/지원 패키지/review 파일 존재 여부를 readiness checklist로 보여준다.
- application detail 화면은 원문 필드 덤프보다 지원 준비 진행 상태와 다음 행동을 우선 노출한다.
- career-os 파일은 계속 read-only로 읽고, 쓰기 행동은 plan053 pending request bridge 같은 안전 경로만 사용한다.

범위 밖:

- 외부 채용 사이트 제출 자동화.
- candidate-profile.md 수정.
- career-os ledger/frontdoor queue를 fos-career MySQL로 이관.
  이 범위 밖 결정은 plan054 당시 기준이며, ADR-081 이후 plan073에서 대체한다.
- 사용자의 명시 승인 없는 지원 패키지 최종 제출 또는 공개 발행.

### 계획 중: 공고 상태 사용자 액션 (plan059)

`plan059-position-state-actions`는 fos-career workbench에서 사용자가 공고 상태를 직접 바꿀 수 있게 한다.
목표는 추천 결과를 보기만 하는 화면에서 `보류`, `제외`, `지원 준비` 결정을 바로 남기고, 안전한 runner가 career-os 상태와 필요한 산출물을 반영하게 만드는 것이다.

MVP 범위:

- 공고/detail 화면에 `보류`, `제외`, `지원 준비` 액션을 제공한다.
- 사유 입력은 선택으로 둔다.
  비어 있으면 시스템 기본 사유를 저장하되, 사용자가 입력한 사유가 있으면 우선한다.
- `보류`는 action stage를 `hold`로 바꾼다.
- `제외`는 action stage를 `excluded`로 바꾸고 준비 후보에서 제외한다.
- `지원 준비`는 상태 변경에서 멈추지 않고 필요한 지원 준비 자원 생성을 시작한다.
  frontdoor 후보는 ledger 승격을 거친 뒤 `posting.md`, `fit-analysis.md`, `application-package.md`, `resume-draft.md`, `cover-letter.md`, `submission-checklist.md`, `review.md`, HTML/PDF 이력서 생성 흐름으로 이어진다.
- dashboard는 career-os 파일을 직접 쓰지 않고 pending request bridge에 요청을 저장한다.
- processor는 요청 당시 snapshot과 현재 career-os record를 비교해 stale 요청을 막고, 결과를 fos-career request status와 audit log에 남긴다.

범위 밖:

- 외부 채용 사이트 제출, 로그인, 업로드, 브라우저 입력 자동화.
- candidate-profile 자동 수정.
- 버튼 클릭만으로 사용자 검토 없이 외부 메시지나 공개 문서를 발행하는 일.

### 계획 중: CJ푸드빌 면접 skill request gateway (plan060)

`plan060-interview-skill-request-gateway`는 fos-career dashboard에 CJ푸드빌 2026-06-15 면접 준비 hub를 만든다.
목표는 사용자가 기존 career-os 면접 준비 자산을 한 화면에서 확인하고, 부족한 준비 자산 생성을 안전한 request queue로 요청하게 하는 것이다.

MVP 범위:

- dashboard는 `config/mvp-target.json`의 현재 면접 target과 career-os read-only projection을 읽어 CJ푸드빌 2026-06-15 준비 hub를 표시한다.
- hub는 `config/mvp-target.json`의 `primary.data_root`가 가리키는 `private/<company>/<position>/interview/prep.md`를 면접 준비 단일 정본으로 보여준다.
  여러 markdown 카드를 나열하지 않고, 예상 질문·전략·체크리스트·단기 Java 준비를 `prep.md` 섹션에서 파싱하거나 앵커로 연결한다.
- 기존 native skill을 새 generator로 대체하지 않고 바로 연결한다.
  - `interview-prep-analyzer`
  - `interview-asset-writer`
  - `study-pack-writer`
- 면접 대비 중 공부해야 할 주제가 생기면 dashboard에서 study pack 생성 요청까지 만들 수 있다.
- `study-pack-writer` 요청은 이전 방식처럼 `sources/fos-study/`에 `[초안]` 제목의 공부팩을 즉시 생성하고 commit/push까지 이어진다.
  단, 공개 가능한 순수 기술 주제일 때만 허용한다.
- dashboard는 면접 예상 질문별 답변 텍스트 입력을 받고, 답변 제출 직후 `answer_feedback` request를 생성한다.
  답변 전문과 상세 피드백은 DB에 저장해 화면에서 바로 볼 수 있게 한다.
- 면접 대화 세션 UX는 `질문 생성/선택 -> 답변 입력 -> 피드백 -> 꼬리질문 -> 답변 -> 최종 요약/보완 주제/study-pack 후보` 흐름을 기본값으로 둔다.
- 긴 면접 질문은 `<select>`로 잘려 보이지 않게 한다.
  질문 후보는 줄바꿈되는 버튼 목록으로 선택하고, 선택된 질문 전문은 readonly textarea에 표시한다.
- 면접 대화 세션은 기본 5턴으로 시작하고, 사용자가 원하면 자유형으로 연장할 수 있다.
- 피드백은 점수화한다.
  기본 평가 기준은 기술 정확성, 경험 연결, 답변 구조, CJ푸드빌 맥락 반영이다.
  너무 짧거나 의미 있는 기술·경험 신호가 없는 답변은 강점 문구를 붙이지 않고 1/5 수준의 insufficient feedback으로 처리한다.
  정상 답변은 `prep.md` 기반 career context LLM evaluator가 구조화 JSON으로 평가하고, 꼬리질문 생성 여부와 내용을 함께 판단한다.
  LLM timeout, 설정 오류, JSON parse 실패는 deterministic fallback으로 처리한다.
- study pack 생성 요청은 고정 추천뿐 아니라 사용자의 자연어 요청도 받는다.
  예: "어떤 스터디팩 만들어줘" 같은 요청을 public-safe topic으로 정규화한다.
- 사용자가 인터뷰 중 특정 주제를 정말 모르겠다고 느끼면 해당 대화 turn에서 직접 study-pack 생성 요청을 만들 수 있다.
- CJ푸드빌 2026-06-15 면접 종료 후 해당 면접모드는 read-only/archive 상태로 전환한다.
- dashboard는 skill을 직접 실행하지 않고 fos-career MySQL request queue에 요청만 저장한다.
- processor가 request를 읽고 career-os writable checkout에서 허용된 native skill만 호출한다.
- 처리 결과는 상태, 생성 또는 갱신된 파일 경로, 짧은 요약, 오류 요약만 저장한다.

### 계획 중: 공개 가능 일반 질문 bank collector

일반 backend/CS 면접 질문은 `data/`가 아니라 git 추적 가능한 `public/question-bank/`에 저장한다.
이 영역은 공개 가능 자산이지만 자동 발행 대상은 아니며, 검수된 문서만 `sources/fos-study/`로 재작성한다.

MVP 범위:

- Java/Spring, DB, CS, 운영/장애, System design 질문 후보를 만든다.
- 질문은 단순 암기형 원문을 그대로 보관하지 않고 backend 실무형 질문으로 정규화한다.
- 각 항목은 category, difficulty, question, intent, answerSignals, source, publicSafe, positionFitHint, normalizedFrom을 가진다.
- `question-bank-collector` skill은 “일반 backend 질문”, “CS 질문 수집”, “면접 질문 bank”, “질문 뱅크 보강”, “약점 기반 질문 재선별” 같은 자연어 요청에 반응해야 한다.
- fos-career 면접 hub에서 `question_bank_refresh` request를 만들 수 있어야 한다.
  processor는 `question-bank-collector`를 실행하고 `public/question-bank` 갱신 결과만 저장한다.
- 포지션별 최종 질문은 `private/<company>/<position>/interview/prep.md`에 선별 반영한다.

범위 밖:

- 유료 강의/문제집/면접 후기 원문 복사.
- 회사별 비공개 후기성 질문 저장.
- private 답변/지원 맥락을 `public/question-bank/`에 복사.
- 검수 없는 fos-study 자동 발행.
- question bank를 포지션별 `prep.md`에 자동 반영하는 dashboard 버튼.

범위 밖:

- dashboard container에서 `claude -p`를 직접 실행하는 일.
- request result, audit log, Discord 알림에 private 작업 홈의 본문, 면접 답변 전문, 상세 피드백, command stdout 전체를 저장하는 일.
- 사용자가 입력한 답변 기록을 그대로 공개 산출물이나 fos-study로 옮기는 일.
- 외부 제출, 공개 발행, 로그인, 업로드.
- candidate-profile 자동 수정.
- 구현 phase에서 docs/ADR/정책 문서를 수정하는 일.
- 면접 준비 리포트, 예상 질문 드릴, 전략, 체크리스트, 단기 Java 준비를 dashboard primary asset으로 각각 분리 노출하는 일.

### 계획 중: resume package flow (plan055)

`plan055-resume-package-flow`는 지원 준비 흐름을 맞춤 이력서 초안까지 확장한다.
목표 흐름은 `공고 발견 -> 우선순위 확정 -> 지원 준비 시작 -> 맞춤 이력서/지원서 생성 -> 리뷰 -> 사용자 승인`이다.

MVP 범위:

- `application-package.md`는 지원 전략과 초안 문서로 유지한다.
- 제출용 초안은 별도 Markdown 산출물로 분리한다.
  - `resume-draft.md`
  - `cover-letter.md`
  - `submission-checklist.md`
- `run.ts resume` 이후 processor는 실제 파일 존재와 freshness를 검증한다.
- `needs_evidence`는 그대로 방치하지 않고 `보강 필요 / 선택지 / 권장 행동` 루프로 전환한다.
- fos-career workbench는 application request 처리 상태를 표시한다.
  상태는 `pending`, `running`, `done`, `failed`, `stale`를 기본값으로 둔다.
- 생성 문서는 한국어 우선 제목과 자연스러운 문장으로 쓴다.
  첫 10줄 안에 결론을 두고, 내부 분석과 제출용 문구를 분리한다.

MVP 목표:

- Markdown 이력서 초안을 만든다.
- `design.md` 계약을 적용한 HTML 이력서를 만든다.
- HTML을 PDF로 변환해 첨부 가능한 PDF 이력서를 만든다.
- 외부 제출 자동화와 로그인/브라우저 입력은 여전히 범위 밖이다.

범위 밖:

- plan055 phase-03 안의 PDF/DOCX 생성.
- 외부 채용 사이트 제출 자동화.
- 로그인, 브라우저 입력, 공개 발행, candidate-profile mutation.
- 사용자 승인 없는 최종 제출.

### Legacy base: fos-career 웹 대시보드 (plan039)

`plan039-fos-career-dashboard`는 career-os 데이터를 브라우저에서 읽고 목적별 버튼과 request queue로 실행할 수 있는 Next.js 관리자 대시보드를 별도 저장소(`~/services/fos-career`)에 구축한다.
ADR-081 이후 dashboard는 read-only projection을 넘어 추천 후보 상태와 outbox job의 정본을 소유한다.
초기 MVP에 있던 범용 LLM 채팅 UI는 ADR-064로 제거한다.

핵심 분리 원칙:

- career-os는 에이전트/데이터/자동화 진실 출처를 유지한다.
- fos-career는 human-facing 웹 제품이다.
- fos-career는 migration 전 career-os 파일을 읽기 전용 마운트(`CAREER_OS_ROOT=/data/career-os`)로 읽는다.
- fos-career가 career-os 파일을 수정하는 것을 금지한다.

MVP 범위:

- 관리자 ID/password 로그인
- frontdoor queue, ledger, position recommendation 읽기 전용 대시보드
- 버튼 기반 pending request UI
- 면접 hub, `interview/prep.md` markdown 보기, 질문 선택, 답변 입력, 피드백 확인
- MySQL 소유 데이터: admin 계정/세션, pending request, 면접 답변/피드백, audit log, action history
- Docker 이미지, 홈서버 역방향 프록시(기존 npm/Node 웹서버) 뒤에 배포
- priority detail view: frontdoor queue와 ledger record를 같은 read-only 화면에서 열고, 추천 snapshot, fit/gap, next action, evidence, preparation action, priority history를 한 곳에서 확인한다.

MVP 범위 밖:

- prepare-start/hold/reject 버튼 등 쓰기 액션 — plan053의 pending request bridge 뒤에서만 다룬다.
- legacy career-os ledger/materials 전체 MySQL 마이그레이션.
  ADR-081의 1차 범위는 추천 후보 상태와 outbox 정본화이며, private 산출물 본문은 계속 career-os 파일에 둔다.
- 외부 채용 사이트 자동 제출
- 공개 fos-study 발행
- candidate-profile.md 수정
- 범용 채팅 UI와 chat 기반 mutation

(ADR-046, ADR-064 참조)

## 산출물 경로 정책

- 외부 공유용 (블로그·인터뷰 자산): `sources/fos-study/`
  - git 동기 외부 저장소
  - study-pack / question-bank가 즉시 commit + push
- 내부 실행 로그·중간 산출물: `data/reports/`, `data/runtime/`
- 공고별 지원 전략: `data/applications/`
  - 맞춤 이력서, 검토 결과, agent decision log
  - plan029/plan031, 비공개
- 정규화 데이터: `data/normalized/`
  - fos-study 덤프 캐시 등

ADR-005 참조 — 외부 공유 문서의 제목에 `[초안]` 표시.
commit 메시지는 `docs(<domain>): add|update draft <topic> study pack` 형식.

## 비기능 요구사항

- **재실행 가능성**: 같은 날 같은 명령을 여러 번 돌려도 정합성 깨지지 않음 (날짜별 멱등)
- **토큰 회계**: `logs/task-runs.jsonl`의 `cost_usd` / `model` / `tokens_*` 필드로 비용 추적 (ADR-014)
- **알림**: 모든 task의 완료/실패는 Discord 알림 + cost summary (ADR-008 + ADR-014)
- **격리**: 다른 워크스페이스와 자산 교차 참조 없음
- **비밀**: `.env`에 GitHub token, Discord webhook 등

## 의도적으로 안 하는 것

- 광범위 풀-리포 분석.
  - baseline은 큐레이션된 10개로 제한 (ADR-003)
- 사용자 개입 없는 fos-study 자동 publish.
  - study-pack 종류만 commit/push, baseline/daily는 로컬에만
- 토픽 자동 promotion에 사용자 검토 우회.
  - Claude는 제안만, 로컬 validator가 게이트 (ADR-011)
- 회사명·면접일을 docs/code에 박기.
  - `config/mvp-target.json`이 단일 출처

## 성공 기준

- 매일 morning 추천 + 오늘의 3선이 4축에서 새 내용으로 나옴
  - 백엔드 / 기술블로그 / AI / geek (ADR-012/013)
- 면접 직전 baseline / daily 사이클이 약점 갱신을 반영
- 비용·모델 추이가 `logs/task-runs.jsonl`로 추적 가능 (ADR-014)
- 모든 study-pack / question-bank 산출물이 fos-study에 자동 push되어 외부에서 바로 열람 가능

> **후보자 약점·강점 정보 위치**: 본 prd.md(제품 문서)에서는 다루지 않는다.
> 후보자 데이터의 단일 출처:
> - `config/candidate-profile.md` "입증된 강점" / "약점 / 학습 중인 영역" 섹션
> - `config/study-progress.json` `weak_spots` 맵

## 미연결 / 보류 항목

워크플로 그래프에 진입점이 없는 자산 (deferred features).
다음 사이클에서 wire-up 또는 폐기 결정.

폐기 완료 항목:

- `live-coding-dispatch`: plan016에서 study-topic-recommender native skill로 흡수
- `bootcamp-batch`: plan014에서 폐기
- `auto-question-bank`: plan015에서 폐기
  - 사용자가 직접 `/study-pack-writer` 또는 `/interview-asset-writer` 반복 호출로 대체
- `collect_live_postings.py` + `publish_job_analysis.sh` + `run_position_recommendation.sh` + `extract_position_report.ts`:
  - plan022에서 폐기
  - `/position-recommender` native skill로 흡수

## 분해 대기 작업

현재 분해 대기 항목 없음.
새 백로그는 GitHub issue (`jon890/fos-claw`) 또는 본 섹션에 추가.

이전 항목들은 모두 처리됨:

- workspace scripts/ 분리 (ADR-019): plan006
- adr.md Quick Index: plan018
- drift된 ADR Status 표기 컨벤션: plan018
- ADR-007 단일 번호 정리: plan018
- command-router 폐기: plan023 post-merge cleanup
