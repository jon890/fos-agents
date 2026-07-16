---
id: 1-2
category: plan
triggers:
  - 성공 기준
  - 검증 기준
  - 동작 확인
tool_catchable: false
source:
  - common-pitfalls history
related: []
---

# 1-2. 모호한 성공 기준

## 증상

성공 기준이 "정상 동작 확인" 같은 모호한 동사로 끝난다.

## 왜

`run-phases.py`는 exit code만 본다.
사람 판정 phase는 자동화할 수 없다.

## Self-check

한 줄 실행 명령으로 exit 0과 그 외 상태를 단정할 수 있어야 한다.

예:

- `bash -n script.sh`
- `python3 -m py_compile file.py`
- `[ -f path ]`
