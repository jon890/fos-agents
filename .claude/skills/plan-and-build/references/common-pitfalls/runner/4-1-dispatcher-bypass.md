---
id: 4-1
category: runner
triggers:
  - runner 직접 호출
  - dispatcher 우회
  - run_now
tool_catchable: false
source:
  - historical dispatcher runner policy
related: []
---

# 4-1. dispatcher 우회 직접 호출

## 증상

phase가 `<workspace>/skills/*/scripts/run_*.sh`를 직접 호출한다.

## 왜

dispatcher를 우회하면 task tracking, 알림, 잠금 같은 공통 경로가 빠질 수 있다.
native skill 전환 이후에는 workspace별 현재 실행 패턴도 함께 확인해야 한다.

## Self-check

실행 명령이 해당 workspace의 공식 entrypoint를 경유하는지 확인한다.
직접 호출이 필요하면 정당화 한 줄을 남긴다.
