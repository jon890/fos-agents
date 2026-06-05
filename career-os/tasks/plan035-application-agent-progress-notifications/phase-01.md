# Phase 01 — progress notification option

## 목표

`application-flow-agent --execute-skills`가 실제 Claude native skill을 실행하는 동안 사용자가 현재 단계를 인지할 수 있게 Discord 진행 알림을 보낸다.

## 구현

- `scripts/application-agent/progress_notifier.ts`
  - `_shared/lib/notify_discord.ts`를 subprocess로 호출한다.
  - notify 실패는 warning만 남기고 agent 실행을 막지 않는다.
  - 메시지는 private-safe progress only 형식으로 제한한다.
- `scripts/application-agent/run.ts`
  - `--notify-discord` 옵션을 추가했다.
  - decision 시작, ledger 갱신, execution gate 대기 알림을 연결했다.
- `scripts/application-agent/skill_executor.ts`
  - skill 시작, 완료, 실패, 산출물 누락 알림 callback을 추가했다.

## 알림 범위

알림은 다음 정보만 포함한다.

- 대상 회사/역할
- 상태 전이
- policy decision
- skill 이름
- 완료/실패/대기 여부

다음 내용은 Discord 알림에 포함하지 않는다.

- 지원 패키지 본문
- 이력서 bullet 세부 내용
- private strategy note
- review.md의 상세 지적 본문

## 사용법

```bash
bun scripts/application-agent/run.ts run-once --execute-skills --notify-discord --ledger data/applications/ledger.jsonl
```

## 검증

```bash
bun scripts/application-agent/run.ts dry-run --execute-skills --notify-discord --ledger data/applications/ledger.jsonl
bun scripts/application-agent/run.ts --help
bun scripts/application-agent/run.ts validate --ledger data/applications/ledger.jsonl
bun scripts/application-agent/run.ts report-daily --notify-discord --ledger data/applications/ledger.jsonl --output-dir /tmp/application-agent-notify-smoke
git diff --check -- scripts/application-agent/run.ts scripts/application-agent/skill_executor.ts scripts/application-agent/progress_notifier.ts docs/code-architecture.md docs/flow.md docs/adr.md tasks/plan035-application-agent-progress-notifications
```

결과:

- dry-run에서는 Discord 전송 없이 decision log만 출력한다.
- help에 `--notify-discord` 옵션이 표시된다.
- ledger validate 통과.
- 기존 report-daily digest 출력 흐름에 영향 없음.
- whitespace check 통과.
