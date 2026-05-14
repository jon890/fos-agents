# ADR — ai-nodes 모노레포 아키텍처 결정 기록

ai-nodes 모노레포 레벨에서 모든 워크스페이스에 영향을 주는 결정을 시간순으로 누적 기록한다. 워크스페이스 한정 결정은 `<workspace>/docs/adr.md`에 둔다(예: `career-os/docs/adr.md`).

형식: `## ADR-N — 제목` + Status / Date + 5섹션 (맥락 / 결정 / 결과 / 적용). 폐기·supersede는 status 라인에 명기.

번호 체계: 워크스페이스 ADR과 별개 namespace. 본 파일은 ADR-001부터 새로 시작.

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
