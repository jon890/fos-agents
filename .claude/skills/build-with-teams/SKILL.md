---
name: build-with-teams
description: Claude Agent Teams 파이프라인 — team-lead·critic·executor·docs-verifier 4 에이전트가 가시적으로 협업. run-phases.py 백그라운드 실행 대신 사용. "/build-with-teams", "agent team 으로 빌드", "teams 로 phase 실행", "critic 평가", "docs-verifier 검증" 같은 요청 시 반드시 이 스킬 사용.
---

# build-with-teams

task phase를 Claude Agent Teams 파이프라인으로 실행하는 시스템. `run-phases.py` 백그라운드 실행 대신 4-5명의 에이전트가 가시적으로 협업.

> **모노레포 공용 스킬** (ai-nodes ADR-018). 워크스페이스별 환경·브랜치 컨벤션은 variant(`variants/<workspace>.md`)가 본문 일반 규칙에 **우선**한다. `plan-and-build`와 병존 — 무인 cron/background는 `plan-and-build`, 대화형 가시 협업은 본 스킬.

## 워크스페이스 컨벤션 (variant 우선)

브랜치·worktree·PR·환경 컨벤션은 워크스페이스마다 다르다.
실행 전 `.claude/skills/build-with-teams/variants/<workspace>.md`를 읽고 본문 일반 규칙에 더한다(있으면 variant가 우선).

기본 규칙(variant가 덮지 않으면 적용):

1. **브랜치**: `feat/{plan}` 또는 `<type>/{plan}` 신규 생성. 외부 업무 매핑(dooray 등)이 있는 워크스페이스는 variant가 브랜치 규칙을 덮는다.
2. **본 문서의 모든 `feat/{plan}` 표현은 워크스페이스 브랜치 규칙으로 읽는다.** 사전 검증·worktree·push·PR 동일.
3. **worktree 사용** — 워크스페이스 worktree 루트에 `git worktree add ... <branch>`.
4. **메인 워킹 디렉터리 점유 회피** — 같은 브랜치를 두 worktree가 동시 점유할 수 없다.
5. **사전 검증 2·3번은 워크스페이스 브랜치 기준** — `git ls-remote --heads origin "<branch>"` + `gh pr list --search "<branch>"`.
6. **PR 제목**: 워크스페이스 커밋 컨벤션(conventional commit + 한글 subject)을 따른다.

권위 출처: 워크스페이스 `AGENTS.md`의 Git 워크플로 + `variants/<workspace>.md`.

## 사전 검증 (실행 전 필수)

plan 인자를 받으면 **가장 먼저** 3중 검증(main index.json status + 원격 feat 브랜치 + 오픈 PR).
하나라도 걸리면 사용자에게 알리고 **실행 차단** — main 에 task 부재 시 원격 dooray 브랜치 자동 스캔 필수.

상세 절차 (스캔 명령·옵션 A 흐름·base 신선도 점검·completed 정합 검증): **references/preflight.md**

## 핵심 원칙

1. **docs-first**: docs 반영 + 커밋 → task 생성 → 실행. 순서 위반 금지
2. **가시적 협업**: 백그라운드 스크립트 대신 에이전트 팀이 각 단계를 명시적으로 수행
3. **평가 통과 조건**: critic 승인 없이 실행 불가. REVISE면 계획 수정 후 재평가
4. **docs 정합성**: 실행 완료 후 docs-verifier가 코드↔문서 일치 검증
5. **재시도 한도**: 무한 루프 방지 (아래 "재시도 한도" 섹션 참조)

## 팀 구성

| 역할              | 에이전트 타입                                                             | 기본 모델 | 책임                                                                                                                                                                                                                                                                                                            |
| ----------------- | ------------------------------------------------------------------------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **team-lead**     | main session                                                              | opus      | 계획 수립, task 생성, 팀 조율, **phase 별 atomic commit (6.1)**, 최종 push/PR                                                                                                                                                                                                                                   |
| **critic**        | `oh-my-claudecode:critic`                                                 | opus      | 계획 평가 (APPROVE/REVISE), 실제 코드 대조                                                                                                                                                                                                                                                                      |
| **executor**      | `docu-parser-executor`                                                    | sonnet    | phase 순차 실행, 코드 수정 (커밋 제외), `bypassPermissions`                                                                                                                                                                                                                                                     |
| **code-reviewer** | `oh-my-claudecode:code-reviewer`                                          | sonnet    | 코드 품질 검사 (PASS/FIX_NEEDED), AI slop/금지사항 탐지                                                                                                                                                                                                                                                         |
| **docs-verifier** | `docu-parser-docs-verifier`                                               | sonnet    | 코드↔docs 정합성 검증 (PASS/UPDATE_NEEDED/VIOLATION). **plan017 에서 신설 완료** — `.claude/agents/docu-parser-{executor,docs-verifier}.md`. agent definition 이 도메인 지식의 단일 소스. SKILL prompt 는 호출 인자 + 직전 phase 학습 인계만.                                                                    |

## 도입 배경 + trade-off (plan015 회고 + plan017 결정)

- **plan015 검증**: 18 commit 누적 refactor. phase 7-A~D 부터 spawn-shutdown 사이클 적용 — 컨텍스트 격리 + phase model 정책 유리함 확인.
- **trade-off**: 단일 executor (소규모 ≤3 phase) vs phase 별 spawn-shutdown (대규모 ≥4 phase) — 컨텍스트 격리·phase model 적용은 후자 강점.
- **결론**: default 는 phase 별 spawn-shutdown 사이클. 3 phase 이하 소규모만 단일 executor 예외 허용.
- **plan015 회고 4건** (planning / code-review-pitfalls / common-pitfalls 갱신) 은 이미 main 머지됨.

### 정식 팀원 스폰 규칙 (필수)

critic·executor·code-reviewer·docs-verifier 는 **반드시 TeamCreate 로 생성한 팀의 정식 멤버로만 스폰**한다 (`team_name` + `name` 필수).

**`Agent` 도구 단발 호출(team_name·name 없이)로 대체하는 것을 절대 금지한다.**
같은 agent 정의(`docu-parser-executor` 등)를 부르면 결과가 같아 보여 우회하기 쉽지만, 그러면 가시적 협업·SendMessage 재시도 사이클·아래 정적 검증이 모두 빠진다.
"결과가 동등하다"는 판단으로 이 규칙을 축소하지 않는다 — `/build-with-teams` 호출 자체가 이 워크플로를 그대로 따르라는 지시다.

**스폰 직후 정적 검증 게이트 (필수 — 매 팀원 스폰 후)**:

각 팀원을 스폰한 직후 아래 게이트를 통과해야 다음 단계로 진입한다.
config.json 에 정식 멤버로 등록되지 않았으면 (Agent 단발 호출로 우회됐으면) `TEAM_CONFIG_MISSING` / `MEMBER_MISSING` 으로 차단된다.
실패하면 `name` 파라미터를 넣어 재스폰하고, 반복 실패 시 `PHASE_BLOCKED`.

```bash
# cwd: <repo root>. plan{N} 과 직전에 스폰한 멤버 이름들을 인자로
bash .claude/skills/build-with-teams/scripts/verify_team_members.sh plan{N} critic executor code-reviewer docs-verifier
```

SendMessage 회신 강제 · self-shutdown 대응 · worktree 절대경로 전달 등 상세: **references/team-spawn.md**

## 모델 라우팅 (task 규모 기반)

task의 `index.json` + phase 파일을 읽고 규모를 판정하여 팀원 모델을 동적으로 조정.

### 규모 판정 기준

| 규모   | 조건                                                               |
| ------ | ------------------------------------------------------------------ |
| **소** | `total_phases: 1`, 버그 수정/UI 미세 조정/단순 설정 변경           |
| **중** | `total_phases: 2~3`, 기존 기능 확장/리팩토링/스키마 단순 추가      |
| **대** | `total_phases: 4+` 또는 아키텍처/신규 도메인/DB 스키마 대규모 변경 |

### 규모별 모델 표

| 규모   | team-lead | critic | executor | code-reviewer | docs-verifier |
| ------ | :-------: | :----: | :------: | :-----------: | :-----------: |
| **소** |  sonnet   | sonnet |  sonnet  |    sonnet     |    sonnet     |
| **중** |  sonnet   |  opus  |  sonnet  |    sonnet     |    sonnet     |
| **대** |   opus    |  opus  |  sonnet  |    sonnet     |     opus      |

executor/code-reviewer는 모든 규모에서 sonnet 고정. 사용자가 명시적으로 모델을 지정하면 라우팅보다 우선.

## 재시도 한도 (필수)

무한 루프 방지를 위해 각 점검 단계에 한도 적용. 한도 초과 시 자동으로 `PHASE_BLOCKED` 처리하여 사용자(team-lead)에게 결정 위임.

| 점검 단계                          | 한도 | 초과 시 동작                                                          |
| ---------------------------------- | ---- | --------------------------------------------------------------------- |
| **critic REVISE**                  | 3회  | `PHASE_BLOCKED: critic REVISE 한도 초과 — team-lead 결정 필요`        |
| **code-reviewer FIX_NEEDED**       | 2회  | `PHASE_BLOCKED: code-reviewer FIX 한도 초과 — 수동 검토 필요`         |
| **docs-verifier UPDATE/VIOLATION** | 2회  | `PHASE_BLOCKED: docs-verifier 한도 초과 — docs/코드 정합성 수동 점검` |

team-lead는 한도 카운터를 메모리(`.omc/state/`)에 기록하여 재실행 시에도 유지.

## 실행 절차

### 1. 팀 생성

```
TeamCreate → team name: plan{N}
```

critic + docs-verifier를 `run_in_background: true`로 스폰. 대기 상태로 준비.

스폰 직후 위 "정식 팀원 스폰 규칙" 의 정적 검증 게이트(`scripts/verify_team_members.sh`)를 실행한다.
`Agent` 단발 호출로 대체하지 않고 정식 멤버로 등록됐는지 config.json 으로 확인하고, 통과해야 2단계로 넘어간다.

### 2. 문서 파악 + 논의

team-lead가 `docs/` 하위 문서를 읽고 사용자와 논의.

### 3. docs 최신화 + 커밋

논의 결과를 task 생성 전에 docs에 반영. docs 변경사항 단독 커밋.

### 4. task 파일 생성

`tasks/{NNN}-{task-name}/` 디렉터리에 `index.json` + `phase-{N}.md` 생성.
phase 프롬프트 규칙은 기존 `plan-and-build`와 동일:

- 원자적 단일 책임, 작업 항목 5개 이하
- 자기완결적 (이전 대화 없이 독립 실행 가능)
- 성공 기준에 모든 작업 검증 포함
- **마지막 phase는 "task 완료 처리" 단계를 포함**
  - status + 모든 phase status 를 `"completed"` 로 업데이트 (executor 수행, team-lead 최종 커밋)

task 파일 생성 후 커밋.

### 5. critic 평가 (통과 조건)

team-lead → critic에게 계획 전송 (SendMessage).

critic 평가 관점:

1. Phase 순서/의존성이 올바른가?
2. 누락된 작업이 있는가?
3. 각 phase의 리스크는?
4. Phase 크기가 5개 이하인가?
5. 성공 기준이 충분한가?
6. **실제 코드와 일치하는가?** (파일 존재, 함수명, 줄 수 검증)
7. **`pitfalls/INDEX.md` plan 카테고리에서 이 plan 의 변경 유형에 해당하는 패턴이 사전 해소되었는가?** (INDEX 라우터로 관련 파일 선택)

판정:

- **APPROVE** → 6단계로
- **REVISE** → 문제점 수정 후 재평가 (5단계 반복, 한도 3회)

### 6. executor 실행

critic APPROVE 후 executor 를 스폰한다. phase 별 spawn-shutdown 사이클 (4 phase 이상) 또는 단일 executor (3 phase 이하) 중 선택.

spawn prompt 표준 · executor 규칙 · shutdown 절차 · phase 별 atomic commit: **references/phase-exec.md**

### 7. 코드 품질 검사 (code-reviewer)

executor 완료 후 code-reviewer 를 새로 스폰하여 SendMessage 로 검사 시작 지시. team-lead 직접 수행 금지.
**사전 해소 점검**: `.claude/skills/_shared/pitfalls/INDEX.md` 의 code-review 카테고리 (단일 소스) 적용 확인 → 미적용 시 FIX_NEEDED (executor 재투입).

code-reviewer spawn 메시지에 **"`.claude/skills/_shared/pitfalls/INDEX.md` 라우터로 이 diff(`git diff origin/main..HEAD`) 의 변경 유형에 해당하는 code-review 패턴 파일만 골라 grep 점검하라. 변경 유형이 표에 없으면 `triggers:` grep, 그래도 애매하면 `pitfalls/code-review/` 디렉터리 통째로 점검하라"** 능동 지시 포함. (전부 읽지 말고 라우터로 선택 — 컨텍스트 절약)

**code-reviewer가 검사할 범위**: executor가 변경한 파일만 (`git diff --name-only` 기준).

> 검사 항목은 인라인하지 않는다 — 단일 소스(`pitfalls/INDEX.md` + 파일 / agent 정의 / planning 영향 표)를 그 단계에서 라우터로 선택해 grep 점검하도록 spawn 메시지로 지시.

판정 + FIX_NEEDED 루프 (자기-면제 금지 포함): **references/review-loops.md**

### 8. docs-verifier 검증 (문서 부패 포함)

executor 완료 후 team-lead → docs-verifier에게 검증 요청.

docs-verifier spawn 지시: **`.claude/agents/docu-parser-docs-verifier.md` 의 6축(부패·과대화·추론성·중복·자명성·가독성) + planning 8단계 D항 영향 표를 단일 소스로 검증**한다. agent 정의가 도메인 검증 항목 전체를 보유하므로 SKILL 은 위임만 한다.

판정 + UPDATE_NEEDED / VIOLATION 루프 (자기-면제 금지 포함): **references/review-loops.md**

### 9. 완료 + PR 생성

1. team-lead 가 누적 commit 검토 — `git log --oneline feat/{plan}..origin/main` 의 역순으로 phase 별 commit 이 의도대로 들어갔는지 확인
   - 마지막 phase commit 에 `index.json` completed 가 포함됐는지 grep 검증
2. 통합 검증 명령 (`{{CI_CMD}}`) 최종 확인 — 모든 phase 누적 후에도 build/test 통과 확인
3. FIX/VIOLATION/UPDATE commit 은 그대로 push (amend 금지). FIX + docs UPDATE 동시 발생 시 한 `fix(<scope>): ...` commit 으로 통합 허용 (PR 본문 명시 권장).
4. `git push origin feat/{plan}` — n 개 commit 일괄 push
5. **PR 생성** — `gh pr create` (main 대상). PR description 에 phase 별 commit 목록 자동 포함 (`gh pr create --body` 안에 `git log --oneline {base}..HEAD` 결과)
   - PR 본문에 **"## 특이사항 및 후속" 섹션** 포함 — 아래 10번 항목의 집계 결과를 기록한다 (없으면 "특이사항 없음" 으로 명시)
6. **index.json 완료 상태는 PR 브랜치에만** — 메인 워킹 디렉토리에서 **건드리지 않는다**:
   - 마지막 phase 커밋에 `status="completed"` 포함 (4단계 참조)
   - main 직접 커밋 **금지** — 이중 진실원 회피, push 혼입 위험, PR 머지로 자동 반영
   - 재실행 방지는 3중 사전 검증 (status + 원격 브랜치 + 오픈 PR)
7. **review 회고 (조건부 필수)** — critic REVISE / FIX_NEEDED / UPDATE_NEEDED 발생 시 트리거. 1-shot 통과 시 skip. 0건이라도 자문 수행.
   - 회고 절차는 출처별 단일 소스를 따른다:
     - **critic** REVISE → `_shared/retros/critic-retro.md`
     - **code-reviewer** FIX → `_shared/retros/code-reviewer-retro.md`
     - **docs-verifier** UPDATE/VIOLATION → `_shared/retros/docs-verifier-retro.md`
   - commit 메시지: `docs(skill): plan{N} 회고 — ...`. 별도 회고 docs 신설 금지.
   - **위치**: worktree 브랜치에서 commit + push → PR 에 자동 포함. main 직접 commit 금지.
8. 팀 shutdown (SendMessage `shutdown_request`)
9. **worktree 정리 (필수)** — PR 머지 전이라도 사이클 종료 시 제거. 정리 명령: **references/preflight.md**
   - 브랜치 원복은 **사용자 판단** — team-lead 자동 전환 금지.
10. **특이사항 집계와 사용자 보고 (필수)** — 각 phase executor 가 보고한 특이사항을 team-lead 가 누적해 작업 종료 시 사용자에게 명시 보고한다. 메인 컨텍스트에만 두고 묻어두지 않는다 — 사용자가 인지하지 못한 채 작업이 종료되면 후속 누락으로 이어진다.
    - 분류 4종으로 나눠 보고한다:
      - **pre-existing** — 이번 변경과 무관하게 원래 있던 문제 (executor 가 작업 중 발견)
      - **신규 deprecation** — 이번 변경이 유발한 라이브러리 경고·예정 폐기
      - **미검증** — 로컬에서 확인 불가해 운영·test-flow 로 넘긴 영역
      - **범위 외 발견** — plan 범위 밖이지만 후속이 필요한 발견
    - 후속 작업이 필요한 항목은 GitHub 이슈 등록을 제안한다.
    - 특이사항이 없으면 "특이사항 없음" 으로 명시 보고한다 (침묵으로 갈음하지 않는다).

## worktree 기반 격리 실행

반드시 git worktree 사용. `.claude/worktrees/` 하위에 생성.
오타 잔재 자동 정리 · 선행 push 체크 · setup 명령 · 정리 명령: **references/preflight.md**

## 프로젝트 환경 가정 (레포별 변형)

이 섹션은 레포별 `skills-variants/{repo}/build-with-teams-env.md`에서 채운다. 포함 항목:

- 패키지 매니저 + 통합 검증 명령
- 빌드/테스트/린트/포맷 명령
- 마이그레이션 도구 + 비대화형 환경 함정
- worktree 직후 필수 setup (의존성 설치, 코드 생성 등)
- 코드 규칙 (`CLAUDE.md` 권위 명시)

executor·code-reviewer에게 프롬프트 전달 시 이 섹션을 참조 또는 요약 인용.

## 실패 복구

executor가 phase 실패 보고 시:

1. team-lead가 실패 원인 분석
2. phase 수정 필요 시 → critic 재평가 (5단계부터)
3. 단순 에러 수정 시 → executor에게 재실행 지시

## 실행 흐름 요약

```
[사전 검증 — main index.json status + 원격 feat 브랜치 + 오픈 PR (3중 체크)]
    → [worktree 생성 (origin/main 기반)]
    → [docs 최신화 + 커밋]
    → [task 파일 생성 + 커밋]  ← 마지막 phase에 index.json completed 업데이트 스텝 포함
    → [critic 평가] ←─ REVISE면 계획 수정 후 재평가 (한도 3회)
    → [executor 실행 phase-1] → [team-lead phase-1 commit] → ... → [phase-N (index.json completed 포함)] → [team-lead phase-N commit]
    → [코드 품질 검사 (task 종료 후 1회)] ←─ FIX_NEEDED면 executor 재투입 (한도 2회) → 추가 fix commit (amend 금지)
    → [docs-verifier 검증 (문서 부패 포함)] ←─ VIOLATION/UPDATE_NEEDED면 재투입 (한도 2회) → 추가 fix commit
    → [team-lead 일괄 push]  ← PR 브랜치에 phase 별 atomic commit + 필요 시 fix commit 누적
    → [PR 생성]  ← main에 별도 커밋 금지
    → [review 회고]  ← critic/code-reviewer/docs-verifier 반복 패턴 → common-pitfalls / code-review-pitfalls / planning docs 영향 표 갱신
    → [worktree 정리 + 팀 shutdown]
    → [특이사항 집계 후 사용자 보고]  ← phase executor 보고의 특이사항 4종 누적 → 사용자 명시 보고와 PR 본문 "특이사항 및 후속" 섹션
```

## vs plan-and-build

|           | plan-and-build             | build-with-teams                 |
| --------- | -------------------------- | -------------------------------- |
| 실행 방식 | `run-phases.py` 백그라운드 | Claude Agent Teams 가시적 협업   |
| 평가 단계 | 없음                       | critic APPROVE 통과 조건         |
| docs 검증 | 없음                       | docs-verifier 자동 검증          |
| 진행 상황 | 로그 파일 확인             | 에이전트 메시지로 실시간 확인    |
| 실패 복구 | `--from-phase` 재시작      | team-lead 판단 → executor 재지시 |
| 적합 규모 | 소·중                      | 중·대                            |

## docu-parser 환경 가정 (프로젝트 변형)

executor / code-reviewer / docs-verifier 프롬프트에 아래 컨텍스트를 함께 전달.

- **패키지 매니저**: `uv` (Python 3.11 venv 격리)
- **빌드 명령**: 빌드 단계 없음 — `DYLD_FALLBACK_LIBRARY_PATH=/opt/homebrew/lib .venv/bin/python -c "import app"` import smoke 로 대체 (Mac 에선 weasyprint 가 brew lib 경로를 못 찾아 dyld 환경변수 필수)
- **테스트 명령**: `DYLD_FALLBACK_LIBRARY_PATH=/opt/homebrew/lib .venv/bin/pytest tests/ -q` (테스트 도입 시점부터)
- **통합 검증 (`{{CI_CMD}}`)**: `DYLD_FALLBACK_LIBRARY_PATH=/opt/homebrew/lib .venv/bin/python -c "import app" && .venv/bin/ruff check . && (DYLD_FALLBACK_LIBRARY_PATH=/opt/homebrew/lib .venv/bin/pytest tests/ -q 2>/dev/null || true)`
- **운영 환경**: NVIDIA Tesla T4 기반 다중 호스트 클러스터 (정확한 호스트 / 워커 수는 시점 따라 바뀜 — 운영 시점 `dooray-cli` 또는 인프라 측 확인). 컨테이너 베이스: `nvidia/cuda:11.8.0-cudnn8-runtime-ubuntu22.04`. 로컬 검증은 Mac Apple Silicon (MPS) 또는 CPU 모드
- **마이그레이션 도구**: 없음 — DB 없음. 환경변수 (예: `MAX_TASKS_PER_WORKER`) 변경은 컨테이너 재배포
- **worktree 직후 setup**: `uv venv .venv --clear --python 3.11 && VIRTUAL_ENV=$(pwd)/.venv uv pip install -r requirements.txt && VIRTUAL_ENV=$(pwd)/.venv uv pip install -e ./nhn_ocr_plugin -e ./docling-paddle-plugin`
- **코드 규칙 권위**: 프로젝트 루트 `CLAUDE.md` (FastAPI async 함정 / OCR 플러그인 분기 / 워커 풀 라이프사이클 / 환경변수 표)
- **메인 브랜치**: `main` (이 파일의 `develop` 참조는 모두 `main` 으로 읽을 것)
- **업무 매핑**: Dooray `AI-TF-VectorSearch` 프로젝트의 업무로 trace. `dooray-cli` 로 생성·조회·갱신. 식별자 통일: 브랜치명 = PR 제목 prefix = `AI-TF-VectorSearch/<N>`. task `index.json` 에 `linked_dooray_task` 필드. PR 본문에 Dooray 업무 딥링크 (`dooray://...`) 포함. 세부 절차는 [`tasks/README.md`](../../../tasks/README.md) 참조
- **초기 GitHub 이슈**: 분석 단계에서 등록된 GitHub 이슈 (#52~#68) 는 임시 자료. 본격 작업 시 Dooray 업무로 이관 후 GitHub 이슈 닫기
