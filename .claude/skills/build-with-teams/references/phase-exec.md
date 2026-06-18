# build-with-teams reference: executor 실행 + phase atomic commit

spawn prompt 표준, executor 규칙, shutdown 절차, phase 별 atomic commit 규칙.

## executor 실행 상세

executor 는 `<workspace>-executor` agent definition 이 도메인 규칙의 단일 소스 — SKILL 의 spawn prompt 는 호출 인자 + 직전 phase 학습 인계만 담는다.

### default 흐름 (phase 별 spawn-shutdown 사이클 — 4 phase 이상)

매 phase 마다 새 executor 를 spawn 해서 컨텍스트 격리 + phase model 정책을 적용한다.

1. team-lead 가 `Agent({subagent_type: "<workspace>-executor", team_name: "plan{N}", name: "executor-p{N}", model: "sonnet", run_in_background: true, mode: "bypassPermissions", prompt: <표준 spawn prompt>})` 로 spawn
2. SendMessage 로 작업 지시 (worktree 절대경로 + phase 파일 절대경로 + 직전 phase 학습 인계)
3. executor 작업 + SendMessage 보고
4. team-lead 가 그 phase 의 변경사항만 atomic commit
5. SendMessage shutdown_request → 다음 phase executor spawn

### 소규모 예외 (3 phase 이하)

단일 executor 한 명이 phase 1-3 처리 + phase 별 SendMessage 지시. spawn 오버헤드 회피.

### spawn prompt 표준

```
너는 team plan{N} 의 단일-phase executor — Phase {N} 만 수행 후 종료.

**작업 디렉터리 (worktree 절대경로, 반드시 이 안에서만)**:
/Users/.../.claude/worktrees/{plan이름}/

**브랜치**: <branch-name>

**환경 함정**: `<workspace>-executor` agent definition 의 <Domain_Rules> 참조.

**직전 phase 학습 인계** (1-2줄):
- phase {N-1} 결과: <핵심 발견 / 함정 / 다음 phase 영향>
- 예: "Phase 1 완료. src/core/trackers.py 신설. import 시 from src.core.trackers import ..."

**Phase 파일 (먼저 Read)**:
/Users/.../.claude/worktrees/{plan이름}/tasks/{plan이름}/phase-{NN}.md

**검증**: CLAUDE.md "자주 쓰는 명령" 의 빌드 검증 명령 참조.

완료 후 SendMessage 로 team-lead 에게 결과 보고.
회신은 반드시 SendMessage tool 호출로 — 자기 화면 텍스트 출력만으로 종료 금지.
보고에 **특이사항** 을 함께 적는다 (없으면 "특이사항 없음"): pre-existing 이슈 / 신규 deprecation 경고 / 로컬 미검증 영역 / plan 범위 외 발견. team-lead 가 9단계에서 누적해 사용자에게 보고하므로, 묻어두지 말고 보고에 노출한다.
```

**spawn prompt 작성 가이드**:
- 환경 함정 (워크스페이스 환경 함정) 은 agent definition `<Domain_Rules>` 가 단일 소스 — 반복 금지
- 직전 phase 의 도메인 발견만 1-2줄 (예: "Phase 1 에서 X 가 Y 위치로 이동. import 경로 갱신 완료")
- phase 파일 경로는 반드시 worktree 절대경로

### executor 규칙

- phase-{N}.md 를 순서대로 읽고 실행
- 각 phase 완료 후 성공 기준 검증
- **커밋은 하지 않음** — phase 별 commit 은 team-lead 가 수행 (아래 참조)
- **마지막 phase 에서 `tasks/{NNN}-{task-name}/index.json` 의 다음 필드를 `completed` 로 업데이트**
  - `status` / `current_phase` / 각 phase `status`
  - 별도 phase 아닌 마지막 phase 작업 내 스텝으로 처리
- phase 완료/실패 시 즉시 team-lead 에게 SendMessage 보고 → team-lead 가 그 phase 를 commit 한 후 다음 phase 진행 지시

### executor shutdown (필수 — phase 별 spawn-shutdown 사이클)

team-lead 는 executor 의 phase 완료 보고를 수신하고 atomic commit 을 마친 직후, **즉시 해당 executor 에게 `shutdown_request` 를 전송**한다.
다음 phase executor spawn 은 shutdown 전송 후 진행.

executor 가 idle 상태로 남아 있으면 불필요한 리소스 (컨텍스트 윈도우 + tmux pane) 를 점유한다.
plan017 에서 executor-p1~p5 가 모두 idle 잔존한 사고 관측 — 본 규칙으로 방지.

```
# team-lead 가 phase commit 직후 실행
SendMessage({to: "executor-p{N}", message: {"type": "shutdown_request", "reason": "Phase {N} commit 완료"}})
# shutdown 승인 확인 후 다음 phase executor spawn
```

## phase 별 atomic commit (필수)

executor 가 phase-{N} 완료 보고하면 team-lead 가 즉시 그 phase 의 변경사항만 commit. 다음 phase 시작 전에 commit 이 끝나야 한다.

**commit 메시지 출처**: 각 phase 파일의 `## 커밋` 섹션에 명시된 `git commit -m "..."` 그대로 사용.
team-lead 가 자체 작성 금지 — phase 작성자가 의도한 단일 책임 메시지를 보존한다.

**commit 단위**:

- 각 phase 의 `변경 파일 (정확)` 섹션이 정의한 파일 목록만 staging
- 다른 phase scope 의 파일이 dirty 면 **commit 금지** + executor 에게 scope 위반 보고 요청

**중간 phase commit 패턴**:

```bash
# cwd: /Users/.../.claude/worktrees/{plan}
# branch: feat/{plan}
git add <phase-NN.md 의 변경 파일 정확히>
git commit -m "<phase-NN.md 의 ## 커밋 섹션 메시지>"
```

**마지막 phase commit**: phase 작업 + `index.json` completed 마킹이 같은 commit 에 포함됨 (task 파일 설계 시 마지막 phase 의 작업 항목으로 명시).

**FIX_NEEDED 발생 시**: code-reviewer 의 PASS/FIX_NEEDED 판정은 task 종료 시 1회 (8단계 참조).

- FIX_NEEDED 면 이미 commit 된 phase 들을 amend 하지 않고, 별도 `fix(<scope>): <지적 사항>` commit 추가
- amend 금지 — 이미 push 됐을 수 있고, history 연속성 보존이 디버깅 가치가 더 큼

**push 주기**: 매 phase commit 후 즉시 push 하지 않고 task 종료 시 일괄 push (9단계).
PR 생성 직전이라 commit 누적이 자연스러움.
단 worktree 가 길어지면 (1시간 이상) 중간 push 1회 허용.
