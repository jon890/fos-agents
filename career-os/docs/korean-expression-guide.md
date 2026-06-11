# 한국어 표현 가이드 — career-os

career-os에서 사용자에게 보이는 문서와 task 문장을 자연스럽게 다듬는 기준.
공통 형식 규칙은 `../docs/docs-style.md`를 따른다.
이 문서는 career-os 산출물에 자주 나오는 용어의 표현만 다룬다.

## 기본 원칙

기술 식별자는 유지하고, 사용자가 읽는 설명은 한국어로 푼다.

- 파일명, 코드 식별자, 상태 enum, 명령어는 그대로 둔다.
- 섹션 제목과 판단 문장은 한국어를 우선한다.
- 영어 단어를 그대로 옮긴 딱딱한 표현은 피한다.
- 내부 작업자용 표현과 사용자용 표현을 분리한다.

예:

- 내부: `request status projection`
- 사용자용: 요청 상태 표시
- 내부: `stale snapshot`
- 사용자용: 오래된 snapshot / 갱신되지 않은 상태 요약

## 권장 표현

문맥별로 더 자연스러운 표현을 고른다.

| 피할 표현 | 권장 표현 |
|---|---|
| HUD 운영 위생 | HUD 상태 관리 정리 |
| orchestration hygiene | agent 운영 정리 |
| data boundary hygiene | data 경계 정리 |
| worktree hygiene | 워크트리 정리 |
| worktree cleanup | 워크트리 정리 |
| request status projection | 요청 상태 표시 / 요청 상태 요약 |
| generated artifact quality rollout | 생성 문서 품질 기준 적용 |
| artifact | 산출물 |
| generated artifact | 생성 산출물 / 생성 문서 |
| skill contract | skill 산출물 계약 / skill 작성 규칙 |
| ownership inventory | 소유권 점검 / 소유권 목록 |
| stale snapshot | 오래된 snapshot / 갱신되지 않은 상태 요약 |
| tombstone | 폐기 안내 / tombstone 기록 |
| private by default | 기본 비공개 |
| export gate | 내보내기 전 점검 / 승인 점검 |
| review loop | 검토 루프 |
| evidence loop | 근거 보강 루프 |
| post-validation | 실행 후 검증 |
| freeze | 확정본 저장 / Markdown 확정본 |

## 유지해도 되는 영어

한국어로 바꾸면 오히려 어색하거나 검색성이 떨어지는 표현은 유지한다.

- `commit`
- `push`
- `merge`
- `git worktree` 명령어
- `branch`
- `payload`
- `status`
- `snapshot`
- `ledger`
- `frontdoor queue`
- `skill`
- `runner`
- `proxy`

필요하면 첫 등장에만 한국어 설명을 붙인다.

예:

- `frontdoor queue`: 추천 후보 대기열
- `ledger`: 사용자가 준비 시작을 승인한 지원 원장
- `snapshot`: 요청 당시 상태 요약

## task 제목 작성

task 제목은 짧고 실행 가능한 한국어로 쓴다.

좋은 예:

- `data 경계 inventory`
- `HUD 상태 관리 정리`
- `생성 문서 품질 기준 적용`
- `지원 준비 요청 상태 모델`
- `이력서 패키지 처리 후검증`

피할 예:

- `orchestration hygiene`
- `generated artifact quality rollout`
- `request status projection`
- `backup allowlist and validation`

## 생성 문서 작성

사용자가 읽는 생성 문서는 결론을 먼저 둔다.

- 첫 10줄 안에 판단, 결론, 다음 행동 중 하나를 둔다.
- `needs_evidence`를 그대로 쓰지 않는다.
- 대신 `보강 필요 / 선택지 / 권장 행동`으로 나눈다.
- 내부 분석과 제출용 문구를 섞지 않는다.

## skill 문서 작성

SKILL.md는 한국어 본문을 기본값으로 둔다.

- description은 한국어 자연어 trigger를 포함한다.
- 본문 헤더는 한국어로 쓴다.
- 코드 경로와 명령어는 그대로 둔다.
- 사용자에게 보이는 완료 요약은 짧은 한국어로 쓴다.

## 참고

- ai-nodes `docs/docs-style.md`
- ai-nodes ADR-007 — SKILL.md 한국어화 표준
- career-os plan055 — 생성 문서 품질 계약
- career-os plan058 — 생성 산출물 품질 기준 적용
