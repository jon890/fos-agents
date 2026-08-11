## ADR-006 — skill 문서와 실행 코드는 분리한다

- Status: Accepted
- Date: 2026-05-19

### 맥락

SKILL.md와 실행 코드를 한 디렉터리에 섞으면 agent가 읽는 문맥과 runtime 자산의 책임이 불분명해진다.

### 결정

- agent가 읽는 workflow는 `<workspace>/.claude/skills/<name>/`에 둔다.
- 실행 코드는 `<workspace>/scripts/<name>/`에 둔다.
- reference는 해당 skill 디렉터리에 두고 runtime 데이터는 넣지 않는다.
- 실행 코드가 없는 문서형 skill은 skill 디렉터리만 둘 수 있다.

### 거절한 대안

- skill과 script를 한 디렉터리에 두면 배포와 문맥 로딩 경계가 섞인다.
- 빈 script 디렉터리를 미리 만들면 실제 책임이 없는 구조가 생긴다.

### 결과

skill은 workflow 계약을, script는 실행 구현을 담당한다.
워크스페이스는 필요한 쪽만 선택해 유지할 수 있다.
