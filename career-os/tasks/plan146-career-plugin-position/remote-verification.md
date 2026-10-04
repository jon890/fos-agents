# 원격 검증

| 선행 조건 | 실행 위치 | 명령 | 기대값 |
|---|---|---|---|
| PR 브랜치를 push 한 뒤 | 노트북 Claude Code, 셸에 `CAREER_BACKEND_URL`, `CAREER_BACKEND_TOKEN`, `CAREER_EVIDENCE_DIR` 설정 | 이 브랜치의 `career-os/plugin` 을 설치하고 `/fos-career:position-recommender` 로 일일 실행을 끝까지 돈다 | `collect` 부터 `finalize` 까지 성공하고 HTML 리포트가 실행 디렉터리에 생긴 뒤 `cleanup` 으로 정리된다 |
| 같은 설치 뒤 | 노트북 Claude Code | 같은 날 저장소 사본 `/position-recommender` 를 한 번 더 돈다 | 두 실행이 같은 Backend 상태를 쓰고 두 번째 실행이 앞의 분석을 재사용한다 |
