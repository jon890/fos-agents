# Phase 01. 결과가 있는 모든 평가에서 v3를 요구한다

**Execution profile**: standard

## 목표

기존 문제 후보 생성 지침을 재사용하고 일반 침묵 평가가 v1 결과나 누락된 후보 배열을 통과시키는 공백을 막는다.

**범위 외**: Control Plane 코드, 운영 스킬 재업로드, 운영 저장 검사, 다른 워크스페이스, 개인 데이터.

## 컨텍스트

PR #174가 v3 스킬과 후보 생성·생략 사례 열 개를 이미 구현했다.
`career-os/plugin/scripts/agent-skill-eval.ts`의 `grade(trace, grading)`는 `grading.candidates`가 있을 때만 v3를 검사한다.
`지침 평가`의 기존 정상 침묵 테스트는 v1 결과를 통과시킨다.
조사 계획 평가는 결과가 없을 수 있으므로 `result: null`을 허용한다. 결과가 요구되거나 실제 결과를 낸 평가는 v3를 검사한다.

**근거 문서**: `career-os/docs/code-architecture.md`의 「plugin」 경로별 책임 표, `career-os/docs/adr/ADR-141-일반-에이전트가-읽는-스킬은-plugin-의-agent-skills-에-두고-따로-올린다.md`.

## 의도 메모

- 기존 양성·음성 후보 fixture를 복제하지 않는다. 새 라이브러리나 공개 API 변경이 필요하지 않다.
- 후보 없는 발견의 JSON 예는 `FINDINGS`를 유지한다. 정상 침묵은 `NOTHING_NEW`, 빈 발견과 빈 후보다.
- 제품 요구, 호출 흐름, 저장 모델과 ADR 결정은 바뀌지 않는다. 평가 책임은 code-architecture에 반영했다.

## 작업 항목

### 1. 채점기와 결과 예의 변경

`career-os/plugin/scripts/agent-skill-eval.ts`의 `grade`에서 실제 결과가 있거나 `grading.outcome` 또는 `grading.candidates`가 결과를 요구하면 버전 3과 `problemCandidates` 배열을 검사한다. 후보 배열은 3개 이하이고 `NOTHING_NEW`이면 빈 배열이어야 한다. 기존 후보 수·필수 칸·근거 채점은 유지하고 버전 채점을 중복하지 않는다.
`NOTHING_NEW`의 `findings`도 실제 빈 배열인지 검사한다. 누락된 발견 배열을 빈 배열로 취급하지 않는다.
결과를 요구하지 않는 조사 계획의 `result: null`은 기존 채점을 유지한다.
`career-os/plugin/agent-skills/proactive-check/references/result-block.md`에 발견은 있지만 문제는 없는 완전한 v3 JSON 블록을 추가한다. 기존 Kafka 발견을 합성 예로 재사용하고 `problemCandidates: []`를 쓴다. 발견과 문제 후보의 구분과 읽기 경계를 유지한다.

### 2. 회귀 테스트

`career-os/plugin/scripts/agent-skills.test.ts`에서 정상 침묵 trace를 v3와 빈 후보로 바꾼다.
일반 침묵의 v1·v2, 후보 누락·잘못된 타입·후보 포함, 발견 누락·잘못된 타입을 떨어뜨린다.
결과 없는 조사 계획은 통과시키고, 결과를 내는 계획 평가는 v1이나 후보 누락을 떨어뜨린다.
새 발견·빈 후보 예시가 `FINDINGS`이고 `grade`의 후보 0개 채점을 통과하는지 검사한다.
기존 실패 항목 목록 단언과 실패·보류 합성 결과도 새 계약에 맞춰 고친다.

## 검증

```bash
bun test ./career-os/plugin/scripts/agent-skills.test.ts
bunx prettier --check career-os/plugin/scripts/agent-skill-eval.ts career-os/plugin/scripts/agent-skills.test.ts
git diff --check
```

기존 평가와 새 회귀 검사, 서식과 공백 검사가 모두 통과한다.

## 변경 파일

| 파일 | 변경 |
|---|---|
| `career-os/plugin/scripts/agent-skill-eval.ts` | 수정 |
| `career-os/plugin/scripts/agent-skills.test.ts` | 수정 |
| `career-os/plugin/agent-skills/proactive-check/references/result-block.md` | 수정 |
