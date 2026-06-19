# Flow - career-os 사용자와 데이터 흐름

career-os의 반복 업무가 어떤 입력에서 시작해 어떤 처리 주체를 거치는지 정리한다.
또한 어떤 산출물과 다음 상태로 이어지는지 함께 정리한다.
이 문서는 빠른 경로 파악을 위한 지도이며, 구현 세부사항을 담지 않는다.
작성 규칙은 [`README.md`](README.md)의 Flow 작성 규칙을 따른다.

## 빠른 이동

| 영역 | 언제 보는지 | 핵심 산출물 |
|---|---|---|
| [문서 책임](#문서-책임) | flow.md에 둘 내용인지 판단할 때 | 문서 경계 |
| [공통 실행 계약](#공통-실행-계약) | 모든 skill 공통 규칙 확인 | 실행, 알림, 안전 경계 |
| [일상 학습](#일상-학습) | 오늘 공부 추천과 study pack 생성 | 추천 리포트, fos-study 초안 |
| [포지션 추천](#포지션-추천) | 공고 수집과 지원 후보 생성 | 추천 JSON, report, 후보 상태 |
| [지원 준비](#지원-준비) | 지원 패키지, 리뷰, 이력서 초안 | 공고별 application 산출물 |
| [면접 준비](#면접-준비) | 역할 핏 진단, 단계별 준비, 드릴 | 면접 준비 자료, 드릴 로그 |
| [질문 은행](#질문-은행) | 공개 가능한 질문 풀 수집과 보강 흐름 | `public/question-bank/` |
| [이력서 패키지](#이력서-패키지) | 검토된 이력서 초안 변환 | `resume.html`, `resume.pdf` |
| [fos-career 연결](#fos-career-연결) | 웹 대시보드와 career-os 연결 | DB request, outbox |
| [실행 가드](#실행-가드) | 평가, stale guard, 사용자 승인 경계 | 검증 결과, 차단 상태 |
| [폐기 흐름과 tombstone](#폐기-흐름과-tombstone) | 폐기된 흐름 확인 | tombstone 요약 |
| [실패 동작](#실패-동작) | 실패 시 어디서 멈추는지 확인 | 실패 알림과 재시도 기준 |

## 문서 책임

`flow.md`에는 흐름을 판단하는 데 필요한 최소 정보를 둔다.
각 섹션은 다음 질문에 답해야 한다.

- 무엇이 이 흐름을 시작하는가.
- 어떤 입력을 읽는가.
- 누가 처리하는가.
- 어떤 산출물을 쓰는가.
- 다음 상태나 다음 사용자 행동은 무엇인가.
- 어떤 안전 경계에서 멈추는가.

다른 문서와의 책임 경계는 [`README.md`](README.md)의 문서별 책임 표를 따른다.

## 공통 실행 계약

career-os의 표준 진입점은 agent skill 직접 호출이다.
문서와 산출물은 `Use skill: /<skill> [args]` 형태로 다음 행동을 안내한다.
특정 에이전트 CLI나 runner는 무인 실행을 위한 호환 계층이며, workflow 계약이 아니다.

공통 처리 흐름:

```text
사용자 요청 또는 예약 실행
  -> 대응 SKILL.md 확인
  -> 입력 파일과 공개/비공개 경계 확인
  -> agent 또는 runner가 필요한 도구 실행
  -> 산출물 작성
  -> 검증과 안전 경계 확인
  -> 다음 행동 또는 사용자 승인 대기 상태 기록
  -> 필요한 경우 Discord 알림
```

공통 안전 경계:

- 실제 제출, 로그인, 업로드, 외부 메시지 전송은 사용자 승인 없이 수행하지 않는다.
- `sources/fos-study/`에는 회사별 지원 전략을 쓰지 않는다.
  후보자 private 이력과 면접 답변 원문도 쓰지 않는다.
- `data/`, `private/`, `public/`, `sources/fos-study/` 경계는 [`data-schema.md`](data-schema.md)를 따른다.
- agent가 만든 제출용 문서에 근거 부족이 남으면 바로 통과시키지 않는다.
  `보강 필요`, `선택지`, `권장 행동`으로 바꿔 사용자 또는 다음 실행으로 넘긴다.

## 일상 학습

매일 학습 흐름은 주제 추천에서 시작해 공개 가능한 기술 문서 초안으로 이어진다.

```text
Use skill: /study-topic-recommender
  -> 현재 학습 상태, 후보 풀, fos-study inventory 읽기
  -> 오늘의 학습 후보와 보강 후보 생성
  -> data/runtime/morning-topic-recommendation.md 작성
  -> 사용자가 주제 선택
  -> Use skill: /study-pack-writer <topic>
  -> 공개 가능한 기술 주제로 정규화
  -> 중복 문서와 public-safe 경계 확인
  -> sources/fos-study/<category>/<topic>.md 작성
  -> fos-study commit 및 push
```

정기 아침 알림은 가벼운 경로를 사용한다.

```text
scheduled daily recommendation
  -> topic inventory refresh
  -> 상위 추천 3개와 버튼 payload 생성
  -> Discord 알림
  -> 사용자가 버튼 또는 자연어로 초안 생성을 요청
  -> study-pack-writer 실행 요청으로 연결
```

`study-topic-recommender`는 후보 추천과 promote 판단을 수행한다.
`study-pack-writer`는 실제 공개 문서 초안을 만든다.
중복 판정, 후보 refresh, live-coding seed 세부 규칙은 각 SKILL.md와 관련 ADR을 정본으로 본다.

주요 산출물:

- `data/runtime/topic-inventory.json`
- `data/runtime/morning-topic-recommendation.md`
- `data/runtime/study-topic-candidate-refresh.{json,md}`
- `data/runtime/study-topic-actions/YYYY-MM-DD.json`
- `sources/fos-study/<category>/<topic>.md`

## 포지션 추천

포지션 추천 흐름은 active/open 공고 후보를 모은다.
그 뒤 지원 가능성을 평가해 다음 행동 후보로 만든다.

```text
Use skill: /position-recommender [context]
  -> 수집 설정(config/position-collection.json) + 후보자 경력(config/candidate-config.json) 읽기  [ADR-099]
  -> 등록된 source에서 active/open 공고 후보 수집 (wanted years는 경력 기반)
  -> 후보자 프로필과 최근 추천 이력 읽기
  -> 강력 추천, 도전 추천, 보류/주의 후보 분류
  -> 표준 출력 JSON(recommendation.json) 작성 — 적재용 source·closeDate 포함  [ADR-101]
  -> Markdown과 HTML report 파생
  -> 수집·추천 건강 지표를 logs/position-metrics.jsonl에 append (기준선 대비 개선 추적)  [ADR-099]
  -> application candidate 상태 또는 legacy frontdoor queue 갱신
  -> 다음 행동 후보를 application flow로 넘김
```

추천 판단의 큰 기준:

- 추천 티어에 오르려면 active/open 개별 공고 URL이 있어야 한다.
- Java/Spring 서버와 백엔드 정규직을 기본 레인으로 본다.
- AI 서비스, AI Agent, AI 플랫폼 공고는 별도 레인으로 평가한다.
  단, 서버와 플랫폼 개발 전이성이 명확해야 한다.
- 순수 연구, PM, 프론트엔드, 데이터 엔지니어 중심 공고는 추천 티어에서 제외한다.
  사용자가 별도로 요청하면 예외로 다룬다.

현재 전환 상태:

- legacy 경로는 `frontdoor-queue.jsonl`을 거쳐 application ledger로 이어진다.
- 목표 경로는 fos-career DB의 recommendation item, application candidate state, outbox job을 정본으로 둔다.
- 수집 source, adapter, 진단 상세는 `code-architecture.md`와 position-recommender SKILL.md를 따른다.

주요 산출물:

- `data/runtime/live-position-postings.md`
- `data/reports/daily/YYYY-MM-DD/position-recommendation/recommendation.json`
- `data/reports/daily/YYYY-MM-DD/position-recommendation/report.md`
- `data/reports/daily/YYYY-MM-DD/position-recommendation/report.html`
- `data/runtime/position-recommendation.md`
- `data/runtime/position-recommendation.html`
- `data/runtime/application-agent/frontdoor-queue.jsonl` (legacy)

## 지원 준비

지원 준비 흐름은 추천 후보를 실제 지원 패키지 후보로 승격하는 과정이다.
자동화는 내부 산출물 작성과 검토까지만 수행한다.
제출은 사용자 승인 뒤 별도 행동으로 남긴다.

```text
추천 후보 선택
  -> 지원 준비 시작 요청
  -> ledger 또는 application candidate state 갱신
  -> posting.md 확보
  -> Use skill: /application-package-writer <posting-path>
  -> fit-analysis.md 작성
  -> application-package.md 작성
  -> resume-draft.md 작성
  -> cover-letter.md 작성
  -> submission-checklist.md 작성
  -> Use skill: /application-reviewer <application-dir>
  -> review.md 작성
  -> pass, revise, blocked 중 하나로 판정
  -> 사용자 검토 대기
```

application-agent runtime은 상태 전이를 검증하고 다음 action을 제안한다.
필수 산출물이 없으면 상태를 앞당기지 않고 command suggestion만 남긴다.

대표 상태 흐름:

```text
discovered
  -> analyzing
  -> preparing_application
  -> needs_revision
  -> ready_for_user_review
  -> approved
  -> submitted
  -> interview_prep
  -> closed 또는 blocked
```

안전 경계:

- `ready_for_user_review` 이후에는 사람이 제출 여부를 결정한다.
- 실제 채용 사이트 입력과 제출은 자동화하지 않는다.
- 근거 없는 정량 성과, private 정보 노출, 직무 요구사항 오독은 review에서 멈춘다.
  판정은 revise 또는 blocked로 남긴다.

주요 산출물:

- `data/applications/ledger.jsonl`
- `data/applications/<application-id>/posting.md`
- `data/applications/<application-id>/fit-analysis.md`
- `data/applications/<application-id>/application-package.md`
- `data/applications/<application-id>/resume-draft.md`
- `data/applications/<application-id>/cover-letter.md`
- `data/applications/<application-id>/submission-checklist.md`
- `data/applications/<application-id>/review.md`

## 면접 준비

면접 준비 흐름은 역할 단위 진단, 단계별 준비, 매일 답변 드릴로 나뉜다.

```text
Use skill: /job-fit-analyzer [역할]
  -> 타깃 해석(인자 또는 mvp-target fallback) + 후보자 프로필·baseline 읽기
  -> 같은 역할 지난 진단 있으면 changeSince 반영
  -> JobFitRun JSON 정본 생성(verdict·careerPath·interviewStrategy 1급, reinforcement 부차)
  -> data/reports/job-fit-YYYY-MM-DD-<slug>.json 작성 → render_job_fit.ts로 md 파생
  -> nextActions 라우팅(최우선 갭 → study-pack)  [ADR-096]
```

```text
Use skill: /interview-stage-prep [first-round|final-round|offer]
  -> 현재 면접 단계와 후보자 프로필 읽기
  -> 단계별 예상 질문, 리스크, 역질문, 준비 체크리스트 작성
  -> data/reports/stage-prep-YYYY-MM-DD.md 작성
```

```text
Use skill: /tech-interview-drill
Use skill: /behavioral-interview-drill
  -> 질문 풀과 약점 기록 읽기
  -> 사용자 답변 1개를 채점
  -> 드릴 로그와 약점 상태 갱신
  -> 필요한 경우 study-pack-writer 위임 후보 생성
```

면접 준비의 사람용 정본은 포지션별 private home에 둔다.
공개 가능한 기술 보강 주제만 `study-pack-writer`로 넘어간다.

주요 산출물:

- `data/reports/job-fit-YYYY-MM-DD-<slug>.{json,md}` (JSON 정본 + md 파생, ADR-096)
- `data/reports/stage-prep-YYYY-MM-DD.md`
- `data/runtime/drill-log-YYYY-MM-DD.jsonl`
- `config/study-progress.json`
- `private/<company>/<position>/interview/prep.md`

## 질문 은행

질문 bank 흐름은 공개 가능한 일반 backend와 CS 질문을 수집하고 정규화한다.
회사별 답변, 지원 전략, 비공개 면접 맥락은 넣지 않는다.

```text
Use skill: /question-bank-collector <topic>
  -> 공개 가능한 source와 기존 질문 풀 읽기
  -> 질문 후보 생성
  -> public-safe 여부와 중복 여부 확인
  -> category, difficulty, intent, answer signals 정규화
  -> public/question-bank/ 갱신
  -> 필요한 경우 private 면접 prep에 선별 반영 후보 제공
```

fos-career 면접 hub에서 질문 bank 보강을 요청할 때도 직접 실행하지 않는다.
request queue에 넣고 host-side processor가 allowlist를 확인한 뒤 career-os skill을 실행한다.

주요 산출물:

- `public/question-bank/<category>/questions.json` (질문 정본, behavioral 포함 — ADR-097)
- `private/question-bank/{behavioral,tech}-personal.jsonl` (개인 맞춤 질문 정본)

## 이력서 패키지

resume package 흐름은 검토된 이력서 초안을 첨부 가능한 파일로 변환한다.
외부 제출이나 업로드는 포함하지 않는다.

```text
application review 통과
  -> resume-draft.md 확인
  -> design.md 또는 기본 이력서 디자인 계약 적용
  -> resume.html 생성
  -> resume.pdf 생성
  -> 사용자 검토 대기
```

주요 산출물:

- `data/applications/<application-id>/resume-draft.md`
- `data/applications/<application-id>/resume.html`
- `data/applications/<application-id>/resume.pdf`

## fos-career 연결

fos-career는 career-os 파일과 상태를 웹에서 보기 위한 별도 서비스다.
대시보드는 기본적으로 career-os를 읽기 전용으로 다룬다.
쓰기 작업은 request queue와 host-side processor를 통해 수행한다.

읽기 흐름:

```text
브라우저 요청
  -> fos-career route
  -> 관리자 세션 검증
  -> career-os read-only projection 또는 fos-career DB 조회
  -> 화면 표시용 view model 생성
  -> dashboard 렌더링
```

쓰기 요청 흐름:

```text
사용자 버튼 또는 form 제출
  -> fos-career API
  -> 관리자 세션 검증
  -> 현재 snapshot 저장
  -> pending request 또는 outbox job 생성
  -> host-side processor가 lock 획득
  -> stale guard 확인
  -> 허용된 career-os runner 또는 skill 실행
  -> 결과 snapshot 저장
  -> dashboard에서 pending, running, done, failed, stale 표시
```

적용 대상:

- priority 변경 요청
- 공고 상태 변경 요청
- 지원 준비 시작 요청
- 면접 skill request
- 질문 bank 보강 요청

경계:

- web container는 career-os 파일을 직접 수정하지 않는다.
- private 본문, 면접 답변 전문, command stdout 전체는 request result에 저장하지 않는다.
- long-running 작업은 outbox job으로 분리한다.
- 외부 제출, 공개 발행, candidate-profile 자동 수정은 allowlist 밖이다.

## 실행 가드

runtime guard는 자동화가 잘못된 상태 전이를 만들지 않게 막는다.

주요 guard:

- freshness guard: 오래된 포지션 추천이나 stale snapshot으로 지원 준비를 시작하지 않는다.
- artifact guard: 필수 산출물이 없으면 다음 상태로 넘기지 않는다.
- user gate: 제출, 공개, 외부 전송, 민감 정보 수정은 사용자 승인 전 멈춘다.
- cooldown guard: 회사나 그룹 단위 쿨다운을 무시하지 않는다.
- privacy guard: private 지원 전략과 공개 산출물 경계를 확인한다.

평가 흐름:

```text
fixture 또는 실제 application package 선택
  -> evaluator 실행
  -> pass, revise, blocked 판정
  -> report 작성
  -> regression 신호 확인
```

평가 결과는 실제 제출 자동화가 아니라 생성 품질 회귀를 막기 위한 guardrail이다.

## 폐기 흐름과 tombstone

현재 활성 흐름을 이해하는 데 필요한 폐기 이력만 남긴다.
상세 마이그레이션 기록은 ADR과 task 기록을 따른다.

| 항목 | 현재 상태 | 현재 대체 흐름 |
|---|---|---|
| dispatcher와 `run_now.sh` | career-os 활성 진입점에서 제거됨 | agent skill 직접 호출 |
| `interview-prep-analyzer` | 제거됨 | `job-fit-analyzer`, `interview-stage-prep`, drill 계열 |
| `frontdoor-queue.jsonl` | legacy staging file | fos-career DB application candidate state |
| 범용 LLM 채팅 UI | 제거됨 | 목적별 request와 evaluator |
| 오래된 subprocess writer 경로 | 제거됨 | 현재 에이전트가 SKILL.md workflow 수행 |

## 실패 동작

실패는 조용히 통과시키지 않는다.
흐름별 실패는 report, request status, stderr, Discord 알림 중 적절한 위치에 남긴다.

공통 실패 흐름:

```text
실행 또는 검증 실패
  -> 현재 상태 유지
  -> 실패 사유 기록
  -> 자동 재시도 가능 여부 판단
  -> 사용자 승인이나 입력이 필요하면 대기 상태로 전환
  -> 필요한 경우 Discord 실패 알림
```

실패 기준:

- compatibility backend timeout은 실패로 기록한다.
- fos-study push 실패는 silent 처리하지 않는다.
- validator 실패는 재시도 가능 범위에서만 반복한다.
- stale request는 원장을 쓰지 않고 stale 상태로 멈춘다.
- blocked 판정은 사용자가 명시적으로 해제하기 전까지 자동 진행하지 않는다.
