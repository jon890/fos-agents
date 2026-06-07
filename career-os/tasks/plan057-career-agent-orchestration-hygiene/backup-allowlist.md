# 백업 허용 목록

## 목적

이 문서는 career OpenClaw workspace 파일을 백업할 때의 허용 목록 후보와 제외 대상을 정리한다.
목표는 career wrapper와 운영 문서의 연속성을 보존하되, session logs, cache, tokens, private secrets를 백업 대상에서 제외하는 것이다.

이 phase에서는 백업을 실행하지 않는다.
private repo 생성도 하지 않는다.

## 기본 원칙

백업은 허용 목록 방식으로만 검토한다.
즉, "전체 workspace 복사 후 제외"가 아니라 "보존할 파일만 명시해 복사"한다.

백업 후보는 다음 기준을 통과해야 한다.

- 다음 세션에서도 재사용해야 하는 운영 지침인가?
- career-os wrapper 소유권, HUD/status판 운영, 레지스트리 점검 절차처럼 반복 적용되는 규칙인가?
- 공개 또는 준공개 채널에 노출돼도 안전한 수준으로 작성됐는가?
- secret, token, cache, session log, transcript, raw message를 포함하지 않는가?

## 허용 목록 후보

career OpenClaw workspace 쪽 후보:

- `AGENTS.md`
  - agent routing, memory, Discord 참여, heartbeat, 안전 경계 같은 운영 규칙.
- `TOOLS.md`
  - career-os 진입점, 채널 라우팅, 로컬 도구 메모.
- `skills/*/SKILL.md`
  - career-os로 라우팅하는 얇은 wrapper skill 문서.
  - 단, private prompt 본문이나 token이 섞이지 않았는지 별도 검토한다.
- `skills/*/references/`
  - wrapper가 공개 가능한 절차 문서만 참조할 때만 포함한다.
  - 개인 이력, 지원서, 세션 로그가 섞이면 제외한다.
- `HEARTBEAT.md`
  - 짧은 운영 체크리스트만 포함할 때 후보로 둔다.
  - 개인 알림 원문이나 민감한 일정 세부 내용이 들어가면 제외한다.

career-os repo 쪽 후보:

- `career-os/tasks/plan057-career-agent-orchestration-hygiene/ownership-inventory.md`
  - wrapper 소유권 경계와 migration 후보.
- `career-os/tasks/plan057-career-agent-orchestration-hygiene/hud-protocol.md`
  - `session_status` 우선 HUD/status판 갱신 절차와 오래된 snapshot 실패 모드.
- `career-os/tasks/plan057-career-agent-orchestration-hygiene/session-registry-flow.md`
  - agent 전환 뒤 세션 레지스트리 점검, 메인 세션, 백그라운드 구현 책임 분리.
- `career-os/tasks/plan057-career-agent-orchestration-hygiene/backup-allowlist.md`
  - 이 허용 목록 기준 자체.

## 제외 대상

아래 항목은 기본 제외다.
명시적 사용자 승인과 별도 privacy review 없이는 백업하지 않는다.

- session logs
- transcripts
- cache
- tokens
- private secrets
- `.env`와 SecretRef 원본
- auth cookies, OAuth token, API key, webhook URL
- OpenClaw runtime state
- raw Discord 또는 DM message body
- private resume, cover letter, application package, interview note
- candidate-profile 원문이나 개인 이력 상세
- generated media, temp download, browser capture
- `node_modules`, build output, lock, pid, socket 같은 재생성 가능 파일

특히 `session_status` 원본 JSON은 백업하지 않는다.
HUD/status판에는 안전한 요약만 쓰고, 백업 대상에도 raw session payload를 넣지 않는다.

## Private repo 방식

장점:

- 여러 장비에서 career wrapper 운영 규칙을 복원하기 쉽다.
- commit history로 소유권, HUD 절차, 세션 레지스트리 흐름 변경을 추적할 수 있다.
- 허용 목록이 잘 고정되면 agent workspace 재설정 시간이 줄어든다.

주의점:

- private repo라도 secret 저장소로 취급하지 않는다.
- repo 접근 권한, remote URL, deploy key 관리가 추가된다.
- 실수로 session logs, cache, tokens, private secrets를 추가하지 않도록 pre-commit 또는 CI grep이 필요하다.
- 그룹 채널에서 repo URL이나 private path를 공유할 때 노출 범위를 확인해야 한다.

권장 기본값:

- private repo를 만들려면 먼저 허용 목록 manifest를 고정한다.
- 첫 push 전 `git diff --cached`와 secret grep을 main session이 직접 검토한다.
- session logs, cache, tokens, private secrets 제외가 자동 검증되지 않으면 push하지 않는다.

## Local archive 방식

장점:

- remote 접근 권한과 key 관리 없이 빠르게 보존할 수 있다.
- 실험적 wrapper나 임시 운영 노트를 외부 remote로 보내지 않아도 된다.
- archive를 암호화 저장소나 로컬 backup policy 안에 둘 수 있다.

주의점:

- 여러 장비에서 복원이 어렵고, archive 위치를 잊기 쉽다.
- 오래된 archive가 현재 운영 규칙과 어긋날 수 있다.
- 허용 목록 없이 통째로 압축하면 session logs, cache, tokens, private secrets가 섞일 위험이 커진다.

권장 기본값:

- local archive도 허용 목록 manifest를 사용한다.
- archive 이름에는 날짜와 목적만 넣고 private 개인 정보는 넣지 않는다.
- archive를 만들기 전 제외 대상 grep과 파일 목록 review를 한다.

## 검증 체크리스트

백업을 실제로 실행하기 전 main session이 확인할 항목:

- 허용 목록 파일 목록이 명시돼 있는가?
- 제외 대상에 session logs, cache, tokens, private secrets가 포함돼 있는가?
- raw `session_status`, transcript, Discord 원문이 섞이지 않았는가?
- 오래된 snapshot cleanup이나 HUD/status판 운영 문서가 안전한 요약 기준을 지키는가?
- private repo 생성 또는 외부 push가 사용자 승인 범위 안인가?
- archive/migration decision 없이 legacy runtime state를 옮기지 않았는가?

체크를 통과하지 못하면 백업을 멈추고 `PHASE_BLOCKED: backup allowlist needs privacy review`로 보고한다.
