---
id: 5-4
category: git
triggers:
  - 병렬 task
  - main worktree
  - worktree
  - active task
tool_catchable: false
source:
  - 2026-06-07 background implementation policy
related: []
---

# 5-4. 병렬 task를 main worktree에서 구현

## 증상

다른 task가 active거나 dirty state가 있는데 background 구현자가 main worktree에서 직접 edit 또는 write한다.

## 왜

단순한 "구현해줘" 요청은 main worktree가 안전하다는 허가가 아니다.
병렬 작업은 git add, commit, push 범위가 섞인다.

## Self-check

phase 시작 전에 `git status --porcelain`, `git branch --show-current`, active task 여부를 확인한다.
active task가 2개 이상이면 별도 worktree와 branch를 사용한다.
main worktree 직접 편집은 단일 active task, 작은 docs/process-only 변경, 또는 사용자 명시 허용에 한정한다.
