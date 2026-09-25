# Phase 02. 포지션 추천 CLI fixture를 현재 계약에 맞춘다

**Execution profile**: standard

## 목표

추천 CLI 계약 테스트가 현재 추천 결과 스키마로 성공과 실패를 구분한다.

## 컨텍스트

`career-os/scripts/lib/cli-contract.test.ts`의 추천 fixture는 `schemaVersion: 11`을 쓰지만 필수 `companyAssessments`가 없다.
그 때문에 성공 경로를 검사하는 8개 테스트가 스키마 오류로 실패한다.
`career-os/scripts/position-recommender/recommendation/schema.ts`는 공개 회사 판정 배열을 요구한다.
`career-os/docs/adr/ADR-124-판정-스키마는-모르는-상태를-표현한다.md`는 근거 없는 판정을 `unknown`으로 표현하도록 정했다.

## 작업 항목

1. `cli-contract.test.ts`의 추천 fixture에 회사 판정을 넣는다. `companyKey`와 `companyName`은 `예시`, `disposition`은 `analyze`, `reason`은 `null`로 둔다. `growth-scope`, `team-growth`, `compensation-upside` 세 축의 `level`은 모두 `unknown`, `evidenceIds`와 `evidence`는 빈 배열로 둔다.
2. 기존 추천 CLI 성공과 실패 단언을 유지하고, fixture가 세 축의 `unknown`을 보존하는지 단언한다.
3. `cli-contract.test.ts`에서 「CLI 밖에서 호출하는 핵심 함수」와 「추천 CLI 호환 계약」 묶음을 각각 선택해 실행한다. 두 묶음 모두 실패 0건을 확인한다. 다른 영역의 실패는 다음 phase에서 고친다.

## 범위와 검증

수정 파일은 `career-os/scripts/lib/cli-contract.test.ts` 하나다.
추천 스키마와 Backend 코드, 운영 상태는 바꾸지 않는다.
검증은 저장소 루트에서 다음 명령을 실행한다.

```bash
export PATH="$HOME/.bun/bin:$PATH"
bun test career-os/scripts/lib/cli-contract.test.ts -t 'CLI 밖에서 호출하는 핵심 함수'
bun test career-os/scripts/lib/cli-contract.test.ts -t '추천 CLI 호환 계약'
bunx tsc --noEmit
```
