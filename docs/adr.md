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
| ADR-007 | SKILL.md 한국어화 표준 + skill-creator 검토 정책 | Accepted | skill description/body 한국어화, references 한국어화, skill-creator 검토 동시 적용 |
| ADR-008 | planning은 대화형 합의, Claude 비대화형은 구현 전용 | Accepted | 모든 워크스페이스에서 `/planning` 비대화형 실행 금지, 합의된 phase 구현에만 Claude 비대화형 사용 |
| ADR-009 | fos-brain 외부 연동: thin caller + 외부 배치 + 워크스페이스 공유 의존성 | Accepted | 5 워크스페이스가 외부 `~/personal/fos-brain`을 brain skill 호출로 연동, 격리 의도적 예외 |
| ADR-010 | brain 쓰기 안전·프라이버시: 산출물 종류별 라우팅 + cron 읽기전용 | Accepted | 개인 데이터 private 기본·fos-study public-OK, cron은 읽기만·쓰기는 대화형 한정 |

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
ai-nodes 의 기존 docs / CLAUDE.md / SKILL.md 측정 결과 200자 초과 라인이 모노레포 레벨 4 파일에서 86건, section mark 12건.
글로벌 `~/.claude/CLAUDE.md` `documentation_style` 은 section mark 미사용 정도만 강제 — 형식 정책은 부재.
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

**적용**: `apartment/tasks/plan007-skills-folder-retirement` phase-04 — workspace-structure.md 갱신 + ai-nodes/AGENTS.md 1-1 비대칭 표 제거. career-os 영향 없음 (이미 분리 패턴).

## ADR-007 — SKILL.md 한국어화 표준 + skill-creator 검토 정책

**Status**: Accepted
**Date**: 2026-05-21

### 맥락

ai-nodes 모노레포 21개 SKILL.md 의 한국어화 상태가 워크스페이스별로 혼재.

| 워크스페이스 | skill 수 | 현재 상태 |
|---|---|---|
| ai-nodes/skills/ | 5 | 부분 (3개 한국어, 2개 영문 — agent-browser, workspace-audit) |
| apartment | 2 | 영문 |
| career-os | 8 | 한국어 (description + 본문 정리됨) |
| stock-investment | 3 | 영문 |
| health-care | 3 | 영문 |

사용자가 "본인이 직접 함께 수정할 수 있는 형태" 를 요구.
형식 정책 (한자어·외래어 회피 + 8가지 형식 패턴) 은 `docs/docs-style.md` 단일 출처 (ADR-005).
본 ADR 은 *SKILL.md 한정 한국어화 정책 + skill-creator 검토 활용* 결정.

### 결정

1. **frontmatter `description` 한국어 본문 + trigger phrase 인용 패턴 채택**.
   career-os 의 기존 패턴을 표준으로 격상.
   - 한국어 본문 + 따옴표로 한국어 자연어 trigger phrase 명시
   - 슬래시 명령 (`/skill-name`) 명시
   - 영문 keyword 가 필요하면 본문 뒤에 짧게 추가

2. **본문 markdown 은 한국어 prose + 한국어 H2 헤더**.
   기술 식별자 (파일 path, command, function·variable name) 만 영문 유지.
   `docs/docs-style.md` 8가지 형식 패턴 따름.

3. **references/*.md 도 한국어화 대상**.
   외부 도구 출력 인용·코드 블록·기술 표준 인용 부분은 원어 유지.

4. **skill-creator 검토 동시 적용**.
   한국어화 + skill 강화 한 phase 안에서 4축 평가:
   - trigger keyword 적정성
   - workflow 명확도
   - boundary 누락
   - SKILL.md 비대 (12KB+ 압축 후보)

   career-os 8 skill 도 검토 대상 (한국어 리라이트는 제외).

5. **신규 skill 도 본 표준 따름**.
   ai-nodes/skills/ + 워크스페이스 .claude/skills/ 전체 적용.

거절한 대안:

- 완전 영문 description + 한국어 본문 — skill discovery 매칭은 좋지만 사용자 가독성 낮음.
- bilingual 병기 (영문/한국어 둘 다) — SKILL.md 비대화.
- career-os 만 한국어 + 나머지 영문 유지 — 일관성 깨짐.

### 결과

- 사용자가 직접 SKILL.md 편집 가능 — 한국어 prose 가 진입 장벽 낮춤.
- skill discovery 매칭 (영문 호출 패턴 포함) 일관성 유지.
- 21 SKILL.md 본문 + frontmatter 정합성↑.
- 단점: 미래 신규 skill 도입 시 한국어화 + skill-creator 검토 부담 추가.

### 적용

형식 정책은 `docs/docs-style.md` 따른다.

실행 task 분리 (워크스페이스 격리 원칙):

- `ai-nodes/tasks/plan002-skill-korean-policy/` — ai-nodes/skills/ 5개 (영문 2개 한국어화 + 한국어 3개 skill-creator 강화)
- `apartment/tasks/plan008-skill-korean-rewrite/` — apartment 2개 + 마지막 phase cron payload 슬림화
- `stock-investment/tasks/plan005-skill-korean-rewrite/` — stock-investment 3개
- `health-care/tasks/plan003-skill-korean-rewrite/` — health-care 3개
- `career-os/tasks/plan028-skill-creator-audit/` — career-os 8개 (한국어 X, skill-creator 강화만)

---

## ADR-008 — planning은 대화형 합의, Claude 비대화형은 구현 전용

- Status: Accepted
- Date: 2026-05-26

### 맥락

career-os application-flow-agent 계획 중 `claude -p "/planning ..."` 비대화형 실행을 시도했지만, 복잡한 설계 결정과 사용자 선호를 제대로 반영하기 어려웠다. planning은 자율성 수준, 외부 제출 경계, public/private 경계, 상태 전이 책임처럼 대화 중 확인해야 할 결정이 많다.

반대로 합의된 task/phase 구현은 Claude 비대화형 실행이 유용하다. 구현 지시서가 충분히 구체적이면 Claude가 파일 작성과 반복 작업을 처리하고, Codex가 결과를 검토·검증하는 구조가 맞다.

### 결정

- 모든 ai-nodes 워크스페이스에서 planning은 Codex와 사용자의 대화형 합의를 기본으로 한다.
- planning skill은 비대화형 명령이 아니라 다음 구조를 잡는 프레임으로 사용한다.
  - 목표 재정의
  - 3-5개 phase
  - 열린 결정
  - 추천 기본값
  - 다음 액션
- `claude -p "/planning ..."` 비대화형 planning은 기본 사용하지 않는다.
- Claude 비대화형 실행은 합의된 task/phase의 구현에만 사용한다.
- Codex는 planning brief 작성, 결정사항 기록, task 파일 고정, Claude 구현 결과 review, 검증, 의도한 변경만 commit/push하는 책임을 가진다.

거절한 대안:

- Claude 비대화형 planning 계속 사용 — 중요한 애매함과 사용자 선호를 놓칠 위험이 큼.
- 모든 구현도 Codex가 직접 수행 — 긴 문서 작성/반복 구현에서 Claude native skill의 장점을 버림.

### 결과

- planning 단계에서 사용자 승인과 열린 결정이 명시된다.
- 구현 단계에서는 Claude 비대화형 실행을 계속 활용할 수 있다.
- Codex가 최종 품질 게이트와 git 변경 범위를 책임진다.

### 적용

- `ai-nodes/AGENTS.md` planning / implementation 위임 원칙.
- `docs/workspace-structure.md` tasks/plan 컨벤션.
- 워크스페이스별 AGENTS.md가 별도 정책을 가진 경우 본 ADR을 상위 기본값으로 참조한다.

---

## ADR-009 — fos-brain 외부 연동: thin caller + 외부 배치 + 워크스페이스 공유 의존성

- Status: Accepted
- Date: 2026-05-28

### 맥락

사용자가 개인 지식 기반 fos-brain(`github.com/jon890/fos-brain`)을 Karpathy 스타일 LLM wiki로 구축했다.
brain은 자체 완결 시스템이다.

- 세 네임스페이스 — public / private / work.
- `raw/`(원본) + `wiki/`(컴파일) 모델.
- 자체 skill 3개 — brain-add / brain-search / brain-lint (repo `skills/`에 체크인).
- qmd 검색 + Quartz UI.

ai-nodes 5개 워크스페이스 agents가 작업 중 brain을 읽고(컨텍스트 활용) 쓰는(학습 적재) 양방향 연동을 원한다.
ai-nodes는 openclaw(discord + cron) 경유로 이 Linux 머신에서 실행된다.
brain은 ai-nodes와 별개 repo이며, 지금까지 워크스페이스는 서로 격리(ADR-001 계열)되어 외부 공유 자산을 두지 않았다.

### 결정

- **thin caller** — ai-nodes는 brain 로직을 재구현하지 않고 brain 자체 skill(brain-search / brain-add)을 호출만 한다. brain의 스키마·백링크·INDEX·네임스페이스 규칙은 brain repo가 단일 소스.
- **외부 배치** — brain은 ai-nodes 밖 `~/personal/fos-brain`에 둔다. ai-nodes 안에 클론을 중첩하지 않는다.
- **워크스페이스 공유 의존성(격리 의도적 예외)** — 5개 워크스페이스 전부가 동일 외부 brain을 읽고 쓸 수 있다. 워크스페이스 격리(서로의 자산 비참조) 원칙의 *의도된 예외* — brain은 워크스페이스가 아니라 `_shared/`의 외부판에 해당하는 공유 자원.
- **접근 경로 = 전역 skill** — brain repo의 `skills/brain-*`를 `~/.claude/skills/`에 symlink한다. openclaw가 띄우는 `claude -p` 세션이 전역 skill로 발견.

전제조건 (brain repo 소관, ai-nodes 범위 밖):

- brain skill 본문의 대상 경로가 `/Users/nhn/personal/fos-brain`(Mac)로 하드코딩되어 있다.
- Linux 무인 실행이 가능하려면 `~/personal/fos-brain`로 통일해야 한다.
- ai-nodes는 brain repo를 편집하지 않으므로 이 수정은 사용자가 brain repo에서 처리.

거절한 대안:

- ai-nodes 자체 brain-bridge skill로 brain 파일 직접 read/write — brain 로직(백링크·Sources·INDEX·라우팅) 중복 + drift 위험.
- brain을 ai-nodes 안에 클론(`career-os/sources/fos-study` 패턴) — fos-study는 단방향 읽기 소스라 맞지만, brain은 read+write + private/work 네임스페이스(gitignore)라 ai-nodes git 중첩 시 비공개 유출·push 사이클 충돌.
- qmd / MCP 별도 인터페이스 — brain repo에 MCP 서버 코드가 없어 선행 구축 비용.

### 결과

- ai-nodes는 brain의 *호출자*로만 동작 — brain 진화가 자동 반영, drift 없음.
- 워크스페이스 격리의 명시적 예외가 ADR로 가시화 — 다음 audit이 "고아 외부 의존성"으로 오판하지 않음.
- brain skill 미설치 머신에서는 연동이 동작하지 않음 — 전제조건(클론 + symlink + 경로 통일)이 충족돼야 함.
- 쓰기 방향의 안전·프라이버시 정책은 ADR-010이 책임.

### 적용

- 단일 소스 정책: `ai-nodes/AGENTS.md` 13번 "fos-brain 외부 연동" 섹션.
- 워크스페이스 AGENTS.md는 본 ADR + ADR-010 역참조 + 자기 산출물 라우팅만 명시(거울 구조).
- 전제조건 체크리스트(클론·symlink·경로 통일·openclaw wrapper 동기화)는 사용자 수동 1회.
- `ai-nodes/tasks/plan003-fos-brain-integration` phase 참조.

---

## ADR-010 — brain 쓰기 안전·프라이버시: 산출물 종류별 네임스페이스 라우팅 + cron 읽기전용

- Status: Accepted
- Date: 2026-05-28

### 맥락

ADR-009로 ai-nodes가 brain에 양방향 연동한다.
쓰기(brain-add)는 두 위험을 동반한다.

- 프라이버시 — ai-nodes 데이터 대부분이 개인 자료(커리어·건강·재무·매물·여행). public 네임스페이스로 잘못 가면 Quartz 공개 빌드로 유출.
- 무인 실행 — brain-add는 대화 집약형(네임스페이스·소스·검증 게이트가 전부 AskUserQuestion). openclaw cron 무인 세션에서 멈추거나, 검증 게이트를 무인화하면 오지식 유입.

한편 brain-add엔 이미 "fos-study 출처 = public-OK 기본" 규칙이 있어 career-os study 산출물은 공개 가능하다.

### 결정

- **산출물 종류별 라우팅** — 워크스페이스가 아니라 산출물 *종류*로 네임스페이스를 정한다.
  - fos-study 파생 지식 → public-OK (brain-add 기본 규칙 준수).
  - 개인 데이터(career baseline·건강·재무·매물·여행 등) → private 기본.
  - public은 게시 적정성이 확인된 일반 지식에 한해 명시적 opt-in.
  - 워크스페이스 skill이 brain-add 호출 시 네임스페이스를 명시 전달 → brain-add 0단계 프롬프트 회피.
- **cron 읽기전용 / 쓰기 대화형 한정** — openclaw cron 무인 세션은 brain-search 읽기만 한다. brain 적재(brain-add)는 discord 대화 세션에서 사람 검토 후. brain-add의 대화 게이트(검증 게이트 포함)를 무인화하지 않는다.

거절한 대안:

- 전부 private 통일 — 안전하나 fos-study public-OK 이점 포기.
- 워크스페이스별 단일 네임스페이스 — career-os가 study(public)와 개인 baseline(private)을 섞어 부정확.
- cron도 인자 사전공급해 무인 brain-add — 검증 게이트 무인화 = 오지식 유입 위험.
- cron이 쓰기 후보를 큐에 적재 후 사람이 검토 — 큐 관리 복잡도 추가, 현 규모에 과설계.

### 결과

- 개인 데이터의 public 유출 경로가 정책으로 차단된다.
- cron 데일리는 brain을 읽어 컨텍스트로만 활용 — 쓰기 노이즈·오지식 유입 없음.
- brain 적재는 사람 검토를 거쳐 품질 유지.
- 단점: 자동 적재 부재 — 가치 있는 cron 발견도 사람이 대화형으로 옮겨야 함(의도된 트레이드오프).

### 적용

- 단일 소스: `ai-nodes/AGENTS.md` 13번 섹션의 네임스페이스 라우팅 표 + cron 정책.
- 워크스페이스 AGENTS.md는 자기 산출물 종류 → 네임스페이스 매핑만 명시.
- `ai-nodes/tasks/plan003-fos-brain-integration` phase 참조.
