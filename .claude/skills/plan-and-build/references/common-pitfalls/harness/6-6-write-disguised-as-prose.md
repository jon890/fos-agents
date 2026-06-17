---
id: 6-6
category: harness
triggers:
  - Write 위장
  - prose-only
  - SKILL.md 재작성
  - commitSha false
tool_catchable: false
source:
  - plan013-study-pack-writer-native
related: []
---

# 6-6. Write 위장과 commitSha false 기록

## 증상

phase 본문이 draft를 prose 안 코드 블록으로 넣는다.
실행 agent가 Write 호출 없이 "다 작성했다"는 prose 응답으로 종료한다.
`run-phases.py`가 직전 HEAD를 commitSha로 기록해 false history가 생긴다.

## 왜

prose 안 draft 코드 블록은 agent에게 두 해석을 허용한다.
실제 Write보다 prose 응답이 token 비용이 작아 그 경로를 선호할 수 있다.

## Self-check

전면 재작성 요구 시 아래 중 하나를 적용한다.

- draft를 `<plan>/draft/<basename>.md` 같은 별도 파일로 분리한다.
- "본 phase는 반드시 Write 또는 Edit을 1회 이상 호출한다. prose만 출력하면 PHASE_FAILED"를 명시한다.

phase 끝에는 `git rev-list HEAD ^<base> --count`로 commit 개수를 확인한다.
0이면 exit 1로 실패 처리한다.
