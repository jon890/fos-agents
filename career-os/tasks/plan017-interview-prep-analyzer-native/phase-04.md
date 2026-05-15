# Phase 4 — 5문서 + AGENTS.md + command-router SKILL.md 갱신 (flow.md에 interview-prep-analyzer ASCII flow 박기)

**Model**: sonnet
**Status**: pending

---

## 목표

plan017의 변경 (interview-prep-analyzer 신규 + knowledge-gap-analyzer 폐기 + topics.json 분리 + dispatcher 3 case 폐기)을 5문서 + AGENTS.md + command-router SKILL.md에 반영. 사용자가 *코드 안 보고 docs로만 이해 가능*하도록 flow.md에 ASCII flow 박기 (사용자 요청).

**범위 외**: 정적 검증·push·trailing (phase-05).

## 관련 docs

- phase-03 commit — SKILL.md 적용 + 폐기 완료
- 갱신 대상: prd.md / flow.md / code-architecture.md / data-schema.md / AGENTS.md / command-router SKILL.md
- ADR-027은 docs-first commit에서 이미 추가됨

## 사전 검증

```bash
cd /home/bifos/ai-nodes

# 1-A. phase-03 commit 존재
git log -1 --format='%s' | grep -q "plan017 phase-03" \
  || { echo "PHASE_BLOCKED: phase-03 commit 없음"; exit 2; }

# 1-B. 핵심 산출물 존재
test -f career-os/.claude/skills/interview-prep-analyzer/SKILL.md \
  || { echo "PHASE_BLOCKED: SKILL.md 부재"; exit 2; }
test ! -d career-os/.claude/skills/knowledge-gap-analyzer \
  || { echo "PHASE_BLOCKED: knowledge-gap-analyzer 아직 살아있음"; exit 2; }
for f in study-pack-topics study-pack-candidates question-bank-topics; do
  test -f "career-os/config/$f.json" \
    || { echo "PHASE_BLOCKED: config/$f.json 부재"; exit 2; }
done
test ! -f career-os/config/topics.json \
  || { echo "PHASE_BLOCKED: topics.json 아직 살아있음"; exit 2; }

echo "사전 검증 OK"
```

## 작업 항목

### 1. prd.md 기능 표 갱신

- `baseline` / `daily [topic]` / `smoke` 3 행 제거
- `/interview-prep-analyzer` (native) 1 행 추가:
  - 산출물: `data/reports/{baseline,daily}/YYYY-MM-DD/report.md` (모드별)
  - 외부 git push: 없음
  - 빈도: 면접 시즌 시작 시 baseline + 매일 daily

산출물 경로 정책 섹션도 *baseline / daily*가 `data/reports/` 안에 있는 사실 유지.

### 2. flow.md 갱신 — ASCII flow 박기 (사용자 요청)

`baseline` 섹션 + `daily [topic]` 섹션을 *통합 + native 안내*로 재작성. 다음 ASCII flow를 본문에 박는다:

```
### `/interview-prep-analyzer` (native skill — plan017, baseline + daily 두 모드 자연어 분기)

native skill 패턴: `claude -p "/interview-prep-analyzer [args]"` → SKILL.md 자동 로드 → Claude가 도구로 직접 처리.

호출 시그니처:
  /interview-prep-analyzer                  → baseline 자동 (인자 없음)
  /interview-prep-analyzer "오늘 점검"       → daily 자연어
  /interview-prep-analyzer "<topic>"        → daily, 명시 토픽
  /interview-prep-analyzer "전체 진단"       → baseline 명시

[모드 분기 — 자연어 추론]
  ┌────────────────────────────────────┐
  │ baseline 모드                       │       │ daily 모드                          │
  │ ───────                             │       │ ───────                             │
  │ Read: config/baseline-core-files    │       │ Topic 선택:                         │
  │ Read: 10 파일 (큐레이션)            │       │  - 인자 명시 → 그대로               │
  │ Claude 분석 → 7 섹션                │       │  - 없으면 data/study-progress.json │
  │ Write: data/reports/baseline/       │       │    → 가장 오래된 토픽 자연어 선택  │
  │  YYYY-MM-DD/report.md               │       │ Read: config/topic-file-map.json   │
  │                                     │       │ Read: 3-5 파일                      │
  │                                     │       │ Claude 분석 → 5 섹션                │
  │                                     │       │ Write: data/reports/daily/         │
  │                                     │       │  YYYY-MM-DD/report.md              │
  │                                     │       │ Edit: data/study-progress.json     │
  │                                     │       │  → 토픽 lastVisited = 오늘 갱신    │
  └────────────────────────────────────┘       └────────────────────────────────────┘

공통:
  - Read: config/mvp-target.json + candidate-profile.md
  - fos-study git pull --ff-only (사전)
  - Discord 알림 [완료] + cost

옛 외부 subprocess 흐름 (dispatcher → run_baseline/daily/smoke.sh → 6 Python script → claude --print → extract → 갱신)은 plan017에서 폐기됨. smoke 모드 자체도 폐기 — Claude 호출 sanity는 다른 skill 사용 중에 자연 확인.
```

기존 `baseline` 섹션 + `daily [topic]` 섹션 + `smoke` 섹션 (있다면) *모두 위 ASCII flow로 교체*.

"의도적 비대칭" 섹션도 갱신: `baseline / daily / smoke` → `interview-prep-analyzer (baseline + daily)`.

### 3. code-architecture.md 갱신

- scripts/knowledge-gap-analyzer/ 트리 라인 제거
- .claude/skills/knowledge-gap-analyzer/ 트리 라인 제거
- .claude/skills/interview-prep-analyzer/ 트리 라인 추가 (SKILL.md만, references 없음)
- config/ 트리: topics.json 제거 + 3 신 json 추가 (study-pack-topics + study-pack-candidates + question-bank-topics)
- 진입점 dispatcher 케이스 분기 수치 갱신 (예: "5개 case" → "4개 case" 또는 사용자가 dispatcher 직접 편집한 상태 반영)

### 4. data-schema.md 갱신

- `### config/topics.json` 섹션 *통째 폐기* (또는 *plan017에서 3 json으로 분리* 안내로 짧게 갱신, history 보존)
- `### config/study-pack-topics.json` 신규 섹션 추가 (55 키 / study-pack-writer + study-topic-recommender Read)
- `### config/study-pack-candidates.json` 신규 섹션 추가 (2 키 / study-topic-recommender Read)
- `### config/question-bank-topics.json` 신규 섹션 추가 (2 키 / interview-asset-writer Read)
- 각 스키마는 옛 topics.json 안 namespace 본문과 동일 (분리만, 본문 그대로)

### 5. AGENTS.md (= CLAUDE.md 심링크) 갱신

`5문서 라우팅 가이드` 표의 `docs/adr.md` 줄에서 `ADR-001~025` → `ADR-001~027`로 갱신.

명령 목록 섹션:
- dispatcher 명령 수: 사용자가 직접 편집한 상태 반영 (현재 5개 또는 갱신 후)
- native skill 진입점 추가: `claude -p "/interview-prep-analyzer"` (baseline + daily 두 모드 흡수)

### 6. command-router SKILL.md 갱신

명령 목록 라인에서 `baseline` + `daily [topic]` + `smoke` 제거. 현재 사용자가 5개로 직접 편집한 상태 반영 + smoke 제거 후 4개 또는 적절.

### 7. 자기 확인

```bash
cd /home/bifos/ai-nodes

# A. 옛 명령 행 잔재 (history mention 제외)
for d in prd flow code-architecture data-schema; do
  HITS=$(grep -cE "^\| \`baseline\`|^\| \`daily \[topic\]\`|^\| \`smoke\`" career-os/docs/$d.md 2>/dev/null)
  [ "$HITS" = "0" ] || { echo "PHASE_FAILED: docs/$d.md 옛 명령 행 잔존"; exit 1; }
done

# B. 옛 path/skill 잔재 (history mention 제외)
HITS=$(grep -rln "knowledge-gap-analyzer" career-os/docs/ career-os/AGENTS.md career-os/.claude/skills/command-router/ 2>/dev/null | wc -l)
# history mention은 OK — 절대 잔재 0 강제 안 함, 단 *현재 안내*에서는 빠져야

# C. interview-prep-analyzer 안내 추가
grep -q "interview-prep-analyzer" career-os/docs/prd.md \
  || { echo "PHASE_FAILED: prd.md에 interview-prep-analyzer 안내 누락"; exit 1; }
grep -q "interview-prep-analyzer" career-os/docs/flow.md \
  || { echo "PHASE_FAILED: flow.md에 interview-prep-analyzer 안내 누락"; exit 1; }
grep -q "interview-prep-analyzer" career-os/AGENTS.md \
  || { echo "PHASE_FAILED: AGENTS.md에 interview-prep-analyzer 안내 누락"; exit 1; }

# D. flow.md에 ASCII flow 박혔는지 확인 (사용자 요청)
grep -q "baseline 모드.*daily 모드\|모드 분기.*자연어 추론" career-os/docs/flow.md \
  || { echo "PHASE_FAILED: flow.md ASCII flow 블록 누락"; exit 1; }

# E. data-schema.md에 3 신 json 스키마 추가
for f in study-pack-topics study-pack-candidates question-bank-topics; do
  grep -q "config/$f\.json" career-os/docs/data-schema.md \
    || { echo "PHASE_FAILED: data-schema.md '$f' 섹션 누락"; exit 1; }
done

echo "[7] docs 갱신 자기 확인 OK"
```

### 8. 커밋 + commit 개수 강제

```bash
cd /home/bifos/ai-nodes
HEAD_BEFORE=$(git rev-parse HEAD)

git add career-os/AGENTS.md \
        career-os/docs/ \
        career-os/.claude/skills/command-router/SKILL.md

git commit -m "$(cat <<'COMMIT_EOF'
docs(career-os): interview-prep-analyzer + topics.json 분리 5문서 갱신 + ASCII flow 박기 (plan017 phase-04)

ADR-027 적용 후속 docs 정리. 사용자 요청 — flow.md에 ASCII flow 그림을
직접 박아서 코드 안 봐도 docs로만 흐름 이해 가능.

- prd.md: 기능 표에서 baseline + daily + smoke 행 제거 + interview-prep-analyzer
  native 진입점 추가
- flow.md: 옛 baseline + daily 섹션 폐기 + interview-prep-analyzer ASCII flow
  블록 박기 (모드 분기 + Read/Write 단계 명시)
- code-architecture.md: scripts/knowledge-gap-analyzer + .claude/skills/
  knowledge-gap-analyzer 트리 제거, .claude/skills/interview-prep-analyzer
  추가. config/ 트리에서 topics.json → 3 json
- data-schema.md: config/topics.json 섹션 history 표기, 3 신 json 섹션 추가
- AGENTS.md: 명령 목록 갱신 + ADR 범위 027까지 + native 진입점 4개
- command-router SKILL.md: 명령 수 갱신

native skill 진입점 누적 4개: study-pack / interview-asset / study-topic-recommender
(plan016) / interview-prep-analyzer (plan017).
COMMIT_EOF
)" || { echo "PHASE_FAILED: commit"; exit 1; }

HEAD_AFTER=$(git rev-parse HEAD)
COMMITS=$(git rev-list "$HEAD_BEFORE..$HEAD_AFTER" --count)
[ "$COMMITS" = "1" ] \
  || { echo "PHASE_FAILED: 본 phase commit 수 $COMMITS (expected 1)"; exit 1; }
echo "[8] commit 1 OK"
```

push는 phase-05.

## Critical Files

| 파일 | 변경 |
|---|---|
| `career-os/AGENTS.md` | 명령 목록 + ADR 범위 + native 진입점 |
| `career-os/docs/prd.md` | 기능 표 |
| `career-os/docs/flow.md` | ASCII flow 블록 박기 (사용자 요청) |
| `career-os/docs/code-architecture.md` | 트리 갱신 |
| `career-os/docs/data-schema.md` | 3 신 json 섹션 + 옛 topics.json history |
| `career-os/.claude/skills/command-router/SKILL.md` | 명령 수 |

## Blocked 조건

- phase-03 commit 없음 → `PHASE_BLOCKED` + `exit 2`
- 핵심 산출물 부재 → `PHASE_BLOCKED: phase-03 미완` + `exit 2`
- 자기 확인 A~E 실패 → `PHASE_FAILED: <항목>` + `exit 1`
- commit 수 ≠ 1 → `PHASE_FAILED: commit 위장 의심` + `exit 1`

## 의도 메모

- ASCII flow 블록은 사용자가 *코드 안 보고 docs로만 이해*하기 위한 시각화. flow.md 책임 영역에 맞음 (입력 → runner → 산출물).
- code-architecture.md 트리 갱신 시 사용자가 직접 편집한 상태 (dispatcher case 5개)를 *덮어쓰지 않는다* — 본 phase가 polish.
