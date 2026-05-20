# Phase 2 — AGENTS.md 한글화·강화 + CLAUDE.md 심링크 + tasks/

travel plan001 phase-02. AGENTS.md를 16줄 영문 → 70+ 라인 한글 표준 + CLAUDE.md 심링크 신설 + tasks/ 디렉터리 정합화.

## 작업 위치

```bash
cd "$(git rev-parse --show-toplevel)"
```

## 관련 docs

- `travel/docs/{prd,data-schema,flow,code-architecture,adr}.md` (phase-01 신설) — 5문서 라우팅 작성용.
- `apartment/AGENTS.md` 또는 `stock-investment/AGENTS.md` — 한글화 표준 패턴.
- `travel/AGENTS.md` (현재) — 한글화 + 강화 대상.

## 변경할 파일

수정:
- `travel/AGENTS.md` (16 → 70+ 라인 한글 표준)

신설:
- `travel/CLAUDE.md` (AGENTS.md 심링크)

`tasks/` 디렉터리는 plan001 작업으로 이미 생성 (tasks/plan001-workspace-standard-bootstrap/). 별도 .gitkeep 불필요.

## 명세

### 1. AGENTS.md 한글 표준 골격

stock-investment / health-care 패턴 차용. travel 도메인 (자동화 0, 문서 중심) 반영:

```markdown
# AGENTS.md — travel 워크스페이스

`~/ai-nodes/travel`는 여행 계획·의사결정·예약 정보를 trip별로 누적 관리하는 독립 워크스페이스. 모든 에이전트(Claude / Codex / Gemini 등)를 위한 정식 가이드 진입점. `CLAUDE.md`는 이 파일의 심볼릭 링크.

상세 결정·스키마·흐름은 `docs/` 5문서에 분리. 이 파일은 진입점·운영 원칙만 담는다.

## 1. 5문서 라우팅

| 문서 | 무엇이 들어 있는지 | 언제 보는지 |
|---|---|---|
| `docs/prd.md` | 제품 범위·기능 (자동화 0, 문서 중심)·미연결 항목 | 새 기능 추가 / 우선순위 |
| `docs/data-schema.md` | trips/<trip-id>/{docs, data, memory, output} 스키마 | 새 trip 추가 / 자료 정리 |
| `docs/flow.md` | 사용자 대화 흐름 (자동화 부재 명시) | 새 trip 시작 / 흐름 검토 |
| `docs/code-architecture.md` | 디렉터리 트리 + 의도된 비대칭 (ADR-001) | 구조 변경 |
| `docs/adr.md` | travel 한정 ADR 누적 (현재 ADR-001) — 모노레포 레벨: `../docs/adr.md` | 결정의 *왜* |

## 2. tasks/ 영역

planning + plan-and-build 스킬로 운영. 형태: `tasks/plan{N}-<slug>/`.
완료된 plan도 history 보존 — 삭제하지 않는다.

## 3. 목적

trip별 의사결정 + 일정 + 예약 정보를 단일 출처로 누적. 단일 사용자 (본인), 자동화 부재, 순수 문서 워크스페이스.

## 4. trip-instance 구조

```
trips/<trip-id>/
├── docs/                # 의사결정·일정·개요 (트립 메인)
│   ├── trip-overview.md     # 예약·고정 정보 (항공/숙소/교통/보험)
│   ├── itinerary.md         # Day별 일정
│   ├── decision-log.md      # 결정 누적
│   └── food-shopping-prep.md  # (선택) trip별 특화 문서
├── data/                # 예약 산출물 + 보조 데이터 (CSV / PDF 등)
├── memory/              # 세션 기록 (날짜별 .md)
└── output/              # 생성 산출물 (PNG / route schematic 등)
```

trip-id 명명 규칙: `<도시-slug>-<YYYY-MM>` (예: `osaka-2026-05`).
워크스페이스 root `docs/index.md`에 모든 trip 인덱스 유지.

## 5. 워크플로 진입점

자동화 0 — runner / cron / native skill 없음. 워크플로 = 사용자 대화 + Claude 보조 문서 작성:

```bash
# 새 trip 시작
mkdir -p travel/trips/<도시-slug>-<YYYY-MM>/{docs,data,memory,output}
# Claude 대화로 trip-overview.md / itinerary.md / decision-log.md 누적

# trip 인덱스 갱신
# travel/docs/index.md 안 trip 목록 추가
```

특정 trip 자동화가 필요해지면 `scripts/` + `.claude/skills/` 도입 — ADR-002~로 별도 결정 (ADR-001 의도된 비대칭 supersede).

## 6. 외부 의존성

- `claude` CLI — 대화 + 문서 작성 보조 (유일 의존성).
- 다른 의존 0 — Python / Bun / agent-browser / `_shared/` 모두 미사용.
- workspace root `.env` 부재 — 비밀 정보 0 (예약 정보는 *문서*로 보관, 환경 변수 아님).

상세는 `docs/code-architecture.md` 외부 의존성 섹션.

## 7. 운영 원칙

- 자동 예약 / 가격 수집 자동화 / 외부 API 호출 *금지* — 사용자 의도에 따른 *수동 trip 관리*.
- trip별 폴더 격리 — 한 trip의 변경이 다른 trip에 영향 0.
- 결정 시점마다 `docs/decision-log.md`에 라인 append.
- 출발 전·후 review — 사용자 요청 시 Claude 보조.
- 예약 정보 외부 노출 금지 — 공개 블로그 / 외부 git push 안 함.
- 영구 자산은 워크스페이스 내부 (`~/.openclaw/workspace` 사용 안 함).

## 8. 규칙

- 다른 워크스페이스 (apartment, career-os, stock-investment, health-care) 격리 — 교차 참조 금지.
- 새 결정은 `docs/adr.md` 누적 (개별 ADR 파일 신설 금지, ai-nodes ADR-018).
- 새 trip 추가 시 — `trips/<trip-id>/` 구조 따라 mkdir + `docs/index.md` 인덱스 갱신.
- 의도된 비대칭 (scripts/.claude/skills/ 부재) — ADR-001 참조. 자동화 도입 시 별도 plan + ADR.
```

### 2. CLAUDE.md 심링크

```bash
cd "$(git rev-parse --show-toplevel)"
cd travel
ln -sf AGENTS.md CLAUDE.md
cd "$(git rev-parse --show-toplevel)"

# 검증
test -L travel/CLAUDE.md && readlink travel/CLAUDE.md | grep -q "^AGENTS.md$"
```

## 성공 기준

```bash
cd "$(git rev-parse --show-toplevel)"

# 1. AGENTS.md 한글 + 라인 70+
LINES=$(wc -l < travel/AGENTS.md)
test "$LINES" -ge 70 || (echo "FAIL: AGENTS.md $LINES 라인" && exit 1)

HANGUL=$(grep -cP "[가-힣]" travel/AGENTS.md)
test "$HANGUL" -ge 30 || (echo "FAIL: AGENTS 한글 $HANGUL 라인" && exit 1)
echo "[AGENTS 라인 $LINES, 한글 $HANGUL] OK"

# 2. AGENTS 5문서 라우팅 + 외부 의존성 섹션
grep -q "## 1. 5문서 라우팅" travel/AGENTS.md
grep -q "## 6. 외부 의존성" travel/AGENTS.md
grep -q "trip-instance 구조\|## 4. trip-instance" travel/AGENTS.md
echo "[AGENTS 섹션 골격] OK"

# 3. CLAUDE.md 심링크
test -L travel/CLAUDE.md
readlink travel/CLAUDE.md | grep -q "^AGENTS.md$"
echo "[CLAUDE 심링크] OK"

# 4. tasks/ 디렉터리 (plan001 자체로 생성됨)
test -d travel/tasks/plan001-workspace-standard-bootstrap
echo "[tasks/plan001] OK"

# 5. 의도된 비대칭 명시
grep -q "의도된 비대칭" travel/AGENTS.md
echo "[비대칭 명시] OK"

# 6. 영문 옛 골격 잔존 0
! grep -q "^# AGENTS.md - travel workspace$" travel/AGENTS.md
! grep -q "^## 구조$" travel/AGENTS.md
echo "[옛 골격 잔존 0] OK"

# 7. trip-instance / index.md 보존
test -f travel/docs/index.md
test -d travel/trips/osaka-2026-05
echo "[trip + index.md 보존] OK"

# 8. 스코프 격리 — 5문서 phase-01 산출 보존
! git status --porcelain travel/docs/{prd,data-schema,flow,code-architecture,adr}.md | grep -q "^"
echo "[5문서 보존] OK"
```

## 금지 사항

- 5문서 수정 (phase-01 산출 보존).
- trip-instance 데이터 / index.md 변경.
- scripts/.claude/skills/.env/config 생성 (의도된 비대칭).
- ADR 본문 수정.
- ai-nodes/docs/workspace-structure.md / 모노레포 AGENTS.md 수정 (phase-03 책임).
- section mark (U+00A7) 직접 입력.

## commit

```bash
cd "$(git rev-parse --show-toplevel)"
git add travel/AGENTS.md travel/CLAUDE.md

git status --porcelain | grep -E "^(A|M|D|R) " | head
# 의도 외 staged 파일 0.

git commit -m "docs(travel): AGENTS.md 한글화·강화 + CLAUDE.md 심링크 (plan001 phase-02)

- AGENTS.md 16줄 영문 → 70+ 라인 한글 표준 (5문서 라우팅 / tasks / 목적 / trip-instance / 진입점 / 외부 의존성 / 운영 원칙 / 규칙 8 섹션)
- CLAUDE.md 심링크 (Claude Code 자동 로드)
- ADR-001 의도된 비대칭 표기 — scripts/.claude/skills/.env/config 부재

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

push 없음 (phase-04 책임).

## PHASE_BLOCKED / PHASE_FAILED

- AGENTS 라인 70 미만 — `PHASE_FAILED: 한글화·강화 부실`.
- 한글 30 미만 — `PHASE_FAILED: 한글화 부실`.
- CLAUDE 심링크 타깃 mismatch — `PHASE_FAILED: 심링크 점검`.
- 5문서 수정 — `PHASE_FAILED: scope creep`.
- 의도 외 staged 파일 — `PHASE_BLOCKED`.
