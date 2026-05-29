# ADR — stock-investment

stock-investment 워크스페이스 아키텍처 결정 누적.
새 결정은 가장 아래에 추가.

형식: `## ADR-N — 제목` + Status / Date 라인 + 맥락 / 결정 / 결과 3섹션.

모노레포 레벨 ADR: `../docs/adr.md`.

History: 기존 `docs/decisions/001~007.md` 는 plan004에서 git rm 완료 — 자료는 plan001 phase-01에서 5문서 (prd/data-schema/flow/code-architecture/adr)로 재분배됨.

---

## Quick Index

| ADR | 제목 | Status | 한 줄 요약 |
|---|---|---|---|
| ADR-001 | 워크스페이스 ai-nodes 표준 구조 적용 시작 | Accepted | 5문서 + AGENTS 한글화 + CLAUDE 심링크 + tasks/ (plan001). 분리 패턴 (plan002) + AGENTS 강화 (plan003) + decisions 폐기 (plan004) 시리즈 완료 |
| ADR-002 | Discord 알림을 _shared/lib/notify_discord.ts로 통합 | Accepted | 워크스페이스 셸 notify_discord.sh 폐기, ts 정본 통합 (apartment ADR-009 미러) |
| ADR-003 | 3 skill native 전환 (외부 subprocess 폐기) | Accepted | claude json+extractor+track_task 래핑 폐기, native 직접 호출. Python 수집기 유지. apartment ADR-010 미러 |

---

## ADR-001 — 워크스페이스 ai-nodes 표준 구조 적용 시작

**Status**: Accepted
**Date**: 2026-05-20

### 맥락

stock-investment는 2026-05-05 운영 시작 이후 ai-nodes 표준 구조 (ADR-004) 미적용 상태로 유지됐다.
발견 시점 (2026-05-20 audit):

- 5문서 부재 (`docs/decisions/*` 7개만 — 기존 ADR 형식, 모노레포 표준 ADR-006 미적용)
- AGENTS.md 영문 짧음 (라우팅 / 외부 의존성 명세 미흡)
- CLAUDE.md 심링크 부재 (Claude Code 자동 로드 미활용)
- `tasks/` 부재 (plan 시스템 미운영)
- `.claude/skills/` 부재 (3 skill native 진입점 미등록)
- `skills/<name>/scripts/` 통합 패턴 (ai-nodes ADR-006 분리 표준 미적용)

워크스페이스 격리 원칙상 stock-investment를 *의도된 비대칭*으로 둘 수 있으나, 활성 운영 (매일 data 누적) 워크스페이스가 표준 부재 상태로 반복 audit drift 발생.
표준화로 전환한다.

### 결정

ai-nodes 표준 구조 적용 시리즈 시작. 3 plan 분할:

1. **plan001 (본 plan)**: docs 영역.
   - 5문서 신설
   - AGENTS.md 한글화
   - CLAUDE.md 심링크
   - `tasks/` 신설
   - `decisions/*` 7개는 5문서로 재분배 후 plan004에서 git rm 완료.
2. **plan002**: ADR-006 분리 패턴 마이그.
   - `skills/<name>/scripts/` → `scripts/<name>/` + `.claude/skills/<name>/{SKILL.md, references/}`
   - 3 skill 모두 적용.
3. **plan003**: AGENTS.md 강화 (4-1 진실 출처 + 4-2 투자 컨텍스트 + cron 시점 표).
4. **plan004**: `decisions/*` 7 파일 git rm + workspace-structure.md 매트릭스 stock-investment 항목 ?→O 갱신. .env는 plan001 phase-02 시점에 사용자 직접 신설 완료.

거절한 대안:

- 의도된 비대칭 공식화 ADR — 활성 운영 + audit drift 누적 상태에서 비표준 유지 비용 > 표준화 비용.
- 단일 큰 plan — 4-5 phase 한 번에 처리. rollback 복잡 + cron 영향 phase 안에 섞임. 시리즈가 안전.
- `decisions/*` 그대로 유지 + adr.md만 신규 — ai-nodes ADR-018 (개별 ADR 파일 신설 금지) 위반.

### 결과

- 워크스페이스 5문서 활성화 — drift 추적 단일 출처.
- Claude Code 자동 로드 → `claude -p "/<skill>"` 진입점 (plan002 후).
- `ai-nodes/docs/workspace-structure.md` 표에서 stock-investment 항목 갱신 (plan003 완료 후).
- 향후 plan 사이클 (`tasks/plan{N}-<slug>/`) 운영 가능.
- cron 운영 중단 없음 — plan001은 docs only. plan002 분리 마이그 시 cron 호출 경로 갱신 필요 (별도 plan에서 결정).

적용: plan001 (5문서 + AGENTS) → plan002 (분리 패턴) → plan003 (AGENTS 강화) → plan004 (decisions/ git rm + workspace-structure ✓).

---

## ADR-002 — Discord 알림을 `_shared/lib/notify_discord.ts`로 통합

**Status**: Accepted
**Date**: 2026-05-29

### 맥락

stock-investment는 워크스페이스 한정 셸 notifier `scripts/<name>/notify_discord.sh`로 Discord 알림을 보낸다.
morning-brief와 current-issue-analysis가 각자 notify_discord.sh를 두고, daily-note는 morning-brief의 notify_discord.sh를 cross-skill로 참조한다.

apartment는 ADR-009로 워크스페이스 셸 notifier를 폐기하고 `_shared/lib/notify_discord.ts` 정본으로 통합했다(openclaw subprocess + 10s 타임아웃, `DISCORD_CHANNEL_ID` 필수).
stock도 같은 정본을 쓰면 알림 인프라가 모노레포 단일 출처로 수렴한다.

### 결정

stock-investment 3 skill의 Discord 알림을 `_shared/lib/notify_discord.ts`로 통합한다.

- 워크스페이스 셸 `notify_discord.sh`(morning-brief, current-issue) git rm.
- daily-note의 cross-skill notify_discord.sh 참조 제거 — `_shared/lib/notify_discord.ts` 직접 호출.
- thin wrapper와 native skill이 `bun run _shared/lib/notify_discord.ts "<메시지>"`로 호출.

거절한 대안:

- 셸 notifier 유지 — apartment와 불일치, 타임아웃·정본 중복 지속.
- 별도 후속 plan으로 분리 — native 전환에서 어차피 러너를 재작성하므로 함께 처리가 효율적.

### 결과

- 모노레포 Discord 알림이 `_shared/lib/notify_discord.ts` 단일 정본으로 수렴(apartment·stock 공통).
- cross-skill notifier 참조 제거로 daily-note 독립성 확보.
- 단점: native 전환과 같은 plan에서 두 변경이 함께 진행 — phase 검증으로 분리.

**적용**: ADR-003 native 전환과 같은 plan010(stock plan006)에서 동시 적용. 각 skill phase에서 notify_discord.sh git rm + ts 호출 전환.

---

## ADR-003 — 3 skill native 전환 (외부 subprocess 패턴 폐기)

**Status**: Accepted
**Date**: 2026-05-29

### 맥락

stock-investment 3 skill(stock-investing-morning-brief, current-issue-analysis, daily-stock-analysis-note)이 모두 외부 subprocess 패턴이다.
각 `run_*.sh`가 `_shared/bin/track_task.sh`로 self-wrap되고, `claude --output-format json`을 호출한 뒤 `_shared/lib/extract_claude_result.ts`로 envelope를 파싱해 report.md를 만든다.

apartment가 ADR-010(plan010)으로 daily-report를 native skill 직접 호출로 전환해 패턴을 검증했다.
stock 3 skill은 apartment daily-report와 동일 구조라 같은 패턴을 복제한다.
`track_task.sh`가 남기는 `task-runs.jsonl`은 읽는 소비자가 없는 write-only 계측이다.

### 결정

3 skill을 native skill 직접 호출로 전환한다(apartment ADR-010 미러).

- Python 수집기(`collect_*.py`, `sanitize_fos_study_markdown.py`)는 유지한다.
  결정론적 데이터 수집이라 Claude로 재구현하지 않는다.
  native SKILL.md가 `python3` Bash로 호출한다.
- `claude --output-format json` + `extract_claude_result.ts` 추출 단계는 폐기한다.
  Claude가 수집 산출물을 Read하고 report.md를 직접 Write한다.
- `track_task.sh` self-wrap을 제거한다.
- 진입점은 interior·apartment의 `run_with_claude.sh` thin wrapper 패턴.
  `claude -p "/<skill>"` 호출 + Discord 시작/실패 알림(완료/요약은 native).
  current-issue는 issue-key 인자를 wrapper가 전달.
- daily-note의 fos-study 발행(`sanitize_fos_study_markdown.py` + git push)은 native skill 워크플로에 명시해 유지(cross-workspace 단방향 쓰기, ADR-001 예외).

연쇄 폐기 자산(`track_task.sh`, `update_artifacts.py`, `extract_claude_result.ts` 파일 자체)은 본 plan 범위가 아니다.
본 전환으로 ai-nodes 전체에서 호출처가 0이 되므로, 후속 ai-nodes 모노레포 정리 plan에서 파일을 제거한다.

거절한 대안:

- 옛 subprocess 패턴 유지 — career-os·apartment가 입증한 drift·복잡도 영구화.
- Python 수집기를 TS로 동시 마이그 — native 전환과 무관한 별개 축, 범위 확대.
- skill당 별도 plan — 동일 패턴 복제라 과분할, 한 plan 4 phase로 충분.

### 결과

- 3 skill이 apartment·interior와 동일 native 패턴으로 수렴 — 모노레포 일관성.
- `claude.result.json` / fallback 산출물 폐기.
- ai-nodes 전체에서 `track_task.sh` / `extract_claude_result.ts` / `update_artifacts.py` 호출처 0 — 후속 모노레포 정리 plan의 선결 조건 충족.
- 단점: native skill이 데이터 파이프라인 오케스트레이션까지 책임 — 수집 실패 처리를 SKILL.md가 명시해야 함.

**적용**: `stock-investment/.claude/skills/<name>/SKILL.md`(native 재작성) + `scripts/<name>/run_with_claude.sh`(신규) + 옛 `run_*.sh` 폐기. `stock-investment/tasks/plan006-skills-native-migration` phase 참조.
