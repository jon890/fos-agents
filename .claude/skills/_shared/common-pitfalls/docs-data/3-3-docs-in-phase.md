---
id: 3-3
category: docs-data
triggers:
  - phase에서 docs 수정
  - docs-first
  - 정책 문서
tool_catchable: false
source:
  - ai-nodes docs-first policy
related: []
---

# 3-3. phase 안에서 docs 갱신

## 증상

구현 phase가 `docs/code-architecture.md` 같은 정책 문서를 수정한다.

## 왜

docs-first 원칙에서는 task 생성 전에 문서 결정을 별도 커밋으로 고정한다.
구현 phase 실패 시 docs 변경도 함께 흔들리면 결정과 실행 이력이 섞인다.

## Self-check

모든 docs 변경이 task 생성 전 별도 커밋에 포함되었는지 확인한다.
phase 본문에 docs 수정이 있다면 의도된 docs-update phase인지 확인한다.
