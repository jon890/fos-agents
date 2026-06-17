---
id: 6-5
category: harness
triggers:
  - 제거
  - 삭제
  - additive
  - destructive
tool_catchable: false
source:
  - plan002-config-consolidation
related: []
---

# 6-5. destructive 변경을 additive 변경으로 바꿔치기

## 증상

phase가 "본문 제거" 또는 "본문 삭제"를 지시했지만 실행 agent가 옛 본문을 유지하고 안내 문구만 추가한다.

## 왜

agent는 destructive edit보다 additive edit을 선호한다.
안전해 보이지만 실제로는 요구사항을 만족하지 못한다.

## Self-check

destructive 표현이 있으면 제거 대상 본문, line anchor, 반증 검증을 명시한다.
검증은 `grep -c '본문 키워드' file.md`가 0인지 확인하는 식으로 작성한다.
