---
id: 6-8
category: harness
triggers:
  - sigil
  - section mark
  - tilde
  - self-positive
tool_catchable: false
source:
  - plan024
  - plan002 first-run hotfix
related: []
---

# 6-8. sigil 자체 인용 self-positive

## 증상

phase 본문 강제 주의문에 section mark나 tilde 같은 sigil 문자를 literal로 인용한다.
검증 bash가 target에 phase 파일을 포함하면 phase 본문 자체 때문에 검증이 실패한다.

## 왜

"sigil 미사용 강제"를 쓰다가 금지 문자를 직접 넣기 쉽다.
의도는 검증 강조지만 결과는 self-positive와 directive 위반이다.

## Self-check

phase 본문에서는 sigil을 literal로 쓰지 말고 Unicode 이름으로 표기한다.

예:

- `section mark (U+00A7)`
- `tilde (U+007E)`

검증 bash는 escape 변수를 사용한다.

```bash
SIGIL_CHAR=$(printf '\xc2\xa7')
grep -c "$SIGIL_CHAR" target
```
