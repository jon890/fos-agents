# 원격 검증

| 선행 조건 | 실행 위치 | 명령 | 기대값 |
|---|---|---|---|
| PR 브랜치를 push 한 뒤 | 노트북 Claude Code, 셸에 `CAREER_BACKEND_URL`, `CAREER_BACKEND_TOKEN` 설정 | `claude plugin install` 로 이 브랜치의 `career-os/plugin` 을 설치하고 `/fos-career:interview-question-prep` 로 지원 디렉터리 하나의 공고별 질문을 고른다 | 공개, 개인, 공고별 질문이 섞인 목록이 나오고 답변 기록이 Backend 에 남는다 |
| 같은 설치 뒤 | 노트북 Claude Code | `/fos-career:study-collection` 로 수집과 HTML 리포트를 만든다 | 수집 결과와 HTML 이 실행 디렉터리에 생기고 추천 저장이 성공한 뒤 정리된다 |
| 같은 설치 뒤, `CAREER_WORKSPACE_SSH_TARGET` 설정 | 노트북 Claude Code | `bun "<PLUGIN_ROOT>/dist/career-local.js" workspace begin interview-question-prep --json` 와 `finish` | `mode: "remote"` 로 홈서버 release 와 동기화되고 `noChange: true` 로 끝난다 |
| 머지 뒤 | fos-assistant 운영 화면 | fos-career 커넥터를 다시 등록하고 연결 확인을 한다 | 카탈로그에 커넥터가 남고 대화용 스킬 셋만 지침에 들어간다 |
