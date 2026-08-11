# AGENTS.md

이 파일은 행동 규칙과 문서 라우팅만 담는다.
구조 설명은 [`docs/code-architecture.md`](docs/code-architecture.md)를 따른다.
결정의 이유는 [`docs/adr/INDEX.md`](docs/adr/INDEX.md)를 따른다.

## 읽기 순서

작업 범위에 맞는 단일 출처를 먼저 연다.
같은 정의를 여러 문서에 복제하지 않는다.


| 문서                                                       | 책임            | 언제 보는지                      |
| -------------------------------------------------------- | ------------- | --------------------------- |
| [`docs/code-architecture.md`](docs/code-architecture.md) | 루트와 워크스페이스 구조 | 디렉터리, skill, 공용 helper 변경   |
| [`docs/adr/INDEX.md`](docs/adr/INDEX.md)                 | 모노레포 결정 이유    | 공통 정책, 구조 변경, 되돌리기 어려운 결정   |
| [`docs/docs-style.md`](docs/docs-style.md)               | 문서 작성 형식      | docs, ADR, AGENTS, SKILL 작성 |
| `<workspace>/AGENTS.md`                                  | 워크스페이스별 정책    | 특정 워크스페이스 작업 시작             |


## 워크스페이스

각 워크스페이스는 독립 작업 영역이다.
작업을 시작하면 해당 워크스페이스의 `AGENTS.md`를 먼저 읽는다.


| 워크스페이스              | 가이드                                                        | 책임                           |
| ------------------- | ---------------------------------------------------------- | ---------------------------- |
| `apartment/`        | [`apartment/AGENTS.md`](apartment/AGENTS.md)               | 아파트 시세와 인테리어 리포트             |
| `career-os/`        | [`career-os/AGENTS.md`](career-os/AGENTS.md)               | 커리어, 면접, 지원 준비를 위한 작업공간      |
| `stock-investment/` | [`stock-investment/AGENTS.md`](stock-investment/AGENTS.md) | 일일 주식과 이슈 모니터링               |
| `travel/`           | [`travel/AGENTS.md`](travel/AGENTS.md)                     | 여행별 일정과 결정 로그                |
| `health-care/`      | [`health-care/AGENTS.md`](health-care/AGENTS.md)           | 무릎 재활 체크인                    |
| `ji-yoon-blog/`     | [`ji-yoon-blog/AGENTS.md`](ji-yoon-blog/AGENTS.md)         | 지융로그 네이버 블로그 운영, 글쓰기, 트렌드 분석 |
| `side-projects/`    | [`side-projects/AGENTS.md`](side-projects/AGENTS.md)       | 개인 사이드 프로젝트와 외주 기회 운영        |


## 작업 경계

- 워크스페이스 간 자산을 교차 참조하지 않는다.
- 워크스페이스 한정 helper는 `<workspace>/scripts/<skill>/`에 둔다.
- 여러 워크스페이스가 같은 helper를 요구하면 중복과 책임 경계를 먼저 검토하고 ADR로 도입 여부를 결정한다.
- 비밀 값은 각 워크스페이스의 `.env`에 둔다.
- 공개 저장소에 커밋되는 문서와 task에는 환경 종속 절대 경로, 내부 호스트명, 계정명 등 비공개 실행 환경 식별자를 포함하지 않는다.
- `tasks/`에는 실행 중인 계획만 둔다.
  완료하거나 폐기한 계획은 현재 트리에서 제거하고 Git 이력으로 보존한다.
- `career-os/sources/fos-study`는 별도 동기 저장소다. study-pack 계열 작업이 아니면 프로젝트 코드처럼 편집하지 않는다.

## Git 커밋

커밋 기록은 한국어로 일관되게 작성한다.

- 커밋 메시지의 제목과 본문은 항상 자연스러운 한국어로 작성한다.
- 기술 식별자, 경로, 명령어, 이슈 번호처럼 원문 유지가 필요한 문자열만 예외로 둔다.

## 리포트 산출물

사용자가 보는 분석·추천·점검 리포트는 기본적으로 HTML 파일로 만든다.

- HTML은 워크스페이스에서 허용한 리포트 경로에 만든다.
- 사용자가 외부 게시 또는 공유 URL 생성을 명시하면 `report-publisher` 스킬을 사용한다.
  공개 범위를 검사한 뒤 Cloudflare Pages에 게시한다.
- 외부 공유가 승인된 경우 Discord 답변에는 결론, 필요한 근거, 다음 행동과 검증된 리포트 URL을 제공한다.
- 외부 공유가 승인되지 않은 경우에는 로컬 HTML 경로와 공개 가능한 요약만 제공한다.
- 공개 게시가 승인되지 않았거나 민감 정보가 포함된 리포트는 Cloudflare Pages에 게시하지 않는다.
