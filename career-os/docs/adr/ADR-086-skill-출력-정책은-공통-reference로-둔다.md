## ADR-086 — skill 출력 정책은 공통 reference로 둔다

- Status: Accepted
- Date: 2026-06-15

### 맥락

ADR-057로 생성 산출물 품질 계약을 전역 기준으로 정했지만,
각 `SKILL.md`가 같은 문장을 반복해서 품고 있었다.
이 구조는 Codex skill의 progressive disclosure 원칙과 맞지 않는다.
또 skill마다 공개 발행, 제출 자동화, 내부 경로 노출 금지의 표현이 조금씩 달라질 수 있어 정책 drift가 생기기 쉽다.

### 결정

- 공통 출력 정책은 `career-os/.claude/skills/_shared/references/output-policy.md`에 단일 출처로 둔다.
- 각 대상 skill의 `references/output-policy.md`는 공통 정책 파일을 가리키는 심볼릭 링크로 둔다.
- 각 skill의 `SKILL.md` 본문은 `references/output-policy.md`를 먼저 읽으라고 안내하고, skill 고유 차이만 짧게 남긴다.
- 공개 산출물은 `[초안]` 상태를 기본으로 두고, 공개 발행과 commit/push는 사용자 명시 승인 뒤에만 수행한다.
- 비공개 산출물은 근거 경로와 리스크 판단을 유지하되, 외부 제출용 문장과 Discord 요약에는 내부 맥락을 섞지 않는다.
- `docs-audit`처럼 외부 repo skill로 향하는 심볼릭 링크는 이번 정책 공통화 대상에서 제외한다.

### 결과

- Codex가 skill 본문을 읽을 때 반복 정책보다 실제 workflow에 더 많은 컨텍스트를 쓸 수 있다.
- Claude와 Codex가 같은 공통 출력 정책을 공유한다.
- ADR-005의 즉시 발행 관성은 폐기되고, 공개 발행은 사용자 승인 뒤에만 진행한다.
- 이후 새 career-os skill은 공통 출력 정책을 참조하고, skill 고유 제약만 본문에 추가하면 된다.
