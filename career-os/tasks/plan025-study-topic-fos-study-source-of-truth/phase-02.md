# Phase 2 — study-topic-recommender SKILL.md Claude duplicate review + morning markdown 보강 후보 섹션

**Model**: sonnet
**Status**: pending

---

## 목표

ADR-033 2단계 — `study-topic-recommender` native skill SKILL.md에 Claude duplicate review 단계를 명시적으로 박고, morning markdown rendering이 `excluded.possibleDuplicates` + Claude review 결과를 읽어 "기존 문서 보강 후보" 섹션(최대 5개)을 출력하도록 한다. Claude review 실패 시 추천 전체는 계속 진행하고 markdown 상단에 warning 라인을 추가한다.

## 사전 검증

```bash
cd /home/bifos/ai-nodes

# phase-01 commit
git log -1 --format='%s' | grep -q "plan025 phase-01" \
  || { echo "PHASE_BLOCKED: phase-01 commit 없음"; exit 2; }

# phase-01 산출물 존재
test -f career-os/scripts/study-topic-recommender/duplicate_detection.ts \
  || { echo "PHASE_BLOCKED: duplicate_detection.ts 부재 — phase-01 미완"; exit 2; }
test -f career-os/scripts/study-topic-recommender/fos_study_inventory.ts \
  || { echo "PHASE_BLOCKED: fos_study_inventory.ts 부재 — phase-01 미완"; exit 2; }

# inventory 새 스키마
python3 -c "
import json, sys
data = json.load(open('career-os/data/runtime/topic-inventory.json'))
if 'excluded' not in data or 'claudeDuplicateReview' not in data:
    print('PHASE_BLOCKED: inventory 새 스키마 부재'); sys.exit(1)
" || exit 2

# branch
[ "$(git branch --show-current)" = "main" ] \
  || { echo "PHASE_BLOCKED: branch != main"; exit 2; }

echo "사전 검증 OK"
```

## 작업 항목

### 1. `refresh_topic_inventory.ts` markdown rendering 갱신

본 phase에서는 *데이터를 변형하지 않고* 렌더링 함수만 손댄다.

1-1. **`updateExistingRecommendations` 배열 채움**:

```ts
// inventory.claudeDuplicateReview.items 중 decision == "update-existing" || "needs-user-confirmation"
//   → updateExistingRecommendations[]
// items 없으면 (status=skipped|failed) excluded.possibleDuplicates에서 fallback으로 채움
const updateExisting = (review.items?.length
  ? review.items.filter(i => i.decision === "update-existing" || i.decision === "needs-user-confirmation")
  : dedupeResult.possibleDuplicates.map(p => ({
      ...p,
      decision: "needs-user-confirmation",
      reason: p.reason + " (Claude review skipped/failed — deterministic 추정)",
    }))
).slice(0, 5);
```

1-2. **morning-topic-recommendation.md 섹션 추가** (백엔드/기술블로그/AI/Geek 다음, 오늘의 3선 뒤):

```md
## 기존 문서 보강 후보 (최대 5)

> ⚠️ Claude duplicate review 실패 — deterministic 중복 필터 결과만 반영했습니다.   <!-- review.status == "failed"일 때만 출력 -->

1. **<candidatePath>**
   - 기존 문서: <matchedPath>
   - 판단: <decision> (<reason>)
   - 추천 액션: 새 study-pack 생성 금지 → 기존 문서에 누락 항목 보강
```

후보가 0이면 "- (보강 후보 없음 — 모든 추천은 새 study-pack 가능)" 한 줄.

`review.status == "failed"`이면 markdown 최상단 (`# 오늘의 학습/리딩 추천 ...` 다음 빈 줄 자리)에도 warning 라인 1줄:

```md
> ⚠️ Claude duplicate review 실패 — 추천은 deterministic dedupe 기준입니다.
```

### 2. `.claude/skills/study-topic-recommender/SKILL.md` Workflow 섹션 갱신

2-1. **Inputs 섹션**: `data/generated-artifacts.json` 항목 제거. `sources/fos-study/**/*.md` 트리 직접 스캔 명시. fos-study root 절대 경로는 `career-os/sources/fos-study/`.

2-2. **Workflow 섹션** — Step 2 다음 Step 2.5 추가:

```md
### 2.5 Claude duplicate review (ADR-033)

`data/runtime/topic-inventory.json`을 Read하고 `excluded.possibleDuplicates` 배열을 의미 판정한다.

각 후보를 다음 4 decision label 중 하나로 분류:
- `new` — 의미적으로 다른 주제. 새 study-pack 추천 가능.
- `update-existing` — 같은 핵심 주제. 기존 문서 보강 후보.
- `skip` — visible recommendation에서 제외.
- `needs-user-confirmation` — 애매. 사용자 확인 필요.

판정 결과를 inventory의 `claudeDuplicateReview` 객체에 Write:

\`\`\`json
{
  "status": "ok",
  "reviewedAt": "ISO-8601 now",
  "items": [
    { "key": "...", "candidatePath": "...", "matchedPath": "...", "decision": "...", "reason": "..." }
  ]
}
\`\`\`

판정 입력 최소화: candidate.candidatePath / matched.matchedPath / 옵션으로 matched 파일의 첫 30줄만. 본문 전체는 비용 큼.

review 실행 자체가 실패하면 (Claude 호출 자체가 안 되거나 schema 위반):
- `claudeDuplicateReview.status = "failed"` + `reviewedAt = now` + `items = []`로 Write
- 추천 전체는 실패시키지 않음 — 다음 단계로 진행
- morning markdown에 warning 표시 책임은 `refresh_topic_inventory.ts`의 rendering 단계
```

2-3. **Workflow Step 3** (결과 출력) 이전에 morning markdown 재생성 단계 명시:

```md
### 2.6 morning markdown 재생성

`claudeDuplicateReview`를 inventory에 반영한 뒤 markdown을 재생성한다. **주의: 일반 `refresh_topic_inventory.ts` 재호출은 inventory를 다시 계산하면서 Claude review 결과를 덮어쓸 수 있으므로 금지한다.**

허용 구현 중 하나를 선택한다.

1. `refresh_topic_inventory.ts --render-only` 같은 render-only 모드를 추가해 기존 `topic-inventory.json`을 읽고 markdown만 다시 쓴다.
2. native skill이 `data/runtime/morning-topic-recommendation.md`를 직접 Edit해 "기존 문서 보강 후보" 섹션 + (필요 시) 상단 warning 라인을 반영한다.

권장: render-only 모드. 일반 refresh와 render-only를 분리해 Claude review 결과가 사라지지 않게 한다.
```

2-4. **Error handling 표 갱신**:

| 상황 | 처리 |
|---|---|
| Claude duplicate review 호출 실패 | `claudeDuplicateReview.status = "failed"`, items = []. 추천 전체는 계속. markdown warning 표시 |
| possibleDuplicates 0개 | review skip. status = "skipped" 그대로 |
| review 결과 schema 위반 | "failed" 처리 + stderr 로그. 추천 계속 |

### 3. 검증

```bash
cd /home/bifos/ai-nodes

# A. ts 일반 실행 (초기 inventory + deterministic fallback 생성)
bun --env-file=career-os/.env career-os/scripts/study-topic-recommender/refresh_topic_inventory.ts \
  || { echo "PHASE_FAILED: refresh_topic_inventory.ts 실행 실패"; exit 1; }

# A-2. render-only 모드를 구현했다면 Claude review 보존 재렌더도 검증
# render-only 미구현/직접 Edit 방식이면 이 블록은 해당 구현에 맞는 검증으로 대체.
if grep -q "render-only" career-os/scripts/study-topic-recommender/refresh_topic_inventory.ts; then
  bun --env-file=career-os/.env career-os/scripts/study-topic-recommender/refresh_topic_inventory.ts --render-only \
    || { echo "PHASE_FAILED: refresh_topic_inventory.ts --render-only 실패"; exit 1; }
fi

# B. morning markdown 보강 후보 섹션 존재
grep -q "기존 문서 보강 후보" career-os/data/runtime/morning-topic-recommendation.md \
  || { echo "PHASE_FAILED: morning markdown 보강 후보 섹션 부재"; exit 1; }

# C. SKILL.md에 Claude duplicate review 명시
grep -q "Claude duplicate review" career-os/.claude/skills/study-topic-recommender/SKILL.md \
  || { echo "PHASE_FAILED: SKILL.md에 Claude duplicate review 명세 부재"; exit 1; }

# D. 4 decision label 모두 등장
for label in "new" "update-existing" "skip" "needs-user-confirmation"; do
  grep -q "$label" career-os/.claude/skills/study-topic-recommender/SKILL.md \
    || { echo "PHASE_FAILED: SKILL.md에 decision label '$label' 부재"; exit 1; }
done

# E. SKILL.md Inputs에서 generated-artifacts.json 제거됨
HITS=$(grep -c "generated-artifacts" career-os/.claude/skills/study-topic-recommender/SKILL.md || echo 0)
[ "$HITS" = "0" ] || { echo "PHASE_FAILED: SKILL.md에 generated-artifacts 잔존 $HITS"; exit 1; }

echo "[3] 검증 OK"
```

### 4. 커밋 + commit 개수 강제

```bash
cd /home/bifos/ai-nodes
HEAD_BEFORE=$(git rev-parse HEAD)

git add \
  career-os/.claude/skills/study-topic-recommender/SKILL.md \
  career-os/scripts/study-topic-recommender/refresh_topic_inventory.ts

git commit -m "$(cat <<'COMMIT_EOF'
feat(career-os): study-topic-recommender Claude duplicate review + 보강 후보 섹션 (plan025 phase-02)

ADR-033 2단계 — SKILL.md에 Claude duplicate review 단계 추가, morning
markdown에 "기존 문서 보강 후보" 섹션(최대 5개) 노출. review 실패 시
deterministic 결과로 추천 계속 + 상단 warning 라인.

- .claude/skills/study-topic-recommender/SKILL.md
  Inputs에서 generated-artifacts.json 제거
  Workflow Step 2.5 신규 — 4 decision label (new/update-existing/skip/
  needs-user-confirmation) 의미 판정 + inventory.claudeDuplicateReview
  업데이트
  Workflow Step 2.6 — morning markdown 재생성
  Error handling 표 — review 실패 시 status=failed + 추천 계속

- scripts/study-topic-recommender/refresh_topic_inventory.ts
  morning markdown "기존 문서 보강 후보" 섹션 rendering (최대 5)
  일반 refresh와 review 보존용 render-only 분리(또는 native skill 직접 Edit)
  review.status == "failed"일 때 상단 warning 라인
  updateExistingRecommendations 필드 inventory에 추가

study-pack-writer duplicate guard 강화는 phase-03에서.
COMMIT_EOF
)" || { echo "PHASE_FAILED: commit"; exit 1; }

HEAD_AFTER=$(git rev-parse HEAD)
COMMITS=$(git rev-list "$HEAD_BEFORE..$HEAD_AFTER" --count)
[ "$COMMITS" = "1" ] || { echo "PHASE_FAILED: commit 수 $COMMITS"; exit 1; }
echo "[4] commit 1 OK"
```

## Critical Files

| 파일 | 변경 |
|---|---|
| `career-os/.claude/skills/study-topic-recommender/SKILL.md` | Inputs + Workflow Step 2.5/2.6 + Error handling |
| `career-os/scripts/study-topic-recommender/refresh_topic_inventory.ts` | 보강 후보 섹션 rendering + warning 라인 |
| `career-os/data/runtime/topic-inventory.json` | 재실행 결과 (gitignored — 커밋하지 않음) |
| `career-os/data/runtime/morning-topic-recommendation.md` | 재실행 결과 (gitignored — 커밋하지 않음) |

## Blocked 조건

- phase-01 commit 없음 / 산출물 부재 / inventory 새 스키마 부재 → `PHASE_BLOCKED` + `exit 2`
- branch ≠ main → `PHASE_BLOCKED`
- 검증 A~E 실패 → `PHASE_FAILED` + `exit 1`
- commit 수 ≠ 1 → `PHASE_FAILED`

## 의도 메모

- review 호출 자체는 native skill(Claude) 책임. ts script는 placeholder(`status: "skipped"`)만 둔다 — provider-free 원칙 (ADR-033 거절한 대안 참조).
- markdown rendering은 두 경로(ts 호출 또는 native skill Edit) 모두 허용하되, *기본 경로는 ts 호출*. 단순성 우선.
- 보강 후보 5개 상한은 ADR-033 결과 단점 항목(비용·시간 증가) 완화. 더 많이 보고 싶으면 사용자가 inventory.json 직접 확인.
- OpenClaw wrapper(`~/.openclaw/workspace/skills/study-topic-recommender/SKILL.md`) 동기는 *사용자가 직접 처리* — Claude는 `~/.openclaw/**` 수정 금지 (전역 정책). phase 산출물에서 wrapper drift 안내만 추가.
