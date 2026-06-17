# Phase 04 — behavioral-interview-drill 신규 스킬

**Model**: sonnet
**Status**: pending

---

## 목표

`behavioral-interview-drill` 스킬을 신규 작성한다.
phase-03에서 만든 공용 드릴 엔진(`scripts/interview-drill/drill-engine.ts`)을 재사용한다.
질문 풀(`data/question-bank/behavioral-questions.jsonl`)과 채점 rubric(STAR·가치관 관점)만 다르다.

**범위 외**:
- drill-engine.ts 수정 금지 (phase-03에서 완성됨)
- tech-interview-drill 수정 금지
- interview-stage-prep 작성 금지 (phase-05)
- docs/ADR 수정 금지
- push·PR 금지

---

## 사전 cwd 설정

```bash
cd "$(git rev-parse --show-toplevel)"
pwd
```

---

## 작업 항목

### 1. 현황 파악

```bash
cd "$(git rev-parse --show-toplevel)"
# 공용 드릴 엔진 확인
ls career-os/scripts/interview-drill/
# behavioral 질문 풀 확인 (phase-03에서 초안 생성됨)
cat career-os/data/question-bank/behavioral-questions.jsonl | head -20 2>/dev/null || echo "파일 없음"
# tech-interview-drill SKILL.md 참조 (구조 정렬용)
head -50 career-os/.claude/skills/tech-interview-drill/SKILL.md
```

### 2. behavioral 채점 rubric 작성

`career-os/.claude/skills/behavioral-interview-drill/references/scoring-rubric.md` 신규 작성.

STAR 관점 채점 기준:
- **통과**: Situation·Task·Action·Result 4요소 포함, 행동 주도성·수치/결과 명확
- **얕음**: STAR 구조는 있으나 Result 빈약하거나 행동이 팀 공동 서술에 그침
- **틀림**: 상황 서술만 있고 행동·결과 없음, 또는 질문과 무관한 답변

가치관 관점 채점 기준:
- **통과**: 지원자 가치관·동기가 명확히 드러나고 일관성 있음
- **얕음**: 상투적 표현(성장·열정)으로만 서술, 구체적 근거 없음
- **틀림**: 가치관이 드러나지 않거나 상충

### 3. behavioral-interview-drill 스킬 작성

`career-os/.claude/skills/behavioral-interview-drill/SKILL.md` 신규 작성.

포함 내용:
- description: "매일 인성 면접 질문(STAR·가치관)에 1문장으로 답하고 채점·약점 환류. 공용 드릴 엔진 재사용. 매일 실행."
- tech-interview-drill과 동일한 드릴 진행 흐름
- 채점 rubric은 `references/scoring-rubric.md` 참조
- 질문 풀: `data/question-bank/behavioral-questions.jsonl`
- 기록 경로: `data/runtime/drill-log-YYYY-MM-DD.jsonl` (tech 드릴과 동일 파일, `drill_type: "behavioral"`로 구분)
- 약점 환류: 같은 역량 범주(협업·문제해결·리더십 등) 2회+ 얕음·틀림이면 study-pack-writer 위임

`.codex/skills/` 심링크 생성:
```bash
ln -sf ../../.claude/skills/behavioral-interview-drill career-os/.codex/skills/behavioral-interview-drill
```

### 4. CLAUDE.md 진입점 추가

`career-os/CLAUDE.md`의 agent skill 목록에 `/behavioral-interview-drill` 진입점 추가.

---

## common-pitfalls self-check (섹션 1~5)

- [ ] **섹션 1 (범위 준수)**: behavioral-interview-drill 스킬만. drill-engine.ts·tech-interview-drill·stage-prep 수정 금지.
- [ ] **섹션 2 (성공 기준 실행 가능성)**: 아래 검증 명령 직접 실행 가능 확인.
- [ ] **섹션 3 (독립 실행 가능성)**: phase-03 완료 후 단독 실행 가능.
- [ ] **섹션 4 (작업 항목 4개)**: 현황 파악·rubric·스킬·CLAUDE.md.
- [ ] **섹션 5 (blocked 조건 명시)**: 아래에 명시.

---

## 성공 기준

```bash
cd "$(git rev-parse --show-toplevel)"
FAIL=0

# behavioral-interview-drill 스킬 존재 확인
[ -f career-os/.claude/skills/behavioral-interview-drill/SKILL.md ] \
  || { echo "[FAIL] behavioral-interview-drill/SKILL.md 없음"; FAIL=1; }

# SKILL.md 핵심 구절 확인
grep -q "drill-engine\|드릴 엔진" career-os/.claude/skills/behavioral-interview-drill/SKILL.md \
  || { echo "[FAIL] SKILL.md에 드릴 엔진 참조 없음"; FAIL=1; }
grep -qi "STAR\|가치관" career-os/.claude/skills/behavioral-interview-drill/SKILL.md \
  || { echo "[FAIL] SKILL.md에 STAR·가치관 채점 언급 없음"; FAIL=1; }
grep -q "study-pack-writer" career-os/.claude/skills/behavioral-interview-drill/SKILL.md \
  || { echo "[FAIL] SKILL.md에 study-pack-writer 위임 없음"; FAIL=1; }

# rubric 파일 존재 확인
[ -f career-os/.claude/skills/behavioral-interview-drill/references/scoring-rubric.md ] \
  || { echo "[FAIL] scoring-rubric.md 없음"; FAIL=1; }

# 질문 풀 파일 확인 (phase-03 생성)
[ -f career-os/data/question-bank/behavioral-questions.jsonl ] \
  || { echo "[FAIL] behavioral-questions.jsonl 없음"; FAIL=1; }

# CLAUDE.md 진입점 확인
grep -q "behavioral-interview-drill" career-os/CLAUDE.md \
  || { echo "[FAIL] CLAUDE.md 진입점 누락"; FAIL=1; }

# drill-engine.ts 미수정 확인
git diff HEAD career-os/scripts/interview-drill/drill-engine.ts 2>/dev/null \
  | grep -q "^[+-]" && { echo "[FAIL] drill-engine.ts가 이 phase에서 수정됨(범위 외)"; FAIL=1; } || true

if [ "$FAIL" = "0" ]; then
  echo "SUCCESS: phase-04 behavioral-interview-drill 검증 통과"
else
  echo "PHASE_FAILED: 위 항목 수정 후 재실행"
  exit 1
fi
```

---

## commit (push 금지)

```bash
cd "$(git rev-parse --show-toplevel)"
git add \
  career-os/.claude/skills/behavioral-interview-drill/ \
  career-os/CLAUDE.md
# .codex 심링크도 추가
git diff --cached --name-only
git commit -q -m "$(cat <<'EOF'
feat(career-os): behavioral-interview-drill 스킬 신규 추가

- .claude/skills/behavioral-interview-drill/SKILL.md: 매일 인성 면접 드릴
- references/scoring-rubric.md: STAR·가치관 관점 채점 기준
- 공용 드릴 엔진 재사용, drill_type: "behavioral" 구분
- CLAUDE.md 진입점 추가

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
EOF
)"
git log --oneline -1
echo "[working tree 잔여]"
git status --porcelain | head
```

---

## Blocked 조건

- phase-03의 drill-engine.ts가 없으면: `PHASE_BLOCKED: drill-engine.ts 미존재 — phase-03 완료 후 실행`
- behavioral-questions.jsonl이 없으면: `PHASE_BLOCKED: behavioral-questions.jsonl 미존재 — phase-03에서 생성됐는지 확인`
- 성공 기준 검증 FAIL 시: `PHASE_FAILED: 위 항목 수정 후 재실행`
