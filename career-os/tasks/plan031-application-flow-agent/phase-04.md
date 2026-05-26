# Phase 04 — 기존 skill tool 연결 + reporting/safety gates

## 목표

application-flow-agent가 기존 Claude native skills를 tool처럼 연결하되, 상태 전이와 외부 action gate는 TypeScript runner가 통제하게 만든다.

## 연결 대상

- `/position-recommender`
  - 후보 source.
  - plan030 freshness guard를 prerequisite로 사용.
- `/application-package-writer`
  - 공고별 `fit-analysis.md`와 `application-package.md` 생성.
- `/application-reviewer`
  - evidence/drift/exaggeration/privacy/cooldown review.
- `/daily-application-digest`
  - 전체 상태 요약과 사용자 승인 필요 항목 보고.
- `/study-topic-recommender`
  - gap 기반 private study action 후보.
- `/study-pack-writer`
  - public-safe topic만 별도 guard/승인 후 사용.
- `/interview-asset-writer`
  - 제출/면접 대비 질문 은행.
- `/interview-prep-analyzer`
  - daily drill과 답변 피드백.
- `/candidate-baseline-suggester`
  - profile-suggestions 생성 또는 후보자 baseline 개선 후보 검토.

## safety gates

runner는 다음 action을 자동 실행하지 않는다.

- 실제 지원 제출
- 채용 사이트 입력/전송
- 계정 로그인 또는 권한 사용
- 공개 블로그/fos-study 발행
- 원본 `config/candidate-profile.md` 수정
- 사용자 개인정보 또는 비공개 지원 전략 외부 전송

대신 다음 산출물만 만든다.

- `submission-checklist.md`
- `profile-suggestions.md`
- `private-study-actions.md`
- `decision-log.md`
- daily digest용 요약 block

## reporting

daily report에는 다음을 분리한다.

- agent가 오늘 한 일
- agent-only next work
- 사용자 승인 필요 항목
- 막힌 이유
- 다음 실행 예약
- public-safe study candidates
- private strategy notes

Discord 알림은 전체 private 내용을 노출하지 않고, 승인 필요 여부와 다음 상태만 짧게 보낸다.

## 산출물

- 기존 skill 호출 contract 문서화
- safety gate validator 또는 action allowlist
- digest/report renderer 보강
- OpenClaw wrapper가 필요하면 별도 skill 추가 검토

## 검증 기준

- `ready_for_user_review` 상태에서 제출 관련 action은 checklist까지만 생성한다.
- public publish action은 기본적으로 blocked/user approval required로 나온다.
- candidate-profile 원본 수정 action은 생성되지 않는다.
- daily digest가 public/private 정보를 분리한다.

