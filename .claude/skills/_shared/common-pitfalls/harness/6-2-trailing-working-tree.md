---
id: 6-2
category: harness
triggers:
  - trailing working tree
  - commitSha
  - updated_at
tool_catchable: true
source:
  - run-phases.py commitSha behavior
related: []
---

# 6-2. 마지막 phase 끝 trailing working tree 변경

## 증상

모든 phase commit과 push가 끝났는데 `git status`에 `commitSha`, `updated_at` 같은 변경이 남는다.

## 왜

`run-phases.py`는 phase 자체 commit 후 `index.json`에 commit SHA를 후기록한다.
이 후기록 변경은 별도 정리가 필요할 수 있다.

## Self-check

plan 마지막에 `git status --porcelain | wc -l`을 확인한다.
0이 아니면 trailing cleanup commit과 push 사후 단계를 포함한다.
