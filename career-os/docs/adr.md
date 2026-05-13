# ADR — career-os 아키텍처 결정 기록

career-os의 모든 아키텍처 결정을 시간순으로 누적 기록한다. 새 결정은 가장 아래에 추가한다.

형식: `## ADR-N — 제목` + status / date 라인 + **맥락 / 결정 / 결과** 3섹션. 폐기·supersede는 status 라인에 명기.

본 파일은 기존 `docs/decisions/NNN-*.md` 14개를 통합·압축한 결과이며, 통합 시점부터 단일 출처다. 개별 파일들은 git history로 보존된다.

---

## ADR-001 — Daily 파일 선택 전략

- Status: 결정됨
- Date: 2026-04-13

### 맥락
`run_daily.sh`는 설계상 매일 3-5개 고가치 파일만 분석해야 했지만, `build_target_file_list.py`가 `database/`, `architecture/`, `java/`, `interview/` 전체를 긁어 70+개 파일을 생성하고 있었다. 의도와 구현이 어긋난 상태.

### 결정
- `config/topic-file-map.json`에 토픽 → 파일 목록 매핑 관리.
- `run_daily.sh`는 `DAILY_TOPIC` env 또는 `run_now.sh` 두 번째 인자로 토픽을 받는다.
- 토픽 미지정 시 `data/study-progress.json`에서 `last_studied`가 가장 오래된 약점 토픽 자동 선택.
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
`data/study-progress.json`에 세션 + 약점 토픽별 진도를 하이브리드 포맷(sessions 배열 + weak_spots 맵)으로 기록. `run_daily.sh`가 성공 후 자동 업데이트. 스키마 상세는 `docs/data-schema.md` 참조.

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

- Status: 결정됨
- Date: 2026-04-14

### 맥락
career-os는 내부 산출물 외에도 외부 블로그(`sources/fos-study`)와 동기화되는 문서를 만든다. 별도 수동 반영 단계는 흐름을 느리게 하지만 즉시 공개 저장소에 반영하면 변경 이력 추적 규칙이 필요하다.

### 결정
- study pack 출력 대상은 항상 `sources/fos-study`.
- 즉시 대상 경로에 기록. 제목에 `[초안]` 표시.
- 생성·갱신 직후 개별 commit + push.
- commit 메시지: `docs(<domain>): add|update draft <topic> study pack`.
- 경로 규칙: MySQL → `database/mysql/<topic>.md`, Redis → `database/redis/<topic>.md`, Kafka → `kafka/<topic>.md`, Spring/JPA → `java/spring/<topic>.md`, 일반 DB → `database/<topic>.md`.
- 내부 `data/reports/`는 실행 로그·중간 산출물 용도.

### 결과
- 생성 결과가 블로그 동기화 경로와 즉시 일치.
- 초안 상태 명시. 변경 이력은 topic 단위 commit으로 추적.

---

## ADR-006 — Study-pack 엔트리포인트와 topic 라우팅

- Status: 결정됨
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

## ADR-007a — Experience-based interview question bank workflow

- Status: Accepted
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

### 비고
번호 충돌 — ADR-007b와 같은 번호. 다음 정리 사이클에서 리넘버링 예정.

---

## ADR-007b — Study-pack 생성: 파일 쓰기 → stdout 캡처

- Status: 채택됨 (2026-04-14). **출력 포맷 폐기 부분은 사실상 무효화**. 핵심 결정(Write 도구 사용 금지)은 유지. 자세한 진단·복구는 ADR-014.
- Date: 2026-04-14

### 맥락
`run_study_pack.sh`가 Claude에게 "파일에 쓰기 + 한 줄 응답"이라는 두 지시를 동시에 줘서 prompt 충돌이 발생. Claude가 파일을 안 쓰고 stdout으로 마크다운을 출력하는 위험도 존재.

### 결정
Claude에게 Write 도구로 파일 쓰기를 시키지 않고, stdout 출력을 직접 `$TMP_DRAFT`로 캡처. 그 과정에서 `--output-format json`을 폐기.

### 결과 (정정)
- prompt 충돌 제거 + Write 도구 의존 제거(유효한 결정).
- **단, JSON 폐기는 부작용으로 토큰 회계 누락을 초래**. 이후 study-pack runner는 다시 `--output-format json`을 채택. ADR-014가 회계 누락의 진짜 원인(자체 extractor가 usage 전파 미구현)을 진단·복구.

### 비고
번호 충돌 — ADR-007a와 같은 번호. 다음 정리 사이클에서 리넘버링 예정.

---

## ADR-008 — Generation status notifications

- Status: Accepted
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

- Status: Accepted
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

- Status: Accepted
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

- Status: Accepted (2026-05-13 실측 검증 완료). 관련: ADR-007b 출력 포맷 결정은 사실상 무효화.
- Date: 2026-05-13

### 맥락
`logs/task-runs.jsonl` 162행 실측 결과 `tokens_*` / `cost_usd` / `model` 4개 필드가 채워진 entry는 baseline / daily 3건뿐. 나머지 159건은 모두 null. 가설(ADR-007b가 JSON 폐기) 추적 결과 **틀렸음** — 실제 원인은 자체 extractor/renderer가 usage 전파 패턴을 구현하지 않은 것.

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
5문서(`prd / data-schema / flow / code-architecture / adr`) 컨벤션을 도입했지만 docs 자체의 *역할*을 명문화하지 않으면 시간이 지나며 다시 흩어진다. 또한 데이터 파일(`*.json`, `*.jsonl`)이 docs/ 아래에 끼어들면 5문서의 "사람이 읽는 단일 출처" 성격이 무너진다.

fos-blog의 plan-and-build 스킬을 ai-nodes에 포팅하면서 사용자가 추가 directive를 제시: docs/는 의사결정·기술 학습을 누적하는 *피드백 루프* 구조여야 하고, 데이터 파일은 반드시 `data/`에 둬야 한다.

### 결정

**docs/ = 피드백 루프**

매 작업 사이클은 docs로 들어와서 docs로 돌아온다.

- 새 의사결정 → `docs/adr.md` 맨 아래 누적 (개별 파일 신설 금지).
- 명세 변경 → `prd.md` / `data-schema.md` / `flow.md` / `code-architecture.md` 중 영향 받는 문서 즉시 갱신.
- 학습·회고 → `docs/learn/YYYY-MM-DD-<topic>.md` (자유 형식, prose).
- 인수인계 / 외부 위임 메모 → `docs/hand-off/`.
- 회사·이벤트별 일회성 준비 → `docs/prep/`.
- legacy `docs/decisions/NNN-*.md` 14개 파일은 history 보존 용도로만 유지. 새 ADR은 그쪽에 추가 금지.

**data/ = 모든 영속 데이터의 단일 위치**

데이터 파일(`*.json`, `*.jsonl`, `*.csv`, 큰 binary 캐시 등)은 반드시 워크스페이스의 `data/` 디렉터리 안에. 자세한 분류는 `docs/data-schema.md`:

- `data/study-progress.json`, `data/generated-artifacts.json` — 진도·산출물 인덱스.
- `data/reports/{baseline,daily}/YYYY-MM-DD/` — 실행 산출물.
- `data/runtime/` — 가변 상태 (토픽 풀, 잠금, 피드 캐시).
- `data/normalized/`, `data/source/` — 정규화·수집 캐시.
- `config/`는 *사람이 큐레이션하는 입력*만 (예: topic list, profile). 자동 생성 데이터를 config/에 두지 않는다.

docs/ 또는 다른 디렉터리에 데이터 파일을 두는 것은 본 ADR 위반.

### 결과
- 새 에이전트가 docs/를 읽으면 *결정·학습 누적의 단일 출처*임을 즉시 알 수 있다.
- 데이터와 의사결정이 디렉터리 레벨에서 분리되어 grep·audit 비용 감소.
- plan-and-build 스킬의 phase 작성 self-check (`common-pitfalls.md`의 3번 카테고리)에서 위반을 즉시 잡아낸다.
- `workspace-audit`은 향후 `docs/` 안의 데이터 파일 또는 `data/`에 누락된 문서를 별도 룰로 검출하도록 강화 가능.

### 적용
- `skills/plan-and-build/references/common-pitfalls.md`의 3번 카테고리에 검증 항목.
- `career-os/AGENTS.md` 5문서 라우팅 + 운영 원칙 섹션에 명시.
- 본 ADR 채택 후 docs/ 안에 데이터 파일이 들어오면 즉시 `data/`로 이동.

---

## ADR-016 — config 디렉터리 통합: 관심사별 단일 파일 + JSON 통일

- Status: Accepted
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

career-os의 단일 dispatcher skill `cj-oliveyoung-java-backend-prep`이 4개 도메인을 한 폴더에 묶고 있다: (1) `run_now.sh` 디스패처 본체와 알림·env 부트스트랩, (2) baseline/daily/smoke 갭 분석, (3) morning 추천 파이프라인(inventory + scoring + feed discovery), (4) topic reservoir 보충/promotion. WIP 3개 entry point(`run_cj_foodville_bootcamp.sh` · `run_morning_live_coding.sh` · `run_morning_question_bank.sh`)는 dispatcher와 미연결 상태로 1개월 넘게 방치돼 있고, 폴더명 자체에 폐기된 회사명 `cj-oliveyoung`이 박혀 있다.

이 잡탕 구조 때문에 새 기능을 어느 skill에 넣어야 하는지 매번 의사결정이 발생하고, 회사명 잔재가 ADR / AGENTS / SKILL.md / dispatcher 코드에 광범위하게 오염돼 있다.

### 결정

`cj-oliveyoung-java-backend-prep` 폴더를 도메인·기능 기준 5개 skill로 분해한다. 새 폴더명은 회사 비종속 + 기능을 직접 표현.

- `command-router` — 디스패처 본체(`run_now.sh`) + `notify_discord.sh` + `setup_env.sh`.
- `knowledge-gap-analyzer` — baseline / daily / smoke 러너 + 파일 선택(`build_target_file_list.py`) + 토픽 선택(`select_topic.py`) + 진행 추적(`update_study_progress.py`).
- `study-topic-recommender` — morning inventory 갱신·점수·오늘의 3선(`refresh_topic_inventory.py` + `feed_discovery.py`) + live-coding dispatch 흡수(WIP wire-up).
- `topic-pool-replenisher` — candidate reservoir 보충 + auto-promotion + replenishment prompt.
- `study-pack-batch` — 부트캠프 일괄 study-pack 생성(`run_cj_foodville_bootcamp.sh` → `run_bootcamp_batch.sh`, 회사명 제거).

morning-question-bank wrapper는 기능적 자매 skill `experience-question-bank-writer`에 흡수. `run_now.sh`에 새 case 3개 추가: `bootcamp-batch` · `live-coding-dispatch` · `auto-question-bank`.

본 ADR 범위에 포함하지 않는 것:
- `skills/<name>/scripts/` 폴더 구조 유지(Claude Skill 표준 컨벤션). 실행 파일을 workspace-level `scripts/`로 이전하는 작업은 plan006에서 별도로 다룬다.
- 자매 skill `cj-foodville-coffeechat-prep`의 회사명 제거. 2026-05-18 면접 활성 자산이라 분리 사이클로 이동.

거절한 대안:
- `core` / `dispatcher` / `analyzer` 같은 짧은 이름 — 의미 과집중·중복 위험. 풀-기능 명사(예: `knowledge-gap-analyzer`)가 새 진입자에게도 즉시 의도 전달.
- WIP 3개를 별도 plan008로 미룸 — 분해와 같이 처리해야 회사명·미연결이 한 사이클에 사라짐.
- dispatcher와 도메인 로직을 한 skill에 합쳐 두기 — 라우팅과 행위 로직 경계 흐려짐.

### 결과

- 도메인별 책임이 폴더명으로 자명해진다. 새 기능 추가 시 위치 결정 부담 감소.
- 폐기 회사명 잔재가 코드·문서·AGENTS.md에서 사라진다.
- WIP 3개가 dispatcher에 연결돼 운영 가능 상태가 된다(현재 silently dormant).
- 폴더 수 7 → 11(5 신설, 1 삭제). 단기적으론 디렉터리 수 증가지만 응집도 상승으로 상쇄.
- plan006의 workspace-level `scripts/` 재편이 5개 새 폴더에도 동일하게 적용돼 일관성 보장.

### 적용

- 분해 phase 명세는 `tasks/plan005-cj-oliveyoung-decomposition/` 참조.
- 디렉터리 트리 영향은 `docs/code-architecture.md` "디렉터리 책임" 섹션.
- 새 디스패처 case 흐름은 `docs/flow.md`.
- depends_on: plan002(config 통합 완료 후 새 경로 가정), plan004(TS 마이그레이션이 `notify_discord.sh`를 건드리므로 합류 시점 조율).

---

## ADR-018 — docs/ 운영 정책: 휘발성 vs 영속, learn → ADR 흡수 흐름

- Status: Accepted
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
