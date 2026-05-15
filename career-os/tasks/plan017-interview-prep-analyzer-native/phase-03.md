# Phase 3 — interview-prep-analyzer SKILL.md 적용 + knowledge-gap-analyzer 폐기 + Python/shell 6 폐기 + dispatcher 3 case 폐기

**Model**: sonnet
**Status**: pending

---

## 목표

phase-01 draft의 SKILL.md를 새 위치 `career-os/.claude/skills/interview-prep-analyzer/SKILL.md`로 Write 적용. 옛 knowledge-gap-analyzer (SKILL + references + scripts 6 + dispatcher 3 case) 일괄 폐기.

**범위 외**: docs 갱신 (phase-04), 정적 검증·push (phase-05).

## 관련 docs

- phase-02 commit — topics.json 분리 완료
- `career-os/tasks/plan017-interview-prep-analyzer-native/draft/SKILL.md` — Write 원본
- `skills/plan-and-build/references/common-pitfalls.md` 6-6 (Write 위장)

## 사전 검증

```bash
cd /home/bifos/ai-nodes

# 1-A. phase-02 commit 존재
git log -1 --format='%s' | grep -q "plan017 phase-02" \
  || { echo "PHASE_BLOCKED: phase-02 commit 없음"; exit 2; }

# 1-B. draft SKILL.md 존재
DRAFT=career-os/tasks/plan017-interview-prep-analyzer-native/draft/SKILL.md
test -f "$DRAFT" || { echo "PHASE_BLOCKED: draft SKILL.md 부재"; exit 2; }

# 1-C. 폐기 대상 존재 (부분 실행 의심 검사)
test -d career-os/.claude/skills/knowledge-gap-analyzer \
  || { echo "PHASE_BLOCKED: knowledge-gap-analyzer 이미 부재"; exit 2; }
test -d career-os/scripts/knowledge-gap-analyzer \
  || { echo "PHASE_BLOCKED: scripts/knowledge-gap-analyzer 이미 부재"; exit 2; }
grep -qE "^\s*(baseline|daily|smoke)\)" career-os/scripts/command-router/run_now.sh \
  || { echo "PHASE_BLOCKED: dispatcher case 이미 부재"; exit 2; }

# 1-D. 신규 skill 위치 (아직 부재)
test ! -d career-os/.claude/skills/interview-prep-analyzer \
  || { echo "PHASE_BLOCKED: interview-prep-analyzer 디렉터리 이미 존재"; exit 2; }

echo "사전 검증 OK"
```

## 작업 항목

### 1. interview-prep-analyzer 디렉터리 생성 + SKILL.md Write

```bash
cd /home/bifos/ai-nodes
mkdir -p career-os/.claude/skills/interview-prep-analyzer
```

`Read` 도구로 `career-os/tasks/plan017-interview-prep-analyzer-native/draft/SKILL.md` 로드.

`Write` 도구로 `career-os/.claude/skills/interview-prep-analyzer/SKILL.md`에 **draft 본문 그대로** 저장. prose 위장 금지 (6-6).

### 2. SKILL.md 적용 검증

```bash
cd /home/bifos/ai-nodes
TARGET=career-os/.claude/skills/interview-prep-analyzer/SKILL.md
DRAFT=career-os/tasks/plan017-interview-prep-analyzer-native/draft/SKILL.md

# A. byte-for-byte 동일
diff -q "$TARGET" "$DRAFT" > /dev/null \
  || { echo "PHASE_FAILED: target ↔ draft 불일치"; exit 1; }

# B. 라인 수
LINES=$(wc -l < "$TARGET")
[ "$LINES" -ge 100 ] || { echo "PHASE_FAILED: target $LINES 줄 — Write 누락 의심"; exit 1; }

# C. 필수 섹션 + 두 모드 키워드
for kw in "When to use" "Inputs" "Workflow" "Self-check" "Error handling" "baseline" "daily" "study-progress"; do
  grep -q "$kw" "$TARGET" || { echo "PHASE_FAILED: 키워드 '$kw' 누락"; exit 1; }
done

# D. native invoke 안내
grep -q "interview-prep-analyzer\|claude -p" "$TARGET" \
  || { echo "PHASE_FAILED: native invoke 안내 누락"; exit 1; }

# E. 옛 subprocess 지시문 *없음* (6-7)
for kw in "Output only valid JSON" "Do not output markdown" "claude --json-schema"; do
  grep -q "$kw" "$TARGET" && { echo "PHASE_FAILED: '$kw' 잔재"; exit 1; }
done

echo "[2] SKILL.md 적용 검증 OK ($LINES 줄)"
```

### 3. knowledge-gap-analyzer 폐기 (skill + references)

```bash
cd /home/bifos/ai-nodes
git rm -r career-os/.claude/skills/knowledge-gap-analyzer/
echo "[3-A] knowledge-gap-analyzer skill + references 폐기 OK"
```

### 4. scripts/knowledge-gap-analyzer 폐기 (Python 6 + shell 3)

```bash
cd /home/bifos/ai-nodes
git rm -r career-os/scripts/knowledge-gap-analyzer/
rm -rf career-os/scripts/knowledge-gap-analyzer/ 2>/dev/null

REMAINING=$(ls career-os/scripts/knowledge-gap-analyzer/ 2>/dev/null | wc -l)
[ "$REMAINING" = "0" ] || { echo "PHASE_FAILED: scripts/knowledge-gap-analyzer 잔존 $REMAINING"; exit 1; }
echo "[3-B] Python 6 + shell 3 폐기 OK"
```

### 5. dispatcher 3 case 폐기 (baseline + daily + smoke)

Read로 `career-os/scripts/command-router/run_now.sh` 현재 본문 확인. 3 case 블록 Edit으로 제거.

```bash
cd /home/bifos/ai-nodes
echo "=== 폐기 대상 dispatcher case ==="
grep -nE "^\s*(baseline|daily|smoke)\)" career-os/scripts/command-router/run_now.sh
```

Edit으로 3 case 블록 + usage 라인의 3 명령 제거. 다른 case 유지.

검증:
```bash
cd /home/bifos/ai-nodes
# A. 3 case 제거
for c in "baseline" "daily" "smoke"; do
  HITS=$(grep -cE "^\s*$c\)" career-os/scripts/command-router/run_now.sh)
  [ "$HITS" = "0" ] || { echo "PHASE_FAILED: dispatcher $c case 잔존"; exit 1; }
done

# B. bash syntax
bash -n career-os/scripts/command-router/run_now.sh \
  || { echo "PHASE_FAILED: dispatcher bash syntax"; exit 1; }

# C. dispatcher case 총 수 (plan016이 별도 세션에서 다른 case 폐기 진행 중일 수 있음 — 본 phase는 baseline/daily/smoke 3개만 보장)
echo "[5] dispatcher 정리 OK"
```

### 6. 커밋 + commit 개수 강제

```bash
cd /home/bifos/ai-nodes
HEAD_BEFORE=$(git rev-parse HEAD)

git add career-os/.claude/skills/ \
        career-os/scripts/ \
        career-os/scripts/command-router/run_now.sh

git commit -m "$(cat <<'COMMIT_EOF'
refactor(career-os): interview-prep-analyzer SKILL.md 적용 + knowledge-gap-analyzer 일괄 폐기 (plan017 phase-03)

ADR-027 적용. plan013-2/plan015 패턴 따라 draft 별도 파일 → Write 적용.

신규:
- .claude/skills/interview-prep-analyzer/SKILL.md (native 명세, baseline +
  daily 자연어 분기, smoke 폐기)

폐기:
- .claude/skills/knowledge-gap-analyzer/ (SKILL + references 2)
- scripts/knowledge-gap-analyzer/ (build_target_file_list.py +
  select_topic.py + update_study_progress.py + run_baseline.sh +
  run_daily.sh + run_smoke_test.sh = 6 script. codex 자동 생성의 과도한
  분리, 알고리즘 단순이라 native 자연어 추론 동등)
- dispatcher run_now.sh: baseline + daily + smoke case 3개 폐기 + usage 갱신

native 진입점 누적: study-pack + interview-asset + study-topic-recommender
(plan016 진행 중) + interview-prep-analyzer = 4개.
COMMIT_EOF
)" || { echo "PHASE_FAILED: commit"; exit 1; }

HEAD_AFTER=$(git rev-parse HEAD)
COMMITS=$(git rev-list "$HEAD_BEFORE..$HEAD_AFTER" --count)
[ "$COMMITS" = "1" ] \
  || { echo "PHASE_FAILED: 본 phase commit 수 $COMMITS (expected 1)"; exit 1; }
echo "[6] commit 1 OK"
```

## Critical Files

| 파일 | 변경 |
|---|---|
| `career-os/.claude/skills/interview-prep-analyzer/SKILL.md` | 신규 (Write, draft 복제) |
| `career-os/.claude/skills/knowledge-gap-analyzer/` | git rm -r |
| `career-os/scripts/knowledge-gap-analyzer/` | git rm -r (6 script) |
| `career-os/scripts/command-router/run_now.sh` | baseline + daily + smoke case 제거 + usage 갱신 |

## Blocked 조건

- phase-02 commit 없음 → `PHASE_BLOCKED` + `exit 2`
- draft 부재 → `PHASE_BLOCKED` + `exit 2`
- 폐기 대상 부재 → `PHASE_BLOCKED: 부분 실행 의심` + `exit 2`
- 신규 위치 이미 존재 → `PHASE_BLOCKED` + `exit 2`
- 검증 A~E / 3-A~B / 5-A~B 실패 → `PHASE_FAILED` + `exit 1`
- commit 수 ≠ 1 → `PHASE_FAILED: commit 위장 의심` + `exit 1`

## 의도 메모

- SKILL.md byte diff 검증이 6-6 방어선.
- dispatcher 3 case + skill + scripts 일괄 폐기는 atomic — 한 commit.
- plan016 별도 세션 진행 중이라 *dispatcher case 총 수 검증 안 함* (다른 case도 폐기 중일 수 있음).
