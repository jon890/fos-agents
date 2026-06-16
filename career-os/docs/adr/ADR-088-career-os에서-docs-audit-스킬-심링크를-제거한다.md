## ADR-088 — career-os에서 docs-audit 스킬 심링크를 제거한다

- Status: Accepted
- Date: 2026-06-16

### 맥락

`docs-audit`는 fos-study 외부 repo의 스킬로 향하는 심볼릭 링크였다.
[[ADR-085]](Codex 노출)와 [[ADR-086]](출력 정책 공통화)은 이 심링크가 외부 repo를 정본으로 두기 때문에 두 정책의 공통화 대상에서 예외로 제외했다.

문제는 career-os 단독 checkout 환경에는 `sources/fos-study`가 없다는 점이다.
이때 `.claude/skills/docs-audit/SKILL.md` 심링크는 항상 깨진 상태로 남는다.
스킬 목록에 실행 불가능한 항목이 상주해 신규 에이전트가 실효 없는 스킬을 발견하고, `code-architecture.md`와 `data-schema.md`가 이를 "실체 디렉터리"라고 기술해 혼란을 키운다.
docs-audit는 본래 fos-study 문서를 감사하는 스킬이므로 career-os 워크스페이스에서 호출할 일도 사실상 없다.

### 결정

- career-os의 `.claude/skills/docs-audit/` 디렉터리를 제거한다.
- docs-audit가 필요한 작업은 fos-study repo checkout 환경에서 그 repo의 스킬을 직접 실행한다.
- 거절한 대안 — 심링크 유지: 깨진 채 상주해 발견 가능성만 남고 실행은 불가하므로 가치가 없다.
- 거절한 대안 — SKILL.md를 career-os 내부로 복제: fos-study 정본과 이중 관리가 되고 거울 구조 원칙에 어긋난다.

### 결과

- career-os 스킬 목록이 이 워크스페이스에서 실제 실행 가능한 스킬만 노출한다.
- [[ADR-085]]·086이 docs-audit를 예외로 두던 근거가 사라진다 — 두 ADR의 docs-audit 예외 항목은 본 ADR 이후 무효다.
- 단점 — fos-study 문서 감사가 필요하면 fos-study checkout으로 이동해 그 repo의 스킬을 실행해야 한다.
