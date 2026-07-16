---
id: 2-1
category: workspace
triggers:
  - 다른 워크스페이스
  - cross-workspace
  - workspace 격리
tool_catchable: true
source:
  - ai-nodes workspace isolation policy
related: []
---

# 2-1. 다른 워크스페이스 자산 참조

## 증상

한 워크스페이스 task가 다른 워크스페이스 path를 import, read, write한다.

예:

- `apartment/`
- `career-os/`
- `stock-investment/`

## 왜

ai-nodes는 워크스페이스 격리 원칙을 갖는다.
다른 워크스페이스는 별도 세션과 별도 결정 흐름으로 다룬다.

## Self-check

phase path가 현재 `<workspace>/`, `_shared/`, `.claude/skills/` 범위에서 시작하는지 확인한다.
다른 워크스페이스 디렉터리명이 등장하면 정당화 ADR을 남기거나 제거한다.
