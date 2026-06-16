## ADR-071 — study-topic-recommender 자동 실행은 bypassPermissions로 호출한다

- Status: Accepted
- Date: 2026-06-09

### 맥락

[[ADR-070]] rollout 검증 중 `claude -p "/study-topic-recommender ..."`가 정상 완료되지 않고 멈췄다.
Claude 실행 로그를 확인하니 작업 실패가 아니라 비대화형 실행 중 권한 승인 요청을 기다리는 상태였다.

첫 실행은 후보 제안 JSON과 runtime 후보 report 쓰기 승인을 기다렸다.
두 번째 `acceptEdits` 실행은 파일 수정은 허용됐지만 `Bash` 명령 승인 요청에서 멈췄다.
로그 마지막 상태는 정상 완료가 아니라 `last-prompt`였다.

`study-topic-recommender`는 agent-only 내부 추천 흐름이다.
외부 제출, fos-study publish, commit/push를 하지 않는다.
반면 정상 동작에는 후보 제안 JSON 쓰기, runtime report 쓰기, Bun script 실행이 필요하다.

### 결정

- 자동 실행과 운영 문서의 `study-topic-recommender` 호출은 `claude --permission-mode bypassPermissions -p "/study-topic-recommender ..."`를 사용한다.
- 이 권한 모드는 `study-topic-recommender`에 한정한다.
- `study-pack-writer`, `interview-asset-writer`처럼 공개 저장소 publish 또는 사용자 확인이 필요한 skill에는 적용하지 않는다.
- skill 내부 Bash 예시는 `career-os` 루트에서 실행하는 경로로 정리한다.
  `career-os/scripts/...`가 아니라 `scripts/...`를 사용한다.
- OpenClaw cron payload도 같은 호출 패턴을 사용한다.

### 결과

- daily study recommendation cron이 후보 refresh 중 승인 대기 상태로 멈추지 않는다.
- `acceptEdits`가 Bash 승인 요청을 해결하지 못하는 한계를 문서화했다.
- 공개 발행이나 지원서 제출처럼 사람 확인이 필요한 흐름은 기존 확인 절차를 유지한다.
