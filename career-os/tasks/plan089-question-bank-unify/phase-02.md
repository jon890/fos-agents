# Phase 02 — data tech 질문 12개 public 기술 카테고리로 이관 + 중복 제거

**Model**: sonnet
**Status**: pending

---

## 목표

`data/question-bank/tech-questions.jsonl` 12개를 public 기술 카테고리로 이관한다(ADR-096).
public에 이미 있는 중복 질문은 버리고, 없는 것만 public 스키마로 보강해 넣는다.

**범위 외**:
- behavioral 추가 작업 금지(phase-01 완료)
- drill-engine.ts 수정 금지(phase-03)
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
cat career-os/data/question-bank/tech-questions.jsonl
# 각 public 기술 카테고리 현재 질문 topic·question 목록
for c in java-spring database cs operations system-design; do
  echo "=== $c ==="
  python3 -c "import json; [print(q.get('topic'),'|',q['question'][:40]) for q in json.load(open('career-os/public/question-bank/$c/questions.json'))]"
done
```

### 2. category 매핑 (data tech → public 기술 카테고리)

| data category | → public 카테고리 | 판단 기준 |
|---|---|---|
| `database` | `database` | JPA·트랜잭션·인덱스·deadlock·connection-pool |
| `framework` | `java-spring` | Spring bean scope 등 |
| `network` | `cs` | HTTP caching 등 네트워크 기초 |
| `architecture` | `system-design` | event-driven 등 설계 |
| `infra` | **질문별 판단** | redis·캐시 일관성 → `database`; kafka·queue·확장성 → `system-design`; circuit-breaker·zero-downtime·배포·장애 → `operations` |

### 3. 이관 규칙

- 각 질문을 대상 카테고리 `questions.json`에 추가.
- `id`는 대상 카테고리 prefix로 재발급(예: `tech-006` → `java-spring-NNN`).
- `topic`은 data 풀의 기존 값을 그대로 살린다. phase-01에서 같은 개념에 같은 topic을 부여했으면 중복 질문이므로 추가하지 않는다.
- public 스키마 보강: `source`(`public-` prefix), `publicSafe: true`, `positionFitHint`, `normalizedFrom` 추가.
- **중복 제거**: 같은 개념(같은 topic 또는 거의 동일한 question)이 public에 이미 있으면 data 쪽을 버린다. answerSignals가 더 풍부한 쪽을 남긴다.

### 4. behavioral은 건드리지 않는다

tech 12개만 이관한다. behavioral은 phase-01에서 완료됐다.

---

## common-pitfalls self-check (섹션 1~5)

- [ ] **섹션 1 (범위 준수)**: public 기술 카테고리 JSON만. behavioral·drill-engine·docs 금지.
- [ ] **섹션 2 (성공 기준 실행 가능성)**: validate + 중복 검사 실행 가능.
- [ ] **섹션 3 (독립 실행 가능성)**: phase-01(topic 필드) 완료 후 실행.
- [ ] **섹션 4 (작업 항목 4개 이하)**: 현황·매핑·이관·중복 제거.
- [ ] **섹션 5 (blocked 조건 명시)**: 아래에 명시.

---

## 성공 기준

```bash
cd "$(git rev-parse --show-toplevel)"
FAIL=0

# validator 통과
bun career-os/scripts/question-bank-collector/validate.ts \
  || { echo "[FAIL] validate.ts 실패"; FAIL=1; }

# data tech의 각 topic이 public 어딘가에 존재(이관 또는 중복 흡수 확인)
python3 -c "
import json,glob
data_topics={json.loads(l)['topic'] for l in open('career-os/data/question-bank/tech-questions.jsonl') if l.strip()}
pub_topics=set()
for f in glob.glob('career-os/public/question-bank/*/questions.json'):
    for q in json.load(open(f)): pub_topics.add(q.get('topic'))
missing=data_topics - pub_topics
import sys
if missing: print('[FAIL] public에 미반영 topic:', missing); sys.exit(1)
print('OK: data tech topic 전부 public 반영')
" || FAIL=1

# 같은 topic 중복(한 topic이 여러 카테고리에 산재) 점검 — 경고만
python3 -c "
import json,glob,collections
loc=collections.defaultdict(set)
for f in glob.glob('career-os/public/question-bank/*/questions.json'):
    cat=f.split('/')[-2]
    for q in json.load(open(f)): loc[q.get('topic')].add(cat)
dup={t:c for t,c in loc.items() if len(c)>1}
if dup: print('[WARN] 여러 카테고리에 걸친 topic:', dup)
"

if [ "$FAIL" = "0" ]; then
  echo "SUCCESS: phase-02 통과"
else
  echo "PHASE_FAILED: 위 항목 수정 후 재실행"; exit 1
fi
```

---

## commit (push 금지)

```bash
cd "$(git rev-parse --show-toplevel)"
git add career-os/public/question-bank/
git diff --cached --name-only
git commit -q -m "$(cat <<'EOF'
feat(career-os): data tech 질문 12개 public 기술 카테고리로 이관 (ADR-096)

- category 매핑(database/java-spring/cs/operations/system-design)대로 이관
- id 재발급 + public 스키마 보강(source/publicSafe/positionFitHint)
- public 기존 질문과 중복(같은 topic)은 제거

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
EOF
)"
git log --oneline -1
git status --porcelain | head
```

---

## Blocked 조건

- phase-01의 topic 필드가 없으면: `PHASE_BLOCKED: phase-01 미완료 — public 질문에 topic 없음`
- validate 실패가 데이터 보강으로 해결 안 되면: `PHASE_FAILED: validate 항목 수정 후 재실행`
