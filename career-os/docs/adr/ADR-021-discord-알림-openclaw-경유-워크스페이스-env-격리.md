## ADR-021 — Discord 알림 openclaw 경유 + 워크스페이스 `.env` 격리

- Status: Lifted to ai-nodes ADR-004 (2026-05-18) — .env 워크스페이스 root 격리 부분. Discord 알림 openclaw 부분은 career-os 한정 유지.
- Date: 2026-05-14

### 맥락
plan004 phase-03이 옛 notify_discord.sh의 실제 동작(openclaw CLI)을 참조하지 않고 webhook fetch로 재구현 → Discord 메시지 미도달. 채널 ID가 코드에 hardcoded되어 git history 노출. 워크스페이스별 secret 위치도 명확화 필요.

### 결정
- notify_discord.ts를 `openclaw message send --channel discord` subprocess 방식으로 재구현. --media 옵션으로 notify_discord_media.sh 동작 흡수.
- 채널 ID는 DISCORD_CHANNEL_ID env에서만 읽음. 누락 시 exit 1(옛 silent fallback 폐기).
- secret 위치를 <ws>/.env(워크스페이스 root)로 통일. <ws>/config/.env 폐기.
- caller는 bun --env-file=<ws>/.env 패턴으로 명시적 전달. 라이브러리는 .env 위치 추정 안 함.
- run-phases.py가 notify_discord.ts를 직접 호출(find_notify_script 폐기).

거절 대안: webhook URL 방식(인증·인프라 불일치), hardcoded ID 유지(마이그레이션 불가), git history rewrite(destructive).

### 결과
- Discord 알림이 openclaw 인증 기반으로 정상 동작.
- 설정 누락이 silent이 아닌 즉시 fail로 드러남. secret이 워크스페이스 root에 집중.
- career-os 범위. apartment 마이그레이션은 별도 plan(워크스페이스 격리).

### 적용
- _shared/lib/notify_discord.ts (재구현 본체).
- 각 워크스페이스 .env + .env.example.
