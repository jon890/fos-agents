# HUD 상태 갱신 절차

## 목적

이 문서는 career OpenClaw 세션의 HUD 상태 요약을 갱신할 때 따르는 절차를 고정한다.
목표는 오래된 snapshot 재사용을 막고, `session_status` 실측값을 먼저 확인한 뒤 상태판에 반영하는 것이다.

## 현재 확인한 경로

- career workspace wrapper: `skills/refresh-hud/SKILL.md`
  - `session_status`를 먼저 호출한 뒤 task-hud updater로 반영하라고 안내한다.
- session_status 기반 updater: `openclaw-orchestrator/scripts/task-hud/update_from_session_status.ts`
  - `--session-status-json`을 받아 안전한 usage summary만 `_shared/lib/task_hud.ts`에 넘긴다.
- legacy event updater: `scripts/task-hud/update_event.ts`
  - event와 status만 넘기는 얇은 wrapper다.
  - `session_status` 입력을 받지 않으므로 단독 실행 시 usage 실측을 새로 만들지 못한다.
- task-hud helper: `_shared/lib/task_hud.ts`
  - 상태판 파일을 읽고 update/status/warn을 처리한다.
  - 새 usage가 비어 있으면 기존 `lastUsageSnapshot`과 합칠 수 있다.
- legacy HUD state: `.openclaw/workspace/openclaw-orchestrator/state/task-hud`
  - 이번 phase에서는 존재 여부만 확인했다.
  - 파일 내용은 열지 않았고 삭제, archive, migration은 실행하지 않았다.

## 표준 순서

HUD 상태 요약을 갱신할 때는 아래 순서를 따른다.

1. `session_status`를 `sessionKey="current"`로 호출한다.
2. 필요하면 최근 subagent 상태를 별도로 확인한다.
3. `session_status` 결과에서 usage, context, compaction count를 확인한다.
4. raw JSON 전체를 HUD 본문에 직접 쓰지 않는다.
5. `update_from_session_status.ts`를 `--session-status-json`과 함께 실행한다.
6. 즉시 게시가 부담되면 먼저 `--dry-run`으로 렌더링만 확인한다.
7. dry-run 결과가 안전하면 같은 입력으로 실제 update를 실행한다.

예시:

```bash
bun openclaw-orchestrator/scripts/task-hud/update_from_session_status.ts \
  --session discord-career-main \
  --task-label "<현재 작업 요약>" \
  --status "<짧은 상태>" \
  --target channel:1492521172099666021 \
  --session-status-json '<session_status JSON>' \
  --subagents-json '<sanitized subagents JSON>'
```

상태 문구는 짧게 쓴다.
예: `planning`, `reviewing`, `background workers running`, `idle`, `blocked: <짧은 이유>`.

## stale snapshot 실패 모드

`session_status` 없이 `update_event.ts`만 실행하면 stale snapshot이 생길 수 있다.

- `update_event.ts`는 task label과 event 상태만 갱신한다.
- usage 실측을 새로 수집하지 않는다.
- `_shared/lib/task_hud.ts`는 새 usage가 없을 때 기존 `lastUsageSnapshot`을 유지할 수 있다.
- 결과적으로 HUD의 `Updated` 시간은 새로 보이지만 usage 값은 오래된 snapshot일 수 있다.
- 이 상태를 사람이 최신 usage로 오해하면 남은 5h/weekly 사용량, context, compaction 판단이 틀어진다.

따라서 `update_event.ts` 단독 실행은 phase/event 기록용 legacy 경로로만 본다.
HUD 상태 요약 갱신에는 `session_status` 실측을 먼저 확인하는 task-hud updater 경로를 사용한다.

## 안전한 표시 기준

HUD에 표시할 수 있는 값은 안전한 요약으로 제한한다.

- task label
- 짧은 상태 문구
- 5h/weekly usage remaining
- context percent
- compaction count
- active subagent id, label, status의 짧은 요약

HUD에 넣지 않는 값:

- raw `session_status` 전체 본문
- 세션 로그, token, cache, secret
- private 지원서, 이력서, 면접 메모 본문
- 사용자의 로컬 절대 경로
- 판단에 필요 없는 Discord 대화 원문

## legacy task-hud 처리 기준

legacy `task-hud` 상태는 조용히 삭제하지 않는다.
archive 또는 migration 판단을 먼저 남긴다.

archive 후보:

- 과거 HUD message id나 thread id가 디버깅에 필요하다.
- 최근 운영 전환의 증거로 일정 기간 보존할 가치가 있다.
- 제거 전에 privacy review가 필요하다.

migration 후보:

- 현재 canonical state root로 옮겨야 할 HUD message identity가 있다.
- active Discord HUD를 이어서 edit하려면 기존 id가 필요하다.
- 새 updater가 legacy state를 읽어야 하는 명확한 이유가 있다.

즉시 정리 후보:

- private secret을 포함하지 않는 단순 runtime artifact다.
- 더 이상 active HUD와 연결되지 않는다.
- archive/migration decision이 기록된 뒤에도 보존 가치가 없다.

금지:

- state 파일 내용을 검토하지 않고 삭제하지 않는다.
- archive/migration decision 없이 runtime state를 옮기지 않는다.
- phase-02에서 OpenClaw runtime state를 수정하지 않는다.

## 작업자 체크리스트

HUD 상태를 갱신하기 전에 아래를 확인한다.

- `session_status` 실측을 먼저 확인했는가?
- stale snapshot 또는 오래된 snapshot을 재사용하지 않는가?
- `update_event.ts` 단독 실행이 아니라 task-hud updater에 실측 JSON을 넘겼는가?
- dry-run 결과에 private 내용이나 로컬 절대 경로가 없는가?
- legacy `task-hud` archive/migration 판단이 필요한 작업을 이번 phase에서 실행하지 않았는가?

이 체크를 통과하지 못하면 HUD 갱신을 멈추고 실패 이유를 짧게 보고한다.
