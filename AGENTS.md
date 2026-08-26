# AGENTS.md

이 파일은 공통 행동 규칙과 문서 진입점만 담는다.
현재 구조는 [`docs/code-architecture.md`](docs/code-architecture.md)를 따른다.
결정의 이유는 [`docs/adr/INDEX.md`](docs/adr/INDEX.md)를 따른다.

## 읽기 순서

작업 범위에 맞는 단일 출처를 먼저 연다.
같은 정의를 여러 문서에 복제하지 않는다.


| 문서                                                       | 책임            | 언제 보는지                    |
| -------------------------------------------------------- | ------------- | ------------------------- |
| [`docs/code-architecture.md`](docs/code-architecture.md) | 루트와 워크스페이스 구조 | 디렉터리, skill, 공용 자산 변경     |
| [`docs/adr/INDEX.md`](docs/adr/INDEX.md)                 | 모노레포 결정 이유    | 공통 정책, 구조 변경, 되돌리기 어려운 결정 |
| `<workspace>/AGENTS.md`                                  | 워크스페이스별 운영 경계 | 특정 워크스페이스 작업 시작           |


## 워크스페이스

각 워크스페이스는 독립 작업 영역이다.
작업을 시작하면 해당 워크스페이스의 `AGENTS.md`를 먼저 읽는다.


| 워크스페이스              | 가이드                                                        | 책임               |
| ------------------- | ---------------------------------------------------------- | ---------------- |
| `apartment/`        | [`apartment/AGENTS.md`](apartment/AGENTS.md)               | 아파트 시세와 인테리어 리포트 |
| `accountbook/`      | [`accountbook/AGENTS.md`](accountbook/AGENTS.md)           | 가계부 입력 자동화         |
| `career-os/`        | [`career-os/AGENTS.md`](career-os/AGENTS.md)               | 커리어, 면접, 지원 준비   |
| `stock-investment/` | [`stock-investment/AGENTS.md`](stock-investment/AGENTS.md) | 주식과 이슈 모니터링      |
| `travel/`           | [`travel/AGENTS.md`](travel/AGENTS.md)                     | 여행 일정과 결정 로그     |
| `health-care/`      | [`health-care/AGENTS.md`](health-care/AGENTS.md)           | 건강 기록과 재활 체크인    |
| `ji-yoon-blog/`     | [`ji-yoon-blog/AGENTS.md`](ji-yoon-blog/AGENTS.md)         | 지융로그 콘텐츠 운영      |
| `side-projects/`    | [`side-projects/AGENTS.md`](side-projects/AGENTS.md)       | 사이드 프로젝트와 외주 기회  |


## 작업 경계

- 워크스페이스 간 자산을 교차 참조하지 않는다.
- 워크스페이스 한정 helper는 해당 워크스페이스 내부에 둔다.
- 여러 워크스페이스가 같은 helper를 요구하면 공용 자산으로 둘지 먼저 검토하고 ADR로 남긴다.
- 비밀 값은 각 워크스페이스의 `.env`에 둔다.
- 공개 저장소 문서에는 환경 종속 절대 경로, 내부 호스트명, 계정명, 채널 ID 같은 실행 환경 식별자를 쓰지 않는다.
- `career-os/sources/fos-study`는 별도 동기 저장소이자 읽기 전용 학습 이력이다.
  프로젝트 코드처럼 편집하거나 자동 발행하지 않는다.

## Git 커밋

커밋 기록은 한국어로 작성한다.
기술 식별자, 경로, 명령어, 이슈 번호처럼 원문 유지가 필요한 문자열만 예외로 둔다.
제목은 `<type>(<workspace>): <한국어 메시지>` 형식을 사용한다.
`workspace`에는 변경한 최상위 워크스페이스 이름을 쓴다.
제목에는 변경 대상과 달라진 동작을 함께 적는다.
`개선한다`, `정리한다`, `현재화한다`처럼 결과를 알 수 없는 표현만 쓰지 않는다.

예시:

- `fix(career-os): 추천 결과의 추정 기본값을 제거한다`
- `docs(apartment): 리포트 생성 경로와 게시 검증 절차를 분리한다`

## 리포트 산출물

사용자가 보는 분석·추천·점검 리포트는 기본적으로 HTML 파일로 만든다.

- HTML은 워크스페이스에서 허용한 리포트 경로에 만든다.
- 사용자가 외부 게시 또는 공유 URL 생성을 명시하면 `report-publisher`를 사용한다.
- 공개 범위를 검사한 뒤 Cloudflare Pages 배포 결과를 검증한다.
- 공개 게시가 승인되지 않았거나 민감 정보가 포함된 리포트는 게시하지 않는다.
