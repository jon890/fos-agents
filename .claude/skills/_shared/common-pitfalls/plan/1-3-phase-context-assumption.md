---
id: 1-3
category: plan
triggers:
  - phase 분리
  - 이전 phase
  - context
tool_catchable: false
source:
  - common-pitfalls history
related: []
---

# 1-3. phase 간 컨텍스트 공유 가정

## 증상

`phase-N`이 `phase-M` 결정을 "위에서 결정"이라 가정한다.

## 왜

`run-phases.py`는 phase마다 새 Claude 프로세스를 실행한다.
이전 대화 컨텍스트가 없다.

## Self-check

각 `phase-NN.md`는 첫 줄부터 다른 phase를 보지 않고 실행할 수 있어야 한다.
이전 phase 출력 파일이 필요하면 정확한 경로를 명시한다.
