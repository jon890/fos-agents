---
id: 4-2
category: execution
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

# 4-2. webhook 직접 호출

## 증상

phase가 `curl`로 Discord webhook을 직접 호출한다.

## 왜

알림 format, 실패 처리, 비밀 값 로딩이 호출자마다 갈라진다.

## Self-check

알림은 `_shared/lib/notify_discord.ts` 또는 워크스페이스에서 승인된 helper를 경유한다.
