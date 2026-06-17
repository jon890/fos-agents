---
id: 1-5
category: plan
triggers:
  - ADR
  - 결정
  - trade-off
  - supersede
tool_catchable: false
source:
  - apartment plan003 ADR-005 first draft
related:
  - ../../../../planning/references/adr-writing.md
---

# 1-5. ADR 단일 책임 위반

## 증상

한 plan에서 발생한 여러 독립 결정을 한 ADR에 묶는다.
`결정` 섹션에 trade-off 축이 다른 항목이 여러 개 들어간다.

## 왜

후속에서 "ADR-N의 어느 부분을 supersede하나"가 모호해진다.
planning skill의 "한 ADR = 한 의사결정" 원칙을 위반한다.

## Self-check

결정이 2개 이상이면 trade-off 축이 같은지 자문한다.
독립적으로 supersede 가능하면 ADR을 분리한다.
모호하면 분리를 기본값으로 둔다.
