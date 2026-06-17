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
