## ADR-005 — docs / ADR 작성 형식 6 패턴 + 한자어 회피

**Status**: Accepted
**Date**: 2026-05-19

### 맥락

dooray-cli repo 가 "docs / ADR 작성 형식" 섹션에서 6 가지 가독성 + 토큰 효율 패턴을 정립.
ai-nodes 의 기존 docs / CLAUDE.md / SKILL.md 측정 결과 200자 초과 라인이 모노레포 레벨 4 파일에서 86건, section mark 12건.
글로벌 `~/.claude/CLAUDE.md` `documentation_style` 은 section mark 미사용 정도만 강제 — 형식 정책은 부재.
AI 에이전트 컨텍스트 비용을 늘리지 않으면서 작성자 가독성도 보장하는 단일 형식 정책 필요.

### 결정

dooray-cli mirror 정책을 ai-nodes 에 도입.
단일 출처는 `ai-nodes/docs/docs-style.md`.

핵심 6 패턴:

- semantic line break — 문장당 1줄
- enumerated inline 금지 — `①②③` / `1) 2) 3)` / 슬래시 3개 이상은 bullet
- 괄호 중첩 2겹 이상 금지 — 단락 또는 bullet 분리로 평탄화
- `=` / `→` 동치·인과 압축 한 단락 1회만
- 80자 초과 + 백틱 3개 이상 또는 괄호 다수면 의미 단위 분할
- 한 bullet 다중 속성 sub-bullet 분리

부가 정책:

- 한국어 어색한 한자어 회피 표 (매트릭스 / 트리아지 / 베이스라인 / 스파이크 / 게이트 / 사전 소진 / 단일 진실원 등)
- 거울 구조 원칙 — 같은 정의를 두 docs 본문에 X, 단일 소스 + 역참조

적용 범위: CLAUDE.md / 5문서 / AGENTS.md / SKILL.md / references / tasks / README.

**거절한 대안**:

- 각 워크스페이스가 자기 형식 정책 운영 — 4 워크스페이스 drift 위험.
- 글로벌 `~/.claude/CLAUDE.md` 에 직접 추가 — 다른 프로젝트와 무관한 ai-nodes 한정 정책이라 글로벌 오염.
- CLAUDE.md inline 으로 직접 포함 — 토큰 비용 ↑, 워크스페이스 단위 결정도 inline 누적 중이라 더 비대화 위험.

### 결과

- 새 docs / SKILL.md / phase 작성 시 본 정책 준수.
- 기존 위반 (모노레포 4 파일 ~39건) 정정은 본 plan 에 포함.
- 워크스페이스 docs 위반 정정은 별도 후속 plan.
- 글로벌 `~/.claude/CLAUDE.md` `documentation_style` 은 그대로 유지 — 영역 다름 (글로벌 = 모든 프로젝트 공통, ai-nodes/docs/docs-style.md = ai-nodes 한정).

### 적용

- `ai-nodes/docs/docs-style.md` (신설, 본 ADR 의 단일 출처)
- `ai-nodes/CLAUDE.md` 1번 또는 라우팅 섹션에 docs-style.md 링크
- `ai-nodes/docs/workspace-structure.md` 워크스페이스 docs 표준에 docs-style.md 등록
- `skills/planning/SKILL.md` 5문서 공통 작성 원칙에서 docs-style.md 참조 (단일 소스 cross-link)

---
