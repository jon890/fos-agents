---
id: 4-2
category: runner
triggers:
  - usage
  - cost
  - claude output
  - claude_persist_usage
tool_catchable: false
source:
  - historical runner telemetry policy
related: []
---

# 4-2. usage 저장 누락

## 증상

새 runner가 Claude JSON 출력이나 비용 정보를 다루지만 usage 저장 경로를 빠뜨린다.

## 왜

운영 로그에서 비용과 model 정보가 비어 후속 분석이 불가능해진다.
native skill 전환 이후에는 해당 workspace가 아직 usage 저장을 쓰는지 먼저 확인해야 한다.

## Self-check

현재 workspace 실행 패턴에서 usage 저장이 살아있는지 확인한다.
살아있다면 runner의 공식 helper 호출 위치를 검증한다.
폐기된 패턴이면 옛 helper를 되살리지 않는다.
