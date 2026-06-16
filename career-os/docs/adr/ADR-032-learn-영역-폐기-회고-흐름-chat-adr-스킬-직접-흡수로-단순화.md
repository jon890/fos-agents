## ADR-032 — learn/ 영역 폐기 — 회고 흐름 chat + ADR/스킬 직접 흡수로 단순화

**Status**: Accepted
**Date**: 2026-05-17

### 맥락

ADR-018에서 `docs/` 4 영역 (5문서 + learn + hand-off + prep)으로 운영 정의. learn은 "결정 굳어지기 전 사고 흐름" 영역이었으나, plan013~022 진행 중 실측 패턴은:

- 사용자 ↔ Claude 대화로 회고가 *즉시 결정으로 굳어짐* — 중간 메모 단계 거의 사용 안 함
- 굳어진 결정은 *바로 ADR / 스킬 본체*로 흡수됨 — learn 거치지 않음
- 008-docs-audit-quality-loop가 *유일하게 남은 learn 노트* — fos-study docs-audit 스킬로 직접 흡수 가능했음

→ learn은 *과도기적 영역*. 영역 자체가 회고 흐름 속도와 맞지 않음.

### 결정

- `career-os/docs/learn/` 디렉터리 + 모든 콘텐츠 폐기 (008-docs-audit-quality-loop.md + README.md)
- 회고 흐름은 두 경로로 정리:
  - **휘발성 회고** — chat 대화 안에서만 유지 (Claude 컨텍스트 + git log)
  - **굳어진 회고** — ADR / 스킬 본체로 *직접* 흡수 (learn 중간 단계 생략)
- `docs/` 영역 4 → 3: 5문서 + hand-off + prep
- [[ADR-018]] Status: `Partially superseded by ADR-032 (2026-05-17, learn 영역 폐기)` — hand-off / prep 영역 유지 결정은 살아있음

### 거절한 대안

- learn 영역 유지 + 빈 폴더 보존: 사용 빈도 낮으면 *어디에 적을지 매번 의문* — 영역 폐기가 명확.
- 회고를 hand-off / prep으로 통합: 도메인 다름 (회고 ≠ 인수인계 ≠ 이벤트 준비).

### 결과

- docs/ 단순화 — 5문서 + hand-off + prep + tasks (영구 자산은 5문서 + 스킬 + ADR).
- 새 회고 위치 매번 결정 부담 ↓ — chat → 굳으면 ADR.
- 단점: 회고 누적 자산이 없어 *과거 사고 흐름* 추적 시 git log + chat 검색 의존 (이미 그 패턴이 dominant라 무리 없음).

### 적용

`docs/code-architecture.md` 트리에서 learn/ 라인 제거. AGENTS.md 5문서 라우팅 가이드는 영향 없음 (learn 명시 없음).
