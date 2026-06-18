# Phase 05 — question-bank-collector behavioral 확장 + data/question-bank 폐기 + 잔존 참조 정리 + 통합 검증

**Model**: sonnet
**Status**: pending

---

## 목표

정본 1원화를 마무리한다(ADR-097).

- `question-bank-collector`가 behavioral 카테고리도 보강 대상에 포함하게 한다.
- `data/question-bank/`를 폐기(삭제)한다.
- skills/scripts/validate에 남은 `data/question-bank` 참조를 0으로 만든다.
- 통합 검증 후 `index.json` status를 completed로 마킹한다.

**범위 외**:
- docs/ADR 수정 금지(이미 반영됨)
- public/private 질문 데이터 추가 작업 금지(이전 phase 완료)
- push·PR 금지(메인 세션이 처리)

---

## 사전 cwd 설정

```bash
cd "$(git rev-parse --show-toplevel)"
pwd
```

---

## 작업 항목

### 1. question-bank-collector behavioral 확장

`career-os/.claude/skills/question-bank-collector/SKILL.md`:
- 보강 대상 카테고리에 `behavioral` 추가(일반 STAR·협업·성장 질문).
- 의존 자산·디렉터리 목록에 `public/question-bank/behavioral/questions.json` 추가.
- 경계 유지: 개인 답변·지원 전략·회사별 맥락은 넣지 않는다. 개인 질문은 `private/question-bank/`(interview-asset-writer 담당).

(phase-01에서 validate.ts에 behavioral은 이미 반영됨 — 누락됐으면 여기서 보완.)

### 2. data/question-bank 잔존 참조 점검

```bash
cd "$(git rev-parse --show-toplevel)"
grep -rn "data/question-bank" career-os/scripts career-os/.claude/skills career-os/CLAUDE.md 2>/dev/null
```
- 남은 참조를 정본 경로로 바꾸거나 제거한다(docs는 이미 갱신됨, 건드리지 않는다).
- **실측 알려진 잔존**: `career-os/scripts/application-agent/skill_contracts.ts`에 `data/question-bank/{topic}.jsonl` 출력 계약 문자열이 있다(question-bank-collector 옛 출력). ADR-097 이후 collector 출력은 `public/question-bank/<category>/questions.json`이므로 이 문자열을 정정한다. 이 파일을 정정하지 않으면 아래 성공 기준 grep이 무조건 FAIL이다.

### 3. data/question-bank 폐기 (삭제)

`.gitignore`는 `**/data/`를 무시하되 `!**/data/question-bank/`로 예외 추적 중이다(실측). 따라서 git이 추적하므로 `git rm`이 정상 경로다.

```bash
cd "$(git rev-parse --show-toplevel)"
git rm -r career-os/data/question-bank/ \
  || { echo "git rm 실패 — 권한 차단 가능"; rm -rf career-os/data/question-bank/ || true; }
ls career-os/data/question-bank/ 2>/dev/null && echo "아직 존재" || echo "삭제됨"
```
- **삭제 후에도 디렉터리가 남으면 권한 차단이다 → `PHASE_BLOCKED`(PHASE_FAILED 아님)로 보고하고, 메인 세션이 `git rm`을 수행하도록 넘긴다.** 나머지 작업(collector 확장·참조 정리)은 commit한다.

### 4. 통합 검증 (드릴 1회 로드)

```bash
cd "$(git rev-parse --show-toplevel)"
bun career-os/scripts/question-bank-collector/validate.ts
bun -e "
import { loadQuestionBank } from './career-os/scripts/interview-drill/drill-engine.ts';
console.log('tech', loadQuestionBank('tech').length, 'behavioral', loadQuestionBank('behavioral').length);
"
```

### 5. index.json status=completed 마킹

`tasks/plan089-question-bank-unify/index.json`의 `status`를 `completed`, `current_phase`를 5로, 각 phase status를 completed로 갱신한다(commitSha는 메인 세션 review 후 채워질 수 있음).

---

## common-pitfalls self-check (섹션 1~5)

- [ ] **섹션 1 (범위 준수)**: collector·data 삭제·잔존 참조·index.json만. docs 금지.
- [ ] **섹션 2 (성공 기준 실행 가능성)**: grep 0 + validate + 로드 실행 가능.
- [ ] **섹션 3 (독립 실행 가능성)**: phase-01~04 완료 후 마지막 실행.
- [ ] **섹션 4 (작업 항목 5개)**: collector·참조 점검·삭제·검증·index 마킹.
- [ ] **섹션 5 (blocked 조건 명시)**: 아래에 명시.

---

## 성공 기준

```bash
cd "$(git rev-parse --show-toplevel)"
FAIL=0

# data/question-bank 참조 0 (docs 제외 — docs는 이미 갱신됨)
HITS=$(grep -rn "data/question-bank" career-os/scripts career-os/.claude/skills career-os/CLAUDE.md 2>/dev/null | wc -l | tr -d ' ')
[ "$HITS" = "0" ] || { echo "[FAIL] data/question-bank 참조 $HITS건 잔존(코드/스킬)"; FAIL=1; }

# data/question-bank 디렉터리 삭제됨
[ -d career-os/data/question-bank ] && { echo "[FAIL] data/question-bank 디렉터리 잔존"; FAIL=1; } || true

# collector behavioral 확장
grep -q "behavioral" career-os/.claude/skills/question-bank-collector/SKILL.md \
  || { echo "[FAIL] question-bank-collector에 behavioral 미반영"; FAIL=1; }

# validate + 드릴 로드
bun career-os/scripts/question-bank-collector/validate.ts || { echo "[FAIL] validate 실패"; FAIL=1; }
bun -e "
import { loadQuestionBank } from './career-os/scripts/interview-drill/drill-engine.ts';
const t=loadQuestionBank('tech'),b=loadQuestionBank('behavioral');
if(!t.length||!b.length){console.error('[FAIL] 풀 비어있음');process.exit(1)}
console.log('OK tech',t.length,'behavioral',b.length);
" || FAIL=1

# index.json completed
grep -q '"status": "completed"' career-os/tasks/plan089-question-bank-unify/index.json \
  || { echo "[FAIL] index.json status 미갱신"; FAIL=1; }

if [ "$FAIL" = "0" ]; then
  echo "SUCCESS: phase-05 통과 — plan089 완료"
else
  echo "PHASE_FAILED: 위 항목 수정 후 재실행"; exit 1
fi
```

---

## commit (push 금지)

```bash
cd "$(git rev-parse --show-toplevel)"
git add career-os/.claude/skills/question-bank-collector/ \
  career-os/scripts/ career-os/CLAUDE.md \
  career-os/tasks/plan089-question-bank-unify/index.json
# data/question-bank 삭제분 stage
git add -A career-os/data/question-bank 2>/dev/null || true
git diff --cached --name-only
git commit -q -m "$(cat <<'EOF'
feat(career-os): question-bank-collector behavioral 확장 + data/question-bank 폐기 (ADR-097)

- question-bank-collector behavioral 카테고리 보강 대상 포함
- data/question-bank/ 삭제(정본은 public/question-bank)
- 코드·스킬 잔존 참조 정리, 드릴 로드 통합 검증
- plan089 index.json status=completed

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
EOF
)"
git log --oneline -1
git status --porcelain | head
```

---

## Blocked 조건

- `data/question-bank` 삭제가 권한으로 막히면: `PHASE_BLOCKED: data/ 삭제 권한 차단 — 메인 세션이 git rm 수행 필요`
- 드릴 로드 스모크에서 풀이 비면: `PHASE_BLOCKED: 정본 풀 비어있음 — phase-01/02 재확인`
- 성공 기준 FAIL 시: `PHASE_FAILED: 위 항목 수정 후 재실행`
