---
id: 3-2
category: docs-data
triggers:
  - ADR 저장 위치
  - 개별 ADR
  - append
tool_catchable: false
source:
  - repository ADR structure
related:
  - ../../../../../planning-overlay.md
---

# 3-2. ADR 저장 방식 혼용

## 증상

하나의 누적 파일에 여러 결정을 계속 추가하거나 INDEX 갱신 없이 ADR 파일만 추가한다.

## 왜

루트와 모든 워크스페이스는 `docs/adr/` 개별 파일과 `INDEX.md` 구조를 사용한다.

## Self-check

새 ADR은 `<scope>/docs/adr/ADR-NNN-slug.md`와 같은 디렉터리의 `INDEX.md` 행을 함께 추가한다.
기술 결정이 없으면 `INDEX.md`만 유지한다.
