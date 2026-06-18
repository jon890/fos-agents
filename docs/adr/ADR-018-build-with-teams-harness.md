## ADR-018 — build-with-teams 하네스 도입 (Agent Teams 가시 협업, plan-and-build 병존)

- Status: Accepted
- Date: 2026-06-18

### 맥락

현재 모노레포의 구현 실행은 `plan-and-build`(`run-phases.py`) 하나다.
이것은 **외부 `claude --print` 프로세스**를 phase마다 띄워 순차 실행한다.

이 방식의 한계가 실측으로 드러났다(plan089 question-bank 1원화).

- **블랙박스** — 메인 세션에서 진행이 보이지 않는다. stdout 로그 파일만 남는다.
- **취약성** — phase-01이 `Request timed out` 한 번에 전체가 실패했다(단일 요청 타임아웃).
- **검증 부재** — 작성과 검증이 분리되지 않는다. code-reviewer를 사람이 수동으로 끼워야 했다.

사용자의 다른 레포(docu-parser, nhncloud-cli, fos-blog)에는 이미 **build-with-teams** 하네스가 정립돼 있다.
Claude Agent Teams로 team-lead·critic·executor·docs-verifier가 **메인 세션 안에서 가시적으로 협업**한다.
docu-parser가 가장 발전된 정본(SKILL.md + references 4개 + 전용 agent + pitfalls wiki)이다.

### 결정

- `build-with-teams` skill을 **모노레포 공용**(`.claude/skills/build-with-teams/`)으로 도입한다.
  `plan-and-build`와 같은 공용 위치다.
- 팀은 5역할로 구성한다.
  - team-lead — 메인 세션(계획·조율·phase별 atomic commit·PR)
  - critic — `oh-my-claudecode:critic`(계획 평가 APPROVE/REVISE)
  - executor — 워크스페이스 전용 agent(코드 작성, commit 제외)
  - code-reviewer — `oh-my-claudecode:code-reviewer`(코드 품질)
  - docs-verifier — 워크스페이스 전용 agent(코드↔docs 정합)
- **전용 도메인 agent**를 워크스페이스별로 둔다(`.claude/agents/<workspace>-{executor,docs-verifier}.md`).
  career-os부터 만든다. 도메인 지식(ADR 개별파일·docs 5문서·fos-study 경계·bun/zod·워크스페이스 격리)을 프롬프트에 내장한다.
  검증 agent는 Write/Edit를 막아 read-only로 강제한다(자기승인 구조적 금지).
- **pitfalls wiki를 재사용**한다. ADR-017이 도입한 파일-per-패턴 + INDEX 구조를 build-with-teams의 critic·code-reviewer·docs-verifier가 라우터로 참조한다.
- **환경 가정은 워크스페이스별 variant**로 분리한다(패키지 매니저·검증 명령·setup). docu-parser의 `uv`/python 전용 규칙은 가져오지 않는다.
- **plan-and-build와 병존**한다.
  - 대화형·가시성이 필요한 작업 → build-with-teams.
  - 무인 cron/background 실행 → plan-and-build.
- 모델 라우팅은 규모 기반이다(소: 전원 sonnet / 중: critic opus / 대: team-lead·critic·docs-verifier opus).
- 재시도 한도(critic 3 / code-reviewer 2 / docs-verifier 2) 초과 시 PHASE_BLOCKED로 사람에 위임한다.

### 결과

- 구현 진행이 메인 세션에서 보인다. 블랙박스가 사라진다.
- 작성(executor)과 검증(critic·code-reviewer·docs-verifier)이 구조적으로 분리되고 자기-면제가 금지된다.
- 단일 요청 타임아웃이 phase 전체를 죽이지 않는다(팀원 단위 재시도·spawn-shutdown).
- 도메인 지식이 전용 agent에 단일 소스로 모여 drift가 줄어든다.
- plan-and-build는 무인 실행 경로로 유지돼 두 방식이 용도별로 공존한다.
- 본 ADR은 docu-parser 정본을 모노레포 공용으로 일반화한 것이다. 레포 고유 부분(dooray 매핑·python 환경)은 제외하고 워크스페이스 variant로 채운다.
