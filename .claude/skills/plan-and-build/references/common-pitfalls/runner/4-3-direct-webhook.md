---
id: 4-3
category: runner
triggers:
  - Discord
  - webhook
  - curl
  - 알림
tool_catchable: true
source:
  - notification helper policy
related: []
---

# 4-3. webhook 직접 호출

## 증상

phase가 `curl`로 Discord webhook을 직접 호출한다.

## 왜

알림은 helper를 경유해야 비밀, 실패 처리, 채널 분기가 한 곳에서 관리된다.

## Self-check

알림은 workspace 또는 `_shared`의 공식 알림 helper를 경유한다.
직접 webhook 호출이 있으면 제거하거나 명시적으로 정당화한다.
