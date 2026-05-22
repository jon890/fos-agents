# Phase 04 — application-package-writer native skill 설계 + 구현

## 목표

공고 1개와 후보자 프로필을 입력으로 받아 공고별 지원 패키지를 생성하는 Claude native skill을 만든다.

## 새 skill

`career-os/.claude/skills/application-package-writer/SKILL.md`

## 입력

- `data/applications/<company>/<role>/posting.md`
- `config/candidate-profile.md`
- 필요 시 candidate-profile이 참조하는 resume/task 근거 파일

## 출력

- `data/applications/<company>/<role>/fit-analysis.md`
- `data/applications/<company>/<role>/application-package.md`

## 필수 내용

`fit-analysis.md`:

- 공고 요약
- role-fit 요약
- 강점 근거
- gap
- 지원 우선순위
- risk flags

`application-package.md`:

- 맞춤 이력서 bullet 초안
- 지원동기/자기소개 초안
- 직무별 강조 포인트
- 면접 대비 포인트
- 근거 파일 참조

## 검증 기준

- 근거 없는 주장은 `needs_evidence`로 표시한다.
- 회사명/지원 전략이 들어간 파일을 `sources/fos-study/`에 쓰지 않는다.
- 출력 파일 2개가 존재하고 30줄 이상이다.
- ledger 상태를 `preparing_application` 또는 `ready_for_user_review`로 갱신할 수 있는 next action을 남긴다.

## 의도적으로 안 하는 것

- review pass/fail 최종 판단은 Phase 05의 `application-reviewer`가 담당한다.
