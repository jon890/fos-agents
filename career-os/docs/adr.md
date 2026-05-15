# ADR — career-os 아키텍처 결정 기록

career-os의 모든 아키텍처 결정을 시간순으로 누적 기록한다. 새 결정은 가장 아래에 추가한다.

형식: `## ADR-N — 제목` + status / date 라인 + **맥락 / 결정 / 결과** 3섹션. 폐기·supersede는 status 라인에 명기.

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

## ADR-007 — Experience-based interview question bank workflow

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

- Status: Accepted
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

- Status: 채택됨 (2026-04-14). **출력 포맷 폐기 부분은 사실상 무효화**. 핵심 결정(Write 도구 사용 금지)은 유지. 자세한 진단·복구는 ADR-014.
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
