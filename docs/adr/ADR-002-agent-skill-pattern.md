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
