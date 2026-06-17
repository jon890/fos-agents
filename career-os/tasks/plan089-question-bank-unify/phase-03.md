# Phase 03 — drill-engine loadQuestionBank 재작성 (public+private merge) + 드릴 SKILL.md 의존 자산 갱신

**Model**: sonnet
**Status**: pending

---

## 목표

드릴 엔진이 `data/question-bank/`가 아니라 정본(public + private)을 읽게 한다(ADR-097).

- `scripts/interview-drill/drill-engine.ts`의 `loadQuestionBank`와 경로 헬퍼를 재작성한다.
- tech 드릴 = public 기술 카테고리 5개 통합 풀, behavioral 드릴 = `public/question-bank/behavioral/`.
- `private/question-bank/{tech,behavioral}-personal.jsonl`이 있으면 merge한다.
- 두 드릴 SKILL.md의 "의존 자산" 경로를 정본 경로로 갱신한다.

**범위 외**:
- public/private 질문 데이터 추가 금지(phase-01/02 완료)
- interview-asset-writer·question-bank-collector 수정 금지(phase-04/05)
- `data/question-bank/` 삭제 금지(phase-05)
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
# 현재 loadQuestionBank와 경로 헬퍼
grep -n "loadQuestionBank\|questionBankPath\|data.*question-bank\|DrillQuestion\|q.topic" career-os/scripts/interview-drill/drill-engine.ts
# DrillQuestion 인터페이스는 이미 topic 보유 — 확인
sed -n '28,40p' career-os/scripts/interview-drill/drill-engine.ts
```

### 2. loadQuestionBank 재작성

`drill-engine.ts`:
- `questionBankPath(drillType)` 헬퍼를 제거하거나 정본 경로 헬퍼로 교체.
- **경로 베이스**: public/private 경로는 기존 `careerOsRoot()` 헬퍼를 베이스로 join한다(cwd 상대 경로 금지). 워크트리/실행 위치 무관하게 동작해야 한다.
- `loadQuestionBank(drillType)` 새 동작:
  - **tech**: `careerOsRoot()/public/question-bank/{java-spring,database,cs,operations,system-design}/questions.json` 전부 읽어 통합(`behavioral` 제외).
  - **behavioral**: `careerOsRoot()/public/question-bank/behavioral/questions.json`.
  - public 파일은 **JSON 배열**이다(JSONL 아님) — `JSON.parse(readFileSync(...))`로 읽는다.
  - 그 다음 `careerOsRoot()/private/question-bank/{tech|behavioral}-personal.jsonl`이 존재하면 **JSONL로 파싱해 merge**한다(없으면 건너뜀, 에러 아님).
  - public·private 모두 `DrillQuestion`으로 정규화한다. `topic` 필드로 weak_spots를 추적하므로 둘 다 `topic`이 있어야 한다.
  - **private merge 방어**: private 항목이 `DrillQuestion` 필수 필드(`topic`·`question`·`answerSignals` 등)를 누락하면 그 항목은 건너뛰고 경고를 출력한다(손상된 personal.jsonl이 드릴 로드를 깨지 않게).
- 질문 풀이 비면 기존처럼 `/question-bank-collector` 안내를 출력한다.
- `selectQuestions`/`scoreAnswer`/`updateWeakSpots`/`shouldDispatchStudyPack`는 `q.topic` 기반이라 그대로 둔다(변경 불필요).

### 3. 두 드릴 SKILL.md "의존 자산" 경로 갱신

`career-os/.claude/skills/tech-interview-drill/SKILL.md`:
- `data/question-bank/tech-questions.jsonl` → `public/question-bank/{기술 카테고리}/questions.json` + `private/question-bank/tech-personal.jsonl`(있으면).

`career-os/.claude/skills/behavioral-interview-drill/SKILL.md`:
- `data/question-bank/behavioral-questions.jsonl` → `public/question-bank/behavioral/questions.json` + `private/question-bank/behavioral-personal.jsonl`(있으면).

질문 풀 비었을 때 안내 문구(`/question-bank-collector`)는 유지한다.

### 4. 컴파일·로드 검증

```bash
cd "$(git rev-parse --show-toplevel)"
bun --check career-os/scripts/interview-drill/drill-engine.ts || true
```

---

## common-pitfalls self-check (섹션 1~5)

- [ ] **섹션 1 (범위 준수)**: drill-engine.ts와 두 드릴 SKILL.md만. 데이터·다른 스킬·docs 금지.
- [ ] **섹션 2 (성공 기준 실행 가능성)**: bun --check + 로드 스모크 실행 가능.
- [ ] **섹션 3 (독립 실행 가능성)**: phase-01/02(public 정본) 완료 후 실행.
- [ ] **섹션 4 (작업 항목 4개)**: 현황·loadQuestionBank·SKILL.md·검증.
- [ ] **섹션 5 (blocked 조건 명시)**: 아래에 명시.

---

## 성공 기준

```bash
cd "$(git rev-parse --show-toplevel)"
FAIL=0

# data/question-bank 참조가 drill-engine에서 사라짐
grep -q "data/question-bank" career-os/scripts/interview-drill/drill-engine.ts \
  && { echo "[FAIL] drill-engine.ts에 data/question-bank 잔존"; FAIL=1; } || true

# public 정본 참조 존재
grep -q "public/question-bank" career-os/scripts/interview-drill/drill-engine.ts \
  || { echo "[FAIL] drill-engine.ts에 public/question-bank 참조 없음"; FAIL=1; }
grep -q "private/question-bank" career-os/scripts/interview-drill/drill-engine.ts \
  || { echo "[FAIL] drill-engine.ts에 private merge 경로 없음"; FAIL=1; }

# 컴파일
bun --check career-os/scripts/interview-drill/drill-engine.ts \
  || { echo "[FAIL] bun --check 실패"; FAIL=1; }

# 로드 스모크: tech/behavioral 풀이 1개 이상 로드되는지
bun -e "
import { loadQuestionBank } from './career-os/scripts/interview-drill/drill-engine.ts';
const t = loadQuestionBank('tech'); const b = loadQuestionBank('behavioral');
if (!t.length) { console.error('[FAIL] tech 풀 0'); process.exit(1); }
if (!b.length) { console.error('[FAIL] behavioral 풀 0'); process.exit(1); }
if (t.some(q=>!q.topic) || b.some(q=>!q.topic)) { console.error('[FAIL] topic 누락'); process.exit(1); }
console.log('OK tech', t.length, 'behavioral', b.length);
" || FAIL=1

# 드릴 SKILL.md 경로 갱신
grep -q "public/question-bank" career-os/.claude/skills/tech-interview-drill/SKILL.md \
  || { echo "[FAIL] tech-interview-drill SKILL.md 경로 미갱신"; FAIL=1; }
grep -q "public/question-bank/behavioral" career-os/.claude/skills/behavioral-interview-drill/SKILL.md \
  || { echo "[FAIL] behavioral-interview-drill SKILL.md 경로 미갱신"; FAIL=1; }

if [ "$FAIL" = "0" ]; then
  echo "SUCCESS: phase-03 통과"
else
  echo "PHASE_FAILED: 위 항목 수정 후 재실행"; exit 1
fi
```

---

## commit (push 금지)

```bash
cd "$(git rev-parse --show-toplevel)"
git add career-os/scripts/interview-drill/drill-engine.ts \
  career-os/.claude/skills/tech-interview-drill/SKILL.md \
  career-os/.claude/skills/behavioral-interview-drill/SKILL.md
git diff --cached --name-only
git commit -q -m "$(cat <<'EOF'
refactor(career-os): drill-engine을 public+private 정본 merge로 재작성 (ADR-097)

- loadQuestionBank: public 기술 카테고리 순회 + private personal.jsonl merge
- public은 JSON 배열, private은 JSONL — 파서 분기
- topic 키로 weak_spots 추적(기존 로직 유지)
- 두 드릴 SKILL.md 의존 자산 경로를 정본으로 갱신

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
EOF
)"
git log --oneline -1
git status --porcelain | head
```

---

## Blocked 조건

- public 정본이 없으면(phase-01/02 미완료): `PHASE_BLOCKED: public 정본 미존재`
- `bun`이 없으면: `PHASE_BLOCKED: bun 미설치 — 로드 스모크 불가`
- 성공 기준 FAIL 시: `PHASE_FAILED: 위 항목 수정 후 재실행`
