# build-with-teams reference: 팀원 스폰 규칙

팀원 스폰 · SendMessage 강제 · 스폰 직후 검증 · self-shutdown 대응 · worktree 절대경로 전달 규칙.

## 정식 팀원 스폰 규칙 (필수)

critic / executor / code-reviewer / docs-verifier는 반드시 **TeamCreate로 생성한 팀의 정식 멤버**로 스폰. 일회성 `Agent` 호출(team_name 없이) 금지.

**왜?**

- 일회성 Agent 호출은 팀 컨텍스트 밖에서 동작 — `SendMessage`로 반복 협업 불가
- 정식 팀원은 idle 상태로 대기하며 REVISE 재평가, executor 재실행, docs-verifier 재검증 등 반복 사이클이 자연스러움

**스폰 패턴:**

```
Agent({
  subagent_type: "oh-my-claudecode:critic",
  team_name: "plan{N}",
  name: "critic",
  model: "opus",
  run_in_background: true,
  prompt: "..."
})
```

- `team_name` + `name`을 반드시 지정 (`name`은 `critic`/`executor`/`code-reviewer`/`docs-verifier`로 통일)
- `run_in_background: true`로 idle 대기 가능
- 이후 통신은 **모두 `SendMessage({to: "critic", message: "..."})`로만** 진행

**SendMessage 회신 강제 (필수 — 텍스트 출력 누락 사고 방지)**:

스폰된 sub-agent 가 평가 / 검사 결론을 자기 화면에 텍스트로만 출력하고 종료하는 사고가 관측됨.
결과적으로 main session 까지 라우팅 안 됨 — idle 알림만 도착하고 team-lead 는 평가 결과 미수신 상태에서 다음 단계 진행 불가.

**스폰 프롬프트 + 작업 지시 메시지 양쪽**에 다음 문구를 **반드시 포함**:

```
회신은 반드시 SendMessage tool 호출로 team-lead 에게 전송할 것.
자기 화면에 텍스트만 출력하고 종료하면 main session 까지 라우팅 안 됨.
판정/결론 + 핵심 사유 1-2 문단을 SendMessage 의 message 필드로 보낼 것.
```

team-lead 는 sub-agent 의 idle 알림만 **2회 이상 연속 수신** 하고 평가 결과 메시지가 없으면 통신 누락 의심 — 즉시 SendMessage 로 재요청 + "SendMessage 로 회신 부탁" 명시.

**스폰 직후 검증 (필수, 매 Agent 호출마다)**:

`name` 파라미터를 빠뜨려도 Agent 호출은 silent 하게 성공한다 — 응답 메시지가 정식 멤버 케이스와 거의 동일해 시각 구분 불가.
정식 멤버 등록 여부는 반드시 `team config.json` 으로 직접 확인한다.

응답 형식 차이로도 1차 식별 가능:

- ✅ 정식 멤버: `agent_id: critic@plan{N}` + `name: critic` + `team_name: plan{N}` 노출
- ❌ 일회성 백그라운드: `agentId: <16자 UUID>` 만 노출 (이름·팀 정보 없음)

후자가 보이면 **즉시 재스폰**. 전자라도 다음 게이트 스크립트로 한 번 더 확인한다 (inline python 을 스크립트로 분리 — escape 실수·우회 방지):

```bash
# cwd: <repo root>. 직전 스폰한 멤버 이름들을 인자로
bash .claude/skills/build-with-teams/scripts/verify_team_members.sh plan{N} <스폰한멤버이름...>
```

스크립트는 `~/.claude/teams/plan{N}/config.json` 의 `members[].name` 을 읽어 기대 멤버 등록 여부를 확인한다.
`TEAM_CONFIG_MISSING` (팀 자체 부재 — Agent 단발 호출로 우회됐을 가능성) 또는 `MEMBER_MISSING` (일부 미등록) 으로 exit 1 하면 다음 단계 진입 금지.
team-lead 외 멤버가 0명이면 직전 Agent 호출에서 `name` 누락 — `agentId: <UUID>` 백그라운드 agent 는 결과 와도 무시하고 **새로 정식 멤버로 스폰**.

**팀원 self-shutdown 패턴 대응 (관측)**:

`oh-my-claudecode:code-reviewer` / `docu-parser-docs-verifier` 같은 검증 에이전트는 `run_in_background: true` + idle prompt 로 스폰해도 **idle 알림 직후 자체 shutdown 하는 경향** 이 있다.
critic 은 응답 후 idle 유지에 성공하지만 검증 에이전트는 일관되지 않음.

**우회**:

- 검사 대상 결과물이 준비된 시점에 **즉시 새로 spawn** (idle 대기 의존 금지)
- team-lead 가 code-reviewer / docs-verifier 의 종료 알림 수신 시 침묵 말고 **새로 스폰 + 즉시 검사 지시 메시지** 묶음으로 처리

**적용 시점**:

- code-reviewer: executor 완료 직후 (executor 와 동시 스폰 X — executor 완료 후 새로 스폰이 안전)
- docs-verifier: 8단계 검증 직전 새로 스폰

**팀원 프롬프트/메시지는 worktree 절대경로로 전달한다 (필수).**

sub-agent는 main 워킹 디렉터리에서 실행될 수 있다.
상대경로나 `tasks/{plan}/...` 형태로 지시하면 worktree 브랜치에 커밋된 최신 파일이 아니라 main 의 구버전 또는 미존재 파일을 읽어 오판 사고가 발생한다.

- 파일 참조는 반드시 `/Users/.../.claude/worktrees/{plan이름}/tasks/{plan}/phase-XX.md` 형식의 절대경로
- 팀원이 구버전을 본다고 의심되면 `grep`한 실제 파일 내용을 메시지에 붙여 넣고 절대경로 재확인 요청
