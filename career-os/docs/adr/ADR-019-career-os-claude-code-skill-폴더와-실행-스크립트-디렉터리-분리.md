## ADR-019 — career-os: Claude Code skill 폴더와 실행 스크립트 디렉터리 분리

- Status: Accepted
- Date: 2026-05-14

### 맥락
skills/<name>/scripts/에 Claude 컨텍스트 자산(SKILL.md·references)과 운영 실행 파일(runner·extractor)이 혼재. skill 로드 시 실행 스크립트가 같이 들어와 토큰 낭비. 새 자산 위치를 매번 판단해야 함.

### 결정
- career-os 한정: career-os/scripts/<skill-name>/에 모든 실행 파일 이동. skills/<skill-name>/은 SKILL.md + references/ 만 유지.
- skill 이름과 scripts/ 서브 디렉터리 이름은 1:1 매칭.
- depends_on: plan005(skill 구조 확정 후 일관된 이전 가능).

거절 대안: scripts/ 평면 구조(이름 충돌·추적 어려움), ai-nodes 전체 변경(워크스페이스 격리 원칙 위배), references/ 분리(Claude 컨텍스트 자산은 skill 안이 자연스러움).

### 결과
- skill 디렉터리가 SKILL.md + references/ 만 남아 Claude 컨텍스트 로드 효율 상승.
- 운영 자산이 scripts/<name>/에 집중 → 위치 명확.
- ai-nodes 다른 워크스페이스는 기존 skills/<name>/scripts/ 패턴 유지(의도된 비대칭).

### 적용
- tasks/plan006-workspace-scripts-restructure/ 참조.
- docs/code-architecture.md "디렉터리 책임" 섹션.
- ai-nodes/CLAUDE.md 워크스페이스 컨벤션 문단은 career-os만 새 구조로 갱신.
