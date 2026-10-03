# 원격 검증

배포 순서는 Backend 가 먼저고 홈서버의 스크립트 release 가 다음이다.
둘 사이에 수집이 돌면 옛 스크립트가 새 Backend 의 정책 응답을 읽지 못해 수집 전에 멈춘다. 틀린 기준으로 저장되는 일은 없다.
반대 순서로 하면 새 스크립트가 정책을 맞추지 않은 채 옛 Backend 가 정책의 옛 값으로 분석을 기록할 수 있다.

migration 이 정책 행의 칸을 지우므로 image 만 되돌려서는 옛 코드가 돌지 않는다. 되돌릴 때는 배포 스크립트가 만든 백업으로 DB 를 복원한다.

| 선행 조건 | 실행 위치 | 명령 | 기대값 |
|---|---|---|---|
| 머지한 뒤, Backend 배포 전 | 노트북 | `GET /api/positions/v1/analysis-policy` 의 응답과 `manage_candidate_context.ts list` 의 결과를 저장소 밖 파일로 남긴다 | 정책에 저장된 `candidateContextVersion` 과 `position-preferences` 문서의 `version` 이 기록돼 있다. migration 이 정책의 값을 버리므로, 배포 뒤 대기열이 `stale` 로 다시 차는지 판단할 근거가 이것뿐이다 |
| 머지한 뒤, Backend 배포 전 | 노트북 | `position_run.ts collect` 와 `manage_candidate_context.ts put --key position-preferences` 를 실행하지 않는다 | 배포가 끝날 때까지 수집 실행과 `position-preferences` 저장이 없다 |
| 머지한 뒤, Backend 배포 전 | 홈서버 | 포지션 수집 cron 이 배포 구간에 걸리지 않는 시각인지 확인한다 | `migrate` 와 `serve` 사이에 수집 요청이 없다 |
| Backend 를 배포한 뒤 | 홈서버 | `docker run --rm --env-file <환경 파일> <image> migrate` 를 다시 실행한다 | 적용할 migration 이 없고 종료 코드 0 |
| Backend 를 배포한 뒤 | 노트북 | `curl -fsS <배포한 주소>/health/ready` | `200` |
| Backend 를 배포한 뒤 | 노트북, `career-os/services/career-backend` | `CAREER_BACKEND_URL=<배포한 주소> CAREER_BACKEND_TOKEN=<운영 token> npm run test:deployed` | 종료 코드 0 |
| Backend 를 배포한 뒤 | 노트북 | `curl -fsS -H "Authorization: Bearer <운영 token>" <배포한 주소>/api/positions/v1/analysis-policy` | 응답 JSON 에 `candidateContextVersion` 키가 없다. 나머지 일곱 값은 배포 전과 같다 |
| Backend 를 배포한 뒤 | 노트북 | 저장소 밖에 둔 분석 정책 JSON 파일에서 `candidateContextVersion` 줄을 지운다 | `configure_position_analysis_policy.ts --input <정책 JSON>` 이 `passed: true` 를 낸다. 줄을 지우지 않은 파일은 Backend 의 `400` 이 아니라 스크립트의 입력 검사(zod)에서 먼저 실패한다 |
| 홈서버의 스크립트 release 를 올린 뒤 | 홈서버 | `bun career-os/scripts/candidate-context/manage_candidate_context.ts help` | 출력에 `sync-position-policy` 가 없다 |
| Backend 배포와 스크립트 release 가 모두 끝난 뒤 | 노트북 | `bun career-os/scripts/position-recommender/position_run.ts collect` | 종료 코드 0. 출력에 `후보자 맥락 기준 버전: position-preferences:v<n>` 이 있고 `<n>` 이 `manage_candidate_context.ts list` 가 보여 주는 `position-preferences` 의 version 과 같다 |
| 위 수집이 끝난 뒤 | 홈서버 DB | `SELECT candidate_context_version FROM company_tier_assessment_runs ORDER BY created_at DESC LIMIT 1` | 위 출력의 `position-preferences:v<n>` 과 같다 |
