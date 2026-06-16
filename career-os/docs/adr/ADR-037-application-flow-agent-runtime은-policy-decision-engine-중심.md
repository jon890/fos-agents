## ADR-037 — application-flow-agent runtime은 policy decision engine 중심

- Status: Accepted
- Date: 2026-05-26

### 맥락

공고별 지원 패키지 작성, evidence/drift review, daily digest까지 구현했지만 다음 행동을 스스로 결정하는 runtime이 없었다.
"적절한 공고 없음 → 더 찾기 또는 다음 주 재시도", "쿨다운/중복/마감 → block/close", "review revise → agent 수정 또는 evidence 수집" 같은 상태 기반 분기가 skill 호출 순서에 흩어지는 문제가 있었다.

[[ADR-035]]에서 plan031을 예시로 적었으나 실제 디렉터리가 존재하지 않았다.
이 ADR에서 plan031을 application-flow-agent에 배정하고 ADR-035의 해당 항목은 미실행 예시로만 취급한다.

### 결정

- application-flow-agent는 단순 skill chain이 아니라 `state → policy decision → action → validation → state update` 루프로 설계한다.
- 상태 전이 허용 여부와 next action 선택은 TypeScript `policy.ts` + validator가 결정하고, LLM은 분석·작성·추천 근거 생성을 맡는다.
  이유: 상태 전이 책임이 코드에 있어야 실행 결과를 코드 수준에서 검증할 수 있다.
- 실제 제출, 외부 사이트 입력/전송, 계정 로그인, 공개 fos-study 발행, 원본 candidate-profile 수정은 사용자 승인 없이 수행하지 않는다.
- submission assistant는 제출 링크와 체크리스트까지만 생성한다. 브라우저 입력 자동화는 후속 plan/ADR로 분리한다.

### 거절한 대안

- LLM이 상태 전이를 직접 결정하는 방식: LLM의 할루시네이션이나 컨텍스트 누락으로 잘못된 전이가 발생해도 코드 수준에서 차단하기 어렵다.

### 결과

- 상태 분기를 코드 policy로 검증할 수 있다.
- public/private boundary와 제출 승인 게이트가 TypeScript `actions.ts` allowlist에서 통제된다.
- plan030은 폐기하지 않고 후보 freshness prerequisite 검증으로 남긴다.
