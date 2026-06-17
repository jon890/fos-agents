# ai-nodes 모노레포

재사용 가능한 작업 워크스페이스들의 모노레포다.
각 워크스페이스는 자체 skill, config, data, logs, docs를 가진 독립 영역이다.
공용 자산만 루트 `_shared/`와 `.claude/skills/`에 둔다.

정식 가이드는 [`AGENTS.md`](AGENTS.md)다.
`CLAUDE.md`는 `AGENTS.md`의 심볼릭 링크다.

## 워크스페이스

| 워크스페이스 | 목적 | 진입점 |
|---|---|---|
| [`apartment/`](apartment/) | 아파트 시세와 인테리어 리포트 | [`apartment/AGENTS.md`](apartment/AGENTS.md) |
| [`career-os/`](career-os/) | 면접과 커리어 준비 자동화 | [`career-os/AGENTS.md`](career-os/AGENTS.md) |
| [`stock-investment/`](stock-investment/) | 일일 주식과 이슈 모니터링 | [`stock-investment/AGENTS.md`](stock-investment/AGENTS.md) |
| [`travel/`](travel/) | 여행별 일정과 결정 로그 | [`travel/AGENTS.md`](travel/AGENTS.md) |
| [`health-care/`](health-care/) | 무릎 재활 체크인 | [`health-care/AGENTS.md`](health-care/AGENTS.md) |

워크스페이스 작업은 해당 `AGENTS.md`를 먼저 확인한다.

## 공용 자산

| 경로 | 내용 |
|---|---|
| [`_shared/lib/`](_shared/lib/) | 워크스페이스 무관 Bun TypeScript helper |
| [`_shared/types/`](_shared/types/) | 공용 TypeScript type |
| [`.claude/skills/`](.claude/skills/) | 저장소 전역 agent skill 정본 |
| [`docs/code-architecture.md`](docs/code-architecture.md) | 루트와 워크스페이스 구조 |
| [`docs/adr/INDEX.md`](docs/adr/INDEX.md) | 모노레포 레벨 의사결정 |
| [`docs/docs-style.md`](docs/docs-style.md) | 문서 작성 형식 |

## 문서

- 에이전트 공통 가이드: [`AGENTS.md`](AGENTS.md)
- 현재 구조와 새 워크스페이스 추가: [`docs/code-architecture.md`](docs/code-architecture.md)
- 결정의 이유: [`docs/adr/INDEX.md`](docs/adr/INDEX.md)
- 문서 작성 형식: [`docs/docs-style.md`](docs/docs-style.md)

각 워크스페이스의 상세 정책과 실행 경로는 해당 워크스페이스의 `AGENTS.md`와 `docs/`를 따른다.
