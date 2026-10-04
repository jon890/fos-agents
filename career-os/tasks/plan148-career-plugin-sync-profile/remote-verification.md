# 원격 검증

| 선행 조건 | 실행 위치 | 명령 | 기대값 |
|---|---|---|---|
| PR 브랜치를 push 한 뒤 | 노트북 Claude Code, 셸에 Backend 연결값, `browser-driver` 가 PATH 에 있음 | 이 브랜치의 `career-os/plugin` 을 설치하고 `/fos-career:sync-profile` 로 원티드 필드 하나를 바꾸지 않고 읽기만 한다(`wanted_list_fields.sh`) | 필드 인덱스 목록이 나온다. 원티드와 LinkedIn 의 실제 저장은 사용자가 승인한 때만 한다 |
| 같은 설치 뒤 | 노트북 Claude Code | `bun --no-env-file "<plugin 경로>/dist/career-local.js" usage` | 기록이 없는 끝난 달만 측정해 `<YYYY-MM> <코드>` 를 낸다 |
| 머지 뒤 | fos-assistant 운영 화면 | 커리어 커넥터 연결 확인 | 대화용 스킬의 sync-profile 안내가 바뀐 문장으로 보인다 |
