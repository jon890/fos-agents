---
id: 6-3
category: harness
triggers:
  - JSON newline
  - no newline
tool_catchable: true
source:
  - common-pitfalls history
related: []
---

# 6-3. JSON 산출물 trailing newline 누락

## 증상

JSON 파일이 `No newline at end of file` 상태로 기록된다.

## 왜

POSIX text file 관례와 repo diff 가독성을 깨뜨린다.

## Self-check

JSON write 시 `json.dumps(...) + "\n"` 형태를 사용한다.
기존 JSON 수정 시 원본 trailing newline을 보존한다.
