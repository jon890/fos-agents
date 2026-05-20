# Phase 1 — ADR-002 + .env + AGENTS/code-architecture/workspace-structure 정합

travel plan002 phase-01. `.env` 도입 + ADR-002 신설 (ADR-001 부분 supersede) + 문서 정합화.

## 작업 위치

```bash
cd "$(git rev-parse --show-toplevel)"
```

## 관련 docs

- `travel/docs/adr.md` — ADR-002 append 대상 + Quick Index 갱신.
- `travel/AGENTS.md` L72 ".env 부재" 정합 정정.
- `travel/docs/code-architecture.md` — 의도된 비대칭 영역 (`.env` 제외).
- `ai-nodes/docs/workspace-structure.md` — 매트릭스 travel `.env` 컬럼 N/A→O + 의도된 비대칭 표 갱신.
- `~/.openclaw/cron/jobs.json` — 5 비활성 cron 채널 ID = `1498642302602580029` (오사카 trip 한정, enabled=False).

## 변경할 파일

신설:
- `travel/.env` (gitignore — DISCORD_CHANNEL_ID + TZ)
- `travel/.env.example` (template, git tracked)

수정:
- `travel/docs/adr.md` — ADR-002 본문 append + Quick Index 행 추가 + ADR-001 본문에 supersede 표기 (선택)
- `travel/AGENTS.md` — 6번 외부 의존성 섹션 `.env` 부재 표기 정합화
- `travel/docs/code-architecture.md` — 의도된 비대칭 영역에서 `.env` 제외 (`scripts/.claude/skills/config/`만 부재)
- `ai-nodes/docs/workspace-structure.md` — 매트릭스 travel `.env` N/A → O + L155-160 비대칭 표 갱신

## 명세

### 1. travel/.env 신설

```bash
cd "$(git rev-parse --show-toplevel)"
cat > travel/.env <<'EOF'
# travel 워크스페이스 환경 변수.
# .gitignore에 .env 패턴 — git tracked 안 됨.
# 출처: ~/.openclaw/cron/jobs.json (오사카 trip 한정 5 비활성 cron 채널).

DISCORD_CHANNEL_ID=1498642302602580029
TZ=Asia/Seoul
EOF
```

### 2. travel/.env.example 신설

```bash
cat > travel/.env.example <<'EOF'
# travel 워크스페이스 환경 변수 template.
# 실 .env는 워크스페이스 root에 위치 (gitignore).
# travel ADR-002로 도입 — ADR-001 .env 부재 결정 부분 supersede.

# Discord 알림 채널 (trip 활성 cron 또는 수동 호출 시 사용)
DISCORD_CHANNEL_ID=
# 예: travel 전용 채널 (cron job env에서 추출)

# 타임존
TZ=Asia/Seoul
EOF
```

### 3. travel/docs/adr.md — ADR-002 신설

**Quick Index 표에 행 추가** (ADR-001 다음):

```
| ADR-002 | .env 도입 — DISCORD_CHANNEL_ID | Accepted | ADR-001 .env 부재 결정 부분 supersede. 5 비활성 trip 한정 cron이 평문 보관하던 채널 ID를 .env로 이전. scripts/.claude/skills/config 부재는 유지 |
```

**ADR-002 본문 append** (adr.md 끝):

```markdown
## ADR-002 — .env 도입 (DISCORD_CHANNEL_ID)

**Status**: Accepted (부분 supersedes ADR-001 .env 부재 결정)
**Date**: 2026-05-20

### 맥락

ADR-001 (plan001 phase-01)에서 travel은 `.env` 부재를 *의도된 비대칭*으로 결정. 단 plan001 audit 시점에 발견된 사실:

- `~/.openclaw/cron/jobs.json` 안 5 cron job (오사카 trip 한정, 모두 enabled=False) 의 `delivery.to`에 Discord 채널 ID `1498642302602580029` *평문 보관*.
- 다른 4 워크스페이스 (apartment / career-os / stock-investment / health-care) 모두 `.env`에 DISCORD_CHANNEL_ID 보관 — 모노레포 일관성.
- travel 자동화 0이지만 *trip 활성 시 cron 활성화 또는 수동 호출 시* 채널 ID 사용 가능성 존재.

ADR-001은 *자동화 0 + 비밀 정보 0* 가정으로 `.env` 부재 결정. 실제로는 *cron payload 안 평문 채널 ID*가 *비밀 영역*에 해당. 결정 정합화 필요.

### 결정

`.env` 도입 — `DISCORD_CHANNEL_ID=1498642302602580029` + `TZ=Asia/Seoul`. `.env.example` template git tracked. `.env`는 gitignore 패턴 자동 무시.

ADR-001의 *.env 부재* 결정 **부분 supersede** — `.env`는 도입. 단 `scripts/` / `.claude/skills/` / `config/` 부재는 *유지* (자동화 0 + workspace-level skill 0 가정 변경 없음).

**거절한 대안**:

- cron payload 안 channel ID 평문 유지 — 모노레포 4 워크스페이스와 일관성 미흡. trip 활성화 시 변경 비용.
- 완전 ADR-001 supersede (scripts/.claude/skills/ 도입까지) — 자동화 운영 의도가 ADR-002 시점에 명확하지 않음. 도입 시점에 ADR-003 별도 결정.

### 결과

- 5 워크스페이스 `.env` (workspace root) 컬럼 모두 O — ai-nodes/docs/workspace-structure.md 매트릭스 정합화.
- 향후 trip 활성 cron 활성화 시 channel ID env 참조 가능 (5 비활성 cron의 payload는 별개 — openclaw 측 자산이라 ai-nodes 측 수정 안 함).
- `scripts/` / `.claude/skills/` / `config/` 부재 결정은 ADR-001 의도된 비대칭 그대로 유지.

**적용**: travel plan002 phase-01. `.env` + `.env.example` 신설 + 문서 정합화.
```

### 4. travel/AGENTS.md 6번 외부 의존성 정합

옛 (현재):
```
- workspace root `.env` 부재 — 비밀 정보 0 (예약 정보는 *문서*로 보관, 환경 변수 아님).
```

새:
```
- `.env` (workspace root, gitignore) — `DISCORD_CHANNEL_ID` (trip 활성 cron 또는 수동 호출 시 사용, plan002 ADR-002 도입). 예약 정보 본문은 *문서*로 보관 (환경 변수 아님).
```

### 5. travel/docs/code-architecture.md 의도된 비대칭 표기 정합

`.env`가 *부재* 영역에 있다면 *제외* — `scripts/` / `.claude/skills/` / `config/`만 부재 표기로 갱신. 본문 grep + 정합.

### 6. ai-nodes/docs/workspace-structure.md 매트릭스 갱신

**L170 준수도 매트릭스 travel `.env` 컬럼 N/A → O**:

옛 (travel 컬럼):
```
| .env (workspace root) | O | O | O | N/A (ADR-001 비대칭) | O |
```

새:
```
| .env (workspace root) | O | O | O | O (plan002 ADR-002) | O |
```

**L155-160 의도된 비대칭 표 travel 행 갱신**:

옛:
```
| travel | scripts/.claude/skills/.env/config 부재 (의도된 비대칭, plan001) | travel/docs/adr.md ADR-001 |
```

새:
```
| travel | scripts/.claude/skills/config 부재 (의도된 비대칭, plan001 ADR-001) — .env는 plan002 ADR-002로 도입 | travel/docs/adr.md ADR-001 + ADR-002 |
```

## 성공 기준

```bash
cd "$(git rev-parse --show-toplevel)"

# 1. .env / .env.example
test -f travel/.env
grep -q "^DISCORD_CHANNEL_ID=1498642302602580029" travel/.env
test -f travel/.env.example
test -z "$(git ls-files travel/.env)"
echo "[.env + .env.example + untracked] OK"

# 2. travel adr.md ADR-002 본문 + Quick Index
grep -q "^## ADR-002" travel/docs/adr.md
grep -q "ADR-002.*\.env 도입" travel/docs/adr.md
grep -q "supersedes ADR-001\|부분 supersede" travel/docs/adr.md
echo "[ADR-002 본문 + supersede 표기] OK"

# 3. AGENTS.md 6번 정합
! grep -q "workspace root \`.env\` 부재" travel/AGENTS.md
grep -q "\.env.*gitignore" travel/AGENTS.md
echo "[AGENTS 정합] OK"

# 4. workspace-structure travel .env 컬럼 O
grep -q "\.env (workspace root) | O | O | O | O" docs/workspace-structure.md
echo "[matrix travel .env O] OK"

# 5. workspace-structure 비대칭 표 갱신
grep -q "scripts/\.claude/skills/config 부재.*plan001 ADR-001" docs/workspace-structure.md
grep -q "\.env는 plan002 ADR-002로 도입" docs/workspace-structure.md
echo "[비대칭 표 갱신] OK"

# 6. scripts/.claude/skills/config 의도된 비대칭 부재 정합 (ADR-001 그대로)
test ! -d travel/scripts
test ! -d travel/.claude
test ! -d travel/config
echo "[비대칭 영역 부재 유지] OK"

# 7. trip-instance 보존
test -d travel/trips/osaka-2026-05
test -f travel/docs/index.md
echo "[trip + index 보존] OK"

# 8. docs-style § 0
! grep -n "§" travel/docs/*.md travel/AGENTS.md docs/workspace-structure.md
echo "[section mark 0] OK"
```

## 금지 사항

- 5문서 본문 변경 (prd / data-schema / flow) — ADR / AGENTS / code-architecture만 정합.
- ADR-001 본문 *제거* — *부분 supersede*만 ADR-002에서 표기. ADR-001 본문은 history 보존.
- scripts/.claude/skills/config 디렉터리 신설 — ADR-001 유지 영역.
- trip-instance 데이터 변경.
- 다른 워크스페이스 파일 수정.
- amend / force push.
- section mark (U+00A7) 직접 입력.

## commit

```bash
cd "$(git rev-parse --show-toplevel)"
git add travel/.env.example travel/docs/adr.md travel/AGENTS.md travel/docs/code-architecture.md docs/workspace-structure.md

# travel/.env는 gitignored — 자동 untracked
git status --porcelain | grep -E "^(A|M|D|R) " | head

git commit -m "docs(travel, ai-nodes): .env 도입 + ADR-002 (ADR-001 부분 supersede, plan002 phase-01)

- travel/.env 신설 (DISCORD_CHANNEL_ID=1498642302602580029, gitignore)
- travel/.env.example template (git tracked)
- travel/docs/adr.md: ADR-002 본문 + Quick Index 행 추가
- travel/AGENTS.md: 6번 외부 의존성 .env 표기 정합
- travel/docs/code-architecture.md: 의도된 비대칭 영역에서 .env 제외
- ai-nodes/docs/workspace-structure.md: 매트릭스 travel .env N/A→O + 비대칭 표 갱신

ADR-001 .env 부재 결정 부분 supersede. scripts/.claude/skills/config 부재는 ADR-001 유지.
5 워크스페이스 .env 컬럼 모두 O — 모노레포 일관성 완성.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

push 없음 (phase-02 책임).

## PHASE_BLOCKED / PHASE_FAILED

- .env / .env.example 미신설 — `PHASE_FAILED: 신설 누락`.
- ADR-002 본문 또는 Quick Index 누락 — `PHASE_FAILED: ADR 부실`.
- AGENTS / code-architecture / workspace-structure 정합 실패 — `PHASE_FAILED: 갱신 부실`.
- scripts/.claude/skills/config 신설됨 (ADR-001 영역 위반) — `PHASE_FAILED: scope creep`.
- 의도 외 staged 파일 — `PHASE_BLOCKED`.
