# 세션 레지스트리 점검 흐름

## 목적

이 문서는 career agent 전환 뒤 메인 세션, subagent, 백그라운드 구현 상태를 확인하는 최소 절차를 고정한다.
목표는 레지스트리가 보이지 않는 상태에서 구현을 밀어붙이지 않고, 메인 세션이 결정과 검토 책임을 유지하는 것이다.

## 책임 분리

메인 세션이 맡는 일:

- 사용자와 목표, 범위, 열린 결정을 확정한다.
- task 파일의 `index.json`, `phase-NN.md`, 성공 기준, 실패 조건을 검토한다.
- phase 실행 결과의 `git diff`, 검증 로그, 민감 정보 경계를 직접 확인한다.
- phase 완료 여부, commit, push, plan 단위 PR 생성 여부를 결정한다.
- HUD 갱신이 필요하면 `session_status` 실측을 먼저 확인하고 `hud-protocol.md` 절차를 따른다.

백그라운드 구현이 맡는 일:

- 승인된 task phase의 구현 또는 긴 문서 materialization만 수행한다.
- 같은 plan 안에서는 `current_phase` 순서를 지키고 phase를 병렬 실행하지 않는다.
- phase 범위 밖 파일, 런타임 세션 레지스트리, 외부 제출 상태를 바꾸지 않는다.
- 완료 뒤 메인 세션이 검토할 수 있도록 변경 파일, 검증 결과, 실패 이유를 남긴다.

task 파일이 맡는 일:

- 결정된 범위를 실행 가능한 phase로 옮긴다.
- phase당 파일 범위, 검증 명령, `PHASE_BLOCKED`, `PHASE_FAILED` 조건을 명시한다.
- 백그라운드 작업자가 즉흥적으로 범위를 넓히지 못하게 성공 기준을 고정한다.

## 레지스트리 표시 상태 점검

agent 전환 뒤에는 새 백그라운드 작업을 시작하기 전에 읽기 전용 점검을 먼저 수행한다.
아래 절차는 세션 레지스트리를 변경하지 않는다.

1. 현재 세션 상태를 확인한다.
   - OpenClaw dynamic tool이 보이면 `session_status`를 `sessionKey="current"`로 호출한다.
   - CLI만 보이면 `openclaw status --json` 또는 `openclaw status --usage --json`을 읽기 전용으로 실행한다.
2. 저장된 대화 세션 목록을 확인한다.
   - CLI 경로는 `openclaw sessions --all-agents --limit 25 --json`이다.
   - career agent id가 필요하면 `openclaw sessions --agent <career-agent-id> --limit 25 --json`으로 좁힌다.
3. 오래 남는 백그라운드 task 목록을 확인한다.
   - CLI 경로는 `openclaw tasks list --json`이다.
   - runtime 구분이 필요하면 `openclaw tasks list --runtime subagent --json`처럼 좁힌다.
4. HUD 갱신이 필요하면 `hud-protocol.md`의 `session_status` 우선 절차를 따른다.
   - raw JSON 전체를 HUD나 Discord에 붙이지 않는다.
   - 오래된 snapshot을 피하려고 `update_event.ts` 단독 실행으로 usage summary를 갱신하지 않는다.
5. 세 점검 결과를 메인 세션 판단에만 사용한다.
   - 새 subagent나 session을 만들지 않는다.
   - registry entry를 삭제, 취소, cleanup하지 않는다.

점검 통과 기준:

- 현재 세션 또는 최근 세션 목록을 읽을 수 있다.
- 실행 중인 백그라운드 task가 있으면 task id, status, label을 짧게 식별할 수 있다.
- 세션 레지스트리가 비어 있거나 오래됐으면 그 사실을 보고하고 새 구현을 시작하지 않는다.

## 레지스트리가 보이지 않을 때

세션 레지스트리 또는 task 레지스트리가 보이지 않으면 아래 순서로 대응한다.

1. 먼저 도구 가용성 문제와 실제 작업 부재를 구분한다.
   - `openclaw sessions --help`, `openclaw tasks --help`, `openclaw status --help`가 동작하는지 확인한다.
   - help도 실패하면 OpenClaw CLI 또는 gateway 상태 문제로 보고한다.
2. CLI는 보이지만 레지스트리가 비어 있으면 active 백그라운드 작업자가 없다고 단정하지 않는다.
   - 최근 plan 파일, worktree branch, pushed commit, systemd unit/log path 같은 남아 있는 근거를 확인한다.
   - 사용자가 승인하지 않은 새 백그라운드 구현을 시작하지 않는다.
3. 레지스트리가 오래된 상태로 보이면 HUD를 최신처럼 갱신하지 않는다.
   - `session_status` 실측 없이 오래된 snapshot을 재게시하지 않는다.
   - `hud-protocol.md`의 보류 보고 기준을 따른다.
4. 작업자 상태가 불명확하면 phase를 보류한다.
   - 보고 문구는 `PHASE_BLOCKED: session registry visibility unavailable`을 사용한다.
   - 보류 중에는 plan055 같은 인접 plan의 구현 phase를 실행하지 않는다.

## Plan055와의 경계

plan055는 이력서 패키지 생성과 리뷰 루프를 구현하는 별도 plan이다.
plan057 phase 3은 plan055의 상태를 읽어 경계를 확인할 뿐, plan055 phase를 실행하지 않는다.

따라서 이 문서의 절차는 다음 상황에만 적용한다.

- career agent 전환 뒤 레지스트리 표시 상태를 점검할 때
- 메인 세션이 백그라운드 구현 결과를 검토할 때
- HUD/status판에 session 상태를 반영하기 전에 오래된 snapshot 위험을 줄일 때

다음 작업은 이 phase 범위 밖이다.

- 새 subagent 생성
- OpenClaw 세션 레지스트리 데이터 수정
- plan055 current phase 실행
- 외부 제출, 공개 발행, private profile 변경

## 메인 세션 검토 체크리스트

백그라운드 구현 완료 뒤 메인 세션은 아래를 확인한다.

- task 파일의 `current_phase`와 실제 완료 phase가 일치하는가?
- 변경 파일이 phase 의도 범위 안에 있는가?
- `git diff`에 session logs, cache, tokens, private secrets가 섞이지 않았는가?
- 검증 명령 결과가 phase 성공 기준을 만족하는가?
- HUD를 갱신했다면 `session_status` 기반 절차를 지켰는가?
- commit/push가 phase 경계와 맞는가?

이 체크를 통과한 뒤에만 다음 phase로 넘어간다.
