# build-with-teams 오버레이

공용 `build-with-teams` 계약에 이 저장소의 실행 경계만 추가한다.

## 역할 선택

- `career-os` 구현에는 `.claude/agents/career-os-executor.md`의 경계를 적용한다.
- `career-os` 문서 검증에는 `.claude/agents/career-os-docs-verifier.md`의 읽기 전용 경계를 적용한다.
- 다른 워크스페이스는 설치된 범용 `executor`, `code-reviewer`, `verifier` 역할을 사용하고 해당 워크스페이스 `AGENTS.md`를 우선한다.
- 역할 이름은 현재 실행 환경이 제공하는 이름으로 해석한다. 과거 플러그인의 정규화된 역할 이름을 문서에 고정하지 않는다.

Codex에서 실행할 때는 공용 스킬이 지정한 executor 실행 형태 판정 검사를 `critic` 평가 전과 실행 역할 생성 직전에 통과시킨다.

## 검증과 책임

- 검증 명령은 해당 워크스페이스의 `AGENTS.md`, `README.md`, 변경한 스킬의 검증 절을 따른다.
- 문서가 명령을 제공하지 않으면 변경 동작을 증명하는 가장 작은 테스트를 선택하고 검증 공백을 보고한다.
- 구현 역할은 commit과 push를 하지 않는다. 통합과 Git 상태 변경은 리더가 맡는다.
- 검토 역할은 읽기 전용으로 실행하며 수정과 Git 상태 변경을 허용하지 않는다.

task 형식과 plan 번호 규칙은 공용 `planning` 계약과 `.claude/planning-overlay.md`를 단일 출처로 사용한다.
