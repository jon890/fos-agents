# Phase 3 — study-pack-writer SKILL.md duplicate guard 강화 (4 decision 분기)

**Model**: sonnet
**Status**: pending

---

## 목표

ADR-033 3단계 — `.claude/skills/study-pack-writer/SKILL.md`의 `Step 3 (Overlap 점검)`을 **duplicate guard**로 격상. recommender와 같은 4 decision label (new / update-existing / skip / needs-user-confirmation) 분기 규칙을 명시. 게이트는 *사용자가 직접 호출한 주제*에도 동일하게 적용된다.

`duplicate_detection.ts` (phase-01 산출물)를 writer가 동일하게 import할 것을 명세하되, ts 실행 자체는 phase-01에서 검증 완료 — 본 phase는 SKILL.md 문서/명세 작업만.

## 사전 검증

```bash
cd /home/bifos/ai-nodes

# phase-02 commit
git log -1 --format='%s' | grep -q "plan025 phase-02" \
  || { echo "PHASE_BLOCKED: phase-02 commit 없음"; exit 2; }

# phase-01 산출물(공유 helper) 존재
test -f career-os/scripts/study-topic-recommender/duplicate_detection.ts \
  || { echo "PHASE_BLOCKED: duplicate_detection.ts 부재 — phase-01 미완"; exit 2; }

# 대상 SKILL.md 존재 + 옛 Step 3 본문 잔존 (변경 의미 확보)
grep -q "### 3. Overlap 점검" career-os/.claude/skills/study-pack-writer/SKILL.md \
  || { echo "PHASE_BLOCKED: 대상 Step 3 (Overlap 점검) 본문 부재 — 이미 변경됨?"; exit 2; }

# branch
[ "$(git branch --show-current)" = "main" ] \
  || { echo "PHASE_BLOCKED: branch != main"; exit 2; }

echo "사전 검증 OK"
```

## 작업 항목

### 1. `.claude/skills/study-pack-writer/SKILL.md` Workflow Step 3 재작성

기존 `### 3. Overlap 점검 (선택)` 섹션을 다음 본문으로 교체:

```md
### 3. Duplicate guard (ADR-033)

new markdown Write 직전 fos-study 진실원과의 중복을 강제 검사한다. 이 게이트는 *사용자가 직접 호출한 주제*에도 동일하게 적용된다 — recommender만이 아닌 모든 writer 호출 경로의 최종 gate.

#### 3-1. Scan

`career-os/sources/fos-study/**/*.md` (exclude `.git/**`, `.claude/**`) 트리를 스캔. `git pull` 호출 금지 — 로컬 clone 기준.

import 및 호출 (Bash):

\`\`\`bash
bun career-os/scripts/study-topic-recommender/duplicate_detection.ts ...
# 또는 native skill 내부에서 직접 Read + 동등 로직 적용
\`\`\`

deterministic dedupe 결과는 ADR-033 duplicate decision schema 형태 (key / candidatePath / matchedPath / decision / reason / confidence).

#### 3-2. (가능하면) Claude 의미 판정

deterministic이 `possibleDuplicates`로 분류한 후보가 있으면 Claude(현재 native skill 컨텍스트) 가 의미 판정을 추가. 새 호출 X — 같은 Claude 컨텍스트 안에서 matched 파일을 Read해 판정.

판정 입력 최소화: candidatePath + matched 파일의 첫 30줄.

#### 3-3. 분기

| decision | 동작 |
|---|---|
| `new` | Step 4로 진행 — 새 markdown 작성. |
| `update-existing` | 새 파일 생성 금지. `matchedPath`의 기존 문서를 Read하고 누락/약한 항목만 patch. commit message는 `update`. |
| `skip` | 작성 중단. stderr에 matched 문서 경로 + 사유 1줄 출력 + `exit 1`. |
| `needs-user-confirmation` | non-interactive(`claude -p`)면 stderr + `exit 1`. interactive 환경에서도 `AskUserQuestion`은 `claude -p`에서 사용 금지(SKILL.md 기존 정책) — *사용자에게 다시 명시해 호출해 달라는 메시지* + `exit 1`. |

#### 3-4. 안전 기본값

deterministic dedupe도 Claude 의미 판정도 결정이 불가능하면 **`needs-user-confirmation`**으로 분류한다 — silent 새 파일 생성 금지가 핵심 안전 기본값.
```

### 2. SKILL.md Inputs 섹션 갱신

기존 Inputs 7번 항목 "(선택) `sources/fos-study/<유사 outputPath>.md` — overlap 회피"를 다음으로 교체:

```md
7. **필수**: `sources/fos-study/**/*.md` 트리 스캔 결과 — `career-os/scripts/study-topic-recommender/duplicate_detection.ts` helper로 결정. exclude `.git/**`, `.claude/**`. `git pull` 호출 금지.
```

### 3. SKILL.md Error handling 표 갱신

다음 행을 표에 추가:

```md
| duplicate guard skip / needs-user-confirmation | stderr + exit 1, matched 문서 경로 + 사유 명시 |
| duplicate guard update-existing 진입 | 새 파일 생성 금지, 기존 matched 문서 patch 모드로 전환 |
```

### 4. SKILL.md `Why this design` 섹션에 한 줄 추가

```md
- **Duplicate guard (ADR-033)**: recommender·writer가 같은 4 decision schema를 공유. 사용자가 직접 호출한 주제에도 동일 게이트 — fos-study 진실원과 drift 없음.
```

### 5. 검증

```bash
cd /home/bifos/ai-nodes

# A. Step 3가 "Duplicate guard"로 격상
grep -q "Duplicate guard" career-os/.claude/skills/study-pack-writer/SKILL.md \
  || { echo "PHASE_FAILED: SKILL.md에 Duplicate guard 부재"; exit 1; }

# B. 4 decision label 모두 등장
for label in "new" "update-existing" "skip" "needs-user-confirmation"; do
  grep -q "$label" career-os/.claude/skills/study-pack-writer/SKILL.md \
    || { echo "PHASE_FAILED: SKILL.md에 decision label '$label' 부재"; exit 1; }
done

# C. duplicate_detection.ts import / 호출 명시
grep -q "duplicate_detection" career-os/.claude/skills/study-pack-writer/SKILL.md \
  || { echo "PHASE_FAILED: SKILL.md에 duplicate_detection helper 참조 부재"; exit 1; }

# D. 옛 "Overlap 점검" 본문 잔존 없음 (제목 자체는 history mention 형태로만 허용)
ACTIVE_OVERLAP=$(grep -c "### 3. Overlap 점검" career-os/.claude/skills/study-pack-writer/SKILL.md || echo 0)
[ "$ACTIVE_OVERLAP" = "0" ] || { echo "PHASE_FAILED: 옛 Step 3 본문 잔존 $ACTIVE_OVERLAP"; exit 1; }

echo "[5] 검증 OK"
```

### 6. 커밋 + commit 개수 강제

```bash
cd /home/bifos/ai-nodes
HEAD_BEFORE=$(git rev-parse HEAD)

git add career-os/.claude/skills/study-pack-writer/SKILL.md

git commit -m "$(cat <<'COMMIT_EOF'
feat(career-os): study-pack-writer duplicate guard 강화 (plan025 phase-03)

ADR-033 3단계 — Step 3 Overlap 점검을 Duplicate guard로 격상. recommender와
같은 4 decision schema (new / update-existing / skip / needs-user-
confirmation) 분기. 사용자가 직접 호출한 주제에도 같은 게이트 적용.

- .claude/skills/study-pack-writer/SKILL.md
  Inputs 7번: fos-study 트리 스캔 + duplicate_detection helper 의무화
  Step 3: Overlap 점검 → Duplicate guard 재작성 (scan + Claude 의미 판정
  + 4 decision 분기 + 안전 기본값)
  Error handling: skip / update-existing 행 추가
  Why this design: duplicate guard 한 줄 추가

duplicate_detection.ts는 phase-01 산출물 그대로 재사용 — writer는 같은
helper를 import해 single source of truth 유지.
COMMIT_EOF
)" || { echo "PHASE_FAILED: commit"; exit 1; }

HEAD_AFTER=$(git rev-parse HEAD)
COMMITS=$(git rev-list "$HEAD_BEFORE..$HEAD_AFTER" --count)
[ "$COMMITS" = "1" ] || { echo "PHASE_FAILED: commit 수 $COMMITS"; exit 1; }
echo "[6] commit 1 OK"
```

## Critical Files

| 파일 | 변경 |
|---|---|
| `career-os/.claude/skills/study-pack-writer/SKILL.md` | Step 3 재작성 + Inputs + Error handling + Why this design |

## Blocked 조건

- phase-02 commit 없음 / 공유 helper 부재 / 옛 Step 3 본문 부재 → `PHASE_BLOCKED`
- branch ≠ main → `PHASE_BLOCKED`
- 검증 A~D 실패 → `PHASE_FAILED`
- commit 수 ≠ 1 → `PHASE_FAILED`

## 의도 메모

- 본 phase는 *SKILL.md 명세*만 변경. 실제 helper는 phase-01 산출물 그대로.
- writer가 duplicate_detection.ts를 *호출*하는 방식은 native skill 내부에서 두 경로 다 허용 — Bash로 ts 실행 후 stdout JSON 파싱, 또는 같은 ts module을 in-process로 import (Bun runtime이라 가능). SKILL.md는 선택지만 노출하고 우선순위 강제 X.
- OpenClaw wrapper(`~/.openclaw/workspace/skills/study-pack-writer/SKILL.md`) 동기는 사용자가 직접 처리 — Claude는 `~/.openclaw/**` 수정 금지.
- `AskUserQuestion` 사용 금지는 SKILL.md 기존 정책(Step 3 옛 본문 line "claude -p non-interactive 실행에서는 AskUserQuestion을 사용하지 않는다") 유지. needs-user-confirmation에서 exit 1로 처리.
