# AGENTS.md — career-os 워크스페이스

`~/ai-nodes` 아래의 독립적인 작업 워크스페이스. 모든 에이전트(Claude / Codex / Gemini 등)를 위한 정식 가이드 *진입점*. `CLAUDE.md`는 이 파일의 심볼릭 링크다.

**상세 내용은 `docs/` 5문서로 분리되어 있다. 이 파일은 라우팅과 가장 자주 쓰이는 정책만 담는다.**

## 5문서 라우팅 가이드

| 문서 | 무엇이 들어 있는지 | 언제 보는지 |
|---|---|---|
| [`docs/prd.md`](docs/prd.md) | 제품 범위·MVP·11개 dispatch 명령·성공 기준·미연결 WIP | 새 기능 추가 / 우선순위 결정 |
| [`docs/data-schema.md`](docs/data-schema.md) | config / logs / runtime / 산출물 JSON 스키마 | 데이터 파일 다룰 때 / 새 config 도입 |
| [`docs/flow.md`](docs/flow.md) | 사용자·데이터 플로우 (명령별 입력→runner→산출물) | 새 흐름 추가 / 디버깅 |
| [`docs/code-architecture.md`](docs/code-architecture.md) | 디렉터리 레이어·책임·외부 의존·Runner/Dispatcher 패턴 | 코드 구조 변경 / 새 스킬 추가 |
| [`docs/adr.md`](docs/adr.md) | 모든 아키텍처 결정 누적 기록 (현재 ADR-001~018) | 결정의 *왜*를 알아야 할 때 |

`tasks/`는 docs와 별개의 영역으로, `skills/planning`이 생성하고 `skills/plan-and-build`가 실행하는 **워크스페이스 단위 실행 계획**의 영구 저장소다. `<workspace>/tasks/plan{N}-<slug>/` 형태로 각 plan이 자기 디렉터리를 갖고, 그 안에 `index.json` + `phase-NN.md`가 들어간다. 완료된 plan도 history 보존 목적으로 삭제하지 않는다.

워크플로 스크립트나 파일 선택 전략을 바꾸기 전에 반드시 `docs/adr.md`를 먼저 확인한다. 새 결정은 항상 `docs/adr.md` 맨 아래에 누적한다.

## 목적

커리어 성장·회사 적합도 분석·면접 준비 자동화.

## 현재 MVP 타깃

**`config/mvp-target.json`이 단일 출처**. `primary`가 현재 집중 타깃, `history`가 폐기된 과거 타깃. 회사명·팀명·면접 일자를 어떤 markdown에도 박지 않는다 — JSON 한 곳만 수정해서 전환.

## 후보자 포커스

- 주 트랙: **Java 백엔드**
- 현재 MVP에서 Kotlin 제외
- 자가 진단 약점 영역: **DB**
- 목표: 실전 면접 중심의 일일 학습 가이드

## 진실 출처

- 로컬 동기 저장소: `~/ai-nodes/career-os/sources/fos-study`
- 마크다운만 분석. `.claude/**` 무시.
- 후보자 프로필: `config/candidate-profile.md` — 11개 섹션 prose, 모든 주장은 `task/**` 또는 `resume/**` 경로 태깅. 프로필 수정은 이 파일 한 곳에 집중.

## 워크플로 진입점 (요약)

단일 디스패처: `skills/command-router/scripts/run_now.sh` (plan005 분해 이후, ADR-017). 본 plan005 실행 전까지는 `skills/cj-oliveyoung-java-backend-prep/scripts/run_now.sh`가 진입점.

14개 명령 (plan005 wire-up 포함): `baseline` · `daily [topic]` · `recommend-positions` · `recommend-topics` · `replenish-topics` · `study-pack <topic>` · `maintain-study-pack <topic>` · `question-bank <topic>` · `master [topic]` · `foodville-coffeechat` · `smoke` · `bootcamp-batch` · `live-coding-dispatch` · `auto-question-bank`.

각 명령의 입력/산출물/git push 여부 상세는 `docs/prd.md` 기능 표, 데이터 흐름은 `docs/flow.md` 참조.

모든 서브 명령은 `_shared/bin/track_task.sh`로 래핑되어 실행별 메트릭이 `logs/task-runs.jsonl` + `logs/token-usage.jsonl`에 append된다. `run_now.sh`는 내부 `run_tracked()` 헬퍼로 알림과 비용 요약을 자동 부착한다.

런타임 상태(어떤 명령이 최근에 잘 도는지)는 이 문서에 박지 않는다 — `logs/task-runs.jsonl`이 단일 출처이고 `skills/workspace-audit`가 그때그때 보고한다.

## 외부 의존성

모두 `~/ai-nodes/_shared/bin/` 아래. 자세한 책임은 `docs/code-architecture.md` 외부 의존성 섹션 참조.

- `track_task.sh` — 모든 모드 트래커. 누락 시 모든 실행 실패.
- `claude_lib.sh` — source 가능. `claude_persist_usage`로 raw Claude JSON envelope을 `$TRACK_TASK_CLAUDE_USAGE_FILE`로 전파 (ADR-014).
- `format_cost_summary.py` — 비용·모델·duration 한 줄 요약.
- `extract_claude_result.py` — Claude JSON → `report.md`. usage 인자 지원하는 gold standard.
- `update_artifacts.py` — `data/generated-artifacts.json` upsert (외부 publish 후).

## 운영 원칙

- 광범위 풀-리포 분석 금지. baseline은 큐레이션된 core 세트 안에서 (`config/baseline-core-files.json`).
- daily는 baseline보다 더 작게 — 토픽 기반 3-5개 문서.
- 비용 데이터는 `logs/task-runs.jsonl`의 `cost_usd` / `model` / `tokens_*` 필드로 자동 기록 (ADR-014 이후 측정 가능 정책).
- `workspace-audit`의 `health.token_outlier`가 평균 ±2σ 이탈 보고. `format_cost_summary.py`가 실시간 알림에 비용 부착.
- 비밀 정보는 `config/.env` (GITHUB_TOKEN, DISCORD_WEBHOOK_URL 등).
- 영구 자산은 `~/.openclaw/workspace`가 아닌 워크스페이스 내부에 저장.

## 규칙

- 이 태스크는 재사용 가능하고 다른 워크스페이스(apartment, stock-investment, travel)와 격리.
- 저장소는 로컬 동기 우선, 분석은 Claude로.
- 워크플로는 백그라운드 재실행 가능하고 날짜 단위로 멱등.
- 불확실성을 명시한다. 검증된 사실과 추론을 구분한다.
- 새 아키텍처 결정은 `docs/adr.md` 맨 아래에 누적 — 개별 ADR 파일 신설 금지 (legacy `docs/decisions/` + `docs/audit/` 디렉터리는 ADR-018 로 폐기. 새 파일 생성 금지).
