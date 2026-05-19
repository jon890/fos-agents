# AGENTS.md — stock-investment 워크스페이스

`~/ai-nodes` 아래 독립 작업 워크스페이스. 모든 에이전트(Claude / Codex / Gemini 등)를 위한 정식 가이드 진입점. `CLAUDE.md`는 이 파일의 심볼릭 링크.

상세 결정·스키마·흐름은 `docs/` 5문서에 분리. 이 파일은 진입점·운영 원칙만 담는다.

## 1. 5문서 라우팅

| 문서 | 무엇이 들어 있는지 | 언제 보는지 |
|---|---|---|
| `docs/prd.md` | 제품 범위·MVP 타깃·기능 표·미연결 항목 | 새 기능 추가 / 우선순위 결정 |
| `docs/data-schema.md` | config (6 json) / data / logs / .env 스키마 | 데이터 파일 변경 / 새 config 도입 |
| `docs/flow.md` | 3 skill 데이터 흐름 (수집→Claude→Discord/git) | 흐름 추가 / 디버깅 |
| `docs/code-architecture.md` | 디렉터리 트리·skill 표준·외부 의존 | 코드 구조 변경 / 새 스킬 추가 |
| `docs/adr.md` | stock-investment 한정 ADR 누적 (현재 ADR-001). 모노레포 레벨: `../docs/adr.md` | 결정의 *왜* |

## 2. tasks/ 영역

planning + plan-and-build 스킬로 운영. 형태: `tasks/plan{N}-<slug>/`.
완료된 plan도 history 보존 — 삭제하지 않는다.

## 3. 목적

주식·암호화폐 모닝 브리핑 + 일일 분석 자동화 (단일 사용자, 매일 재실행 가능).

## 4. 현재 타깃

CRCL (Circle) + BTC + GOOGL/GOOG + QQQ + AI 반도체/인프라.
상세는 `docs/prd.md` 2번·4번.

## 5. 워크플로 진입점

3 skill — 현재는 기존 통합 패턴 (`skills/<name>/scripts/*.sh`). plan002 후 분리 패턴 (`scripts/<name>/` + `.claude/skills/<name>/`) + native skill 진입점:

```bash
# 현재 (plan001 시점)
bash stock-investment/skills/stock-investing-morning-brief/scripts/run_report.sh
bash stock-investment/skills/current-issue-analysis/scripts/run_issue_report.sh
bash stock-investment/skills/daily-stock-analysis-note/scripts/run_daily_note.sh

# plan002 후 (계획)
claude -p "/stock-investing-morning-brief"
claude -p "/current-issue-analysis"
claude -p "/daily-stock-analysis-note"
```

## 6. 외부 의존성

- `_shared/bin/track_task.sh` — 모든 runner self-wrap. **load-bearing**.
- `_shared/lib/extract_claude_result.ts` — claude JSON envelope 파싱 (ai-nodes plan001 통합).
- `claude` CLI — 모든 Claude 호출 의존.
- `career-os/sources/fos-study` — daily-stock-analysis-note만 발행 대상 (cross-workspace 예외, 발행 git repo).

상세는 `docs/code-architecture.md` 외부 의존성 섹션.

## 7. 운영 원칙

- 실시간 거래 / 실 자동화 금지 — 모니터링·브리핑 자동화 한정.
- 광범위 풀-리포 분석 금지 — config json 명시 큐 한정.
- 재무 자문 아님 — 불확실성 명시.
- 수집 데이터·해석 분리 — config / data / docs 책임 분리.
- 모닝 Discord 메시지는 간결 — 상세 자산은 `data/YYYY-MM-DD/`.
- 영구 자산은 워크스페이스 내부 (`~/.openclaw/workspace` 사용 안 함).

## 8. 규칙

- 다른 워크스페이스 (apartment, career-os, travel) 격리 — 교차 참조 금지 (단 career-os/sources/fos-study 발행 예외).
- 재실행 가능 + 날짜 단위 멱등.
- 불확실성 명시 — 검증된 사실과 해석 분리.
- 새 결정은 `docs/adr.md` 누적 (개별 ADR 파일 신설 금지, ai-nodes ADR-018).
- 비밀 정보 (`DISCORD_CHANNEL_ID`)는 `.env` (워크스페이스 root, ADR-021 예정 — plan003에서 실 .env 도입).
