---
name: plan-and-build
description: ai-nodes 워크스페이스 단위의 대규모 구현을 phase로 나눠 자동 실행하는 skill. `/plan-and-build`, "task 실행", "phase 실행", "run-phases 실행", "구현 자동화", "백그라운드로 실행", "multi-phase 작업", "계획된 task 실행"처럼 planning 이후 task 파일을 생성·커밋하고 run-phases.py로 백그라운드 실행, 검증, plan 완료 후 단일 PR 생성까지 필요할 때 사용. phase별 commit/push는 허용하지만 PR/merge는 plan 전체 완료 후 진행한다.
---

# plan-and-build

ai-nodes 워크스페이스의 새 기능이나 대규모 변경을 phase 단위로 분리하고, `run-phases.py` 하네스를 통해 Claude Code가 자동으로 순차 실행하는 시스템.

## 호출 후 범위 해석

- planning으로 task 파일 생성이 완료된 작업을 실행한다.
- 특정 phase부터 재개해야 하면 `--from-phase N`을 사용한다.
- plan 전체 완료 전에는 plan 단위 PR을 만들지 않는다.

## 핵심 원칙 — 사용자에게 묻지 말고 자동으로 따를 것

**모든 작업은 반드시 이 순서를 자동으로 따른다. 사용자가 매번 지시하지 않아도 된다:**

1. 논의가 필요하면 먼저 논의
2. **docs 반영 + 커밋** (task 생성 전 필수, 건너뛰기 금지)
3. **task 파일 생성 + 커밋** (실행 전 필수)
4. task 실행 (백그라운드)
5. 완료 후 검증
6. plan 전체 완료 후 단일 PR 생성

이 순서를 어기면 안 된다.

### docs 피드백 루프 원칙
ai-nodes의 docs는 단순 참조 문서가 아니라 **의사결정·기술 학습이 누적되는 피드백 루프**다. 매 사이클마다:

- 새 결정 기록 방식은 워크스페이스에 따라 다르다:
  - **ai-nodes 루트**: `docs/adr/ADR-NNN-slug.md` 새 파일 생성 + `docs/adr/INDEX.md` 행 추가.
  - **career-os**: `docs/adr/ADR-NNN-slug.md` 새 파일 생성 + `docs/adr/INDEX.md` 행 추가 (ai-nodes ADR-015 파일럿).
  - **그 외 워크스페이스**: `<workspace>/docs/adr.md` 맨 아래 *append* (개별 ADR 파일 신설 금지).
- 명세 변경은 `prd.md` / `data-schema.md` / `flow.md` / `code-architecture.md` 중 영향 받는 문서에 즉시 반영.
- 학습·회고가 행동 규칙으로 굳어지면 ADR, skill, AGENTS 중 책임 문서에 직접 흡수한다.
  일회성 실행 회고는 task phase 산출물에만 남긴다.
- 인수인계 메모는 `<workspace>/docs/hand-off/`.

### 데이터 위치 원칙
데이터 파일은 **반드시** 워크스페이스의 `data/` 디렉터리 안에. 자세히는 `<workspace>/docs/data-schema.md` 참조. docs/ 안에 데이터를 두지 않는다.

## 실행 절차

### 1. 문서 파악

`<workspace>/docs/` 하위 5문서를 읽어 워크스페이스 기획·아키텍처·결정 의도를 파악한다. 필요 시 여러 Explore 에이전트를 병렬로 사용한다.

참조 문서:

- `<workspace>/docs/prd.md` — 제품 범위, MVP 기능 명세
- `<workspace>/docs/data-schema.md` — 데이터 스키마 (config / logs / runtime / data)
- `<workspace>/docs/flow.md` — 사용자·데이터 플로우
- `<workspace>/docs/code-architecture.md` — 디렉터리 구조, 계층, 외부 의존성
- `<workspace>/docs/adr.md` 또는 `<workspace>/docs/adr/` — 아키텍처 결정 기록
- `<workspace>/AGENTS.md` — 워크스페이스 진입점·정책 요약
- 전역 `CLAUDE.md` — ai-nodes 차원 규칙

### 2. 논의

구체화가 필요한 점, 기술적으로 논의할 점을 사용자에게 제시한다. 사용자가 충분히 논의됐다고 판단하면 2.5단계로 넘어간다.

### 2.5. docs 최신화 + 커밋 (task 생성 전 필수)

논의 결과를 반드시 **task 생성 전에** docs에 반영한다. task 내부(phase)에서는 docs를 수정하지 않는다.
구현 phase 중 docs/ADR/정책 문서를 고쳐야 할 정도로 애매한 부분이 나오면 구현을 계속하지 말고 `PHASE_BLOCKED`로 보고한다.
예외는 task `index.json`, phase 파일의 상태, 검증 결과, 완료 기록처럼 실행 이력을 정리하는 변경뿐이다.

- `<workspace>/docs/adr.md` 또는 `<workspace>/docs/adr/` — 새 의사결정 기록
- `<workspace>/docs/data-schema.md` — 스키마 변경 반영
- `<workspace>/docs/flow.md` — 플로우 변경 반영
- `<workspace>/docs/code-architecture.md` — 디렉터리·계층 변경 반영
- `<workspace>/docs/prd.md` — 기능 표 갱신 (새 명령 추가 등)

**docs-first 커밋 원칙**: docs 변경사항을 먼저 단독 커밋 (`docs(<workspace>): ...`). 그 후 task 파일 생성 및 실행. task 실패해도 docs는 main에 남아 있고, task 커밋과 분리되어 history가 명확하다.

### 3. 구현 계획 초안

`skills/planning/task-create.md`를 정확히 숙지한 후, 다음을 포함한 초안을 작성한다:

- phase별 분리 이유와 작업 목록
- 성공 기준 (실행 가능한 명령어)
- 논의 필요한 사항

사용자 피드백을 받아 계획을 확정한다.

### 4. Task 생성

`<workspace>/tasks/<task-name>/` 디렉터리 아래:

```
<workspace>/tasks/<task-name>/
  index.json
  phase-01.md
  phase-02.md
  ...
```

각 phase 프롬프트는 **자기완결적**이어야 한다 — 이전 대화 없이 독립 실행 가능.
`references/common-pitfalls/INDEX.md`에서 현재 phase와 맞는 pattern file을 고르고 self-check한 뒤 사용자에게 제출.
어떤 항목이 필요한지 모호하면 해당 category 디렉터리 전체를 확인한다.

### 5. 실행

**실행 전 필수 확인**: `git status --porcelain`과 `git branch --show-current`로 working directory와 branch 상태 확인.

- **이상적**: clean 상태 (docs 커밋 완료 후)
- **허용 가능**: 단일 active task에서 task와 무관한 format-on-save만 존재
- **main worktree 직접 편집 허용**: 단일 active task, 작은 docs/process-only 변경, 또는 사용자 명시 허용
- **금지**: 같은 working directory에서 다른 task와 병렬 실행. git add/commit/push 충돌 발생.

**병렬 실행 규칙**: 여러 task가 동시에 active 상태면 background 구현은 별도 **git worktree + branch**를 기본값으로 사용한다.
단순한 "구현해줘" 요청만으로 main worktree 직접 편집이 안전하다고 가정하지 않는다.
같은 working directory에서 `run-phases.py`를 2개 동시 실행 금지.
claude teams(subagent)를 쓰더라도 파일 변경이 있으면 worktree/branch 격리를 우선한다.

phase 경계는 commit/push 경계가 될 수 있다.
검증된 변경을 오래 dirty 상태로 쌓지 않는다.
각 phase는 intended files만 stage하고 unrelated dirty files를 수정, stage, commit하지 않는다.
구현 phase는 고정된 docs/task 계약을 코드로 옮기는 단계다.
docs/ADR/정책 문서 수정은 phase intended files에 넣지 않는다.
문서 수정이 필요하면 계획 누락으로 보고 `PHASE_BLOCKED`를 출력한다.
다만 PR 생성과 merge의 기본 단위는 phase가 아니라 plan이다.
같은 plan의 모든 phase가 완료되기 전에는 PR을 만들지 않는다.
phase 단위 PR은 사용자가 명시적으로 승인한 예외 상황에서만 허용한다.
background worker의 최종 보고에는 사용한 worktree/branch 여부와 plan 단위 PR URL을 반드시 포함한다.

**반드시 `run-phases.py`를 백그라운드 실행한다.**

OpenClaw/Codex 메인 세션에서 사용자가 "기다리지 말고 notify로 받아보자"는 의도를 밝히면 단순 `nohup ... &`보다 `systemd-run --user` transient unit을 우선한다. 도구 실행 부모 프로세스가 정리되면서 `nohup` 자식이 끊길 수 있기 때문이다. `systemd-run --user`는 main session과 분리되고, 완료/실패는 `run-phases.py`의 Discord notify와 unit log로 추적한다.

Discord notify는 사람에게 보이는 채널 알림이고, Codex 메인 세션 wake를 보장하지 않는다. 완료 후 메인 세션이 반드시 후속 검토를 해야 하는 task는 systemd command 끝에 `openclaw system event --session-key <current-session-key> --mode now --text "<completion summary>"`를 붙이거나 OpenClaw cron `systemEvent` wake를 별도로 예약한다.

```bash
# 전체 실행 (백그라운드)
python3 skills/plan-and-build/scripts/run-phases.py career-os/tasks/<task-name>

# OpenClaw/Codex 메인 세션에서 완전 분리 실행
systemd-run --user --unit=career-os-plan-<task-name> \
  --working-directory=<repo-root> \
  bash -lc 'python3 skills/plan-and-build/scripts/run-phases.py career-os/tasks/<task-name>; status=$?; openclaw system event --session-key "<current-session-key>" --mode now --text "plan-and-build finished: <task-name> status=$status"; exit $status'

# 특정 phase부터 재개
python3 skills/plan-and-build/scripts/run-phases.py career-os/tasks/<task-name> --from-phase 3
```

run-phases.py가 자동으로 워크스페이스(`<task-dir>/../..`)를 감지하고:
- `<workspace>/.env`를 env로 로드 (`DISCORD_CHANNEL_ID` 등)
- ai-nodes 공용 `_shared/lib/notify_discord.ts`를 통해 진행/완료/실패 알림 발송
  - `TASK_NOTIFY_CHANNEL_ID`가 있으면 phase 진행 알림은 해당 채널로 보내고, daily 결과 알림용 `DISCORD_CHANNEL_ID`는 그대로 둔다.
- phase별 commit SHA를 `index.json`에 기록

### 6. 검증

- `index.json`의 `status` = `completed` 확인
- 각 phase의 성공 기준 명령어 실행
- 산출물 (`<workspace>/data/...` 또는 `<workspace>/docs/...` 변경)을 5문서와 대조

### 7. plan 단위 PR 생성

모든 phase가 완료되고 검증이 끝난 뒤 하나의 plan 단위 PR을 만든다.

- PR title은 plan 이름이나 핵심 산출물을 기준으로 한글로 쓴다.
- PR body에는 완료 phase, 주요 변경 파일, 검증 명령, 남은 결정점을 한글로 요약한다.
- phase별 commit/push는 허용하지만, PR은 전체 plan을 대표하는 하나만 만든다.
- merge는 메인 세션 review 이후에만 진행한다.
- phase 단위 PR이 필요하면 사용자 명시 승인을 먼저 받는다.

### 7-1. 한글 작성 규칙

commit 메시지, PR 제목, PR 본문, phase 실행 보고, subagent 최종 보고는 한글을 기본으로 작성한다.
Conventional Commit `type`과 `scope`, 파일 경로, 명령어, JSON key, 코드 식별자, commit SHA, Git trailer는 원문을 유지한다.
영어 PR 제목이나 영어 본문은 사용자가 명시적으로 요구했거나 외부 템플릿이 강제할 때만 허용한다.

## task 파일 스키마 (`index.json`)

```json
{
  "name": "string (kebab-case)",
  "description": "string (한 줄)",
  "created_at": "ISO-8601 UTC",
  "updated_at": "ISO-8601 UTC",
  "status": "planned | running | blocked | failed | completed",
  "current_phase": "int (1-based)",
  "total_phases": "int",
  "error_message": "string | null",
  "blocked_reason": "string | null",
  "phases": [
    {
      "number": "int (1-based)",
      "title": "string",
      "file": "phase-NN.md",
      "status": "pending | running | blocked | failed | completed",
      "allowedTools": ["Read", "Write", "Edit", "Bash", "Glob", "Grep"],
      "model": "haiku | sonnet | opus | (생략 가능)",
      "timeout": "int (초, 기본 600)",
      "commitSha": "string (실행 후 자동 기록)"
    }
  ]
}
```

## phase 프롬프트 작성 규칙

각 `phase-NN.md`는 **자기완결적인 프롬프트**다. Claude Code가 직접 읽고 실행한다.

필수 요소:

1. **목표 한 줄** — 무엇을 만들지/바꿀지.
2. **관련 docs** — 어떤 docs/ 파일을 먼저 읽어야 하는지 명시.
3. **변경할 파일 목록** — 정확한 경로.
4. **성공 기준** — 실행 가능한 명령어 (예: `bash -n script.sh && echo OK`).
5. **금지 사항** — 이 phase에서 *하지 말아야 할 일* (예: docs 수정 금지, 다른 phase 영역 침범 금지).
6. **PHASE_BLOCKED / PHASE_FAILED 신호** — 사람 개입이 필요하면 해당 marker를 stdout에 출력하고 종료한다.

구현 phase의 금지 사항에는 기본적으로 `docs/ADR/정책 문서 수정 금지`를 포함한다.
docs-first materialization phase만 예외적으로 docs를 수정할 수 있다.

phase 끝에는 필요한 경우 git commit + push를 포함시킨다.
read-only phase는 변경을 남기지 않는다.
쓰기 phase는 commit/push 경계가 될 수 있지만 PR 경계는 아니다.
PR은 모든 phase가 끝난 뒤 plan 단위로 만든다.

## 알림 신호

run-phases.py가 자동 발송:

- `[진행] <ws> task <name> phase N/M: <title>`
- `[완료] <ws> task <name> phase N/M: <title> [elapsed]`
- `[실패] <ws> task <name> phase N: <error>`
- `[보류] <ws> task <name> phase N: <blocked-reason>`
- `[완료] <ws> task <name> 전체 완료 (M phases)`

알림은 `<workspace>/.env`의 `DISCORD_CHANNEL_ID`와 `_shared/lib/notify_discord.ts`에 의존한다.
`TASK_NOTIFY_CHANNEL_ID`가 있으면 `run-phases.py`가 phase 진행/완료/실패/보류 알림에만 해당 값을 `DISCORD_CHANNEL_ID` override로 전달한다.
이 값은 daily 추천/스터디 결과 알림 채널과 agent 개발/운영 알림 채널을 분리할 때 사용한다.
`.env`가 없으면 `run-phases.py`가 알림을 조용히 건너뛴다. `.env`는 있지만 `DISCORD_CHANNEL_ID`가 비어 있거나 OpenClaw CLI 전송이 실패하면 warning만 남기고 phase 실행 자체를 깨뜨리지 않는다.

HUD 갱신은 `run-phases.py`가 직접 수행하지 않는다.
부분 event update는 usage/context/agents를 stale하게 만들 수 있으므로 외부 인터페이스로 남기지 않는다.
메인 세션이 `session_status`와 subagent 상태를 확인한 뒤 `scripts/task-hud/update_from_session_status.ts`로 full snapshot을 반영한다.

## 파일

- `scripts/run-phases.py` — phase 순차 실행 하네스
- `references/common-pitfalls/INDEX.md` — task 작성 시 self-check pattern router.
- `references/common-pitfalls/<category>/<id>-*.md` — 필요한 pattern만 선택해 읽는 세부 self-check.

## 사용 예시

```bash
# 1) 본 세션: docs 반영 + task 생성 + 별도 커밋
git add career-os/docs/adr/ career-os/docs/code-architecture.md  # career-os: adr/ 디렉터리 전체
git commit -m "docs(career-os): cj-oliveyoung 폴더 분해 ADR 추가"
git push

mkdir -p career-os/tasks/cj-oliveyoung-decomposition
# index.json + phase-01.md ... phase-05.md 작성
git add career-os/tasks/cj-oliveyoung-decomposition/
git commit -m "task(career-os): cj-oliveyoung 폴더 분해 task 생성"
git push

# 2) 다음 세션 (별도 Claude 인스턴스): 자동 실행
python3 skills/plan-and-build/scripts/run-phases.py career-os/tasks/cj-oliveyoung-decomposition

# 3) 전체 phase 완료 후: plan 단위 PR 생성
gh pr create --title "feat(career-os): cj-oliveyoung 폴더 분해" --body "<phase 요약 + 검증 결과>"
```

## 의도적으로 안 하는 것

- **본 세션에서 task 자동 실행**: 본 세션 = 논의 + 계획. 실행은 별도 세션이 책임. 결과물 분리 + 컨텍스트 격리.
- **워크스페이스 간 task 공유**: 각 워크스페이스의 `tasks/`는 그 워크스페이스 작업만 다룬다.
- **phase 안에서 docs 수정**: docs는 task 생성 *전*에 별도 커밋. phase에서 docs를 또 만지면 history가 섞인다.
- **task 중간에 사람 개입을 silent 처리**: 사람이 결정해야 하는 분기는 반드시 `PHASE_BLOCKED:` marker로 명시. blocked 상태는 exit 2.
- **자동 git push (모든 phase)**: phase마다 commit은 OK, push는 마지막 phase 또는 명시적 phase에서만.
