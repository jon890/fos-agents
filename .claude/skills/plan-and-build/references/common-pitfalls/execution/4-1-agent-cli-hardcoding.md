---
id: 4-1
category: execution
triggers:
  - agent CLI
  - skill 위임
  - 하드코딩
tool_catchable: false
source:
  - agent-agnostic skill invocation policy
related: []
---

# 4-1. agent CLI 하드코딩

## 증상

`SKILL.md`나 phase가 다른 skill을 위임하면서 특정 agent CLI 호출을 박는다.

## 왜

같은 `SKILL.md`를 Codex, Claude, Gemini가 함께 읽을 때 workflow가 한 agent에 종속된다.

## Self-check

skill 위임은 `/<skill> [args]` 의도 표현으로 적는다.
실제 실행기는 환경에 맡긴다.
