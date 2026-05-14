---
name: command-router
description: career-os의 14개 dispatch 명령 단일 진입점. 모든 runner를 track_task.sh로 래핑하고 Discord 알림 + cost summary를 자동 부착한다. 직접 호출하지 말 것 — 일상 운영은 run_now.sh <command> 경유.
---

# command-router

career-os 워크스페이스의 단일 dispatch 진입점.

## 호출 방법

```bash
career-os/scripts/command-router/run_now.sh <command> [args...]
```

14개 명령: `baseline` · `daily [topic]` · `study-pack <topic>` · `question-bank <topic>` · `master [topic]` · `recommend-topics` · `recommend-positions` · `replenish-topics` · `maintain-study-pack <topic>` · `foodville-coffeechat` · `smoke` · `bootcamp-batch` · `live-coding-dispatch` · `auto-question-bank`.

실행 파일: `career-os/scripts/command-router/`(ADR-019).

## 입력

- 각 명령별 runner가 자체 config를 참조 (`config/topics.json` 등)
- `config/.env` — `DISCORD_CHANNEL_ID` 등 필수 환경 변수

## 산출물

- `logs/task-runs.jsonl` + `logs/token-usage.jsonl` — 실행별 메트릭 (모든 명령 공통)
- Discord 완료·실패 알림 (cost summary 포함)
- 각 명령 개별 산출물은 해당 skill SKILL.md 참조

## 관련 ADR

- ADR-008: Discord 알림 설계
- ADR-014: usage 전파 및 비용 측정
- ADR-017: command-router skill 분리 (본 폴더 신설 근거)
- ADR-019: scripts/<skill>/ 분리 컨벤션
