# ADR — ai-nodes 모노레포 아키텍처 결정 기록

ai-nodes 모노레포 레벨에서 모든 워크스페이스에 영향을 주는 결정을 시간순으로 누적 기록한다. 워크스페이스 한정 결정은 `<workspace>/docs/adr.md`에 둔다(예: `career-os/docs/adr.md`).

형식: `## ADR-N — 제목` + Status / Date + 5섹션 (맥락 / 결정 / 결과 / 적용). 폐기·supersede는 status 라인에 명기.

번호 체계: 워크스페이스 ADR과 별개 namespace. 본 파일은 ADR-001부터 새로 시작.

---

## Quick Index

빠른 ADR 탐색용 단일 출처. 본문 헤더의 ADR 번호 + 제목 + Status 라인과 동기 유지.

| ADR | 제목 | Status | 한 줄 요약 |
|---|---|---|---|
| ADR-001 | 공용 헬퍼 위치 분리: _shared/lib vs <workspace>/scripts/_lib | Accepted | 워크스페이스 무관 헬퍼만 _shared/lib, config/sources/data import 시 워크스페이스 한정 |
| ADR-002 | Claude Code native skill 패턴 + .claude/skills/ 단일 위치 | Accepted | SKILL.md 단일 출처, 외부 subprocess+extractor+validator 폐기 (plan013부터 점진 마이그) |
| ADR-003 | docs-check skill + adr.md Quick Index + drift Status 컨벤션 | Accepted | 28 ADR Quick Index 추가 + drift Status 일괄 갱신 (plan018) |
| ADR-004 | 워크스페이스 표준 구조 정식화 | Partially superseded by ADR-006 (2026-05-19) | 5문서 + .env workspace root + tasks/plan + AGENTS 심링크 정책 유효. skills/<name>/ 통합 표준 부분만 supersede |
| ADR-005 | docs / ADR 작성 형식 6 패턴 + 한자어 회피 | Accepted | dooray-cli mirror — `docs/docs-style.md` 단일 출처. 새 작성물 우선 적용, 전수 정정은 별도 plan |
| ADR-006 | 워크스페이스 표준 패턴 변경: 통합 → 분리 (.claude/skills 본체화) | Accepted | ADR-004 skills/<name>/ 통합 표준 부분 supersede. career-os ADR-019 비대칭이 표준으로 격상. apartment plan007 첫 적용 |

---

## ADR-001 — 공용 헬퍼 위치 분리: `_shared/lib` vs `<workspace>/scripts/_lib`

- Status: Accepted
- Date: 2026-05-14

### 맥락
career-os ADR-020에서 Bun TS 공용 헬퍼를 `_shared/lib/`에 단일 위치로 도입. 그러나 plan010 phase-02/03/04 작성 시 워크스페이스 한정 헬퍼(`build_prompt.ts` / `study_pack_publish.ts` / `fos_study_git.ts`)도 같은 위치로 보내려는 실수가 발생. 본 결정은 ai-nodes 전체 워크스페이스 격리 원칙에 영향을 주므로 career-os 한 워크스페이스 ADR로 두는 건 부적절 — 모노레포 레벨 정책으로 격상.

### 결정
- `_shared/lib/`는 **모든 워크스페이스에서 호출 가능한 헬퍼만**. 식별 기준:
  - (a) 특정 워크스페이스의 `config/`·`sources/`·`data/` import 없음
  - (b) 다중 워크스페이스에서 실제 호출 가능(또는 이론적으로 가능)
  - 현재 자격: `notify_discord.ts`, `invoke_claude_skills.ts`, `format_cost_summary.ts`, `extract_claude_result.ts`
- **워크스페이스 한정 헬퍼는 `<workspace>/scripts/_lib/`**. career-os 기준 `career-os/scripts/_lib/` (career-os ADR-019 scripts/ 컨벤션 따름). 다른 워크스페이스도 자체 root에 같은 패턴 적용 가능 — 단 워크스페이스 격리 원칙상 다른 워크스페이스가 직접 호출 금지.
- 헬퍼 위치 판정 식별 기준: 새 헬퍼가 `<workspace>/config/`·`<workspace>/sources/`·`<workspace>/data/` 중 하나라도 import하면 그 워크스페이스 한정.

거절된 대안:
- 모든 TS 헬퍼를 `_shared/lib`에 두기 → 워크스페이스 격리 원칙(ai-nodes/AGENTS.md 1) 위반. drift 위험.
- 워크스페이스 root에 `lib/` (scripts/ 밖) → career-os ADR-019 scripts/ 컨벤션과 어긋남.

### 결과
- `_shared/lib`의 적용 범위가 명확. 미래 헬퍼 위치 판정 비용 ↓.
- 워크스페이스 안 cross-skill 공용 헬퍼가 `<ws>/scripts/_lib/`에 모임.
- 본 ADR 이전 잘못 들어간 헬퍼(career-os의 `build_prompt.ts`, plan010 phase-03/04 산출물)는 plan010 phase 종료 후 `git mv`로 정리.
- 다른 워크스페이스가 career-os 헬퍼를 import 시도하면 격리 위반으로 즉시 발견.

### 적용
- 본체: `<workspace>/scripts/_lib/` 또는 `_shared/lib/`.
- 식별 기준은 본 결정 섹션 참조.
- 적용 사례: `career-os/scripts/_lib/build_prompt.ts` (plan010 phase-02 cleanup 후), `study_pack_publish.ts` (plan010 phase-03), `fos_study_git.ts` (plan010 phase-04).
- 미래 plan(예: plan011 runner TS) 새 헬퍼 신설 시 본 정책 따라 위치 결정.

---

## ADR-002 — Claude Code native skill 패턴 채택 + `.claude/skills/` 단일 위치

- Status: Accepted
- Date: 2026-05-14

### 맥락
career-os workflow(study-pack / question-bank / master / position-recommender 등)가 *외부 subprocess Claude 호출* 패턴으로 발달. shell runner가 `build_prompt.ts`로 프롬프트 조립 → `claude --print --output-format json` 호출 → extractor로 검증/추출. SKILL.md는 사람용 reference 문서로 전락.

Claude Code의 native skill 메커니즘은 `claude -p "/<skill> <args>"` 호출 시 SKILL.md를 자동 system prompt에 로드해 Claude가 도구로 직접 작업한다 (plan-and-build / planning skill이 이미 그 패턴). 외부 subprocess + extractor + validator 패턴의 복잡도 + drift 위험을 native skill로 단순화 가능.

또 skill 자동 로드 위치는 `.claude/skills/`인데 현재 career-os는 `career-os/skills/` 실체 + `career-os/.claude/skills/` 심링크의 이중 구조. 새 skill 추가 시 심링크 추가를 잊으면 자동 로드 안 됨 (현재 12개 skill 중 5개 누락 상태).

### 결정
- **모든 워크스페이스의 workflow skill은 native Claude Code skill 패턴으로 작성**. SKILL.md = 살아있는 동작 명세, Claude가 Read/Write/Bash 도구로 직접 처리. 외부 subprocess shell runner 폐기.
- **skill 위치 단일 출처**: 워크스페이스 root의 `.claude/skills/<name>/SKILL.md`. 이중 구조(`<ws>/skills/<name>/`)는 폐기. 모든 skill 이동.
- **점진 마이그**: 한 skill씩 native로 전환. 첫 대상은 career-os의 study-pack-writer.
- **자체 검증**: SKILL.md 안에 self-check 명세 + 최대 N회 재작성. 외부 validator subprocess 폐기.
- **워크스페이스 한정 helper 점진 폐기**: `build_prompt.ts` / `study_pack_publish.ts` / `fos_study_git.ts` 같이 native skill 안에서 Claude가 Bash로 직접 처리 가능한 것은 점진 폐기. 워크스페이스 무관 헬퍼(`notify_discord.ts` 등 ADR-001 _shared/lib 자격)는 유지.
- **dispatcher 폐기**: `command-router/run_now.sh` 같은 case 분기 dispatcher는 `claude -p "/<skill>"` 직접 호출로 대체. cron 진입점도 동일.
- **track_task.sh + 토큰 회계 폐기**: 운영 가시성·메트릭은 필요 시 별도 plan으로 재설계.

거절된 대안:
- 옛 외부 subprocess 패턴 유지: SKILL.md drift + 복잡도 영구화.
- 이중 구조 (`<ws>/skills/` + `<ws>/.claude/skills/`) 유지: 새 skill마다 심링크 누락 위험.
- `<ws>/skills/` 단일 (`.claude/skills/` 폐기): Claude Code 자동 로드 메커니즘 표준이 `.claude/skills/`라 따라야.

### 결과
- SKILL.md = 단일 진실 출처. 외부 prompt 조립 + extractor + validator subprocess 제거.
- 새 skill 추가 비용 ↓: `.claude/skills/<name>/SKILL.md` 작성만, dispatcher case·extractor·validator 신설 없음.
- 자동 로드 누락 위험 ↓: 단일 위치 → 잘 작동 또는 안 됨 둘 중 하나로 명확.
- 토큰 회계 + 대시보드 일시 손실 (사용자 결정으로 폐기). 필요 시 별도 plan으로 재설계.
- 마이그레이션 중 옛 패턴(외부 subprocess)과 신 패턴(native skill) 공존 — 한 skill씩 마이그라 일관성은 한 사이클 안에서만 보장.

### 적용
- 첫 적용: career-os study-pack-writer (plan013).
- 위치: `<workspace>/.claude/skills/<skill>/SKILL.md`.
- 진입: `claude -p "/<skill> <args>"` (사용자 / cron 동일).
- 폐기 대상 (per skill 마이그 시): 옛 사람용 `<ws>/skills/<name>/SKILL.md`, `<ws>/scripts/<name>/run_*.sh` 진입, `<ws>/scripts/_lib/` 일부 헬퍼, dispatcher case.

---

## ADR-003 — docs-check skill 도입 + adr.md Quick Index + drift Status 컨벤션

- Status: Accepted
- Date: 2026-05-15

### 맥락
현재 ai-nodes ADR 28개 (career-os/docs/adr.md 26 + ai-nodes/docs/adr.md 2) 중 폐기 명시는 *1개*(career-os ADR-004)뿐. 실제 drift된 ADR 5+개 존재 — ADR-011 (자동 보충, plan015 폐기) / ADR-006 (study-pack 라우팅, plan013 native) / ADR-007 (Q&A workflow, plan015 통합) / ADR-016 (config 통합, plan017 부분 번복) / ADR-023 (본문 "사실상 무효화" 표기 정식화 안 됨). AI 에이전트가 adr.md 본문을 Read해도 *어떤 결정이 살아있고 어떤 게 죽었는지* 추론 불가 — 토큰 효율 + 결정 정확성 둘 다 손실.

또 career-os/docs/adr.md 637줄·26 ADR이라 AI 에이전트가 *특정 ADR 찾기* 비효율. 본문 전체 Read해야 함.

fos-blog repo의 `.claude/skills/docs-check` skill이 5축 검사 (Decay / Bloat / Clarity / Duplication / Self-Evidence)으로 docs 건전성 감사 — ai-nodes에도 차용 가능.

### 결정
세 묶음 변경:

1. **adr.md 상단 Quick Index 테이블 추가** (career-os/docs/adr.md + ai-nodes/docs/adr.md 둘 다):
   - 형식: `| ADR | 제목 | Status | 한 줄 요약 |`
   - Status 값: `Accepted` / `Superseded by ADR-N` / `Partially superseded by ADR-N` / `Deprecated (date, reason)`
   - AI 에이전트가 본문 Read 없이 *어떤 결정 있는지·살아있는지* 즉시 파악
2. **drift Status 일괄 갱신** — Quick Index 작성 중 28 ADR 전수 검토 + 본문 첫 줄 Status 라인 갱신
3. **ai-nodes 전역 docs-check skill 도입** — `~/ai-nodes/skills/docs-check/SKILL.md`. fos-blog 5축 차용 + ai-nodes 도메인 변형 (Drizzle schema → config json / page.tsx → dispatcher case / SKILL.md trigger pattern)

거절한 대안:
- career-os 한정 skill: 향후 다른 워크스페이스(apartment 등)에서 ADR 도입 시 복제 필요 — 전역이 자연.
- fos-blog skill 심링크: ai-nodes 도메인 차이로 변형 운영 어려움.
- Quick Index 자동 생성: skill로 자동화하면 *Quick Index ↔ 본문* drift 위험. 수동 작성 + 새 ADR 추가 시 갱신 의무가 더 안전.

### 결과
- AI 에이전트 ADR 탐색 효율 ↑ (본문 Read 없이 Quick Index만으로 결정 매핑).
- drift 추적 가능 — Status 라인이 살아있는지 즉시 확인.
- 새 ADR 추가 비용 +1: Quick Index 한 줄 갱신.
- skill 유지보수 비용 +1: ai-nodes 도메인 변형 검사 로직 업데이트.
- 단점: Quick Index 작성 후 본문과 drift 위험 — docs-check skill의 Decay 축이 이 drift도 탐지하도록 설계.

### 적용
- 본 plan018 task 본문 phase-01 ~ phase-04 참조.
- skill 위치: `~/ai-nodes/skills/docs-check/SKILL.md` (모노레포 전역).
- 적용 대상 ADR 파일: `career-os/docs/adr.md` (26) + `~/ai-nodes/docs/adr.md` (3, 본 ADR 포함).
- common-pitfalls 6-6 회피: skill SKILL.md draft 별도 파일 + Read draft → Write target.

---

## ADR-004 — 워크스페이스 표준 구조 정식화

- Status: Accepted
- Date: 2026-05-18

### 맥락

career-os와 apartment 두 워크스페이스가 5문서 컨벤션 + AGENTS.md/CLAUDE.md 심링크 + tasks/plan{N}-<slug>/ 영역 + .env 워크스페이스 root + docs vs data 분리 패턴으로 수렴. 다른 워크스페이스(stock-investment, travel) 신규 추가 시 동일 청사진 필요.

기존 워크스페이스 정책 분산:

- career-os ADR-018: docs/ 운영 정책 (5문서 + adr.md 단일 누적). 워크스페이스 한정 결정.
- career-os ADR-021: Discord 알림 openclaw 경유 + .env 워크스페이스 root 격리. 워크스페이스 한정 결정.
- career-os ADR-019: scripts/ 분리. 워크스페이스 한정 예외로 보존.

분산된 워크스페이스 ADR 중 모든 워크스페이스 공통 적용 부분은 모노레포 레벨로 격상 필요.

### 결정

ai-nodes 모노레포의 워크스페이스 표준 구조를 `ai-nodes/docs/workspace-structure.md`에 정식화. 본 문서가 현재 구조 단일 출처, ADR-004는 결정의 *왜* 책임.

표준 내용:

1. 디렉터리 트리 — AGENTS.md / CLAUDE.md 심링크 / .env / .env.example / config/ / docs/ 5문서 / skills/<name>/{SKILL.md, references/, scripts/} / .claude/skills/<name>/ / tasks/plan{N}-<slug>/ / data/ / logs/. **(2026-05-19 ADR-006: skills/<name>/ 부분 폐기, scripts/<name>/ + .claude/skills/<name>/ 분리로 변경)**
2. AGENTS.md + CLAUDE.md 심링크 — Claude Code 자동 로드.
3. docs/ 5문서 — prd / data-schema / flow / code-architecture / adr.md. ADR 누적 (개별 파일 신설 금지).
4. .env 워크스페이스 root + .env.example 템플릿 — 워크스페이스별 격리.
5. tasks/plan{N}-<kebab-slug>/ — planning + plan-and-build 영구 보관.
6. skills/<name>/ 통합 구조 + native skill 우선 등록.

career-os ADR-018 (docs/ 운영 정책) / ADR-021 (.env 워크스페이스 root 부분)을 본 ADR-004로 모노레포 격상. career-os ADR 본문 Status 라인에 `Lifted to ai-nodes ADR-004 (2026-05-18)` 표기.

거절한 대안:

- 워크스페이스별 독립 ADR 유지 (격상 안 함) — 같은 결정이 4 워크스페이스 ADR에 중복 표기 → drift 위험.
- 단일 거대 ADR 대신 디렉터리·5문서·.env·docs vs data·tasks/plan 별 분리 ADR — 새 워크스페이스 추가 시 N개 ADR 동시 적용. UX 나쁨.

### 결과

- 새 워크스페이스 추가 시 `workspace-structure.md` 청사진만 따르면 됨. ADR-004는 청사진 정당화.
- career-os ADR-018/021의 공통 적용 부분은 ADR-004로 격상. 워크스페이스 한정 부분 (career-os ADR-019 scripts/ 분리, ADR-021 Discord openclaw 부분)은 워크스페이스 ADR에 남음.
- workspace-structure.md 9번 매트릭스로 각 워크스페이스 표준 준수도 추적.
- 의도된 비대칭 (career-os ADR-019)도 명시되어 표준 이탈 결정 자체로 가시화.

### 적용

- `ai-nodes/docs/workspace-structure.md` (신설, 본 ADR의 적용 청사진)
- `ai-nodes/AGENTS.md` 1번 / 3-4 / 9번 / 10번 갱신
- `career-os/docs/adr.md` ADR-018 / ADR-021 Status 라인 격상 표기
- apartment 워크스페이스가 plan001에서 본 표준의 적용 첫 사례 (career-os는 plan023까지 진행으로 이미 표준 준수)

---

## ADR-005 — docs / ADR 작성 형식 6 패턴 + 한자어 회피

**Status**: Accepted
**Date**: 2026-05-19

### 맥락

dooray-cli repo 가 "docs / ADR 작성 형식" 섹션에서 6 가지 가독성 + 토큰 효율 패턴을 정립.
ai-nodes 의 기존 docs / CLAUDE.md / SKILL.md 측정 결과 200자 초과 라인이 모노레포 레벨 4 파일에서 86건, sigil(`§`) 12건.
글로벌 `~/.claude/CLAUDE.md` `documentation_style` 은 `§` 미사용 정도만 강제 — 형식 정책은 부재.
AI 에이전트 컨텍스트 비용을 늘리지 않으면서 작성자 가독성도 보장하는 단일 형식 정책 필요.

### 결정

dooray-cli mirror 정책을 ai-nodes 에 도입.
단일 출처는 `ai-nodes/docs/docs-style.md`.

핵심 6 패턴:

- semantic line break — 문장당 1줄
- enumerated inline 금지 — `①②③` / `1) 2) 3)` / 슬래시 3개 이상은 bullet
- 괄호 중첩 2겹 이상 금지 — 단락 또는 bullet 분리로 평탄화
- `=` / `→` 동치·인과 압축 한 단락 1회만
- 80자 초과 + 백틱 3개 이상 또는 괄호 다수면 의미 단위 분할
- 한 bullet 다중 속성 sub-bullet 분리

부가 정책:

- 한국어 어색한 한자어 회피 표 (매트릭스 / 트리아지 / 베이스라인 / 스파이크 / 게이트 / 사전 소진 / 단일 진실원 등)
- 거울 구조 원칙 — 같은 정의를 두 docs 본문에 X, 단일 소스 + 역참조

적용 범위: CLAUDE.md / 5문서 / AGENTS.md / SKILL.md / references / tasks / README.

**거절한 대안**:

- 각 워크스페이스가 자기 형식 정책 운영 — 4 워크스페이스 drift 위험.
- 글로벌 `~/.claude/CLAUDE.md` 에 직접 추가 — 다른 프로젝트와 무관한 ai-nodes 한정 정책이라 글로벌 오염.
- CLAUDE.md inline 으로 직접 포함 — 토큰 비용 ↑, 워크스페이스 단위 결정도 inline 누적 중이라 더 비대화 위험.

### 결과

- 새 docs / SKILL.md / phase 작성 시 본 정책 준수.
- 기존 위반 (모노레포 4 파일 ~39건) 정정은 본 plan 에 포함.
- 워크스페이스 docs 위반 정정은 별도 후속 plan.
- 글로벌 `~/.claude/CLAUDE.md` `documentation_style` 은 그대로 유지 — 영역 다름 (글로벌 = 모든 프로젝트 공통, ai-nodes/docs/docs-style.md = ai-nodes 한정).

### 적용

- `ai-nodes/docs/docs-style.md` (신설, 본 ADR 의 단일 출처)
- `ai-nodes/CLAUDE.md` 1번 또는 라우팅 섹션에 docs-style.md 링크
- `ai-nodes/docs/workspace-structure.md` 워크스페이스 docs 표준에 docs-style.md 등록
- `skills/planning/SKILL.md` 5문서 공통 작성 원칙에서 docs-style.md 참조 (단일 소스 cross-link)

---

## ADR-006 — 워크스페이스 표준 패턴 변경: 통합 → 분리 (.claude/skills 본체화)

**Status**: Accepted
**Date**: 2026-05-19

### 맥락

ai-nodes ADR-004는 워크스페이스 표준을 `skills/<name>/{SKILL.md, references/, scripts/}` 통합 패턴으로 정식화.
하지만 career-os ADR-019는 분리 패턴 (의도된 비대칭).
두 패턴 공존 + apartment plan007에서 분리 패턴 포팅 결정 (apartment ADR-004) → 모든 active 워크스페이스가 분리로 수렴.

통합 표준이 *실제로는 비표준* — 비대칭 (career-os) + apartment 한정 적용 (plan007 전까지).
새 워크스페이스 추가 시 청사진이 *실제 사용 패턴*과 어긋남.

### 결정

ai-nodes 워크스페이스 표준 패턴을 **분리**로 변경:

- 표준: `<workspace>/scripts/<name>/` 실행 파일 + `<workspace>/.claude/skills/<name>/{SKILL.md, references/}` 컨텍스트 자산.
- career-os ADR-019 비대칭이 표준으로 격상. workspace-structure.md 의도된 비대칭 표에서 제거.
- ADR-004 *Partially superseded* — `skills/<name>/` 통합 표준 부분만. 5문서·.env·tasks/plan·CLAUDE 심링크 정책은 유효.
- workspace-structure.md 청사진 + 매트릭스 갱신.

거절한 대안:

- ADR-004 통합 표준 유지 + 워크스페이스별 비대칭 — 청사진 모호 지속.
- apartment 한정 단일 통합 (`.claude/skills/<name>/` + scripts 포함) — 세 번째 패턴, 정합 더 나쁨.

### 결과

- 모든 워크스페이스 분리 패턴 수렴 — career-os 이미 분리, apartment plan007에서 마이그.
- ai-nodes ADR-004 Status: `Partially superseded by ADR-006 (2026-05-19) — skills/<name>/ 통합 표준 부분`.
- career-os ADR-019 Status: `Lifted to ai-nodes ADR-006 (2026-05-19) — 비대칭이 표준으로 격상`.
- stock-investment / travel은 audit 시 본 표준 따름.
- native skill 단일 진입점 (`claude -p "/<name>"`) 일관.

**적용**: `apartment/tasks/plan007-skills-folder-retirement` phase-04 — workspace-structure.md 갱신 + ai-nodes/AGENTS.md §1-1 비대칭 표 제거. career-os 영향 없음 (이미 분리 패턴).
