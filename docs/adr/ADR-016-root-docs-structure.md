## ADR-016 — root docs 구조를 ADR 디렉터리와 code-architecture로 재편

- Status: Accepted
- Date: 2026-06-17

### 맥락

root `AGENTS.md`, `docs/workspace-structure.md`, `docs/adr.md`, `README.md`가 구조 설명과 과거 실행 이력을 중복해서 담고 있었다.
그 결과 에이전트가 현재 행동 계약과 과거 기록을 함께 읽어야 했고, 토큰 비용과 drift 위험이 커졌다.

### 결정

root 문서 책임을 아래처럼 나눈다.

- `AGENTS.md`는 행동 규칙과 문서 라우팅만 담는다.
- `docs/code-architecture.md`는 현행 구조와 새 워크스페이스 추가 절차의 단일 출처다.
- `docs/adr/`는 모노레포 결정의 이유와 대안 기각을 개별 파일로 보존한다.
- `docs/learn/`은 제거한다.
  재사용 가능한 회고는 ADR, skill, AGENTS 중 책임 문서에 직접 흡수한다.

### 결과

root docs를 읽는 에이전트는 먼저 현재 구조와 현재 행동 규칙을 확인하고, 필요할 때만 ADR을 좁혀 읽는다.
과거 실행 경로나 삭제된 패턴은 AGENTS와 README에 반복하지 않는다.

### 적용

- `AGENTS.md`
- `README.md`
- `docs/code-architecture.md`
- `docs/adr/INDEX.md`
- `.claude/skills/docs-check/SKILL.md`
