## ADR-015 — career-os ADR을 개별 파일로 관리하는 파일럿 예외

- Status: Accepted
- Date: 2026-06-16

### 맥락

ADR-004는 모노레포 5문서 표준에 "adr.md 단일 누적, 개별 ADR 파일 신설 금지"를 포함한다.
career-os ADR이 88개로 누적되며 단일 adr.md의 읽기 효율 한계가 드러났다(career-os ADR-089, docs-check 감사 — Bloat 68%, 필요한 ADR만 로드 불가).

### 결정

- career-os는 ADR을 `docs/adr/ADR-NNN-slug.md` 개별 파일 + `docs/adr/INDEX.md`로 관리하는 파일럿 예외로 둔다.
- ADR-004의 "개별 ADR 파일 신설 금지"는 다른 워크스페이스(apartment·stock-investment·travel·health-care)에 그대로 유지한다.
- career-os ADR-019(scripts/ 분리)와 같은 의도된 비대칭으로 본다.
- 거절한 대안 — 모노레포 전체 즉시 전환: career-os 파일럿으로 읽기 효율·관리 비용을 검증한 뒤 확산을 별도 결정한다.

### 결과

- career-os만 `adr/` 개별 파일, 나머지 워크스페이스는 adr.md 단일 누적을 유지한다.
- 전역 스킬(planning·plan-and-build·docs-check)은 워크스페이스별 ADR 구조를 분기해야 한다.
- 파일럿 검증 결과가 좋으면 ADR-004를 개정해 모노레포 전체로 확산한다.

### 적용

- `career-os/docs/adr/` (career-os ADR-089의 전환 산출물)
- `docs/workspace-structure.md` (career-os ADR 구조 비대칭 기록)
