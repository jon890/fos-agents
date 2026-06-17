---
id: 1-4
category: plan
triggers:
  - 범위 외
  - 검증 충돌
  - phase 경계
tool_catchable: false
source:
  - common-pitfalls history
related: []
---

# 1-4. 범위 외 명시와 검증 충돌

## 증상

`phase-N`의 "범위 외" 항목이 다른 phase의 검증 통과 조건에 등장한다.

## 왜

phase 간 기대값 불일치는 자기모순이다.
`run-phases.py`는 phase 간 일관성을 검사하지 않는다.

## Self-check

"범위 외" 또는 "이번 phase에서 안 함" 항목이 다른 phase 검증식에 등장하지 않는지 확인한다.
정량 검증 기준이 실제 작업 범위와 맞아야 한다.
