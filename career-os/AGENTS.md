# AGENTS.md — career-os 워크스페이스

`~/ai-nodes` 아래의 독립적인 작업 워크스페이스. 모든 에이전트(Claude / Codex / Gemini 등)를 위한 정식 가이드 *진입점*. `CLAUDE.md`는 이 파일의 심볼릭 링크다.

**상세 내용은 `docs/` 5문서로 분리되어 있다. 이 파일은 라우팅과 가장 자주 쓰이는 정책만 담는다.**

## 5문서 라우팅 가이드

| 문서 | 무엇이 들어 있는지 | 언제 보는지 |
|---|---|---|
| [`docs/prd.md`](docs/prd.md) | 제품 범위·MVP·기능 목록·성공 기준·미연결 WIP | 새 기능 추가 / 우선순위 결정 |
| [`docs/data-schema.md`](docs/data-schema.md) | config / logs / runtime / 산출물 JSON 스키마 | 데이터 파일 다룰 때 / 새 config 도입 |
| [`docs/flow.md`](docs/flow.md) | 사용자·데이터 플로우 (명령별 입력→runner→산출물) | 새 흐름 추가 / 디버깅 |
| [`docs/code-architecture.md`](docs/code-architecture.md) | 디렉터리 레이어·책임·외부 의존·Runner/Dispatcher 패턴 | 코드 구조 변경 / 새 스킬 추가 |
| [`docs/adr.md`](docs/adr.md) | 모든 아키텍처 결정 누적 기록 (현재 ADR-001~032, 024 누락). 모노레포 레벨 결정은 [`ai-nodes/docs/adr.md`](../docs/adr.md) | 결정의 *왜*를 알아야 할 때 |

`tasks/`는 docs와 별개의 영역으로, `skills/planning`이 생성하고 `skills/plan-and-build`가 실행하는 **워크스페이스 단위 실행 계획**의 영구 저장소다. `<workspace>/tasks/plan{N}-<slug>/` 형태로 각 plan이 자기 디렉터리를 갖고, 그 안에 `index.json` + `phase-NN.md`가 들어간다. 완료된 plan도 history 보존 목적으로 삭제하지 않는다.

워크스페이스 표준 구조는 [`../docs/workspace-structure.md`](../docs/workspace-structure.md) (ai-nodes ADR-004) 청사진을 따른다. career-os는 ADR-019 (`scripts/` 분리)의 의도된 비대칭 예외 — `scripts/<skill-name>/`(실행 파일) + `skills/<skill-name>/`(SKILL.md + references) 분리 구조. 다른 워크스페이스로 확산 의도 없음.

plan 진행 cycle: `skills/planning` 구조로 사용자와 대화하며 brief/결정/phase를 확정 → 합의된 task 파일 작성·commit·push → 구현 phase는 Claude 비대화형 실행 또는 별도 plan-and-build 세션에서 수행 + Codex 검토/검증. 세션 격리 원칙 — planning은 대화형 합의와 task 생성까지, 실 phase 실행은 별도 구현 세션.

중요 운영 원칙:

- `claude -p "/planning ..."` 비대화형 planning은 기본 사용하지 않는다. planning은 사용자의 반박/결정 보류/범위 조정을 반영해야 하므로 Codex와 사용자가 대화로 진행한다.
- Claude 비대화형 실행은 합의된 task/phase 구현에만 사용한다.
- Codex는 planning brief 작성, 열린 결정 정리, task 파일 고정, Claude 구현 결과 review, 검증, commit/push를 담당한다.
- 구현 phase에서 Claude를 호출할 때도 phase 문서의 scope, safety gate, 검증 기준을 명확히 전달한다.

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
- 사용자가 “fos-study에 블로그 글로 게시해줘”, “블로그 글로 게시해줘”라고 하면 이 저장소 아래 적절한 카테고리에 markdown 글을 작성한다.
- 공개 블로그 글에는 민감한 개인 정보, 정확한 주소/동호수, 비공개 내부 정보는 사용자가 명시하지 않는 한 제외한다.
- fos-study 게시 글은 블로그 파서 호환을 우선한다. 예: bold-wrapped quote, bare `~` 범위 표기처럼 깨지기 쉬운 markdown 패턴을 피한다.
- 게시 목적 글은 작성 후 필요한 README/index를 갱신하고, 검증 후 commit/push한다.
- 마크다운만 분석. `.claude/**` 무시.
- 후보자 프로필: `config/candidate-profile.md` — 11개 섹션 prose, 모든 주장은 `task/**` 또는 `resume/**` 경로 태깅. 프로필 수정은 이 파일 한 곳에 집중.

## 워크플로 진입점 (요약)

**dispatcher 폐기 완료 (plan023, ADR-031)** — native skill 진입점 7개로 단일화. `claude -p "/<skill-name> <args>"` 직접 호출이 표준 진입점.

이력: 옛 진입점은 `skills/cj-oliveyoung-java-backend-prep/scripts/run_now.sh` → ADR-017에서 `skills/command-router/scripts/run_now.sh` → ADR-019 (plan006 후)에서 `scripts/command-router/run_now.sh` 순으로 변화. plan013~022에서 모든 dispatcher case가 native skill 또는 폐기 처리됨. plan023에서 command-router 디렉터리 자체 폐기.

### native skill 7개 (ai-nodes ADR-002 + plan013~023)

```bash
cd career-os

# 학습·면접 자산 생성 (fos-study commit + push)
claude -p "/study-pack-writer <topic>"                                          # 주제 중심 학습 문서
claude -p "/interview-asset-writer <topic>"                                     # 후보자 이력 Q&A 은행 + 마스터 플레이북

# 추천·분석 (비공개 career-os 리포트)
claude -p "/study-topic-recommender [context]"                                  # 아침 토픽 추천 + replenish + live-coding seed (ADR-026)
claude -p "/interview-prep-analyzer [baseline|daily|topic]"                     # baseline 전체 / daily 집중 자연어 분기 (ADR-027)
claude --permission-mode acceptEdits -p "/candidate-baseline-suggester"         # 후보자 자산 Append 갱신 (ADR-028)
claude -p "/interview-coffeechat-prep"                                          # 커피챗 기업 사이트 수집 + 전략 리포트 (ADR-029)
claude -p "/position-recommender [컨텍스트] [채용공고 file]"                    # 활성 공고 수집 + 3 티어 추천 (ADR-030)
```

각 명령의 입력/산출물/git push 여부 상세는 `docs/prd.md` 기능 표, 데이터 흐름은 `docs/flow.md` 참조.

런타임 상태(어떤 명령이 최근에 잘 도는지)는 이 문서에 박지 않는다 — `logs/task-runs.jsonl`이 단일 출처이고 `skills/workspace-audit`가 그때그때 보고한다.

## 외부 의존성

`~/ai-nodes/_shared/` 아래. 자세한 책임은 `docs/code-architecture.md` 외부 의존성 섹션 참조.

- `_shared/bin/track_task.sh` — 트래커. career-os 사용 0 (native skill 직접 실행). apartment 사용 중이라 `_shared/bin`에 유지.
- `_shared/lib/notify_discord.ts` — Bun. `openclaw message send --channel discord` subprocess. `DISCORD_CHANNEL_ID` env 필수, `--media <path>` 옵션 지원. 옛 `notify_discord*.sh` 후속 (ADR-021).
- `career-os/scripts/interview-coffeechat-prep/mvp_target_schema.ts` — Bun/zod. `config/mvp-target.json` 스키마 검증 단일 출처. `parseMvpTarget()` + `CoffeechatSchema` 포함 (plan021 ADR-029 신규, audit 후 _shared/lib → skill 내부로 이동 — ADR-001 엄격 준수).
- `_shared/lib/extract_claude_result.ts` — Bun. claude JSON envelope 파싱. career-os + apartment + stock-investment 공용 (ai-nodes plan001 통합). 옛 `_shared/bin/extract_claude_result.py`는 plan001에서 git rm.
- `_shared/bin/update_artifacts.py` — career-os 사용 0 (ADR-033 / plan025 이후. `sources/fos-study/` 직접 스캔으로 단일화). 파일 자체는 별도 plan에서 폐기 검토.
- Bun runtime — TS 헬퍼 실행. 설치 후 ai-nodes 루트에서 `bun install` 1회 (zod, fast-xml-parser, dotenv).
- `claude` CLI — native skill 호출 (`claude -p "/<skill>"`). 인증 + 로그인 필요. ai-nodes 모노레포 공통.

## 운영 원칙

- 광범위 풀-리포 분석 금지. baseline은 큐레이션된 core 세트 안에서 (`config/baseline-core-files.json`).
- daily는 baseline보다 더 작게 — 토픽 기반 3-5개 문서.
- 비용 데이터는 `logs/task-runs.jsonl`의 `cost_usd` / `model` / `tokens_*` 필드로 자동 기록 (ADR-014 이후 측정 가능 정책).
- `workspace-audit`의 `health.token_outlier`가 평균 ±2σ 이탈 보고. 비용 집계는 `logs/task-runs.jsonl` `cost_usd` 필드로 추적.
- 비밀 정보는 `.env` (워크스페이스 root, ADR-021): `DISCORD_CHANNEL_ID`, `GITHUB_TOKEN`, `GITHUB_REPO_*` 등. 템플릿은 `.env.example`.
- 영구 자산은 `~/.openclaw/workspace`가 아닌 워크스페이스 내부에 저장.

## 규칙

- 이 태스크는 재사용 가능하고 다른 워크스페이스(apartment, stock-investment, travel)와 격리.
- 저장소는 로컬 동기 우선, 분석은 Claude로.
- 워크플로는 백그라운드 재실행 가능하고 날짜 단위로 멱등.
- 불확실성을 명시한다. 검증된 사실과 추론을 구분한다.
- 새 아키텍처 결정은 `docs/adr.md` 맨 아래에 누적 — 개별 ADR 파일 신설 금지.
