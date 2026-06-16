## ADR-085 — career-os skill을 Codex에 심볼릭 링크로 노출한다

- Status: Accepted
- Date: 2026-06-15

### 맥락

career-os의 주요 자동화는 `career-os/.claude/skills/<skill>/SKILL.md`에 정리되어 있다.
기존 운영 문서는 `claude -p "/<skill>"` 호출을 표준으로 두었지만, Claude CLI 호출 비용 때문에 같은 흐름을 Codex에서도 직접 실행할 필요가 생겼다.

단순 wrapper로 `claude -p`를 호출하면 비용 문제가 해결되지 않는다.
또 `.claude/skills`와 `.codex/skills`에 본문을 복사하면 같은 workflow가 두 곳에서 갈라질 위험이 크다.

### 결정

- `career-os/.claude/skills/<skill>/SKILL.md`를 agent skill 정본으로 유지한다.
- Claude 전용 표현은 현재 에이전트가 직접 파일을 읽고 쓰며 셸 명령을 실행하는 표현으로 바꾼다.
- Codex 노출 경로는 `career-os/.codex/skills/<skill>` 심볼릭 링크로 둔다.
- 이번 연결 대상은 실제 `SKILL.md` 본문이 저장소 안에 있는 10개 skill이다.
  - `application-package-writer`
  - `application-reviewer`
  - `candidate-baseline-suggester`
  - `daily-application-digest`
  - `interview-asset-writer`
  - `interview-prep-analyzer`
  - `position-recommender`
  - `question-bank-collector`
  - `study-pack-writer`
  - `study-topic-recommender`
- `docs-audit`는 `sources/fos-study` 외부 repo로 향하는 기존 심볼릭 링크이므로 이번 Codex 링크 대상에서 제외한다.
  fos-study checkout이 있는 실행 환경에서 별도 검토한다.
- 기존 cron/runner 파일명에 남은 `claude`는 호환 계층 이름으로만 본다.
  새 대화형 작업에서는 Claude CLI wrapper를 추가하지 않는다.

### 결과

- Codex가 career-os skill 흐름을 같은 본문으로 읽고 실행할 수 있다.
- skill 본문 정본이 하나라서 Claude/Codex 간 drift가 줄어든다.
- Claude CLI 비용 문제를 wrapper 없이 회피한다.
- `.codex/skills` 링크가 깨지는지 검증하면 Codex 노출 상태를 빠르게 확인할 수 있다.
- 단점은 `.claude/skills`라는 디렉터리 이름이 historical name으로 남는다는 점이다.
  문서에서는 agent skill 정본으로 해석한다.

### 적용

- `career-os/.claude/skills/*/SKILL.md`
- `career-os/.codex/skills/`
- `career-os/AGENTS.md`
- `career-os/docs/code-architecture.md`
