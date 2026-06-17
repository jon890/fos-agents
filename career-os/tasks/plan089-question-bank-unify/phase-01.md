# Phase 01 — public 질문 topic 필드 추가 + behavioral 카테고리 신설 + validate.ts 동반 수정

**Model**: sonnet
**Status**: pending

---

## 목표

질문 정본을 `public/question-bank/`로 모으기 위한 첫 단계다(ADR-096).

- 기존 public 질문 전체에 `topic` 필드를 추가한다(= `study-progress.json` weak_spots 키).
- `public/question-bank/behavioral/` 카테고리를 신설하고, `data/question-bank/behavioral-questions.jsonl` 5개를 public 스키마로 보강해 이관한다.
- `scripts/question-bank-collector/validate.ts`에 `behavioral` 카테고리와 `topic` 필수 필드를 동반 반영한다.

**범위 외**:
- data tech 질문 이관 금지(phase-02)
- drill-engine.ts 수정 금지(phase-03)
- docs/ADR 수정 금지(이미 plan088 docs 커밋에서 반영됨)
- `data/question-bank/` 삭제 금지(phase-05) — behavioral 원본은 phase-05까지 남겨 둔다
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
# validate.ts의 CATEGORIES·REQUIRED_FIELDS 확인 (핵심 함정)
grep -n "CATEGORIES\|REQUIRED_FIELDS\|expectedCategory\|publicSafe\|source" career-os/scripts/question-bank-collector/validate.ts
# public 질문 스키마 샘플
head -25 career-os/public/question-bank/database/questions.json
# behavioral 원본
cat career-os/data/question-bank/behavioral-questions.jsonl
```

### 2. validate.ts 동반 수정 (먼저 한다)

`career-os/scripts/question-bank-collector/validate.ts`:
- **`QuestionItem` 인터페이스에 `topic: string;` 필드 추가** — `REQUIRED_FIELDS: Array<keyof QuestionItem>` 타입이라, 인터페이스에 없으면 `"topic"` 추가 시 컴파일 에러가 난다(필수).
- `REQUIRED_FIELDS`에 `"topic"` 추가.
- `validateItem`에 `topic` kebab-case 형식 assert 1줄 추가 권장(`/^[a-z0-9]+(-[a-z0-9]+)*$/`).
- `CATEGORIES` 배열에 `"behavioral"` 추가.
  - **영향 인지**: `CATEGORIES`는 `scanQuestionBankInventory`(collector 인벤토리 스캔)에도 쓰여, behavioral도 스캔·`total >= 15` 카운트에 포함된다. behavioral 5개 추가로 total은 늘어 통과한다. collector SKILL.md 문구 보강은 phase-05에서 한다(여기선 검증 코드만).
- behavioral 카테고리도 `source` prefix 강제(`public-`)·`category === expectedCategory`·`id`가 `${category}-` prefix 규칙을 그대로 적용한다.

검증이 깨지지 않게 validate.ts를 먼저 고친 뒤 데이터를 추가한다.

### 3. public 기존 질문 전체에 topic 필드 추가

`public/question-bank/{java-spring,database,cs,operations,system-design}/questions.json` 각 항목에 `topic` 추가.

- `topic`은 kebab-case, 질문이 다루는 개념 단위(예: database의 JPA N+1 질문 → `jpa-n+1`).
- 같은 개념은 같은 topic으로 묶어 weak_spots가 분산되지 않게 한다.
- data 풀의 기존 topic 값(`jpa-n+1`, `transaction-isolation`, `redis-cache-aside` 등)과 겹치는 개념은 **같은 topic 문자열**을 쓴다(phase-02 이관 시 충돌·중복 방지).

### 4. behavioral 카테고리 신설 + 질문 이관

- `public/question-bank/behavioral/questions.json` 생성(JSON 배열).
- `data/question-bank/behavioral-questions.jsonl` 5개를 public 스키마로 보강:
  - `id`: `behavioral-001` ~ (category prefix 규칙. 원본 `beh-001`에서 재작성 필수)
  - `topic`: 기존 topic 유지(`conflict-resolution`, `failure-learning` 등). **역량 범주(협업·성장)는 topic이 의미를 담는다.**
  - `category`: **`behavioral`로 통일**(validate.ts가 category=디렉터리명을 강제). 원본 `collaboration`/`growth` category 값은 버린다(topic이 그 의미를 표현하고, 드릴 엔진은 category가 아니라 topic으로 weak_spots를 추적한다).
  - `difficulty`: 기존 값 매핑(basic|intermediate|advanced)
  - `question`, `intent`, `answerSignals`: 기존 값 사용
  - `source`: `public-general-behavioral-knowledge` 같은 `public-` prefix 값
  - `publicSafe`: true
  - `positionFitHint`, `normalizedFrom`: 보강 작성
  - `followUps`: 있으면 유지
  - **본문 제약**: behavioral 질문 본문은 `validate.ts`의 `PRIVATE_PATTERNS`(`/내 경력/`, `/개인 이력/` 등)·`BOUNDARY_ONLY_PATTERNS`(`/지원 전략/`, `/유료 강의/` 등)에 걸리지 않는 일반 표현만 쓴다. 개인 경력·이력을 직접 언급하지 않는다(걸리면 public validate 실패).
- `public/question-bank/README.md`에 behavioral 카테고리 줄 추가.

---

## common-pitfalls self-check (섹션 1~5)

- [ ] **섹션 1 (범위 준수)**: public JSON·behavioral 신설·validate.ts만. data tech 이관·drill-engine·docs 금지.
- [ ] **섹션 2 (성공 기준 실행 가능성)**: 아래 validate 실행으로 확인.
- [ ] **섹션 3 (독립 실행 가능성)**: 첫 phase, 선행 의존 없음.
- [ ] **섹션 4 (작업 항목 4개)**: 현황·validate.ts·topic 추가·behavioral 이관.
- [ ] **섹션 5 (blocked 조건 명시)**: 아래에 명시.

---

## 성공 기준

```bash
cd "$(git rev-parse --show-toplevel)"
FAIL=0

# behavioral 카테고리 존재
[ -f career-os/public/question-bank/behavioral/questions.json ] \
  || { echo "[FAIL] behavioral/questions.json 없음"; FAIL=1; }

# 모든 public 질문에 topic 필드 (5 기술 카테고리 + behavioral)
for c in java-spring database cs operations system-design behavioral; do
  f="career-os/public/question-bank/$c/questions.json"
  [ -f "$f" ] || { echo "[FAIL] $f 없음"; FAIL=1; continue; }
  python3 -c "
import json,sys
d=json.load(open('$f'))
miss=[q.get('id') for q in d if 'topic' not in q or not q['topic']]
if miss: print('[FAIL] $c topic 누락:', miss); sys.exit(1)
" || FAIL=1
done

# validate.ts에 behavioral·topic 반영
grep -q "behavioral" career-os/scripts/question-bank-collector/validate.ts \
  || { echo "[FAIL] validate.ts에 behavioral 미반영"; FAIL=1; }
grep -q '"topic"' career-os/scripts/question-bank-collector/validate.ts \
  || { echo "[FAIL] validate.ts에 topic 필수 미반영"; FAIL=1; }

# validator 통과
bun career-os/scripts/question-bank-collector/validate.ts \
  || { echo "[FAIL] validate.ts 실행 실패"; FAIL=1; }

if [ "$FAIL" = "0" ]; then
  echo "SUCCESS: phase-01 통과"
else
  echo "PHASE_FAILED: 위 항목 수정 후 재실행"; exit 1
fi
```

---

## commit (push 금지)

```bash
cd "$(git rev-parse --show-toplevel)"
git add career-os/public/question-bank/ career-os/scripts/question-bank-collector/validate.ts
git diff --cached --name-only
git commit -q -m "$(cat <<'EOF'
feat(career-os): public 질문 topic 필드 추가 + behavioral 카테고리 신설 (ADR-096)

- public 전 카테고리 질문에 topic 필드(weak_spots 키) 추가
- public/question-bank/behavioral/ 신설, data behavioral 5개 이관·보강
- validate.ts에 behavioral 카테고리·topic 필수 필드 반영

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
EOF
)"
git log --oneline -1
git status --porcelain | head
```

---

## Blocked 조건

- `bun`이 없거나 validate.ts 의존이 깨지면: `PHASE_BLOCKED: bun/validate 환경 미비`
- behavioral 원본(`data/question-bank/behavioral-questions.jsonl`)을 못 읽으면: `PHASE_BLOCKED: behavioral 원본 미존재`
- 성공 기준 FAIL 시: `PHASE_FAILED: 위 항목 수정 후 재실행`
