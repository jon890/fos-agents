---
id: 5-5
category: git
triggers:
  - dirty file
  - stage 범위
  - git add
tool_catchable: true
source:
  - 2026-06-07 background implementation policy
related: []
---

# 5-5. unrelated dirty files를 stage

## 증상

phase commit에 이전 작업의 dirty file, format-on-save, 다른 워크스페이스 변경이 같이 들어간다.

## 왜

phase 경계는 commit과 push 경계다.
무관한 파일이 섞이면 review와 rollback이 어려워진다.

## Self-check

commit 직전 `git diff --cached --name-only`와 `git status --short`를 확인한다.
intended files만 stage한다.
unrelated dirty files는 수정, stage, commit하지 않는다.
