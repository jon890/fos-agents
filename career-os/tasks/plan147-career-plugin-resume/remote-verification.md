# 원격 검증

| 선행 조건 | 실행 위치 | 명령 | 기대값 |
|---|---|---|---|
| 머지 전, 저장소 작업본을 쓰는 노트북 | 노트북 저장소 루트 | `skill begin resume-preparer` 뒤 기준 브랜치의 `career-os/.claude/skills/resume-preparer/templates/logos/` 파일을 `git show` 로 꺼내 작업본 `career-os/library/resume-logos/` 에 두고 `skill finish resume-preparer` | 홈서버 release 에 로고가 올라가고, 다음 이력서 HTML 에 회사·학교 로고가 붙는다 |
| PR 브랜치를 push 한 뒤 | 노트북 Claude Code, 셸에 Backend 연결값과 `CAREER_WORKSPACE_ROOT` 설정 | 이 브랜치의 `career-os/plugin` 을 설치하고 `/fos-career:resume-preparer` 로 지원 디렉터리 하나의 이력서를 export 하고 제출 묶음을 검증한다 | HTML·PDF 가 생기고 `validate-bundle` 이 통과한다 |
| 같은 설치 뒤 | 노트북 Claude Code | `<CAREER_LOCAL> resume search-claims <검색어>` | 작업본 `state/verified-claims/` 의 주장이 나온다 |
