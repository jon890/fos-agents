# AGENTS.md — ai-nodes 모노레포

모든 에이전트(Claude / Codex / Gemini 등)를 위한 정식 가이드 진입점. `CLAUDE.md`는 이 파일의 심볼릭 링크.

상세 워크스페이스 정책은 `<workspace>/AGENTS.md`. 이 파일은 워크스페이스 간 공통 규약과 진입점 매트릭스만 담는다.

## 1. 저장소 구조

`~/ai-nodes`는 단일 프로젝트가 아닌 **멀티 워크스페이스 컨테이너**다.
최상위 디렉터리 각각은 자체 skills · data · logs · config를 가진 **독립 작업 워크스페이스**다.
워크스페이스는 서로 격리되며 다른 워크스페이스의 자산을 교차 참조하지 않는다.

현재 워크스페이스 6개:

| 워크스페이스 | 자체 가이드 | 특이사항 |
|---|---|---|
| `apartment/` | [`apartment/AGENTS.md`](apartment/AGENTS.md), `apartment/TOOLS.md` | 네이버 부동산 API + agent-browser 결합 |
| `career-os/` | [`career-os/AGENTS.md`](career-os/AGENTS.md) (= CLAUDE.md 심링크), `docs/` 5문서 | 분리 표준 최초 도입 (ADR-019 → ADR-006 격상) |
| `stock-investment/` | [`stock-investment/AGENTS.md`](stock-investment/AGENTS.md) | 일일 모닝 브리핑 |
| `travel/` | [`travel/AGENTS.md`](travel/AGENTS.md) | `trips/<trip-id>/` 단위, ADR-001 의도된 비대칭 (scripts/.claude/skills/.env/config 부재) |
| `health-care/` | [`health-care/AGENTS.md`](health-care/AGENTS.md) | 무릎 재활 daily 체크인 (knee-patellar-instability, cron 08:30 KST) |
| `openclaw-orchestrator/` | [`openclaw-orchestrator/AGENTS.md`](openclaw-orchestrator/AGENTS.md), `openclaw-orchestrator/TOOLS.md` | OpenClaw daily memory와 cross-domain orchestration notes |

공용 영역:

- `_shared/lib/` — Bun TypeScript 공용 헬퍼 (현재 `notify_discord.ts` 정본 1개).
  - **워크스페이스 무관 헬퍼만** (ai-nodes ADR-001 정책: 특정 워크스페이스 config·sources·data 의존 금지).
  - 워크스페이스 한정 헬퍼는 `<workspace>/scripts/<skill>/` 내부에 (plan023에서 `career-os/scripts/_lib/` 폐기, ADR-031).
- `_shared/types/` — 공용 TS 타입.
- `skills/` — 저장소 전역 Claude Code 스킬 (`agent-browser`, `planning`, `plan-and-build`, `workspace-audit`, `docs-check`). `docs-check`는 ai-nodes 5문서 + ADR 건전성 감사 스킬.
- `docs/` — ai-nodes 모노레포 레벨.
  - `docs/adr.md` — 모노레포 ADR.
  - `docs/workspace-structure.md` — 워크스페이스 표준 청사진 (plan001 신설, 새 워크스페이스 추가 진입점).
  - `docs/docs-style.md` — docs / ADR 형식 정책 (ADR-005). 8 패턴 + 한자어 회피 + 거울 구조. 워크스페이스 docs · CLAUDE.md · SKILL.md 모두 본 문서를 따른다.
  - 워크스페이스 한정 결정은 `<workspace>/docs/adr.md`.

### 1-1. 분리 표준 (ADR-006)

`<workspace>/scripts/<name>/` 실행 파일 + `<workspace>/.claude/skills/<name>/{SKILL.md, references/}` 컨텍스트 자산 본체.

career-os ADR-019 비대칭이 ADR-006으로 표준 격상 (2026-05-19). apartment plan007 첫 적용. stock-investment / travel은 audit 시 본 표준 따름.

상세 청사진: `docs/workspace-structure.md` 2번·6번.

## 2. 실행 모델

모든 워크스페이스가 Claude native skill 직접 호출로 실행된다 (ADR-011).

- 진입점: `claude -p "/<skill>"` 또는 thin wrapper `run_with_claude.sh`.
- thin wrapper는 `.env` 로드 + Discord 시작/실패 알림 + stdout 폴백만 담당.
- native skill이 SKILL.md 기준으로 수집·합성·산출물 Write·완료 알림을 직접 수행.
- 데이터 수집 헬퍼(TS·Python)는 native skill이 `bun`·`python3` Bash로 호출.

옛 `track_task.sh` self-wrap + `extract_claude_result.ts` 외부 subprocess 패턴은 ADR-011로 폐기.
career-os(plan023) → apartment(ADR-010) → stock-investment(ADR-003) 순으로 전환 완료.
`logs/task-runs.jsonl` 계측은 읽는 소비자가 없어 함께 폐기.

## 3. 워크스페이스 진입점

### 3-1. apartment

native skill 2개:

```bash
claude -p "/apartment-daily-report"
claude -p "/apartment-interior-reference-digest"
```

직접 호출 (thin wrapper):

```bash
bash apartment/scripts/apartment-daily-report/run_with_claude.sh
bash apartment/scripts/apartment-interior-reference-digest/run_with_claude.sh "오늘의 인테리어 추천"
```

산출물: `apartment/data/YYYY-MM-DD/{report.md, raw-search.json, summary.json}`.
두 skill 모두 native 직접 호출 (ADR-010).
수집·정규화 TS 헬퍼는 native skill이 `bun` Bash로 호출하고, Claude가 summary.json을 Read해 report.md를 직접 Write한다.

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

- **모든 워크스페이스**: native skill 직접 호출 (`claude -p "/<skill>"`) — ADR-011 단일 패턴.
  - apartment(ADR-010) / stock-investment(ADR-003) / career-os(ADR-031) 전환 완료.
  - 옛 `claude --output-format json` + `extract_claude_result.ts` 패턴은 폐기.
- **워크스페이스 한정 ts·py 헬퍼**는 `<workspace>/scripts/<skill>/`에. native skill이 `bun`·`python3` Bash로 호출.
- **`_shared/lib`**는 워크스페이스 무관 공용 헬퍼만 (`notify_discord.ts` 등).

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
- 공개 repo에 커밋되는 docs/task에는 홈 서버 절대 경로를 쓰지 않는다.
  repo 내부 파일은 repo-relative path로, 사용자 로컬 경로는 필요한 경우 `~/...` 또는 `<home>` placeholder로 쓴다.
- Discord 등 공개 또는 준공개 채널 답변에서도 private home-server path를 그대로 드러내지 않는다.
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

## 8. docs 가독성 규칙

단일 출처: `docs/docs-style.md` (ADR-005).
docs · CLAUDE.md · AGENTS.md · SKILL.md · task phase 파일 모두 적용.
**새 작성은 필수, 기존 편집 중인 파일은 함께 정리.**

**작성 언어는 한글 원칙** — docs · ADR · SKILL.md · 커밋 메시지(subject·본문) 모두 한글로 작성한다.
도구·릴리즈 호환이 필요한 부분만 영문 유지: 커밋 `type` 프리픽스(`feat`·`fix` 등), 코드 식별자·경로, `Co-Authored-By:` 트레일러.

8 패턴 요약:

1. **semantic line break** — 한 문장 당 1줄.
   - 문장 끝나면 줄바꿈.
   - 길면 의미 단위로 분할.
2. **enumerated inline 금지** — `A·B·C` 콤마 나열보다 bullet list가 스캔 쉬움 (항목 3개 이상이면).
3. **괄호 중첩 2겹 이상 금지** — `((설명) 안의 설명)` 형태 금지.
   - 별도 문장으로.
4. **= / → 동치·인과 압축은 한 단락 1회만** — `A → B → C`가 여러 번 나오면 표로.
5. **한 문장 80자 초과 시 분할** — 백틱 인용 3개 이상 또는 괄호 다수도 분할 대상.
6. **한 bullet에 다중 속성 압축 금지** — 한 bullet에 4개+ 속성을 콤마로 묶지 말고 sub-bullet으로.
7. **표 셀 안 정보 4개 이상이면 `<br>` 분리** — GitHub markdown `<br>` 줄바꿈으로 분리.
8. **헤더 + 본문 구조** — `## 제목` → 1줄 요약 → 본문(리스트·표) 순.
   - 헤더 바로 다음 줄에 긴 줄글 박지 않는다.

추가 정책:
- 거울 구조 — 같은 정의를 두 docs에 "본문"으로 쓰지 않는다.
  - 단일 출처 한 곳에 본문, 다른 docs는 역참조.
- 한자어 회피 — 한국인이 자연스럽게 읽히는 표현 우선 (상세 대체 표는 `docs/docs-style.md`).
- `§` 기호 사용 금지 (글로벌 directive).

## 9. planning / implementation 위임 원칙

모든 워크스페이스의 기본 원칙:

- planning은 Codex와 사용자가 대화로 진행한다. planning skill은 목표 재정의, phase 구성, 열린 결정, 추천 기본값, 다음 액션을 잡는 **대화 구조**로 사용한다.
- `claude -p "/planning ..."` 비대화형 planning은 기본 사용하지 않는다. 계획은 반박, 보류, 범위 조정, 승인 절차 논의가 필요하므로 비대화형 생성에 맡기지 않는다.
- Claude 비대화형 실행은 합의된 task/phase의 **구현**에만 사용한다.
- Codex는 planning brief 작성, 결정사항 기록, task 파일 고정, Claude 구현 결과 review, 검증, 의도한 변경만 commit/push하는 책임을 가진다.
- Claude 구현 phase를 실행할 때는 phase 문서의 범위, 안전 조건, 검증 기준을 명확히 전달한다.

### 9-1. background 구현 worktree 원칙

메인 worktree는 사용자와 Codex가 현재 맥락을 확인하는 기준점이다.
background 구현 작업은 다른 활성 작업과 섞이지 않게 격리한다.

- 여러 task가 동시에 active 상태면 background 구현은 별도 git worktree와 branch를 기본값으로 사용한다.
- 단순한 "구현해줘" 요청만으로 main worktree 직접 편집이 안전하다고 가정하지 않는다.
  먼저 active 작업과 dirty state를 확인한다.
- main worktree 직접 편집은 아래 경우에만 허용한다:
  - active task가 하나뿐이다.
  - 작고 안전한 docs/process-only 변경이다.
  - 사용자가 main worktree 직접 편집을 명시적으로 허용했다.
- background worker 최종 보고에는 사용한 worktree/branch 여부를 반드시 적는다.
- background worker가 별도 worktree를 만들었다면 작업 완료/중단 보고 전에 `git worktree remove <path>`로 worktree 디렉터리를 명시적으로 제거한다.
  제거 전 `git -C <path> status --short`가 비어 있는지 확인하고, 비어 있지 않으면 제거하지 말고 남은 변경과 경로를 보고한다.
  branch 보존이 필요하면 worktree만 제거하고 branch는 삭제하지 않는다.
- phase 경계는 commit/push 경계다.
  긴 dirty state를 남기지 않고, 검증된 변경은 작은 단위로 push한다.
- stage는 intended files만 한다.
  unrelated dirty files를 수정, stage, commit하지 않는다.

## 10. plan 사이클 (career-os 패턴)

career-os는 `tasks/plan{N}-<slug>/` 영구 plan 영역을 운영.
`skills/planning` 구조로 Codex와 사용자가 plan을 대화형으로 작성하고, 합의 후 task 파일로 고정한다. 구현은 Claude 비대화형 실행 또는 `skills/plan-and-build` 자동 실행(`run-phases.py`)으로 진행한다.
본 패턴이 다른 워크스페이스에도 유용하다 판단되면 도입 가능 — 단 워크스페이스 격리 원칙상 별도 결정.

## 11. 외부 의존성

- `_shared/lib/notify_discord.ts` — Discord 알림(openclaw subprocess 경유, ADR-021). 모든 워크스페이스 공용 정본.
- `career-os/scripts/interview-coffeechat-prep/mvp_target_schema.ts` — career-os `config/mvp-target.json` zod 스키마 (ADR-029). audit 후 _shared/lib → skill 내부로 이동 (ADR-001 엄격 준수, 호출자 1개 한정).
- Bun runtime — TS 헬퍼 실행. 설치 후 ai-nodes 루트에서 `bun install` 1회 (root package.json: zod, fast-xml-parser, dotenv + @types/bun).
- Python 3 — 워크스페이스 수집기(stock-investment `collect_*.py` 등) 실행. native skill이 `python3` Bash로 호출.
- `agent-browser` CLI — JS-heavy 페이지(Naver Land 등) 수집. 로컬 설치 필수 (apartment ADR-001).
- `claude` CLI — 모든 Claude 호출 워크플로 의존.
- `~/personal/fos-brain` — 외부 개인 지식 기반(brain). thin caller로 연동, brain skill은 `~/.claude/skills/`에 symlink. 정책은 13번 + ADR-009/010. 사용자 환경 설치(클론·symlink·brain repo 경로 통일) 전제.

## 12. 참고 문서

- 워크스페이스 표준 청사진: `docs/workspace-structure.md` (새 워크스페이스 추가 진입점).
- 모노레포 ADR: `docs/adr.md` (ADR-001~010 누적).
- fos-brain 연동: 13번 섹션 + ADR-009(구조) + ADR-010(쓰기 안전·프라이버시).
- docs / ADR 형식 정책: `docs/docs-style.md` (ADR-005 — 8 패턴 + 한자어 회피 + 거울 구조). 인라인 요약은 8번 섹션.
- 워크스페이스별 상세: `<workspace>/AGENTS.md`.
- career-os 5문서: `career-os/docs/{prd, data-schema, flow, code-architecture, adr}.md`.
- apartment 5문서: `apartment/docs/{prd, data-schema, flow, code-architecture, adr}.md` (plan001 신설).
- planning skill: `skills/planning/SKILL.md` (8단계 워크플로 + 5문서 공통 작성 원칙).
- plan-and-build skill: `skills/plan-and-build/` (자동 phase 실행 + common-pitfalls 축적).
- workspace-audit skill: `skills/workspace-audit/SKILL.md` (워크스페이스 건전성 감사).
- docs-check skill: `skills/docs-check/SKILL.md` (5문서 + ADR 건전성 감사).

## 13. fos-brain 외부 지식 기반 연동

5개 워크스페이스 agents가 외부 개인 지식 기반 fos-brain과 양방향 연동하는 단일 정책.
결정 근거는 ADR-009(구조) + ADR-010(쓰기 안전·프라이버시).
워크스페이스 AGENTS.md는 본 섹션을 역참조하고 자기 산출물 라우팅만 명시한다(거울 구조).

### 13-1. 위치와 접근

- brain은 ai-nodes **밖** `~/personal/fos-brain`에 둔다 (repo `github.com/jon890/fos-brain`).
- 접근은 **thin caller** — brain 자체 skill(brain-search / brain-add)을 호출만 하고 brain 로직은 재구현하지 않는다.
- 설치: brain repo의 `skills/brain-*`를 `~/.claude/skills/`에 symlink. openclaw `claude -p` 세션이 전역 skill로 발견.

### 13-2. 네임스페이스 라우팅 (쓰기)

산출물 *종류*로 네임스페이스를 정한다 (워크스페이스 단위 아님):

| 산출물 종류 | 네임스페이스 |
|---|---|
| fos-study 파생 지식 | public-OK (brain-add 기본 규칙) |
| 개인 데이터 (career baseline·건강·재무·매물·여행) | private |
| 게시 적정성 확인된 일반 지식 | public (명시 opt-in) |

brain-add 호출 시 네임스페이스를 명시 전달해 brain-add 0단계 프롬프트를 건너뛴다.

### 13-3. cron 읽기전용 정책

- openclaw cron 무인 세션: **brain-search 읽기만**.
- brain 적재(brain-add): **discord 대화 세션에서 사람 검토 후**. 검증 게이트를 무인화하지 않는다.

### 13-4. 전제조건 (사용자 수동 1회, ai-nodes 범위 밖)

- brain repo skill 본문 대상 경로 `/Users/nhn/...` → `~/personal/fos-brain` 통일 (Linux 무인 실행 필수).
- brain 클론 → `~/personal/fos-brain`.
- skill symlink → `~/.claude/skills/brain-{add,search,lint}`.
- openclaw wrapper 동기화 (사용자 직접 — `~/.openclaw/`는 ai-nodes가 건드리지 않는다).
