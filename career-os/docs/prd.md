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
이 공고는 Toss 계열 쿨다운을 고려해 실제 지원 목적이 아니라 MVP 검증용 샘플로 사용한다.

### 계획 중: application-flow-agent runtime (plan031)

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

### 계획 중: application frontdoor queue (plan038)

`plan038-application-frontdoor-review`는 application-flow-agent 앞단을 "추천 후보 순위 확인 → 사용자가 N번 준비 시작 선택 → 선택된 후보만 상세 분석/학습/지원 준비로 승격" 흐름으로 정리한다.

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

범위 밖:

- Next.js 대시보드와 관리자 로그인은 `plan039`로 분리한다.

### 계획 중: position priority + posting/fit analysis workflow (plan050)

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

범위 밖:

- 외부 채용 사이트 제출 자동화.
- 기존 application package generator를 새 generator로 대체하는 일.

### 계획 중: priority write-action bridge (plan053)

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

### 계획 중: fos-career 웹 대시보드 (plan039)

`plan039-fos-career-dashboard`는 career-os 데이터를 브라우저에서 읽고 LLM과 채팅으로 해석할 수 있는 Next.js 관리자 대시보드를 별도 저장소(`~/services/fos-career`)에 구축한다.

핵심 분리 원칙:

- career-os는 에이전트/데이터/자동화 진실 출처를 유지한다.
- fos-career는 human-facing 웹 제품이다.
- fos-career는 career-os 파일을 읽기 전용 마운트(`CAREER_OS_ROOT=/data/career-os`)로만 읽는다.
- fos-career가 career-os 파일을 수정하는 것을 금지한다.

MVP 범위:

- 관리자 ID/password 로그인
- frontdoor queue, ledger, position recommendation 읽기 전용 대시보드
- LLM 채팅 UI (career-os 파일을 컨텍스트로 주입)
- MySQL 소유 데이터: admin 계정/세션, LLM 채팅 이력, audit log, action history
- Docker 이미지, 홈서버 역방향 프록시(기존 npm/Node 웹서버) 뒤에 배포
- priority detail view: frontdoor queue와 ledger record를 같은 read-only 화면에서 열고, 추천 snapshot, fit/gap, next action, evidence, preparation action, priority history를 한 곳에서 확인한다.

MVP 범위 밖:

- prepare-start/hold/reject 버튼 등 쓰기 액션 — plan053의 pending request bridge 뒤에서만 다룬다.
- career-os ledger/materials MySQL 마이그레이션 — 프로그레시브 마이그레이션은 별도 결정에서 다룬다.
- 외부 채용 사이트 자동 제출
- 공개 fos-study 발행
- candidate-profile.md 수정

(ADR-046 참조)

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
