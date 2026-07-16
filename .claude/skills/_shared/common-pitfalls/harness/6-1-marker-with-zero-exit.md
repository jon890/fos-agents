---
id: 6-1
category: harness
triggers:
  - PHASE_FAILED
  - PHASE_BLOCKED
  - exit code
tool_catchable: false
source:
  - plan004-shared-helpers-ts
related: []
---

# 6-1. 실패 marker만 출력하고 정상 종료

## 증상

phase Claude가 `PHASE_FAILED` 또는 `PHASE_BLOCKED` marker만 stdout에 출력하고 exit 0으로 종료한다.

## 왜

`run-phases.py`는 exit code로 성공과 실패를 판정한다.
stdout marker는 알림용이다.

## Self-check

`PHASE_FAILED`나 `PHASE_BLOCKED`를 출력하는 분기 직후 non-zero exit을 명시한다.
blocked는 exit 2, failed는 exit 1을 사용한다.
해당 shell 블록은 Bash 도구로 직접 실행하라고 phase 본문에 적는다.
