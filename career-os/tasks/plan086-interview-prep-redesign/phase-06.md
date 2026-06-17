# Phase 06 — candidate-baseline-suggester 제거 + 잔존 참조 정리 + 통합 검증 + 완료 마킹

**Model**: sonnet
**Status**: pending

---

## 목표

`candidate-baseline-suggester` 스킬을 제거하고 잔존 참조를 정리한다(ADR-028 폐기).
전체 plan086 산출물을 통합 검증한다.
`index.json` status를 `completed`로 마킹한다.
이 phase는 마지막 phase이며, 통합 검증 통과 전까지 completed 마킹을 하지 않는다.

**범위 외**:
- 신규 스킬 추가 금지
- docs/ADR 수정 금지 (phase-01 완료됨)
- push·PR 금지 (push는 메인 세션이 review 후 처리)

---

## 사전 cwd 설정

```bash
cd "$(git rev-parse --show-toplevel)"
pwd
```

---

## 작업 항목

### 1. candidate-baseline-suggester 제거

```bash
cd "$(git rev-parse --show-toplevel)"
# 현황 확인
ls career-os/.claude/skills/candidate-baseline-suggester/ 2>/dev/null || echo "이미 없음"
ls career-os/.codex/skills/candidate-baseline-suggester 2>/dev/null || echo ".codex 심링크 없음"
ls career-os/scripts/ | grep -i baseline || echo "scripts baseline 없음"

# 스킬 디렉터리 제거
git rm -r career-os/.claude/skills/candidate-baseline-suggester/ 2>/dev/null || echo "이미 제거됨"

# .codex 심링크 제거
git rm career-os/.codex/skills/candidate-baseline-suggester 2>/dev/null || echo ".codex 없음"

# scripts/ 관련 파일 확인 후 제거 (baseline-suggester 전용 파일만)
ls career-os/scripts/ | grep -i "baseline-suggester\|candidate-baseline" | while read f; do
  git rm -r "career-os/scripts/$f"
done
```

### 2. 잔존 참조 정리

```bash
cd "$(git rev-parse --show-toplevel)"
# 잔존 참조 확인 (CLAUDE.md, prd.md, flow.md, SKILL.md들)
grep -rn "candidate-baseline-suggester" career-os/ \
  --include="*.md" --include="*.json" --include="*.ts" \
  | grep -v "tasks/plan086\|docs/adr/ADR-028\|docs/adr/ADR-092" \
  | head -30
```

잔존 참조가 있는 파일을 편집해 `candidate-baseline-suggester` 언급을 제거하거나 "제거됨 — weak_spots는 드릴이 전담"으로 대체한다.
단, `docs/adr/` 내 ADR 파일은 수정하지 않는다(역사적 기록 보존).

### 3. CLAUDE.md 진입점 제거

`career-os/CLAUDE.md`에서 `/candidate-baseline-suggester` 진입점 라인을 제거한다.

---

## 통합 검증

검증 명령을 Bash 도구로 직접 실행한다.
**검증 없이 "완료" 보고하면 안 된다.**

```bash
cd "$(git rev-parse --show-toplevel)"
FAIL=0

echo "=== phase-01: docs 갱신 확인 ==="
for FIELD in "question_id" "pass_count" "next_review_date" "drill-log"; do
  grep -q "$FIELD" career-os/docs/data-schema.md \
    || { echo "[FAIL] data-schema.md: $FIELD 누락"; FAIL=1; }
done
for SKILL in "job-fit-analyzer" "tech-interview-drill" "behavioral-interview-drill" "interview-stage-prep"; do
  grep -q "$SKILL" career-os/docs/flow.md \
    || { echo "[FAIL] flow.md: $SKILL 누락"; FAIL=1; }
done
grep -q "drill-engine" career-os/docs/code-architecture.md \
  || { echo "[FAIL] code-architecture.md: drill-engine 누락"; FAIL=1; }
[ "$FAIL" = "0" ] && echo "[phase-01] OK"

echo "=== phase-02: job-fit-analyzer 리네임 확인 ==="
[ -f career-os/.claude/skills/job-fit-analyzer/SKILL.md ] \
  || { echo "[FAIL] job-fit-analyzer/SKILL.md 없음"; FAIL=1; }
[ ! -d career-os/.claude/skills/interview-prep-analyzer ] \
  || { echo "[FAIL] interview-prep-analyzer 잔존"; FAIL=1; }
grep -q "application-package-writer" career-os/.claude/skills/job-fit-analyzer/SKILL.md \
  || { echo "[FAIL] job-fit-analyzer 경계 미명시"; FAIL=1; }
[ "$FAIL" = "0" ] && echo "[phase-02] OK"

echo "=== phase-03: 공용 드릴 엔진 + tech-interview-drill 확인 ==="
[ -f career-os/scripts/interview-drill/drill-engine.ts ] \
  || { echo "[FAIL] drill-engine.ts 없음"; FAIL=1; }
for FN in "selectQuestions" "scoreAnswer" "recordDrillLog" "updateWeakSpots" "shouldDispatchStudyPack"; do
  grep -q "$FN" career-os/scripts/interview-drill/drill-engine.ts \
    || { echo "[FAIL] drill-engine.ts: $FN 누락"; FAIL=1; }
done
[ -f career-os/.claude/skills/tech-interview-drill/SKILL.md ] \
  || { echo "[FAIL] tech-interview-drill/SKILL.md 없음"; FAIL=1; }
[ -f career-os/data/question-bank/tech-questions.jsonl ] \
  || { echo "[FAIL] tech-questions.jsonl 없음"; FAIL=1; }
[ "$FAIL" = "0" ] && echo "[phase-03] OK"

echo "=== phase-04: behavioral-interview-drill 확인 ==="
[ -f career-os/.claude/skills/behavioral-interview-drill/SKILL.md ] \
  || { echo "[FAIL] behavioral-interview-drill/SKILL.md 없음"; FAIL=1; }
[ -f career-os/.claude/skills/behavioral-interview-drill/references/scoring-rubric.md ] \
  || { echo "[FAIL] scoring-rubric.md 없음"; FAIL=1; }
[ -f career-os/data/question-bank/behavioral-questions.jsonl ] \
  || { echo "[FAIL] behavioral-questions.jsonl 없음"; FAIL=1; }
[ "$FAIL" = "0" ] && echo "[phase-04] OK"

echo "=== phase-05: interview-stage-prep 확인 ==="
[ -f career-os/.claude/skills/interview-stage-prep/SKILL.md ] \
  || { echo "[FAIL] interview-stage-prep/SKILL.md 없음"; FAIL=1; }
[ "$FAIL" = "0" ] && echo "[phase-05] OK"

echo "=== phase-06: candidate-baseline-suggester 제거 확인 ==="
[ ! -d career-os/.claude/skills/candidate-baseline-suggester ] \
  || { echo "[FAIL] candidate-baseline-suggester 디렉터리 잔존"; FAIL=1; }

# 잔존 참조 확인 (ADR 파일 제외)
REFS=$(grep -rn "candidate-baseline-suggester" career-os/ \
  --include="*.md" --include="*.json" --include="*.ts" \
  | grep -v "tasks/plan086\|docs/adr/" | wc -l | tr -d ' ')
[ "$REFS" = "0" ] \
  || { echo "[FAIL] candidate-baseline-suggester 잔존 참조 ${REFS}건"; FAIL=1; }

# CLAUDE.md에서 제거 확인
grep -q "candidate-baseline-suggester" career-os/CLAUDE.md \
  && { echo "[FAIL] CLAUDE.md에 candidate-baseline-suggester 진입점 잔존"; FAIL=1; } || true
[ "$FAIL" = "0" ] && echo "[phase-06] OK"

echo "=== CLAUDE.md 신규 스킬 진입점 확인 ==="
for SKILL in "job-fit-analyzer" "tech-interview-drill" "behavioral-interview-drill" "interview-stage-prep"; do
  grep -q "$SKILL" career-os/CLAUDE.md \
    || { echo "[FAIL] CLAUDE.md: $SKILL 진입점 없음"; FAIL=1; }
done

# 종합
if [ "$FAIL" = "0" ]; then
  echo ""
  echo "SUCCESS: plan086 통합 검증 전부 통과"
else
  echo ""
  echo "PHASE_FAILED: 위 FAIL 항목 확인 — 해당 phase 재실행 후 이 phase 재실행"
  exit 1
fi
```

---

## common-pitfalls self-check (섹션 1~5)

- [ ] **섹션 1 (범위 준수)**: candidate-baseline-suggester 제거·참조 정리·통합 검증·완료 마킹만.
- [ ] **섹션 2 (성공 기준 실행 가능성)**: 위 통합 검증 명령이 직접 실행 가능한지 확인.
- [ ] **섹션 3 (독립 실행 가능성)**: phase-01~05 완료 후 실행. 이전 phase 결과가 전제.
- [ ] **섹션 4 (작업 항목 3개)**: 제거·참조 정리·CLAUDE.md.
- [ ] **섹션 5 (blocked 조건 명시)**: 아래에 명시.

---

## index.json status 마킹

통합 검증이 전부 통과한 뒤에만 실행한다.

```bash
cd "$(git rev-parse --show-toplevel)"
python3 - <<'PY'
import json, subprocess
p = "career-os/tasks/plan086-interview-prep-redesign/index.json"
ts_raw = subprocess.check_output(["bash","-lc","TZ=Asia/Seoul date +%FT%T%z"]).decode().strip()
ts = ts_raw[:-2] + ":" + ts_raw[-2:]
d = json.load(open(p))
d["status"] = "completed"
d["current_phase"] = 6
d["updated_at"] = ts
for ph in d["phases"]:
    ph["status"] = "completed"
open(p, "w").write(json.dumps(d, ensure_ascii=False, indent=2) + "\n")
print("index.json status=completed 마킹 완료")
PY
```

---

## commit (push 금지)

```bash
cd "$(git rev-parse --show-toplevel)"
git add \
  career-os/tasks/plan086-interview-prep-redesign/index.json \
  career-os/CLAUDE.md
# candidate-baseline-suggester 제거로 git rm된 파일들은 이미 staged됨
git diff --cached --name-only
git commit -q -m "$(cat <<'EOF'
chore(career-os): plan086 candidate-baseline-suggester 제거 + 통합 검증 + 완료 마킹

- .claude/skills/candidate-baseline-suggester/ 제거 (ADR-028 폐기)
- 잔존 참조 정리 (ADR 파일 제외)
- CLAUDE.md 진입점 정리
- plan086 통합 검증 통과
- index.json status=completed

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
EOF
)"
git log --oneline -1

echo "[working tree 잔여]"
git status --porcelain | head
```

---

## 의도 메모 (왜)

- candidate-baseline-suggester를 마지막 phase에서 제거하는 이유 — 드릴 스킬이 완성된 뒤 제거해야 weak_spots 갱신의 공백이 없다. phase-03·04 완료 전에 제거하면 약점 데이터 루프가 끊긴다.
- 통합 검증이 마지막 phase에 있는 이유 — phase-02~05가 각각 독립 검증을 통과했어도, 스킬 간 경계·CLAUDE.md 진입점·잔존 참조 정합성은 전체가 모인 뒤에만 확인 가능하다.
- push를 하지 않는 이유 — 메인 세션이 전체 diff를 review한 뒤 처리한다(career-os 운영 원칙).

---

## Blocked 조건

- 통합 검증의 어느 항목이라도 FAIL이면: `PHASE_FAILED: <항목> 검증 실패 — 해당 phase 재실행 후 이 phase 재실행`. 이 phase에서 직접 다른 phase 산출물을 고치지 않는다.
- candidate-baseline-suggester 스킬 디렉터리 git rm이 실패하면: `PHASE_BLOCKED: git rm 실패 — working tree 상태 확인`
- index.json python3 수정이 실패하면: `PHASE_BLOCKED: index.json 수정 실패 — python3 경로 및 파일 존재 확인`
