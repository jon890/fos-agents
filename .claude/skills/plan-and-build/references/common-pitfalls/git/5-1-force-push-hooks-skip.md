---
id: 5-1
category: git
triggers:
  - force push
  - no-verify
  - hooks
  - destructive
tool_catchable: true
source:
  - ai-nodes git safety policy
related: []
---

# 5-1. force push와 hooks skip

## 증상

phase가 `--no-verify`, `--force`, `--no-edit`, `--no-gpg-sign` 같은 플래그를 시도한다.

## 왜

사용자 승인 없는 destructive git 동작과 검증 우회는 금지된다.

## Self-check

phase 안에 위험 플래그가 없는지 확인한다.
필요하다면 사용자 승인과 정당화를 별도로 남긴다.
