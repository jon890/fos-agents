# fos-agents

`fos-agents`는 개인 업무와 생활의 반복 작업을
독립된 agent 워크스페이스로 관리하는 모노레포다.
각 워크스페이스는 목적, 데이터, 문서, 자동화, 보안 경계를 분리해 운영한다.

루트는 공통 규칙과 재사용 가능한 자산만 담당한다.
구체적인 작업은 해당 워크스페이스에서 시작한다.

## 시작하기

작업하기 전에 루트 [`AGENTS.md`](AGENTS.md)를 읽는다.
공통 운영 규칙, 문서 작성 방식, 워크스페이스 경계가 이 파일에 있다.

그다음 대상 워크스페이스의 `AGENTS.md`를 읽는다.
해당 영역의 데이터 위치, 안전 규칙, 실행 흐름은 워크스페이스별 가이드가 정한다.

```text
fos-agents/
├── AGENTS.md
├── docs/
├── apartment/
├── career-os/
├── health-care/
├── ji-yoon-blog/
├── side-projects/
├── stock-investment/
└── travel/
```

## 워크스페이스

각 워크스페이스는 서로의 개인 데이터, 설정, 산출물을 직접 참조하지 않는다.

| 워크스페이스 | 책임 | 시작 문서 |
|---|---|---|
| [`apartment/`](apartment/) | 아파트 시세 조사와 인테리어 의사결정·리포트 | [`apartment/AGENTS.md`](apartment/AGENTS.md) |
| [`career-os/`](career-os/) | 커리어 성장, 공고 추천, 면접·지원 준비 자동화 | [`career-os/AGENTS.md`](career-os/AGENTS.md) |
| [`health-care/`](health-care/) | 개인 건강 기록, 진료 준비, 재활 경과 관리 | [`health-care/AGENTS.md`](health-care/AGENTS.md) |
| [`ji-yoon-blog/`](ji-yoon-blog/) | 지융로그 네이버 블로그 콘텐츠와 트렌드 분석 | [`ji-yoon-blog/AGENTS.md`](ji-yoon-blog/AGENTS.md) |
| [`side-projects/`](side-projects/) | 원격 개발 외주 기회와 개인 사이드 프로젝트 운영 | [`side-projects/AGENTS.md`](side-projects/AGENTS.md) |
| [`stock-investment/`](stock-investment/) | 주식·암호화폐 관찰, 학습용 분석, 일일 브리핑 | [`stock-investment/AGENTS.md`](stock-investment/AGENTS.md) |
| [`travel/`](travel/) | 여행별 일정, 예약 정보, 의사결정 기록 관리 | [`travel/AGENTS.md`](travel/AGENTS.md) |

## 공통 구조

각 워크스페이스는 필요에 따라 아래 구조를 사용한다.
자동화가 없는 문서 중심 워크스페이스는 필요한 디렉터리만 둔다.

| 경로 | 역할 |
|---|---|
| `AGENTS.md` | 해당 영역의 작업 규칙과 문서 진입점 |
| `docs/` | 제품 범위, 데이터 구조, 실행 흐름, 의사결정 기록 |
| `config/` | 사람이 관리하는 정책, 기본값, 공개 가능한 설정 |
| `data/` 또는 `private/` | 실행 데이터와 민감한 개인 기록 |
| `scripts/` | 수집, 분석, 알림 등 반복 실행 코드 |
| `.claude/skills/` | 해당 영역에서 사용하는 agent skill의 정본 |
| `logs/` | 실행 이력과 점검 기록 |

비밀 값은 각 워크스페이스의 `.env`에만 둔다.
개인 건강 기록, 지원 전략, 예약 정보처럼 민감한 데이터는
해당 워크스페이스의 비공개 경계를 벗어나지 않는다.

실행 중인 계획은 필요할 때 `tasks/`에 만든다.
완료하거나 폐기한 계획은 검색 대상에 남기지 않고 Git 이력으로 보존한다.

## 공용 자산과 문서

| 경로 | 내용 |
|---|---|
| [`AGENTS.md`](AGENTS.md) | 모든 워크스페이스에 적용되는 공통 운영 규칙 |
| [`.claude/skills/`](.claude/skills/) | 저장소 전역 agent skill 정본 |
| [`.codex/skills/`](.codex/skills/) | Codex에서 사용할 skill 심볼릭 링크 |
| [`docs/code-architecture.md`](docs/code-architecture.md) | 현재 디렉터리 구조와 책임 경계 |
| [`docs/adr/INDEX.md`](docs/adr/INDEX.md) | 모노레포 수준의 주요 결정과 이유 |

`CLAUDE.md`는 각 `AGENTS.md`를 가리키는 심볼릭 링크다.
두 파일을 따로 수정하지 않는다.

## 작업 원칙

- 작업 범위에 맞는 `AGENTS.md`와 책임 문서를 먼저 확인한다.
- 워크스페이스 간 데이터와 자산을 교차 참조하지 않는다.
- 공용 helper에는 특정 워크스페이스의 설정이나 개인 데이터를 의존시키지 않는다.
- 새 정책이나 되돌리기 어려운 구조 결정은 관련 문서 또는 ADR에 먼저 기록한다.
- 외부 발행, 지원서 제출, 예약, 투자 판단처럼 외부 상태를 바꾸는 작업은 해당 워크스페이스의 승인 규칙을 따른다.
- 변경 후에는 범위에 맞는 테스트, 정적 검사, 문서 링크 점검으로 결과를 확인한다.
