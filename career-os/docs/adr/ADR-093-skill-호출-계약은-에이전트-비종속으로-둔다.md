## ADR-093 — skill 호출 계약은 에이전트 비종속으로 둔다

- Status: Accepted
- Date: 2026-06-17

### 맥락

ADR-085로 `career-os/.claude/skills`를 정본으로 두고 `career-os/.codex/skills`는 심볼릭 링크로 노출했다.
그러나 일부 문서, runner, application-agent 계약은 여전히 특정 에이전트 CLI 호출 문자열을 표준 진입점처럼 노출했다.
그 결과 Codex, Claude, 다른 에이전트가 같은 SKILL.md 흐름을 직접 수행할 수 있어도 사용자-facing 제안은 특정 CLI에 묶여 보였다.

### 결정

- SKILL.md가 workflow 정본이다.
- 사용자-facing 제안은 `Use skill: /<skill-name> [args]` 형태로 둔다.
- 특정 에이전트 CLI는 무인 실행을 위한 compatibility backend로만 둔다.
- `scripts/application-agent/skill_contracts.ts`는 CLI 문자열이 아니라 다음 계약을 가진다.
  - skill 이름
  - slash command
  - 인자 template
  - local script 여부
  - compatibility backend 권한 mode
  - 기대 산출물
  - 사용자 승인 필요 여부
- `application-agent`의 기본 command suggestion은 에이전트 비종속 표현을 사용한다.
- `--execute-skills`처럼 runner가 실제로 작업을 실행해야 하는 경우에만 compatibility backend를 선택한다.
- `career-os/TOOLS.md`는 자동 로드 지시 파일이 아니고 정보가 중복되므로 제거한다.
  현재 타깃은 `docs/prd.md`와 `config/mvp-target.json`, 호출 정책은 `AGENTS.md`와 본 ADR을 따른다.
- 제거된 `interview-prep-analyzer` 계약은 되살리지 않는다.
  현재 면접 준비 흐름은 `job-fit-analyzer`, `interview-stage-prep`, `tech-interview-drill`, `behavioral-interview-drill`로 나뉜다.

### 거절한 대안

- 모든 runner를 즉시 제거한다.
  cron과 무인 실행 경로가 남아 있어 호환 계층은 필요하다.
- SKILL.md를 에이전트별로 복사한다.
  같은 workflow가 갈라져 drift가 생긴다.
- 사용자-facing 안내에 특정 CLI 명령을 계속 노출한다.
  실제 정본이 SKILL.md라는 정책과 충돌한다.

### 결과

- Codex, Claude, 다른 에이전트가 같은 SKILL.md를 읽고 같은 workflow를 수행할 수 있다.
- application-agent 산출물과 리포트는 특정 CLI 대신 skill 이름을 안내한다.
- compatibility backend는 구현 세부사항으로 격리된다.
- `TOOLS.md`에 분산됐던 메모가 정본 문서로 흡수되어 지시 파일 탐색이 단순해진다.
- 새 스킬을 추가할 때는 SKILL.md와 `skill_contracts.ts` 계약을 함께 맞춰야 한다.
