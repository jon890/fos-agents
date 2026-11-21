# Phase 01. AI·LLM·Agent 업무 공고를 수집 후보로 고르기

**Execution profile**: standard

## 목표

REQ1을 공통 수집 검증기에 적용한다. 처리 순서와 책임은 [기술 설계](../../design.md)를 따른다.

## 작업

1. 공통 정책에 제목과 주요 업무의 AI 신호를 넣고, 자격·우대 근거를 직무 판단에서 뺀다.
2. 기존 어댑터가 예비 직무 검사에서 AI 공고를 버리는 경로를 확인하고 필요한 범위에서 보완한다.
3. 스펙의 포함·제외 사례와 2026-11-21 브리핑 상위 사례를 합성 테스트로 검증한다.
4. 원본과 비서용 사본에 같은 `RULE-ROLE-FILTER`를 적고 플러그인 버전과 번들을 갱신한다.

## 인수 검증 계획

| 요구사항 | 준비 조건 | 실행 절차 | 기대 결과 | 실행 환경 | 실행 담당 | 선행 조건 | 시점 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| REQ1 | 합성 공고와 Bun 의존성 | `bun test career-os/scripts/position-recommender/live-postings/role-regression.test.ts` | 브리핑 상위 공고와 LLM 서빙·추천·임베딩 업무는 통과한다. AI와 무관한 직무, 연구직, 우대사항만 있는 공고와 비정규 고용은 제외한다. | 개발 워크트리 | worker | 없음 | PR 전 |

## PR 전 검증

- 루트에서 `bun test career-os/scripts/position-recommender`로 REQ1과 수집 회귀를 확인한다.
- `career-os/plugin`에서 `bun run typecheck`, `bun test`, `bun run build`를 실행한다.
- `career-os/services/career-backend`에서 `npm run typecheck`, `npm test`, `npm run build`를 실행한다.
- 두 판단 기준의 규칙 문구와 버전을 대조하고 `git diff --check`를 실행한다.
