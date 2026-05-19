# AGENTS.md — ai-nodes 모노레포

모든 에이전트(Claude / Codex / Gemini 등)를 위한 정식 가이드 진입점. `CLAUDE.md`는 이 파일의 심볼릭 링크.

상세 워크스페이스 정책은 `<workspace>/AGENTS.md`. 이 파일은 워크스페이스 간 공통 규약과 진입점 매트릭스만 담는다.

## 1. 저장소 구조

`~/ai-nodes`는 단일 프로젝트가 아닌 **멀티 워크스페이스 컨테이너**다.
최상위 디렉터리 각각은 자체 skills · data · logs · config를 가진 **독립 작업 워크스페이스**다.
워크스페이스는 서로 격리되며 다른 워크스페이스의 자산을 교차 참조하지 않는다.

현재 워크스페이스 4개:

| 워크스페이스 | 자체 가이드 | 특이사항 |
|---|---|---|
| `apartment/` | [`apartment/AGENTS.md`](apartment/AGENTS.md), `apartment/TOOLS.md` | 네이버 부동산 API + agent-browser 결합 |
| `career-os/` | [`career-os/AGENTS.md`](career-os/AGENTS.md) (= CLAUDE.md 심링크), `docs/` 5문서 | 분리 표준 최초 도입 (ADR-019 → ADR-006 격상) |
| `stock-investment/` | [`stock-investment/AGENTS.md`](stock-investment/AGENTS.md) | 일일 모닝 브리핑 |
| `travel/` | [`travel/AGENTS.md`](travel/AGENTS.md) | `trips/<trip-id>/` 단위 |

공용 영역:

- `_shared/bin/` — shell·Python 공용 헬퍼.
- `_shared/lib/` — Bun TypeScript 공용 헬퍼.
  - **워크스페이스 무관 헬퍼만** (ai-nodes ADR-001 정책: 특정 워크스페이스 config·sources·data 의존 금지).
  - 워크스페이스 한정 헬퍼는 `<workspace>/scripts/<skill>/` 내부에 (plan023에서 `career-os/scripts/_lib/` 폐기, ADR-031).
- `_shared/types/` — 공용 TS 타입.
- `skills/` — 저장소 전역 Claude Code 스킬 (`agent-browser`, `planning`, `plan-and-build`, `workspace-audit`, `docs-check`). `docs-check`는 ai-nodes 5문서 + ADR 건전성 감사 스킬.
- `docs/` — ai-nodes 모노레포 레벨.
  - `docs/adr.md` — 모노레포 ADR.
  - `docs/workspace-structure.md` — 워크스페이스 표준 청사진 (plan001 신설, 새 워크스페이스 추가 진입점).
  - `docs/docs-style.md` — docs / ADR 형식 정책 (ADR-005). 6 패턴 + 한자어 회피 + 거울 구조. 워크스페이스 docs · CLAUDE.md · SKILL.md 모두 본 문서를 따른다.
  - 워크스페이스 한정 결정은 `<workspace>/docs/adr.md`.

### 1-1. 분리 표준 (ADR-006)

`<workspace>/scripts/<name>/` 실행 파일 + `<workspace>/.claude/skills/<name>/{SKILL.md, references/}` 컨텍스트 자산 본체.

career-os ADR-019 비대칭이 ADR-006으로 표준 격상 (2026-05-19). apartment plan007 첫 적용. stock-investment / travel은 audit 시 본 표준 따름.

상세 청사진: `docs/workspace-structure.md` 2번·6번.

## 2. 실행 모델

모든 워크스페이스 실행은 `_shared/bin/track_task.sh`로 래핑된다:

- 실행별 로그 → `<workspace>/logs/task-runs.jsonl` + `token-usage.jsonl`.
- 실행 전후 `openclaw status` 캡처 — 모델·토큰·캐시 변화량.
- 실행 전후 파일 메트릭 스냅샷(`report.md`, 입력 노트, target 파일 목록 등).
- Claude CLI usage JSON을 `TRACK_TASK_CLAUDE_USAGE_FILE` env로 수집.

워크스페이스 러너는 트래커 통과를 보장해야 하며 우회 금지.
apartment의 `run_report.sh`는 `TRACK_TASK_WRAPPED`로 자가 래핑.
career-os는 plan023 이후 native skill 직접 호출로 전환 — `logs/task-runs.jsonl` 미사용.

**load-bearing 의존성**: `_shared/bin/track_task.sh`가 없으면 모든 워크스페이스 러너 실패.

## 3. 워크스페이스 진입점

### 3-1. apartment

native skill 2개:

```bash
claude -p "/apartment-daily-report"
claude -p "/apartment-interior-reference-digest"
```

직접 호출:

```bash
bash apartment/scripts/apartment-daily-report/run_report.sh
bash apartment/scripts/apartment-interior-reference-digest/run_digest.sh
```

산출물: `apartment/data/YYYY-MM-DD/{report.md, raw-search.json, summary.json, claude.result.json}`.
종합 단계는 `claude --output-format json` (90초 타임아웃 시 대체 마크다운으로 폴백).
JSON 처리는 `_shared/bin/extract_claude_result.py` (plan008 phase 진행 중 TS 마이그 예정).

### 3-2. career-os

현재 표준은 **Claude native skill 직접 호출**이다 (ai-nodes ADR-002, plan013~023). dispatcher 흐름은 plan023에서 완전 폐기 (ADR-031).

native skill 진입점 7개:

```bash
cd career-os
claude -p "/study-pack-writer <topic>"
claude -p "/interview-asset-writer <topic>"
claude -p "/study-topic-recommender [context]"
claude -p "/interview-prep-analyzer [baseline|daily|topic]"
claude --permission-mode acceptEdits -p "/candidate-baseline-suggester"
claude -p "/interview-coffeechat-prep"
claude -p "/position-recommender [자연어 컨텍스트] [채용공고 file]"
```

상세 컨벤션·결정 이력은 `career-os/docs/{prd,data-schema,flow,code-architecture,adr}.md` 5문서.

### 3-3. stock-investment / travel

[`stock-investment/AGENTS.md`](stock-investment/AGENTS.md) · [`travel/AGENTS.md`](travel/AGENTS.md) 참조. 본 모노레포 진입점은 그곳에 정의.

### 3-4. 새 워크스페이스 추가

`ai-nodes/docs/workspace-structure.md` 10번 체크리스트 참조.
mkdir + AGENTS.md + CLAUDE.md 심링크 + 5문서 placeholder + tasks/ + config/ + .env.example.
첫 plan은 5문서 본문 작성 + ADR-001 자리.

## 4. Claude CLI 호출 패턴

워크스페이스마다 호출 방식이 다르다. 혼용 금지 — 해당 워크스페이스 패턴 보존:

- **apartment**: `claude --output-format json` + 90초 타임아웃 폴백. JSON → `_shared/bin/extract_claude_result.py`.
- **career-os**: native skill 직접 호출 (`claude -p "/<skill-name>"`).
  - 워크스페이스 한정 ts 헬퍼는 `career-os/scripts/<skill>/`에.
  - 옛 `claude_lib.sh` + `invoke_claude_skills.ts` 통합 헬퍼는 plan013~023에서 모두 폐기 (ADR-031).
- **새 runner 추가 시**: native skill 진입점 + 필요 ts 헬퍼는 `<workspace>/scripts/`에. `_shared/lib`는 워크스페이스 무관 공용 헬퍼만.

패턴 변경 시 ADR로 결정 근거 남긴 뒤 진행.

## 5. 작업 규칙

- `career-os/sources/fos-study`는 외부 동기 저장소 (`github.com/jon890/fos-study`, `main`).
  - study-pack 계열 실행 중이 아니면 프로젝트 코드처럼 편집하지 말 것.
  - `.claude/**` 무시.
- 자동 생성 리포트는 `<workspace>/data/reports/`로. 별도 큐레이션 싱크 없음.
- career-os 아키텍처 결정은 `career-os/docs/adr.md`에 누적(개별 ADR 파일 신설 금지, ADR-018). 옛 `docs/decisions/`는 plan003에서 삭제됨.
- 워크플로는 재실행 가능 + 날짜별 멱등. 실시간 수집보다 로컬 git-sync + 파일 읽기 우선.
- 리포트의 불확실성 명시 — 추측으로 공백 메우지 말고 공백을 기록.
- 비밀: `<workspace>/config/.env`(career-os 기준) 또는 워크스페이스 root `.env`(ADR-021 이후, 워크스페이스별 격리). `GITHUB_TOKEN`, `DISCORD_CHANNEL_ID` 등.
- career-os 비용 규율: 광범위 풀-리포 분석 금지. baseline은 `config/baseline-core-files.json` 큐레이션 집합 안에서, daily는 더 작게(3-5 파일).

## 6. 모호함 대응 규칙

요청 받거나 결정점에서 모호한 부분이 생기면 즉시:

1. 모호함을 **1-10점**으로 평가 (1=완전 명확, 10=완전 미정).
2. 점수와 사유를 한 줄로 보고.
3. **점수와 무관하게 진행 계획 먼저 알림** — "이러이러하게 할 계획" 1-2줄 + stop 신호 없으면 진행.
4. 점수 **3 이상**이면 `AskUserQuestion`으로 옵션 제시 후 논의.

조용히 결정하고 진행하지 않는다. 작은 결정이라도 어떤 기본값을 골랐는지 보이게. 진행 속도보다 정합성 우선.

## 7. 커밋 메시지 컨벤션

Conventional Commits + 한글 subject:

- 헤더: `<type>[(scope)]: <한글 subject>`
- `type`(영문 소문자, 릴리즈 자동화 호환): `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `style`, `perf`, `build`, `ci`.
- `scope`: 워크스페이스 또는 모듈명(예: `apartment`, `career-os`, `_shared`).
- subject: 50자 내외, 마침표 생략.
- 본문: 한 줄 띄우고 한글 서술. 변경 항목은 `-` 불릿.
- `Co-Authored-By:` 트레일러는 영어 그대로.

예:
- `docs(CLAUDE): 공용 skills/ 디렉터리와 Claude CLI 호출 패턴 문서화`
- `fix(apartment): Naver 브라우저 수집 실패 시 fallback 경로 보정`

기존 영어 커밋 히스토리는 소급 리라이트하지 않는다.

## 8. plan 사이클 (career-os 패턴)

career-os는 `tasks/plan{N}-<slug>/` 영구 plan 영역을 운영.
`skills/planning`이 plan 작성, `skills/plan-and-build`가 자동 실행 (`run-phases.py`).
본 패턴이 다른 워크스페이스에도 유용하다 판단되면 도입 가능 — 단 워크스페이스 격리 원칙상 별도 결정.

## 9. 외부 의존성

- `_shared/bin/track_task.sh` — 모든 워크스페이스 트래커. **load-bearing**.
- `_shared/lib/notify_discord.ts` — Discord 알림(openclaw subprocess 경유, ADR-021).
- `_shared/lib/extract_claude_result.ts` — `claude --output-format json` envelope 파싱. apartment + career-os 사용.
- `_shared/lib/mvp_target_schema.ts` — career-os `config/mvp-target.json` zod 스키마 (ADR-029).
- Bun runtime — TS 헬퍼 실행. 설치 후 ai-nodes 루트에서 `bun install` 1회 (root package.json: zod, fast-xml-parser, dotenv + @types/bun).
- Python 3 — `_shared/bin/extract_claude_result.py` 잔존. apartment Python collector는 plan003~005 TS 마이그 + plan006 폐기 (ADR-008)로 0개. 기본 stdlib만 사용 (외부 pip 의존 없음).
- `agent-browser` CLI — JS-heavy 페이지(Naver Land 등) 수집. 로컬 설치 필수 (apartment ADR-001).
- `claude` CLI — 모든 Claude 호출 워크플로 의존.

## 10. 참고 문서

- 워크스페이스 표준 청사진: `docs/workspace-structure.md` (새 워크스페이스 추가 진입점).
- 모노레포 ADR: `docs/adr.md` (ADR-001~005 누적).
- docs / ADR 형식 정책: `docs/docs-style.md` (ADR-005 — 6 패턴 + 한자어 회피 + 거울 구조).
- 워크스페이스별 상세: `<workspace>/AGENTS.md`.
- career-os 5문서: `career-os/docs/{prd, data-schema, flow, code-architecture, adr}.md`.
- apartment 5문서: `apartment/docs/{prd, data-schema, flow, code-architecture, adr}.md` (plan001 신설).
- planning skill: `skills/planning/SKILL.md` (8단계 워크플로 + 5문서 공통 작성 원칙).
- plan-and-build skill: `skills/plan-and-build/` (자동 phase 실행 + common-pitfalls 축적).
- workspace-audit skill: `skills/workspace-audit/SKILL.md` (워크스페이스 건전성 감사).
- docs-check skill: `skills/docs-check/SKILL.md` (5문서 + ADR 건전성 감사).
