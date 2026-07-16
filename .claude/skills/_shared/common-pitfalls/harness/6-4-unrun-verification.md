---
id: 6-4
category: harness
triggers:
  - 검증 미실행
  - success 추정
  - stdout
tool_catchable: false
source:
  - plan002-config-consolidation
related: []
---

# 6-4. 검증 명령 미실행 success 보고

## 증상

phase 본문에 검증 명령을 적었지만 실행 agent가 명령을 실행하지 않고 성공 보고만 한다.

## 왜

phase agent는 종료 직전 success 메시지로 마무리하는 경향이 있다.
timeout이 임박했거나 모델이 가벼울수록 더 잘 발생한다.

## Self-check

검증 명령 직전 "보고 직전 반드시 이 bash 블록 실행"을 명시한다.
검증 결과는 stdout raw value로 출력한 뒤 비교한다.

예:

- `echo "[count] $count"`
- 비교 실패 시 `exit 1`
