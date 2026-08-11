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

저장소 실행 코드는 외부 메시지를 직접 전송하지 않는다.
로컬 파일과 표준 출력을 계약으로 두고, 외부 전달은 저장소 밖에서 처리한다.
