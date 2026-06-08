# Flow — career-os 사용자/데이터 플로우

career-os의 일상적 사용 패턴과 각 명령의 데이터 흐름. 새 워크플로를 추가하거나 기존 흐름을 변경할 때 여기를 같이 갱신한다.

## 일상 사이클 (가장 자주 도는 흐름)

```
[매일 아침]
  ↓
  claude -p "/study-topic-recommender"  → data/runtime/morning-topic-recommendation.md
  ↓ (10픽 + 오늘의 3선)
  사용자가 1개 토픽 선택
  ↓
  claude -p "/study-pack-writer <topic>"      → sources/fos-study/<domain>/<topic>.md
  ↓ (또는)
  claude -p "/interview-asset-writer <topic>" → sources/fos-study/interview/<형식별 경로>/<topic>.md
  ↓
  fos-study git commit + push (자동)
  ↓
  Discord 알림: [완료] <topic> · $0.27 · sonnet-4-6 · 24k→6k 토큰 · 105s
```

```
[정기 백그라운드 — cron]
  ↓
  (replenish는 plan015에서 별도 명령 폐기 — plan016에서 study-topic-recommender native skill로 흡수 완료)
  ↓
  claude -p "/position-recommender"    → data/runtime/position-recommendation.md
  ↓
  study-topic-recommender (native)가 갱신된 inventory를 읽음
```

## 명령별 데이터 흐름

dispatcher 폐기 완료 (plan023, ADR-031) — 모든 명령은 native skill 직접 진입: `claude -p "/<skill>" [args]`. 완료/실패 시 Discord 알림 발송 (`bun --env-file=career-os/.env _shared/lib/notify_discord.ts` 경유, ADR-021).

### 생성 문서 품질 계약 (전역)

모든 생성 흐름은 파일 쓰기 전 또는 post-validation에서 다음 기준을 확인한다.

```text
생성 입력 수집
  -> 내부 분석과 제출용/공개용 산출물 경계 확인
  -> Markdown 생성
  -> 첫 10줄 안에 decision / conclusion / recommended action 확인
  -> 한국어 우선 섹션 제목과 자연스러운 한국어 문장 확인
  -> needs_evidence 잔존 여부 확인
  -> 보강 필요 / 선택지 / 권장 행동 루프로 변환
  -> 용도별 파일에만 저장
```

원칙:

- 내부 분석은 private 산출물에 둔다.
- 제출용 문구와 공개용 문구는 private 판단 근거를 그대로 복사하지 않는다.
- 공개용 산출물은 회사별 지원 전략, 후보자 private 이력, 내부 reviewer 판단을 포함하지 않는다.
- `needs_evidence`가 남아 있으면 통과시키지 않고 `보강 필요 / 선택지 / 권장 행동`으로 바꾼다.

### data 경계와 보존 흐름

`data/` 아래 흐름은 ADR-058의 private by default 원칙과 ADR-062의 position home 원칙을 따른다.
정리 작업은 삭제보다 archive, tombstone, retention 검토를 먼저 수행한다.
다만 구조 전환에서 `private/<company>/<position>/` 정본으로 대체가 끝난 legacy mirror/runtime/report는 archive 없이 제거할 수 있다.

```text
source 수집 또는 agent 실행
  -> private, data/source, data/runtime, data/reports, data/applications 중 책임 위치 선택
  -> 지원/면접/후보자 맥락과 연결됐는지 확인
  -> 연결됐으면 private by default
  -> 오래됐거나 active 판단에서 빠졌으면 retention 검토
  -> 구조 전환에서 새 정본으로 대체된 legacy runtime/report는 archive 없이 삭제 가능
```

위치별 기본값:

- `private/<company-slug>/<position-slug>/`는 active 회사·직무별 사람이 보는 준비 홈이다.
  면접 연습, 지원 준비, 포지션별 스터디 재료를 한 폴더에서 찾기 위한 작업 홈이다.
  새 웹 화면과 자동화는 `config/mvp-target.json`의 `primary.data_root`를 정본으로 읽는다.
  면접 준비의 사람용 정본은 `interview/prep.md` 하나이며, 리포트·예상 질문·전략·체크리스트·단기 Java 준비는 이 파일의 섹션으로 정제한다.
  공개 가능한 기술 공부팩은 개인 답변·지원 전략·회사별 민감 맥락을 제거해 `sources/fos-study/`에 따로 작성할 수 있다.
- `data/source/`는 수집 원문과 노트의 입력 위치다.
  외부 공개 페이지에서 왔더라도 지원/면접과 연결되면 비공개 입력으로만 읽는다.
- `data/runtime/`은 최신 projection, cache, lock, eval 결과를 둔다.
  장기 근거가 되면 runtime에 남기지 말고 `data/reports/`, task evidence, `private/archive/` 중 하나로 승격 결정을 남긴다.
- `data/reports/`는 generated report를 둔다.
  최근 운영 판단, task/ADR 근거, application/interview prep 참조가 있으면 보존하고, 없으면 archive 후보로 둔다.
- `data/applications/`는 실제 지원 준비와 제출 전 검토 산출물의 private home이다.
- `private/`는 포지션별 작업 홈이다.
  그대로 공개 경로로 복사하지 않고, 공개 가능한 기술 자료로 재작성한 결과만 `sources/fos-study/`에 둔다.

### `/interview-prep-analyzer` (native skill — plan017, baseline + daily 두 모드 자연어 분기)

native skill 패턴: `claude -p "/interview-prep-analyzer [args]"` → SKILL.md 자동 로드 → Claude가 도구로 직접 처리.

호출 시그니처:

```
  /interview-prep-analyzer                  → baseline 자동 (인자 없음)
  /interview-prep-analyzer "오늘 점검"       → daily 자연어
  /interview-prep-analyzer "<topic>"        → daily, 명시 토픽
  /interview-prep-analyzer "전체 진단"       → baseline 명시
```

[모드 분기 — 자연어 추론]

```
  ┌────────────────────────────────────┐       ┌────────────────────────────────────┐
  │ baseline 모드                       │       │ daily 모드                          │
  │ ───────                             │       │ ───────                             │
  │ Read: config/baseline-core-files    │       │ Topic 선택:                         │
  │ Read: 10 파일 (큐레이션)            │       │  - 인자 명시 → 그대로               │
  │ Claude 분석 → 7 섹션                │       │  - 없으면 config/study-progress.json │
  │ Write: data/reports/baseline/       │       │    → 가장 오래된 토픽 자연어 선택   │
  │  YYYY-MM-DD/report.md               │       │ Read: config/topic-file-map.json    │
  │                                     │       │ Read: 3-5 파일                      │
  │                                     │       │ Claude 분석 → 5 섹션                │
  │                                     │       │ Write: data/reports/daily/          │
  │                                     │       │  YYYY-MM-DD/report.md               │
  │                                     │       │ Edit: config/study-progress.json    │
  │                                     │       │  → 토픽 last_studied = 오늘 갱신    │
  └────────────────────────────────────┘       └────────────────────────────────────┘
```

공통:
- Read: `config/mvp-target.json` + `config/candidate-profile.md`
- `fos-study git pull --rebase --autostash` (사전)
- Discord 알림 [완료] + cost

옛 외부 subprocess 흐름 (dispatcher → run_baseline/daily/smoke.sh → 6 Python script → claude --print → extract → 갱신)은 plan017에서 폐기됨. smoke 모드 자체도 폐기 — Claude 호출 sanity는 다른 skill 사용 중에 자연 확인.

상세 동작: `career-os/.claude/skills/interview-prep-analyzer/SKILL.md` Workflow 섹션 참조.

### `/candidate-baseline-suggester` (native skill — plan020, ADR-028)

native skill 패턴: `claude --permission-mode acceptEdits -p "/candidate-baseline-suggester"` → SKILL.md 자동 로드 → Claude가 도구로 직접 처리.

```
호출: claude --permission-mode acceptEdits -p "/candidate-baseline-suggester"
  ↓
Read: candidate-profile.md + baseline-core-files.json
      + config/study-progress.json + (선택) data/reports/baseline/<latest>/
      + fos-study git log (전체 history)
  ↓
Backup → data/runtime/profile-refresh-suggestions/YYYY-MM-DD/before/
  ↓
Claude 자연어 분석:
  - 강점 추가 후보 (fos-study 학습 증거)
  - 약점 outdated 후보 (학습 완료 → 주석 마킹)
  - baseline-core-files 추가 후보 (fos-study 새 핵심 파일)
  - weak_spots 평가 갱신
  ↓
Edit 적용 (Append + 주석 마킹):
  candidate-profile.md / baseline-core-files.json / prd.md / study-progress.json
  ↓
audit trail Write → after/ + diff/ + changes.md
  ↓
Discord 알림 [완료]
```

자동 commit 없음 — 갱신된 자산을 git에 추가할지 사용자가 결정.

상세 동작: `career-os/.claude/skills/candidate-baseline-suggester/SKILL.md` Workflow 섹션 참조.

### `/position-recommender` (native skill — plan022, ADR-030)

native skill 패턴: `claude -p "/position-recommender [자연어 컨텍스트] [채용공고 file path]"` → SKILL.md 자동 로드 → Claude가 도구로 직접 처리.

```
호출: claude -p "/position-recommender [자연어 컨텍스트] [채용공고 file path]"
  ↓
Bash: bun career-os/scripts/position-recommender/collect_live_postings.ts
  → live-postings source registry (`all`은 등록된 모든 source)
  → source adapters (Wanted broad/target URL, Toss, KakaoPay, KakaoPay Securities 등)
  → detail page active/open evidence 확인
  → active validator (direct posting + active/open + leakage boundary)
  → renderer
  → data/runtime/live-position-postings.md
  ↓
Read:
  - config/candidate-profile.md
  - config/sources.json (techBlog 필드)
  - references/position-recommendation-prompt.md
  - references/position-context-index.md
  - references/position-decision-criteria.md
  - references/company-upside-reference.md
  - references/verified-company-research-targets.json
  - 최근 7일 data/reports/daily/*/position-recommendation/report.md
  - (선택) 사용자 자연어로 지정한 채용공고 file
  ↓
Claude 자연어 분석:
  - 강력 추천 / 도전 추천 / 보류·주의 3 티어
  - role title + posting 링크 + 지원 근거 + gap + first action
  - 추천 순위, fit/gap, 커리어 서사 판단은 LLM이 담당
  - collector는 active/open 개별 공고 후보 정제까지만 담당
  - active/open 여부는 추정하지 않고 snapshot evidence만 사용
  - 최근 7일 반복 후보 감점 + 신규 후보/추가 수집 대상 최소 1개 포함
  ↓
Self-check: 첫 줄 # + 오늘 날짜 + 30줄+ + 3 티어 + 반복 점검 존재 (재작성 최대 3회)
  ↓
Write: data/reports/daily/YYYY-MM-DD/position-recommendation/report.md
       data/runtime/position-recommendation.md (cp 사본)
  ↓
Discord 알림 [완료]
```

daily cron은 `scripts/position-recommender/run_daily_with_claude.sh`를 통해 실행한다. 이 wrapper는 Claude native skill 호출 후 오늘 날짜 report/runtime이 실제로 생성됐는지 검증하고, stale runtime 재전송을 실패로 처리한 뒤 `_shared/lib/notify_discord.ts`로 Discord 알림을 보낸다. 아침 Discord 알림은 전체 리포트를 붙이지 않고 상위 강력 추천 3개 + 도전 추천 2개를 `지원 링크 / 이유 / 확인할 점 / 다음 액션` 중심으로 압축한다. Claude native skill 내부에서는 외부 메시지 전송을 직접 수행하지 않는다.

source coverage 확장 원칙은 ADR-051을 따른다. Wanted broad scan은 유지하고, Wanted target URL 검증은 `wanted` source의 `target-url` discovery mode로 처리한다. KakaoPay official careers/GreetingHR와 KakaoPay Securities official careers는 primary source로 수집한다. 한 source 실패는 다른 source의 수집·import·dashboard 표시를 막지 않는다.

추천 범위는 Java/Spring 서버·백엔드 정규직을 기본으로 하되, 사용자의 현재 선호에 따라 AI 서비스/AI Transformation(AX)/AI Agent/AI 플랫폼 공고도 별도 레인으로 평가한다. 단, 이 레인의 공고도 추천 티어에 오르려면 active/open 개별 공고 URL이 있어야 하며, 서버·플랫폼 개발 전이성(API, Agent/RAG/LLM workflow, LLMOps/MLOps, 개발 생산성 자동화, SDLC AI 활용 등)이 명확해야 한다. 순수 AI Research, PM, 프론트엔드, 데이터 엔지니어 중심 공고는 사용자가 별도로 요청하지 않는 한 추천 티어에서 제외한다.

상세 동작: `career-os/.claude/skills/position-recommender/SKILL.md` Workflow 섹션 참조.

### Application Agent MVP (completed base — plan029)

plan029는 기존 position/study/interview native skill을 조립해 지원 전후 전체 루프를 만든다.

초기 MVP 흐름:

```text
공고 수집/추천
  -> 지원 후보 순위 생성
  -> frontdoor queue에 사용자 선택 대기 상태로 저장
  -> 사용자가 "N번 준비 시작" 선택
  -> 선택된 후보만 ledger로 승격
  -> 공고별 fit/gap 분석
  -> 공부 우선순위 / 예상 면접 질문 생성
  -> 맞춤 지원 패키지 작성
  -> evidence/drift review
  -> 사용자 승인
  -> 제출 기록 또는 보류
  -> 제출 후 interview_prep / study loop
  -> daily application digest
```

상태 흐름:

```text
discovered
  -> analyzing
  -> preparing_application
  -> needs_revision
  -> ready_for_user_review
  -> approved
  -> submitted
  -> interview_prep
  -> interview_scheduled
  -> closed
  -> blocked
```

역할 분담:

- `/position-recommender`: 공고 수집/추천/초기 fit 분석
- `application-package-writer`: 공고별 지원 패키지 생성
- `application-reviewer`: 근거/과장/드리프트/쿨다운 검토
- `daily-application-digest`: 매일 진행 상태와 다음 액션 요약
- `/study-topic-recommender` + `/study-pack-writer`: 해당 직무 gap 기반 공개 가능한 기술 학습 자료
- `/interview-asset-writer` + `/interview-prep-analyzer`: 제출 후 면접 대비

중요 경계:

- 실제 제출 자동화는 MVP 범위 밖이다.
- 공고별 맞춤 이력서, 지원동기, 지원 전략은 `data/applications/` 비공개 산출물로 둔다.
- `sources/fos-study/`에는 회사명/개인 지원 전략이 빠진 순수 기술 학습 자료만 발행한다.

### Application Frontdoor Queue (implemented — plan038)

plan038은 `/position-recommender` 결과와 `application-flow-agent` ledger 사이에 사용자 선택 전용 queue를 둔다.

```text
/position-recommender report
  -> frontdoor queue 생성/갱신
  -> 후보 순위 + 추천 이유 + 확인할 점 표시
  -> 사용자 입력: "N번 준비 시작"
  -> 해당 queue record를 start_approved로 전환
  -> ledger 중복 확인
  -> 신규 후보면 ledger record + applicationDir 생성
  -> 이미 ledger에 있으면 promotedApplicationId만 연결
  -> 상세 공고 분석 / fit-gap / 공부 우선순위 / 예상 면접 질문으로 진입
```

frontdoor queue 상태:

- `collected`
- `shortlisted`
- `needs_user_start_approval`
- `start_approved`
- `promoted_to_ledger`
- `rejected`
- `expired`

초기 검증 후보:

- KakaoPay AI track candidate: `카카오페이 서버 개발자 (144295)` — 로컬 리포트에는 별도 AI 전용 공고가 없어 임시 후보로 사용한다.
- KakaoPay Securities AI/workplatform candidate: `카카오페이증권 워크플랫폼 백엔드 개발자 (시니어)`.
- TossPlace AI candidate: `TossPlace Applied AI Engineer` — 이미 ledger에 있으므로 중복 생성 없이 연결해야 한다.

범위 경계:

- plan038은 frontdoor queue, 사용자 선택, ledger 승격, 상세 분석/학습 진입까지만 다룬다.
- Next.js 대시보드와 관리자 로그인은 plan039에서 다룬다.
- 최종 지원 패키지 작성, 제출 승인, 외부 사이트 입력/전송은 기존 사용자 검토 gate를 유지한다.

### Position Priority + Posting/Fit Analysis Workflow (implemented — plan050)

plan050은 plan048 collected postings를 action stage 중심 priority로 연결한다.
LLM은 추천 초안을 만들고, 사용자가 확정한 priority는 별도 필드에 보존한다.

```text
plan048 collected postings
  -> posting analysis
     - active/open evidence
     - 역할/연차/스택/지원 경로
     - 마감 또는 always-open 상태
  -> fit analysis
     - candidate-profile
     - 기존 resume/profile material
     - application-agent posting/fit/package/review 파일 재사용
  -> gap analysis
     - 부족 근거
     - 준비할 기술/면접 포인트
     - study pack / interview asset 연결 후보
  -> LLM recommendation snapshot
     - priority_rank
     - action_stage
     - priority_reason
     - next_action
     - risk_flags
     - evidence_urls
  -> user_confirmed_priority
     - 사용자가 명시 확정한 action stage/rank/reason
     - LLM refresh와 분리
  -> dashboard read-only display
     - priority badges/filters
     - priority detail page by record type and id
     - fit summary
     - gap summary
     - next action
     - priority change history
```

기본 action stage:

- `prepare-now`: 바로 공고 분석, fit/gap 분석, 지원 패키지 초안을 준비한다.
- `investigate`: active/open은 맞지만 요구사항, 회사 맥락, 지원 경로를 더 확인한다.
- `monitor`: 지금 준비하지 않고 daily refresh에서 상태를 본다.
- `low-priority`: 후보로 남기되 현재 행동 목록 아래로 둔다.
- `hold`: 사용자 판단, 마감, 쿨다운, 정보 부족 등으로 보류한다.
- `excluded`: 추천/준비 후보에서 제외한다.

재사용 우선순위:

- 새 generator를 만들기 전에 `position-recommender`, application-agent, study/interview asset workflow를 먼저 연결한다.
- manual active-open URL과 prior recommendation report는 evidence input으로 읽는다.
- `recommendation_snapshot` refresh는 `user_confirmed_priority`를 덮어쓰지 않는다.
- dashboard는 career-os 파일을 읽기만 한다.
  list page는 action stage별 scan을 담당하고, detail page는 record별 posting/fit/gap snapshot, evidence URL, preparation action, priority history를 표시한다.
  priority write UI는 plan053 pending request bridge 뒤에서만 활성화한다.

### Priority write-action bridge (plan053)

fos-career는 dashboard에서 사용자가 확정한 priority action을 바로 career-os 파일에 쓰지 않는다.
요청은 먼저 fos-career MySQL pending queue에 저장하고, career-os 적용은 별도 runner가 기존 application-agent 명령으로 처리한다.

요청 생성 흐름:

```text
사용자가 priority detail에서 stage/rank/reason 확인
  -> POST /api/priority/actions
  -> 관리자 세션 검증
  -> record type/id로 career-os read-only snapshot 재조회
  -> fos-career priority_action_requests row 생성
  -> audit_logs에 priority.request_created 기록
  -> 화면은 pending 상태를 표시
```

적용 흐름:

```text
운영자 또는 승인된 runner가 pending request 하나를 선택
  -> fos-career host-side processor가 request JSON 생성
  -> career-os apply_priority_request.ts가 요청 당시 snapshot과 현재 career-os record 비교
  -> stale이면 career-os 파일을 쓰지 않고 status=stale 결과 JSON 출력
  -> 유효하면 career-os writable checkout에서 confirm-priority helper 호출
  -> career-os frontdoor queue 또는 ledger에 userConfirmedPriority 반영
  -> data/applications/_priority-history.jsonl에 append-only event 기록
  -> fos-career processor가 request status를 applied/stale/rejected/failed로 갱신
  -> audit_logs에 처리 결과 기록
```

회복 흐름:

- `priority_action_requests`는 요청과 결과를 보존한다.
- career-os `_priority-history.jsonl`은 실제 적용 이력을 보존한다.
- 되돌림은 자동 삭제가 아니라 새 user confirmation event로 처리한다.

### 공고 상태 사용자 액션 (plan059 — planned)

fos-career workbench는 사용자가 공고별로 `보류`, `제외`, `지원 준비`를 선택할 수 있게 한다.
이 액션은 career-os 파일을 직접 쓰지 않고 pending request bridge를 통해 처리한다.

요청 생성 흐름:

```text
사용자가 공고/detail에서 보류 | 제외 | 지원 준비 선택
  -> 선택 사유 입력 optional
  -> POST /api/applications/state-actions
  -> 관리자 세션 검증
  -> record type/id로 career-os read-only snapshot 재조회
  -> fos-career user_position_action_requests row 생성
  -> audit_logs에 position_state_action.request_created 기록
  -> 화면은 pending/running/done/failed/stale 상태 표시
```

적용 흐름:

```text
processor가 pending request 선택
  -> 요청 당시 snapshot과 현재 frontdoor/ledger record 비교
  -> stale이면 career-os 파일을 쓰지 않고 status=stale
  -> 보류: action stage hold 반영
  -> 제외: action stage excluded 반영
  -> 지원 준비:
       frontdoor 후보면 ledger 승격
       action stage prepare-now 반영
       지원 준비 산출물 생성 요청 시작
       resume-draft.md -> resume.html -> resume.pdf 흐름까지 연결
  -> 결과 snapshot과 material readiness를 fos-career DB에 저장
  -> audit_logs에 처리 결과 기록
```

안전 경계:

- 사유 입력은 선택이지만 요청 row에는 최종 reason을 항상 저장한다.
- `지원 준비`는 내부 산출물 생성까지만 수행한다.
- 외부 제출, 로그인, 업로드, 공개 발행은 수행하지 않는다.
- dry-run은 stale guard와 예정 command만 검증하고 어느 쪽 파일/DB도 갱신하지 않는다.
- stale 또는 failed row는 같은 record에 대한 새 request를 만들기 전에 사람이 확인한다.

### CJ푸드빌 면접 skill request gateway (plan060 — planned)

fos-career dashboard는 CJ푸드빌 2026-06-15 면접 준비 hub를 제공한다.
hub는 기존 career-os 자산을 읽기 전용으로 보여주고, 부족한 준비 자산은 request queue로 요청한다.

hub projection 흐름:

```text
dashboard request
  -> 관리자 세션 검증
  -> career-os read-only adapter
     - config/mvp-target.json에서 현재 면접 target 확인
     - data/prep/<prep_dir>/ strategy/checklist 존재 확인
     - data/reports/daily/<date>/interview-prep-<stage>/report.md 존재 확인
     - sources/fos-study/의 관련 study/interview asset 경로 존재 확인
  -> CJ푸드빌 2026-06-15 hub view model 생성
     - 상태
     - 파일 경로
     - 짧은 표시용 요약
     - 다음 요청 후보
```

요청 생성 흐름:

```text
사용자가 hub에서 면접 분석 | 면접 asset | study pack 생성 요청 선택
  -> POST /api/interview/skill-requests
  -> 관리자 세션 검증
  -> requestType과 skillName allowlist 검증
  -> 공개 가능 study topic 여부와 private 경계 확인
  -> fos-career interview_skill_requests row 생성
  -> audit_logs에 interview_skill_request.created 기록
  -> 화면은 pending 상태 표시
```

processor 흐름:

```text
processor가 pending request 선택
  -> 요청 당시 target snapshot과 현재 config/mvp-target.json 비교
  -> stale이면 skill을 실행하지 않고 status=stale
  -> allowlist command 생성
     - interview-prep-analyzer first-round
     - interview-asset-writer <topic>
     - study-pack-writer <public-safe-topic>
  -> career-os writable checkout에서 native skill 실행
  -> study-pack-writer 요청이면 sources/fos-study에 [초안] 제목으로 작성
     git pull --rebase --autostash -> commit -> push까지 완료
  -> 생성 또는 갱신된 파일 경로 확인
  -> resultSnapshot에 status, paths, 짧은 summary, errorSummary만 저장
  -> audit_logs에 처리 결과 기록
```

답변 기록과 피드백 흐름:

```text
질문 생성/선택
  -> 기본 5턴 세션 시작
  -> dashboard가 prep.md의 예상 질문을 줄바꿈 가능한 버튼 목록으로 표시
  -> 사용자가 질문을 선택하면 선택된 질문 전문을 readonly textarea에 표시
  -> hidden questionText 값으로 선택 질문을 제출
  -> dashboard textarea에 답변 입력
  -> POST /api/interview/answers
  -> 답변 전문을 private answer record DB에 저장
  -> answer_feedback request 생성
  -> processor가 answer record와 career context bundle을 읽음
     - private/<company>/<position>/interview/prep.md
     - 현재 질문과 사용자 답변
     - 최근 3-5개 답변/피드백 요약
     - 이미 정리된 주제와 낮은 우선순위 주제
     - 포지션/회사 맥락
  -> 답변이 너무 짧거나 의미 있는 기술·경험 신호가 없으면 insufficient feedback으로 분기
  -> guard 통과 답변은 LLM evaluator 호출
     - strict JSON output
     - timeout/config/parse 실패 시 deterministic fallback
  -> 상세 private feedback 생성 후 DB에 저장
     - 강점
     - 리스크
     - 권장 수정 방향
     - 기술 정확성 / 경험 연결 / 답변 구조 / CJ푸드빌 맥락 반영 점수
     - 꼬리질문 생성 여부와 꼬리질문
     - 보완 주제
     - study-pack 후보
  -> answer record feedback 필드 갱신
  -> dashboard가 답변 전문과 상세 피드백 표시
  -> 사용자가 꼬리질문 선택
  -> 답변 입력
  -> 필요 시 같은 loop 반복
  -> 5턴 이후 사용자가 원하면 자유형으로 연장
  -> 최종 요약 / 보완 주제 / study-pack 후보 생성
```

study-pack 자연어 요청 흐름:

```text
사용자가 고정 study-pack 후보 선택
  -> study_pack request 생성

또는

사용자가 "이 주제 모르겠어" / "이걸로 스터디팩 만들어줘"처럼 자연어 입력
  -> processor가 공개 가능한 순수 기술 주제로 정규화
  -> private 지원 전략이나 회사별 답변 전문이 섞였는지 확인
  -> public-safe면 study_pack request 생성
  -> study-pack-writer가 [초안] fos-study 문서 생성
  -> commit/push
```

면접 종료 후 archive 흐름:

```text
2026-06-15 CJ푸드빌 면접 종료 확인
  -> interview session modeStatus를 read_only 또는 archived로 전환
  -> 새 질문 생성 / 새 답변 입력 / 새 feedback request 차단
  -> 기존 답변 전문 / 상세 피드백 / 최종 요약 / 보완 주제 / study-pack 후보 조회만 허용
```

안전 경계:

- dashboard는 `claude -p`를 직접 실행하지 않는다.
- request result와 audit log에는 private 문서 본문, 면접 답변 전문, 상세 피드백, command stdout 전체를 저장하지 않는다.
- 사용자가 입력한 답변 전문과 상세 피드백은 private DB record에 저장해 dashboard에서 바로 볼 수 있게 한다.
  fos-study, Discord, 외부 알림으로 복사하지 않는다.
- study pack 요청은 공개 가능한 기술 주제로만 제한한다.
- study pack 요청은 고정 추천과 자연어 요청을 모두 지원한다.
  인터뷰 중 모르는 주제가 생기면 해당 turn에서 직접 요청할 수 있다.
- study pack 요청은 기존 `study-pack-writer` 정책대로 `[초안]` 제목의 fos-study 문서를 만들고 commit/push까지 수행한다.
- 외부 제출, 공개 발행, 로그인, 업로드, candidate-profile 자동 수정은 차단한다.
- 구현 phase는 이 docs/ADR 계약을 고치지 않는다.
  문서 수정이 필요할 만큼 계약이 모호하면 `PHASE_BLOCKED`로 보고한다.

### fos-career application workbench (plan054)

application workbench는 읽기 중심 UI 흐름이다.
수집 공고 목록만 보여주는 것이 아니라, frontdoor queue와 ledger를 합쳐 "지원 준비를 어디까지 진행했는가"를 보여준다.

기본 흐름:

```text
career-os frontdoor queue + ledger + priority history + application files
  -> fos-career adapter projection
  -> application workbench list/detail
  -> user reviews readiness / next action / blocker
  -> write action needed?
     -> no: read-only inspection
     -> yes: existing safe bridge such as priority pending request
```

MVP에서 workbench는 career-os 파일을 직접 수정하지 않는다.
산출물 생성, 지원 패키지 수정, 외부 제출은 기존 agent/task 흐름이나 별도 승인 게이트 뒤에서만 수행한다.

### Application Flow Agent Runtime (plan031 — phase-01 상태 모델 확정)

plan031은 plan029의 skill 산출물을 기반으로, 상태 기반 자율 실행 runtime을 추가한다. 상태 전이 허용 여부와 next action 선택은 TypeScript policy engine이 결정한다. LLM은 분석, 작성, 추천 근거 생성만 담당한다.

핵심 루프:

```text
ledger/runtime 읽기
  -> actionable candidate 판정 (fit threshold + freshness + cooldown)
  -> policy decision 생성 (TypeScript policy engine — LLM 아님)
  -> 허용된 action 실행 또는 사용자 gate에서 정지
  -> --notify-discord 명시 시 단계별 진행 알림
  -> --execute-skills 명시 시 agent-only private native skill 실행
  -> 필수 skill artifact 검증 (없으면 command suggestion만 남기고 상태 전이 금지)
  -> validator로 상태 전이 검증
  -> ledger/decision log 갱신
  -> digest/approval 필요 항목 보고
```

명령 인터페이스:

```bash
bun scripts/application-agent/run.ts run-once
bun scripts/application-agent/run.ts run-daily
bun scripts/application-agent/run.ts dry-run
bun scripts/application-agent/run.ts validate
bun scripts/application-agent/run.ts resume <application-id>
bun scripts/application-agent/run.ts ingest-position-report <report-path>
```

`--execute-skills`를 붙이면 runner가 execution gate에 필요한 private agent-only skill을 먼저 실행한다. 현재 자동 실행 대상은 `application-package-writer`와 `application-reviewer`뿐이다. 공개 발행, 프로필 반영, 실제 제출, 로그인/브라우저 입력 계열은 여전히 사용자 승인 또는 차단 대상이다.

`--notify-discord`를 함께 붙이면 시작, skill 시작/완료/실패, ledger 갱신, execution gate 대기 상태를 Discord에 짧게 알린다. 알림은 회사/역할/단계/skill 이름만 담고 지원 패키지 본문이나 private strategy note는 보내지 않는다.

#### agentPhase 상태 모델

기존 `status` enum(큰 흐름)은 유지하고, 세부 agent 실행 상태를 `agentPhase` optional 필드로 분리한다.

| agentPhase | 의미 |
|---|---|
| `scouting` | 후보 탐색 중 |
| `needs_more_search` | actionable candidate 없음 + 검색량 부족 → 범위 확장 필요 |
| `no_good_match` | 충분히 검색했지만 actionable candidate 없음 |
| `scheduled_retry` | 지금은 할 일 없고 다음 실행 예약됨 (`nextRunAt` 설정) |
| `actionable_candidate` | active + fit threshold 통과 후보 판정됨 |
| `generating_package` | application-package-writer 실행 대상 |
| `reviewing_package` | application-reviewer 실행 대상 |
| `collecting_evidence` | 근거 부족 보강 대상 |
| `revising_package` | agent 수정 루프 대상 (revisionCount < maxRevisionCount) |
| `waiting_user_approval` | 사용자 승인 전 정지 |
| `study_loop` | submitted/interview_scheduled → private study/interview action 생성 대상 |
| `submission_checklist` | 제출 링크/체크리스트 생성 대상 (Level 0) |

#### actionable candidate 기준

- 공고가 active 상태다.
- 공고 URL 또는 source id가 중복이 아니다.
- 회사/그룹 쿨다운 플래그가 없다.
- 공고 만료/마감 신호가 없다.
- role-fit score가 threshold 이상이다 (기본값 70점 이상).
- 최근 7일 반복 후보라면 반복 유지 사유가 있다.
- position-recommender freshness guard를 통과한 입력에서 왔다 (plan030 prerequisite).

fit score 분기:

- 85점 이상: high priority actionable candidate
- 70-84점: normal actionable candidate
- 70점 미만: study_loop 후보 또는 hold

#### policy matrix

| 현재 status | 조건 | next action | next agentPhase |
|---|---|---|---|
| `scouting` | actionable candidate 0 + 검색량 부족 | `expand_search` | `needs_more_search` |
| `scouting` | actionable candidate 0 + 검색량 충분 | `schedule_retry` | `scheduled_retry` |
| `discovered` | active + fit threshold 통과 | `run_application_package_writer` | `generating_package` |
| `discovered` | closed/expired | `close_candidate` | status → `closed` |
| `discovered` | cooldown/duplicate | `block_candidate` | status → `blocked` |
| `preparing_application` | package exists | `run_application_reviewer` | `reviewing_package` |
| `needs_revision` | revisionCount < max + agent-fixable | `revise_application_package` | `revising_package` |
| `needs_revision` | evidence 부족 | `collect_evidence_or_request_user_input` | `collecting_evidence` 또는 `waiting_user_approval` |
| `needs_revision` | revisionCount >= maxRevisionCount | `block_or_request_user_input` | status → `blocked` |
| `ready_for_user_review` | — | `notify_user_approval_needed` | `waiting_user_approval` |
| `approved` | — | `create_submission_checklist` | `submission_checklist` |
| `submitted` | — | `create_study_interview_actions` | `study_loop` |
| `interview_scheduled` | — | `prioritize_interview_prep` | `study_loop` |

#### 우선순위 큐 기본값

- 하루 신규 deep analysis 최대 2개.
- `ready_for_user_review`는 최대 3개까지만 쌓는다.
- 진행 중인 revise/review가 신규 탐색보다 우선한다.
- `interview_scheduled`가 있으면 study_loop 우선순위를 올린다.
- `blocked`는 자동 재시도하지 않고 `requiredUserAction` 또는 `nextRunAt`이 있는 경우만 재평가한다.

안전 경계:

- 제출 자동화는 Level 0만 허용한다. 즉 제출 링크와 체크리스트 생성까지만 한다.
- 브라우저 입력 자동화, 실제 제출, 외부 전송, 공개 fos-study 발행, 원본 candidate-profile 수정은 사용자 승인 없이 금지한다.
- plan030의 position freshness guard를 후보 ingest prerequisite로 사용해 stale 추천을 차단한다. plan030은 구현 대상이 아니라 prerequisite로만 참조한다.

### Application Agent Evaluation Loop (runtime guardrail)

지원 패키지와 이력서 문장의 안전성을 고도화하기 위한 작은 평가 루프다. 목적은 실제 제출 자동화가 아니라, 에이전트가 생성한 문장이 과장·근거 없음·개인정보 노출·잘못된 JD 해석을 포함하는지 회귀 테스트하는 것이다.

현재 단계는 LLM 평가 모델을 붙이기 전의 결정적 평가기다. 사람이 정한 샘플과 기대 판정을 기준으로 규칙 기반 판정이 일치하는지 확인한다.

```text
Read: data/runtime/application-agent/eval-cases/resume-package-eval-cases.md
  -> Parse: Case ID / Type / Candidate output / Expected verdict
  -> Evaluate: scripts/application-agent/evaluate_cases.ts
  -> Write: data/runtime/application-agent/eval-reports/latest-report.md
            data/runtime/application-agent/eval-reports/latest-report.json
```

실행:

```bash
bun scripts/application-agent/evaluate_cases.ts
```

판정 값:

- `pass`: 그대로 사용 가능
- `revise`: 사람 또는 에이전트가 문장 보강 필요
- `blocked`: 제출/공개/이력서 반영 전에 반드시 차단

현재 평가 샘플은 `data/runtime/` 아래에 있으므로 git 추적 대상이 아니다. 장기적으로 공유해야 할 안정 샘플이 생기면 별도 논의 후 `tests/` 또는 `fixtures/` 성격의 추적 파일로 승격한다.

### Application Package Evaluation Loop (runtime guardrail)

실제 지원 패키지와 리뷰 문서를 입력으로 받아 제출 전 위험 신호를 자동 점검한다. 사람 리뷰를 대체하지 않고, 명확한 과장·자동 제출·내부정보·근거 부족 신호를 먼저 리포트로 남기는 1차 안전망이다.

```text
Read: data/applications/<company>/<role>/application-package.md
Read: data/applications/<company>/<role>/review.md
  -> Evaluate: scripts/application-agent/evaluate_package.ts
  -> Write: data/runtime/application-agent/package-eval/<company-role>/latest-report.md
            data/runtime/application-agent/package-eval/<company-role>/latest-report.json
```

기본 호출:

```bash
bun scripts/application-agent/evaluate_package.ts \
  --application-dir data/applications/tossplace/applied-ai-engineer
```

판정 값은 `pass / revise / blocked` 세 단계다. `blocked`는 자동 제출, 검증 전 프레임워크 경험 과장, 근거 없는 강한 정량 성과처럼 제출 전 반드시 멈춰야 하는 항목이다. `revise`는 사내 식별자 일반화, `needs_evidence` 경계 보강처럼 사용자 검토와 문장 수정이 필요한 항목이다.

### `study-topic-recommender` (모닝 추천 — native skill, ADR-026 + ADR-033)

native skill 패턴: `claude -p "/study-topic-recommender"` → SKILL.md 자동 로드 → Claude가 도구로 직접 처리.

내부 흐름 (ADR-033 이후):

```
호출: claude -p "/study-topic-recommender"
  ↓
1. Promote detect — history 기반 study-pack-candidates → study-pack 승격 후보 안내 (자동 수정 X)
  ↓
2. Bash: bun career-os/scripts/study-topic-recommender/refresh_topic_inventory.ts
   ├─ Read: config (study-pack-topics / study-pack-candidates / sources / live-coding-*)
   ├─ Scan: sources/fos-study/**/*.md (exclude .git/.claude) — git pull 없음, 로컬 clone 기준
   ├─ Deterministic dedupe (provider-free):
   │    a. exact path match → excluded.exactPathMatches
   │    b. normalized path match (lower-case + slash normalize) → excluded.normalizedPathMatches
   │    c. slug/token overlap → excluded.possibleDuplicates (Claude review 후보)
   ├─ 추천 점수 계산 + mix target + feed discovery (ADR-010/012/013)
   └─ Write: data/runtime/topic-inventory.json (excluded.* + claudeDuplicateReview.status=skipped 초기값)
  ↓
3. Claude duplicate review (native skill 내부)
   ├─ Read: inventory.excluded.possibleDuplicates
   ├─ 각 후보를 의미 판정 → decision (new | update-existing | skip | needs-user-confirmation)
   ├─ 성공 시: inventory.claudeDuplicateReview.{status=ok, reviewedAt, items[]} 갱신
   └─ 실패 시: status=failed + warning, 추천 자체는 계속 (deterministic 결과만 반영)
  ↓
4. Write: data/runtime/morning-topic-recommendation.md
   ├─ 백엔드/기술블로그/AI/Geek 4축 + 오늘의 3선 (기존 ADR-012 구조)
   ├─ "기존 문서 보강 후보" 섹션 (최대 5개) — update-existing + needs-user-confirmation
   └─ Claude review 실패 시 상단 warning 라인 추가
  ↓
5. Append: data/runtime/topic-inventory-history.jsonl
  ↓
6. (선택) live-coding seed 선택 — 자연어에 "live-coding" 포함 시
  ↓
Discord 알림 [완료]
```

산출물:

- `data/runtime/topic-inventory.json` — ADR-033 스냅샷 스키마 (data-schema.md 참조)
- `data/runtime/morning-topic-recommendation.md` — 사람이 읽는 마크다운
- `data/runtime/topic-inventory-history.jsonl` — 매일 한 줄 append

상세 동작: `career-os/.claude/skills/study-topic-recommender/SKILL.md` Workflow 섹션 참조.

이전 흐름:

- 외부 subprocess (dispatcher → run_topic_recommendation.sh → refresh_topic_inventory.py)는 plan016 phase-03에서 폐기됨.
- `data/generated-artifacts.json` 의존은 ADR-033 / plan025에서 제거 — fos-study 직접 스캔으로 단일화.

### `study-pack <topic>` (native skill — ai-nodes ADR-002, plan013 + ADR-033)

native skill 패턴: `claude -p "/study-pack-writer <topic>"` → SKILL.md 자동 로드 → Claude가 도구로 직접 처리.

내부 흐름 (ADR-033 이후 duplicate guard 추가):

```
호출: claude -p "/study-pack-writer <topic-key-or-자연어>"
  ↓
1. Topic 해석 → topic-key / outputPath 확정
  ↓
2. Context 로드 (Read): study-pack-topics.json + candidate-profile.md + mvp-target.json + topic-profiles.json + references
  ↓
3. Duplicate guard (ADR-033 — recommender와 같은 decision schema)
   ├─ Scan: sources/fos-study/**/*.md → exact path / normalized path / slug overlap
   ├─ (선택) Claude 의미 판정 → decision (new | update-existing | skip | needs-user-confirmation)
   └─ 분기:
        - new                       → 새 markdown 작성 진행
        - update-existing           → 새 파일 생성 금지 + 기존 matchedPath update 모드
        - skip                      → 작성 중단 + 기존 문서 경로/사유 stderr 보고 + exit 1
        - needs-user-confirmation   → 사용자 확인 없이 진행 금지 (non-interactive면 stderr + exit 1)
  ↓
4. 마크다운 작성 (Write) — sources/fos-study/<outputPath>.md
  ↓
5. Self-check (재작성 ≤3회) — 첫 줄 / 줄 수 / 펜스 언어 / 금지 prefix / writing-rules
  ↓
6. Publish (Bash) — git pull --rebase --autostash → add → commit → push
  ↓
7. Discord 알림
```

writer는 recommender에서 선택한 보강 후보뿐 아니라 *사용자가 직접 호출한 주제*에도 같은 게이트를 적용한다 — recommender와 writer가 공유하는 단일 진실원.

상세 동작: `career-os/.claude/skills/study-pack-writer/SKILL.md` Workflow 섹션 참조.

이전 흐름:

- 외부 subprocess (dispatcher → run_study_pack.sh → claude --print → extractor → publish)는 plan013 phase-03에서 폐기됨.
- 옛 SKILL.md §3 overlap 점검은 자기 판단 의존이라 high/medium 중복을 지키지 못한 경우 발생 — ADR-033으로 duplicate decision schema 게이트로 격상.

### `interview-asset <topic>` (native skill — plan015, Q&A + master playbook 두 형식)

native skill 패턴: `claude -p "/interview-asset-writer <topic>"` → SKILL.md 자동 로드 → Claude가 도구로 직접 처리.

두 산출물 형식 자동 분기 (topic-key 또는 자연어 키워드로 판단):
- Q&A 질문 은행 (옛 question-bank)
- 마스터 플레이북 (옛 master)

상세 동작: `career-os/.claude/skills/interview-asset-writer/SKILL.md` Workflow 섹션 참조.

이전 외부 subprocess 흐름 (dispatcher → run_question_bank.sh → claude --json-schema → render_question_bank.ts → publish)은 plan015에서 폐기됨. JSON schema 강제는 native self-check 7항목으로 대체.

### `/interview-prep-analyzer first-round|final-round|offer-chat` (native skill — ADR-027 + ADR-048)

native skill 패턴: `claude -p "/interview-prep-analyzer first-round"` → SKILL.md 자동 로드 → Claude가 도구로 직접 처리.

면접 단계 분기: first-round / final-round / offer-chat.

```
호출: claude -p "/interview-prep-analyzer <stage>"
  ↓
Read: config/mvp-target.json (primary.interview.<stage> 객체)
  ↓
Bash: bun career-os/scripts/interview-prep-analyzer/collect_interview_sites.ts --mode <stage>
  → data/source/<stage.source_dir>/ (sites HTML + txt + manifest.json)
  ↓
Read: candidate-profile.md + data/prep/<stage.prep_dir>/{strategy,checklist}.md
      + 수집된 sites text + 관련 fos-study 학습 문서
  ↓
Claude 분석 → 예상 질문 / 답변 리스크 / 역질문 / 확인 필요 항목 작성
  ↓
Write: data/reports/daily/YYYY-MM-DD/interview-prep-<stage>/report.md
```

회사명·URL은 `config/mvp-target.json`의 `primary.interview.<stage>` 객체에서만 읽는다. 준비 자산 (`strategy.md` + `checklist.md`) 은 `data/prep/<stage.prep_dir>/`에 위치한다.

### live-coding seed 선택 (study-topic-recommender 흡수 — plan016)

`claude -p "/study-topic-recommender live-coding 1개 골라줘"` — study-topic-recommender가 live-coding seed 선택을 내부적으로 처리.

1. `data/runtime/topic-inventory.json`의 `pools.remainingLiveCodingSeeds` 확인
2. 가장 우선도 높은 seed 1개 선택 → 제목 + slug + difficulty 출력
3. 사용자 승인 시 `claude -p "/study-pack-writer <seed-slug>"` 위임

`config/live-coding-seed-pool.json` + `live-coding-seed-candidates.json`은 유지 (SKILL.md가 Read).

이전 dispatcher 흐름 (dispatcher → run_live_coding_dispatch.sh → TOPIC_CONFIG_OVERRIDE → study-pack)은 plan016 phase-03에서 폐기됨.

### fos-career 웹 대시보드 읽기 흐름 (plan039 — implemented base)

fos-career(`~/services/fos-career`)는 career-os 파일을 읽기 전용으로만 읽는다.
career-os 파일을 수정하는 경로가 없다.

브라우저 요청 흐름:

```text
브라우저 요청
  -> Next.js App Router (~/services/fos-career)
  -> 관리자 세션 검증 (MySQL sessions 테이블)
  -> career-os 파일 어댑터 (CAREER_OS_ROOT=/data/career-os 읽기 전용 마운트)
     - data/runtime/application-agent/frontdoor-queue.jsonl 읽기
     - data/applications/ledger.jsonl 읽기
     - data/runtime/position-recommendation.md 읽기
     - config/candidate-profile.md 읽기
  -> 서버 컴포넌트에서 렌더링
  -> 읽기 전용 뷰 반환
```

범용 LLM 채팅 흐름은 ADR-064로 제거한다.
fos-career에서 LLM이 필요한 기능은 목적별 request/evaluator 흐름으로만 노출한다.

```text
사용자가 목적별 버튼 또는 면접 답변 제출
  -> POST /api/<purpose-specific route>
  -> 세션 검증
  -> MySQL pending request 또는 interview answer record 생성
  -> processor가 allowlist/stale guard 확인
  -> career-os 정본 파일과 최소 context bundle 읽기
     - interview/prep.md
     - 현재 질문과 사용자 답변
     - 최근 답변/피드백 요약
     - 이미 정리된 주제와 낮은 우선순위 주제
  -> 목적별 evaluator 또는 native skill 실행
  -> 결과 요약과 상태를 MySQL에 저장
  -> dashboard에서 결과 확인
```

경계:

- fos-career는 career-os 파일에 쓰거나 수정하지 않는다.
- priority write action도 먼저 fos-career MySQL pending queue에 저장한다.
  career-os 파일 반영은 plan053의 별도 적용 runner만 수행한다.
- 범용 채팅 UI는 없다.
- LLM evaluator가 외부 사이트 접근, fos-study 발행, candidate-profile 수정을 수행하지 않는다.
- 쓰기 액션(prepare-start/hold/reject 버튼)은 pending queue와 사용자 확인 절차 없이 실행하지 않는다.

### Question Bank Collector Flow

공개 가능 일반 backend/CS 질문 bank는 `public/question-bank/`를 정본으로 둔다.

```text
사용자 자연어 요청
  예: "일반 backend 질문 모아줘", "CS 질문 수집", "질문 뱅크 보강"
  -> question-bank-collector skill 선택
  -> source seed 수집
     - fos-study 기존 문서
     - 공개 가능한 backend/CS topic seed
     - candidate/project 경험에서 public-safe로 추상화 가능한 질문 축
  -> raw 후보 생성
  -> normalizer
     - 단순 암기형 질문을 backend 실무형 질문으로 변환
     - 중복 제거
     - publicSafe/private leak 점검
     - category/difficulty/intent/answerSignals/source 기록
  -> public/question-bank/<category>/... 저장
  -> 포지션 맞춤 선별 시 private/<company>/<position>/interview/prep.md에 일부 반영
  -> fos-study 발행은 별도 검수 후 sources/fos-study로 재작성
```

경계:

- `public/question-bank/`에는 private 답변, 지원 전략, 회사별 비공개 맥락을 넣지 않는다.
- 유료 강의/문제집/면접 후기 원문은 복사하지 않는다.
- 수집된 질문은 바로 면접 준비 정본이 아니며, normalizer와 선별 단계를 거친다.

### Question Bank Dashboard Request Flow

fos-career 면접 hub는 질문 bank 보강을 직접 실행하지 않고 request queue에 넣는다.

```text
사용자
  -> 면접 hub "질문 bank 보강" 버튼
  -> interview_skill_requests
     request_type = question_bank_refresh
     requested_skill = question-bank-collector
  -> host-side processor
     claude --permission-mode <mode> -p "/question-bank-collector <topic>"
  -> public/question-bank 갱신
  -> validator 실행
  -> request result에는 path, summary, validator count만 저장
```

이번 흐름은 `public/question-bank` 보강까지만 책임진다.
포지션별 `prep.md`에 질문을 선별 반영하는 흐름은 후속 plan에서 다룬다.

### Resume Package Flow (plan055 — completed)

지원 준비 흐름은 맞춤 이력서 초안을 별도 Markdown 산출물로 고정한 뒤 사용자 승인으로 멈춘다.

```text
공고 발견
  -> 우선순위 확정
  -> 지원 준비 시작
  -> run.ts resume <application-id> --execute-skills
  -> posting.md / fit-analysis.md / application-package.md 확인
  -> resume-draft.md / cover-letter.md / submission-checklist.md 생성
  -> review.md 생성 또는 갱신
  -> processor post-validation
  -> fos-career application request status 갱신
  -> 사용자 승인 대기
```

post-validation은 다음 파일을 실제 파일 시스템에서 확인한다.

- `posting.md`
- `fit-analysis.md`
- `application-package.md`
- `resume-draft.md`
- `cover-letter.md`
- `submission-checklist.md`
- `review.md`

`needs_evidence`가 발견되면 runner는 제출용 문서를 바로 통과시키지 않는다.
대신 다음 루프를 생성한다.

- `보강 필요`: 어떤 주장이나 문장이 부족한지.
- `선택지`: 삭제, 약화 표현, 사용자 근거 요청, private source 재확인.
- `권장 행동`: 다음 실행 또는 사용자에게 요청할 한 가지 행동.

application request status projection:

- `pending`: 요청이 생성됐지만 processor가 아직 처리하지 않았다.
- `running`: processor가 해당 요청을 처리 중이다.
- `done`: 산출물 검증과 상태 반영이 끝났다.
- `failed`: 실행 또는 검증 실패가 있다.
- `stale`: 요청 당시 snapshot과 현재 ledger/frontdoor 상태가 달라 중단했다.

상태 표시에는 `ledgerId`, `error`, `resultSnapshot`을 포함한다.
fos-career는 이 상태를 보여주되 career-os 원장을 직접 수정하지 않는다.

첨부 가능한 PDF resume export는 review를 통과한 Markdown 이력서 초안에서 시작한다.
산출물 체인은 `Markdown 이력서 초안 -> design.md 적용 HTML 이력서 -> HTML을 PDF로 변환한 완성 PDF 이력서`다.
career-os의 `resume-exporter`는 로컬 파일만 생성한다.
외부 제출 자동화, 로그인, 브라우저 입력은 이 흐름에 넣지 않는다.

## 통과 시점에 항상 일어나는 일

모든 native skill 공통 흐름:

1. Claude가 SKILL.md 자동 로드 → 도구 직접 실행.
2. 완료/실패 시 `bun --env-file=career-os/.env _shared/lib/notify_discord.ts` 호출 → Discord 알림 ([완료]/[실패] + cost line).
3. study-pack / interview-asset는 fos-study commit + push 포함.

(옛 `run_tracked()` → `track_task.sh` → `format_cost_summary.py` 파이프라인은 plan023에서 career-os 흐름에서 제거됨. `track_task.sh`는 apartment 등 다른 워크스페이스에서 여전히 사용 중.)

## 의도적 비대칭

- interview-prep-analyzer (baseline + daily): 외부 publish 안 함. 내부 학습용. (plan017, ADR-027)
- study-pack / question-bank: fos-study에 commit + push 강제.
- position-recommender / interview-prep-analyzer: data/runtime 또는 data/reports에만, 외부 publish X.
- study-topic-recommender (native): 산출물이 사람이 읽고 다음 단계로 가는 입력. replenish + recommend + live-coding seed 흡수 완료 (plan015/016, ADR-026).

## 실패 시 동작

- Claude 타임아웃 (대부분 900s): runner가 비-zero exit, Discord [실패] 알림. baseline은 추가로 `report.fallback.md` 생성해 부분 정보 보존.
- fos-study git push 실패: study-pack-class runner는 exit non-zero. push 실패는 silent 처리 금지.
- validator 실패: runner가 stricter prompt로 재시도 1회. 그래도 실패하면 [실패] 알림.

## 워크플로 우회

dispatcher 폐기 후 `run_now.sh`는 존재하지 않음. native skill(`claude -p "/<skill>"`)이 유일한 진입점 — 우회 경로 없음.

디버깅·단발 테스트 시에도 동일한 `claude -p "/<skill>"` 직접 호출 사용.
