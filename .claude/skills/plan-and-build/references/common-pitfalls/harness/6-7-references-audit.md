---
id: 6-7
category: harness
triggers:
  - SKILL.md 재작성
  - references audit
  - subprocess
tool_catchable: true
source:
  - plan015
related:
  - 6-6-write-disguised-as-prose.md
---

# 6-7. SKILL.md 재작성 시 references 파일 audit 누락

## 증상

`SKILL.md`를 native 패턴으로 재작성하면서 `references/` 본문은 옛 외부 subprocess 지시문을 그대로 둔다.

예:

- `Output only valid JSON`
- `Do not output markdown`
- `--output-format json`
- `valid JSON that matches the schema`

## 왜

`SKILL.md`가 references를 읽으면 native 패턴과 옛 subprocess 패턴이 충돌한다.
사용자 발견 전까지 critical bug가 push될 수 있다.

## Self-check

`SKILL.md` 재작성 시 references 안 모든 파일 본문을 함께 audit한다.
옛 subprocess 키워드가 남으면 references를 폐기하거나 `SKILL.md`에 흡수한다.
