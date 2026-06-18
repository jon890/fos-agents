---
id: 3-2
category: docs-data
triggers:
  - ADR 저장 위치
  - 개별 ADR
  - append
tool_catchable: false
source:
  - career-os ADR individual files pilot
related:
  - ../../../../planning/references/adr-writing.md
---

# 3-2. ADR 저장 방식 혼용

## 증상

워크스페이스 방식을 착각한다.
ai-nodes root나 career-os에서 `docs/adr.md`에 append하거나,
다른 워크스페이스에서 개별 ADR 파일을 신설한다.

## 왜

ai-nodes root와 career-os는 `docs/adr/` 개별 파일과 `INDEX.md` 구조를 사용한다.
다른 워크스페이스는 `docs/adr.md` 단일 파일 누적 방식을 사용한다.

## Self-check

ai-nodes root 새 ADR은 `docs/adr/ADR-NNN-slug.md` 새 파일과 `docs/adr/INDEX.md` 행 추가로 처리한다.
career-os 새 ADR은 `career-os/docs/adr/ADR-NNN-slug.md` 새 파일과 `career-os/docs/adr/INDEX.md` 행 추가로 처리한다.
그 외 워크스페이스는 `<workspace>/docs/adr.md` 맨 아래에 append한다.
