# Session Registry Flow

## 목적

이 문서는 career agent 전환 뒤 main session, subagent, background implementation 상태를 확인하는 최소 절차를 고정한다.
목표는 registry가 보이지 않는 상태에서 구현을 밀어붙이지 않고, main session이 결정과 검토 책임을 유지하는 것이다.

## 책임 분리

Main session이 맡는 일:

- 사용자와 목표, 범위, 열린 결정을 확정한다.
- task files의 `index.json`, `phase-NN.md`, 성공 기준, 실패 조건을 검토한다.
- phase 실행 결과의 `git diff`, 검증 로그, 민감 정보 경계를 직접 확인한다.
- phase 완료 여부, commit, push, plan-level PR 생성 여부를 결정한다.
- HUD 갱신이 필요하면 `session_status` 실측을 먼저 확인하고 `hud-protocol.md` 절차를 따른다.

Background implementation이 맡는 일:

- 승인된 task phase의 구현 또는 긴 문서 materialization만 수행한다.
- 같은 plan 안에서는 `current_phase` 순서를 지키고 phase를 병렬 실행하지 않는다.
- phase 범위 밖 파일, runtime session registry, 외부 제출 상태를 바꾸지 않는다.
- 완료 뒤 main session이 검토할 수 있도록 변경 파일, 검증 결과, 실패 이유를 남긴다.

Task files가 맡는 일:

- 결정된 범위를 실행 가능한 phase로 옮긴다.
- phase당 파일 범위, 검증 명령, `PHASE_BLOCKED`, `PHASE_FAILED` 조건을 명시한다.
- background worker가 즉흥적으로 범위를 넓히지 못하게 성공 기준을 고정한다.

## Registry Visibility Smoke

agent switch 뒤에는 새 background 작업을 시작하기 전에 읽기 전용 smoke를 먼저 수행한다.
아래 절차는 session registry를 변경하지 않는다.

1. 현재 세션 상태를 확인한다.
   - OpenClaw dynamic tool이 보이면 `session_status`를 `sessionKey="current"`로 호출한다.
   - CLI만 보이면 `openclaw status --json` 또는 `openclaw status --usage --json`을 읽기 전용으로 실행한다.
2. 저장된 conversation session 목록을 확인한다.
   - CLI 경로는 `openclaw sessions --all-agents --limit 25 --json`이다.
   - career agent id가 필요하면 `openclaw sessions --agent <career-agent-id> --limit 25 --json`으로 좁힌다.
3. durable background task 목록을 확인한다.
   - CLI 경로는 `openclaw tasks list --json`이다.
   - runtime 구분이 필요하면 `openclaw tasks list --runtime subagent --json`처럼 좁힌다.
4. HUD 갱신이 필요하면 `hud-protocol.md`의 `session_status` 우선 절차를 따른다.
   - raw JSON 전체를 HUD나 Discord에 붙이지 않는다.
   - stale snapshot을 피하려고 `update_event.ts` 단독 실행으로 usage summary를 갱신하지 않는다.
5. 세 smoke 결과를 main session 판단에만 사용한다.
   - 새 subagent나 session을 만들지 않는다.
   - registry entry를 삭제, cancel, cleanup하지 않는다.

Smoke 통과 기준:

- current session 또는 최근 session 목록을 읽을 수 있다.
- running background task가 있으면 task id, status, label을 짧게 식별할 수 있다.
- session registry가 비어 있거나 stale이면 그 사실을 보고하고 새 구현을 시작하지 않는다.

## Registry가 보이지 않을 때

session registry 또는 task registry가 보이지 않으면 아래 순서로 fallback한다.

1. 먼저 도구 가용성 문제와 실제 작업 부재를 구분한다.
   - `openclaw sessions --help`, `openclaw tasks --help`, `openclaw status --help`가 동작하는지 확인한다.
   - help도 실패하면 OpenClaw CLI 또는 gateway 상태 문제로 보고한다.
2. CLI는 보이지만 registry가 비어 있으면 active background worker가 없다고 단정하지 않는다.
   - 최근 plan 파일, worktree branch, pushed commit, systemd unit/log path 같은 durable evidence를 확인한다.
   - 사용자가 승인하지 않은 새 background implementation을 시작하지 않는다.
3. registry가 stale로 보이면 HUD를 최신처럼 갱신하지 않는다.
   - `session_status` 실측 없이 stale snapshot을 재게시하지 않는다.
   - `hud-protocol.md`의 blocked 보고 기준을 따른다.
4. 작업자 상태가 불명확하면 phase를 보류한다.
   - 보고 문구는 `PHASE_BLOCKED: session registry visibility unavailable`을 사용한다.
   - 보류 중에는 plan055 같은 인접 plan의 구현 phase를 실행하지 않는다.

## Plan055와의 경계

plan055는 이력서 패키지 생성과 리뷰 루프를 구현하는 별도 plan이다.
plan057 phase 3은 plan055의 상태를 읽어 경계를 확인할 뿐, plan055 phase를 실행하지 않는다.

따라서 이 문서의 절차는 다음 상황에만 적용한다.

- career agent 전환 뒤 registry visibility를 점검할 때
- main session이 background implementation 결과를 review할 때
- HUD/status판에 session 상태를 반영하기 전에 stale snapshot 위험을 줄일 때

다음 작업은 이 phase 범위 밖이다.

- 새 subagent 생성
- OpenClaw session registry 데이터 수정
- plan055 current phase 실행
- 외부 제출, 공개 발행, private profile 변경

## Main Session Review Checklist

background implementation 완료 뒤 main session은 아래를 확인한다.

- task files의 `current_phase`와 실제 완료 phase가 일치하는가?
- 변경 파일이 phase intended scope 안에 있는가?
- `git diff`에 session logs, cache, tokens, private secrets가 섞이지 않았는가?
- 검증 명령 결과가 phase 성공 기준을 만족하는가?
- HUD를 갱신했다면 `session_status` 기반 절차를 지켰는가?
- commit/push가 phase 경계와 맞는가?

이 체크를 통과한 뒤에만 다음 phase로 넘어간다.
