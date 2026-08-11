## ADR-013 — agent skill 정본과 실행 도구별 노출 경로를 분리한다

- Status: Accepted
- Date: 2026-06-16

### 맥락

같은 workflow를 여러 agent에서 사용하려고 SKILL.md를 복사하면 내용이 갈라진다.
실행 도구가 탐색하는 경로는 서로 다르므로 정본과 노출 경로를 구분해야 한다.

### 결정

- 워크스페이스 skill 정본은 `<workspace>/.claude/skills/<skill>/`에 둔다.
- 필요한 경우 `<workspace>/.codex/skills/<skill>` 심볼릭 링크로 Codex에 노출한다.
- Codex 전용 저장소 workflow는 `.agents/skills/<skill>/`에 둘 수 있다.
- compatibility 경로는 정본으로 취급하지 않는다.
- trigger와 라우팅 정보는 SKILL.md frontmatter description에 둔다.

### 거절한 대안

- 도구별로 SKILL.md를 복사하면 수정 누락과 동작 차이가 생긴다.
- 모든 skill을 한 전역 디렉터리에 두면 워크스페이스 데이터 경계가 흐려진다.

### 결과

workflow 본문은 한 곳에서 관리하면서 필요한 실행 도구에만 노출할 수 있다.
