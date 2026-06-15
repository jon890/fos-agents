# ai-nodes 모노레포

재사용 가능한 작업 워크스페이스들의 단일 출처(source-of-truth) 모노레포.
각 워크스페이스는 자체 skills · config · data · logs를 가진 **독립 영역**이며, 공용 자산만 루트 `_shared/`와 `.claude/skills/`에 둔다.

정식 가이드는 [`AGENTS.md`](AGENTS.md) (CLAUDE.md는 본 파일의 심볼릭 링크).
본 README는 개요만 담고, 진입점·정책 상세는 AGENTS.md와 각 `<workspace>/AGENTS.md`를 역참조한다.

## 워크스페이스

워크스페이스 5개. 모두 Claude native skill 직접 호출로 실행된다 (ADR-011).

| 워크스페이스 | 목적 | 진입점 |
|---|---|---|
| [`apartment/`](apartment/) | 일일 아파트 시세 + 인테리어 레퍼런스 리포트 | `claude -p "/apartment-daily-report"` 외 1개 |
| [`career-os/`](career-os/) | 면접·커리어 준비 자동화 (학습·question bank·position 추천 등) | native skill 7개 (`/study-pack-writer` 외) |
| [`stock-investment/`](stock-investment/) | 일일 주식·이슈 모니터링 + 모닝 브리핑 | `claude -p "/stock-investing-morning-brief"` 외 |
| [`travel/`](travel/) | 여행별 일정·결정 로그 관리 | `trips/<trip-id>/` 폴더 단위 운영 |
| [`health-care/`](health-care/) | 무릎 재활 daily 체크인 (cron 08:30 KST) | `claude -p "/daily-knee-rehab-checkin"` 외 |

각 워크스페이스는 자체 `AGENTS.md` + `docs/`를 가진다.
워크스페이스 작업은 그 안의 `AGENTS.md`를 먼저 확인.
진입점 전체 목록과 산출물 경로는 [`AGENTS.md`](AGENTS.md) 3번 섹션 참조.

## 공용 자산

| 디렉터리 | 내용 |
|---|---|
| [`_shared/lib/`](_shared/lib/) | Bun TypeScript 공용 헬퍼 (현재 `notify_discord.ts` 정본 1개) |
| [`_shared/types/`](_shared/types/) | 공용 TS 타입 (`index.ts`) |
| [`.claude/skills/`](.claude/skills/) | 저장소 전역 Claude Code 스킬 (`agent-browser`, `planning`, `plan-and-build`, `workspace-audit`, `docs-check`). `.codex/skills/`는 같은 본체를 가리키는 심링크 |
| [`docs/`](docs/) | 모노레포 레벨 — `adr.md`, `workspace-structure.md`, `docs-style.md` |

공용은 **워크스페이스 무관 헬퍼만** 둔다 (ADR-001).
워크스페이스 한정 헬퍼는 `<workspace>/scripts/<skill>/` 내부에 둔다 (ADR-031).

## 아키텍처 원칙

- 모든 워크스페이스 실행은 native skill 직접 호출 (`claude -p "/<skill>"`) 또는 thin wrapper `run_with_claude.sh` (ADR-011).
  - thin wrapper는 `.env` 로드 + Discord 알림 + stdout 폴백만 담당.
  - 옛 `track_task.sh` self-wrap + `extract_claude_result.ts` 외부 subprocess 패턴은 폐기.
- 분리 표준 (ADR-006): `<workspace>/scripts/<name>/` 실행 파일 + `<workspace>/.claude/skills/<name>/` 컨텍스트 자산.
- 워크스페이스 간 자산 교차 참조 금지. 공용은 `_shared/`와 루트 `.claude/skills/`만.
- 신규 결정은 모노레포 `docs/adr.md` 또는 워크스페이스 `<workspace>/docs/adr.md`에 누적.

## Git 정책

- 무시 대상: `.omc/`, `.claude/` 일부, `**/data/`, `**/logs/`, `**/tmp/`, `*.result.json` (상세는 `.gitignore`).
- 중첩 저장소 주의: `career-os/sources/fos-study/`는 별도 동기 저장소 (`github.com/jon890/fos-study`).
- 커밋 메시지: Conventional Commits + 한글 subject. `<type>(<scope>): <subject>`. 상세는 [`AGENTS.md`](AGENTS.md) 7번 섹션.

## 자세한 가이드

- 에이전트(Claude / Codex / Gemini)용 정식 가이드: [`AGENTS.md`](AGENTS.md).
- 워크스페이스별 진실 출처: 해당 `<workspace>/AGENTS.md`.
- 워크스페이스 표준 청사진: [`docs/workspace-structure.md`](docs/workspace-structure.md).
- docs / ADR 형식 정책: [`docs/docs-style.md`](docs/docs-style.md).
