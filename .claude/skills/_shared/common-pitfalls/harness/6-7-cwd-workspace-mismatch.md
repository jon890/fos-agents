---
id: 6-7
category: harness
triggers:
  - cwd
  - workspace path
  - run-phases.py
tool_catchable: false
source:
  - plan024
  - plan002 first-run hotfix
related: []
---

# 6-7. run-phases.py cwd와 workspace path 불일치

## 증상

phase 본문 bash 명령이 `<workspace>/...` repo root 기준 path를 사용한다.
하지만 `run-phases.py`는 cwd를 workspace로 잡아 `<workspace>/<workspace>/path`가 된다.

## 왜

phase 본문 path 컨벤션과 실행 cwd가 충돌한다.
task-create 지시가 약하면 작성자가 매번 같은 실수를 반복한다.

## Self-check

phase 본문 bash 명령에 `<workspace>/...` path가 등장하면 첫 bash 블록에서 repo root로 이동한다.

```bash
cd "$(git rev-parse --show-toplevel)"
pwd
```

Claude Code Bash 도구는 같은 phase 안에서 cwd를 보존한다.
Edit 도구는 absolute path를 쓰면 cwd와 무관하다.
