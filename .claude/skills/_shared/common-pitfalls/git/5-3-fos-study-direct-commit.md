---
id: 5-3
category: git
triggers:
  - fos-study
  - 외부 저장소
  - nested repo
tool_catchable: false
source:
  - career-os fos-study policy
related: []
---

# 5-3. sources/fos-study 직접 commit

## 증상

phase가 `sources/fos-study/`에서 임의로 commit한다.

## 왜

`fos-study`는 외부 동기 저장소다.
검증된 publish runner 또는 명시 승인 없이 직접 커밋하면 공개 산출물이 오염될 수 있다.

## Self-check

`sources/fos-study/` 작업이 study-pack 계열의 검증된 runner를 경유하는지 확인한다.
그렇지 않다면 명시 정당화와 사용자 승인을 요구한다.
