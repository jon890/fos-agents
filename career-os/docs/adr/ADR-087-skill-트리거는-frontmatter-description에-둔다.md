## ADR-087 — skill 트리거는 frontmatter description에 둔다

- Status: Accepted
- Date: 2026-06-16

### 맥락

Codex skill은 `SKILL.md` 본문을 읽기 전에 frontmatter의 `name`과 `description`만 보고 skill 사용 여부를 판단한다.
따라서 본문 `When to use` 섹션에 자연어 트리거를 많이 적어도 실제 호출 정확도에는 도움이 작다.

career-os skill들은 Claude native skill 시절의 관성으로 본문 `When to use`에 트리거 목록을 반복해서 담고 있었다.
이 구조는 Codex 호출 입장에서 중요한 라우팅 신호를 늦게 제공한다.

### 결정

- skill 사용 여부를 결정하는 자연어 트리거, 슬래시 호출 형태, 주요 라우팅 경계는 frontmatter `description`에 둔다.
- 본문 `When to use` 섹션은 제거한다.
- 호출된 뒤 필요한 세부 판단은 `호출 후 입력 해석`, `호출 후 모드 해석`, `호출 후 범위 해석` 같은 실행 기준으로 남긴다.
- `description`에는 해당 skill이 하지 않는 주요 금지 경계도 짧게 포함한다.
  예: 공개 발행 금지, 실제 제출 금지, 자동 config 수정 금지.
- 새 career-os skill을 만들 때도 `description`을 1차 트리거 표면으로 보고 작성한다.

### 결과

- Codex가 본문을 열기 전에 더 정확하게 career-os skill을 선택할 수 있다.
- 본문은 이미 호출된 뒤의 실행 절차와 입력 해석에 집중한다.
- Claude와 Codex가 같은 skill 본문을 공유하면서도 Codex의 progressive disclosure 원칙을 더 잘 따른다.
