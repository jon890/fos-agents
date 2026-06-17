---
id: 1-1
category: plan
triggers:
  - 파일 수
  - 줄 수
  - 감소량
  - 개수
tool_catchable: false
source:
  - common-pitfalls history
related: []
---

# 1-1. 수치 추측

## 증상

수치를 실측 없이 추정한다.

예: "약 30개 파일", "100줄 줄어듦".

## 왜

critic이 가장 먼저 검증한다.
추측은 즉시 revise 사유가 된다.

## Self-check

모든 수치 옆에 실측 명령을 동반한다.

예:

- `find <path> -name '*.py' | wc -l`
- `wc -l <file>`
- `git ls-files <pattern> | xargs wc -l`

추정치는 `약` 또는 `추정`을 명시한다.
