# fos-agents

`fos-agents`는 개인 업무와 생활의 반복 작업을 독립된 agent 워크스페이스로 관리하는 모노레포다.
루트는 공통 규칙, 공용 문서, 공용 skill만 담당한다.
구체적인 작업은 각 워크스페이스에서 시작한다.

## 시작하기

1. 루트 [`AGENTS.md`](AGENTS.md)를 읽는다.
2. 작업할 워크스페이스의 `AGENTS.md`를 읽는다.
3. 구조가 필요하면 [`docs/code-architecture.md`](docs/code-architecture.md)를 확인한다.
4. 되돌리기 어려운 결정의 이유가 필요하면 [`docs/adr/INDEX.md`](docs/adr/INDEX.md)를 확인한다.

## 워크스페이스

| 워크스페이스 | 책임 | 시작 문서 |
|---|---|---|
| [`apartment/`](apartment/) | 아파트 시세 조사와 인테리어 의사결정 리포트 | [`apartment/README.md`](apartment/README.md) |
| [`career-os/`](career-os/) | 커리어 성장, 공고 추천, 면접·지원 준비 | [`career-os/AGENTS.md`](career-os/AGENTS.md) |
| [`health-care/`](health-care/) | 건강 기록, 진료 준비, 재활 경과 관리 | [`health-care/AGENTS.md`](health-care/AGENTS.md) |
| [`ji-yoon-blog/`](ji-yoon-blog/) | 지융로그 네이버 블로그 콘텐츠 운영 | [`ji-yoon-blog/AGENTS.md`](ji-yoon-blog/AGENTS.md) |
| [`side-projects/`](side-projects/) | 사이드 프로젝트와 외주 기회 운영 | [`side-projects/AGENTS.md`](side-projects/AGENTS.md) |
| [`stock-investment/`](stock-investment/) | 주식·경제 이슈 관찰과 학습용 분석 | [`stock-investment/AGENTS.md`](stock-investment/AGENTS.md) |
| [`travel/`](travel/) | 여행별 일정, 예약 정보, 의사결정 기록 | [`travel/README.md`](travel/README.md) |

## 공통 구조

워크스페이스는 필요에 따라 아래 경로를 가진다.
문서 중심 워크스페이스는 자동화 관련 디렉터리가 없을 수 있다.

| 경로 | 역할 |
|---|---|
| `AGENTS.md` | 해당 영역의 작업 규칙과 문서 진입점 |
| `docs/` | 제품 범위, 데이터 구조, 실행 흐름, 의사결정 기록 |
| `config/` | 사람이 관리하는 정책, 기본값, 공개 가능한 설정 |
| `data/` 또는 `private/` | 실행 데이터와 민감한 개인 기록 |
| `scripts/` | 수집, 분석, 렌더링 같은 반복 실행 코드 |
| `.claude/skills/` | 해당 영역에서 사용하는 agent skill 본문 |

비밀 값은 각 워크스페이스의 `.env`에 둔다.
개인 건강 기록, 지원 전략, 예약 정보처럼 민감한 데이터는 해당 워크스페이스 경계를 벗어나지 않는다.

## 루트 자산

| 경로 | 내용 |
|---|---|
| [`AGENTS.md`](AGENTS.md) | 모든 워크스페이스에 적용되는 공통 운영 규칙 |
| [`docs/code-architecture.md`](docs/code-architecture.md) | 현재 디렉터리 구조와 책임 경계 |
| [`docs/adr/INDEX.md`](docs/adr/INDEX.md) | 모노레포 수준의 주요 결정과 이유 |
| [`.agents/skills/report-publisher/`](.agents/skills/report-publisher/) | 공개 가능한 HTML 리포트 게시 skill |
| [`.claude/skills/`](.claude/skills/) | 루트에서 쓰는 agent skill과 공용 참조 |

`CLAUDE.md`는 `AGENTS.md`를 가리키는 심볼릭 링크다.
두 파일을 따로 수정하지 않는다.

## 설정

루트 `.env`는 사용하지 않는다.
필요한 환경 변수는 각 워크스페이스의 `.env.example`을 참고해 같은 위치의 `.env`에 둔다.

주요 예:

- `apartment/.env.example` — Naver Land 수집용 선택 인증 값
- `travel/.env.example` — travel 워크스페이스 기본 환경 값

## 검증

변경 후에는 범위에 맞는 가장 작은 검증을 먼저 실행한다.

| 범위 | 예시 검증 |
|---|---|
| apartment 수집기 | `bash apartment/scripts/apartment-daily-report/run_smoke_test.sh` |
| TypeScript 파일 | `bun --check <file.ts>` |
| 문서 링크와 구조 | `rg`와 `find`로 실제 경로 대조 |
| HTML 리포트 게시 | `report-publisher` 실행 후 배포 URL HTTP 확인 |

외부 게시, 지원서 제출, 예약, 투자 판단처럼 외부 상태를 바꾸는 작업은 해당 워크스페이스의 승인 규칙을 따른다.
