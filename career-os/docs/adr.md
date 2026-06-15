# ADR — career-os 아키텍처 결정 기록

career-os의 모든 아키텍처 결정을 시간순으로 누적 기록한다. 새 결정은 가장 아래에 추가한다.

형식: `## ADR-N — 제목` + status / date 라인 + **맥락 / 결정 / 결과** 3섹션. 폐기·supersede는 status 라인에 명기.

---

## Quick Index

빠른 ADR 탐색용 단일 출처. 본문 헤더의 ADR 번호 + 제목 + Status 라인과 동기 유지.

| ADR | 제목 | Status | 한 줄 요약 |
|---|---|---|---|
| ADR-001 | Daily 파일 선택 전략 | Accepted | topic-file-map.json 기반 토픽→파일 매핑으로 daily 범위 3-5개 축소 |
| ADR-002 | 학습 진도 추적 | Accepted | config/study-progress.json 하이브리드 포맷으로 중복 학습 방지 |
| ADR-003 | Baseline 청킹 제거 | Accepted | 10 파일 단일 호출로 통합, 비용 약 60% 절감 |
| ADR-004 | reports/ 디렉터리 컨벤션 | Superseded by no-action (2026-04-18) | 최상위 reports/ 미사용 — data/reports/만 유지 |
| ADR-005 | Study pack 출력 및 발행 정책 | Partially superseded by ADR-086 | 제목 [초안] 표시는 유지하되, 공개 발행과 commit/push는 사용자 명시 승인 뒤에만 수행 |
| ADR-006 | Study-pack 엔트리포인트와 topic 라우팅 | Partially superseded by ai-nodes ADR-002 (plan013, 2026-05-14) | run_now.sh study-pack → /study-pack native skill 진입점 전환 |
| ADR-007 | Experience-based interview question bank workflow | Superseded by ADR-027 (plan015, 2026-05-15) | Q&A workflow → interview-asset-writer 통합 |
| ADR-008 | Generation status notifications | Accepted | Discord 시작/실패/완료 3단계 + cost summary 자동 부착 |
| ADR-009 | Morning topic reservoir + recommendation pipeline | Accepted | primary/candidate/runtime 3-레이어 + mix target 강제 |
| ADR-010 | Recommendation scoring + mix targets | Accepted | 점수 기반 5-item mix (new 2 / deepen 1 / review 1 / live-coding 1) |
| ADR-011 | Study topic 자동 보충 (replenishment) | Superseded by plan015 (2026-05-15) | topic-pool-replenisher 폐기, study-topic-recommender가 흡수 (plan016) |
| ADR-012 | Morning 추천 10픽 + 오늘의 3선 | Accepted | 백엔드/블로그/AI/Geek 4축 10픽 + 큐레이션 3선 |
| ADR-013 | RSS·Atom discovery 레이어 부착 | Accepted | feedUrl 항목 매일 최신 글 1편 자동 부착, 6h 캐시 |
| ADR-014 | Claude usage 전파 패턴 통일 | Accepted | TRACK_TASK_CLAUDE_USAGE_FILE env로 raw JSON usage 사이드 헬퍼 분리 |
| ADR-015 | docs/ 피드백 루프 + data/ 위치 정책 | Accepted | docs/=결정·학습 누적, 데이터는 data/ 단일 위치 |
| ADR-016 | config 디렉터리 통합 | Partially superseded by ADR-027 (plan017, 2026-05-15) | topics.json 3 namespace 분리, sources/baseline 통합은 유지 |
| ADR-017 | cj-oliveyoung-java-backend-prep 분해 | Accepted | 거대 skill → 도메인별 5 skill 분해, WIP 3개 wire-up |
| ADR-018 | docs/ 운영 정책: 휘발성 vs 영속 | Partially superseded by ADR-032; 5문서/data 분리는 ai-nodes ADR-004로 Lifted | adr.md 단일 출처. learn 영역은 ADR-032에서 폐기, hand-off/prep 유지 |
| ADR-019 | scripts/ 폴더 분리 | Lifted to ai-nodes ADR-006 (2026-05-19) | 비대칭이 모노레포 표준으로 격상. scripts/<name> + .claude/skills/<name>/ 분리가 모든 워크스페이스 표준 |
| ADR-020 | 공용 헬퍼 TS(Bun) 마이그레이션 | Accepted | _shared/lib TS 단일 위치, shim·partial 금지 |
| ADR-021 | Discord 알림 openclaw 경유 + 워크스페이스 .env | Lifted to ai-nodes ADR-004 (.env 부분); Discord openclaw 부분 career-os 유지 | openclaw subprocess + DISCORD_CHANNEL_ID env, secret <ws>/.env 격리 |
| ADR-022 | 도메인 헬퍼 TS(Bun) 마이그레이션 | Accepted | extractor/renderer/resolver 9개 + extract_claude_result TS화 |
| ADR-023 | Study-pack 생성 출력 포맷 | Deprecated (2026-05-13, 실측 무효) | JSON 폐기 결정이 회계 누락 초래 — ADR-014로 복구 |
| ADR-025 | Skills 정리 + 한글화 정책 | Accepted | fos-study-pack 폐기, SKILL.md 한글화 + 코드 식별자 영어 유지 |
| ADR-026 | study-topic-recommender native + ts + replenish 흡수 | Accepted | Python 622줄 → ts, 3 dispatcher case 폐기 (plan016 진행 중) |
| ADR-027 | knowledge-gap-analyzer → interview-prep-analyzer + topics.json 분리 | Accepted | smoke 폐기, baseline/daily 자연어 분기, topics.json 3 분리 (plan017) |
| ADR-028 | candidate-baseline-suggester skill 도입 | Accepted | Append + 주석 마킹 + audit trail로 candidate-profile/baseline 자동 갱신 (plan020) |
| ADR-029 | interview-coffeechat-prep native + 회사 추상화 + zod + ts collector | Accepted | cj-foodville → interview-coffeechat-prep rename, mvp-target primary.coffeechat 객체, docs/prep → data/prep (plan021) |
| ADR-030 | position-recommender native + collect_live_postings ts 활성화 | Accepted | run_position_recommendation.sh + extract.ts + publish.sh 폐기, 마지막 dispatcher case 폐기 (plan022) |
| ADR-031 | command-router 일괄 폐기 + ts lib 정리 | Accepted | command-router/ + _shared/lib 2 + scripts/_lib 5 폐기 (plan023) |
| ADR-032 | learn/ 영역 폐기 — 회고 흐름 단순화 | Accepted | learn 디렉터리 + 008 + README 폐기, 회고는 chat + ADR/스킬 직접 흡수 |
| ADR-033 | fos-study source tree를 study artifact 단일 진실원으로 사용 | Accepted | generated-artifacts.json career-os 활성 제거, sources/fos-study 직접 스캔, duplicate decision schema 공유 (plan025) |
| ADR-034 | interview-coffeechat-prep 4 mode 일반화 | Accepted | mvp-target.json primary.interview.{coffeechat, first_round, final_round, offer_chat} 구조 + first-round 활성 + private/public-safe 두 산출물 (plan026) |
| ADR-035 | ts 헬퍼 모듈 분해 컨벤션 — source / transform / render / cli 4 레이어 | Accepted | god-script (단일 파일에 fetch + 정규화 + 렌더 + IO 응집) 분해 표준. plan027~plan031 시리즈 적용 (refresh_topic_inventory 859→1049 외 5 파일 2106줄) |
| ADR-036 | position-recommender daily freshness guard + recommendation rotation | Accepted | stale runtime 재전송 차단, 최근 7일 반복 후보 감점, daily cron freshness 검증 |
| ADR-037 | application-flow-agent runtime은 policy decision engine 중심 | Accepted | plan029 skill chain 위에 state -> policy decision -> action -> validation -> state update 루프 추가 (plan031) |
| ADR-038 | application-flow-agent 상태 전이는 skill artifact 검증 뒤에만 수행 | Accepted | 필수 산출물 존재 확인 전 ledger 상태 전이 금지 |
| ADR-039 | position-recommender 추천 단위는 개별 active/open 공고 | Accepted | 회사 lead가 아니라 active/open 근거가 있는 개별 공고만 추천 티어 허용 |
| ADR-040 | application-flow-agent native skill 실행은 명시 옵션에서만 수행 | Accepted | `--execute-skills`에서만 package/review native skill 실행 |
| ADR-041 | application-flow-agent 실행 진행 상황은 명시 옵션으로 Discord에 알린다 | Accepted | `--notify-discord`에서 private-safe progress만 알림 |
| ADR-042 | reviewer pass 판정은 사용자 검토 대기 상태로 전환한다 | Accepted | reviewer pass 후 revision loop 대신 user review gate로 이동 |
| ADR-043 | position-recommender 공고 수집은 source adapter + active validator로 분리 | Accepted | 정적 수집기가 active direct posting만 만들고 LLM은 fit 판단만 수행 |
| ADR-044 | 큰 변경은 planning → delegated implementation → main-session verification으로 운영 | Accepted | 의사결정은 planning/task/ADR에 남기고, Claude 구현 결과는 메인 세션이 diff/test/실행 검증 후 채택 |
| ADR-045 | 지원 후보 frontdoor queue를 ledger와 분리한다 | Accepted | 추천 후보는 frontdoor-queue.jsonl에 저장하고, 사용자가 선택한 후보만 ledger로 승격 |
| ADR-046 | fos-career 웹 대시보드를 별도 저장소로 분리한다 | Accepted | career-os는 자동화 진실 출처 유지, fos-career는 읽기 전용 Next.js 대시보드 |
| ADR-047 | position-recommender collector adapter를 모듈 경계로 승격한다 | Accepted | 기존 Wanted/Toss source만 유지하며 types/policy/validator/render/adapter registry로 분리 |
| ADR-048 | coffeechat 자동화는 폐기하고 면접 준비 기능만 이관한다 | Accepted | 회사별 coffeechat 형식 차이로 공통 자동화 폐기, 필요한 first-round/final/offer 준비는 interview-prep-analyzer로 이관 |
| ADR-051 | target source coverage는 adapter-owned entrypoint로 확장한다 | Accepted | Wanted broad scan은 유지하되 official source와 target URL 검증은 source adapter가 책임진다 |
| ADR-052 | 지원 우선순위는 회사 순위가 아니라 action stage로 관리한다 | Accepted | LLM recommendation snapshot과 user-confirmed priority를 분리한다 |
| ADR-053 | priority write action은 pending request bridge로 처리한다 | Accepted | fos-career는 요청만 저장하고 career-os command가 실제 mutation을 수행한다 |
| ADR-054 | fos-career의 다음 제품 축은 application workbench다 | Accepted | frontdoor queue와 ledger를 read-only projection으로 합쳐 지원 준비 상태를 보여준다 |
| ADR-055 | background worktree는 완료 시 명시적으로 정리한다 | Accepted | 별도 worktree를 만든 background worker는 완료 전 clean 여부 확인과 디렉터리 제거를 보고한다 |
| ADR-056 | resume package는 Markdown 산출물 계약을 먼저 고정한다 | Accepted; PDF scope superseded by ADR-059 | application-package와 제출용 resume/cover/checklist를 분리하고 request status를 표준화한다 |
| ADR-057 | 생성 산출물 품질 계약은 전역 기준이다 | Accepted | 한국어 우선, 첫 10줄 결론, 내부 분석과 제출용/공개용 분리, needs_evidence resolution loop를 모든 생성 Markdown에 적용 |
| ADR-058 | data cleanup은 private boundary와 retention을 먼저 고정한다 | Partially superseded by ADR-062 | data 파일은 private by default로 보고 archive/retention 경계를 먼저 정한다 |
| ADR-059 | plan055 MVP에 HTML/PDF 이력서 export를 포함한다 | Accepted | resume-draft.md -> design.md 적용 resume.html -> 첨부 가능한 resume.pdf를 같은 plan에 포함한다 |
| ADR-060 | 공고 상태 액션은 사용자 버튼과 pending request로 처리한다 | Accepted | 보류/제외/지원 준비 버튼을 제공하고, 지원 준비는 내부 산출물 생성까지 이어지되 외부 제출은 하지 않는다 |
| ADR-061 | 면접 준비 dashboard는 skill request gateway로 실행을 분리한다 | Accepted | dashboard는 요청만 만들고 processor가 허용된 native skill을 실행한다 |
| ADR-062 | 포지션별 준비 홈은 루트 private 아래에 둔다 | Accepted | private/<company>/<position>을 정본으로 두고 공개 공부팩은 별도 재작성한다 |
| ADR-063 | 면접 준비 사람용 정본은 단일 prep.md로 관리한다 | Accepted | 리포트·드릴·전략·체크리스트·단기 Java 준비를 `interview/prep.md` 한 파일로 정제한다 |
| ADR-064 | fos-career 범용 채팅은 제거하고 목적별 요청 UI로 통일한다 | Accepted | `/dashboard/chat`과 `/api/chat`을 제거하고 버튼 기반 request/evaluator 흐름만 유지한다 |
| ADR-065 | 면접 답변 피드백은 career context LLM evaluator로 처리한다 | Accepted | 답변 제출 즉시 평가하고, guard 통과 답변만 `prep.md` 기반 LLM evaluator가 점수·피드백·꼬리질문을 생성한다 |
| ADR-066 | 공개 가능 일반 면접 질문 bank는 public/question-bank에 둔다 | Accepted | Backend/CS/운영/System design 질문을 공개 가능 자산으로 추적하고 자연어 trigger가 강한 collector skill로 관리한다 |
| ADR-067 | coffeechat 자동화 tombstone도 제거하고 ADR-only history로 둔다 | Accepted | coffeechat script/skill/schema/config/docs active reference를 제거하고 과거 task 기록만 history로 보존한다 |
| ADR-068 | 질문 bank 보강은 dashboard request gateway로 연결한다 | Accepted | fos-career 면접 hub가 `question_bank_refresh` 요청을 만들고 processor가 `question-bank-collector`를 실행한다 |
| ADR-069 | config는 정책·타깃·예외만 남기고 자산 목록은 파생한다 | Accepted | fos-study/public question bank를 진실 출처로 보고 config 중복 목록을 curated override로 축소한다 |
| ADR-078 | 포지션 추천 freshness는 frontdoor와 priority 갱신까지 포함한다 | Accepted | daily runner 성공 뒤 queue/priority snapshot을 함께 갱신하고, write processor는 host-side wrapper로 실행한다 |
| ADR-079 | 포지션 수집은 동적 discovery를 우선하고 개별 공고 URL seed를 제거한다 | Accepted | Toss/Wanted/카카오계열/NAVER계열/Coupang coverage를 넓히되 개별 공고 URL 하드코딩을 금지한다 |
| ADR-080 | position daily HTML 리포트는 template 기반 표시 미러로 둔다 | Accepted | Markdown 정본을 읽기 쉬운 HTML 미러로 렌더링하되 template과 renderer 책임을 분리한다 |
| ADR-081 | 지원 후보 상태와 background outbox는 fos-career DB를 정본으로 둔다 | Accepted | 지원 후보 current state/stage와 long-running job을 fos-career MySQL로 관리한다 |
| ADR-082 | fos-career 모바일 UX는 하단 네비게이션과 전체 공고 탐색을 분리한다 | Accepted | 모바일 메뉴를 정리하고 전체 수집 공고와 추천 후보 5개를 분리한다 |
| ADR-083 | source registry와 collection run은 fos-career DB가 정본이다 | Accepted | 소스 목록과 수집 실행 이력을 DB로 관리하고 추천 run이 collectionRunId를 참조한다 |
| ADR-084 | 수집 공고 lifecycle 검증과 자동 상태 전이는 fos-career DB 이벤트로 남긴다 | Accepted | 수동 닫기, validator 자동 닫기, 재수집 자동 열기를 상태 이벤트와 검증 실행으로 관리한다 |
| ADR-085 | career-os skill을 Codex에 심볼릭 링크로 노출한다 | Accepted | `.claude/skills`를 agent skill 정본으로 유지하고 `.codex/skills`는 같은 본문을 가리킨다 |
| ADR-086 | skill 출력 정책은 공통 reference로 둔다 | Accepted | 생성 산출물 품질 계약을 공통 참조로 모으고 각 skill에는 작업별 차이만 남긴다 |
| ADR-087 | skill 트리거는 frontmatter description에 둔다 | Accepted | 본문 When to use를 줄이고 description에 자연어 트리거와 라우팅 경계를 올린다 |

(ADR-024는 번호 누락. ADR-007a/b 충돌은 prd.md "분해 대기 작업"에 기록.)

---

## ADR-001 — Daily 파일 선택 전략

- Status: 결정됨
- Date: 2026-04-13

### 맥락
`run_daily.sh`는 설계상 매일 3-5개 고가치 파일만 분석해야 했지만, `build_target_file_list.py`가 `database/`, `architecture/`, `java/`, `interview/` 전체를 긁어 70+개 파일을 생성하고 있었다. 의도와 구현이 어긋난 상태.

### 결정
- `config/topic-file-map.json`에 토픽 → 파일 목록 매핑 관리.
- `run_daily.sh`는 `DAILY_TOPIC` env 또는 `run_now.sh` 두 번째 인자로 토픽을 받는다.
- 토픽 미지정 시 `config/study-progress.json`에서 `last_studied`가 가장 오래된 약점 토픽 자동 선택.
- 토픽 매핑이 없으면 기존 INCLUDE_DIRS로 후퇴.

### 결과
- daily 분석 범위가 실제로 3-5개로 축소 → 토큰 비용 절감.
- 새 토픽은 config 한 곳만 수정.
- 자동 토픽 선택으로 중복 학습 방지 (ADR-002 의존).

---

## ADR-002 — 학습 진도 추적

- Status: 결정됨
- Date: 2026-04-13

### 맥락
daily 리포트가 어제 무엇을 공부했는지 모르고 동일 약점을 반복 제안. 면접 일정이 촉박한 상황에서 중복 학습 위험.

### 결정
`config/study-progress.json`에 세션 + 약점 토픽별 진도를 하이브리드 포맷(sessions 배열 + weak_spots 맵)으로 기록. `run_daily.sh`가 성공 후 자동 업데이트. 스키마 상세는 `docs/data-schema.md` 참조.

### 결과
- 진도 자동 기록 → 중복 학습 방지.
- 사람이 읽기 가능한 토픽 단위 + 코드가 다루기 좋은 파일 경로 둘 다 보존.

---

## ADR-003 — Baseline 청킹 제거

- Status: 결정됨
- Date: 2026-04-13

### 맥락
`run_baseline.sh`가 10개 파일을 5개씩 2청크로 나눠 Claude를 3번 호출(chunk1 → chunk2 → merge). 10개는 한 컨텍스트에 충분히 들어가므로 3배 비용·레이턴시 + merge 시 희석 위험.

### 결정
baseline은 단일 Claude 호출. 25개 이상으로 늘어나는 시점에 청킹 재도입 검토.

### 결과
- 비용 약 60% 절감 (3 호출 → 1 호출).
- 결과 디렉터리에 `target-files.txt`, `analysis-input.md`, `claude.result.json`, `report.md`만 남아 깔끔.

---

## ADR-004 — reports/ 디렉터리 컨벤션 [폐기]

- Status: 폐기 (superseded 2026-04-18 by no-action)
- Date: 2026-04-13

### 맥락
최상위 `reports/`와 `data/reports/` 두 경로가 공존. 최상위는 큐레이션 공간으로 의도했지만 실제로 한 번도 사용되지 않음.

### 결정 (당시)
최상위 `reports/`는 사람의 큐레이션 공간으로, `data/reports/`는 자동 생성으로 명확히 분리.

### 결과
- 폐기. 최상위 `reports/`는 삭제. `data/reports/`만 유지.
- 큐레이션이 필요한 경우 `data/reports/` 안에서 직접 인용하거나 fos-study에 커밋.

---

## ADR-005 — Study pack 출력 및 발행 정책

- Status: Partially superseded by ADR-086
- Date: 2026-04-14

### 맥락
career-os는 내부 산출물 외에도 외부 블로그(`sources/fos-study`)와 동기화되는 문서를 만든다. 별도 수동 반영 단계는 흐름을 느리게 하지만 즉시 공개 저장소에 반영하면 변경 이력 추적 규칙이 필요하다.

### 결정
- study pack 출력 대상은 항상 `sources/fos-study`.
- 즉시 대상 경로에 기록. 제목에 `[초안]` 표시.
- 생성·갱신 직후 개별 commit + push.
  이 발행 동작은 ADR-086 이후 사용자 명시 승인 뒤에만 수행한다.
- commit 메시지: `docs(<domain>): add|update draft <topic> study pack`.
- 경로 규칙: MySQL → `database/mysql/<topic>.md`, Redis → `database/redis/<topic>.md`, Kafka → `kafka/<topic>.md`, Spring/JPA → `java/spring/<topic>.md`, 일반 DB → `database/<topic>.md`.
- 내부 `data/reports/`는 실행 로그·중간 산출물 용도.

### 결과
- 생성 결과가 블로그 동기화 경로와 즉시 일치.
- 초안 상태 명시. 변경 이력은 topic 단위 commit으로 추적.

---

## ADR-006 — Study-pack 엔트리포인트와 topic 라우팅

- Status: Partially superseded by ai-nodes ADR-002 (plan013, 2026-05-14) — run_now.sh study-pack 진입점이 /study-pack native skill로 전환. config/study-pack-topics.json 메타데이터는 유지.
- Date: 2026-04-14

### 맥락
study-pack 생성과 daily report는 목적이 다른데 같은 엔트리포인트에 섞으면 사용자 의도가 흐려진다. topic 수가 늘면 domain·경로·프롬프트 강조점을 매번 수동 입력해야 한다.

### 결정
- 별도 엔트리포인트 `run_now.sh study-pack <topic>` 추가.
- topic 메타데이터는 `config/study-pack-topics.json`에 둠.
- topic key에서 domain / 출력 경로 / topic-specific prompt append를 해석.
- 명확한 topic은 즉시 실행. 애매하면 사용자 확인.
- 별도 라우터 서비스 대신 얇은 resolver 스크립트(`resolve_study_pack_topic.py`)로 충분.

### 결과
- study-pack과 daily가 사용자 의도상 명확히 분리.
- 새 topic 추가 시 config만 늘리면 됨.

---

## ADR-007 — Experience-based interview question bank workflow

- Status: Superseded by ADR-027 (plan015, 2026-05-15) — Q&A workflow가 interview-asset-writer로 통합. 별도 experience-question-bank-writer 스킬 폐기.
- Date: 2026-04-16

### 맥락
기존 `study-pack-writer`는 기술 article 스타일 출력에 최적화. 경험 기반 인터뷰 준비는 입력(이력서 + 선택된 task 이력 + 타깃 JD)과 출력(질문 뱅크 + 답변 준비 시트) 모두 다르고, validation도 article 섹션이 아닌 질문 구조여야 한다.

### 결정
- `experience-question-bank-writer` 별도 스킬·프롬프트.
- 전체 task 트리가 아닌 선택된 입력 파일만 사용.
- `config/experience-question-bank-topics.json`에 별도 topic 설정.
- 출력은 `interview/experience-based/` 아래.
- 5 main questions + 5 follow-up per main + answer points + 1분 답변 구조 + 압박 질문 방어 검증.

### 결과
- prompt·입력·validation·출력 정렬 개선.
- 입력 범위 과대화로 인한 생성 불안정 감소.
- study-pack 인프라와 일부 중복은 감수.

---

## ADR-008 — Generation status notifications

- Status: Accepted; PDF scope superseded by ADR-059
- Date: 2026-04-17

### 맥락
career-os가 technical study pack / live-coding pack / experience question bank / company analysis 등 여러 종류 산출물을 생성. 알림이 없으면 task가 시작·실패·완료됐는지 알기 어렵다.

### 결정
Discord에 시작 / 실패 / 완료 3단계 짧은 상태 알림. 형식:
- 시작: `문서 생성 시작: <대상>`
- 실패: `문서 생성 실패: <대상> (원인: ...)`
- 완료: `문서 생성 완료: <대상>` + 경로 + (선택) 짧은 학습 포인트.

장황하지 않게. 채널 노이즈 최소화.

### 결과
- 운영 가시성 ↑.
- cron 침묵 실패 디버깅 ↓.
- 실제로 ADR-014 작업 시 `run_now.sh`의 `run_tracked()` 헬퍼가 알림에 cost summary까지 자동 부착하도록 확장됨.

---

## ADR-009 — Morning topic reservoir + recommendation pipeline

- Status: Partially superseded by ADR-062
- Date: 2026-04-25

### 맥락
모닝 추천이 작은 고정 curated topic set과 작은 live-coding seed pool에 과도하게 의존 → 추천 폭이 시간이 갈수록 좁아지고, seed pool 고갈 시 live-coding 생성이 멈췄다.

### 결정
모닝 추천을 단순 프롬프트가 아닌 **3-레이어 파이프라인**으로: primary curated → candidate reservoir → runtime inventory. live-coding은 primary 고갈 시 candidate으로 자동 fallback. mix target: new / deepen / review / live-coding 분포 강제. candidate는 main과 분리된 검토 가능 backlog.

### 결과
- 모닝 추천 폭 확대.
- live-coding이 main seed pool 고갈에도 계속 가능.
- 외부 에이전트에게 reservoir가 명시적·파일 기반이라 인수인계 용이.

---

## ADR-010 — Recommendation scoring + mix targets

- Status: Accepted
- Date: 2026-04-25

### 맥락
ADR-009의 첫 구현이 5개 추천을 모두 `[new]`로 수렴, live-coding 슬롯 미보장, weak area(DB) 가중치 없음, 매일 반복 추천에 페널티 없음.

### 결정
점수 기반 `pick_recommendations`로 리팩토링. 5-item mix 강제: new 2 / deepen 1 / review 1 / live-coding 1.

`score = -(최근 도메인 등장 패널티) + (약점 보너스) + (태그 우선순위) - (carry-over 패널티)`. 기본값: RECENT_PENALTY_PER=2, WEAK_AREA_BONUS=3, CARRYOVER_PENALTY=1. carry-over는 `data/runtime/topic-inventory-history.jsonl`에 매 실행 append.

### 결과
- 도메인 다양화 + weak area 가중치 + carry-over 방지.
- 점수식 명시적이라 향후 튜닝 비용 ↑ (ADR로 갱신해야).

---

## ADR-011 — Study topic 자동 보충 (replenishment)

- Status: Superseded by plan015 (2026-05-15) — topic-pool-replenisher 폐기. study-topic-recommender가 replenish 흐름 흡수 (plan016, ADR-026).
- Date: 2026-04-27

### 맥락
ADR-009/010으로 reservoir 구조는 생겼지만 보충은 여전히 수동. primary 재고 0이면 사용자가 promotion까지 수동 처리.

### 결정
study topic replenishment를 daily cron으로 자동화. Claude 제안 → 로컬 validator(key/domain/tag/outputPath/prompt) → candidate append → primary 목표치 이하 시 auto-promotion → `refresh_topic_inventory.py` 재실행. live-coding도 같은 흐름.

**경계**: Claude는 제안만, 실제 반영은 로컬 규칙 검증 후. file-backed + deterministic validator + controlled promotion.

### 결과
- 모닝 추천 전 reservoir 자동 갱신.
- weak area / domain balance / duplicate 규칙 코드 유지.
- 단점: Claude 출력 흔들리면 보충 실패 가능 → validator 우선 튜닝.

---

## ADR-012 — Morning 추천을 10픽 + 오늘의 3선으로 확장

- Status: Accepted
- Date: 2026-05-02

### 맥락
ADR-009/010/011 이후에도 모닝 추천이 백엔드 study-pack / live-coding 한 축에 집중. 회사 사례·AI·산업 흐름이 빠짐.

### 결정
10픽 구조 + "오늘의 3선" 큐레이션.

| 카테고리 | 슬롯 |
|---|---|
| 백엔드 스터디 | 3 |
| 회사·엔지니어링 블로그 | 3 |
| AI | 3 |
| Geek/뉴스/산업 | 1 |
| 합계 | **10** |

"오늘의 3선" = 백엔드 1 + 기술 블로그 1 + AI 1 (각 카테고리 1순위).

백엔드 mix를 5-item → 3-item로 축소: new 1 / deepen 1 / live-coding 1. review는 점수 fallback으로만.

신규 reservoir 파일: `config/tech-blog-sources.json`, `config/ai-topic-sources.json`, `config/geek-news-sources.json`.

보조 카테고리는 점수 없이 reservoir 순서 + cooldown(최근 3일).

### 결과
- 매일 학습 input 폭 4축으로 확대.
- "오늘의 3선"이 사용자 결정 비용 ↓.
- 단점: review 슬롯이 mix에서 빠져 review 노출 감소. 면접 D-N 시점에 따라 mix 재조정 필요.

---

## ADR-013 — RSS·Atom discovery 레이어 부착

- Status: Accepted
- Date: 2026-05-02

### 맥락
ADR-012 이후 보조 카테고리(tech-blog / AI / geek)가 reservoir 원본 카드만 보여줘 매일 같은 출력 반복.

### 결정
모닝 추천 파이프라인에 RSS/Atom discovery 레이어 부착. `feedUrl`이 있는 reservoir 항목은 매일 최신 글 1편의 title + URL을 자동 부착. 실패 또는 feedUrl 없으면 reservoir 카드로 fallback.

신규 모듈: `feed_discovery.py` (외부 의존성 없음, 6h 캐시, soft-fail 전용 — morning 전체를 깨면 안 됨). reservoir 스키마에 `feedUrl` / `filterKeywords` 추가, history에 `articleUrls` 추가. 중복 URL은 같은 morning 및 최근 7일 단위로 회피.

### 결과
- source-level 카드가 실제 글 title + URL로 진화.
- "오늘 어떤 글 읽지" 결정 비용 ↓.
- 일부 source (예: 우아한형제들 Cloudflare 차단)는 silent fallback — discovery_log로 진단 가능.

---

## ADR-014 — Claude usage 전파 패턴 통일 (토큰·비용 회계 복구)

- Status: Accepted (2026-05-13 실측 검증 완료). 관련: ADR-023 출력 포맷 결정은 사실상 무효화.
- Date: 2026-05-13

### 맥락
`logs/task-runs.jsonl` 162행 실측 결과 `tokens_*` / `cost_usd` / `model` 4개 필드가 채워진 entry는 baseline / daily 3건뿐. 나머지 159건은 모두 null. 가설(ADR-023가 JSON 폐기) 추적 결과 **틀렸음** — 실제 원인은 자체 extractor/renderer가 usage 전파 패턴을 구현하지 않은 것.

### 결정
자체 extractor 본체에 usage 책임 부과하지 않고 **사이드 헬퍼**로 분리.

신설: `_shared/bin/claude_lib.sh` — `claude_persist_usage <raw-json-path>` 함수. `TRACK_TASK_CLAUDE_USAGE_FILE` env가 있으면 raw Claude JSON envelope을 그 경로로 cp. 없으면 no-op. runner는 extractor 직후 한 줄 호출; retry 경로 bug 회피 위해 `run_once` 직후(extractor 전)로 고정. Python 직접 호출(`replenish_topic_reservoir.py`)은 env 변수를 직접 조회해 인라인 적용.

신설 `_shared/bin/format_cost_summary.py`가 최신 log 항목을 한 줄 비용 요약으로 변환. `run_now.sh`의 `run_tracked()` 헬퍼가 Discord 알림에 자동 부착.

### 결과
- 모든 Claude 호출 runner의 토큰 회계가 `track_task.sh`로 흘러 들어감.
- `run_now.sh`의 11개 case 모두 [완료]/[실패] Discord 알림 + cost summary 통일.
- CLAUDE.md의 "Token / Cost Discipline" 조항이 다시 측정 가능한 정책.

---

## ADR-015 — docs/ 피드백 루프 + data/ 위치 정책

- Status: Accepted
- Date: 2026-05-13

### 맥락
5문서 컨벤션 도입 후 docs/ 역할이 명문화되지 않으면 시간이 지나며 흩어진다. plan-and-build 포팅 과정에서 사용자 directive: docs/는 의사결정·기술 학습을 누적하는 피드백 루프여야 하고, 데이터 파일은 반드시 data/에만.

### 결정
- docs/는 피드백 루프: 새 결정 → adr.md, 명세 변경 → 해당 5문서 즉시 갱신, 회고 → learn/, 인수인계 → hand-off/, 이벤트 준비 → prep/.
- data/는 모든 영속 데이터의 단일 위치. 상세 분류는 data-schema.md.
- config/는 사람이 큐레이션하는 입력만. 자동 생성 데이터를 config/에 두지 않는다.
- docs/ 또는 다른 디렉터리에 데이터 파일을 두는 것은 본 ADR 위반.

### 결과
- docs/가 결정·학습 누적의 단일 출처로 새 에이전트가 즉시 인식 가능.
- 데이터와 의사결정이 디렉터리 레벨에서 분리 → grep·audit 비용 감소.
- plan-and-build common-pitfalls 3번 카테고리에서 위반 즉시 검출 가능.

### 적용
- skills/plan-and-build/references/common-pitfalls.md 3번 카테고리.
- career-os/AGENTS.md 5문서 라우팅 섹션.

---

## ADR-016 — config 디렉터리 통합: 관심사별 단일 파일 + JSON 통일

- Status: Partially superseded by ADR-027 (plan017, 2026-05-15) — topics.json이 3 namespace로 재분리 (study-pack-topics / study-pack-candidates / question-bank-topics). sources.json + baseline-core-files.json 통합 결정은 유지.
- Date: 2026-05-13

### 맥락
career-os/config/에 12+ 데이터 파일이 쌓여 (5 topic / 3 source / live-coding 2 / mvp-target / baseline-core-files.txt / topic-file-map / position 4) 사용자가 "중구난방"이라 부를 정도. 같은 관심사(예: 5 topic 종류)가 분리되어 있어 새 토픽 종류를 추가할 때 어디에 두는지 모호. 형식도 일부 txt가 끼어 있어 일관성 X. position-recommender 단일 사용 자산 4개는 워크스페이스 공용 config/에 있을 이유 없음.

### 결정
- 5개 topic configs(study-pack/maintainer/question-bank/master/bootcamp + candidates)를 단일 `config/topics.json`으로 통합. 각 type을 namespace 키로.
- 3개 source configs(tech-blog/ai-topic/geek-news)를 단일 `config/sources.json`으로 통합. 카테고리 키.
- `config/baseline-core-files.txt` → `config/baseline-core-files.json`. 다른 데이터 파일과 형식 통일.
- position-recommender 단일 사용 자산 4개(`company-upside-reference.md`, `position-context-index.md`, `position-decision-criteria.md`, `verified-company-research-targets.json`)를 `skills/position-recommender/references/`로 이동. config/는 워크스페이스 공용 입력만.
- `live-coding-seed-pool.json`과 `-candidates.json`은 분리 유지 — ADR-009의 primary vs reservoir 의도된 분리 (현 plan에서 합치지 않음).

### 결과
- config/ 안 파일이 19+ → 9 (mvp-target, candidate-profile, topics, sources, baseline-core-files, topic-file-map, live-coding 2, .env).
- 새 topic 종류 추가는 topics.json 한 곳에 namespace 추가로 끝남.
- position-recommender 자산은 그 스킬 안에서 self-contained.
- 코드 영향: 4개 resolver + 5+ runner + refresh / replenish / promote 스크립트가 새 경로·새 스키마로 갱신 필요 (plan002 phase-02~05이 처리).

### 적용
- 통합 스키마는 `docs/data-schema.md` "통합 config 스키마 (plan002 이후)" 섹션 참조.
- live-coding 쌍 보존 결정의 *왜*는 ADR-009.

---

## ADR-017 — cj-oliveyoung-java-backend-prep 거대 skill 분해

- Status: Accepted
- Date: 2026-05-13

### 맥락
단일 dispatcher skill이 4개 도메인(라우팅·갭분석·추천·보충)을 혼재. WIP 3개 entrypoint가 1개월 넘게 dispatcher와 미연결. 폴더명에 폐기 회사명 박힘 → 새 기능 위치 매번 결정 필요 + 코드·문서 오염.

### 결정
- 기능·도메인 기준 5개 skill로 분해: command-router(디스패처), knowledge-gap-analyzer(갭분석), study-topic-recommender(추천), topic-pool-replenisher(보충), study-pack-batch(배치).
- WIP 3개(bootcamp-batch·live-coding-dispatch·auto-question-bank)를 dispatcher에 연결.
- morning-question-bank는 experience-question-bank-writer에 흡수.
- skills/<name>/scripts/ 구조 유지(실행 파일 이전은 ADR-019/plan006). cj-foodville-coffeechat-prep 회사명 제거는 별도 사이클.

거절 대안: core/dispatcher 같은 짧은 이름(의미 과집중), WIP를 별도 plan으로 미룸(회사명·미연결이 한 사이클에 사라져야 함).

### 결과
- 도메인별 책임이 폴더명으로 자명해짐. 폐기 회사명 잔재 제거.
- WIP 3개가 운영 가능 상태(기존 silently dormant). 폴더 수 7 → 11이나 응집도 상승으로 상쇄.

### 적용
- tasks/plan005-cj-oliveyoung-decomposition/ 참조.
- depends_on: plan002(config 통합), plan004(notify_discord.sh 합류 시점 조율).

---

## ADR-018 — docs/ 운영 정책: 휘발성 vs 영속, learn → ADR 흡수 흐름

- Status: Partially superseded by ADR-032 (2026-05-17, learn 영역 폐기 — hand-off/prep 유지 결정은 살아있음) — 5문서 + docs/data 분리 부분은 ai-nodes ADR-004 (2026-05-18)로 모노레포 격상 (Lifted)
- Date: 2026-05-13

### 맥락
docs/ 안에 5문서(prd / data-schema / flow / code-architecture / adr) 외에 decisions/ 15 + audit/ 3 + learn/ 8 + hand-off/ 1 + prep/ 2 가 흩어져 있었다. 시간이 지나며:
- decisions/ NNN-*.md 는 adr.md 통합본과 사실상 중복 — 둘 다 편집해야 하나 어디가 단일 출처인지 매번 헷갈림.
- audit/ 3 파일은 4월 일회성 진단 산출물 — 정책상 어디까지 보존할지 미정.
- learn/ 8 파일 중 7개는 이미 5문서·스킬 본체로 흡수됨에도 잔존 → 새 노트가 어디로 들어와야 하는지 매번 결정.
- 새 에이전트가 docs/를 처음 볼 때 "결정·학습이 어디 있는지" 분기가 명확하지 않음.

### 결정
- adr.md 가 의사결정 누적의 단일 출처 (ADR-015 재확인). 개별 ADR 파일 신설 금지.
- learn/ 는 짧은 회고용. 결정·근거가 굳어지면 adr.md 로 흡수하고 learn 파일은 삭제. legacy 노트의 history 는 git log 에 보존.
- hand-off/ 는 외부 위임·인수인계용 일회성 노트. 임무 종료 후 archive 또는 삭제.
- prep/ 는 회사·이벤트별 운영 자산. 이벤트 종료 후 archive.
- decisions/ + audit/ 디렉터리는 폐기. 새 파일 생성 금지. 기존 잔존은 plan003 phase-02 에서 일괄 git rm.

### 결과
- docs/ = 5문서 + learn/{현행} + hand-off/{현행} + prep/{현행} 4 영역으로 축소.
- 새 노트 라우팅이 명확: 결정이면 adr.md, 회고면 learn/, 외부 위임이면 hand-off/, 이벤트 준비면 prep/.
- legacy 잔존 drift 위험 제거 — 편집해야 할 단일 출처가 항상 명확.

### 적용
- learn/README.md 가 학습 노트 정책의 가이드 (어떤 게 learn 에 들어오고 어떤 게 ADR 로 가는지).
- code-architecture.md 디렉터리 트리에서 decisions/ + audit/ 항목 제거.
- AGENTS.md 5문서 라우팅 표의 ADR 카운트 갱신.

---

## ADR-019 — career-os: Claude Code skill 폴더와 실행 스크립트 디렉터리 분리

- Status: Accepted
- Date: 2026-05-14

### 맥락
skills/<name>/scripts/에 Claude 컨텍스트 자산(SKILL.md·references)과 운영 실행 파일(runner·extractor)이 혼재. skill 로드 시 실행 스크립트가 같이 들어와 토큰 낭비. 새 자산 위치를 매번 판단해야 함.

### 결정
- career-os 한정: career-os/scripts/<skill-name>/에 모든 실행 파일 이동. skills/<skill-name>/은 SKILL.md + references/ 만 유지.
- skill 이름과 scripts/ 서브 디렉터리 이름은 1:1 매칭.
- depends_on: plan005(skill 구조 확정 후 일관된 이전 가능).

거절 대안: scripts/ 평면 구조(이름 충돌·추적 어려움), ai-nodes 전체 변경(워크스페이스 격리 원칙 위배), references/ 분리(Claude 컨텍스트 자산은 skill 안이 자연스러움).

### 결과
- skill 디렉터리가 SKILL.md + references/ 만 남아 Claude 컨텍스트 로드 효율 상승.
- 운영 자산이 scripts/<name>/에 집중 → 위치 명확.
- ai-nodes 다른 워크스페이스는 기존 skills/<name>/scripts/ 패턴 유지(의도된 비대칭).

### 적용
- tasks/plan006-workspace-scripts-restructure/ 참조.
- docs/code-architecture.md "디렉터리 책임" 섹션.
- ai-nodes/CLAUDE.md 워크스페이스 컨벤션 문단은 career-os만 새 구조로 갱신.

---

## ADR-020 — 공용 헬퍼 TS(Bun) 마이그레이션: 점진 + _shared/lib·types 단일 위치

- Status: Accepted
- Date: 2026-05-13

### 맥락
ai-nodes 자동화가 shell + Python 혼재로 자랐다. 사용자가 Python보다 TS를 읽기 쉬워하고, 공용 호출 패턴이 6+ runner에 흩어져 drift 위험이 있었다.

### 결정
- 런타임은 Bun 단일. TS 공용 코드는 _shared/lib/, 타입은 _shared/types/에. 워크스페이스별 TS 복제 금지.
- 마이그레이션은 점진적. 본 plan(004) 범위는 공용 헬퍼 3개(notify_discord.ts · invoke_claude_skills.ts · format_cost_summary.ts)만.
- 옛 헬퍼는 TS 등장 즉시 폐기. shim·thin wrapper 보존 금지. 부분 마이그레이션 금지.

### 결과
- 자주 쓰이는 호출 패턴(Claude CLI subprocess + usage + retry + Discord + cost summary)이 단일 TS 모듈로 일원화.
- 사용자가 읽기 어렵던 Python·shell 헬퍼 제거. 단점: node_modules 도입으로 루트 무게 증가.

### 적용
- 신규 TS 파일은 _shared/lib/ 또는 _shared/types/에.
- 새 runner는 invoke_claude_skills.ts만 사용, Claude CLI 직접 호출 금지.
- 다음 plan(extractor·renderer TS화)은 본 ADR 정책 따라 진행.

---

## ADR-021 — Discord 알림 openclaw 경유 + 워크스페이스 `.env` 격리

- Status: Lifted to ai-nodes ADR-004 (2026-05-18) — .env 워크스페이스 root 격리 부분. Discord 알림 openclaw 부분은 career-os 한정 유지.
- Date: 2026-05-14

### 맥락
plan004 phase-03이 옛 notify_discord.sh의 실제 동작(openclaw CLI)을 참조하지 않고 webhook fetch로 재구현 → Discord 메시지 미도달. 채널 ID가 코드에 hardcoded되어 git history 노출. 워크스페이스별 secret 위치도 명확화 필요.

### 결정
- notify_discord.ts를 `openclaw message send --channel discord` subprocess 방식으로 재구현. --media 옵션으로 notify_discord_media.sh 동작 흡수.
- 채널 ID는 DISCORD_CHANNEL_ID env에서만 읽음. 누락 시 exit 1(옛 silent fallback 폐기).
- secret 위치를 <ws>/.env(워크스페이스 root)로 통일. <ws>/config/.env 폐기.
- caller는 bun --env-file=<ws>/.env 패턴으로 명시적 전달. 라이브러리는 .env 위치 추정 안 함.
- run-phases.py가 notify_discord.ts를 직접 호출(find_notify_script 폐기).

거절 대안: webhook URL 방식(인증·인프라 불일치), hardcoded ID 유지(마이그레이션 불가), git history rewrite(destructive).

### 결과
- Discord 알림이 openclaw 인증 기반으로 정상 동작.
- 설정 누락이 silent이 아닌 즉시 fail로 드러남. secret이 워크스페이스 root에 집중.
- career-os 범위. apartment 마이그레이션은 별도 plan(워크스페이스 격리).

### 적용
- _shared/lib/notify_discord.ts (재구현 본체).
- 각 워크스페이스 .env + .env.example.

---

## ADR-022 — 도메인 헬퍼 TS(Bun) 마이그레이션

- Status: Accepted
- Date: 2026-05-14

### 맥락

plan004(ADR-020)가 공용 헬퍼만 TS로 옮긴 결과, 도메인 헬퍼(extractor / renderer / resolver / Claude subprocess wrapper)는 Python 잔존. 공용은 TS, 도메인은 Python인 비대칭이 새 작업마다 위치·언어 결정 부담을 만든다. plan004 사이클에 흡수됐어야 할 `_shared/bin/extract_claude_result.py`도 사각지대로 남아 다수 runner가 여전히 `python3`로 직접 호출 중.

### 결정

도메인 헬퍼를 ADR-020 정책 그대로 TS로 마이그레이션. skill-specific 자산은 ADR-019 컨벤션대로 `scripts/<skill>/` 아래, 다중 skill 공유 코어만 `_shared/lib/`. 본 plan 범위는 extractor·renderer·resolver·Claude-subprocess 9개 + `_shared/bin/extract_claude_result.py` 정리로 한정.

거절한 대안:
- 모든 Python을 한 plan에: 작업량 과대 + 실패 위험.
- 모두 `_shared/lib/`에 평면 배치: skill-specific 검증 로직이 공용 영역에 들어가면 도메인 응집도 깨짐.
- Python 유지 + TS wrapper: ADR-020의 shim 보존 금지 원칙 위배.

### 결과

- 도메인 헬퍼가 TS로 일관됨. `_shared/bin/`이 트래커·artifacts 갱신 외 자산만 남음.
- 미마이그레이션 Python(데이터 수집 · 진행 추적 · inventory refresh 등)은 별도 plan 대상 — 한 사이클당 변화 범위 통제.
- 단점: caller가 한 사이클에 일괄 갱신돼야 일관 상태 — 부분 마이그레이션 금지.

### 적용

- 이전 phase 명세는 `tasks/plan008-extractor-renderer-ts/`.
- depends_on: ADR-020(plan004), ADR-019(plan006), ADR-021(plan007).

---

## ADR-023 — Study-pack 생성: 파일 쓰기 → stdout 캡처

- Status: Deprecated (2026-05-13, 실측 무효) — JSON 출력 폐기 결정이 토큰 회계 누락을 초래. ADR-014가 진짜 원인(extractor usage 전파 미구현)을 진단·복구. Write 도구 사용 금지 핵심 결정만 유지.
- Date: 2026-04-14

### 맥락
`run_study_pack.sh`가 Claude에게 "파일에 쓰기 + 한 줄 응답"이라는 두 지시를 동시에 줘서 prompt 충돌이 발생. Claude가 파일을 안 쓰고 stdout으로 마크다운을 출력하는 위험도 존재.

### 결정
Claude에게 Write 도구로 파일 쓰기를 시키지 않고, stdout 출력을 직접 `$TMP_DRAFT`로 캡처. 그 과정에서 `--output-format json`을 폐기.

### 결과 (정정)
- prompt 충돌 제거 + Write 도구 의존 제거(유효한 결정).
- **단, JSON 폐기는 부작용으로 토큰 회계 누락을 초래**. 이후 study-pack runner는 다시 `--output-format json`을 채택. ADR-014가 회계 누락의 진짜 원인(자체 extractor가 usage 전파 미구현)을 진단·복구.

---

## ADR-025 — Skills 정리 + 한글화 정책

- Status: 채택됨
- Date: 2026-05-14

### 맥락

career-os skills 11개가 plan005·plan010·plan011을 거치며 도메인·언어 자산이 안정됐으나 세 가지 문제가 남아 있었다. (1) `fos-study-pack`은 dispatcher 미연결 + `run_from_request` deferred 상태로 1개월 이상 방치돼 사용 가치 없음. (2) 7개 SKILL.md가 영문 위주(한글 비율 ≤15%)라 다른 skill·docs와 톤 비대칭. (3) maintainer가 update-vs-new 판단 시 fos-study 전체 상태 점검이 필요하지만 `docs-audit`과 명시적 연계가 없어 일관성 유지가 어려움.

### 결정

- `fos-study-pack` 폴더(`scripts/` + `skills/`) 제거. 자연어 라우팅 의도는 `study-pack-writer` SKILL.md의 trigger pattern으로 흡수.
- 한글화 정책: description + prose는 한글, 코드 식별자(skill명·command명·파일경로·함수명)는 영어 유지.
- `study-pack-maintainer` SKILL.md 안에 docs-audit 활용 권장 안내 한 줄 추가(수동 링크, cross-skill 자동 호출 없음).

### 거절한 대안

- fos-study-pack을 dispatcher에 wire-up: 미사용 자산을 살려둘 정당화 없음.
- 한글 비율 100%(코드 식별자까지 한글화): trigger pattern 매칭·grep에 영향.
- maintainer에서 docs-audit subprocess 자동 호출: cross-skill 결합도 상승.

### 결과

skill 수 11 → 10. SKILL.md 톤 일관성 확보. 한글화로 한국어 native 유지보수성 향상. 코드 식별자 영어 유지로 Claude Code skill trigger 매칭 보존. 단점: 한글화 후 영문 grep 시 일부 안내 누락 가능 — 코드 식별자는 영어라 핵심 검색은 영향 없음. 적용: `tasks/plan012-skills-korean-and-cleanup/`. depends_on: plan010(skills 추상화 완료).

## ADR-026 — study-topic-recommender native 마이그 + Python → TypeScript + replenish/promote/live-coding 흡수

**Status**: Accepted
**Date**: 2026-05-15

### 맥락

plan013 (ai-nodes ADR-002)에서 study-pack-writer가 native skill 패턴으로 전환. plan014에서 maintainer + batch 폐기·흡수, plan015에서 master + qbank가 interview-asset-writer로 통합되고 topic-pool-replenisher가 폐기됐다. study-topic-recommender만 옛 외부 subprocess 패턴이 남아 있다 — 622줄 Python 점수 알고리즘(`refresh_topic_inventory.py` — ADR-009/010/012/013) + 외부 RSS 의존(`feed_discovery.py`). dispatcher case 3개 (recommend-topics + live-coding-dispatch + 이미 plan015 폐기된 replenish-topics)도 함께 native 진입점으로 정리해야 일관.

또한 topic-pool-replenisher 폐기로 *replenish + promote 자동화*가 끊어진 갭이 있다. 사용자 의도는 `claude -p "/study-topic-recommender"` 한 진입점이 호출 시마다 *replenish + recommend + promote* 모두 자동 처리. 트리거 시점 정책은 openclaw 스케줄러 책임.

### 결정

다음 묶음으로 처리:

1. **Python → TypeScript 마이그**: `refresh_topic_inventory.py` (622줄) + `feed_discovery.py` → ts. fast-xml-parser 의존 추가 (RSS XML 파싱). 알고리즘(ADR-009/010/012/013) 결정론 동등 동작 보장 — Python·ts 양쪽 실행 후 출력 diff = 0 검증 phase.
2. **native skill 명세**: SKILL.md를 Bash 도구로 ts 호출 + Claude 자연어 추론 hybrid. replenish + recommend + promote 3 흐름 모두 SKILL.md 안에서 자동 진행. 호출 시마다 항상 실행 (feed-cache로 RSS 부담 완화).
3. **replenish/promote 흡수**: 옛 topic-pool-replenisher의 두 Python 의도 (replenish + promote)를 study-topic-recommender 안으로. promote는 *fos-study commit 확인 후 candidate → primary 자동 detect*.
4. **live-coding seed pool 흡수**: live-coding-seed-pool.json + seed-candidates.json + run_live_coding_dispatch.sh의 의도를 study-topic-recommender 안으로 통합. 자연어 "live-coding 1개 골라줘" 시 처리.
5. **dispatcher 3 case 폐기**: recommend-topics + live-coding-dispatch + (plan015 폐기된) replenish-topics 모두 폐기. 진입점 `claude -p "/study-topic-recommender"` 단일.

### 거절한 대안

- Python 그대로 + Bash wrapper만: 모노레포 일관성(ADR-020/022, _shared/lib ts 표준) 위반.
- Python 폐기 + Claude 자연어로 알고리즘 전부 추론: 점수·mix target 결정론 손실.
- skill rename (topic-curator 등): rename 파급비 vs 의미 명확성 trade-off에서 rename 가치 부족.

### 결과

- skill 8 → 8 유지 (study-topic-recommender는 *통합 강화*, 폐기 없음)
- dispatcher case 7 → 4 (recommend-topics + live-coding-dispatch 2 case 폐기)
- Python script 3개 폐기 (refresh_topic_inventory.py / feed_discovery.py / 이미 폐기된 replenisher 2 Python)
- 새 의존성: fast-xml-parser
- 알고리즘 결정론 유지 (입출력 동등 검증 phase)
- 사용자 진입점 단순화: 옛 3 dispatcher case → 1 native invoke
- 자동 흐름 통합: replenish + recommend + promote + (필요 시) live-coding seed 선택 모두 한 호출

### 적용

`tasks/plan016-study-topic-recommender-native/`. depends_on: plan013(ADR-002) + plan015. common-pitfalls 6-6 회피: draft 별도 파일 + commit 개수 self-check phase. 6-7 자동 적용: 현재 references/ 부재라 위험 없음.

## ADR-027 — knowledge-gap-analyzer → interview-prep-analyzer 통합 native 마이그 + topics.json namespace 분리

**Status**: Accepted
**Date**: 2026-05-15

### 맥락

knowledge-gap-analyzer는 baseline / daily / smoke 3 모드를 dispatcher 분기로 처리. 모드별 입력 set·산출물 섹션·부수효과(study-progress 갱신)는 다르지만 코드 80% 중복 (mvp-target + candidate-profile + fos-study Read → Claude 분석 → report.md Write). codex가 자동 생성한 분리 구조라 *과도한 책임 분할* 의심. 실측 활성도도 낮음 (baseline 4 + daily 2 + smoke 7 / 30일).

또 `config/topics.json`이 plan002 통합본으로 62KB / 1084줄까지 비대. namespace별 사용 skill 1-2개로 분리되어 *분리하면 깔끔* — 그러나 plan002 통합 결정(ADR-008 가정)을 부분 번복하는 셈이라 ADR 기록 필요. 현재 Write 0건 (사용자 수동 편집만) — 분리 마이그 안전.

### 결정

한 plan(plan017)에서 두 변경 묶음 처리:

1. **knowledge-gap-analyzer → interview-prep-analyzer 통합 native**: 단일 skill에 자연어로 baseline / daily 모드 분기. smoke는 폐기 (native 패턴에선 검증 가치 약함 — Claude 호출 sanity는 다른 skill 사용 중에 자연 확인). study-pack-writer / interview-asset-writer 패턴 일관성. Python 6개 (build_target_file_list / select_topic / update_study_progress / run_baseline / run_daily / run_smoke_test) 완전 폐기 — 알고리즘 단순 (점수 X, cooldown 단순)이라 자연어 추론으로 동등.
2. **topics.json namespace 분리**: 3 json (`study-pack-topics.json` 55 키 / `study-pack-candidates.json` 2 키 / `question-bank-topics.json` 2 키). 각 namespace를 사용하는 skill 1-2개에 맞춰 분리 — 단일 책임. plan002 통합 의도 (5 → 1)가 *과도 통합*으로 판명됨.

### 거절한 대안

- 2 skill 분리 (baseline-analyzer + daily-analyzer): 코드 80% 중복 + 활성도 낮아 두 SKILL.md drift 위험 — 단일이 더 native 답다.
- topics.json 유지 + namespace 안에서만 분기: 1084줄 한 파일 — AI 에이전트 컨텍스트 로드 비용 + 사용자 편집 불편.
- 다른 plan으로 분리: 두 변경이 시간적으로 동시 적용 가능 (의존성 없음) — 한 plan으로 atomicity.

### 결과

- skill 수 유지 (knowledge-gap-analyzer 폐기 1, interview-prep-analyzer 신규 1).
- dispatcher case 7 → 4 (baseline + daily + smoke 폐기). 누적 native 진입점 4개 (study-pack / interview-asset / study-topic-recommender / interview-prep-analyzer).
- Python script 6개 폐기. config 1 → 3 json (총 크기는 동일하나 namespace별 단일 책임).
- 단점: namespace 추가 시 새 config 파일 신설 부담 (희소).

### 적용

`tasks/plan017-interview-prep-analyzer-native/`. depends_on: plan013(ADR-002). common-pitfalls 6-6/6-7 회피: draft 별도 파일 + references audit grep + commit 개수 self-check phase.

## ADR-028 — candidate-baseline-suggester skill 도입 (Append + 주석 마킹 + audit trail)

**Status**: Accepted
**Date**: 2026-05-15

### 맥락

career-os/config/ 사용자 hand-crafted 자산이 *최신화 안 됨*:
- `candidate-profile.md` "입증된 강점" / "약점·학습 중인 영역" 섹션 — fos-study에서 학습한 새 토픽 반영 안 됨
- `baseline-core-files.json` (현재 6 파일) — fos-study에 새 핵심 파일 추가돼도 큐레이션 set 갱신 안 됨
- `config/study-progress.json` weak_spots — 진도 평가 자동 갱신 안 됨

(과거 design은 `prd.md "약점·강점"` 섹션도 갱신 대상이었으나 책임 영역 위반 — prd.md는 제품 문서, 후보자 데이터 X. 본 ADR 적용 후 별도 사이클에서 제거됨.)

사용자가 매번 직접 갱신하면 burden + 학습 진도와 평가 간 drift 발생. fos-study 전체 commit history + study-progress + interview-prep-analyzer baseline 산출물에서 *자동 추론 가능한 부분*은 skill로 흡수하는 게 자연.

### 결정

`career-os/.claude/skills/candidate-baseline-suggester/SKILL.md` 신규 (워크스페이스 한정 — 자산 모두 career-os 소속).

**Append + 주석 마킹 하이브리드 패턴**:
- candidate-profile.md / baseline-core-files.json: *기존 본문 보존 + 새 항목 append*. fos-study path 근거 명시.
- candidate-profile.md "약점·학습 중인 영역" outdated 항목: `<!-- suggester: outdated since YYYY-MM-DD, 근거 fos-study/<path> -->` 주석 마킹. 사용자가 직접 삭제.
- config/study-progress.json weak_spots: 평가 갱신.

**audit trail 필수**: `data/runtime/profile-refresh-suggestions/YYYY-MM-DD/`에 before/ + after/ + diff.md + changes.md (변경 사유 + fos-study path 출처). 사용자가 수동 roll back 가능.

**입력**:
- fos-study 전체 commit history (git log)
- config/study-progress.json
- (선택) data/reports/baseline/<latest>/report.md (plan017 결과 — 있으면 Read)
- candidate-profile.md / baseline-core-files.json 현재 본문

거절한 대안:
- 제안만 (Edit 안 함): 매번 사용자가 수동 적용 burden — 처음 결정에서 사용자 의도 변경.
- 완전 자동 대체 (rewrite): hand-crafted 내용 손실 위험 — Append + 주석이 더 안전.
- 모노레포 전역 skill: 자산이 career-os 특화라 격리 원칙 위반.

### 결과

- 사용자 burden ↓ — fos-study 학습 진도가 candidate-profile에 자동 반영.
- audit trail로 변경 추적 + 수동 roll back 가능.
- 단점: skill 결과가 *잘못된 append* 가능성 (예: 잘못된 강점 추가). 사용자가 주기적 검토 필요.
- skill 호출 시점 (cron 친화 / 수동 호출 only) 정책 미정 — 본 ADR 범위 외.

### 적용

`tasks/plan020-candidate-baseline-suggester/`. depends_on: 없음 (plan017 선택적 의존). common-pitfalls 6-6 회피: SKILL.md draft 별도 파일 + Read draft → Write target.

## ADR-029 — cj-foodville-coffeechat-prep → interview-coffeechat-prep native rename + 회사 추상화 + ts collector + 준비 자산 data 이동

**Status**: Accepted
**Date**: 2026-05-16

### 맥락

`cj-foodville-coffeechat-prep` skill은 CJ Foodville 면접 시즌 전용으로 이름·URL·강의 자료가 회사명에 박혀 있다. mvp-target.json의 `coffeechat_*` 변수로 일부 추상화됐지만 *collector script 자체*가 3 URL hard-coded (vips / cheiljemyunso / cjfoodville-brand) + skill 이름도 회사명. 회사 전환 시 skill 이름·collector·전략 노트·체크리스트 모두 재작성 필요 — 회사 불가지론 의도 불완전.

또 `collect_foodville_sites.py` 156줄 Python (stdlib only)이 ai-nodes ADR-022 (Bun TS 마이그) 정책과 어긋남. shell runner도 옛 외부 subprocess 패턴이라 native skill 흐름과 맞지 않음.

`docs/prep/cj-foodville-coffeechat-{strategy,30min-final-checklist}.md`는 ADR-015 정렬 위반 후보 — `docs/`는 의사결정·학습 누적이고, *회사 특화 hand-crafted 준비 hint*는 `data/prep/<company-slug>/`가 자연.

### 결정

일곱 묶음 변경 (한 plan021):

1. **skill rename**: `cj-foodville-coffeechat-prep` → `interview-coffeechat-prep`. SKILL.md 본문에서 회사명 박힘 제거. mvp-target.json의 `primary.coffeechat` 객체가 회사별 context 단일 출처.
2. **mvp-target.json `primary.coffeechat` 객체로 묶기**: 옛 평면 변수 6개 (`coffeechat_skill_dir`, `coffeechat_report_slug`, `coffeechat_source_dir`, `coffeechat_collector_script`, `coffeechat_brand_snapshot`) → `primary.coffeechat: { sites: [{key, url, label}], source_dir, report_slug, prep_dir, strategy_filename, checklist_filename }` 한 객체. 회사 전환 시 `primary.coffeechat` 통째 교체.
3. **zod 스키마 도입**: `_shared/lib/mvp_target_schema.ts` 신규 — zod 스키마 + `parseMvpTarget()` 함수. collector ts와 (향후) 다른 mvp-target Read 위치에서 공유 검증. 신규 의존성: `zod` (작은 라이브러리, Bun 호환).
4. **Python collector → TypeScript 마이그**: `collect_foodville_sites.py` (156줄) → `collect_company_sites.ts` (Bun fetch + HTML → text). 회사 hard-coded URL 제거 — sites 배열을 zod 스키마로 Read.
5. **shell runner 폐기**: `run_foodville_coffeechat_prep.sh` 폐기. native skill SKILL.md가 Bash로 ts collector 호출 + 결과 Read.
6. **회사 준비 자산 위치 이동**: `docs/prep/cj-foodville-coffeechat-*.md` → `data/prep/cj-foodville/{strategy,checklist}.md`. ADR-015 정렬 — docs/ 비움, data/prep/<company-slug>/ 신설.
7. **dispatcher `foodville-coffeechat` case 즉시 폐기**: native `/interview-coffeechat-prep` 단일 진입점. 남은 dispatcher case 1개 (`recommend-positions`).

거절한 대안:
- skill 이름 `coffeechat-prep`: 면접 외 용도도 포함 — 의도 모호. `interview-coffeechat-prep`이 interview-asset-writer / interview-prep-analyzer 계열과 일관.
- URL을 별도 `config/coffeechat-targets.json`: mvp-target.json과 drift 위험. 단일 출처 원칙 따라 mvp-target.json에 통합.
- Python collector 유지: ADR-022 일관성 + stdlib only라 ts 마이그 비용 낮음.
- **전체 config json zod 일괄 도입**: topics-* / sources / mvp-target 모두 zod — 큰 plan이라 별도 분리. 본 plan021은 mvp-target만, 다른 config는 추후 별도 plan으로 확장.

### 결과

- 회사 전환 시 *mvp-target.json `primary.coffeechat` 객체만 교체*. skill 이름·collector·SKILL.md 본문 그대로.
- ADR-022 ts 일관성 회복 (Python collector 폐기).
- ADR-015 정렬 — `docs/prep/` 비움, `data/prep/<company-slug>/` 신설.
- zod 의존성 추가 — 향후 다른 config (topics / sources)도 zod 스키마 적용 가능한 기반 (별도 plan).
- dispatcher case 2 → 1 (recommend-positions만). plan022 후 plan023에서 command-router 일괄 폐기.
- 단점: skill rename으로 docs/AGENTS.md/git history 영향 — 본 plan021에서 일괄 정리. zod 의존성 한 개 추가.

### 적용

`tasks/plan021-interview-coffeechat-prep-native/`. depends_on: 없음. common-pitfalls 6-6 회피: SKILL.md draft + collect_company_sites.ts draft 별도 파일.

## ADR-030 — position-recommender native 마이그 + collect_live_postings ts 활성화 + extract/publish/runner 폐기

**Status**: Accepted
**Date**: 2026-05-16

### 맥락

position-recommender는 활성도 36회/30일 (career-os 최활성)이지만 옛 외부 subprocess 패턴: `run_position_recommendation.sh` 76줄이 7 references cat → `claude --print --output-format json` 호출 → `extract_position_report.ts` 45줄로 markdown 검증. native skill 패턴(ADR-002)과 어긋남.

또 deferred 2 자산:
- `collect_live_postings.py` 298줄 — Wanted + Toss 채용 API 수집 (Python `requests`). plan005(ADR-017) wire-up 됐어야 했으나 1개월+ 호출 0. POSITION_POSTINGS_FILE env 외부 주입 패턴이 *대체*해 왔음 (사용자 수동 markdown).
- `publish_job_analysis.sh` 110줄 — fos-study publish 의도였으나 호출 0. position 분석은 *비공개*가 자연 (recommend-positions는 후보자 본인 결정 도구).

또 `POSITION_CONTEXT` + `POSITION_POSTINGS_FILE` env 주입 패턴이 native skill 자연어 호출 (`claude -p "/position-recommender <자연어>"`)과 일관성 없음.

### 결정

여섯 묶음 변경 (한 plan022):

1. **SKILL.md native 명세 재작성**: references 6 + candidate-profile + sources.json `techBlog` Read → Claude 자연어 분석 → report.md Write. 자체 self-check (첫 줄 `#` + 30줄+).
2. **collect_live_postings.py → ts 마이그 + 활성화**: 298줄 Python (`requests`) → Bun fetch (built-in). Wanted + Toss API 그대로. SKILL.md가 *선택적으로* Bash 호출 (자연어에 "최신 채용" 키워드 있으면).
3. **run_position_recommendation.sh 폐기**: native skill SKILL.md가 직접 Read/Write.
4. **extract_position_report.ts 폐기**: Claude 자체 self-check (첫 줄 `#` + 30줄+)로 흡수. JSON 추출 단계 native에서 불필요.
5. **publish_job_analysis.sh 폐기**: 호출 0 + position 분석은 비공개 자연.
6. **POSITION_CONTEXT + POSITION_POSTINGS_FILE env → 자연어 인자 흡수**: `claude -p "/position-recommender AI 서비스팀 백엔드 위주"` + 파일 path는 자연어 지정 (Read 도구).
7. **dispatcher `recommend-positions` case 폐기**: **마지막 남은 dispatcher case**. plan023에서 command-router 디렉터리 자체 폐기 가능.

거절한 대안:
- collect_live_postings.py 폐기: Wanted/Toss API 수집은 가치 있음 — ts 마이그 + 활성화로 자동 흐름 회복.
- publish_job_analysis.sh ts 마이그 + 활성화: position 분석은 후보자 본인 의사결정 자산 — fos-study publish 의도 모호.
- extract_position_report.ts 유지: native 패턴에서 JSON → markdown 단계 불필요.

### 결과

- 활성 흐름 native 일관성 회복 (plan021 패턴 적용).
- 옛 shell runner + Python collector + extract.ts + publish.sh = **4 파일 폐기** (run_*.sh + extract + collect.py + publish.sh).
- collect_live_postings.ts 신규 — 자동 채용 수집 활성화 회복.
- **dispatcher case 1 → 0**. plan023에서 command-router 디렉터리 + run_now.sh + setup_env.sh 일괄 폐기 가능.
- 단점: collect_live_postings.ts 마이그가 Wanted/Toss API 응답 형식 변경 가능성에 취약 — Python 원본과 동등성 검증으로 완화.

### 적용

`tasks/plan022-position-recommender-native/`. depends_on: plan021 (zod 도입 — collector ts가 mvp_target_schema 참조 가능). common-pitfalls 6-6 회피: SKILL.md draft + collect_live_postings.ts draft 별도 파일.

## ADR-031 — command-router 디렉터리 일괄 폐기 + invoke_claude_skills.ts + format_cost_summary.ts 폐기

**Status**: Accepted
**Date**: 2026-05-16

### 맥락

plan013~022 (ADR-002/026/027/028/029/030)로 모든 dispatcher case가 native skill로 흡수되어 폐기됐다. plan022 완료 시점에 `career-os/scripts/command-router/run_now.sh`의 case는 0개 도달. dispatcher 디렉터리 + SKILL.md 존재 의미 사라짐.

또 plan021/022 완료로 다음 ts lib들의 caller가 0건이 됨:
- `_shared/lib/invoke_claude_skills.ts` — 옛 caller (study_pack_publish.ts + run_position_recommendation.sh + run_foodville_coffeechat_prep.sh) 모두 폐기.
- `_shared/lib/format_cost_summary.ts` — command-router/run_now.sh가 유일 caller.

사용자 명시 흐름 ("command-router 폐기 후 불필요한 ts lib 제거")에 맞춰 둘을 한 plan으로 묶음.

### 결정

세 묶음 변경:

1. **command-router 디렉터리 일괄 폐기**:
   - `career-os/scripts/command-router/` (run_now.sh + setup_env.sh)
   - `career-os/.claude/skills/command-router/SKILL.md`
2. **_shared/lib ts 2개 폐기** (caller 0 도달):
   - `_shared/lib/invoke_claude_skills.ts`
   - `_shared/lib/format_cost_summary.ts`
   - `_shared/types/index.ts`에서 관련 타입 정리
3. **`career-os/scripts/_lib/` 5 파일 일괄 폐기** (plan013/021/022 cleanup 잔재):
   - `build_prompt.ts` — 옛 prompt 조립 (foodville runner가 마지막 caller, plan021 phase-03 폐기로 caller 0)
   - `extract_and_validate_study_pack.ts` — caller 0 (plan013 정리 누락)
   - `fos_study_git.ts` — `publish_job_analysis.sh`가 유일 caller (plan022 phase-03 폐기로 caller 0)
   - `resolve_study_pack_topic.ts` — caller 0
   - `study_pack_publish.ts` — caller 0
4. **5문서 + AGENTS.md 갱신**:
   - dispatcher 진입점 0 → native skill 진입점 단일화 표기
   - 외부 의존성 섹션에서 invoke_claude_skills + format_cost_summary 제거
   - track_task.sh는 *career-os에서 사용 0*이지만 apartment에서 사용 중 → ai-nodes 모노레포 레벨에서 유지 (워크스페이스 격리 원칙)

거절한 대안:
- command-router 빈 dispatcher 유지: case 0 도달 후 존재 가치 0. 폐기가 자연.
- ts lib 폐기를 plan024로 분리: 사용자 명시로 한 plan에 묶음 — 의존 caller 모두 동일 plan021/022에서 폐기됐기에 정합성 ↑.
- track_task.sh도 폐기: apartment에서 사용 중 — 워크스페이스 격리 위반. 유지.

### 결과

- career-os dispatcher 완전 폐기 → native skill 7개가 단일 진입점.
- _shared/lib 정리 (2 ts 폐기, 잔여 자산 — notify_discord.ts + extract_claude_result.ts + mvp_target_schema.ts).
- AGENTS.md "외부 의존성" 섹션 간소화.
- 단점: extract_claude_result.ts는 *apartment + stock-investment 5 caller*가 여전히 사용 — career-os 외부 워크스페이스라 본 plan 범위 외 (사용자 명시: 별도 워크스페이스 세션 + GitHub issue).

### 적용

`tasks/plan023-command-router-and-ts-lib-cleanup/`. depends_on: plan021 + plan022 (caller 폐기 선행). common-pitfalls 6-6 회피: 폐기 작업이라 draft 별도 파일 불필요 (Write 위장 위험 낮음).

## ADR-032 — learn/ 영역 폐기 — 회고 흐름 chat + ADR/스킬 직접 흡수로 단순화

**Status**: Accepted
**Date**: 2026-05-17

### 맥락

ADR-018에서 `docs/` 4 영역 (5문서 + learn + hand-off + prep)으로 운영 정의. learn은 "결정 굳어지기 전 사고 흐름" 영역이었으나, plan013~022 진행 중 실측 패턴은:

- 사용자 ↔ Claude 대화로 회고가 *즉시 결정으로 굳어짐* — 중간 메모 단계 거의 사용 안 함
- 굳어진 결정은 *바로 ADR / 스킬 본체*로 흡수됨 — learn 거치지 않음
- 008-docs-audit-quality-loop가 *유일하게 남은 learn 노트* — fos-study docs-audit 스킬로 직접 흡수 가능했음

→ learn은 *과도기적 영역*. 영역 자체가 회고 흐름 속도와 맞지 않음.

### 결정

- `career-os/docs/learn/` 디렉터리 + 모든 콘텐츠 폐기 (008-docs-audit-quality-loop.md + README.md)
- 회고 흐름은 두 경로로 정리:
  - **휘발성 회고** — chat 대화 안에서만 유지 (Claude 컨텍스트 + git log)
  - **굳어진 회고** — ADR / 스킬 본체로 *직접* 흡수 (learn 중간 단계 생략)
- `docs/` 영역 4 → 3: 5문서 + hand-off + prep
- ADR-018 Status: `Partially superseded by ADR-032 (2026-05-17, learn 영역 폐기)` — hand-off / prep 영역 유지 결정은 살아있음

### 거절한 대안

- learn 영역 유지 + 빈 폴더 보존: 사용 빈도 낮으면 *어디에 적을지 매번 의문* — 영역 폐기가 명확.
- 회고를 hand-off / prep으로 통합: 도메인 다름 (회고 ≠ 인수인계 ≠ 이벤트 준비).

### 결과

- docs/ 단순화 — 5문서 + hand-off + prep + tasks (영구 자산은 5문서 + 스킬 + ADR).
- 새 회고 위치 매번 결정 부담 ↓ — chat → 굳으면 ADR.
- 단점: 회고 누적 자산이 없어 *과거 사고 흐름* 추적 시 git log + chat 검색 의존 (이미 그 패턴이 dominant라 무리 없음).

### 적용

`docs/code-architecture.md` 트리에서 learn/ 라인 제거. AGENTS.md 5문서 라우팅 가이드는 영향 없음 (learn 명시 없음).

---

## ADR-033 — fos-study source tree를 study artifact 단일 진실원으로 사용

- Status: Accepted
- Date: 2026-05-18

### 맥락

아침 `study-topic-recommender`가 이미 `sources/fos-study/`에 존재하는 주제와 유사한 스터디팩을 다시 추천하는 문제. 원인 4가지가 누적:

- 추천기는 `data/generated-artifacts.json`의 `outputPath` 집합을 "이미 생성됨" 판단 근거로 사용 — fos-study 실제 트리와 drift 가능.
- inventory 갱신과 `_shared/bin/update_artifacts.py` upsert가 분리돼 동기화 보장 없음.
- exact path match만 보므로 경로만 다른 유사 주제 (`java/spring/xxx.md` vs `architecture/xxx.md`)는 통과.
- `study-pack-writer`는 SKILL.md §3 overlap 점검이 자기 판단에 의존 — high/medium confidence 중복에 강한 게이트 없음.

`sources/fos-study/`는 study-pack-writer가 직접 push하는 실제 공개 문서 트리. 별도 인덱스(`generated-artifacts.json`)를 유지하면 drift 비용이 가치보다 크다. fos-study 자체를 진실원으로 삼으면 한 곳만 보면 된다.

### 결정

`career-os/sources/fos-study/**/*.md`(exclude `.git/**`, `.claude/**`)를 generated study artifact의 **단일 진실원**으로 사용한다.

- `data/generated-artifacts.json`은 career-os 활성 동작에서 제거 — Read·Write 모두 0.
- `_shared/bin/update_artifacts.py`는 career-os caller 0으로 격하 (파일 자체는 별도 plan 대기, 다른 워크스페이스 영향 회피).
- `study-topic-recommender`는 `refresh_topic_inventory.ts` 안에서 fos-study 트리를 직접 스캔. 추천 실행 중 `git pull`은 하지 않는다 (로컬 clone 기준).
- `topic-inventory.json`은 config pool 복사본이 아닌 *실행/진단 스냅샷*으로 축소. 마지막 실행의 판단 결과 + duplicate review status만 담는다.
- duplicate detection은 2단계로 분리: TypeScript deterministic scan (path exact + normalized + slug/token overlap) → native Claude duplicate review (의미 판정). TypeScript는 provider-free.
- recommender와 writer가 같은 **duplicate decision schema**를 사용: `new` / `update-existing` / `skip` / `needs-user-confirmation` 4개 라벨.
- morning markdown은 `new` 후보로 추천 섹션을, `update-existing`/`needs-user-confirmation` 후보로 별도 "기존 문서 보강 후보" 섹션(최대 5개)을 보여준다.
- Claude duplicate review 실패는 추천 전체를 실패시키지 않음 — deterministic fallback + warning.
- `study-pack-writer`는 새 markdown 작성 직전 같은 schema로 duplicate guard 수행: `new`만 새 파일, `update-existing`은 기존 문서 update로 전환, `skip`/`needs-user-confirmation`은 작성 중단.

### 거절한 대안

- `generated-artifacts.json` 유지 + cross-sync 도입: drift 자체를 없애지 못함. *왜 두 진실원이 있는지* 정당화 불가.
- duplicate detection helper를 `_shared/lib`로 즉시 승격: career-os/fos-study 구조에 강하게 묶임 — 도메인 묶음 풀리면 다시 검토.
- duplicate review를 TypeScript에서 직접 Claude API 호출: provider-free 원칙 위배. native skill이 도구 호출의 단일 출처 (ADR-026 정렬).
- fos-study 자동 `git pull` 후 스캔: 추천 결정의 *입력 무결성* 흔들림 — 사용자의 로컬 clone 상태 그대로 사용.

### 결과

- 진실원 단일화 — fos-study가 곧 "이미 존재하는 문서" 집합.
- recommender·writer 사이 duplicate 정책 통일 — 사용자가 어디로 명령하든 같은 게이트 통과.
- morning markdown UX 개선 — "보강 후보" 5개가 별도 섹션으로 노출돼 새 문서 vs 기존 문서 보강 의사결정이 명확.
- 단점:
  - 매 morning 추천마다 fos-study 트리 스캔 비용 (수백 ~ 수천 개 파일, 그러나 markdown만 + 본문 읽지 않음 — 무시 가능).
  - Claude duplicate review 한 번 추가 — 비용·시간 증가 (deterministic fallback로 가용성은 보장).
  - `update-existing` 후속 처리 (기존 문서 보강 정책)는 본 ADR 범위 밖 — 별도 plan.

### 적용

- `scripts/study-topic-recommender/refresh_topic_inventory.ts` — `generated-artifacts.json` 의존 제거 + fos-study 스캔 + deterministic dedupe.
- (선택) `scripts/study-topic-recommender/duplicate_detection.ts` — TypeScript dedupe helper. writer도 참조 가능.
- `.claude/skills/study-topic-recommender/SKILL.md` — Claude duplicate review 단계 추가.
- `.claude/skills/study-pack-writer/SKILL.md` — duplicate guard 단계 강화.
- `docs/data-schema.md` — `data/generated-artifacts.json` active 제거, `topic-inventory.json` 새 스냅샷 스키마, duplicate decision schema 추가.
- `docs/flow.md` — recommender·writer 흐름 갱신.
- `docs/code-architecture.md` — `generated-artifacts.json` 트리 제거 + `update_artifacts.py` career-os 사용 0 표기.
- `docs/prd.md` — morning markdown "기존 문서 보강 후보" 섹션 노출.
- `AGENTS.md` — 외부 의존성 섹션의 `update_artifacts.py` 항목 갱신/제거.
- OpenClaw wrapper (`~/.openclaw/workspace/skills/study-topic-recommender|study-pack-writer/SKILL.md`)는 사용자가 직접 동기 — Claude는 `~/.openclaw/**` 수정 금지.

---

## ADR-034 — interview-coffeechat-prep 4 mode 일반화 (coffeechat / first-round / final-round / offer-chat)

- Status: Accepted
- Date: 2026-05-19

### 맥락

interview-coffeechat-prep skill 은 `mvp-target.json` `primary.coffeechat` 단일 객체 기반으로 커피챗 전략 리포트만 생성.
CJ Foodville 1차 면접 임박 — first-round 분석 자료 (회사·비즈니스 / 역할·팀 전략 / 후보자 포지셔닝 / 예상 질문 / 역질문) 필요.

옵션 검토:

- 새 skill `interview-first-round-prep` 신설 — 4 mode 각자 skill 분리 시 mvp-target.json 4 객체 + collect helper 4벌 + SKILL.md 4벌. 중복 비용 큼.
- coffeechat skill 을 4 mode 분기로 확장 — Claude 자연어 라우팅 + mvp-target.json `primary.interview.{coffeechat, first_round, final_round, offer_chat}` 단일 구조 + helper 공유.

### 결정

interview-coffeechat-prep skill 을 4 mode 일반화. backward compat 유지.

- `mvp-target.json` 스키마 마이그: `primary.coffeechat` → `primary.interview.{coffeechat, first_round, final_round, offer_chat}`.
  - coffeechat 객체는 그대로 보존 + 위치 이동.
  - first_round / final_round / offer_chat 은 nullable — 본 plan 에서 first_round 만 활성화.
- mode 트리거: slash arg (`/interview-coffeechat-prep first-round`) 우선, 자연어 키워드 (`1차 면접`, `first-round`) fallback.
- 산출물 2 파일: `report.md` (private) + `report-public.md` (sanitized — Claude 가 프롬프트 가이드 따라 개인명·추수 액수·내부 리서치 마스킹).
- 본 plan 에서 final_round / offer_chat 동작 구현 미수행 — 스키마만 정의. 사용자 시점에 별도 plan 으로 활성화.
- skill rename (interview-company-prep) 은 본 plan 범위 외. 향후 별도 결정.

거절한 대안:

- 4 mode 각자 별도 skill — 중복 자산 4배. mvp-target.json 단일 진실원 원칙 무너짐.
- public-safe 산출물 inline 마커 + 후처리 split — Claude 프롬프트 정합 부담 ↑. 두 파일 동시 생성이 더 단순.
- coffeechat-prompt.md 4 파일 분리 — 중복 ↑. 단일 prompt 안에서 mode 분기.

### 결과

- CJ Foodville first-round 즉시 운영 가능.
- final_round / offer_chat 향후 활성화 비용 ↓ (스키마 + 트리거 분기 이미 준비).
- backward compat 100% — 기존 `/interview-coffeechat-prep` 호출 동작 동일.
- 단점: SKILL.md 본문 분기 비대화 가능성 — 4 mode 모두 동작 시 SKILL.md split 별도 plan 가능.

### 적용

- `_shared/lib/mvp_target_schema.ts` — `InterviewModeSchema` + `InterviewSchema` 추가.
- `career-os/config/mvp-target.json` — `primary.coffeechat` → `primary.interview.{coffeechat, first_round, ...}` 마이그 + first_round 본문 채움.
- `career-os/.claude/skills/interview-coffeechat-prep/SKILL.md` — mode 분기 본문.
- `career-os/.claude/skills/interview-coffeechat-prep/references/coffeechat-prompt.md` — first-round 가이드 + public-safe sanitize 규칙.
- `career-os/scripts/interview-coffeechat-prep/collect_company_sites.ts` — mode 인자 받음. 당시에는 coffeechat을 기본값으로 두었다.
- `career-os/tasks/plan026-interview-mode-generalization/` — 3 phase.

---

## ADR-035 — ts 헬퍼 모듈 분해 컨벤션 (source / transform / render / cli 4 레이어)

- Status: Accepted
- Date: 2026-05-19

### 맥락

career-os `scripts/<skill>/` 아래 ts 헬퍼들이 단일 파일에 외부 API fetch + 필터·정규화 + markdown 렌더링 + CLI 파싱 + 파일 IO 를 모두 응집한 *god-script* 구조.

대상 5 파일 총 2106 줄 (fos-claw#1):

- `study-topic-recommender/refresh_topic_inventory.ts` 1049 (plan025 후 +190)
- `position-recommender/collect_live_postings.ts` 412
- `study-topic-recommender/feed_discovery.ts` 314
- `interview-coffeechat-prep/collect_company_sites.ts` 186 (plan026 직후라 분해 후순위)
- `study-pack-writer/run_with_discord_notify.ts` 145 (가장 작음, 선택)

확장 비용:

- 새 source (예: 새 RSS feed / 새 채용 사이트) 추가 시 한 파일 전체 수정.
- 새 출력 포맷 추가 시 같은 파일.
- 단위 테스트 진입점 부재 — 순수 함수가 IO 와 섞여 격리 어려움.

### 결정

ts 헬퍼는 4 레이어로 분리. **god-script 신규 추가 금지**, 기존도 점진 분해.

4 레이어 책임:

- **source/** — 외부 API fetch 만. source 추가 시 여기에만 새 파일.
  - 예: `source/wanted.ts`, `source/toss.ts`, `source/rss.ts`.
- **transform/** — 필터 · 정규화 · dedupe · 스코어링 같은 *순수 함수*. 단위 테스트 진입점.
  - 예: `transform/filter_server.ts`, `transform/dedupe.ts`, `transform/score.ts`.
- **render/** — 마크다운 직렬화. 출력 포맷 변경 시 여기만.
  - 예: `render/markdown.ts`, `render/discord_message.ts`.
- **cli.ts** — 인자 파싱 + 위 3 레이어 조립 + 파일 IO. 진입점.

플레이스홀더 구조:

```
career-os/scripts/<skill>/
  source/{wanted.ts, toss.ts, ...}
  transform/{filter.ts, dedupe.ts, ...}
  render/markdown.ts
  cli.ts
```

`cli.ts` 위치는 기존 god-script 진입점과 동일 path 유지 — SKILL.md / 호출부 갱신 부담 최소.

거절한 대안:

- 한 파일 안에서 함수 그룹화 (분리 없음) — 확장 시 같은 파일 계속 비대. drift 위험 영구화.
- 5 파일 한 plan 에서 일괄 분해 — 한 사이클에 2106 줄 영향. critic 누적 위험.
- `_shared/lib` 승격으로 워크스페이스 무관 헬퍼화 — `_shared/lib` 자격 (ai-nodes ADR-001) 미충족. 워크스페이스 한정 도메인 로직.

### 결과

- god-script 5 파일 점진 분해 (plan027~plan031 시리즈, 한 plan = 한 파일).
- 새 source 추가 비용 ↓ — source/ 에 새 파일 1개.
- transform 단위 테스트 가능 — 순수 함수 격리.
- SKILL.md / 호출부 변경 0 — cli.ts 가 기존 진입점 path 유지.
- 단점:
  - 파일 수 증가 — `<skill>/` 안 4 디렉터리 (source / transform / render) + cli.ts.
  - 분해 plan 시리즈 진행 비용 — 5 plan × phase 3 = 15 phase.

### 적용

- 분해 plan 시리즈:
  - plan027 — refresh_topic_inventory.ts (1049 줄) — 최대 god-script 우선.
  - plan028 — collect_live_postings.ts (412 줄) — position-recommender hot path.
  - plan029 — feed_discovery.ts (314 줄) — RSS discovery.
  - plan030 — collect_company_sites.ts (186 줄) — plan026 후 1 cycle 이상 후.
  - plan031 — run_with_discord_notify.ts (145 줄) — 선택, 가장 작음.
- 각 plan 은 source / transform / render / cli 분해 후 god-script 위치 cli.ts 로 교체.
- 새 god-script 신규 작성 금지 — 새 헬퍼는 본 컨벤션 따름.

---

## ADR-036 — position-recommender daily freshness guard + recommendation rotation

- Status: Accepted
- Date: 2026-05-23

### 맥락

2026-05-23 10:00 daily position cron이 `claude -p "/position-recommender ..."`를 실행했지만 오늘 날짜 report를 만들지 못했고, 기존 `data/runtime/position-recommendation.md`의 2026-05-22 리포트를 다시 읽어 Discord에 전송했다. 또한 cron prompt에 특정 KakaoPay AX 우선 문구가 박혀 있어 같은 공고가 반복 상단 노출될 가능성이 컸다. `position-recommender` native skill에도 최근 추천 이력을 읽어 반복 후보를 감점하는 규칙이 없었다.

### 결정

- daily cron은 `scripts/position-recommender/run_daily_with_claude.sh`를 호출한다.
  - wrapper는 Claude native skill을 실행한 뒤 Asia/Seoul 오늘 날짜 report와 runtime 첫 줄을 검증한다.
  - 오늘 날짜 report가 없거나 runtime이 stale이면 cron 실패로 처리한다.
  - freshness check 통과 후 wrapper가 `_shared/lib/notify_discord.ts`를 호출한다.
  - Claude native skill 내부에서는 Discord 알림을 직접 보내지 않는다. 외부 전송은 runner/orchestrator 책임이다.
- `position-recommender` native skill은 최근 7일 `position-recommendation/report.md`를 읽고 반복 후보를 감점한다.
  - 반복 후보가 여전히 최상위면 유지 가능하지만 “반복 유지 사유”를 명시한다.
  - 매일 최소 1개 이상 최근 강력 추천에 없던 신규 후보 또는 추가 수집 대상을 포함한다.
- daily cron prompt에서 특정 KakaoPay AX 우선 문구를 제거한다.
  - 랭킹 기준은 active JD fit, 회사/규모 업사이드, 반복 여부, 도메인 전환 가치로 둔다.
- 기본 live posting 수집에서 Toss career article을 지원 가능한 공고로 섞지 않는다.
  - `--source toss` 또는 `--include-toss-articles`를 명시했을 때만 참고자료로 수집한다.

### 결과

- stale runtime 재전송을 조기에 차단한다.
- Claude 내부 interactive approval 때문에 Discord notify가 멈추는 문제를 피한다.
- 같은 공고 반복 추천을 줄이면서, 정말 좋은 후보는 이유를 붙여 유지할 수 있다.
- OpenClaw/runner는 오케스트레이션과 외부 전송을 담당하고, 실제 추천 작업은 Claude native skill이 수행한다.

---

## ADR-037 — application-flow-agent runtime은 policy decision engine 중심

- Status: Accepted
- Date: 2026-05-26

### 맥락

`plan029-application-agent-mvp`는 공고별 지원 패키지 작성, evidence/drift review, daily digest까지 구현했지만, 다음 행동을 스스로 결정하는 runtime은 없다. 현재 구조만으로는 "적절한 공고 없음 -> 더 찾기 또는 다음 주 재시도", "쿨다운/중복/마감 -> block/close", "review revise -> agent 수정 또는 evidence 수집", "제출 후 study loop 우선순위 상승" 같은 상태 기반 분기가 skill 호출 순서에 흩어진다.

`plan030-position-recommender-daily-freshness`는 stale 후보를 줄이는 선행 품질 개선이다. application-flow-agent 구현 계획이 아니라, 후보 ingest 전 freshness prerequisite로 참조한다. plan030은 폐기하지 않고 `sourceFreshness` 필드 검증 경로로만 참조한다.

ADR-035에는 TypeScript helper 분해 시리즈의 예시로 `plan031 — run_with_discord_notify.ts`가 적혀 있지만, 실제 `tasks/plan031-*` 디렉터리는 존재하지 않았다. 이 ADR에서는 실제 task 번호 `plan031`을 application-flow-agent에 배정하고, ADR-035의 해당 항목은 미실행 예시/후속 후보로만 취급한다.

### 결정

- `plan031-application-flow-agent`를 새 계획으로 연다.
- application-flow-agent는 단순 skill chain이 아니라 `state -> policy decision -> action -> validation -> state update` 루프다.
- Claude native skills는 tool로 재사용한다.
  - `/position-recommender`: 후보 source
  - `application-package-writer`: 지원 패키지 생성
  - `application-reviewer`: evidence/drift review
  - `daily-application-digest`: report
  - study/interview skills: private study/interview loop
- LLM은 분석, 작성, 추천 근거 생성을 맡고, 상태 전이 허용 여부와 next action 선택은 TypeScript `policy.ts` + validator가 결정한다.
- 기존 `status` enum은 큰 흐름으로 유지하고, 세부 agent 상태는 `agentPhase` optional field로 확장한다(12개 값 — phase-01 확정).
- 실제 제출, 외부 사이트 입력/전송, 계정 로그인, 공개 fos-study 발행, 원본 candidate-profile 수정은 사용자 승인 없이 수행하지 않는다.
- plan031 MVP의 submission assistant 범위는 Level 0이다. 제출 링크와 체크리스트까지만 생성한다. 브라우저 입력 자동화는 후속 plan/ADR로 분리한다.

#### agentPhase 확정 enum (phase-01)

`scouting` / `needs_more_search` / `no_good_match` / `scheduled_retry` / `actionable_candidate` / `generating_package` / `reviewing_package` / `collecting_evidence` / `revising_package` / `waiting_user_approval` / `study_loop` / `submission_checklist`

#### policy matrix 요약 (phase-01)

| 현재 status | 조건 | next agentPhase |
|---|---|---|
| `scouting` | candidate 0 + 검색량 부족 | `needs_more_search` |
| `scouting` | candidate 0 + 검색량 충분 | `scheduled_retry` |
| `discovered` | active + fit >= 70 | `generating_package` |
| `discovered` | closed/expired | status → `closed` |
| `discovered` | cooldown/duplicate | status → `blocked` |
| `preparing_application` | package exists | `reviewing_package` |
| `needs_revision` | revisionCount < max + agent-fixable | `revising_package` |
| `needs_revision` | evidence 부족 | `collecting_evidence` 또는 `waiting_user_approval` |
| `needs_revision` | revisionCount >= max | status → `blocked` |
| `ready_for_user_review` | — | `waiting_user_approval` |
| `approved` | — | `submission_checklist` |
| `submitted` / `interview_scheduled` | — | `study_loop` |

#### actionable candidate 기준 (phase-01)

fit score 70점 이상 + active + 비중복 + 비쿨다운 + 비만료 + sourceFreshness=fresh. 85점 이상은 high priority, 70-84점은 normal. 70점 미만은 study_loop 또는 hold.

#### 우선순위 큐 기본값

- 하루 신규 deep analysis 최대 2개.
- `ready_for_user_review`는 최대 3개까지만 쌓는다.
- 진행 중인 revise/review가 신규 탐색보다 우선한다.
- `interview_scheduled`가 있으면 study_loop 우선순위를 올린다.
- `blocked`는 `requiredUserAction` 또는 `nextRunAt`이 있는 경우만 재평가한다.

### 결과

- no actionable candidate, needs_more_search, scheduled_retry, blocked, ready_for_user_review, study_loop 분기를 코드 policy로 검증할 수 있다.
- plan029 산출물은 유지하고, 그 위에 runtime 계층을 추가한다.
- plan030은 폐기하지 않고 후보 freshness prerequisite(`sourceFreshness` 검증)로 남긴다.
- public/private boundary와 제출 승인 게이트가 TypeScript `actions.ts` allowlist에서 통제된다.
- 상태 전이 책임이 LLM이 아니라 TypeScript policy/validator에 있어 실행 결과가 코드 수준에서 검증된다.

### 적용

- `docs/flow.md` — agentPhase 상태 모델 + policy matrix + actionable candidate 기준 + 우선순위 큐 추가 (phase-01).
- `docs/data-schema.md` — agentPhase enum 확정 + 검증 규칙 추가 (phase-01).
- `docs/code-architecture.md` — 책임 매트릭스 + policy.ts 결정 흐름 추가 (phase-01).
- `scripts/application-agent/policy.ts` + `ledger_schema.ts` 확장 (phase-02 이후).
- `tasks/plan031-application-flow-agent/`.

---

## ADR-038 — application-flow-agent 상태 전이는 skill artifact 검증 뒤에만 수행

- Status: Accepted
- Date: 2026-06-04

### 맥락

2026-05-27 operation test에서 `run-once`가 `preparing_application -> needs_revision`으로 진행 가능한 결정을 만들었지만, 실제 `application-package-writer`와 `application-reviewer` 산출물은 아직 없었다. 이 구조는 의도한 `policy decision -> execute tool/skill -> validate artifacts -> state update` 루프가 아니라 `policy decision -> command suggestion -> ledger transition`에 가까워, 지원 패키지가 없는 상태에서도 ledger가 앞서갈 수 있었다.

### 결정

- `scripts/application-agent/actions.ts`에 execution gate를 둔다.
- 상태 전이를 동반하는 skill 기반 decision은 필수 산출물이 존재할 때만 ledger를 갱신한다.
  - `run_fit_analysis`: `fit-analysis.md`
  - `draft_application_package` / `revise_application_package`: `application-package.md`
  - `call_application_package_writer`: `application-package.md` + `review.md`
- 산출물이 없으면 decision log와 command suggestion은 남기되, ledger status/agentPhase는 변경하지 않는다.
- safety gate는 금지 action을 막고, execution gate는 아직 수행되지 않은 skill 결과를 근거로 한 false-positive 전이를 막는다.

### 결과

- `run-once`가 준비되지 않은 지원 건을 다음 상태로 넘기지 않는다.
- 실제 skill 실행 또는 산출물 생성 뒤 `resume <application-id>`로 같은 decision을 다시 검증할 수 있다.
- cron 등록 전 수동 운용 단계에서 false-positive 상태 전이를 줄인다.

---

## ADR-039 — position-recommender 추천 단위는 개별 active/open 공고

- Status: Accepted
- Date: 2026-06-04

### 맥락

사용자는 position-recommender가 단순히 "어떤 회사를 지원해보라"는 수준에 머물지 않고, 실제로 현재 올라온 구체적인 공고만 분석해 알려주기를 원한다. application-flow-agent와 `data/applications/ledger.jsonl`의 입력은 실제 지원 가능한 공고여야 하므로, 회사명·채용홈·기술블로그·뉴스 기반 lead가 추천 티어에 섞이면 후속 지원 패키지 자동화 품질이 떨어진다.

### 결정

- 강력 추천/도전 추천의 단위는 회사가 아니라 현재 열린 개별 채용공고다.
- 추천 티어에는 다음 조건을 만족하는 항목만 올린다.
  - 개별 공고 URL 존재
  - active/open 근거 존재
  - 서버/백엔드 정규직 JD fit 확인
- 회사 채용홈, 검색 페이지, 기술블로그, 뉴스, verified-company 목록은 추천 티어가 아니라 `추가 수집 대상`으로만 둔다.
- `collect_live_postings.ts` snapshot에 `link_type`, `posting_status`, `active_evidence`를 추가한다.
- daily runner는 Claude 호출 전에 `collect_live_postings.ts --source wanted`를 직접 실행해 최신 개별 공고 snapshot을 만든다.
- `run_daily_with_claude.sh`는 강력/도전 추천 항목에 직접 공고 링크와 개별 active/open 근거가 없으면 실패 처리한다.

### 결과

- position-recommender report가 application-flow-agent ingest에 더 적합한 입력이 된다.
- 좋은 회사 lead는 보존하되, 실제 지원 후보와 섞이지 않는다.
- Wanted URL은 API active 근거가 있을 때만 추천 티어에 들어간다.
- Claude Bash 승인 게이트 때문에 collector가 실행되지 않아 stale snapshot + 회사 lead 추천으로 흐르는 실패 모드를 줄인다.

---

## ADR-040 — application-flow-agent native skill 실행은 명시 옵션에서만 수행

- Status: Accepted
- Date: 2026-06-04

### 맥락

ADR-038로 `application-flow-agent`는 필수 산출물이 없으면 ledger 상태 전이를 막게 됐다. 다음 단계는 runner가 실제 `application-package-writer`와 `application-reviewer`를 실행해 산출물을 만든 뒤 같은 gate를 통과시키는 것이다. 다만 Claude native skill 실행은 비용과 시간, private 지원 문서 생성이라는 부작용이 있으므로 기본 동작으로 켜면 운용자가 dry-run/suggestion-only 흐름을 잃는다.

### 결정

- native skill 실행은 `--execute-skills` 명시 옵션에서만 수행한다.
- 실행 대상은 MVP에서 private agent-only skill로 제한한다.
  - `application-package-writer`
  - `application-reviewer`
- 쓰기형 native skill은 `claude --permission-mode acceptEdits -p ...`로 실행한다.
- `run_fit_analysis`, `draft_application_package`, `revise_application_package`는 `application-package-writer`를 실행한다.
- `call_application_package_writer`는 `application-package-writer` 후 `application-reviewer`를 순차 실행한다.
- skill 실행 후에도 ADR-038 execution gate가 필수 산출물을 다시 검증한다.
- revision 상태에서는 기존 package 존재만으로 전이하지 않고, `application-package.md`가 `review.md`보다 최신인지 확인한다.
- `study-pack-writer`, `interview-asset-writer`, `candidate-baseline-suggester`처럼 공개 발행/프로필 반영/사용자 승인 경계가 있는 skill은 자동 실행 대상에서 제외한다.

### 결과

- 기본 `run-once`/`run-daily`는 계속 command suggestion only로 안전하게 동작한다.
- 사용자가 명시적으로 `--execute-skills`를 붙이면 runner가 package/review 산출물을 만들고, 검증 통과 시 ledger를 이어서 갱신한다.
- reviewer가 `revise`를 낸 뒤에는 수정된 package가 review보다 최신이어야 다음 revision 전이가 가능하다.
- 실제 제출, 로그인, 브라우저 입력, fos-study 발행은 여전히 자동화하지 않는다.

---

## ADR-041 — application-flow-agent 실행 진행 상황은 명시 옵션으로 Discord에 알린다

- Status: Accepted
- Date: 2026-06-04

### 맥락

`--execute-skills`는 실제 Claude native skill을 실행하므로 몇 분 동안 외부에서 진행 상황이 보이지 않는다. 사용자는 내부 블랙박스 영역에서 어떤 단계가 돌고 있는지 인지할 필요가 있다. 동시에 지원 패키지와 리뷰 본문은 private 전략 자산이므로 Discord 알림에 그대로 노출하면 안 된다.

### 결정

- `--notify-discord` 명시 옵션을 추가한다.
- 알림은 `--execute-skills` 실제 실행에서만 의미 있게 보낸다. dry-run에서는 보내지 않는다.
- 알림 범위는 private-safe progress 정보로 제한한다.
  - decision 시작
  - skill 시작/완료/실패
  - 산출물 누락
  - ledger 갱신 완료
  - execution gate 대기
- 알림에는 지원 패키지 본문, 이력서 bullet 상세, private strategy note, review 상세 지적을 포함하지 않는다.
- Discord 알림 실패는 runner 본 작업 실패로 전파하지 않고 warning으로만 남긴다.

### 결과

- 사용자는 장기 실행 중 현재 단계와 실패 지점을 빠르게 알 수 있다.
- application-agent는 기존처럼 CLI stdout에도 상세 결과를 남긴다.
- Discord 채널에는 민감한 지원 전략 대신 진행 상태만 노출된다.

---

## ADR-042 — reviewer pass 판정은 사용자 검토 대기 상태로 전환한다

- Status: Accepted
- Date: 2026-06-04

### 맥락

실제 당근페이 Backend application 실행에서 `application-reviewer`가 `result: pass`를 냈지만, 기존 policy는 `needs_revision` 상태만 보고 다시 `revise_application_package`를 제안했다. 또한 revision 단계에서 기존 `application-package.md`가 존재한다는 이유로 package-writer가 skip되어 stale review/package 루프가 풀리지 않는 문제가 있었다.

### 결정

- `needs_revision`에서 `application-package.md`가 `review.md`보다 오래되었거나 같은 시간이면 기존 package가 있어도 `application-package-writer`를 다시 실행한다.
- `preparing_application`에서 `review.md`가 package보다 오래되면 `application-reviewer`를 다시 실행한다.
- policy는 `review.md`의 `- result: pass`를 읽고, pass면 `review_pass_ready_for_user` decision으로 `ready_for_user_review`에 전환한다.
- `ready_for_user_review` 이후에는 기존 user approval gate가 적용되어 실제 제출은 자동화하지 않는다.

### 결과

- reviewer pass 이후 revision 루프가 반복되지 않는다.
- 사용자는 최종 패키지와 review를 보고 제출 여부를 결정할 수 있다.
- stale artifact gate와 pass verdict gate가 함께 작동해 package/review 순서를 유지한다.

---

## ADR-043 — position-recommender 공고 수집은 source adapter + active validator로 분리

- Status: Accepted
- Date: 2026-06-05

### 맥락

ADR-039로 추천 단위는 개별 active/open 공고로 고정됐다. 그러나 현재 수집기는 Wanted detail 검증과 렌더링이 단일 파일에 응집돼 있고, Toss는 커리어 아티클 feed가 먼저 노출되어 개별 공고와 혼동될 수 있다. 사용자는 정적 도구가 공고 활성 여부를 먼저 검증하고, LLM은 후보자 fit 판단만 맡는 구조를 원한다.

### 결정

- `collect_live_postings.ts`는 source adapter 계층과 공통 active validator 계층으로 분리한다.
- adapter는 구조화된 public endpoint나 SSR data에서 개별 공고 URL, active/open 근거, JD, 지원 가능 근거, 마감 정보를 수집한다.
- validator는 `link_type=direct_posting`, `posting_status=active/open`, active evidence, backend/server 필터, 계약직/인턴 제외, 마감 임박도를 공통으로 적용한다.
- Toss는 career article 자체를 공고로 쓰지 않는다. article CTA에서 `job-detail` URL을 따라가고, job detail page의 JD와 지원 폼이 확인된 항목만 open 공고로 채택한다.
- `opened_at`처럼 값이 없는 필드는 snapshot에서 생략한다. 마감 판단에 필요한 `closes_at`, `days_until_close`, `close_urgency`는 유지한다.
- LLM은 active/open 여부를 추정하지 않는다. LLM 입력은 validator를 통과한 snapshot으로 제한하고, LLM은 fit, upside, gap, 준비 액션만 판단한다.

### 결과

- Toss를 포함한 공식 career 수집을 확장해도 커리어 아티클, 회사 홈, 검색 페이지가 추천 티어에 섞이지 않는다.
- source별 수집 실패와 active 검증 실패를 diagnostics로 남길 수 있다.
- application-flow-agent ingest로 넘길 후보의 품질이 높아진다.
- public endpoint 또는 SSR schema가 바뀌면 해당 adapter만 수정하면 된다.

### 적용

- `scripts/position-recommender/collect_live_postings.ts`의 source/validate/render 분리.
- `data/runtime/live-position-postings.md` snapshot schema.
- `scripts/position-recommender/run_daily_with_claude.sh` active-only gate.
- `tasks/plan037-position-recommender-source-adapters/`.

---

## ADR-044 — 큰 변경은 planning → delegated implementation → main-session verification으로 운영

- Status: Accepted
- Date: 2026-06-05

### 맥락

career-os는 position-recommender, study-topic-recommender, interview-prep, application-flow-agent처럼 여러 자동화 흐름이 연결돼 있다. 사용자는 애매한 결정이 구현 중에 묻히지 않고, 계획과 의사결정이 문서로 남으며, 구현은 Claude/subagent에게 맡기더라도 메인 세션이 최종 품질을 검증하는 운영 방식을 원한다.

plan037에서 실제로 `Toss active job-detail adapter + source adapter 구조화 + validation gate 강화`를 진행하며 이 패턴을 검증했다. Claude가 phase 구현을 일부 수행했지만 timeout과 품질 이슈가 있었고, 메인 세션이 diff 확인, 직접 패치, build/smoke, active-only leak check, runner validation, 실제 수집 품질 검토를 수행한 뒤 완료 처리했다.

### 결정

- 30분 이상 걸리거나 여러 파일/흐름/정책을 건드리는 큰 변경은 먼저 `skills/planning` 흐름으로 목표, 범위, 결정사항, 열린 질문, phase를 정리한다.
- 합의된 plan은 `tasks/plan{N}-<slug>/index.json`과 phase 파일로 남긴다.
- 정책 또는 구조 결정은 `docs/adr.md`에 누적한다. 5문서 영향이 있으면 `docs/flow.md`, `docs/code-architecture.md`, `docs/data-schema.md` 등에도 반영한다.
- 구현은 가능한 경우 `skills/plan-and-build` 또는 Claude 비대화형 phase 실행에 위임한다.
- Claude/subagent 구현 결과는 바로 신뢰하지 않는다. 메인 세션이 다음 gate를 직접 수행해야 한다.
  - 관련 `git diff` 확인
  - build/test/smoke 실행
  - 정책 grep 또는 validator 실행
  - runner syntax/freshness/validation gate 실행
  - 외부 API나 수집기 변경은 실제 실행 결과와 diagnostics 검토
- 새 collector/source adapter/cron 기본값은 구현 직후 daily 기본값으로 켜지 않는다. 먼저 shadow 실행 또는 명시 옵션으로 2-3일 관찰하고, 수집량·품질·실패 모드가 안정적이면 별도 결정으로 기본값 전환한다.
- dirty worktree에서는 commit/push를 보류한다. unrelated 변경을 포함해 커밋하지 않고, 관련 diff와 검증 결과만 보고한다.

### 결과

- 사용자의 비즈니스/커리어 기준 결정과 코드 구현이 분리된다.
- Claude가 만든 변경이 정책을 깨거나 품질이 낮아도 메인 세션 gate에서 걸러진다.
- 채용 공고 수집처럼 외부 상태에 민감한 기능은 build 통과만으로 완료 처리하지 않고 실제 수집 품질까지 확인한다.
- 이후 큰 작업도 동일한 방식으로 재현 가능하며, 다음 에이전트는 `AGENTS.md`, `tasks/`, `docs/adr.md`만 읽어도 운영 방식을 복원할 수 있다.

---

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

---

## ADR-046 — fos-career 웹 대시보드를 별도 저장소로 분리한다

- Status: Accepted
- Date: 2026-06-06

### 맥락

career-os 자동화 데이터(frontdoor queue, ledger, position recommendation, candidate profile)를 브라우저에서 읽고 LLM과 채팅으로 해석할 수 있는 대시보드가 필요하다.
career-os 자체는 에이전트/데이터/자동화의 진실 출처로 유지하면서, 사람이 보는 웹 제품 계층을 별도 저장소로 분리한다.

### 결정

- 웹 대시보드 저장소는 `~/services/fos-career`에 생성한다.
- career-os(`~/ai-nodes/career-os/`)는 에이전트/데이터/자동화 진실 출처를 유지한다.
- fos-career는 human-facing 웹 제품이다.
- fos-career는 career-os 파일을 읽기 전용 마운트(`/data/career-os`)로만 읽는다.
  - 환경 변수: `CAREER_OS_ROOT=/data/career-os`.
  - fos-career가 career-os 파일에 쓰거나 수정하는 것을 금지한다.
- 기술 스택: Next.js 15 App Router, MySQL, Docker 이미지, 홈서버 역방향 프록시(기존 npm/Node 웹서버) 뒤에 배포.
- 관리자 로그인: ID/password 방식. 단일 관리자 계정.
- MySQL 소유 데이터: admin 계정/인증/세션, LLM 채팅 이력, audit log, action history.
  - career-os ledger, materials, frontdoor queue는 MySQL로 마이그레이션하지 않는다.
  - 프로그레시브 마이그레이션은 별도 승인된 결정에서 다룬다.
- MVP 쓰기 범위: 읽기 전용 대시보드 + LLM 채팅.
  - prepare-start/hold/reject 같은 버튼은 별도 승인된 쓰기 phase에서 다룬다.

### 결과

- career-os는 자동화 워크플로를 그대로 유지한다. fos-career 도입으로 career-os 스크립트/skill/cron이 바뀌지 않는다.
- fos-career는 career-os 파일을 읽기만 하므로 대시보드 버그가 career-os 데이터를 오염시키지 않는다.
- MySQL은 fos-career가 직접 소유하는 데이터(세션, 채팅 이력, audit)에만 쓴다. career-os 데이터 이중화가 없다.
- Docker 이미지로 배포하면 기존 역방향 프록시 설정을 최소로 바꾸면서 새 서비스를 올릴 수 있다.

### 적용

- `tasks/plan039-fos-career-dashboard/` — 구현 계획 5 phase.
- fos-career 저장소는 phase-01 구현 시 생성한다.
- ADR-045 frontdoor queue/ledger 분리가 이 대시보드의 읽기 입력을 정의한다.

---

## ADR-047 — position-recommender collector adapter를 모듈 경계로 승격한다

- Status: Accepted
- Date: 2026-06-06

### 맥락

`scripts/position-recommender/collect_live_postings.ts`는 ADR-043 이후 source adapter와 active validator 개념을 갖췄지만, 실제 파일은 Wanted 수집, Toss 수집, 공통 역할 필터, active validator, markdown renderer, CLI 처리가 한 파일에 모여 있다.
새 채용 source를 추가하기 전에 물리적 모듈 경계를 만들지 않으면 source별 HTML/API 파싱과 공통 정책이 다시 섞일 가능성이 높다.

또한 사용자는 추천 판단을 LLM에 최대한 맡기고 싶다고 명시했다. 따라서 collector는 "지원 가능한 active/open 개별 공고 후보"를 깨끗하게 만드는 역할까지만 담당하고, 순위·fit/gap·커리어 서사 판단은 LLM 기반 position-recommender가 맡는다.

### 결정

- `collect_live_postings.ts`는 기존 CLI 호환을 유지하는 얇은 entrypoint로 축소한다.
- collector 구현은 `scripts/position-recommender/live-postings/` 아래로 분리한다.
  - `types.ts` — `Posting`, `SourceAdapter`, `CollectContext`, `CollectResult`.
  - `policy.ts` — 수집 가능성 필터. 서버/AI 실무 개발 역할, 계약직/인턴/비서버 직군 제외, 제외 회사 필터만 담당한다.
  - `active-validator.ts` — `link_type=direct_posting`, `posting_status=active/open`, active evidence 같은 snapshot gate.
  - `render.ts` — markdown snapshot 출력만 담당한다.
  - `cli.ts` — arg parsing, adapter 실행, 파일 쓰기.
  - `adapters/wanted.ts`, `adapters/toss.ts`, `adapters/index.ts` — source별 수집과 registry.
- 이번 plan에서는 새 source를 추가하지 않는다. Wanted/Toss 동작 보존과 구조 분리에 집중한다.
- 새 source 추가는 후속 plan에서 adapter만 추가하는 방식으로 진행한다.
- 구현 phase는 `career-os/docs/adr.md`, `docs/code-architecture.md`, `docs/flow.md`를 수정하지 않는다. 구현 중 docs drift가 발견되면 phase는 `PHASE_BLOCKED`로 멈추고 메인 세션에서 planning/docs를 다시 조정한다.

### 결과

- Wanted/Toss 수집 로직을 독립적으로 변경·검증할 수 있다.
- KakaoPay, KakaoPay Securities, Greenhouse, Lever 같은 source는 후속 plan에서 adapter 단위로 추가 가능하다.
- collector가 추천 판단까지 과하게 떠안지 않고, LLM 추천 흐름과 책임 경계가 분명해진다.
- daily runner는 기존 `collect_live_postings.ts` 경로를 계속 호출하므로 cron 진입점 변경이 작다.

### 적용

- `tasks/plan040-position-recommender-collector-modularization/` — 구현 계획 5 phase.
- `docs/code-architecture.md` — collector 모듈 구조.
- `docs/flow.md` — position-recommender 수집 흐름.

---

## ADR-048 — coffeechat 자동화는 폐기하고 면접 준비 기능만 이관한다

- Status: Accepted
- Date: 2026-06-06

### 맥락

`interview-coffeechat-prep`는 CJ Foodville coffeechat 준비에서 출발했고, 이후 ADR-034에서 coffeechat / first-round / final-round / offer-chat 4 mode로 일반화됐다.
그러나 coffeechat은 회사마다 목적, 참석자, 평가 방식, 공식성 수준이 크게 다르다. 이를 공통 자동화로 구조화하면 "coffeechat은 이런 자리"라는 과잉 일반화가 생기고, 사용자가 확인하지 않은 면접 맥락을 에이전트가 추정할 위험이 있다.

반면 first-round, final-round, offer 관련 준비에는 여전히 재사용 가능한 기능이 있다. 회사/직무 리서치, 후보자 경험 매핑, 예상 질문, 역질문, 답변 점검은 `interview-prep-analyzer` 계열로 이관하는 편이 더 명확하다.

### 결정

- coffeechat-specific 자동화와 prompt/reference를 active workflow에서 폐기한다.
- `interview-coffeechat-prep`를 새 작업의 기본 진입점으로 쓰지 않는다.
- position-recommender 등 다른 skill에서 "커피챗 전략 리포트"를 자동 라우팅하지 않는다.
- 필요한 면접 준비 기능은 `interview-prep-analyzer`로 이관한다.
  - first-round: 회사/비즈니스 분석, 역할·팀 전략, 후보자 포지셔닝, 예상 질문, 역질문.
  - final-round/offer: 필요 시 별도 mode 또는 context로 확장하되 coffeechat 전제는 사용하지 않는다.

- 과거 coffeechat 산출물과 task/ADR은 history로 보존한다. 단, AGENTS/SKILL/flow의 active path에서는 제거하거나 deprecated tombstone만 남긴다.

### 결과

- 새 에이전트가 coffeechat을 표준화된 평가 이벤트로 오해할 가능성이 줄어든다.
- 면접 준비 기능은 더 일반적인 `interview-prep-analyzer` 책임으로 모인다.
- 회사별 비공식 대화는 자동 리포트 생성보다 사용자 확인 질문을 먼저 하는 방식으로 처리한다.

### 적용

- `tasks/plan041-interview-coffeechat-deprecation/` — 구현 계획.
- `interview-prep-analyzer` — 필요한 면접 준비 기능 이관 대상.
- `interview-coffeechat-prep` — active workflow 폐기 대상.

---

## ADR-049 — fos-career LLM 채팅은 provider interface 뒤에서 SDK를 교체한다

- Status: Accepted
- Date: 2026-06-06

### 맥락

`plan039-fos-career-dashboard`의 채팅 API는 MVP에서 Anthropic SDK를 route 안에서 직접 호출했다.
사용자는 현재 활용 중인 Codex/OpenAI 계열 LLM으로 갈 수 있되, 나중에 SDK가 바뀔 수 있으므로 LLM API를 교체 가능한 인터페이스로 두길 원했다.

### 결정

- fos-career는 `lib/llm/` 아래에 LLM provider 계약을 둔다.
- `app/api/chat/route.ts`는 특정 SDK를 직접 import하지 않고 provider interface만 호출한다.
- 현재 운영 provider는 `LLM_PROVIDER=openai`로 고정하고 OpenAI Responses API를 사용한다.
- Anthropic 같은 다른 SDK는 지금 활성 provider로 두지 않는다. 나중에 필요하면 `LlmProvider.streamText()` 계약을 만족하는 새 provider로 추가한다.
- 모델은 `LLM_MODEL`로 지정하고, 비어 있으면 provider별 기본값을 사용한다.
- provider/model은 채팅 audit log details에 남긴다.
- LLM provider 변경은 career-os 읽기 전용 경계, 외부 행동 금지, MySQL chat history 저장 정책을 바꾸지 않는다.

### 결과

- OpenAI/Codex 계열을 현재 기본 실행 경로로 사용한다.
- 후속 SDK 구현을 같은 `streamText()` 계약으로 교체할 수 있다.
- Codex/OpenAI 계열로 전환할 때 chat route와 DB 저장 흐름을 크게 바꾸지 않아도 된다.
- provider 설정이 누락되면 채팅 응답에 설정 오류를 반환하고, career-os 파일에는 쓰지 않는다.

### 적용

- `tasks/plan042-fos-career-llm-provider-interface/`
- `~/services/fos-career/lib/llm/`
- `~/services/fos-career/app/api/chat/route.ts`

---

## ADR-050 — fos-career 로그인은 관리자 shell 안의 content 영역으로 렌더링한다

- Status: Accepted
- Date: 2026-06-06

### 맥락

`plan039-fos-career-dashboard`의 MVP 로그인 화면은 기능 우선으로 만들었고, 이후 임시 스타일 보강이 독립형 중앙 로그인 화면으로 적용됐다.
사용자는 로그인도 관리자 화면의 head와 내비게이션 맥락이 살아 있는 상태에서 내부 content 영역에 표시되길 원했다.

### 결정

- fos-career 로그인 화면은 독립 랜딩처럼 보이지 않게 한다.
- 인증 전에도 관리자 shell의 head/nav 계열 시각 구조는 유지한다.
- 실제 데이터 메뉴는 인증 전 접근 가능한 것처럼 보이지 않도록 disabled 또는 제한 상태로 표시한다.
- 로그인 폼은 shell 내부 content 영역에 배치한다.
- 이번 결정은 UI shell과 로그인 렌더링만 다룬다. 인증 정책, 세션 만료 정책, agent 실행 권한은 변경하지 않는다.

### 결과

- 사용자가 로그인 전후에 같은 제품 안에 있다는 맥락을 유지한다.
- dashboard와 auth 화면의 시각 언어가 맞춰진다.
- 후속 dashboard write action이나 agent backend action gate를 붙일 때 auth shell 경계가 더 명확해진다.

### 적용

- `tasks/plan043-fos-career-auth-shell-login/`
- `~/services/fos-career/app/(auth)/login/page.tsx`
- 필요 시 `~/services/fos-career/app/dashboard/layout.tsx`의 shell 패턴을 재사용한다.

---

## ADR-051 — target source coverage는 adapter-owned entrypoint로 확장한다

- Status: Accepted
- Date: 2026-06-07

### 맥락

`position-recommender` 수집기는 Wanted broad scan과 Toss 일부 수집을 갖췄지만, 사용자가 실제로 챙기고 싶은 target posting은 official careers나 확인된 target URL에 더 자주 있다.
대시보드는 broad Wanted 결과만 보여주면 사용자의 실제 우선순위와 어긋날 수 있다.

ADR-047로 collector는 source adapter 단위로 분리됐다.
따라서 새 source를 seed 파일로 따로 흩뜨리기보다, source별 entrypoint와 known target URL은 해당 adapter가 소유하는 편이 drift를 줄인다.

### 결정

- Wanted broad scan은 유지한다.
- configured source set의 `all`은 등록된 모든 source를 뜻한다.
- Toss는 configured source set이 `all`이면 포함한다.
- KakaoPay official careers/GreetingHR와 KakaoPay Securities official careers를 primary source로 추가한다.
- Wanted URL/detail verification은 secondary path로 지원한다.
  source key는 `wanted`를 유지하고, discovery mode로 `broad`와 `target-url`을 구분한다.
- 별도 seed 파일은 만들지 않는다.
  각 source adapter가 entrypoint, known target URL, source-local seed를 소유한다.
- 모든 official listing과 seed 후보는 import 전에 detail page를 fetch하고 active/open evidence를 기록해야 한다.
- 한 source가 실패해도 성공한 source의 결과는 계속 import와 dashboard 표시로 이어진다.
- dedupe/upsert는 URL을 우선하고, URL이 불안정할 때 hash를 보조로 쓴다.
- 대시보드는 source filter와 brief diagnostics를 보여준다.
  상세 실패는 runtime output에 남긴다.

### 결과

- 사용자가 실제로 관심 있는 KakaoPay, KakaoPay Securities, Toss, Wanted target URL 후보가 broad scan 뒤에 묻히지 않는다.
- source별 fetch 방식과 target URL 소유권이 adapter 내부에 머물러 새 source 추가 비용이 작다.
- dashboard는 source별 coverage 상태를 짧게 보여주되, 실패 원문과 디버깅 상세는 collector runtime에 남긴다.
- 단점: adapter 내부에 source-local seed가 들어가므로 target URL 변경 시 코드 리뷰가 필요하다.

### 적용

- `tasks/plan048-target-source-coverage-dashboard/` — 구현 계획.
- `scripts/position-recommender/live-postings/adapters/` — source adapter와 registry.
- `docs/code-architecture.md` — collector module responsibility.
- `docs/flow.md` — source collection and dashboard display flow.
- `docs/data-schema.md` — live posting snapshot and diagnostics fields.

---

## ADR-052 — 지원 우선순위는 회사 순위가 아니라 action stage로 관리한다

- Status: Accepted
- Date: 2026-06-07

### 맥락

plan048 이후 `position-recommender`는 사용자가 실제로 챙기고 싶은 active/open 공고를 더 잘 모을 수 있게 됐다.
다음 문제는 collected posting을 "어느 회사가 더 좋은가"라는 고정 순위로만 다루지 않고, 지금 무엇을 해야 하는지로 연결하는 것이다.

사용자는 절대적인 회사 선호 순위보다 지원 준비 행동을 관리하고 싶어 한다.
또한 LLM 추천은 매 실행마다 바뀔 수 있으므로, LLM이 만든 추천 초안과 사용자가 최종 확인한 우선순위는 같은 필드에 덮어쓰면 안 된다.

### 결정

- priority는 회사 ranking이 아니라 action-oriented stage로 저장한다.
  - 기본 stage: `prepare-now`, `investigate`, `monitor`, `low-priority`, `hold`, `excluded`.
  - 사용자 표시가 필요하면 `prepare-now=1`, `investigate=2`, `monitor=3`, `low-priority/hold/excluded=4`로 매핑한다.
- LLM은 `recommendation_snapshot`을 생성한다.
  이 snapshot은 `priority_rank`, `action_stage`, `priority_reason`, `next_action`, `risk_flags`, `evidence_urls`, `posting_analysis`, `fit_summary`, `gap_summary`, `preparation_actions`를 포함할 수 있다.
- 사용자가 확정한 값은 `user_confirmed_priority`에 별도로 저장한다.
  LLM refresh는 이 필드를 덮어쓰지 않는다.
- collected posting은 다음 순서로 분석한다.
  1. posting analysis: 공고 상태, 역할, 요구 역량, 마감/지원 경로, evidence URL.
  2. fit analysis: `config/candidate-profile.md`, 기존 resume/profile material, 공고별 application files를 재사용한다.
  3. gap analysis: 부족 근거, 준비 필요 기술, interview/study asset 연결.
  4. priority recommendation: action stage와 next action 초안.
  5. preparation actions: 지원 패키지, 면접 준비, study pack 후보.
- 새 generator를 먼저 만들기보다 기존 자산을 재사용한다.
  - plan048 collected postings와 active/open evidence.
  - `config/candidate-profile.md`와 기존 resume/profile material.
  - application-agent ledger/frontdoor/application package/review 파일.
  - prior recommendation reports와 manual active-open URLs.
  - 기존 study pack / interview asset workflow.
- dashboard는 priority badge/filter, fit summary, gap summary, next action, priority change history를 보여준다.
  user-confirmed priority write action은 별도 승인된 단계에서만 다룬다.

### 결과

- 매일 바뀌는 LLM 추천과 사용자가 확정한 진행 우선순위가 분리된다.
- "1순위 회사"보다 "지금 준비", "조사", "모니터링", "보류", "제외" 같은 행동 중심 운영이 가능해진다.
- 기존 application-agent와 dashboard 흐름을 버리지 않고 그 위에 priority layer를 얹는다.
- 단점: recommendation snapshot과 user-confirmed priority의 병합 규칙이 필요하며, UI는 두 값의 차이를 명확히 보여줘야 한다.

### 적용

- `tasks/plan050-position-priority-fit-workflow/` — 구현 계획.
- `docs/data-schema.md` — priority/action fields and history.
- `docs/flow.md` — collected postings to analysis/priority/preparation flow.
- `docs/code-architecture.md` — existing asset reuse boundary.
- `docs/prd.md` — position priority workflow planned scope.

---

## ADR-053 — priority write action은 pending request bridge로 처리한다

- Status: Accepted
- Date: 2026-06-07

### 맥락

plan052까지 fos-career는 career-os priority list와 detail을 읽기 전용으로 보여준다.
다음 단계는 사용자가 dashboard에서 action stage와 rank를 확인하고 확정할 수 있게 만드는 것이다.

하지만 fos-career는 career-os를 read-only mount로 읽도록 배포되어 있다.
이 경계를 깨고 dashboard container가 `frontdoor-queue.jsonl`이나 `ledger.jsonl`을 직접 쓰면 UI bug, auth bug, stale 화면 제출이 곧 원장 오염으로 이어질 수 있다.

career-os 쪽에는 이미 `scripts/application-agent/run.ts confirm-priority` 경로가 있다.
이 command는 `userConfirmedPriority`를 설정하고 `_priority-history.jsonl`에 append-only 이력을 남긴다.
따라서 새 쓰기 경로는 이 command를 우회하지 않아야 한다.

### 결정

- fos-career는 priority write action을 직접 적용하지 않고 MySQL `priority_action_requests` pending queue에 저장한다.
- dashboard는 요청 생성 전에 record type, record id, action stage, rank, reason을 사용자에게 확인시킨다.
- 요청 row에는 요청 당시 career-os record snapshot을 저장한다.
  적용 runner는 현재 record와 snapshot을 비교해 stale request를 막는다.
- career-os 파일 mutation은 writable checkout에서 실행되는 controlled runner만 수행한다.
  runner는 기존 `application-agent confirm-priority` command를 사용한다.
- 적용 결과는 career-os `_priority-history.jsonl`과 fos-career request status 양쪽에 남긴다.
- 되돌림은 history 삭제나 JSONL rewrite가 아니라 새 user confirmation event로 처리한다.

거절한 대안:

- career-os HTTP API service: 인증, 네트워크 노출, long-running 운영 비용이 MVP보다 크다.
- dashboard container writable mount: read-only safety boundary를 깨며 실수의 blast radius가 크다.
- fos-career direct JSONL writer: career-os schema validation과 priority history helper를 우회한다.
- LLM chat tool call mutation: 사용자 확인, idempotency, rollback 검증이 흐려진다.

### 결과

- fos-career는 사람용 UI와 요청 감사 이력을 맡고, career-os는 실제 원장 mutation을 계속 소유한다.
- read-only mount 배포 가정이 유지된다.
- pending queue가 생겨 적용 전 검토, stale 감지, 실패 재시도, 취소가 가능하다.
- 단점: request 생성과 적용이 분리되어 즉시 반영 UI보다 한 단계 느리다.
  대신 안전성과 회복 가능성을 우선한다.

### 적용

- `tasks/plan053-priority-write-action-design/` — 구현 계획.
- `docs/prd.md` — priority write-action bridge planned scope.
- `docs/data-schema.md` — fos-career `priority_action_requests` schema.
- `docs/flow.md` — request creation and controlled application flow.
- `docs/code-architecture.md` — read-only mount and controlled runner boundary.

---

## ADR-054 — fos-career의 다음 제품 축은 application workbench다

- Status: Accepted
- Date: 2026-06-07

### 맥락

plan039부터 plan053까지 fos-career는 수집 공고, source diagnostics, priority list/detail, priority write request를 보여주는 방향으로 성장했다.
하지만 사용자가 실제로 필요한 다음 단계는 "어떤 공고가 수집됐는가"보다 "어떤 지원 준비가 어디까지 됐고 지금 무엇을 해야 하는가"이다.

현재 applications 화면은 ledger record와 raw file contents를 확인할 수 있지만, 준비 상태, 산출물 완성도, 다음 행동, 차단 사유를 제품의 중심으로 보여주지는 않는다.
따라서 fos-career의 다음 기능 축은 collection dashboard가 아니라 application preparation workbench여야 한다.

### 결정

- fos-career는 frontdoor queue와 ledger를 합쳐 application workbench projection을 제공한다.
- projection은 read-only로 계산한다.
  fos-career MySQL에 새 원장을 만들지 않고, career-os 파일도 수정하지 않는다.
- 각 후보는 stage, status, fit score, material readiness, next action, blocker/risk flag를 한 화면에서 보여준다.
- material readiness는 posting, fit analysis, application package, review 파일 존재 여부에서 계산한다.
- application detail 화면은 raw record dump보다 준비 진행 상태와 다음 행동을 우선 노출한다.
- 쓰기 행동이 필요하면 plan053과 같은 pending request bridge를 먼저 설계한다.

거절한 대안:

- 현재 collected posting dashboard만 계속 확장하기.
  공고 수집 상태는 보이지만 지원 준비 행동으로 이어지는 정보 구조가 약하다.
- fos-career MySQL에 application status 원장을 새로 만들기.
  MVP에서는 career-os ledger/frontdoor와 이중 원장이 생기고 정합성 비용이 커진다.
- dashboard에서 지원 패키지를 직접 생성/수정하기.
  사용자 승인, 공개 발행, candidate-profile mutation 경계가 섞인다.
- 외부 채용 사이트 제출 자동화까지 workbench MVP에 포함하기.
  위험과 검증 비용이 커서 별도 승인된 plan으로 분리해야 한다.

### 결과

- fos-career의 사람용 화면은 수집/추천 확인에서 실제 준비 운영 화면으로 확장된다.
- career-os는 계속 데이터와 mutation의 진실 출처로 남는다.
- 준비 산출물 누락과 다음 행동이 한 화면에 드러나므로, 자율 agent가 다음 task를 고르기 쉬워진다.
- 단점: readiness projection 계산 규칙이 필요하며, frontdoor record와 ledger record의 상태 표현을 UI에서 명확히 분리해야 한다.

### 적용

- `tasks/plan054-fos-career-application-workbench/` — 구현 계획.
- `docs/prd.md` — application workbench planned scope.
- `docs/data-schema.md` — workbench projection shape.
- `docs/flow.md` — read-only workbench flow.
- `docs/code-architecture.md` — adapter/UI responsibility boundary.

---

## ADR-055 — background worktree는 완료 시 명시적으로 정리한다

- Status: Accepted
- Date: 2026-06-07

### 맥락

긴 구현 phase와 병렬 작업을 main worktree에서 분리하기 위해 별도 git worktree를 사용한다.
이 방식은 unrelated dirty state를 피하는 데 유용하지만, 완료된 worktree 디렉터리가 남으면 현재 active 작업과 과거 작업의 경계가 흐려진다.

### 결정

- background worker가 별도 worktree를 만들었다면 완료/중단 보고 전에 worktree cleanup을 완료 조건으로 다룬다.
- 제거 전 `git -C <worktree> status --short`로 남은 변경이 없는지 확인한다.
- clean worktree는 `git worktree remove <worktree>`로 명시적으로 제거한다.
- dirty worktree는 제거하지 않고 남은 변경과 경로를 보고한다.
- worktree 디렉터리 제거와 branch 삭제는 분리한다.
  branch는 review, 비교, 복구에 필요할 수 있으므로 기본적으로 삭제하지 않는다.

### 결과

- main workspace 주변에 오래된 `ai-nodes-worktrees/*` 디렉터리가 누적되지 않는다.
- 완료 보고에는 worktree/branch 사용 여부와 cleanup 결과가 포함된다.
- branch 보존과 디렉터리 정리를 분리해 복구 가능성을 유지한다.

---

## ADR-056 — resume package는 Markdown 산출물 계약을 먼저 고정한다

- Status: Accepted
- Date: 2026-06-07

### 맥락

plan031 application-flow-agent, plan038 frontdoor queue, plan054 application workbench가 완료되면서 지원 준비 흐름은 화면과 원장을 갖췄다.
하지만 다음 단계인 맞춤 이력서 생성에서는 경계가 흐리다.

현재 `application-package.md`는 지원 전략, 이력서 문장, 지원동기, 검토 요청이 섞일 수 있다.
이 상태에서 바로 dashboard action이나 export를 붙이면 내부 분석과 제출용 문구가 섞이고, `needs_evidence`가 해결되지 않은 채 제출 초안에 남을 수 있다.

### 결정

- plan055를 `resume package flow`로 연다.
- Markdown 산출물 계약을 먼저 고정한다.
  PDF/DOCX export는 당시 후속 plan으로 두었다.
  PDF export 범위는 ADR-059가 대체한다.
- `application-package.md`는 내부 지원 전략과 초안 방향 문서로 유지한다.
- 제출용 초안은 별도 파일로 분리한다.
  - `resume-draft.md`
  - `cover-letter.md`
  - `submission-checklist.md`
- 필요할 때만 `resume-metadata.json`을 도입한다.
  readiness/status 계산을 단순화하지 못하면 Markdown 파일 존재와 `review.md`를 우선한다.
- 생성 문서 품질 계약을 둔다.
  첫 10줄 안에 결론을 두고, 한국어 우선 제목과 자연스러운 한국어 문장을 사용한다.
  내부 분석과 제출용 문구를 분리한다.
- `needs_evidence`는 `보강 필요 / 선택지 / 권장 행동` resolution loop로 바꾼다.
- application request 상태는 `pending`, `running`, `done`, `failed`, `stale`를 기본값으로 둔다.
  상태에는 `ledgerId`, `error`, `resultSnapshot`을 포함한다.
- processor는 `run.ts resume` 이후 실제 산출물을 파일 시스템에서 검증한다.
  검증 대상은 `posting.md`, `fit-analysis.md`, `application-package.md`, `resume-draft.md`, `cover-letter.md`, `submission-checklist.md`, `review.md`다.

### 결과

- 지원 전략 문서와 제출용 문서의 책임이 분리된다.
- 사용자 검토 전 자동 제출이나 외부 전송으로 흐르지 않는다.
- workbench는 "요청이 처리 중인가", "어떤 파일이 준비됐는가", "무엇이 막혔는가"를 같은 언어로 표시할 수 있다.
- export 기능은 ADR-059에 따라 HTML/PDF 로컬 파일 생성으로 다룬다.

### 적용

- `tasks/plan055-resume-package-flow/` — 구현 계획.
- `docs/prd.md` — resume package flow planned scope.
- `docs/data-schema.md` — Resume Package Contract와 generated document quality contract.
- `docs/flow.md` — `run.ts resume` 처리 흐름과 request status projection.
- `docs/code-architecture.md` — runner, processor, fos-career adapter 책임 경계.

---

## ADR-057 — 생성 산출물 품질 계약은 전역 기준이다

- Status: Accepted
- Date: 2026-06-07

### 맥락

plan055에서 resume package Markdown 산출물 계약을 고정하면서 생성 문서 품질 기준도 함께 정했다.
하지만 이 기준을 resume package에만 묶어 두면 study artifact, interview asset, application reviewer output, workbench-facing summary가 서로 다른 문체와 구조로 흩어질 수 있다.

특히 내부 분석과 제출용 또는 공개용 문구가 섞이면 private 지원 맥락이 외부-facing 산출물로 새어 나갈 수 있다.
또 `needs_evidence`가 최종 문서에 그대로 남으면 runner와 사용자는 어떤 근거를 보강해야 하는지, 문장을 삭제해야 하는지, 사용자 확인이 필요한지 알기 어렵다.

### 결정

- plan055의 generated document quality 결정을 career-os 전역 생성 산출물 품질 계약으로 승격한다.
- 모든 생성 Markdown 산출물은 한국어 우선 section title을 사용한다.
  코드 식별자, 파일명, enum, 외부 product name처럼 필요한 경우에만 영어를 유지한다.
- 본문은 자연스러운 한국어 문장으로 쓴다.
  영어-heavy label 나열과 긴 미정리 문단을 피한다.
- 첫 10줄 안에 decision, conclusion, recommended action 중 적어도 하나가 있어야 한다.
- 내부 분석과 제출용 또는 공개용 문구를 분리한다.
  private 지원 전략, 후보자 맥락, reviewer 판단은 제출용 초안이나 공개용 fos-study artifact에 복사하지 않는다.
- `needs_evidence`는 최종 상태로 남기지 않는다.
  발견 시 `보강 필요 / 선택지 / 권장 행동`으로 바꿔 근거 보강 루프를 명시한다.
- 이 계약은 docs 기준이며, skill prompt 수정과 기존 generated output rewrite는 후속 phase에서 다룬다.

### 결과

- resume package 품질 기준이 application-package 흐름 밖에서도 같은 언어로 적용된다.
- 공개용, 제출용, 내부 분석 산출물의 경계가 문서 구조 차원에서 유지된다.
- `needs_evidence`가 막연한 marker가 아니라 다음 행동을 만드는 resolution loop로 취급된다.
- 후속 native skill 수정은 이 ADR과 `docs/prd.md`, `docs/flow.md`, `docs/code-architecture.md`의 계약을 기준으로 진행한다.

---

## ADR-058 — data cleanup은 private boundary와 retention을 먼저 고정한다

- Status: Accepted
- Date: 2026-06-07

### 맥락

plan056 phase-01 inventory에서 현재 checkout의 실제 `data/` 파일은 `data/runtime/live-position-postings.plan048-final.md`와 `data/runtime/live-position-postings.plan048-smoke.md` 두 tracked runtime exception뿐이었다.
하지만 docs에는 이미 `data/applications/`, `data/reports/`, `data/runtime/`, `data/source/`가 여러 흐름의 책임 위치로 쓰이고 있고, 당시 phase 계획은 `data/private/`까지 boundary로 다뤘다.
ADR-062 이후 회사·포지션별 작업 홈은 루트 `private/` 아래로 이동했다.

지원 준비, 면접 준비, 후보자 맥락, 회사별 전략이 섞이는 data 파일은 공개 가능성을 추정하기 어렵다.
오래된 파일을 바로 삭제하면 검증 evidence, task history, coffeechat deprecation 이력, plan048 snapshot 같은 맥락이 사라질 수 있다.
따라서 cleanup은 파일 이동이나 삭제보다 경계와 보존 원칙을 먼저 고정해야 한다.

### 결정

- `data/` 아래 파일은 private by default로 본다.
  공개 가능성은 별도 review와 사용자 승인으로만 승격한다.
- `data/applications/`는 공고별 지원 원장, 맞춤 지원 패키지, resume draft, cover letter, review의 private home이다.
- `data/private/`는 private-only 보관과 archive home으로 둔다.
  이 항목은 ADR-062 이후 루트 `private/` 정책으로 대체됐다.
- `data/source/`는 외부 source text와 notes의 입력 위치다.
  외부 공개 페이지에서 왔더라도 특정 지원, 면접, 회사 전략과 연결되면 private by default로 다룬다.
- `data/reports/`는 generated report 위치다.
  최근 운영 판단, task/ADR 근거, application/interview prep 참조가 있는 report는 보존한다.
  참조가 없고 새 report나 docs 결정으로 대체된 report는 retention 검토 후 archive 후보로 둔다.
- `data/runtime/`은 최신 projection, cache, lock, eval result 같은 가변 상태 위치다.
  장기 근거가 필요한 runtime 파일은 report, task evidence, private archive 중 하나로 승격 여부를 별도 결정한다.
- plan048의 두 tracked runtime file은 named exception으로만 다룬다.
  일반 runtime 추적 규칙으로 확장하지 않는다.
- coffeechat 자동화 tombstone은 이번 결정에서 삭제하지 않는다.
  후속 phase에서 active caller 부재, history 가치, archive 필요성을 확인한 뒤 tombstone/archive/retention 중 하나로 결정한다.

거절한 대안:

- 오래된 `data/` 파일을 바로 삭제하기.
  history와 검증 evidence를 잃을 수 있고, private data 경계를 확정하지 못한다.
- 모든 generated report를 영구 보존하기.
  runtime/report가 operational cache처럼 누적되어 active 판단과 history가 흐려진다.
- `data/source/`를 공개 source라는 이유로 public-safe로 보기.
  수집 원문이 지원/면접 맥락과 결합되는 순간 private 분석 입력이 된다.
- tracked runtime exception을 일반 정책으로 인정하기.
  `data/runtime/`의 가변 상태 원칙과 충돌한다.

### 결과

- cleanup phase는 삭제 중심이 아니라 archive, tombstone, retention 중심으로 진행된다.
- `data/applications`, private archive, `data/source`, `data/reports`, `data/runtime`의 책임이 분리된다.
- future worker는 private 원문을 task/docs에 복사하지 않고 path와 classification만 다룬다.
- phase-03 이후 runtime exception이나 coffeechat tombstone을 정리할 때 이 ADR을 기준으로 named decision을 남긴다.

### 적용

- `tasks/plan056-data-boundary-and-legacy-cleanup/` — 구현 계획.
- `docs/data-schema.md` — data boundary와 보존 원칙의 단일 출처.
- `docs/code-architecture.md` — 디렉터리 책임.
- `docs/flow.md` — cleanup/retention 흐름.

---

## ADR-059 — plan055 MVP에 HTML/PDF 이력서 export를 포함한다

- Status: Accepted
- Date: 2026-06-07

### 맥락

ADR-056은 Markdown 산출물 계약을 먼저 고정하고 PDF export를 후속으로 두었다.
이후 plan055 완료 범위가 맞춤 이력서 패키지 MVP까지 확장됐다.
사용자가 실제 지원 전 첨부할 수 있는 PDF 이력서가 필요하다.

외부 제출, 채용 사이트 로그인, 브라우저 입력 자동화는 여전히 승인 경계 밖이다.

### 결정

- plan055 MVP에 첨부 가능한 PDF resume export를 포함한다.
- export 체인은 다음 순서로 고정한다.
  - `resume-draft.md`
  - `design.md` 적용 `resume.html`
  - HTML을 headless Chrome으로 출력한 `resume.pdf`
- 공고별 `design.md`가 있으면 우선 사용한다.
  없으면 `config/resume-design.md` 기본 디자인 계약을 사용한다.
- `resume-exporter`는 career-os 내부 파일만 생성한다.
  업로드, 전송, 제출 버튼 클릭은 하지 않는다.

### 결과

- Markdown 리뷰 루프와 PDF 첨부 파일 생성이 같은 plan 안에서 연결된다.
- 사용자는 `resume.pdf`를 직접 확인한 뒤 수동 제출할 수 있다.
- export 기능은 외부 제출 자동화와 분리된다.

### 적용

- `scripts/application-agent/export_resume.ts`
- `config/resume-design.md`
- `scripts/application-agent/skill_contracts.ts`
- `docs/prd.md`
- `docs/data-schema.md`
- `docs/flow.md`
- `docs/code-architecture.md`

---

## ADR-076 — plan048 tracked runtime exception을 제거한다

- Status: Accepted
- Date: 2026-06-12

### 맥락

`data/runtime/live-position-postings.plan048-final.md`와 `data/runtime/live-position-postings.plan048-smoke.md`는 plan048 검증 산출물로 예외적으로 git 추적됐다.
하지만 현재 `data/runtime/`은 latest projection, cache, lock, eval result를 두는 private runtime 위치다.
tracked runtime 예외가 남아 있으면 새 작업자가 runtime 파일도 커밋 대상이라고 오해할 수 있다.

### 결정

- 두 plan048 tracked runtime exception 파일을 제거한다.
- plan048 task 문서와 과거 ADR 기록은 history로 보존한다.
- 앞으로 검증 evidence가 필요하면 `tasks/<plan>/` 아래 task-local evidence나 report에 남기고, `data/runtime/` 파일을 git 추적하지 않는다.

### 결과

- `data/runtime/`은 다시 gitignore/private runtime이라는 기본 경계로 돌아간다.
- runtime cleanup 때 tracked exception을 별도 예외로 계속 다룰 필요가 없다.

### 적용

- `data/runtime/live-position-postings.plan048-final.md`
- `data/runtime/live-position-postings.plan048-smoke.md`
- `docs/data-schema.md`

---

## ADR-075 — position daily runner는 TS를 정본으로 하고 sh는 shim으로 둔다

- Status: Accepted
- Date: 2026-06-11

### 맥락

`run_daily_with_claude.sh`는 collector 실행, Claude 호출, stale output 검증, active recommendation 검증, Discord 알림까지 여러 책임을 갖고 있었다.
awk와 shell string 처리로 추천 항목을 파싱하면 변경이 커질수록 검증과 유지보수가 어렵다.
career-os runner는 대부분 Bun TypeScript로 모이는 추세이며, position runner도 같은 방향으로 맞춘다.

### 결정

- `scripts/position-recommender/run_daily_with_claude.ts`를 daily runner 정본으로 둔다.
- 기존 `.sh` 경로는 cron과 수동 호출 호환을 위해 TS runner를 호출하는 얇은 shim으로 유지한다.
- 기존 CLI/env 계약을 유지한다.
  `--validate-existing`, `POSITION_RECOMMENDER_SOURCE`, `POSITION_RECOMMENDER_NOTIFY`, `POSITION_RECOMMENDER_NOTIFY_DRY_RUN`을 그대로 지원한다.
- report/runtime freshness check와 강력/도전 추천 active link 검증은 TS parser로 수행한다.
- cron command를 TS 직접 호출로 바꾸는 일은 TS runner 검증 후 별도 변경으로 처리한다.

### 결과

- runner 로직을 TypeScript에서 테스트·확장하기 쉬워진다.
- 기존 sh 호출자는 깨지지 않는다.
- cron 전환 전후를 분리해 운영 위험을 줄인다.

### 적용

- `scripts/position-recommender/run_daily_with_claude.ts`
- `scripts/position-recommender/run_daily_with_claude.sh`
- `docs/flow.md`

---

## ADR-062 — 포지션별 준비 홈은 루트 private 아래에 둔다

- Status: Accepted
- Date: 2026-06-08

### 맥락

CJ푸드빌 면접 준비가 dashboard, markdown 보기, 질문 선택, 답변 피드백으로 이어지면서 회사·포지션별 자료가 기능별 경로에 흩어졌다.
초기 정리는 `data/<company>/<position>` 형태였지만, 이 경로는 runtime, report, cache, queue 같은 시스템 데이터와 포지션별 작업 자료의 의미를 섞는다.

사용자는 포지션 준비 자료가 외부 공개 전 작업물이라는 점이 경로에서 바로 드러나길 원했다.
동시에 `private`를 절대 공개 금지 금고로 과도하게 해석하면, 여기서 출발한 순수 기술 공부팩을 `sources/fos-study/`에 발행하는 정상 흐름까지 막을 수 있다.

### 결정

- 회사·포지션별 active 준비 홈은 `private/<company-slug>/<position-slug>/`에 둔다.
- 현재 CJ푸드빌 타깃의 정본 경로는 `private/cj-foodville/digital-channel-backend/`다.
- `config/mvp-target.json`의 `primary.data_root`는 이 정본 경로를 가리킨다.
- 웹 dashboard와 새 자동화는 `primary.data_root`를 정본으로 읽는다.
- 면접 질문 정본을 `data/runtime/interview-drill.md`나 `data/reports/daily/*/interview-drill/report.md`에 중복 유지하지 않는다.
- 구조 전환에서 새 정본으로 대체된 legacy runtime/report는 archive 없이 삭제할 수 있다.
- 새 코드와 processor는 legacy fallback을 추가하지 않는다.
  필요한 호환은 일회성 migration으로 끝내고, 장기 운영 경로는 `primary.data_root` 하나로 통일한다.
- `private/`는 공개 전 작업 홈이다.
  개인 답변, 지원 전략, 회사별 민감 맥락을 그대로 공개 경로에 복사하지 않는다.
- 공개 가능한 기술 공부팩은 `private/`의 내용을 재가공해 `sources/fos-study/`에 따로 작성할 수 있다.

### 결과

- 포지션별 준비 자료와 시스템 runtime/report의 경계가 명확해진다.
- dashboard는 `data_root` 하나를 따라가면 현재 포지션의 면접 연습, report, study 자료를 찾을 수 있다.
- legacy fallback을 제거해 경로 drift와 중복 산출물이 줄어든다.
- 공개 공부팩 발행 흐름은 유지하되, 개인 답변과 지원 전략이 그대로 공개되는 일은 막는다.

### 적용

- `config/mvp-target.json`
- `private/cj-foodville/digital-channel-backend/`
- `docs/prd.md`
- `docs/data-schema.md`
- `docs/flow.md`
- `docs/code-architecture.md`
- `tasks/plan055-resume-package-flow/`

---

## ADR-060 — 공고 상태 액션은 사용자 버튼과 pending request로 처리한다

- Status: Accepted
- Date: 2026-06-07

### 맥락

fos-career workbench는 frontdoor queue와 ledger를 함께 보여주고, plan055 이후 이력서 패키지 생성까지 연결할 수 있다.
하지만 사용자가 특정 공고를 명시적으로 보류하거나 제외하거나 지원 준비로 넘기는 조작은 아직 화면과 request contract가 분리되어 있지 않다.

dashboard가 career-os 파일을 직접 쓰면 read-only safety boundary가 깨진다.
반대로 모든 결정을 채팅이나 수동 CLI로만 처리하면 공고 검토 흐름이 느려지고, 사용자의 의사결정 이력이 화면에 남지 않는다.

### 결정

- plan059를 공고 상태 사용자 액션으로 연다.
- dashboard 버튼은 `보류`, `제외`, `지원 준비` 세 가지를 기본값으로 둔다.
- 사유 입력은 optional로 둔다.
  사용자가 사유를 쓰지 않으면 시스템 기본 사유를 `effectiveReason`으로 저장한다.
- `보류`는 action stage를 `hold`로 바꾼다.
- `제외`는 action stage를 `excluded`로 바꾸고 추천/준비 후보에서 제외한다.
- `지원 준비`는 상태 변경에서 멈추지 않고 필요한 내부 산출물 생성을 시작한다.
  frontdoor 후보는 ledger 승격을 거친 뒤 이력서 패키지 생성 흐름으로 이어진다.
- fos-career는 career-os 파일을 직접 쓰지 않고 `user_position_action_requests` pending queue에 요청을 저장한다.
- processor는 요청 당시 snapshot과 현재 career-os record를 비교해 stale 요청을 막는다.
- 외부 제출, 로그인, 업로드, 공개 발행은 수행하지 않는다.

### 결과

- 사용자는 dashboard에서 공고별 의사결정을 빠르게 남길 수 있다.
- 지원 준비 버튼은 이력서 패키지 생성까지 이어지지만, 최종 제출은 사용자 수동 행동으로 남는다.
- action history와 request status가 fos-career DB에 남아 실패, stale, 재시도 판단이 쉬워진다.
- career-os 원장 mutation은 controlled runner가 수행해 read-only dashboard 경계를 유지한다.

### 적용

- `tasks/plan059-position-state-actions/` — 후속 구현 계획.
- `docs/prd.md`
- `docs/data-schema.md`
- `docs/flow.md`
- `docs/code-architecture.md`

---

## ADR-061 — 면접 준비 dashboard는 skill request gateway로 실행을 분리한다

- Status: Accepted
- Date: 2026-06-07

### 맥락

CJ푸드빌 2026-06-15 면접 준비는 기존 career-os 자산을 빠르게 확인하고 부족한 준비 자산을 즉시 만들 수 있어야 한다.
이미 `interview-prep-analyzer`, `interview-asset-writer`, `study-pack-writer` native skill이 있으므로 새 generator를 만드는 것보다 dashboard에서 요청을 만들고 안전한 processor가 기존 skill을 호출하는 편이 작다.

하지만 dashboard가 직접 `claude -p`를 실행하거나 career-os writable mount를 가지면 read-only 경계가 깨진다.
또 skill request result와 audit log에 처리 결과를 크게 저장하면 private 면접 문서와 command stdout이 dashboard persistence로 새어 나갈 수 있다.
면접 대화 답변과 피드백은 별도 private answer/session DB에 저장해 dashboard에서 조회하는 것이 맞다.

### 결정

- plan060을 CJ푸드빌 면접 skill request gateway로 연다.
- fos-career dashboard는 CJ푸드빌 2026-06-15 면접 준비 hub를 제공한다.
- hub는 career-os 자산을 read-only projection으로 보여준다.
  상태, 파일 경로, 짧은 요약, 다음 요청 후보만 표시한다.
- dashboard는 skill을 직접 실행하지 않고 request queue만 만든다.
- processor가 pending request를 읽고 allowlist와 stale guard를 확인한 뒤 career-os writable checkout에서 native skill을 호출한다.
- allowlist는 기존 skill 3개로 제한한다.
  - `interview-prep-analyzer`
  - `interview-asset-writer`
  - `study-pack-writer`
- 면접 대비 중 공부해야 할 주제가 생기면 dashboard에서 `study-pack-writer` 요청을 만들 수 있다.
  이 요청은 공개 가능한 순수 기술 주제일 때만 허용한다.
- `study-pack-writer` 요청은 `sources/fos-study/`에 `[초안]` 제목의 공부팩 초안을 생성한다.
  commit/push는 ADR-086에 따라 사용자 명시 승인 뒤에만 수행한다.
  승인된 push가 실패하면 요청 실패로 남긴다.
- dashboard는 예상 질문별 답변 텍스트 입력을 받고 private answer record를 만든다.
- answer record는 feedback request와 연결한다.
  processor는 관련 prep/report 경로와 답변을 바탕으로 강점, 리스크, 권장 수정 방향을 제공한다.
- 면접 대화 세션 UX는 다음 흐름으로 고정한다.
  - 질문 생성/선택
  - 답변 입력
  - 피드백
  - 꼬리질문
  - 답변
  - 최종 요약/보완 주제/study-pack 후보
- 면접 대화 답변 전문은 DB에 저장한다.
  사용자가 서버 파일을 찾지 않고 dashboard에서 바로 볼 수 있어야 한다.
- 상세 피드백도 DB에 저장한다.
  dashboard에서 바로 확인할 수 있어야 한다.
- 면접 대화 세션은 기본 5턴으로 시작한다.
  사용자가 원하면 자유형으로 연장할 수 있다.
- 피드백은 점수화한다.
  기본 기준은 기술 정확성, 경험 연결, 답변 구조, CJ푸드빌 맥락 반영이다.
- study-pack 생성 요청은 고정 추천 후보뿐 아니라 사용자 자연어 요청도 받는다.
  예: "어떤 스터디팩 만들어줘" 같은 입력을 public-safe topic으로 정규화한다.
- 사용자가 인터뷰 중 특정 주제를 정말 모르겠다고 느끼면 해당 turn에서 직접 `study_pack` request를 만들 수 있다.
- 2026-06-15 CJ푸드빌 면접 종료 후 해당 면접모드는 read-only/archive 상태로 전환한다.
  archive 상태에서는 새 질문, 새 답변, 새 feedback request를 만들지 않는다.
- 결과 저장은 상태, 파일 경로, 짧은 요약, 오류 요약으로 제한한다.
  이는 skill request result와 audit log의 저장 제한이다.
- private 문서 본문, 면접 답변 전문, 상세 피드백, command stdout 전체는 request result, audit log, Discord 알림, fos-study로 복사하지 않는다.
- 외부 제출, 공개 발행, 로그인, 업로드, candidate-profile 자동 수정은 금지한다.
- 구현 phase에서는 docs/ADR/정책 문서를 수정하지 않는다.
  계약이 부족하면 구현을 멈추고 `PHASE_BLOCKED`로 보고한다.

### 결과

- dashboard는 면접 준비 hub로 쓰이지만 career-os 실행 권한을 직접 갖지 않는다.
- 기존 native skill 자산을 재사용해 새 자동화 표면을 줄인다.
- request row와 audit log는 운영 상태를 남기되 private 자료 본문을 저장하지 않는다.
- docs-first 결정과 implementation 실행을 분리해 구현 중 정책 drift를 줄인다.

### 적용

- `tasks/plan060-interview-skill-request-gateway/` — 후속 구현 계획.
- `docs/prd.md`
- `docs/data-schema.md`
- `docs/flow.md`
- `docs/code-architecture.md`

---

## ADR-063 — 면접 준비 사람용 정본은 단일 prep.md로 관리한다

- Status: Accepted
- Date: 2026-06-08

### 맥락

ADR-062로 포지션별 준비 홈은 `private/<company>/<position>/` 아래로 정리됐지만, 면접 준비 내용은 여전히 여러 파일로 흩어질 수 있었다.
예상 질문 드릴, 면접 준비 리포트, 1차 면접 전략, 1차 면접 체크리스트, 10일 Java 준비 재료를 각각 별도 파일로 노출하면 dashboard와 사람이 읽는 흐름 모두 복잡해진다.

사용자는 면접 준비 화면에서 여러 마크다운을 찾아다니기보다, 지금 당장 읽고 답변 연습할 하나의 정제된 문서를 원한다.
답변 기록이나 피드백 로그처럼 기계가 누적해야 하는 데이터는 분리할 수 있지만, 사람이 보는 준비 자산은 한 파일로 합치는 편이 낫다.

### 결정

- 포지션별 면접 준비의 사람용 정본은 `private/<company-slug>/<position-slug>/interview/prep.md` 하나로 둔다.
- `prep.md`는 다음 내용을 섹션으로 포함한다.
  - 오늘의 면접 준비 요약
  - 예상 질문 드릴
  - 추천 시작 질문
  - 1차 면접 전략
  - 1차 면접 체크리스트
  - 단기 Java 준비 중 현재 면접에 필요한 항목
  - 이미 정리된 주제와 낮은 우선순위 주제
  - 다음 액션
- `interview/current-practice.md`, `interview/reports/YYYY-MM-DD.md`, `study/interview-prep-10-day-java-materials.md`, `data/prep/<prep_dir>/strategy.md`, `data/prep/<prep_dir>/checklist.md`는 dashboard의 사람이 보는 primary asset이 아니다.
  기존 내용은 `prep.md`로 정제·흡수하고, 대체 확인 후 legacy mirror 또는 reference로 정리한다.
- 답변 기록과 피드백 로그는 사람이 보는 정본이 아니라 누적 데이터이므로 계속 분리한다.
  기본 위치는 `interview/answers/*.jsonl`, `interview/feedback/*.md`다.
- 날짜별 snapshot은 기본 생성하지 않는다.
  추적이 필요할 때만 `interview/history/YYYY-MM-DD.md`를 선택적으로 만든다.
- dashboard는 면접 hub 상단에서 `prep.md`를 우선 보여주고, 예상 질문 드롭다운도 `prep.md`의 질문 섹션에서 파싱한다.
- 공개 가능한 공부팩은 계속 `sources/fos-study/`에 만들 수 있지만, `prep.md`의 개인 답변·지원 전략·회사별 민감 맥락을 그대로 복사하지 않고 public-safe로 재작성한다.

### 결과

- 면접 준비 자료가 사람이 읽는 한 문서로 정리된다.
- dashboard 카드와 markdown 링크가 줄어들어 현재 준비 흐름이 명확해진다.
- generator와 processor는 여러 산출물을 흩뿌리는 대신 `prep.md` 갱신을 중심으로 동작한다.
- 답변/피드백 로그는 유지되어 연습 이력과 사람용 준비 문서의 책임이 분리된다.

### 적용

- `private/cj-foodville/digital-channel-backend/interview/prep.md`
- `docs/data-schema.md`
- `docs/flow.md`
- `docs/code-architecture.md`
- `docs/prd.md`
- `tasks/plan061-private-position-home-unification/` — 후속 정리에서 supersede 또는 재작성

---

## ADR-064 — fos-career 범용 채팅은 제거하고 목적별 요청 UI로 통일한다

- Status: Accepted
- Date: 2026-06-08

### 맥락

fos-career의 초기 MVP에는 career-os 파일을 컨텍스트로 읽는 범용 LLM 채팅이 포함되어 있었다.
하지만 dashboard가 발전하면서 주요 행동은 이미 버튼과 pending request queue로 분리됐다.
지원 우선순위 변경, 지원 준비 시작, 면접 준비 생성, 공부팩 생성, 답변 피드백은 모두 목적이 정해진 UI와 processor가 처리하는 편이 더 안전하고 추적 가능하다.

범용 채팅은 사용자가 무엇이 실행되는지 예측하기 어렵고, career agent 맥락을 충분히 주입하지 않으면 단순 Q&A처럼 동작한다.
반대로 career agent 맥락을 과하게 주입하면 private 문서와 지원 전략이 채팅 기록, audit log, screenshot에 새어 나갈 위험이 커진다.
따라서 fos-career의 사람용 표면은 자유 채팅이 아니라 명시적 버튼, 정본 markdown, 답변 입력, 피드백, 꼬리질문 흐름으로 제한한다.

### 결정

- fos-career에서 범용 채팅 제품면을 제거한다.
  - `/dashboard/chat`
  - floating chat button/panel
  - `/api/chat/*`
- dashboard navigation과 login shell에서 채팅 메뉴를 노출하지 않는다.
- dashboard에서 skill 실행은 계속 버튼 기반 request queue로 만든다.
  fos-career는 요청을 저장하고, processor가 allowlist와 stale guard를 확인한 뒤 career-os writable checkout에서 실행한다.
- 면접 답변 피드백은 범용 채팅이 아니라 interview evaluator 흐름으로 다룬다.
  evaluator는 `private/<company>/<position>/interview/prep.md`, 현재 질문, 사용자 답변, 최근 답변/피드백 요약, 이미 정리된 주제, 포지션 맥락을 명시적으로 묶어 평가한다.
- 질문 선택 UI는 긴 질문을 잘라 보이는 select가 아니라 버튼 목록과 readonly textarea로 표시한다.
- `lib/llm/*` 같은 provider 경계는 범용 채팅이 아니라 목적별 evaluator/request processor에서 재사용할 수 있다.
  이름과 책임은 후속 plan에서 필요하면 generic provider로 정리한다.
- 기존 MySQL `llm_chat_sessions`, `llm_chat_messages` 테이블은 즉시 destructive migration으로 drop하지 않는다.
  코드 경로에서 참조를 제거하고 문서상 legacy/deprecated로 표시한 뒤, 데이터 보관 여부를 별도 cleanup plan에서 결정한다.
- audit/action log 예시는 `chat.message_sent` 대신 `dashboard.view`, `interview.answer_submitted`, `interview.feedback_generated`, `skill_request.created` 같은 목적별 action으로 갱신한다.
- LLM은 여전히 분석, 작성, 추천 근거, 면접 답변 평가에 사용할 수 있다.
  금지되는 것은 목적 없는 자유 채팅 UI와 chat 기반 mutation이다.

### 결과

- dashboard의 행동 표면이 버튼과 명시적 request로 정리된다.
- private career-os 맥락이 범용 채팅 기록에 섞일 위험이 줄어든다.
- 면접 피드백은 career agent 맥락을 갖춘 전용 evaluator로 발전시킬 수 있다.
- ADR-046의 “LLM 채팅 UI” 범위는 이 ADR로 supersede된다.

### 적용

- `~/services/fos-career/app/dashboard/chat/`
- `~/services/fos-career/app/dashboard/floating-chat.tsx`
- `~/services/fos-career/app/api/chat/`
- `~/services/fos-career/lib/llm/`
- `~/services/fos-career/db/schema.ts`
- `docs/prd.md`
- `docs/flow.md`
- `docs/code-architecture.md`
- `docs/data-schema.md`

---

## ADR-065 — 면접 답변 피드백은 career context LLM evaluator로 처리한다

- Status: Accepted
- Date: 2026-06-08

### 맥락

ADR-064로 범용 채팅 UI/API를 제거했기 때문에 fos-career의 LLM 사용은 목적별 evaluator/request processor에 붙어야 한다.
현재 면접 답변 제출 흐름은 답변 저장 후 `answer_feedback` request를 pending queue에 넣고, host-side processor가 2분 간격으로 처리한다.
다만 feedback 생성은 아직 deterministic fallback 중심이라 짧은 테스트 답변도 표현상 과하게 긍정적으로 보일 수 있었다.

사용자는 답변 제출 뒤 즉시 평가되는 경험을 원하고, 꼬리질문 생성 여부도 LLM이 답변 상태를 보고 판단하길 원한다.
따라서 `answer_feedback`은 범용 채팅이 아니라 career agent 맥락을 가진 전용 LLM evaluator로 승격한다.

### 결정

- 답변 제출 시 `interview_answer_records` row와 `answer_feedback` request를 즉시 생성한다.
- feedback 처리는 별도 버튼 없이 제출 직후 pending queue에 들어가고, 기존 host-side interview processor가 처리한다.
- 너무 짧거나 의미 없는 답변은 LLM을 호출하지 않고 deterministic guard에서 즉시 insufficient feedback으로 처리한다.
  예: 매우 짧은 문자열, 기술/경험/구조/도메인 신호가 없는 답변.
- guard를 통과한 답변만 LLM evaluator를 호출한다.
- evaluator context bundle은 다음 입력으로 제한한다.
  - `private/<company>/<position>/interview/prep.md`
  - 현재 질문
  - 사용자 답변
  - 최근 3-5개 답변/피드백 요약
  - 이미 정리된 주제와 낮은 우선순위 주제
  - 포지션/회사 맥락
  - 평가 기준: 기술 정확성, 경험 연결, 답변 구조, CJ푸드빌 맥락 반영, 위험 표현
- LLM 응답은 strict JSON으로 받는다.
  기본 필드는 `feedbackBody`, `scores`, `followUpQuestion`, `shouldAskFollowUp`, `improvementTopics`, `studyPackCandidates`, `riskFlags`다.
- 꼬리질문은 LLM이 `shouldAskFollowUp`과 `followUpQuestion`으로 판단한다.
  후속 턴 전환은 dashboard가 해당 값을 보여주고 사용자가 이어 답하는 흐름으로 둔다.
- LLM 실패, timeout, JSON parse 실패는 deterministic fallback으로 처리하고 request를 실패로 방치하지 않는다.
- DB에는 답변 전문과 상세 피드백을 private 영역으로 저장한다.
  audit log, request result, Discord, HUD에는 길이, 점수, 짧은 summary, 상태만 저장한다.
- evaluator는 외부 사이트 접근, fos-study 발행, candidate-profile 수정, 지원서 제출을 수행하지 않는다.
- 기존 `lib/llm/*` provider는 이 evaluator에서 재사용한다.
  필요하면 streaming 중심 계약을 structured JSON 평가 계약으로 확장한다.

### 결과

- 면접 피드백의 품질과 맥락성이 올라간다.
- 답변이 충분하지 않은 경우에는 비용을 쓰지 않고 빠르게 낮은 점수와 재답변 가이드를 제공한다.
- 꼬리질문은 고정 생성이 아니라 답변 상태에 맞춰 생성된다.
- 범용 채팅 없이도 career agent 맥락이 면접 연습 흐름 안에 살아난다.

### 적용

- `~/services/fos-career/lib/interview/gateway.ts`
- `~/services/fos-career/lib/llm/`
- `~/services/fos-career/scripts/process-interview-requests.ts`
- `~/services/fos-career/app/api/interview/answers/route.ts`
- `~/services/fos-career/db/schema.ts`
- `docs/prd.md`
- `docs/flow.md`
- `docs/code-architecture.md`
- `docs/data-schema.md`

---

## ADR-066 — 공개 가능 일반 면접 질문 bank는 public/question-bank에 둔다

- Status: Accepted
- Date: 2026-06-08

### 맥락

면접 준비는 포지션별 private 질문만으로는 범위가 좁다.
일반적인 Java/Spring, DB, CS, 운영, System design 질문도 꾸준히 모아야 하지만, `data/`는 gitignore 대상이라 공개 가능하고 재사용 가능한 질문 bank를 보관하기에 적합하지 않다.

또한 OpenClaw에서 사용자가 “일반 백엔드 질문”, “CS 질문 수집”, “질문 bank 보강”처럼 자연어로 말했을 때 안정적으로 해당 작업이 호출되려면 skill description과 routing trigger가 명확해야 한다.

### 결정

- 공개 가능 일반 질문 bank는 career-os 루트의 `public/question-bank/` 아래에 둔다.
- `public/question-bank/`는 git 추적 대상이며 private 지원/면접 맥락을 포함하지 않는다.
- 기본 하위 범위는 다음과 같다.
  - `java-spring/`
  - `database/`
  - `cs/`
  - `operations/`
  - `system-design/`
- 질문 bank 항목은 단순 암기 질문을 그대로 저장하지 않고 backend 실무형 질문으로 정규화한다.
- 질문 항목은 최소한 category, difficulty, question, intent, answerSignals, source, publicSafe, positionFitHint, normalizedFrom을 가진다.
- private 포지션 맞춤 질문은 `private/<company>/<position>/interview/prep.md`에 선별 반영한다.
  `public/question-bank`의 일반 질문이 private 답변/회사 맥락을 포함해서는 안 된다.
- 공개 글 형태로 발행할 때만 `sources/fos-study/`로 복사 또는 재작성한다.
  `public/question-bank`는 공개 가능 원천이지만 자동 발행 대상은 아니다.
- `question-bank-collector` skill을 추가한다.
  OpenClaw와 Claude native workflow 모두에서 자연어 trigger가 잘 잡히도록 description에 다음 표현을 포함한다.
  - “일반 backend 질문”
  - “CS 질문 수집”
  - “면접 질문 bank”
  - “질문 뱅크 보강”
  - “약점 기반 질문 재선별”
  - “Java/Spring/DB/운영 질문 모아줘”
- 수집기는 raw 후보를 만든 뒤 normalizer가 중복 제거와 실무형 변환을 수행한다.
- 최근 7일 질문, 이미 답변이 정리된 주제, 포지션별 낮은 우선순위 주제는 선별 시 감점한다.

### 결과

- 일반 backend/CS 질문이 git 추적 가능한 공개 가능 자산으로 쌓인다.
- private 지원 맥락과 public-safe 질문 bank의 경계가 선명해진다.
- fos-study 발행은 검수된 질문/해설만 별도 초안으로 진행할 수 있다.
- OpenClaw 자연어 요청에서도 question-bank 작업을 안정적으로 라우팅할 수 있다.

### 적용

- `public/question-bank/`
- `.openclaw/workspace-career/skills/question-bank-collector/SKILL.md`
- `career-os/.claude/skills/question-bank-collector/SKILL.md`
- `docs/prd.md`
- `docs/flow.md`
- `docs/code-architecture.md`
- `docs/data-schema.md`

---

## ADR-067 — coffeechat 자동화 tombstone도 제거하고 ADR-only history로 둔다

- Status: Accepted
- Date: 2026-06-08

### 맥락

ADR-048로 coffeechat 자동화는 이미 active workflow에서 폐기됐고, first-round/final-round/offer 준비는 `interview-prep-analyzer`로 이관됐다.
그 뒤에도 `.claude/skills/interview-coffeechat-prep/`와 `scripts/interview-coffeechat-prep/`는 tombstone으로 남아 있었고, `config/mvp-target.json`과 schema에는 `coffeechat: null` compatibility field가 남아 있었다.

사용자는 coffeechat이 지원 흐름과 통합할 만큼 일관된 workflow가 아니라고 판단했고, scripts와 문서의 coffeechat 관련 active 흔적을 제거하길 원했다.
따라서 이제 tombstone 파일도 제거하고, coffeechat 폐기 결정은 ADR/task history에만 남긴다.

### 결정

- `.claude/skills/interview-coffeechat-prep/`를 제거한다.
- `scripts/interview-coffeechat-prep/`를 제거한다.
- `config/mvp-target.json`의 `primary.interview.coffeechat` field를 제거한다.
- `scripts/interview-prep-analyzer/mvp_target_schema.ts`에서 coffeechat mode/schema compatibility를 제거한다.
- active docs, AGENTS, TOOLS, candidate-profile에서 coffeechat을 현행 흐름처럼 언급하지 않는다.
- `interview-prep-analyzer`는 `first_round`, `final_round`, `offer_chat`만 지원한다.
- 과거 task 기록(`tasks/plan021-*`, `tasks/plan041-*`, `tasks/plan056-*`)은 구현 이력으로 보존한다.
  단, active guide처럼 오해될 수 있는 최신 docs나 skill index에서는 제거한다.
- `data/private/...prep-archive`와 오래된 `data/reports/...coffeechat` 같은 과거 산출물은 active source가 아니므로 이번 cleanup에서 삭제 대상으로 보지 않는다.
  별도 data retention cleanup이 필요하면 후속 plan에서 다룬다.

### 결과

- coffeechat 자동화가 active code path와 docs에서 완전히 사라진다.
- 면접 준비 workflow는 first-round/final-round/offer 중심으로 단순화된다.
- history는 ADR/task에 남아 과거 의사결정을 추적할 수 있다.
- 향후 coffeechat 요청은 별도 표준 자동화가 아니라 상황별 수동 리서치/일회성 준비로만 다룬다.

### 적용

- `.claude/skills/interview-coffeechat-prep/`
- `scripts/interview-coffeechat-prep/`
- `config/mvp-target.json`
- `scripts/interview-prep-analyzer/mvp_target_schema.ts`
- `docs/prd.md`
- `docs/flow.md`
- `docs/code-architecture.md`
- `docs/data-schema.md`
- `AGENTS.md`
- `config/candidate-profile.md`

---

## ADR-068 — 질문 bank 보강은 dashboard request gateway로 연결한다

- Status: Accepted
- Date: 2026-06-08

### 맥락

ADR-066으로 공개 가능 일반 질문 bank와 `question-bank-collector` skill이 생겼다.
하지만 fos-career dashboard의 면접 hub에는 아직 이 skill을 호출하는 버튼과 request processor 경로가 없다.

사용자는 내부 skill 호출을 버튼 기반으로 쓰고 싶어 하며, 범용 chat은 ADR-064로 제거했다.
따라서 question bank 보강도 chat이 아니라 목적별 request queue로 연결해야 한다.

### 결정

- fos-career `interview_skill_requests`에 `question_bank_refresh` request type을 추가한다.
- `question_bank_refresh`의 유일한 skill은 `question-bank-collector`다.
- dashboard 면접 hub에는 “질문 bank 보강” 요청 버튼을 추가한다.
  topic은 공개 가능 일반 질문 범위만 받는다.
- processor는 `question_bank_refresh`를 받으면 `claude --permission-mode <mode> -p "/question-bank-collector <topic>"`로 실행한다.
- processor는 실행 후 `public/question-bank` path와 validator 결과만 request result에 저장한다.
  private 본문, 답변 전문, command stdout 전체는 저장하지 않는다.
- 이번 연결은 public question bank 보강까지만 다룬다.
  `private/<company>/<position>/interview/prep.md`로 선별 반영하는 버튼은 후속 plan에서 다룬다.
- `sources/fos-study/` 자동 발행은 하지 않는다.

### 결과

- dashboard에서 일반 backend/CS 질문 bank 보강을 버튼으로 요청할 수 있다.
- queue/processor/HUD 흐름은 기존 interview skill request gateway와 일관된다.
- public/private 경계가 유지된다.
- question bank를 실제 면접 질문 추천으로 섞는 단계는 후속 결정으로 분리된다.

### 적용

- `fos-career/db/schema.ts`
- `fos-career/db/migrations/`
- `fos-career/lib/interview/gateway.ts`
- `fos-career/app/dashboard/interview/page.tsx`
- `fos-career/app/api/interview/requests/route.ts`
- `fos-career/scripts/process-interview-requests.ts`
- `career-os/tasks/plan067-question-bank-request-gateway/`

---

## ADR-069 — config는 정책·타깃·예외만 남기고 자산 목록은 파생한다

- Status: Accepted
- Date: 2026-06-08

### 맥락

career-os의 `config/`는 처음에는 사람이 큐레이션한 입력을 모으는 단순한 위치였지만, 여러 plan을 거치며 학습 토픽 목록, 후보 reservoir, topic-file map, live-coding seed, 질문 bank topic, 선호, 현재 타깃이 함께 쌓였다.

현재 실제 학습 자산은 `sources/fos-study/`에 누적되고, 공개 가능 일반 질문은 `public/question-bank/`에 쌓인다.
그런데 별도의 config JSON에도 같은 성격의 목록이 다시 존재하면 다음 문제가 생긴다.

- fos-study에 새 문서가 생겨도 config topic 목록을 따로 갱신해야 한다.
- 사람이 공부한 것과 추천기가 보는 목록이 달라질 수 있다.
- 오래된 topic map이 남아 새 추천과 면접 질문 선별을 오염시킬 수 있다.
- config가 “운영 정책”인지 “자산 DB”인지 불명확해진다.

사용자는 fos-study에 공부한 내용을 계속 누적하는 구조를 원한다.
따라서 config diet는 단순 파일 삭제가 아니라, config의 책임을 다시 좁히는 작업으로 진행한다.

### 결정

- `config/`는 정책, 현재 타깃, 후보자 baseline, 사람이 명시적으로 고른 예외만 보관한다.
- 실제 학습 문서 inventory는 `sources/fos-study/` 파일 트리에서 파생한다.
- 공개 가능 일반 질문 inventory는 `public/question-bank/`에서 파생한다.
- config가 fos-study/public question bank의 전체 목록을 복제하지 않는다.
- 대량 topic/reservoir JSON은 기본적으로 “정본”이 아니라 정리 대상이다.
  필요한 항목만 curated override, seed, guardrail, pin 목록으로 축소한다.
- 추천기는 “config 목록을 순회”하는 방식에서 “실제 자산 inventory를 읽고, config override로 가중치를 조정”하는 방식으로 이동한다.
- `config/mvp-target.json`은 현재 회사·직무·포지션 홈 경로의 단일 출처로 유지한다.
- `config/candidate-profile.md`, `config/baseline-core-files.json`, `config/study-progress.json`은 후보자 baseline과 학습 진행 상태를 담는 hand-crafted/agent-reviewed 자산으로 유지한다.
- `config/sources.json`은 외부 수집 source registry로 유지하되, fos-study 문서 목록을 대신하지 않는다.
- `config/resume-design.md`는 지원서 export 기본 디자인 계약으로 유지한다.
- `config/study-preferences.json`처럼 `mvp-target`과 내용을 반복하는 파일은 추천 철학/제약만 남기거나 제거한다.
- `config/first-round-drill-core-files.json`, 오래된 `topic-file-map.json`, 대량 `study-pack-topics.json`/`study-pack-candidates.json`, 이름이 역할과 어긋난 `question-bank-topics.json`은 plan068에서 실제 사용 여부를 확인한 뒤 축소·이관·삭제한다.
- config cleanup은 한 번에 파괴적으로 진행하지 않는다.
  먼저 reader inventory, fallback path, 검증 명령을 plan에 고정하고 phase 단위로 줄인다.

### 결과

- 공부 자산의 단일 진실 출처가 `sources/fos-study/`로 선명해진다.
- 공개 질문 bank의 단일 진실 출처가 `public/question-bank/`로 선명해진다.
- config drift와 2중 관리가 줄어든다.
- 새 공부팩이나 질문 bank 보강이 config 수동 편집 없이 추천 흐름에 반영될 수 있다.
- config는 “무엇을 어떻게 우선할지”만 담고, “무엇이 존재하는지”는 파일 트리와 validator가 판단한다.

### 적용

- `config/`
- `sources/fos-study/`
- `public/question-bank/`
- `.claude/skills/study-topic-recommender/SKILL.md`
- `.claude/skills/study-pack-writer/SKILL.md`
- `.claude/skills/interview-asset-writer/SKILL.md`
- `scripts/study-topic-recommender/`
- `docs/data-schema.md`
- `docs/flow.md`
- `docs/code-architecture.md`
- `tasks/plan068-config-diet/`

---

## ADR-070 — study topic 후보 풀은 LLM refresh turn이 발굴하고 config에는 active 캐시만 반영한다

- Status: Accepted
- Date: 2026-06-09

### 맥락

`study-topic-recommender`는 ADR-033 이후 `sources/fos-study/`를 직접 스캔한다.
따라서 이미 만들어진 학습 문서를 새 study pack으로 다시 추천하는 문제는 줄었다.

하지만 새 학습 후보는 여전히 `config/study-pack-candidates.json`의 seed/fallback 항목에 강하게 의존한다.
이 파일이 커질수록 추천이 고정 풀 순회처럼 보이고, 사용자가 새 관심사를 말해도 후보 발굴이 충분히 동적으로 움직이지 않는다.

기존 `refresh_topic_inventory.ts`는 재사용할 가치가 있다.
이 스크립트는 fos-study inventory, deterministic dedupe, 최근 추천 history, RSS discovery, markdown rendering을 이미 처리한다.
다만 이름과 달리 새 후보를 LLM으로 탐색해 config에 반영하는 단계는 거의 없다.

### 결정

- `refresh_topic_inventory.ts`는 inventory refresh와 추천 스냅샷 생성을 계속 담당한다.
- 새 후보 발굴은 별도 `candidate refresh turn`으로 분리한다.
- 후보 refresh turn은 다음 입력을 읽는다.
  - `sources/fos-study/` inventory
  - `config/study-preferences.json`
  - `config/study-progress.json`
  - 최근 `data/runtime/topic-inventory-history.jsonl`
  - 현재 추천 실행 맥락 또는 사용자 자연어 관심사
- 후보 refresh turn은 LLM이 10-20개 후보를 제안한 뒤 deterministic 검증으로 분류한다.
  분류 값은 `new`, `update-existing`, `skip`, `needs-confirmation`이다.
- `new` 후보만 `config/study-pack-candidates.json`에 자동 append/update한다.
- `update-existing`, `skip`, `needs-confirmation`은 config에 반영하지 않고 runtime report에만 남긴다.
- `config/study-pack-candidates.json`은 전체 후보 정본이 아니라 active 후보 캐시와 사람이 고른 seed/pin 목록이다.
- 자동 후보 항목은 `source: "llm-candidate-refresh"`, `generatedAt`, `status`, `sourceSignals`, `promotionTarget.outputPath`를 가진다.
- active 자동 후보는 기본 30개를 넘기지 않는다.
  30일 이상 선택되지 않은 자동 후보는 `stale` 처리 대상이다.
- 후보 refresh 실행 기록은 `data/runtime/study-topic-candidate-refresh.json`과 `.md`에 남긴다.
- cron은 매일 무조건 후보를 보충하지 않는다.
  추천 실행 중 다음 조건이면 후보 refresh turn을 연다.
  - 새 후보가 5개 이하
  - 최근 7회 추천에서 같은 domain/tag 반복이 과도함
  - 사용자가 새 관심사를 말함
  - 새 지원·면접 맥락이 생김
  - 이미 만든 문서가 새 추천 후보에 많이 섞임
- cron 자동 후보 refresh는 하루 1회로 제한한다.
- 추천 결과와 정기 실행 요약은 `#병태-이직준비방`으로 보낸다.
  개발·운영 상태와 오류 분석은 `#병태-개발공부방`에 둔다.

### 결과

- 추천은 고정 후보 파일 순회가 아니라, 현재 맥락에서 새 후보를 발굴하는 구조가 된다.
- 기존 refresh 코드의 강점인 inventory scan, 중복 검증, history cooldown, RSS discovery는 유지된다.
- config는 계속 작게 유지하면서도, 검증을 통과한 후보는 자동으로 다음 추천 입력에 들어간다.
- 이미 만들어진 study pack은 새 후보가 아니라 기존 문서 보강 후보로 분류된다.
- 후보 발굴 이유와 자동 반영 내역이 runtime report로 추적된다.

### 적용

- `config/study-pack-candidates.json`
- `data/runtime/study-topic-candidate-refresh.json`
- `data/runtime/study-topic-candidate-refresh.md`
- `data/runtime/topic-inventory.json`
- `scripts/study-topic-recommender/`
- `.claude/skills/study-topic-recommender/SKILL.md`
- `docs/data-schema.md`
- `docs/flow.md`
- `docs/code-architecture.md`

---

## ADR-071 — study-topic-recommender 자동 실행은 bypassPermissions로 호출한다

- Status: Accepted
- Date: 2026-06-09

### 맥락

ADR-070 rollout 검증 중 `claude -p "/study-topic-recommender ..."`가 정상 완료되지 않고 멈췄다.
Claude 실행 로그를 확인하니 작업 실패가 아니라 비대화형 실행 중 권한 승인 요청을 기다리는 상태였다.

첫 실행은 후보 제안 JSON과 runtime 후보 report 쓰기 승인을 기다렸다.
두 번째 `acceptEdits` 실행은 파일 수정은 허용됐지만 `Bash` 명령 승인 요청에서 멈췄다.
로그 마지막 상태는 정상 완료가 아니라 `last-prompt`였다.

`study-topic-recommender`는 agent-only 내부 추천 흐름이다.
외부 제출, fos-study publish, commit/push를 하지 않는다.
반면 정상 동작에는 후보 제안 JSON 쓰기, runtime report 쓰기, Bun script 실행이 필요하다.

### 결정

- 자동 실행과 운영 문서의 `study-topic-recommender` 호출은 `claude --permission-mode bypassPermissions -p "/study-topic-recommender ..."`를 사용한다.
- 이 권한 모드는 `study-topic-recommender`에 한정한다.
- `study-pack-writer`, `interview-asset-writer`처럼 공개 저장소 publish 또는 사용자 확인이 필요한 skill에는 적용하지 않는다.
- skill 내부 Bash 예시는 `career-os` 루트에서 실행하는 경로로 정리한다.
  `career-os/scripts/...`가 아니라 `scripts/...`를 사용한다.
- OpenClaw cron payload도 같은 호출 패턴을 사용한다.

### 결과

- daily study recommendation cron이 후보 refresh 중 승인 대기 상태로 멈추지 않는다.
- `acceptEdits`가 Bash 승인 요청을 해결하지 못하는 한계를 문서화했다.
- 공개 발행이나 지원서 제출처럼 사람 확인이 필요한 흐름은 기존 확인 절차를 유지한다.

### 적용

- `AGENTS.md`
- `.claude/skills/study-topic-recommender/SKILL.md`
- `docs/flow.md`
- `docs/code-architecture.md`
- `scripts/application-agent/skill_contracts.ts`
- OpenClaw cron `career-os:daily-study-topic-recommendation`

---

## ADR-072 — daily study cron은 주제 3개만 보내는 lean path로 둔다

- Status: Accepted
- Date: 2026-06-09

### 맥락

ADR-071로 native `study-topic-recommender`의 비대화형 권한 대기 문제는 해결했다.
하지만 daily cron을 매번 native Claude skill로 실행하면 토큰 비용이 크고, Discord 결과도 실행 로그 중심으로 길어질 수 있다.

사용자가 원하는 daily 경험은 운영 로그가 아니라 오늘 공부할 주제만 빠르게 보는 것이다.
후보 refresh, 의미 기반 중복 검토, 긴 큐레이션 설명은 필요할 때 on-demand로 실행하면 충분하다.

### 결정

- daily study cron은 native Claude skill을 호출하지 않는다.
- daily study cron은 `refresh_topic_inventory.ts`를 직접 실행한다.
- Discord에는 `recommendations[0:3]`의 제목, 짧은 이유, 추천한 이유 묶음, 일부러 피한 축만 보낸다.
- 실행 로그, self-check 전문, 비용·토큰 세부사항은 Discord 요약에 남기지 않는다.
- full report 경로는 짧게 남긴다.
- 후보 refresh가 필요하면 on-demand `claude --permission-mode bypassPermissions -p "/study-topic-recommender ..."`로 별도 실행한다.

### 결과

- 매일 알림의 토큰 비용과 채널 소음을 줄인다.
- 사용자는 `#병태-이직준비방`에서 바로 공부할 주제만 본다.
- 동적 후보 발굴 경로는 유지하되 매일 cron의 기본 비용으로 만들지 않는다.

### 적용

- `docs/flow.md`
- OpenClaw cron `career-os:daily-study-topic-recommendation`

---

## ADR-073 — daily study 추천은 Discord 버튼으로 초안 생성을 요청할 수 있다

- Status: Accepted
- Date: 2026-06-09

### 맥락

daily study cron 메시지는 이제 실행 로그가 아니라 오늘 공부할 주제 3개와 추천 이유만 보여준다.
사용자는 대화를 추가로 입력하지 않아도 추천 topic을 study-pack 초안 생성으로 이어 가고 싶어 한다.
다만 공개 최종화, `[초안]` 제거, fos-study publish는 명시적 확인이 필요한 별도 단계다.

### 결정

- `_shared/lib/notify_discord.ts`는 OpenClaw shared `presentation` payload를 전달할 수 있도록 `--presentation <json>`을 지원한다.
- daily study cron은 `scripts/study-topic-recommender/send_daily_recommendation.ts`를 실행한다.
- 이 script는 `refresh_topic_inventory.ts`를 실행한 뒤 추천 3개를 짧게 렌더링하고, Discord 버튼을 함께 보낸다.
- 버튼은 `1번 초안 생성`, `2번 초안 생성`, `3번 초안 생성`, `오늘은 넘김`으로 둔다.
- 버튼 callback 매핑은 `data/runtime/study-topic-actions/YYYY-MM-DD.json`과 `latest.json`에 저장한다.
- `career.study-pack.create:*`는 study-pack 초안 생성 요청이다. 공개 최종화나 `[초안]` 제거가 아니다.
- `career.study-pack.skip:*`는 그날 추천을 넘긴 기록이다. 해당 topic을 영구 제외하지 않는다.
- Discord component 유효시간은 24시간으로 설정한다.

### 결과

- daily 추천 메시지는 짧게 유지하면서도 바로 다음 action으로 연결된다.
- 공개 발행 경계는 유지된다.
- callback은 runtime snapshot을 통해 날짜와 topic-key를 검증할 수 있다.

### 적용

- `_shared/lib/notify_discord.ts`
- `scripts/study-topic-recommender/send_daily_recommendation.ts`
- `docs/flow.md`
- `docs/code-architecture.md`
- `docs/data-schema.md`
- OpenClaw cron `career-os:daily-study-topic-recommendation`

---

## ADR-074 — position source coverage는 official adapter와 Wanted target discovery를 함께 쓴다

- Status: Accepted
- Date: 2026-06-11

### 맥락

포지션 추천은 NHN보다 나은 회사군을 우선 탐색해야 한다.
하지만 daily runner 기본 Wanted broad scan만으로는 카카오, 네이버, 쿠팡, 라인 같은 선호 회사의 active 공고가 자주 누락된다.
반대로 모든 회사의 공식 채용 사이트가 안정적인 API를 제공하지는 않는다.
특히 Coupang 공식 careers는 curl/agent-browser 접근에서 Cloudflare 차단을 반환할 수 있다.
다만 공식 `sitemap.xml`은 접근 가능하고 개별 job URL을 제공하며, Bun fetch detail은 일부 환경에서 통과한다.

### 결정

- official source adapter를 추가할 수 있는 회사는 source별 adapter로 수집한다.
- KakaoMobility와 NAVER Careers는 1차 official adapter로 추가한다.
- Coupang처럼 공식 detail/listing HTML이 fetch에서 차단되는 회사는 Wanted target keyword discovery를 1차 fallback으로 유지한다.
- Coupang 공식 `coupang.jobs`는 `sitemap.xml` 기반 official sitemap adapter를 추가하고, 가능한 경우 detail fetch로 JD를 보강한다.
  detail fetch 실패는 diagnostics와 risk flag에 남기고, JD 상세/근무지는 후속 browser/manual 확인 대상으로 둔다.
- Wanted adapter는 broad scan 외에 선호 회사 키워드 검색을 수행하고, detail API `status=active`로 검증된 개별 공고만 snapshot에 넣는다.
- 새 source는 `--source all` shadow 검증을 먼저 거친다.
- 2026-06-11 shadow 검증에서 active/direct guard가 통과했으므로 daily runner 기본값을 `POSITION_RECOMMENDER_SOURCE=all`로 전환한다.

### 결과

- 선호 회사군 공고가 Wanted 최신순 broad scan 뒤에 묻히는 문제를 줄인다.
- 공식 adapter가 가능한 source와 fallback discovery가 필요한 source를 분리해 운영할 수 있다.
- Coupang은 공식 direct job URL을 수집하고 detail fetch가 성공하면 JD까지 제공하되, 차단/레벨 mismatch 가능성은 추천에서 보수적으로 확인하게 한다.
- active/open direct posting guard는 기존과 동일하게 유지된다.

### 적용

- `scripts/position-recommender/live-postings/adapters/`
- `scripts/position-recommender/live-postings/types.ts`
- `scripts/position-recommender/collect_live_postings.ts`
- `docs/flow.md`
- `docs/code-architecture.md`

---

## ADR-077 — position daily runner는 Claude 무출력 hang을 실패로 처리한다

- Status: Accepted
- Date: 2026-06-12

### 맥락

KakaoPay official source 확장 후 수집 snapshot은 정상 생성됐지만, 최종 LLM 추천 리포트 생성에서 Claude가 6분 넘게 무출력으로 실행되고 오늘 report/runtime을 갱신하지 않는 사례가 있었다.
기존 TS runner는 `spawnSync`와 `stdio: inherit`로 Claude 종료만 기다렸기 때문에 cron에서도 같은 상태로 오래 물릴 수 있었다.

### 결정

- `scripts/position-recommender/run_daily_with_claude.ts`가 Claude 호출을 직접 감시한다.
- Claude 호출은 `--output-format stream-json --include-partial-messages --verbose`를 사용해 진행 출력이 타이머를 갱신할 수 있게 한다.
- raw stream-json은 기본적으로 cron 로그에 흘리지 않고, 30초 간격 진행 표시만 남긴다.
  디버깅이 필요하면 `POSITION_RECOMMENDER_CLAUDE_LOG_STREAM=1`로 원문 stream을 출력한다.
- 기본 총 실행 제한은 `POSITION_RECOMMENDER_CLAUDE_TIMEOUT_MS=540000`이다.
- 기본 무출력 제한은 `POSITION_RECOMMENDER_CLAUDE_NO_OUTPUT_MS=240000`이다.
- stdout/stderr 출력이 있으면 무출력 타이머를 갱신한다.
- 제한을 넘기면 Claude에 `SIGTERM`을 보내고, 짧은 유예 후에도 종료되지 않으면 `SIGKILL`을 보낸다.
- Claude가 종료되더라도 오늘 날짜 report/runtime freshness 검증과 active/open direct posting 검증을 통과하지 못하면 실패로 처리한다.
- daily 기본 프롬프트는 SKILL.md와 수집 snapshot을 활용하는 압축 컨텍스트로 줄인다.

### 결과

- cron이 Claude 무출력 상태에서 무기한 대기하지 않는다.
- 실패 원인은 timeout, no-output, stale-output 중 어디인지 stderr에 남는다.
- 기본 추천 정책은 SKILL.md와 docs를 단일 출처로 유지하고, runner 인자에는 운영상 필요한 짧은 focus만 전달한다.

### 적용

- `scripts/position-recommender/run_daily_with_claude.ts`
- `docs/flow.md`
- `docs/code-architecture.md`

---

## ADR-078 — 포지션 추천 freshness는 frontdoor와 priority 갱신까지 포함한다

- Status: Accepted
- Date: 2026-06-12

### 맥락

ADR-077로 position daily runner는 최신 추천 리포트 생성 실패를 감지하게 됐다.
하지만 dashboard가 읽는 `frontdoor-queue.jsonl`과 priority snapshot은 별도 runner가 갱신해야 해서, 추천 리포트가 최신이어도 application workbench는 오래된 후보와 action stage를 보여줄 수 있었다.

또한 fos-career web container는 career-os를 읽기 전용으로 mount한다.
이는 dashboard 안전 경계에는 맞지만, pending request processor가 career-os 원장을 갱신하려면 host-side writable checkout에서 실행돼야 한다.
interview request processor에는 host-side wrapper가 있었지만 position/application action processor에는 같은 운영 진입점이 없었다.

### 결정

- position daily runner의 성공 기준은 최신 `position-recommendation.md` 생성에서 끝나지 않는다.
- daily runner 성공 후 frontdoor queue builder와 priority recommendation refresh를 순서대로 실행한다.
- frontdoor queue 갱신은 기존 user decision과 protected status를 보존해야 한다.
- priority refresh는 recommendation snapshot을 갱신하되 user-confirmed priority를 덮어쓰지 않는다.
- fos-career write processor는 web container 안이 아니라 host-side wrapper로 실행한다.
- host-side wrapper는 `.env`를 로드하고, Docker network hostname을 host-published MySQL port로 보정한다.
- dashboard container에 writable career-os mount를 주는 대안은 거절한다.

### 결과

- daily 추천 알림과 dashboard application workbench가 같은 최신 추천 cycle을 보게 된다.
- 사용자가 `지원 준비`, `보류`, `제외`를 누른 뒤 processor를 실행할 운영 진입점이 명확해진다.
- web app의 read-only mount 안전 경계는 유지된다.
- 단점은 daily runner가 추천 리포트 생성 외에도 queue/priority refresh 실패를 함께 다뤄야 한다는 점이다.

### 적용

- `scripts/position-recommender/run_daily_with_claude.ts`
- `scripts/application-agent/frontdoor_queue_builder.ts`
- `scripts/application-agent/priority_recommendation.ts`
- `/home/bifos/services/fos-career/scripts/run-*-processor.sh`
- `docs/flow.md`
- `docs/code-architecture.md`

---

## ADR-079 — 포지션 수집은 동적 discovery를 우선하고 개별 공고 URL seed를 제거한다

- Status: Accepted
- Date: 2026-06-14

### 맥락

AI 전환 직무를 더 넓게 보려면 Toss, Wanted, 카카오계열, NAVER 계열, Coupang의 active 공고를 폭넓게 수집해야 한다.
기존 adapter 일부는 listing/API 수집을 보강하기 위해 특정 공고 URL을 `KNOWN_TARGET_URLS` 형태로 들고 있었다.
이 방식은 bootstrap 단계에서는 빠르게 검증할 수 있지만, 공고가 닫히면 stale URL이 diagnostics와 검증 흐름을 오염시킨다.
또한 "왜 이 공고만 계속 보는가"가 코드에 숨겨져 source coverage를 왜곡한다.

### 결정

- adapter의 기본 발견 방식은 official listing, official API, sitemap, keyword search다.
- 개별 공고 URL이나 Wanted 공고 ID는 adapter 코드에 하드코딩하지 않는다.
- 허용되는 URL 상수는 source discovery에 필요한 root entrypoint다.
  예: careers listing URL, public API URL, sitemap URL.
- 특정 공고 URL은 테스트 fixture, 문서 예시, 과거 리포트 검증 자료로만 둔다.
- Toss는 공식 `job-groups` API를 1차 source로 유지한다.
- Wanted는 broad scan과 keyword search로 선호 회사와 AI 전환 직무를 수집한다.
- 카카오계열은 GreetingHR 또는 공식 careers listing에서 detail URL을 발견하는 adapter를 계열사별로 확장한다.
- NAVER 계열은 공식 careers listing/API가 확인된 source만 adapter에 추가한다.
- Coupang은 공식 sitemap source를 유지하고, detail fetch 차단 시 diagnostics와 risk flag로 남긴다.
- stale 개별 공고 URL 부재는 phase block 사유가 아니다.
  block은 snapshot 후보가 0개이거나 active/open direct posting guard가 깨질 때만 발생한다.

### 결과

- 닫힌 과거 공고가 daily queue와 phase 검증을 막지 않는다.
- source별 coverage는 코드에 박힌 공고 ID가 아니라 발견 가능한 active 공고로 결정된다.
- AI/Backend 전환 직무 recall은 keyword/API/listing coverage로 높이고, 추천 티어는 여전히 active/open 개별 공고만 허용한다.
- 단점은 공식 listing/API 구조가 바뀔 때 source별 parser 유지보수가 필요하다는 점이다.

### 적용

- `scripts/position-recommender/live-postings/adapters/`
- `scripts/position-recommender/live-postings/adapters/README.md`
- `scripts/position-recommender/live-postings/policy.ts`
- `scripts/position-recommender/collect_live_postings.ts`
- `docs/flow.md`
- `docs/code-architecture.md`
- `docs/data-schema.md`

---

## ADR-080 — position daily HTML 리포트는 template 기반 표시 미러로 둔다

- Status: Accepted
- Date: 2026-06-14

### 맥락

아침 포지션 추천은 Discord 본문으로만 읽기에는 정보 밀도가 높다.
사용자는 추천 티어, 회사, 직무, 링크, 이유, 확인할 점을 모바일과 브라우저에서 더 잘 훑어보고 싶어 한다.

현재 daily runner는 Markdown 리포트 검증 뒤 `render_report_html.ts`로 단순 HTML을 만들고 Discord에 첨부한다.
하지만 HTML 구조와 CSS가 renderer 코드 안에 섞여 있어 시각 스타일을 다듬을수록 파서, template, runner 책임이 흐려진다.

### 결정

- 포지션 daily HTML은 Markdown 추천 리포트의 표시 미러로 둔다.
- 사람용 내용 정본은 `data/reports/daily/YYYY-MM-DD/position-recommendation/report.md`와 `data/runtime/position-recommendation.md`다.
- HTML 보존본은 기존처럼 `data/reports/daily/YYYY-MM-DD/position-recommendation/report.html`에 둔다.
- runtime HTML 미러는 기존처럼 `data/runtime/position-recommendation.html`에 둔다.
- 표시 template은 `scripts/position-recommender/templates/report.html`에 둔다.
- `render_report_html.ts`는 Markdown 파싱, 안전한 HTML escaping, template 주입을 맡는다.
- daily runner는 HTML 생성 실패를 알림 성공으로 숨기지 않는다.
- Discord 본문은 짧은 triage로 유지하고, 자세한 읽기는 HTML 첨부와 Markdown 정본에 맡긴다.
- HTML 스타일은 SaaS/dashboard형으로 조용하게 둔다.
  landing page hero, 과한 장식, 텍스트 겹침, 모바일 링크 깨짐은 피한다.
- template 파일은 ASCII 중심으로 작성한다.
  한국어 리포트 콘텐츠는 renderer 입력에서 주입한다.

### 결과

- HTML 리포트의 시각 스타일을 코드 로직과 분리해 고칠 수 있다.
- daily runner의 산출물 경로와 Discord 첨부 흐름은 유지된다.
- Markdown 정본과 HTML 미러의 책임이 분리되어 후속 application workbench와 충돌하지 않는다.
- 단점은 renderer가 Markdown 구조를 안정적으로 해석하고 template placeholder 계약을 검증해야 한다는 점이다.

### 적용

- `scripts/position-recommender/render_report_html.ts`
- `scripts/position-recommender/templates/report.html`
- `scripts/position-recommender/run_daily_with_claude.ts`
- `docs/flow.md`
- `docs/code-architecture.md`
- `docs/data-schema.md`
- `tasks/plan072-position-report-html-template/`

---

## ADR-081 — 지원 후보 상태와 background outbox는 fos-career DB를 정본으로 둔다

- Status: Accepted
- Date: 2026-06-14

### 맥락

기존 포지션 추천 흐름은 daily Markdown 리포트에서 추천 카드를 추출해 `frontdoor-queue.jsonl`에 저장한 뒤, 사용자가 선택한 후보만 `ledger.jsonl`로 승격했다.
이 구조는 agent-first workflow에서는 빠르게 동작했지만, 웹 대시보드가 중심이 되자 세 가지 문제가 드러났다.

- `frontdoor queue`라는 이름이 사용자 관점에서 의미를 설명하지 못한다.
- HTML 리포트 카드와 실제 action 가능한 queue record를 다시 매칭해야 한다.
- 제외, 보류, 지원 시작 같은 현재 상태를 웹 대시보드에서 일관되게 필터링하기 어렵다.

사용자는 앞으로 웹 대시보드를 최대한 활용하고, 그날 HTML 리포트는 읽기용 snapshot으로 두며, 최종 상태는 DB로 보는 구조를 원한다.
또한 카드 전체 클릭은 외부 제출이 아니라 내부 지원 시작 workflow로 해석하기로 했다.

### 결정

- `frontdoor queue`를 새 workflow 용어로 사용하지 않는다.
- 화면 용어는 `지원 후보`로 둔다.
- 내부 모델은 `application candidate state`로 둔다.
- 추천 후보 상태와 stage의 정본은 fos-career MySQL이다.
- `frontdoor-queue.jsonl`은 DB import와 diff 검증 후 삭제한다.
- 포지션 추천 run은 Markdown/HTML 리포트와 함께 structured recommendation item을 만든다.
- fos-career는 recommendation item을 DB로 ingest한다.
- 같은 공고는 candidate key unique constraint로 중복 생성하지 않는다.
  - 1차 key는 normalized posting URL hash다.
  - URL이 없거나 불안정하면 `company + title + source + closeDate` fallback hash를 쓴다.
- 지원 후보는 `state`와 `stage`를 분리해 관리한다.
  - `state`: `recommended`, `held`, `excluded`, `started`, `closed`.
  - `stage`: `company_analysis`, `posting_analysis`, `fit_analysis`, `study_pack`, `resume_draft`, `submitted`, `resume_passed`, `interview_prep`.
- state/stage 의미와 전이 규칙은 master/transition table로 관리한다.
- 카드 전체 클릭은 `지원 시작`으로 처리한다.
- `지원 시작`은 내부 workflow 시작이다.
  회사 분석, 공고 분석, fit 분석, 공부팩 생성, 이력서 초안, 제출 후 면접 대비까지 포함한다.
- 실행은 dependency 순서대로 진행한다.
  첫 실행 묶음은 회사 분석, 공고 분석, fit 분석이다.
- 공부팩과 이력서 초안은 fit 분석 결과가 준비된 뒤 다음 stage로 실행한다.
- 오래 걸리는 skill 실행은 fos-career DB outbox job으로 관리한다.
- worker는 pending job을 주기적으로 lock해 처리하고, 재시도와 실패 상태를 DB에 남긴다.
- HTML 리포트는 그날의 읽기용 snapshot이며 action source가 아니다.
- 외부 제출, 업로드, 로그인, 공개 발행은 계속 사용자 별도 승인 밖에서 실행하지 않는다.

### 결과

- 대시보드가 추천 후보의 현재 상태를 한 곳에서 판단할 수 있다.
- 제외한 후보는 다음 추천 화면에 다시 기본 노출되지 않는다.
- 보류, 제외, 지원 시작, 서류 통과, 면접 대비 같은 상태가 리포트 HTML과 독립적으로 유지된다.
- report card와 queue record를 URL로 다시 맞추는 fragile matching을 줄인다.
- legacy `frontdoor-queue.jsonl`과 `user_position_action_requests`는 migration compatibility가 된다.
- DB schema, migration, worker, 대시보드 UI가 함께 바뀌는 큰 작업이므로 plan073으로 phase를 나눠 진행한다.

### 적용

- `docs/prd.md`
- `docs/data-schema.md`
- `docs/flow.md`
- `docs/code-architecture.md`
- `AGENTS.md`
- `tasks/plan073-dashboard-application-candidate-state/`

---

## ADR-082 — fos-career 모바일 UX는 하단 네비게이션과 전체 공고 탐색을 분리한다

- Status: Accepted
- Date: 2026-06-15

### 맥락

fos-career 대시보드는 포지션, 리포트, 소스 진단, 지원 현황, 우선 행동, 면접 hub로 메뉴가 늘었다.
모바일 상단 메뉴는 계속 가로로 늘어나며 실제 조작성이 떨어진다.

동시에 대시보드에는 두 종류의 포지션 데이터가 있다.
하나는 collector가 가져온 전체 수집 공고 풀이고, 다른 하나는 position recommender가 그중에서 선별한 지원 후보 5개다.
두 화면이 섞이면 사용자는 왜 후보가 5개인지, 수집된 나머지 공고는 어디서 보는지 이해하기 어렵다.

plan073 구현 뒤 확인한 structured recommendation item에는 `priorityReason`, `nextAction`, `evidenceUrls`가 null로 남는 사례가 있었다.
Markdown 리포트에는 근거가 있는데 DB snapshot이 비어 있으면 모바일 카드가 빈약해지고, 같은 DB 연동 실수를 반복할 수 있다.

### 결정

- 모바일 shell은 하단 네비게이션과 햄버거 또는 더보기 메뉴를 함께 사용한다.
- 하단 네비게이션 기본 항목은 `홈`, `공고`, `후보`, `지원`, `더보기`다.
- `공고`는 `collected_positions` 전체 풀을 보는 화면이다.
- `후보`는 position recommender가 선별한 application candidate 화면이다.
- 리포트, 소스 진단, 우선 행동, 면접 hub는 햄버거 또는 더보기 메뉴에서 접근한다.
- `/dashboard/positions`는 검색, 필터, 정렬, source diagnostics 접힘 영역을 갖춘 전체 공고 탐색 화면으로 개선한다.
- 추천 후보로 승격된 공고는 전체 공고 목록에서도 badge 또는 링크로 드러낸다.
- 추천 후보 카드 표시는 `latestSnapshotJson.priorityReason`, `nextAction`, `riskFlags`, `evidenceUrls`를 우선한다.
- Markdown 리포트에 있는 추천 이유와 다음 행동은 structured recommendation item 생성 또는 ingest 단계에서 누락 없이 추출한다.
- 추출 누락은 null로 조용히 통과시키지 않고 검증 로그나 dry-run summary에서 드러낸다.
- 작업 완료 후 당일 포지션 추천을 재실행하고, Toss 계열 쿨다운 해제와 구조화 추출 결과가 DB에 반영됐는지 확인한다.

### 결과

- 모바일에서 메뉴가 늘어나도 핵심 행동은 하단 네비게이션으로 유지된다.
- 전체 공고 탐색과 추천 후보 검토가 서로 다른 사용자 과업으로 분리된다.
- 지원 후보 5개는 “전체 수집 공고 중 선별된 후보”로 설명된다.
- 추천 카드가 빈 이유/다음 행동으로 보이는 문제가 줄어든다.
- 수집 공고 화면이 단순 raw list에서 실제 탐색 도구로 진화한다.

### 적용

- `docs/prd.md`
- `docs/data-schema.md`
- `docs/flow.md`
- `docs/code-architecture.md`
- `tasks/plan074-fos-career-mobile-position-explorer/`

---

## ADR-083 — source registry와 collection run은 fos-career DB가 정본이다

- Status: Accepted
- Date: 2026-06-15

### 맥락

fos-career 소스 진단 탭은 DB에 들어간 `collected_positions` 행의 `sourceDiagnostics` 텍스트를 다시 해석해 source 목록을 만들고 있었다.
이 때문에 최신 수집 설정에는 7개 source가 있어도 대시보드에는 과거 import에 남은 4개 source만 보였다.

최근 포지션 추천 재실행은 추천 후보 DB ingest를 갱신했지만, 전체 수집 snapshot import와 source diagnostics 갱신을 함께 보장하지 않았다.
추천 후보와 수집 공고 pool, source diagnostics가 서로 다른 최신성을 갖는 구조가 된 것이다.

사용자는 source 목록도 DB에서 관리하고, 앞으로 DB 연동 실수를 반복하지 않도록 수집 실행 자체를 추적하길 원한다.
또한 Naver Careers와 KakaoPay Securities처럼 0건 source가 있을 때 단순 0건이 아니라 왜 0건인지 후속 진단할 수 있어야 한다.

### 결정

- source registry와 collection run 상태는 fos-career MySQL이 정본이다.
- career-os `live-postings` adapter registry는 실제 수집 방법과 official entrypoint를 계속 소유한다.
- DB source registry는 dashboard 표시와 enable/disable 상태의 기준이다.
- 새 테이블을 도입한다.
  - `position_sources`
  - `position_collection_runs`
  - `position_source_run_diagnostics`
- `collected_positions`는 개별 공고 pool만 담당한다.
- `collected_positions.sourceDiagnostics` 같은 반복 저장 진단 텍스트는 migration compatibility로만 남긴다.
- source diagnostics 화면은 `collected_positions`에서 source 목록을 역산하지 않는다.
- source diagnostics 화면은 registry와 최신 collection run diagnostics를 읽는다.
- collection snapshot import는 Claude 추천 생성보다 먼저 수행한다.
- 추천 run은 사용한 `collectionRunId`를 참조한다.
- 추천 생성이나 recommendation ingest가 실패해도 collection run과 source별 diagnostics는 DB에 남긴다.
- source별 0건은 `zeroReason` 또는 `failureReason`으로 분리한다.
  - 정상 0건
  - 필터 과도
  - 파서 변경
  - 차단
  - 비활성
  - 알 수 없음
- registry에 있는 enabled source는 imported count가 0이어도 dashboard에 표시한다.
- Naver Careers와 KakaoPay Securities의 0건 원인은 plan075 후속 phase에서 source별로 진단한다.

### 결과

- source diagnostics가 오래된 collected position row에 끌려가지 않는다.
- "소스가 몇 개인가"와 "이번 run에서 몇 건을 import했는가"를 분리해 볼 수 있다.
- 추천 후보 5개가 어떤 collection run에서 나왔는지 추적할 수 있다.
- source별 실패가 다른 source 수집과 dashboard 표시를 막지 않는다.
- 0건 source를 정상 상태와 장애 상태로 구분할 수 있다.
- 단점은 DB schema, import pipeline, runner, dashboard가 함께 바뀌므로 plan075로 phase를 나눠 진행해야 한다는 점이다.

### 적용

- `docs/prd.md`
- `docs/data-schema.md`
- `docs/flow.md`
- `docs/code-architecture.md`
- `tasks/plan075-fos-career-source-registry-collection-runs/`

---

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

---

## ADR-085 — career-os skill을 Codex에 심볼릭 링크로 노출한다

- Status: Accepted
- Date: 2026-06-15

### 맥락

career-os의 주요 자동화는 `career-os/.claude/skills/<skill>/SKILL.md`에 정리되어 있다.
기존 운영 문서는 `claude -p "/<skill>"` 호출을 표준으로 두었지만, Claude CLI 호출 비용 때문에 같은 흐름을 Codex에서도 직접 실행할 필요가 생겼다.

단순 wrapper로 `claude -p`를 호출하면 비용 문제가 해결되지 않는다.
또 `.claude/skills`와 `.codex/skills`에 본문을 복사하면 같은 workflow가 두 곳에서 갈라질 위험이 크다.

### 결정

- `career-os/.claude/skills/<skill>/SKILL.md`를 agent skill 정본으로 유지한다.
- Claude 전용 표현은 현재 에이전트가 직접 파일을 읽고 쓰며 셸 명령을 실행하는 표현으로 바꾼다.
- Codex 노출 경로는 `career-os/.codex/skills/<skill>` 심볼릭 링크로 둔다.
- 이번 연결 대상은 실제 `SKILL.md` 본문이 저장소 안에 있는 10개 skill이다.
  - `application-package-writer`
  - `application-reviewer`
  - `candidate-baseline-suggester`
  - `daily-application-digest`
  - `interview-asset-writer`
  - `interview-prep-analyzer`
  - `position-recommender`
  - `question-bank-collector`
  - `study-pack-writer`
  - `study-topic-recommender`
- `docs-audit`는 `sources/fos-study` 외부 repo로 향하는 기존 심볼릭 링크이므로 이번 Codex 링크 대상에서 제외한다.
  fos-study checkout이 있는 실행 환경에서 별도 검토한다.
- 기존 cron/runner 파일명에 남은 `claude`는 호환 계층 이름으로만 본다.
  새 대화형 작업에서는 Claude CLI wrapper를 추가하지 않는다.

### 결과

- Codex가 career-os skill 흐름을 같은 본문으로 읽고 실행할 수 있다.
- skill 본문 정본이 하나라서 Claude/Codex 간 drift가 줄어든다.
- Claude CLI 비용 문제를 wrapper 없이 회피한다.
- `.codex/skills` 링크가 깨지는지 검증하면 Codex 노출 상태를 빠르게 확인할 수 있다.
- 단점은 `.claude/skills`라는 디렉터리 이름이 historical name으로 남는다는 점이다.
  문서에서는 agent skill 정본으로 해석한다.

### 적용

- `career-os/.claude/skills/*/SKILL.md`
- `career-os/.codex/skills/`
- `career-os/AGENTS.md`
- `career-os/docs/code-architecture.md`

---

## ADR-086 — skill 출력 정책은 공통 reference로 둔다

- Status: Accepted
- Date: 2026-06-15

### 맥락

ADR-057로 생성 산출물 품질 계약을 전역 기준으로 정했지만,
각 `SKILL.md`가 같은 문장을 반복해서 품고 있었다.
이 구조는 Codex skill의 progressive disclosure 원칙과 맞지 않는다.
또 skill마다 공개 발행, 제출 자동화, 내부 경로 노출 금지의 표현이 조금씩 달라질 수 있어 정책 drift가 생기기 쉽다.

### 결정

- 공통 출력 정책은 `career-os/.claude/skills/_shared/references/output-policy.md`에 둔다.
- 각 대상 skill의 `references/output-policy.md`는 공통 정책 파일을 가리키는 심볼릭 링크로 둔다.
- 각 skill의 `SKILL.md` 본문은 skill 디렉터리 기준 `references/output-policy.md`를 먼저 읽으라고 안내한다.
- 각 skill에는 작업별 차이만 짧게 남긴다.
- 공개 산출물은 `[초안]` 상태를 기본으로 두고, 공개 발행과 commit/push는 사용자 명시 승인 뒤에만 수행한다.
- 비공개 산출물은 근거 경로와 리스크 판단을 유지하되, 외부 제출용 문장과 Discord 요약에는 내부 맥락을 섞지 않는다.
- `docs-audit`처럼 외부 repo skill로 향하는 심볼릭 링크는 이번 정책 공통화 대상에서 제외한다.

### 결과

- Codex가 skill 본문을 읽을 때 반복 정책보다 실제 workflow에 더 많은 context를 쓸 수 있다.
- Claude와 Codex가 같은 공통 출력 정책을 공유한다.
- ADR-005의 즉시 발행 관성은 폐기되고, 공개 발행은 사용자 승인 뒤에만 진행한다.
- 이후 새 career-os skill은 공통 출력 정책을 참조하고, skill 고유 제약만 본문에 추가하면 된다.

### 적용

- `career-os/.claude/skills/_shared/references/output-policy.md`
- `career-os/.claude/skills/*/references/output-policy.md`
- `career-os/.claude/skills/*/SKILL.md`

---

## ADR-087 — skill 트리거는 frontmatter description에 둔다

- Status: Accepted
- Date: 2026-06-16

### 맥락

Codex skill은 `SKILL.md` 본문을 읽기 전에 frontmatter의 `name`과 `description`만 보고 skill 사용 여부를 판단한다.
따라서 본문 `When to use` 섹션에 자연어 트리거를 많이 적어도 실제 호출 정확도에는 도움이 작다.

career-os skill들은 Claude native skill 시절의 관성으로 본문 `When to use`에 트리거 목록을 반복해서 담고 있었다.
이 구조는 Codex 호출 입장에서 중요한 라우팅 신호를 늦게 제공한다.

### 결정

- skill 사용 여부를 결정하는 자연어 트리거, 슬래시 호출 형태, 주요 라우팅 경계는 frontmatter `description`에 둔다.
- 본문 `When to use` 섹션은 제거한다.
- 호출된 뒤 필요한 세부 판단은 `호출 후 입력 해석`, `호출 후 모드 해석`, `호출 후 범위 해석` 같은 실행 기준으로 남긴다.
- `description`에는 해당 skill이 하지 않는 주요 금지 경계도 짧게 포함한다.
  예: 공개 발행 금지, 실제 제출 금지, 자동 config 수정 금지.
- 새 career-os skill을 만들 때도 `description`을 1차 트리거 표면으로 보고 작성한다.

### 결과

- Codex가 본문을 열기 전에 더 정확하게 career-os skill을 선택할 수 있다.
- 본문은 이미 호출된 뒤의 실행 절차와 입력 해석에 집중한다.
- Claude와 Codex가 같은 skill 본문을 공유하면서도 Codex의 progressive disclosure 원칙을 더 잘 따른다.

### 적용

- `career-os/.claude/skills/*/SKILL.md`

## ADR-088 — career-os에서 docs-audit 스킬 심링크를 제거한다

- Status: Accepted
- Date: 2026-06-16

### 맥락

`docs-audit`는 fos-study 외부 repo의 스킬로 향하는 심볼릭 링크였다.
ADR-085(Codex 노출)와 ADR-086(출력 정책 공통화)은 이 심링크가 외부 repo를 정본으로 두기 때문에 두 정책의 공통화 대상에서 예외로 제외했다.

문제는 career-os 단독 checkout 환경에는 `sources/fos-study`가 없다는 점이다.
이때 `.claude/skills/docs-audit/SKILL.md` 심링크는 항상 깨진 상태로 남는다.
스킬 목록에 실행 불가능한 항목이 상주해 신규 에이전트가 실효 없는 스킬을 발견하고, `code-architecture.md`와 `data-schema.md`가 이를 "실체 디렉터리"라고 기술해 혼란을 키운다.
docs-audit는 본래 fos-study 문서를 감사하는 스킬이므로 career-os 워크스페이스에서 호출할 일도 사실상 없다.

### 결정

- career-os의 `.claude/skills/docs-audit/` 디렉터리를 제거한다.
- docs-audit가 필요한 작업은 fos-study repo checkout 환경에서 그 repo의 스킬을 직접 실행한다.
- 거절한 대안 — 심링크 유지: 깨진 채 상주해 발견 가능성만 남고 실행은 불가하므로 가치가 없다.
- 거절한 대안 — SKILL.md를 career-os 내부로 복제: fos-study 정본과 이중 관리가 되고 거울 구조 원칙에 어긋난다.

### 결과

- career-os 스킬 목록이 이 워크스페이스에서 실제 실행 가능한 스킬만 노출한다.
- ADR-085·086이 docs-audit를 예외로 두던 근거가 사라진다 — 두 ADR의 docs-audit 예외 항목은 본 ADR 이후 무효다.
- 단점 — fos-study 문서 감사가 필요하면 fos-study checkout으로 이동해 그 repo의 스킬을 실행해야 한다.
