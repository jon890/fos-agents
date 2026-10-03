# 원격 검증

fos-assistant 에 설치하는 일은 이 저장소 밖이다. 운영 목록에 `fos-career` 를 올리고 `operator_env` 의 두 값(`CAREER_BACKEND_URL`, `CAREER_GITHUB_PROFILE_REPO`)을 주는 것은 fos-assistant 의 운영자가 한다.
아래는 그 뒤에 확인할 것이다. 값과 주소는 여기에 적지 않는다.

| 선행 조건 | 실행 위치 | 명령 | 기대값 |
|---|---|---|---|
| 머지하고 fos-assistant 의 운영 목록에 `fos-career` 를 올린 뒤 | fos-assistant 에 로그인한 브라우저나 API client | `GET /api/v1/connectors` | `fos-career` 가 `available: true` 로 있다. `tools` 가 열 개이고 `save_context_document`, `save_profile_document`, `update_github_profile` 셋이 `WRITE` 와 `REQUIRED`, 나머지가 `READ` 와 `NONE` 이다 |
| 위 항목 통과 뒤 | fos-assistant 의 연결 화면 | Backend token 만 넣고 등록한 뒤 연결 확인을 누른다 | 연결 상태가 `READY` 이고 `undeclaredTools` 가 0 이다 |
| 연결이 `READY` 인 뒤 | 커리어 에이전트와의 대화 | 「프로필 원고 목록과 사용량 기록을 보여 줘」 | 승인 카드 없이 원고 셋의 `version` 과 달별 기록이 온다 |
| 연결이 `READY` 인 뒤 | 같은 대화 | 「GitHub 프로필을 갱신해 줘」 | GitHub 도구가 설정이 없다고 답한다. 문서 조회는 계속 된다 |
| GitHub token 을 더해 다시 등록하고 관리자가 반영 완료를 누른 뒤 | 같은 대화 | Tokens 배지 값을 기록의 합계와 다르게 적은 README 로 갱신을 요청하고 승인 카드에서 승인한다 | 결과가 실패(`CAREER_BADGE_MISMATCH`)로 오고, 프로필 저장소의 branch 끝 커밋이 승인 전과 같다 |
| 위 항목 통과 뒤 | 같은 대화 | 기록의 합계와 같은 배지 값으로 갱신을 요청하고 승인 카드에서 승인한다 | 프로필 저장소에 커밋이 하나 늘고 그 커밋이 `README.md` 와 `agent-usage.svg` 둘을 함께 바꾼다. 프로필 화면에서 차트 이미지가 로드되고 차트의 달별 값의 합이 배지 값과 같다 |
| 위 항목 통과 뒤 | 같은 대화 | 같은 README 와 같은 달로 한 번 더 요청하고 승인한다 | 결과가 `changed: false` 이고 커밋이 늘지 않는다 |
| 위 항목 통과 뒤 | 같은 대화 | GitHub 원고 저장을 승인한다 | 저장 결과의 `version` 이 1 올랐다 |
| 위 항목 통과 뒤 | 노트북의 저장소 루트 | `bun --env-file=career-os/.env career-os/scripts/profile/manage_profile.ts documents get --key github --out "${TMPDIR:-/tmp}/github-profile.md"` 로 `github` 원고를 읽는다 | `version` 이 커넥터가 저장한 값과 같고 본문이 올린 README 와 같다. 노트북의 `sync-profile` 과 커넥터가 같은 원고를 읽는다 |
| 연결이 `READY` 인 뒤 | 같은 대화 | `position-preferences` 문서에 한 줄을 더해 저장을 요청하고 승인한다 | 저장이 성공한다. 그 뒤 포지션 수집 명령이 기준 버전 불일치로 멈추지 않는다 |
