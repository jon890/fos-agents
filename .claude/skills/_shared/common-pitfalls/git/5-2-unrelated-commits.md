---
id: 5-2
category: git
triggers:
  - 여러 commit
  - 무관 변경
  - atomic commit
tool_catchable: false
source:
  - ai-nodes git commit policy
related: []
---

# 5-2. 한 phase 여러 무관 commit

## 증상

phase가 docs 수정, 코드 수정, 새 ADR을 한 commit에 묶는다.

## 왜

history가 섞이고 revert가 어려워진다.
docs-first 원칙도 흐려진다.

## Self-check

각 commit이 단일 관심사인지 확인한다.
메시지 헤더는 conventional commits 형식을 따른다.
