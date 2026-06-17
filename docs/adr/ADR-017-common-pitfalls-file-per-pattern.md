## ADR-017 — common-pitfalls file-per-pattern 구조

- Status: Accepted
- Date: 2026-06-17

### 맥락

`plan-and-build`와 `planning`은 반복 실패를 줄이기 위해 `common-pitfalls.md`를 self-check 문서로 사용해 왔다.
하지만 단일 파일이 두꺼워지면서 모든 작업자가 전체 함정 목록을 읽는 구조가 되었다.
이는 progressive disclosure 원칙과 어긋나고, 실제 작업과 무관한 항목까지 context에 들어오게 만든다.

brain에 기록된 pitfalls 구조 결정은 반대 방향을 권한다.
패턴 1개를 파일 1개로 두고, `INDEX.md`는 router로만 사용한다.
ADR 개별 파일 구조도 이 pitfalls 패턴에서 검증된 file-per-item 방식을 이식한 사례다.

### 결정

- `common-pitfalls.md` 단일 본문을 `common-pitfalls/` 디렉터리로 분리한다.
- `INDEX.md`는 ID, category, trigger, file, 핵심 self-check를 담는 router가 된다.
- 각 pattern file은 frontmatter와 `증상`, `왜`, `Self-check` 섹션을 가진다.
- 새 작업자는 `INDEX.md`를 먼저 읽고 현재 작업과 관련된 pattern file만 추가로 읽는다.
- 어떤 항목이 필요한지 모호하면 해당 category 디렉터리 전체를 확인한다.
- 기존 참조 호환을 위해 `common-pitfalls.md`는 짧은 shim으로 유지한다.

거절한 대안:

- 단일 `common-pitfalls.md` 유지.
  항목이 늘어날수록 모든 task 작성자가 무관한 패턴까지 읽게 된다.
- 모든 pattern을 task template에 inline.
  `planning`과 `plan-and-build` 본문이 비대해지고, reference 파일의 선택적 로딩 장점이 사라진다.

### 결과

- agent는 현재 작업과 관련된 실패 패턴만 읽을 수 있다.
- 새 pattern 추가 시 본문 충돌 가능성이 낮아진다.
- 기존 task와 과거 문서의 `common-pitfalls.md` 참조는 shim으로 깨지지 않는다.
- `planning`과 `plan-and-build`는 전체 파일 self-check 대신 INDEX 기반 선택적 self-check를 사용해야 한다.

### 적용

- `.claude/skills/plan-and-build/references/common-pitfalls/`
- `.claude/skills/plan-and-build/references/common-pitfalls.md`
- `.claude/skills/planning/SKILL.md`
- `.claude/skills/planning/task-create.md`
- `.claude/skills/plan-and-build/SKILL.md`
