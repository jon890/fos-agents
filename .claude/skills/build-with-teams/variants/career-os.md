# build-with-teams variant: career-os

career-os 워크스페이스의 환경 가정·브랜치 컨벤션·검증 명령이다.
SKILL.md 본문의 일반 규칙에 더하며, 충돌하면 이 variant가 우선한다.

## 전용 agent

build-with-teams 파이프라인이 career-os 작업에서 쓰는 전용 agent다.

- executor: `career-os-executor` (`.claude/agents/career-os-executor.md`)
- docs-verifier: `career-os-docs-verifier` (`.claude/agents/career-os-docs-verifier.md`)

critic·code-reviewer는 공용 agent(`oh-my-claudecode:critic`, `oh-my-claudecode:code-reviewer`)를 쓴다.

## 브랜치 컨벤션

career-os는 GitHub PR 기반이다.
dooray 같은 외부 업무 매핑이 없다.

- 신규 브랜치는 `<type>/{plan}` 또는 `refactor/plan{N}-<slug>` 형태로 만든다.
- 다른 세션 동시 작업이 흔하므로 worktree 분리를 기본값으로 둔다.
- worktree 루트는 `fos-agents-worktrees/<plan>`을 쓴다.
- 본문 일반 규칙의 dooray 브랜치 자동 스캔은 career-os에 적용하지 않는다.
- SKILL.md의 `feat/{plan}` 표현은 위 브랜치 규칙으로 읽는다.

## 패키지 매니저와 런타임

- TypeScript: bun으로 실행한다. 스키마 검증은 zod를 쓴다.
- Python: python3로 수집기 계열 스크립트를 실행한다.
- career-os에는 별도 빌드 단계가 없다.

## 통합 검증 (`{{CI_CMD}}`)

변경 영역에 맞춰 다음을 조합한다.

- 변경한 스크립트 실행: `bun <변경 스크립트.ts>`
- 변경한 TypeScript 타입 검사: `bun --check <변경.ts>`
- Python 수집기를 바꿨으면 `python3 <변경.py>`로 import·실행 smoke를 확인한다.

빌드·번들 단계가 없으므로 실행 smoke와 `bun --check`가 통합 검증을 대신한다.

## worktree 직후 setup

ai-nodes 루트에서 `bun install`을 1회 수행한다.
이미 설치돼 있으면 생략한다.
career-os는 venv·코드 생성 같은 추가 setup이 없다.

## 코드 규칙 권위

- 워크스페이스 규칙: `career-os/AGENTS.md`
- 상세 사양: `career-os/docs/`의 5문서(`prd.md`·`data-schema.md`·`flow.md`·`code-architecture.md`·`adr/`)

executor·code-reviewer 프롬프트에는 위 권위 문서를 참조로 인용한다.

## PR 제목

conventional commit과 한글 subject를 쓴다.

- 형식: `<type>(career-os): <한글 subject>`
- `type`은 `feat`·`fix`·`docs`·`refactor`·`test`·`chore` 등을 쓴다.

## 번호 충돌 주의 (실측 함정)

ADR 번호와 plan 번호는 다른 세션이 먼저 선점할 수 있다.
새 번호를 만들기 전에 `origin/main`과 원격 브랜치를 스캔해 충돌을 피한다.

```bash
git fetch origin --quiet
# 사용 중인 ADR 번호
git grep -hoE 'ADR-[0-9]+' origin/main -- career-os/docs/adr/ | sort -u | tail
# 원격 브랜치의 plan 디렉터리
git ls-remote --heads origin | awk '{print $2}'
```

실측 충돌 사례: plan088, ADR-096이 다른 세션과 겹친 적이 있다.
번호를 확정하기 전에 반드시 스캔한다.
