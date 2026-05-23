# AGENTS.md — apartment 워크스페이스

`~/ai-nodes` 아래 독립 작업 워크스페이스. `CLAUDE.md`는 이 파일의 심볼릭 링크.
상세 결정·스키마·흐름은 아래 5문서에 분리. 이 파일은 진입점·운영 원칙만 담는다.

## 1. 5문서 라우팅

| 문서 | 무엇이 들어 있는지 | 언제 보는지 |
|---|---|---|
| `docs/prd.md` | 제품 범위·MVP 타깃·기능 표·Guri buy-search 운영 정책·성공 기준 | 새 기능 추가 / 우선순위 결정 |
| `docs/data-schema.md` | config (4 json) / data / logs / .env 스키마 | 데이터 파일 변경 / 새 config 도입 |
| `docs/flow.md` | 명령별 데이터 흐름 (daily-report 12 step + interior-digest 5 step) | 새 흐름 추가 / 디버깅 |
| `docs/code-architecture.md` | 디렉터리 트리·skill 표준·외부 의존·Runner 패턴 | 코드 구조 변경 / 새 스킬 추가 |
| `docs/adr.md` | apartment 한정 ADR 누적 (현재 ADR-001~008). 모노레포 레벨은 `../docs/adr.md` | 결정의 *왜* |

## 2. tasks/ 영역

planning + plan-and-build 스킬로 운영. 형태: `tasks/plan{N}-<slug>/`.
완료된 plan도 history 보존 — 삭제하지 않는다.

## 3. 목적

부동산 시장 리포트 + 인테리어 레퍼런스 자동화 (단일 사용자, 매일 재실행 가능).

## 4. 현재 타깃

엘지원앙아파트 LG원앙 + 포커스 59A + 구리 럭키아파트 5동 1004호 24평 + 광역 Guri buy-search.
상세는 `docs/prd.md` 2번 + 6번.

## 5. 워크플로 진입점

```bash
# native skill 진입점
claude -p "/apartment-daily-report"
claude -p "/apartment-interior-reference-digest"

# 또는 직접 호출
bash apartment/scripts/apartment-daily-report/run_report.sh
bash apartment/scripts/apartment-interior-reference-digest/run_with_claude.sh "오늘의 인테리어 추천"
bash apartment/scripts/apartment-daily-report/run_smoke_test.sh
```

## 6. 외부 의존성

- `_shared/bin/track_task.sh` — 모든 러너 래핑. **load-bearing**.
- `_shared/lib/extract_claude_result.ts` — claude JSON envelope 파싱 (ai-nodes plan001 마이그).
- `claude` CLI — 모든 Claude 호출 의존.
- `agent-browser` CLI — JS-heavy 페이지 수집 (ADR-001).
- Bun runtime — TypeScript 헬퍼 실행. 데이터 처리/JSON 파싱/수집기 계층은 TS 우선, 단순 orchestration runner는 shell 허용.
- Interior reference cron은 Claude native skill의 웹 검색/Fetch/문서 갱신이 필요하므로 운영 runner에서 `--permission-mode bypassPermissions`를 사용한다.

상세는 `docs/code-architecture.md` 5번.

## 7. 운영 원칙

- focus-unit 위장 금지 — 실제 매물만 기록.
- raw fetched 데이터는 untrusted — 검증 후 판단.
- 검증 안 된 입주 가능 여부 단정 금지.
- 매물 가격 발명 금지 — source 실패 시 raw 보존.
- `.env`는 워크스페이스 root (`apartment/.env`). ai-nodes ADR-004 표준.
- 영구 자산은 `~/.openclaw/workspace` 아닌 워크스페이스 내부.

## 8. 규칙

- 다른 워크스페이스(career-os, stock-investment, travel) 격리 — 교차 참조 금지.
- 재실행 가능 + 날짜 단위 멱등.
- 불확실성 명시 — source 실패 시 추측으로 공백 메우지 않고 기록.
- 새 결정은 `docs/adr.md` 누적 (개별 ADR 파일 신설 금지, ai-nodes ADR-004).
- 런타임 상태는 `logs/task-runs.jsonl` 단일 출처 — 이 파일에 박지 않는다.
