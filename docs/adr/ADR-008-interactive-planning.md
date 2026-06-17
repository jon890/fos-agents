## ADR-008 — planning은 대화형 합의, Claude 비대화형은 구현 전용

- Status: Accepted
- Date: 2026-05-26

### 맥락

career-os application-flow-agent 계획 중 `claude -p "/planning ..."` 비대화형 실행을 시도했지만, 복잡한 설계 결정과 사용자 선호를 제대로 반영하기 어려웠다. planning은 자율성 수준, 외부 제출 경계, public/private 경계, 상태 전이 책임처럼 대화 중 확인해야 할 결정이 많다.

반대로 합의된 task/phase 구현은 Claude 비대화형 실행이 유용하다. 구현 지시서가 충분히 구체적이면 Claude가 파일 작성과 반복 작업을 처리하고, Codex가 결과를 검토·검증하는 구조가 맞다.

### 결정

- 모든 ai-nodes 워크스페이스에서 planning은 Codex와 사용자의 대화형 합의를 기본으로 한다.
- planning skill은 비대화형 명령이 아니라 다음 구조를 잡는 프레임으로 사용한다.
  - 목표 재정의
  - 3-5개 phase
  - 열린 결정
  - 추천 기본값
  - 다음 액션
- `claude -p "/planning ..."` 비대화형 planning은 기본 사용하지 않는다.
- Claude 비대화형 실행은 합의된 task/phase의 구현에만 사용한다.
- Codex는 planning brief 작성, 결정사항 기록, task 파일 고정, Claude 구현 결과 review, 검증, 의도한 변경만 commit/push하는 책임을 가진다.

거절한 대안:

- Claude 비대화형 planning 계속 사용 — 중요한 애매함과 사용자 선호를 놓칠 위험이 큼.
- 모든 구현도 Codex가 직접 수행 — 긴 문서 작성/반복 구현에서 Claude native skill의 장점을 버림.

### 결과

- planning 단계에서 사용자 승인과 열린 결정이 명시된다.
- 구현 단계에서는 Claude 비대화형 실행을 계속 활용할 수 있다.
- Codex가 최종 품질 게이트와 git 변경 범위를 책임진다.

### 적용

- `ai-nodes/AGENTS.md` planning / implementation 위임 원칙.
- `docs/workspace-structure.md` tasks/plan 컨벤션.
- 워크스페이스별 AGENTS.md가 별도 정책을 가진 경우 본 ADR을 상위 기본값으로 참조한다.

---
