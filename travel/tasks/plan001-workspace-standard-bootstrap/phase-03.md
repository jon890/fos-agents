# Phase 3 — ai-nodes workspace-structure 매트릭스 travel 갱신

travel plan001 phase-03. ai-nodes 모노레포 docs/workspace-structure.md에서 travel 행 매트릭스 + 의도된 비대칭 표 + 안내 갱신.

## 작업 위치

```bash
cd "$(git rev-parse --show-toplevel)"
```

## 관련 docs

- `ai-nodes/docs/workspace-structure.md` L17-22 (워크스페이스 표) / L155-160 (의도된 비대칭 표) / L170 (준수도 매트릭스) / L181 (안내) — 갱신 대상.
- `ai-nodes/AGENTS.md` L17-22 (모노레포 진입점 표) — travel 행 특이사항 갱신 검토.
- `travel/docs/adr.md` ADR-001 — 의도된 비대칭 결정 본문 참조.

## 변경할 파일

수정:
- `ai-nodes/docs/workspace-structure.md` (4 영역)
- `ai-nodes/AGENTS.md` (L20 travel 행 특이사항 — 선택)

## 명세

### 1. workspace-structure.md L17-22 워크스페이스 표 — travel 행 특이사항 갱신

옛:
```
| `travel/` | `travel/AGENTS.md` | trips/<trip-id>/ 단위 |
```

새:
```
| `travel/` | `travel/AGENTS.md` | trips/<trip-id>/ 단위, 의도된 비대칭 (ADR-001) — scripts/.claude/skills/.env/config 부재 |
```

### 2. L155-160 의도된 비대칭 표 — travel 행 갱신

옛:
```
| travel | TODO — 별도 audit 필요 | — |
```

새:
```
| travel | scripts/.claude/skills/.env/config 부재 (의도된 비대칭, plan001) | travel/docs/adr.md ADR-001 |
```

### 3. L170 준수도 매트릭스 — travel 컬럼 7행 갱신

기존 컬럼 (apartment / career-os / stock-investment / travel / health-care)의 travel 행 모두 ?→ 적절한 값:

옛 (각 행 travel 컬럼):
```
| AGENTS.md 존재 | O | O | O | O | O |
| CLAUDE.md 심링크 | O | O | O (plan001) | ? | O |
| docs/ 5문서 | O | O | O (plan001) | ? | O |
| tasks/plan{N}/ 영역 | O | O | O (plan001~004) | ? | O |
| skills/ 분리 표준 (ADR-006) | 적용 (plan007) | 적용 (ADR-019 → ADR-006 격상) | 적용 (plan002) | ? | 적용 (plan002) |
| .claude/skills/ native 등록 | O | O | O (plan002) | ? | O (plan002) |
| .env (workspace root) | O | O | O | ? | O |
| data/ vs docs/ 분리 | O | O | O | ? | O |
```

새 (travel 컬럼):
- AGENTS.md 존재: O
- CLAUDE.md 심링크: O (plan001)
- docs/ 5문서: O (plan001)
- tasks/plan{N}/ 영역: O (plan001)
- skills/ 분리 표준 (ADR-006): N/A (ADR-001 비대칭)
- .claude/skills/ native 등록: N/A (ADR-001 비대칭)
- .env (workspace root): N/A (ADR-001 비대칭 — 비밀 정보 0)
- data/ vs docs/ 분리: O (trips/<trip-id>/data + docs)

### 4. L181 안내 갱신

옛:
```
travel만 별도 workspace-audit 실행 후 갱신 예정. stock-investment는 plan001~004 시리즈로 완료. health-care는 plan002로 완료.
```

새:
```
stock-investment plan001~004 + health-care plan002 + travel plan001 시리즈로 5 워크스페이스 모두 표준 적용 완료. travel은 ADR-001 의도된 비대칭 — scripts/.claude/skills/.env/config 부재 (자동화 0 + workspace-level skill 0).
```

### 5. (선택) 모노레포 AGENTS.md L20 travel 행 특이사항 갱신

옛:
```
| `travel/` | [`travel/AGENTS.md`](travel/AGENTS.md) | `trips/<trip-id>/` 단위 |
```

새:
```
| `travel/` | [`travel/AGENTS.md`](travel/AGENTS.md) | `trips/<trip-id>/` 단위, ADR-001 의도된 비대칭 (scripts/.claude/skills/.env/config 부재) |
```

## 성공 기준

```bash
cd "$(git rev-parse --show-toplevel)"

# 1. workspace-structure 워크스페이스 표 travel 비대칭 표기
grep -q "travel/.*의도된 비대칭" docs/workspace-structure.md || grep -q "travel/.*ADR-001" docs/workspace-structure.md
echo "[워크스페이스 표 travel 비대칭] OK"

# 2. 의도된 비대칭 표 travel 행 갱신 — "TODO 부재"
! grep -q "travel | TODO — 별도 audit 필요" docs/workspace-structure.md
grep -q "travel | scripts/.*비대칭\|travel | scripts/.*ADR-001" docs/workspace-structure.md
echo "[비대칭 표 travel] OK"

# 3. 매트릭스 travel 컬럼 — ? 부재
TR_QM=$(grep -E "^\| (AGENTS|CLAUDE|docs/ 5문서|tasks/plan|skills/ 분리|\.claude/skills/|\.env|data/ vs docs/)" docs/workspace-structure.md | awk -F '|' '{print $6}' | grep -c "?")
test "$TR_QM" -eq 0 || (echo "FAIL: matrix travel 컬럼 ? $TR_QM 잔존" && exit 1)
echo "[매트릭스 travel ? 0] OK"

# 4. 매트릭스 travel O 또는 N/A
TR_OK=$(grep -E "^\| (AGENTS|CLAUDE|docs/ 5문서|tasks/plan|skills/ 분리|\.claude/skills/|\.env|data/ vs docs/)" docs/workspace-structure.md | awk -F '|' '{print $6}' | grep -cE "O|N/A")
test "$TR_OK" -ge 8 || (echo "FAIL: matrix travel O/NA $TR_OK 미달" && exit 1)
echo "[매트릭스 travel O/NA 8행] OK"

# 5. L181 안내 정합
grep -q "5 워크스페이스 모두 표준 적용 완료\|travel plan001" docs/workspace-structure.md
echo "[안내 정합] OK"

# 6. AGENTS 모노레포 travel 행 비대칭 표기 (선택)
grep -q "travel/.*ADR-001\|travel/.*비대칭" AGENTS.md && echo "[모노레포 AGENTS travel] OK" || echo "(모노레포 AGENTS travel 특이사항 갱신 선택사항)"

# 7. travel 측 파일 변경 0
! git status --porcelain travel/ | grep -q "^"
echo "[travel 측 변경 0] OK"

# 8. docs-style § 사용 0
! grep -n "§" docs/workspace-structure.md AGENTS.md
echo "[section mark 0] OK"
```

## 금지 사항

- travel/ 측 파일 수정 (phase-01/02 산출 보존).
- 다른 워크스페이스 (apartment / career-os / stock-investment / health-care) 행 변경.
- ADR 신설.
- 매트릭스 컬럼 순서 변경.
- section mark (U+00A7) 직접 입력.

## commit

```bash
cd "$(git rev-parse --show-toplevel)"
git add docs/workspace-structure.md AGENTS.md

git status --porcelain | grep -E "^(A|M|D|R) " | head
# 의도 외 staged 파일 0.

git commit -m "docs(ai-nodes): workspace-structure travel 매트릭스 갱신 — 의도된 비대칭 (travel plan001 phase-03)

- 워크스페이스 표 L20 travel 행 특이사항: ADR-001 의도된 비대칭 명시
- 의도된 비대칭 표 L155-160: travel 행 — scripts/.claude/skills/.env/config 부재
- 준수도 매트릭스 L170 travel 컬럼: ?→O (구조 적용) 또는 N/A (의도된 비대칭)
- L181 안내: 5 워크스페이스 모두 표준 적용 완료 (travel plan001로 마무리)
- 모노레포 AGENTS L20 travel 행 특이사항 갱신

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

push 없음 (phase-04 책임).

## PHASE_BLOCKED / PHASE_FAILED

- workspace-structure travel 비대칭 표기 누락 — `PHASE_FAILED`.
- 매트릭스 ? 잔존 — `PHASE_FAILED: 갱신 부실`.
- travel 측 파일 변경 — `PHASE_FAILED: scope creep`.
- 의도 외 staged 파일 — `PHASE_BLOCKED`.
