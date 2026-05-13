# AGENTS.md — career-os 워크스페이스

`~/ai-nodes` 아래의 독립적인 작업 워크스페이스. 모든 에이전트(Claude / Codex / Gemini 등)를 위한 정식 프로젝트 가이드. `CLAUDE.md`는 이 파일의 심볼릭 링크다.

## 목적

커리어 성장, 회사 적합도 분석, 면접 준비 자동화.

현재 MVP 타깃은 **`config/mvp-target.json`이 단일 출처**다. `primary` 키가 현재 집중 타깃, `history` 배열이 과거(폐기된) 타깃을 보존한다. 회사명·팀명·면접 일자를 이 문서에 직접 박지 않는다 — 타깃이 바뀌면 JSON 한 곳만 수정한다.

## 후보자 포커스

- 주 트랙: **Java 백엔드**
- 현재 MVP에서 Kotlin은 제외
- 자가 진단 약점 영역: **DB**
- 목표: 실전 면접 중심의 일일 학습 가이드

## 진실 출처

- 로컬 동기 저장소: `~/ai-nodes/career-os/sources/fos-study`
- 마크다운 파일만 분석
- `.claude/**` 무시
- 후보자 프로필: `~/ai-nodes/career-os/config/candidate-profile.md` — 근거 태깅된 11개 섹션 프로필(커리어 타임라인, 보유 기술 스택, 주요 프로젝트, 강점/약점, 의사결정 패턴, 협업 스타일, 면접 준비 우선순위 등). 모든 주장은 `task/**` 또는 `resume/**` 경로가 태깅되어 있음. 프로필 수정은 이 단일 파일에 집중.

## 구조

- `skills/` — 재사용 가능한 태스크 스킬
- `sources/` — 로컬 동기 외부 저장소 (예: `sources/fos-study/`)
- `config/` — 후보자 프로필, mvp-target, 토픽 설정, baseline core 파일 목록 등
- `data/reports/` — **자동 생성**된 baseline / daily / study-pack 리포트 (스크립트가 작성)
- `data/study-progress.json` — 학습 진도 추적
- `data/normalized/` — 구조화된 중간 데이터
- `data/source/` — 필요 시 수집한 외부 노트
- `docs/decisions/` — 아키텍처 결정 레코드(ADR)
- `logs/` — 실행 로그 (`task-runs.jsonl`, `token-usage.jsonl`)

## 워크플로 진입점

단일 디스패처: `skills/cj-oliveyoung-java-backend-prep/scripts/run_now.sh`. (디렉터리 이름의 `cj-oliveyoung`은 역사적 잔재이며 현재 MVP 타깃과 무관 — 면접 후 리네이밍 보류 상태.)

```
run_now.sh baseline                     # 큐레이션된 10개 파일 baseline 간극 분석 (ADR-003)
run_now.sh daily [topic]                # 일일 집중 리포트, 인자 생략 시 가장 오래 안 본 토픽 자동 선택
run_now.sh recommend-positions          # 활성 채용 공고를 후보자 프로필과 매칭한 추천 리포트
run_now.sh recommend-topics             # 예약된 풀에서 다음 오전 학습 토픽 선택
run_now.sh replenish-topics             # 피드 소스로부터 오전 토픽 풀 보충
run_now.sh study-pack <topic>           # 토픽 1개 스터디팩 생성 후 fos-study에 commit/push
run_now.sh maintain-study-pack <topic>  # 신규 생성 대신 기존 스터디팩 갱신 (중복 인식)
run_now.sh question-bank <topic>        # 경험 기반 인터뷰 Q&A 생성 후 commit/push
run_now.sh master [topic]               # 시니어 백엔드 마스터 플레이북 생성 후 commit/push
run_now.sh foodville-coffeechat         # CJ 푸드빌 커피챗 준비 + 백엔드 사이트 인사이트 리포트
run_now.sh smoke                        # 최소 smoke 점검
```

모든 서브 명령은 `_shared/bin/track_task.sh`로 래핑되어 실행별 메트릭을 `logs/task-runs.jsonl` 과 `logs/token-usage.jsonl` 에 append한다. `run_now.sh`는 내부 `run_tracked()` 헬퍼로 알림과 비용 요약을 자동 부착한다.

런타임 상태(어떤 명령이 최근에 잘 도는지, 무엇이 멈춰 있는지)는 이 문서에 박지 않는다 — `logs/task-runs.jsonl`이 단일 출처이고, `skills/workspace-audit`가 그 사실을 그때그때 보고한다.

## 서브 스킬

- `skills/study-pack-writer/` — 토픽 → 풀 마크다운 스터디팩
- `skills/study-pack-maintainer/` — 기존 스터디팩 갱신·중복 판단 (overlap-aware update-vs-new)
- `skills/experience-question-bank-writer/` — 이력서/태스크 → 엄격 스키마 JSON → 렌더링된 인터뷰 Q&A
- `skills/interview-master-writer/` — 이력서/태스크 → 시니어 백엔드 마스터 플레이북
- `skills/cj-foodville-coffeechat-prep/` — 이력서/프로필 + 전략 노트 + 푸드빌 사이트 스냅샷 → 커피챗 준비 리포트
- `skills/position-recommender/` — 활성 wanted 공고 + 후보자 프로필 → 매칭 추천 리포트
- `skills/cj-oliveyoung-java-backend-prep/` — 디스패처 및 baseline/daily/smoke/morning-recommendation/replenish 등 보조 실행 스크립트 호스트

## 외부 의존성

모두 `~/ai-nodes/_shared/bin/` 아래:

- `track_task.sh` — 모든 모드가 이 트래커를 거친다. 누락 시 모든 실행 실패.
- `claude_lib.sh` — source 가능. `claude_persist_usage`로 raw Claude JSON envelope을 `$TRACK_TASK_CLAUDE_USAGE_FILE`로 전파 (ADR-014).
- `format_cost_summary.py` — `logs/task-runs.jsonl` 최신 항목 → `" · $0.27 · sonnet-4-6 · 24k→6k 토큰 · 105s"` 한 줄.
- `extract_claude_result.py` — Claude JSON → `report.md`, usage 메타도 같이 전파 (baseline/daily/smoke 사용).
- `update_artifacts.py` — `data/generated-artifacts.json` upsert (study-pack/question-bank/master publish 후).

## Baseline 전략

기본적으로 전체 레포를 분석하지 **않는다**. `config/baseline-core-files.txt`의 큐레이션된 core 세트를 사용한다. 현재 baseline core 세트는 다음을 중심으로 구성된다:

- 현재 활성 타깃의 인터뷰 컨텍스트 노트 (예: `interview/...md`)
- DB 기본기와 MySQL 내부 동작
- Spring JPA 트랜잭션
- 분산 트랜잭션
- 캐시 기본기
- Redis 기본기

(타깃 전환 시 baseline-core-files.txt도 같이 업데이트할 것.)

## Daily 전략

일일 리포트는 baseline보다 작아야 한다. 현재 학습 토픽과 연결된 고가치 문서 3-5개를 선호한다.

## 토큰 / 비용 규율

비용 데이터는 `logs/task-runs.jsonl`의 `cost_usd` / `model` / `tokens_*` 필드로 자동 기록된다 (ADR-014 이후). `workspace-audit`의 `health.token_outlier`가 평균 ±2σ 이탈을 보고하고, `format_cost_summary.py`가 실시간 알림에 비용을 부착한다.

운영 원칙:

- 광범위 풀-리포 분석을 피한다.
- baseline은 큐레이션된 core 세트 안에서.
- daily는 더 작게.
- Claude 사용량이 고갈되면 큰 프롬프트를 반복 재시도하지 말고 fallback 경로를 설계한다.

## 작업 원칙

복잡한 수집 파이프라인보다 단순하고 재실행 가능한 로컬 워크플로를 선호한다. Git 동기 + 로컬 파일 읽기가 현재 선호 패턴이다.

## 지금까지 식별된 후보 약점·강점

스모크/베이스라인이 식별한 후보 약점 영역 — 타깃 회사와 무관하게 인터뷰 준비 일반에 유효:

- JPA N+1 처리
- `EXPLAIN` 플랜 해석
- 복합 / 커버링 인덱스 설계
- Redis 캐싱 패턴
- Kafka 실전 설계

이미 노트가 갖춰진 강점 영역:

- B+Tree / 인덱스 구조
- InnoDB MVCC 및 잠금
- Spring 트랜잭션 함정
- 분산 트랜잭션 개념

## 아키텍처 결정

설계 근거는 `docs/decisions/`에 ADR로 정리된다. 워크플로 스크립트나 파일 선택 전략을 바꾸기 전에 반드시 확인한다.

| ADR | 주제 |
|-----|------|
| [001](docs/decisions/001-daily-file-selection-strategy.md) | Daily 파일 선택 전략 (토픽 기반 3-5개) |
| [002](docs/decisions/002-study-progress-tracking.md) | 학습 진도 추적 (data/study-progress.json) |
| [003](docs/decisions/003-baseline-chunking-removal.md) | Baseline 청킹 제거 (단일 호출) |
| [004](docs/decisions/004-reports-directory-convention.md) | reports/ 디렉터리 컨벤션 (폐기) |
| [005](docs/decisions/005-study-pack-publishing-policy.md) | study-pack 퍼블리싱 정책 |
| [006](docs/decisions/006-study-pack-entrypoint-and-routing.md) | study-pack 엔트리포인트 및 라우팅 |
| [007a](docs/decisions/007-experience-question-bank-workflow.md) | 경험 기반 인터뷰 Q&A 워크플로 (⚠ 번호 충돌 — 리넘버링 예정) |
| [007b](docs/decisions/007-study-pack-stdout-capture.md) | study-pack 생성: 파일 쓰기 → stdout 캡처 (⚠ 번호 충돌 — 리넘버링 예정. 출력 포맷 부분은 014가 supersede) |
| [008](docs/decisions/008-generation-status-notifications.md) | 문서 생성 상태 알림 정책 |
| [009](docs/decisions/009-morning-topic-reservoir-and-recommendation-pipeline.md) | morning topic 추천 reservoir 파이프라인 |
| [010](docs/decisions/010-recommendation-scoring-and-mix-targets.md) | 추천 점수 기반 + mix target |
| [011](docs/decisions/011-automatic-topic-replenishment.md) | study topic 자동 보충(replenishment) — 파일 기반 |
| [012](docs/decisions/012-broad-daily-curation-3-3-3-1.md) | 모닝 추천을 10픽 + 오늘의 3선 큐레이션으로 확장 |
| [013](docs/decisions/013-secondary-rss-discovery-layer.md) | tech-blog / AI / geek 추천에 RSS·Atom discovery 레이어 부착 |
| [014](docs/decisions/014-restore-claude-usage-with-stdout-capture.md) | stdout 캡처 runner에 `--output-format json` 복원으로 토큰/비용 회계 회복 (007b 부분 supersede, Proposed) |

## 규칙

- 이 태스크는 재사용 가능하고 다른 태스크와 격리되어야 한다.
- 저장소는 로컬 동기를 선호하고, 분석은 Claude로 한다.
- 워크플로는 백그라운드 재실행 가능하고 날짜 단위로 멱등해야 한다.
- 영구 자산은 `~/.openclaw/workspace`가 아닌 여기에 저장한다.
- 불확실성을 명시한다. 검증된 사실과 추론을 구분한다.
- 비밀 정보는 `config/.env`에 둔다 (예: `GITHUB_TOKEN`).
