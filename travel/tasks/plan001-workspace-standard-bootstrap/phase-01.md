# Phase 1 — 5문서 신설 + travel ADR-001 (의도된 비대칭)

travel plan001 phase-01. ai-nodes 표준 5문서 신설 + ADR-001 (workspace-level scripts/.claude/skills/ 의도된 비대칭 결정 기록).

본 phase는 *5문서 신설*만. AGENTS / CLAUDE / tasks/는 phase-02. workspace-structure는 phase-03. trip-instance 데이터 / index.md 변경 0.

## 작업 위치

run-phases.py가 `cwd=travel/`로 실행:

```bash
cd "$(git rev-parse --show-toplevel)"
```

## 관련 docs

**5문서 작성 표준**:
- `docs/docs-style.md` — ADR-005 6 패턴 + 한자어 회피 + 거울 구조.
- `docs/workspace-structure.md` 4번 — 5문서 책임 영역 청사진.
- `skills/planning/SKILL.md` 5문서 공통 작성 원칙.

**참고 패턴**:
- `stock-investment/docs/{prd,data-schema,flow,code-architecture,adr}.md` — 가장 가까운 패턴 (5문서 신설된 활성 운영 워크스페이스).
- `health-care/docs/{prd,data-schema,flow,code-architecture,adr}.md` — 의료·운영 도메인 5문서 패턴.

**travel 도메인**:
- `travel/AGENTS.md` — 현재 16줄, trip-instance 구조 명시.
- `travel/docs/index.md` — trip 인덱스 (보존, 5문서 외 동적 자료).
- `travel/trips/osaka-2026-05/` — 활성 trip 예시.

## 신설할 파일

5개 신설:

- `travel/docs/prd.md`
- `travel/docs/data-schema.md`
- `travel/docs/flow.md`
- `travel/docs/code-architecture.md`
- `travel/docs/adr.md`

본 phase에서 *기존 파일 수정 금지*. *trip-instance 데이터 / index.md 변경 0*.

## 명세

### 1. prd.md 신설

ai-nodes 표준 (`stock-investment/docs/prd.md` 또는 `health-care/docs/prd.md` 참고). 섹션:

- 목적 (trip 계획 + 의사결정 + 일정 + 예약 관리 단일 사용자 워크스페이스)
- 사용자 (단일 사용자 = 본인)
- 기능 목록 — *자동화 부재* — *대화·문서 작성·결정 기록*만:
  - trip 디렉터리 생성 (trips/<trip-id>/)
  - decision-log.md (결정 누적)
  - itinerary.md (일정)
  - trip-overview.md (예약·고정 정보)
  - data/ (예약 산출물, 보조 데이터)
- 산출물 경로 정책 — `trips/<trip-id>/{docs, data, memory, output}/`
- 비기능 요구사항 — *재실행 가능성 불요* (수동 작업) + *비밀 정보 0* (예약 외부 노출 안 함) + *워크스페이스 격리*
- 의도적으로 안 하는 것 — 자동 예약, 가격 수집 자동화, 외부 API 호출
- 미연결 / 보류 항목 — 자동화 도입 시점 결정 (현재 *순수 문서*).
- 성공 기준 — trip별 의사결정 / 일정 / 예약 정보 단일 출처 유지.

### 2. data-schema.md 신설

trip-instance 디렉터리 스키마 명세:

- `trips/<trip-id>/docs/`:
  - `trip-overview.md` — 예약·고정 정보 (항공 / 숙소 / 교통 / 보험)
  - `itinerary.md` — Day별 일정 (체크인 / 활동 / 식사 / 이동)
  - `decision-log.md` — 결정 누적 (Y-Y-Y 형식 또는 자유 형식)
  - `food-shopping-prep.md` 등 — trip별 특화 문서
- `trips/<trip-id>/data/`:
  - 예약 PDF / 보딩패스 / 지도 캡처 / CSV 등
- `trips/<trip-id>/memory/`:
  - 세션 기록 (날짜별 .md)
- `trips/<trip-id>/output/`:
  - 산출물 PNG / 마크다운 (route schematic 등)
- 워크스페이스 root:
  - `docs/index.md` — trip 인덱스 (모든 trip 목록 유지)
  - `data/audit/` — workspace-audit 결과
  - `memory/` — 워크스페이스 레벨 세션 기록
  - `logs/.usage-status` — openclaw 사용 메타

trip-id 명명 규칙 — `<도시-slug>-<YYYY-MM>` (예: `osaka-2026-05`).

### 3. flow.md 신설

데이터 흐름 (자동화 부재 — *사용자 대화 흐름* 중심):

- trip 생성: 사용자 대화 → trip-id 결정 → `trips/<trip-id>/` mkdir → docs/ + data/ + memory/ 초기화
- itinerary 작성: 사용자 입력 + Claude 보조 정리 → `docs/itinerary.md`
- decision-log: 결정 시점마다 라인 append → `docs/decision-log.md`
- 예약·고정 정보: `docs/trip-overview.md`에 누적
- 출발 직전 — Day별 체크리스트 (Claude 보조 정리) → `output/`
- trip 종료 후 — `docs/index.md`에 완료 표시 또는 archive

ai-nodes 다른 워크스페이스 cron / runner / Claude CLI 호출 흐름과 *근본적으로 다름* — 명시.

### 4. code-architecture.md 신설

디렉터리 트리 + 계층 + 외부 의존성:

- travel/ 트리 (워크스페이스 root):
  - AGENTS.md / CLAUDE.md → AGENTS.md
  - docs/ (5문서 + index.md)
  - tasks/ (plan 사이클 영역)
  - trips/<trip-id>/ (trip-instance, 동적)
  - data/ (워크스페이스 레벨 audit 등)
  - memory/ (워크스페이스 레벨 세션)
  - logs/ (.usage-status)

- *의도된 비대칭* (ADR-001):
  - **scripts/ 부재** — 자동화 0, runner 0
  - **.claude/skills/ 부재** — workspace-level skill 0 (단 *trip-instance docs 안* 컨텍스트는 trip별)
  - **config/ 부재** — runtime 설정 0
  - **.env 부재** — 비밀 정보 0 (예약 정보는 *문서*로 보관, 환경 변수 아님)

- 외부 의존성:
  - `claude` CLI — 대화 + 문서 작성 보조 (필수, 다른 워크스페이스와 공통)
  - 다른 의존 0 (Python / Bun / agent-browser / _shared/ 모두 0)

ADR-006 분리 패턴이 *적용되지 않음*이 ADR-001 결정 핵심.

### 5. adr.md 신설

Quick Index + ADR-001 본문:

```markdown
# ADR — travel

travel 워크스페이스 아키텍처 결정 누적. 새 결정은 가장 아래에 추가.

형식: `## ADR-N — 제목` + Status / Date 라인 + 맥락 / 결정 / 결과 3섹션.

모노레포 레벨 ADR: ../docs/adr.md.

---

## Quick Index

| ADR | 제목 | Status | 한 줄 요약 |
|---|---|---|---|
| ADR-001 | 워크스페이스 ai-nodes 표준 적용 + scripts/.claude/skills/ 의도된 비대칭 | Accepted | 5문서 + AGENTS + CLAUDE 심링크 + tasks/ 적용. scripts/ + .claude/skills/는 자동화 0 + workspace-level skill 0이라 의도된 부재 (의도된 비대칭) |

---

## ADR-001 — 워크스페이스 ai-nodes 표준 적용 + scripts/.claude/skills/ 의도된 비대칭

**Status**: Accepted
**Date**: 2026-05-20

### 맥락

travel은 ai-nodes 5번째 워크스페이스 중 4번째까지 (apartment / career-os / stock-investment / health-care) 표준 적용 완료 후 마지막 미적용. 발견 상태:

- AGENTS.md 16줄 영문 + 한글 혼합, 섹션 2개 (구조 / 운영 원칙)
- CLAUDE.md 심링크 부재
- 5문서 부재 (docs/index.md만 존재 — trip 인덱스)
- tasks/ 부재
- scripts/ 부재, .claude/skills/ 부재, config/ 부재, .env 부재
- 활성 운영 — trips/osaka-2026-05/ 1 trip 활성
- cron / 자동화 등록 0

travel의 *본질*은 *문서 워크스페이스* — 사용자가 trip별로 의사결정·일정·예약 정보를 마크다운으로 누적. 다른 워크스페이스 (apartment / career-os / stock-investment / health-care)는 *자동화 + 일자별 산출물 + cron/Discord 알림 + Claude CLI 호출 흐름*이 핵심이지만 travel은 *대화 + 문서 작성*만 책임.

### 결정

ai-nodes 표준 *부분 적용* — *의도된 비대칭*:

**적용**:
- 5문서 (prd / data-schema / flow / code-architecture / adr) — 워크스페이스 컨벤션 일관성 + AI 에이전트 컨텍스트 단일 출처.
- AGENTS.md 한글화 + 강화 (16 → 70+ 라인) — 다른 워크스페이스 수준.
- CLAUDE.md 심링크 — Claude Code 자동 로드 표준.
- tasks/plan{N}-<slug>/ — plan 사이클 운영.

**부재 (의도된 비대칭)**:
- `scripts/` — runner / 자동화 0. 도입 시점은 *trip 자동 일정 생성 / 예약 가격 수집* 등 명확한 자동화 요구사항 발생 시 별도 plan.
- `.claude/skills/` — workspace-level skill 0. 단 trip-instance 안 컨텍스트 (`trips/<trip-id>/docs/`)가 Claude 호출의 사실상 진입점.
- `config/` — runtime 설정 0.
- `.env` — 비밀 정보 0. 예약 정보는 *문서*에 보관 (외부 노출 안 함).

**거절한 대안**:

- 완전 표준 강행 (scripts/ + .claude/skills/ 빈 디렉터리) — 빈 placeholder는 *실 의미 없음* + 향후 *실 자동화 도입 시 재설계 필요*. 의도된 비대칭이 정직한 표기.
- 경량 적용 (CLAUDE 심링크 + AGENTS 한글화만) — 5문서 부재가 워크스페이스 정합성 + AI 에이전트 컨텍스트 단일 출처 미흡. trip 추가 시 컨벤션 표류 위험.

### 결과

- 5문서 + AGENTS / CLAUDE 일관성 — 다른 4 워크스페이스와 컨텍스트 로드 패턴 동일.
- workspace-structure.md 매트릭스 travel 컬럼 — 적용 / 의도된 비대칭 / 부재 셋으로 명시.
- 향후 자동화 도입 시 — 별도 plan에서 ADR-002 (scripts/ 도입) + ADR-003 (.claude/skills/ 도입) 추가.
- trip-instance 영역 변경 0 — trips/<trip-id>/ 구조는 ADR-001 적용 영역 외.

**적용**: plan001 phase-01~04.
```

## 성공 기준

```bash
cd "$(git rev-parse --show-toplevel)"

# 1. 5문서 모두 존재 + 충실
for f in prd data-schema flow code-architecture adr; do
  test -s "travel/docs/$f.md" || (echo "FAIL: travel/docs/$f.md 부재 또는 빈" && exit 1)
  LINES=$(wc -l < "travel/docs/$f.md")
  test "$LINES" -ge 25 || (echo "FAIL: travel/docs/$f.md $LINES 라인 부실" && exit 1)
done
echo "[5문서 충실] OK"

# 2. adr.md ADR-001 본문 + Quick Index
grep -q "^## ADR-001" travel/docs/adr.md
grep -q "Quick Index" travel/docs/adr.md
grep -q "의도된 비대칭" travel/docs/adr.md
echo "[ADR-001 + 비대칭 명시] OK"

# 3. trip-instance 자료 보존
test -d travel/trips/osaka-2026-05/docs
test -f travel/docs/index.md
! git status --porcelain travel/trips/ | grep -q "."
! git status --porcelain travel/docs/index.md | grep -q "."
echo "[trip + index.md 보존] OK"

# 4. docs-style § 사용 0
! grep -n "§" travel/docs/*.md
echo "[section mark 0] OK"

# 5. 스코프 격리 — AGENTS / CLAUDE / tasks/ / trips/ 변경 0
git diff HEAD --name-only | grep -v "^travel/docs/\|^travel/tasks/plan001" && (echo "FAIL: scope creep" && exit 1) || true
echo "[스코프 격리] OK"
```

## 금지 사항

- AGENTS.md / index.md 수정 (phase-02 책임).
- trips/ 또는 data/audit/ 또는 memory/ 변경.
- scripts/ / .claude/skills/ / config/ / .env 생성 (의도된 비대칭).
- ADR 신설 (ADR-001 외).
- workspace-structure.md 수정 (phase-03 책임).
- section mark (U+00A7) 직접 입력.

## commit

```bash
cd "$(git rev-parse --show-toplevel)"
git add travel/docs/prd.md travel/docs/data-schema.md travel/docs/flow.md travel/docs/code-architecture.md travel/docs/adr.md

git status --porcelain | grep -E "^(A|M|D|R) " | head
# 의도 외 staged 파일 0.

git commit -m "docs(travel): 5문서 신설 + ADR-001 의도된 비대칭 (plan001 phase-01)

5문서:
- prd.md: 목적 + 기능 (대화·문서 중심, 자동화 0) + 미연결 항목
- data-schema.md: trips/<trip-id>/{docs,data,memory,output} + index.md
- flow.md: 사용자 대화 흐름 (자동화 부재 명시)
- code-architecture.md: 디렉터리 트리 + 의도된 비대칭 (scripts/.claude/skills/.env/config 부재)
- adr.md: Quick Index + ADR-001 (의도된 비대칭 결정 본문)

ADR-001: 자동화 0 + workspace-level skill 0인 데이터 워크스페이스 특성상 scripts/.claude/skills/ 빈 placeholder 의미 없음. 5문서 + AGENTS + CLAUDE + tasks/만 적용.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

push 없음 (phase-04 책임).

## PHASE_BLOCKED / PHASE_FAILED

- 5문서 중 부재 — `PHASE_FAILED: docs 신설 누락`.
- 본문 부실 (25 라인 미만) — `PHASE_FAILED: docs 부실`.
- ADR-001 비대칭 명시 누락 — `PHASE_FAILED: ADR-001 본문 부실`.
- 스코프 외 변경 — `PHASE_FAILED: scope creep`.
- 의도 외 staged 파일 — `PHASE_BLOCKED`.
