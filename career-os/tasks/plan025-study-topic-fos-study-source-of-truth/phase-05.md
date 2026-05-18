# Phase 5 — 통합 정적 검증 + status=completed + push

**Model**: haiku
**Status**: pending

---

## 목표

plan025 통합 정적 검증 + `index.json` status=completed + main branch push.

## 사전 검증

```bash
cd /home/bifos/ai-nodes

# phase-04 commit
git log -1 --format='%s' | grep -q "plan025 phase-04" \
  || { echo "PHASE_BLOCKED: phase-04 commit 없음"; exit 2; }

# branch
[ "$(git branch --show-current)" = "main" ] \
  || { echo "PHASE_BLOCKED: branch != main"; exit 2; }

# working tree clean (phase-04까지 모든 산출물 commit됨)
DIRTY=$(git status --porcelain career-os/ | wc -l)
[ "$DIRTY" = "0" ] || {
  echo "PHASE_BLOCKED: career-os 워크트리 dirty $DIRTY"
  git status --porcelain career-os/
  exit 2
}

echo "사전 검증 OK"
```

## 작업 항목

### 1. 통합 정적 검증

```bash
cd /home/bifos/ai-nodes

# A. 활성 코드 / SKILL.md 영역 잔재 0
HITS=$(grep -rln "generated-artifacts\|update_artifacts" \
  career-os/scripts \
  career-os/.claude/skills \
  2>/dev/null | wc -l)
[ "$HITS" = "0" ] || {
  echo "PHASE_FAILED: 활성 코드/SKILL.md 잔재 $HITS"
  grep -rln "generated-artifacts\|update_artifacts" career-os/scripts career-os/.claude/skills
  exit 1
}

# B. ADR-033 본문 존재
grep -q "## ADR-033 — fos-study source tree" career-os/docs/adr.md \
  || { echo "PHASE_FAILED: ADR-033 본문 부재"; exit 1; }

# C. duplicate decision schema docs 존재
grep -q "Duplicate decision schema" career-os/docs/data-schema.md \
  || { echo "PHASE_FAILED: data-schema.md duplicate decision schema 부재"; exit 1; }

# D. recommender / writer SKILL.md 4 decision label
for f in \
  career-os/.claude/skills/study-topic-recommender/SKILL.md \
  career-os/.claude/skills/study-pack-writer/SKILL.md; do
  for label in "new" "update-existing" "skip" "needs-user-confirmation"; do
    grep -q "$label" "$f" \
      || { echo "PHASE_FAILED: $f 에 decision label '$label' 부재"; exit 1; }
  done
done

# E. helper 파일 존재
test -f career-os/scripts/study-topic-recommender/duplicate_detection.ts \
  || { echo "PHASE_FAILED: duplicate_detection.ts 부재"; exit 1; }
test -f career-os/scripts/study-topic-recommender/fos_study_inventory.ts \
  || { echo "PHASE_FAILED: fos_study_inventory.ts 부재"; exit 1; }

# F. generated-artifacts.json 부재 (git tracked X)
test ! -f career-os/data/generated-artifacts.json \
  || { echo "PHASE_FAILED: generated-artifacts.json 잔존"; exit 1; }

echo "[1] 통합 정적 검증 OK"
```

### 2. index.json status=completed

```bash
cd /home/bifos/ai-nodes

python3 -c "
import json
from datetime import datetime, timezone

path = 'career-os/tasks/plan025-study-topic-fos-study-source-of-truth/index.json'
data = json.load(open(path))
data['status'] = 'completed'
data['current_phase'] = data['total_phases']
data['updated_at'] = datetime.now(timezone.utc).isoformat()
for ph in data['phases']:
    ph['status'] = 'completed'
with open(path, 'w') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)
    f.write('\n')
print('[ok] index.json status=completed')
" || { echo "PHASE_FAILED: index.json 갱신 실패"; exit 1; }
```

### 3. 커밋 + push + commit 개수 강제

```bash
cd /home/bifos/ai-nodes
HEAD_BEFORE=$(git rev-parse HEAD)

git add career-os/tasks/plan025-study-topic-fos-study-source-of-truth/index.json

git commit -m "$(cat <<'COMMIT_EOF'
task(career-os): plan025 index.json status=completed (phase-05)

ADR-033 fos-study 단일 진실원 — 5 phase 모두 통과.

phase-01: refresh_topic_inventory.ts fos-study 직접 스캔 + deterministic
  dedupe helper(fos_study_inventory.ts + duplicate_detection.ts) 분리 +
  inventory 스냅샷 스키마 축소
phase-02: study-topic-recommender SKILL.md Claude duplicate review 단계
  추가 + morning markdown 보강 후보 섹션
phase-03: study-pack-writer SKILL.md duplicate guard 강화 (4 decision
  schema 분기)
phase-04: data/generated-artifacts.json git rm + 활성 잔재 0 + recommender
  e2e
phase-05: 통합 정적 검증 + status=completed + push

OpenClaw wrapper(~/.openclaw/workspace/skills/study-topic-recommender |
study-pack-writer/SKILL.md) 동기는 사용자가 직접 처리 — 전역 정책상
Claude는 ~/.openclaw/** 수정 금지.
COMMIT_EOF
)" || { echo "PHASE_FAILED: commit"; exit 1; }

HEAD_AFTER=$(git rev-parse HEAD)
COMMITS=$(git rev-list "$HEAD_BEFORE..$HEAD_AFTER" --count)
[ "$COMMITS" = "1" ] || { echo "PHASE_FAILED: commit 수 $COMMITS"; exit 1; }

git push origin main \
  || { echo "PHASE_FAILED: push 실패"; exit 1; }

echo "[3] commit + push OK"
```

## Critical Files

| 파일 | 변경 |
|---|---|
| `career-os/tasks/plan025-study-topic-fos-study-source-of-truth/index.json` | status=completed + 모든 phase status=completed |

## Blocked 조건

- phase-04 commit 없음 / 워크트리 dirty / branch ≠ main → `PHASE_BLOCKED`
- 통합 정적 검증 A~F 실패 → `PHASE_FAILED`
- commit 수 ≠ 1 / push 실패 → `PHASE_FAILED`

## 의도 메모

- 본 phase는 검증·기록·push 위주 — 코드 변경 없음. haiku로 충분.
- working tree dirty 사전 검증: 이전 phase의 commit 누락 시 본 phase가 산출물을 잘못 흡수하는 risk 차단.
- OpenClaw wrapper 안내는 commit message에 한 번 더 명시 — 사용자에게 다음 액션 가시화.
