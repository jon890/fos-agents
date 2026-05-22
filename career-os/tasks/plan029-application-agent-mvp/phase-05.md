# Phase 05 — application-reviewer native skill 설계 + 구현

## 목표

공고별 지원 패키지가 실제 경험과 어긋나지 않는지 검토하는 reviewer skill을 만든다.

## 새 skill

`career-os/.claude/skills/application-reviewer/SKILL.md`

## 입력

- `posting.md`
- `fit-analysis.md`
- `application-package.md`
- `config/candidate-profile.md`
- 관련 resume/task 근거 파일

## 출력

- `data/applications/<company>/<role>/review.md`

## 검토 축

- evidence guard: 근거 없는 주장 여부
- drift review: 공고에 맞추다 실제 경력과 멀어진 표현
- exaggeration check: 과장/허위 가능성
- privacy/publication boundary: 공개 금지 정보 포함 여부
- cooldown/duplication: 회사별 쿨다운, 중복 지원 리스크
- user approval gate: 사용자 승인 필요 항목

## 판정

- `pass`: 사용자에게 보여줄 수 있음
- `revise`: agent가 수정 루프로 되돌려야 함
- `blocked`: 공고 만료, 쿨다운, 근거 부족 등으로 진행 중단

## 검증 기준

- `review.md`에 pass/revise/blocked 중 하나가 명시된다.
- `revise`일 경우 수정 요청이 구체적이어야 한다.
- `blocked`일 경우 차단 근거가 source와 함께 있어야 한다.
- 최대 3회 수정 루프를 넘기면 사용자에게 blocker로 보고한다.
