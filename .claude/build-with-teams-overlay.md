# build-with-teams 오버레이

공용 `build-with-teams` 계약에 이 저장소의 실행 경계만 추가한다.

## 역할 선택

- 네 역할 모두 공용 `build-with-teams`의 `references/role-*.md`를 그대로 사용한다. 저장소 전용 역할 정의를 따로 두지 않는다.
- 역할이 지켜야 할 워크스페이스 경계는 해당 워크스페이스의 `AGENTS.md`와 아래 「career-os 경계」가 소유한다.
- 역할 이름은 현재 실행 환경이 제공하는 이름으로 해석한다. 과거 플러그인의 정규화된 역할 이름을 문서에 고정하지 않는다.

Codex에서 실행할 때는 공용 스킬이 지정한 executor 실행 형태 판정 검사를 `critic` 평가 전과 실행 역할 생성 직전에 통과시킨다.

## career-os 경계

`career-os`를 구현하거나 검증하는 역할은 아래를 지킨다.
공용 role 문서가 정한 테스트 기준, 중단 조건과 회신 형식은 그대로 따르고 여기서 다시 정하지 않는다.

- `career-os/applications/`, `career-os/library/`와 `career-os/state/`는 홈서버와 동기화되는 비공개 작업본이다. 이 셋 안의 파일을 읽거나 고치기 전에 `career-os/docs/flow.md`의 「skill이 실행하는 명령」을 실행하고, 마친 뒤 같은 skill 이름으로 완료 단계를 실행한다.
- 동기화를 건너뛰고 고치면 홈서버 판과 어긋나 다음 실행이 `WORKSPACE_DIRTY`로 막힌다. begin이 실패하면 기존 로컬 파일로 작업을 계속하지 않는다.
- `career-os/sources/fos-study/`는 별도 공개 저장소이므로 수정하지 않는다. 그 안에 민감 정보나 내부 정보가 들어가면 검증에서 실패로 판정한다.
- 비공개 작업 자료의 디렉터리 경계는 `career-os/docs/data-schema.md`가 소유한다. 경로 목록을 다른 문서에 복제하지 않는다.
- 스킬 변경의 검증 명령은 `bun test ./career-os/.claude/skills/`다.

## 검증과 책임

- 검증 명령은 해당 워크스페이스의 `AGENTS.md`, `README.md`, 변경한 스킬의 검증 절을 따른다.
- 문서가 명령을 제공하지 않으면 변경 동작을 증명하는 가장 작은 테스트를 선택하고 검증 공백을 보고한다.
- 구현 역할은 commit과 push를 하지 않는다. 통합과 Git 상태 변경은 리더가 맡는다.
- 검토 역할은 읽기 전용으로 실행하며 수정과 Git 상태 변경을 허용하지 않는다.

task 형식과 plan 번호 규칙은 공용 `planning` 계약과 `.claude/planning-overlay.md`를 단일 출처로 사용한다.
