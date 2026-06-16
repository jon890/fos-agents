# AGENTS.md — career-os 워크스페이스

`~/ai-nodes` 아래의 독립적인 작업 워크스페이스. 모든 에이전트(Claude / Codex / Gemini 등)를 위한 정식 가이드 *진입점*. `CLAUDE.md`는 이 파일의 심볼릭 링크다.

**상세 내용은 `docs/` 5문서로 분리되어 있다. 이 파일은 라우팅과 가장 자주 쓰이는 정책만 담는다.**

## 5문서 라우팅 가이드

| 문서 | 무엇이 들어 있는지 | 언제 보는지 |
|---|---|---|
| [`docs/prd.md`](docs/prd.md) | 제품 범위·MVP·기능 목록·성공 기준·미연결 WIP | 새 기능 추가 / 우선순위 결정 |
| [`docs/data-schema.md`](docs/data-schema.md) | config / logs / runtime / 산출물 JSON 스키마 | 데이터 파일 다룰 때 / 새 config 도입 |
| [`docs/flow.md`](docs/flow.md) | 사용자·데이터 플로우 (명령별 입력→runner→산출물) | 새 흐름 추가 / 디버깅 |
| [`docs/code-architecture.md`](docs/code-architecture.md) | 디렉터리 레이어·책임·외부 의존·native skill 실행 패턴 | 코드 구조 변경 / 새 스킬 추가 |
| [`docs/adr/INDEX.md`](docs/adr/INDEX.md) | 모든 아키텍처 결정 개별 파일 + 조망 INDEX. 모노레포 레벨 결정은 [`ai-nodes/docs/adr.md`](../docs/adr.md) | 결정의 *왜*를 알아야 할 때 |

`tasks/`는 docs와 별개의 영역으로, `skills/planning`이 생성하고 `skills/plan-and-build`가 실행하는 **워크스페이스 단위 실행 계획**의 영구 저장소다. `<workspace>/tasks/plan{N}-<slug>/` 형태로 각 plan이 자기 디렉터리를 갖고, 그 안에 `index.json` + `phase-NN.md`가 들어간다. 완료된 plan도 history 보존 목적으로 삭제하지 않는다.

워크스페이스 표준 구조는 [`../docs/workspace-structure.md`](../docs/workspace-structure.md) (ai-nodes ADR-004) 청사진을 따른다. career-os는 ADR-019 (`scripts/` 분리)의 의도된 비대칭 예외 — `scripts/<skill-name>/`(실행 파일) + `skills/<skill-name>/`(SKILL.md + references) 분리 구조. 다른 워크스페이스로 확산 의도 없음.

plan 진행 cycle: `skills/planning` 구조로 사용자와 대화하며 brief/결정/phase를 확정 → 확정된 내용을 먼저 docs/ADR에 반영 → docs 결정을 task 파일로 옮기는 긴 materialization은 background subagent/session으로 위임 → 구현 phase는 `skills/plan-and-build`가 사용 가능하면 그 흐름으로 수행하고, 없으면 동일한 phase 문서 기반의 별도 구현 세션/Claude 비대화형 실행으로 수행 → Codex가 task 파일, 산출물, 검증 결과를 직접 review → worktree가 깨끗하고 범위가 명확할 때만 commit/push. 세션 격리 원칙 — planning은 대화형 합의와 승인까지, 긴 task 파일 생성과 실 phase 실행은 별도 작업 세션.
여러 task가 동시에 active 상태면 background 구현은 별도 git worktree와 branch를 기본값으로 사용한다.
병렬 실행 단위는 서로 독립적인 plan이다.
같은 plan 안의 phase는 current_phase 순서대로 실행하고, 명시적 예외가 없으면 병렬 실행하지 않는다.

중요 운영 원칙:

### Planning

- 사용자가 계획, 로드맵, 단계 정리, 구현 방향 논의를 요청하거나 `Use the "planning" skill for this request.`처럼 planning skill 사용을 명시하면 먼저 OpenClaw `skills/planning/SKILL.md`를 로드하고 그 구조(목표 재정의, phase, 열린 결정, 다음 액션)로 설계한다.
- career-os 구현 계획은 OpenClaw planning만으로 끝내지 않는다. 실제 파일 변경·자동화·스킬/크론/runner 수정이 예상되면 ai-nodes canonical `~/ai-nodes/skills/planning/SKILL.md`의 8단계 설계 기준을 함께 적용한다.
- 사용자가 "계획 세우고 구현까지", "plan and build", "계획대로 만들어줘"처럼 계획 이후 실행을 함께 원하면 먼저 `planning`으로 합의 가능한 plan을 만든 뒤, 구현이 필요하다고 판단되는 phase만 `plan-and-build` 또는 동등한 phase 기반 구현 세션으로 넘긴다.
- `plan-and-build`와 phase 구현은 항상 백그라운드로 실행한다.
  메인 세션에서 `run-phases.py`, Claude 비대화형 phase, 또는 여러 phase 구현을 직접 붙잡고 기다리지 않는다.
  메인 세션은 계획 합의, task 검토, 실행 시작, 완료 후 review/검증/commit 판단만 맡는다.
- planning skill을 사용할 때는 결론을 빨리 압축해 닫지 않는다.
  목표, 데이터 identity, 상태 전이, 수동 override, 검증 runner, 화면 기본값, 권한 경계, 운영 실패 모드 같은 의사결정 루트를 먼저 펼치고 여러 턴에 걸쳐 사용자와 확인한다.
  사용자가 "자세하게", "계속 논의", "추가 논의 필요하면 알려줘"라고 말하면 Codex가 다음 결정점을 먼저 제시한다.
  "필요하면 말하겠다"로 대화를 멈추지 않는다.
- 사용자가 "논의 끝났으니 진행", "계획 마무리 후 구현", "그 흐름으로 가자"처럼 planning 이후 실행을 승인해도 메인 세션이 즉시 코드 구현으로 들어가지 않는다.
  작은 단일 파일 hotfix가 아니라면 반드시 **docs/ADR 반영 → HUD `task materializing` 갱신 → background subagent/session으로 task 파일 생성 → 메인 세션 review → plan-and-build 또는 동등한 phase worker 실행 → 메인 세션 검증** 순서를 따른다.
  이 순서를 건너뛰는 것은 운영 규칙 위반으로 보고, 이미 건너뛰었음을 발견하면 즉시 사용자에게 알리고 후속 작업부터 정식 흐름으로 복구한다.
- `planning`은 사고·범위·tradeoff·결정 정리를 위한 스킬이고, `plan-and-build`는 합의된 task/phase를 실제 파일 변경과 검증으로 옮기는 실행 스킬이다. 둘을 한 세션에서 섞어 즉흥 구현하지 않는다.
- planning 품질 기준: 구현 가능성, 기존 코드 재사용, 호출 시나리오, 데이터·스키마, 흐름, 코드 구조, docs 영향, ADR 필요성을 확인한다. 작은 변경은 축약하되 docs 영향 분석은 생략하지 않는다.
- `claude -p "/planning ..."` 비대화형 planning은 기본 사용하지 않는다. planning skill 호출 자체도 Claude 백그라운드 작업으로 넘기지 않는다. planning은 사용자의 반박/결정 보류/범위 조정을 반영해야 하므로 Codex와 사용자가 메인 세션에서 같은 planning 흐름으로 대화하며 진행한다.

### Docs-first and Task Files

- planning skill로 결정이 확정되면 구현, phase 실행, 긴 task 파일 작성 전에 관련 docs/ADR에 먼저 반영한다. task 파일은 docs에 기록된 결정을 실행 가능한 phase로 옮기는 산출물이다.
- task 실행 전에는 docs-first 원칙을 지킨다. 논의로 확정된 결정은 task 생성 전에 5문서/ADR에 반영하고, task 파일과 구현 변경은 관심사별로 분리한다.
- task 파일 작성은 사용자와 Codex 메인 세션에서 planning 결정이 확정된 뒤 background subagent/session에 위임하는 것을 기본값으로 한다. 메인 세션은 합의 내용 요약, 위임 승인, 완료 후 review만 맡고 긴 `tasks/plan.../index.json`과 `phase-NN.md` 생성으로 대화를 블로킹하지 않는다.
- task 파일 생성 위임 없이 메인 세션이 `tasks/plan.../index.json`과 phase 파일을 직접 길게 작성하지 않는다.
  예외는 매우 작은 follow-up task skeleton이나 사용자가 명시적으로 "메인 세션에서 직접 작성"을 요청한 경우뿐이다.
- task 생성 subagent의 역할은 docs에 기록된 결정을 `tasks/plan.../index.json`과 `phase-NN.md`로 옮기는 것에 한정한다. 구현 코드 수정, phase 실행, commit/push는 맡기지 않는다.
- task 파일 생성을 시작할 때는 HUD를 `task materializing` 또는 `task files running`으로 갱신하고, 생성/검토/commit/push가 끝나면 `task files completed`로 갱신한다.
  OpenClaw career 세션에서는 `refresh-hud` skill 또는 `.openclaw/workspace-career/scripts/task-hud/update_from_session_status.ts`를 사용해 `discord-career-main` HUD를 full snapshot으로 갱신한다.
  task 상태만 바꾸는 부분 HUD 갱신은 stale usage/context/agents를 만들 수 있으므로 사용하지 않는다.
- subagent가 작성한 task 파일은 Codex 메인 세션이 실행 전에 `index.json` 스키마, phase 독립성, 실행 가능한 성공 기준, PHASE_BLOCKED/PHASE_FAILED 조건, `common-pitfalls.md` self-check를 직접 검토한 뒤에만 확정한다.
- 구현 전에는 **계획 → 문서 반영 → task 계약 고정** 순서를 끝낸다.
  구현 phase는 고정된 계약을 코드로 옮기는 단계이며, 구현 중 docs/ADR/정책 문서를 새로 고치지 않는다.
  구현하다 문서 수정이 필요할 만큼 애매한 부분이 나오면 계획 누락으로 보고 `PHASE_BLOCKED` 처리한다.
  예외는 task `index.json`, phase 파일의 상태, 검증 결과, 완료 기록처럼 실행 이력을 정리하는 변경뿐이다.
- 설정·스키마·데이터 파일 구조를 바꾸면 `docs/data-schema.md`를 먼저 또는 함께 수정한다. 예: 새 config 필드, 새 runtime/report JSON, ledger 필드, 평가 샘플 저장 위치.
- 새 실행 스크립트, runner, cron, agent flow를 만들면 `docs/flow.md`에 입력→처리→출력 흐름을 추가하고, 디렉터리 책임이나 외부 의존이 바뀌면 `docs/code-architecture.md`도 함께 갱신한다.
- 정책·원칙·외부 공개/비공개 경계처럼 모든 에이전트가 따라야 하는 행동 규칙은 `AGENTS.md` 또는 해당 skill `SKILL.md`에 먼저 남긴 뒤 산출물을 만든다.
- 현재 타깃, 회사, 공고, 면접명, 우선순위처럼 자주 바뀌는 운영 상태는 `AGENTS.md`에 박지 않는다. 해당 상태는 `config/`, `data/`, `tasks/`, `docs/`의 책임 파일에서 관리한다.
- task/phase를 만들 때는 phase당 작업 항목 5개 이하, 독립 실행 가능한 phase 문서, 실행 가능한 성공 기준, PHASE_BLOCKED/PHASE_FAILED 조건, `~/ai-nodes/skills/plan-and-build/references/common-pitfalls.md` self-check를 포함한다.
- 여러 단계가 이어지는 기능 고도화는 대화 중 즉흥 구현으로 밀어붙이지 않는다. 범위가 2개 이상 파일/흐름을 건드리거나 장기 반복 작업이 되면 `tasks/plan...` 아래 계획 파일을 만들고 phase 단위로 구현한다.

### Background Execution

- **Hard rule:** `plan-and-build`, `run-phases.py`, Claude 비대화형 구현, 여러 phase를 건드리는 구현 작업은 메인 세션에서 직접 실행하거나 기다리지 않는다.
  반드시 `systemd-run --user` 같은 백그라운드 실행으로 분리하고, 메인 세션은 사용자 대화를 계속 받을 수 있게 둔다.
- 메인 세션에서 허용되는 것은 짧은 사전 검증, 실행 명령 확정, 상태 조회, 완료 후 review/검증/commit/push뿐이다. 구현 phase 자체가 오래 걸릴 가능성이 있으면 "일단 실행해보고 기다리기"를 하지 않는다.
- 실패 사례: plan040에서 `run-phases.py`를 메인 세션에서 직접 실행해 Claude phase가 무출력으로 오래 걸리며 사용자 대화가 막혔다. 원인은 긴 구현 실행을 background job으로 분류하지 않은 판단 실수다. 같은 패턴을 반복하지 않는다.
- 긴 계획 파일 작성, 다중 phase task 생성, docs 결정을 task 파일로 옮기는 작업, 구현 phase 실행은 메인 세션 대화를 오래 블로킹하지 않는 것을 기본값으로 한다. 사용자와의 결정 합의는 메인 세션에서 하되, 합의가 끝난 뒤 남은 문서화·task 파일 작성·phase 실행이 길어질 것 같으면 `systemd-run --user`, `plan-and-build`, Claude 비대화형 실행, 또는 동등한 백그라운드 작업으로 넘기고 완료 노티를 받는다.
- 백그라운드 작업이 완료되면 메인 세션은 생성된 파일, `git diff`, `index.json`, 검증 로그, 테스트 결과를 직접 검토한 뒤 사용자에게 요약한다. 백그라운드가 만든 산출물을 검토 없이 완료 처리하거나 커밋하지 않는다.
- 백그라운드 구현 세션은 사용자와 논의하는 대화 공간이 아니라 합의된 phase를 실행하는 작업자다. 논의·계획 합의 없이 OpenClaw `sessions_spawn` 등으로 구현 세션을 먼저 띄우지 않고, Codex와 사용자 대화에서 계획을 확정한 뒤 Claude/plan-and-build 또는 동등한 phase 기반 실행으로 넘긴다.
- 이미 실행 중인 plan에는 새 논의나 MVP 범위 조정을 끼워 넣지 않는다.
  새 목표는 별도 plan 또는 후속 phase 계획으로만 기록한다.
  구현 worker가 이미 실행 중이면 새 논의를 전달하지 않는다.
  실수로 전달했다면 즉시 정정하고 worker가 기존 task 계약만 수행하게 한다.
- 병렬화는 서로 독립적인 plan 사이에서만 기본 허용한다.
  같은 plan의 phase는 docs-first, current_phase, 이전 산출물 의존성을 지키기 위해 순차 실행한다.
- Claude 비대화형 실행은 합의된 task/phase 구현에만 사용한다.
- Codex는 planning brief 작성, 열린 결정 정리, task 파일 고정, plan-and-build/Claude 구현 결과 review, 검증, commit/push를 담당한다.
- 단순한 "구현해줘" 요청만으로 main 워크트리 직접 편집이 안전하다고 가정하지 않는다.
  active 작업과 dirty state를 먼저 확인한다.
- main 워크트리 직접 편집은 단일 active task, 작은 docs/process-only 변경, 또는 사용자 명시 허용에 한정한다.
- background worker는 최종 보고에 사용한 워크트리/branch 여부를 적는다.
- background worker가 별도 워크트리를 만들었다면 완료/중단 전에 `git -C <worktree> status --short`로 남은 변경을 확인한다.
  clean이면 `git worktree remove <worktree>`로 워크트리 디렉터리를 명시적으로 제거한다.
  dirty이면 제거하지 말고 남은 변경과 경로를 보고한다.
  branch 기록은 별도 판단 대상이므로, 기본적으로 worktree 제거와 branch 삭제를 묶지 않는다.
- 구현 phase에서 Claude를 호출할 때도 phase 문서의 범위, 안전 조건, 검증 기준을 명확히 전달한다.
- `skills/plan-and-build/scripts/run-phases.py`로 task를 실행하면 `<workspace>/.env`의 `DISCORD_CHANNEL_ID`와 `_shared/lib/notify_discord.ts`를 통해 phase 진행/완료/실패/보류 알림이 자동 발송된다.
  `TASK_NOTIFY_CHANNEL_ID`가 있으면 phase 진행 알림은 해당 채널로 보내고, daily 추천/스터디 결과 알림용 `DISCORD_CHANNEL_ID`는 그대로 유지한다.
  알림 실패는 phase 실패로 전파되지 않으므로, 메인 세션은 알림 도달 여부와 별개로 `index.json`과 검증 명령을 확인한다.
- 예외적으로 메인 세션이 phase를 직접 수행하면 `run-phases.py` 알림 경로를 우회한다.
  이 경우 phase 시작과 완료를 Discord에 직접 짧게 보고하고, 완료 후 `index.json` 상태와 commit SHA를 수동 기록한다.
  알림 없이 여러 phase를 진행하지 않는다.
- 같은 하네스는 HUD를 직접 갱신하지 않는다.
  부분 event update는 usage/context/agents를 stale하게 만들 수 있으므로 외부 인터페이스로 남기지 않는다.
  메인 세션은 phase 시작·완료·실패·보류처럼 상태판 갱신이 필요할 때 `session_status`와 subagent 상태를 먼저 확인한 뒤 `refresh-hud` 또는 `update_from_session_status.ts`로 full snapshot을 반영한다.
- OpenClaw/Codex 메인 세션에서 Claude/plan-and-build를 "기다리지 않고 notify로 받는" 운영을 할 때는 단순 `nohup ... &` 대신 `systemd-run --user` transient unit을 우선한다. 도구 부모 프로세스 정리로 자식이 끊길 수 있으므로, unit name과 log path를 사용자에게 알려주고 완료는 Discord notify + `systemctl --user status <unit>` + log로 확인한다.
- Discord notify는 채널 알림일 뿐 메인 세션 wake를 보장하지 않는다. 완료 후 Codex가 다시 검토해야 하는 작업은 systemd command 끝에 `openclaw system event --session-key <current-session-key> --mode now --text "<completion summary>"` 또는 OpenClaw cron `systemEvent` wake를 붙여 별도 wake event를 발생시킨다.

### Validation and Git

- 구현 후에는 관련 검증 명령, 샘플 실행, 정책 grep, diff 검토 중 최소 하나 이상을 수행하고 결과를 사용자에게 요약한다. dirty 워크트리에서는 unrelated 변경을 커밋 범위에 포함하지 않는다.
- 작업이 한 세션을 넘기거나 career-os 변경 파일이 5개를 넘기면, 다음 구현으로 넘어가기 전에 `git status --short`로 누적 상태를 확인하고 관심사별 commit/push 계획을 먼저 세운다. 사용자가 보류를 요청하지 않았다면 검증된 변경은 오래 쌓아두지 말고 작은 단위로 push한다.
- Claude/서브에이전트가 구현한 결과는 곧바로 신뢰하지 않는다. 메인 세션(Codex)이 `git diff`, build/test, 동작 확인, 정책 grep, runner 검증을 직접 재실행한 뒤에만 완료로 본다.
- phase가 외부 API/채용 페이지/크론 기본값처럼 운영 결과에 영향을 주면, 구현 검증과 별개로 실제 실행 검토를 수행한다. 예: source별 수집 수, reject diagnostics, active-only 누수, 마감 임박 공고, 추천 입력으로 쓸 품질을 확인한다.
- 새 source adapter나 자동화 기본값은 바로 daily 기본값으로 켜지 않는다. 먼저 shadow 실행 또는 명시 옵션으로 2-3일 관찰하고, 수집량·품질·실패 모드가 안정적이면 별도 결정으로 기본값 전환을 기록한다.
- phase 경계는 commit/push 경계다.
  긴 dirty state를 피하고 intended files만 stage한다.
- 워크트리가 이미 dirty하면 unrelated file을 수정, stage, commit하지 않는다.
  같은 워크트리에서 계속할 수 없는 상태면 별도 git worktree와 branch를 만든다.
- 작업 완료 보고 전에는 반드시 `git status --short`를 다시 확인한다.
  보고에는 워크트리 상태를 `clean`, `unrelated dirty만 남음`, `의도적으로 남긴 파일 있음`, `정리 보류`처럼 분류해 적는다.
- 검증된 intended 변경은 관심사별 commit/push까지 끝내는 것을 기본값으로 한다.
  보류가 필요하면 남긴 이유, 파일 목록, 다음 조치를 완료 보고에 포함한다.
- 임시 로그, scratch 파일, 중간 산출물은 보존할 이유가 없으면 정리한다.
  삭제가 애매한 파일은 제거하지 말고 경로와 판단 이유를 보고한다.
- 별도 git worktree를 만든 background 작업은 종료 전에 해당 워크트리에서 `git status --short`가 비어 있는지 확인한다.
  clean이면 `git worktree remove <path>`까지 수행한 뒤 완료로 본다.
  dirty이면 워크트리를 제거하지 않고 남은 변경, 워크트리 경로, 다음 조치를 보고한다.
- subagent나 백그라운드 작업자에게 일을 맡길 때도 위 워크트리 정리 계약을 프롬프트에 포함한다.

워크플로 스크립트나 파일 선택 전략을 바꾸기 전에 반드시 `docs/adr/INDEX.md`를 먼저 확인한다. 새 결정은 `docs/adr/ADR-NNN-slug.md` 새 파일 + `docs/adr/INDEX.md` 행 추가로 기록한다(ADR-089).

폐기된 자산의 상세 경로, 옛 실행 명령, migration 이력은 `AGENTS.md`에 반복해 적지 않는다. 현재 사용해야 하는 규칙만 남기고, 폐기 이유와 역사적 맥락은 `docs/adr/`의 해당 ADR 파일을 단일 출처로 둔다.

## 활용 범위

career-os는 커리어 성장, 회사·공고 적합도 분석, 면접 준비, 지원 준비 자동화를 위한 데이터·에이전트 워크스페이스다.

`AGENTS.md`는 이 워크스페이스를 어떻게 활용할지에 대한 공통 지침만 담는다. 현재 MVP 타깃, 회사명, 공고, 면접 일정, 학습 우선순위처럼 자주 바뀌는 내용은 각 책임 파일에서 관리한다.

- 후보자 프로필과 장기 이력 기준: `config/candidate-profile.md`
- 현재 타깃과 운영 상태: `config/`, `data/`, `tasks/`, `logs/`
- 제품 범위와 기능 결정: `docs/prd.md`, `docs/adr/INDEX.md`
- 스키마와 데이터 경계: `docs/data-schema.md`
- 흐름과 실행 경로: `docs/flow.md`

config는 전체 자산 목록을 담는 DB가 아니다.
학습 문서 목록은 `sources/fos-study/`에서, 공개 질문 목록은 `public/question-bank/`에서 파생한다.
`config/`에는 현재 타깃, 후보자 baseline, 외부 source registry, 학습 진행 상태, 사람이 고른 pin/override/제외 조건처럼 의도적인 정책과 예외만 둔다.

## 지원 준비 데이터 경계

지원 준비 흐름은 추천 리포트, 지원 후보 상태, 실제 지원 워크플로우를 분리한다.
자세한 필드, 상태값, 승격 규칙은 `docs/data-schema.md`와 관련 task 문서를 따른다.

- `frontdoor-queue.jsonl` 계열 파일은 legacy pre-ledger queue이며 DB import 후 삭제 대상이다.
- fos-career MySQL은 지원 후보 상태와 background outbox의 정본으로 전환한다.
- 사용자가 카드 전체를 클릭하면 내부적으로 지원 시작 workflow를 요청한다.
- 지원 시작은 회사 분석, 공고 분석, fit 분석, 공부팩, 이력서 초안, 제출 후 면접 대비까지 이어지는 내부 workflow다.
- 실제 외부 제출, 업로드, 로그인, 공개 발행은 사용자 별도 승인 전까지 하지 않는다.
- 개별 공고 URL, 모집 활성 여부, 역할/연차/스택, 지원 경로가 불명확한 항목은 ledger로 승격하지 않는다.
- 후보 추천, 승격, 제외, 만료 같은 상세 상태명은 AGENTS가 아니라 schema/docs/task에서 관리한다.
- 최종 이력서, 지원 패키지, 외부 제출, 공개 발행은 사용자 검토 절차를 통과한 뒤에만 진행한다.

## Discord HTML 첨부 경계

복습자료나 면접 준비 HTML을 Discord에 직접 첨부할 때는 OpenClaw 전역 HTML 읽기 정책을 완화하지 않는다.
직접 첨부 대상 HTML은 `data/runtime/downloads/` 아래에 둔 파일만 허용한다.

- 일반 `private/` 경로의 HTML을 바로 첨부하지 않는다.
- `scripts/interview-prep/stage_review_html_for_discord.ts <data/runtime/downloads/*.html>`로 파일을 검증하고 `/tmp/openclaw/career-review-downloads/` 아래로 스테이징한 뒤, 출력된 `file://` 경로를 Discord 첨부에 사용한다.
- 이 헬퍼는 `data/runtime/downloads/` 밖의 HTML을 거절해야 한다. 더 넓은 허용이 필요하면 전역 정책을 풀지 말고 먼저 사용자와 범위, 민감 정보 경계, 대안 형식을 논의한다.
- ZIP 첨부는 fallback으로만 사용하고, 사용자가 직접 HTML 다운로드를 요청하면 위 스테이징 경로를 우선한다.

## 웹 대시보드 경계

`fos-career`는 career-os와 분리된 사람용 웹 제품 레포로 다룬다.
웹 대시보드는 추천 후보 상태와 실행 요청의 정본을 점진적으로 소유한다.
career-os는 수집, 리포트 생성, skill 실행, private 산출물 생성을 맡는다.

- 기본 위치는 `~/services/fos-career`를 사용한다.
- legacy career-os 원장과 산출물은 migration 전까지 read-only mount 또는 명시 env 경로로 읽는다.
- 대시보드 자체의 인증, 세션, 감사 로그, 지원 후보 상태, 목적별 background outbox는 `fos-career` 쪽 책임으로 둔다.
- 범용 채팅 UI/API는 ADR-064로 제거됐으므로 새 작업에서 되살리지 않는다.
- 배포, Docker, MySQL, reverse proxy 세부 구현은 `fos-career` repo 또는 관련 plan/docs에 둔다.
- fos-career DB schema나 migration을 바꾸는 career-os task는 migration 파일 생성만으로 완료 처리하지 않는다.
  실제 대상 DB 또는 명시된 smoke DB에 적용하고, 신규 table/index/seed, `__drizzle_migrations` 최신 hash, `drizzle-kit migrate` 재실행 성공, 실제 DB ingest/helper/worker dry-run 중 하나 이상을 확인해야 한다.
  DB 연결을 할 수 없으면 fixture/dry-run으로 대체 완료하지 말고 `PHASE_BLOCKED` 또는 운영 DB 적용 보류로 기록한다.

## 진실 출처

- 로컬 동기 저장소: `~/ai-nodes/career-os/sources/fos-study`
- 사용자가 “fos-study에 블로그 글로 게시해줘”, “블로그 글로 게시해줘”라고 하면 이 저장소 아래 적절한 카테고리에 markdown 글을 작성한다.
- 공개 블로그 글에는 민감한 개인 정보, 정확한 주소/동호수, 비공개 내부 정보는 사용자가 명시하지 않는 한 제외한다.
- fos-study 게시 글은 블로그 파서 호환을 우선한다. 예: bold-wrapped quote, bare `~` 범위 표기처럼 깨지기 쉬운 markdown 패턴을 피한다.
- 사용자가 검토 전 초안 발행을 요청한 공부팩/블로그 글은 제목에 `[초안]`을 유지한다. 사용자가 직접 읽고 최종 보강/문제 없음 판단을 한 뒤에만 `[초안]`을 제거한다.
- 공개 공부팩은 특정 회사/포지션/지원 여부를 전제로 쓰지 않는다. 지원 의도가 강하게 드러나는 표현은 사용자가 명시 요청한 경우에만 쓴다.
- 특정 공고·면접·지원서와 연결한 해석은 공개 fos-study 글이 아니라 `career-os/data/` 아래 비공개 지원 패키지/면접 메모에 따로 둔다.
- 게시 목적 글은 작성 후 필요한 README/index를 갱신하고, 검증 후 commit/push한다.
- 마크다운만 분석. `.claude/**` 무시.
- 후보자 프로필은 `config/candidate-profile.md`에서 관리한다. 프로필 수정은 이 파일 한 곳에 집중하고, 근거 경로 태깅 규칙은 해당 파일과 docs를 따른다.

## 워크플로 진입점 (요약)

**현재 표준 진입점은 agent skill 직접 호출이다.**
skill 본문은 `career-os/.claude/skills/<skill>/SKILL.md`를 정본으로 두고,
Codex 노출은 `career-os/.codex/skills/<skill>` 심볼릭 링크로 연결한다.
Claude CLI 비용을 피해야 하는 대화형 작업에서는 `claude -p` wrapper를 만들지 말고 Codex가 같은 SKILL.md 흐름을 직접 수행한다.
기존 cron/runner 중 `run_daily_with_claude.*`처럼 이름이 남은 경로는 호환 계층으로만 다룬다.
단, 지원서 제출, 이메일, 공개 게시물, 외부 메시지 전송은 별도 사용자 승인 전까지 실행하지 않는다.

폐기된 dispatcher / command-router 이력은 `docs/adr/ADR-031-command-router-일괄-폐기-ts-lib-정리.md`를 단일 출처로 본다. 새 작업에서 옛 `run_now.sh` 계열 경로를 되살리지 않는다.

### agent skill 목록

```bash
cd career-os

# 학습·면접 자산 생성 (fos-study commit + push)
# 주제 중심 학습 문서
/study-pack-writer <topic>
# 후보자 이력 Q&A 은행 + 마스터 플레이북
/interview-asset-writer <topic>
# 공개 가능 일반 backend/CS 질문 bank 보강
/question-bank-collector <topic>

# 추천·분석 (비공개 career-os 리포트)
# 아침 토픽 추천 + 후보 refresh + live-coding seed (ADR-026, ADR-070)
/study-topic-recommender [context]
# baseline/daily/stage 면접 준비 자연어 분기 (ADR-027, ADR-048)
/interview-prep-analyzer [baseline|daily|topic|first-round]
# 후보자 자산 Append 갱신 (ADR-028)
/candidate-baseline-suggester
# 활성 공고 수집 + 3 티어 추천 (ADR-030)
/position-recommender [컨텍스트] [채용공고 file]

# 지원 준비 루프 (비공개 career-os 산출물)
# 공고별 지원 패키지 생성
/application-package-writer <posting-path-or-context>
# 지원 패키지 근거/과장/드리프트 검토
/application-reviewer <application-dir>
# 일일 지원 현황 digest
/daily-application-digest [YYYY-MM-DD]
```

`docs-audit`는 career-os에서 제거됐다(ADR-088). fos-study 문서 감사가 필요하면 fos-study repo checkout 환경에서 그 repo의 스킬을 직접 실행한다.

각 명령의 입력/산출물/git push 여부 상세는 `docs/prd.md` 기능 표, 데이터 흐름은 `docs/flow.md` 참조.

런타임 상태(어떤 명령이 최근에 잘 도는지)는 이 문서에 박지 않는다 — `logs/task-runs.jsonl`이 단일 출처이고 `skills/workspace-audit`가 그때그때 보고한다.

## 외부 의존성

`~/ai-nodes/_shared/` 아래. 자세한 책임은 `docs/code-architecture.md` 외부 의존성 섹션 참조.

- `_shared/lib/notify_discord.ts` — Bun. `openclaw message send --channel discord` subprocess. `DISCORD_CHANNEL_ID` env 필수, `--media <path>` 옵션 지원.
- `career-os/scripts/interview-prep-analyzer/mvp_target_schema.ts` — Bun/zod. `config/mvp-target.json` 면접 단계 설정 검증. `parseMvpTarget()` 포함.
- `_shared/lib/extract_claude_result.ts` — Bun. Claude JSON envelope 파싱. career-os + apartment + stock-investment 공용.
- Bun runtime — TS 헬퍼 실행. 설치 후 ai-nodes 루트에서 `bun install` 1회 (zod, fast-xml-parser, dotenv).
- `claude` CLI — legacy cron/runner 호환 경로에 남아 있음.
  대화형 Codex 작업에서는 비용 문제 때문에 기본 호출 경로로 쓰지 않는다.

## 운영 원칙

- 광범위 풀-리포 분석 금지. baseline은 큐레이션된 core 세트 안에서 (`config/baseline-core-files.json`).
- daily는 baseline보다 더 작게 — 토픽 기반 3-5개 문서.
- 비용 데이터는 `logs/task-runs.jsonl`의 `cost_usd` / `model` / `tokens_*` 필드로 자동 기록 (ADR-014 이후 측정 가능 정책).
- `workspace-audit`의 `health.token_outlier`가 평균 ±2σ 이탈 보고. 비용 집계는 `logs/task-runs.jsonl` `cost_usd` 필드로 추적.
- 비밀 정보는 `.env` (워크스페이스 root, ADR-021): `DISCORD_CHANNEL_ID`, `GITHUB_TOKEN`, `GITHUB_REPO_*` 등. 템플릿은 `.env.example`.
- 영구 자산은 `~/.openclaw/workspace`가 아닌 워크스페이스 내부에 저장.
- 사용자 설명과 Discord 요약에서는 불필요한 한국어/영어 혼용을 피한다. `bullet`, `target`, `rubric` 같은 영어 용어를 쓸 때는 처음에 쉬운 한국어로 풀어쓴다. 예: "target별 이력서 bullet" 대신 "지원 회사/직무별 이력서 한 줄 경력 문장". 파일명·코드·공식 용어는 유지하되, 사용자가 이해할 설명은 한국어를 우선한다.

## 규칙

- 이 태스크는 재사용 가능하고 다른 워크스페이스(apartment, stock-investment, travel)와 격리.
- 저장소는 로컬 동기 우선, 분석은 Claude로.
- 워크플로는 백그라운드 재실행 가능하고 날짜 단위로 멱등.
- 불확실성을 명시한다. 검증된 사실과 추론을 구분한다.
- 새 아키텍처 결정은 `docs/adr/ADR-NNN-slug.md` 새 파일 + `docs/adr/INDEX.md` 행 추가 (ADR-089, career-os 파일럿 전환).

## fos-brain 연동

이 워크스페이스 agents의 brain 읽기/쓰기 규약.
단일 정책은 ai-nodes 루트 `AGENTS.md` 13번 + ADR-009(구조) / ADR-010(쓰기 안전·프라이버시).

- 접근: thin caller — brain-search(읽기) / brain-add(쓰기). brain 로직 재구현 금지.
- cron 무인 실행: brain-search 읽기만. brain-add 적재는 discord 대화 세션에서 사람 검토 후.
- 판단: 추천 실패 원인, 장기 재사용 가능한 면접 전략, skill/agent 운영 원칙처럼 여러 작업에 반복 적용될 통찰은 brain 축적 후보로 본다.
- 절차: 먼저 brain-search로 기존 지식을 확인하고, 추가할 내용·namespace(public/private/work)·근거 파일을 사용자에게 짧게 preview한다. Discord/group 맥락에서는 사용자 승인 전 brain-add 금지.
- 제외: 하루짜리 실행 로그, 단순 cron 성공/실패, 개인 이력 세부사항, 이미 repo 문서에 충분히 남은 implementation detail은 기본적으로 brain에 넣지 않는다.
- 산출물 네임스페이스 라우팅:
  - fos-study 파생 study/면접 지식 → public-OK.
  - 개인 baseline·면접 자산·커리어 데이터 → private.
