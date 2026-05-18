# Phase 4 — cleanup — generated-artifacts.json git rm + active 잔재 0 + recommender e2e

**Model**: sonnet
**Status**: pending

---

## 목표

ADR-033 5단계 — career-os 트리에서 `generated-artifacts` / `update_artifacts` 활성 참조를 0으로 만든다. `data/generated-artifacts.json` 파일 자체 `git rm`. 마지막으로 recommender e2e 실행 + 산출물 점검.

`_shared/bin/update_artifacts.py` 파일 자체는 *career-os plan 범위 밖* (hand-off 비범위 항목). 다른 워크스페이스 영향이 0이라고 확인되더라도 본 plan에서는 건드리지 않는다.

## 사전 검증

```bash
cd /home/bifos/ai-nodes

# phase-03 commit
git log -1 --format='%s' | grep -q "plan025 phase-03" \
  || { echo "PHASE_BLOCKED: phase-03 commit 없음"; exit 2; }

# 대상 파일 존재 (git rm 의미 확보)
test -f career-os/data/generated-artifacts.json \
  || { echo "PHASE_BLOCKED: generated-artifacts.json 이미 부재"; exit 2; }

# branch
[ "$(git branch --show-current)" = "main" ] \
  || { echo "PHASE_BLOCKED: branch != main"; exit 2; }

echo "사전 검증 OK"
```

## 작업 항목

### 1. `data/generated-artifacts.json` git rm

```bash
cd /home/bifos/ai-nodes

git rm career-os/data/generated-artifacts.json \
  || { echo "PHASE_FAILED: git rm 실패"; exit 1; }

test ! -f career-os/data/generated-artifacts.json \
  || { echo "PHASE_FAILED: 파일 잔존"; exit 1; }

echo "[1] generated-artifacts.json git rm OK"
```

### 2. career-os 트리 잔재 점검

active 코드/명세에 generated-artifacts 또는 update_artifacts 활성 참조가 있는지 점검. history mention(예: "ADR-033 / plan025 이후 제거")은 허용 — *현재 의존 안내 패턴*만 잔재로 본다.

```bash
cd /home/bifos/ai-nodes

# 활성 코드 영역(scripts/.claude/skills)에서 grep
ACTIVE_HITS=$(grep -rln "generated-artifacts\|update_artifacts" \
  career-os/scripts \
  career-os/.claude/skills \
  2>/dev/null | wc -l)

[ "$ACTIVE_HITS" = "0" ] || {
  echo "PHASE_FAILED: 활성 코드/SKILL.md에 잔재 $ACTIVE_HITS 파일"
  grep -rln "generated-artifacts\|update_artifacts" career-os/scripts career-os/.claude/skills
  exit 1
}

# docs 영역은 history mention만 허용 — 본문에 *현재 의존 안내*가 있는지만 검증
# (예: "활성 동작에서 제거" / "사용 0" 같은 표기는 history. 그 외 단어 패턴은 검토 필요)
# 자동 검증 어려운 영역 — 본 phase에서 수동 점검 + 의도 메모로 위임

echo "[2] 활성 코드/SKILL.md 잔재 0 OK"
```

### 3. recommender e2e 실행

```bash
cd /home/bifos/ai-nodes

bun --env-file=career-os/.env career-os/scripts/study-topic-recommender/refresh_topic_inventory.ts \
  || { echo "PHASE_FAILED: refresh_topic_inventory.ts 실행 실패"; exit 1; }

# A. inventory schema
python3 -c "
import json, sys
data = json.load(open('career-os/data/runtime/topic-inventory.json'))
required = ['sourceOfTruth', 'excluded', 'claudeDuplicateReview', 'remaining', 'counts']
missing = [k for k in required if k not in data]
if missing:
    print('PHASE_FAILED: inventory 누락 키', missing); sys.exit(1)
if data['sourceOfTruth']['kind'] != 'fos-study':
    print('PHASE_FAILED: sourceOfTruth.kind != fos-study'); sys.exit(1)
print('[ok] inventory schema')
" || exit 1

# B. morning markdown — 보강 후보 섹션
grep -q "기존 문서 보강 후보" career-os/data/runtime/morning-topic-recommendation.md \
  || { echo "PHASE_FAILED: morning markdown 보강 후보 섹션 부재"; exit 1; }

# C. 백엔드 / 기술블로그 / AI / Geek / 오늘의 3선 5 섹션 보존
for sec in "백엔드 스터디 주제" "회사·엔지니어링 기술 블로그" "AI 관련" "Geek/뉴스/산업 흐름" "오늘의 3선"; do
  grep -q "$sec" career-os/data/runtime/morning-topic-recommendation.md \
    || { echo "PHASE_FAILED: 기존 섹션 '$sec' 누락 — regression"; exit 1; }
done

echo "[3] e2e OK"
```

### 4. 커밋 + commit 개수 강제

```bash
cd /home/bifos/ai-nodes
HEAD_BEFORE=$(git rev-parse HEAD)

git add career-os/data/generated-artifacts.json 2>/dev/null || true

# generated-artifacts.json은 git rm로 staged 상태. data/runtime/* 산출물은 gitignored 실행 결과이므로 커밋하지 않는다.

git commit -m "$(cat <<'COMMIT_EOF'
chore(career-os): generated-artifacts.json git rm + recommender e2e 검증 (plan025 phase-04)

ADR-033 5단계 — career-os 트리에서 generated-artifacts / update_artifacts
활성 참조 0 확인 + data/generated-artifacts.json 파일 자체 git rm.

- data/generated-artifacts.json git rm — sources/fos-study/ 트리가 단일
  진실원, 별도 인덱스 파일 불필요
- 활성 코드/SKILL.md 영역(career-os/scripts, career-os/.claude/skills)에
  generated-artifacts / update_artifacts 활성 참조 0 확인
- recommender e2e: inventory 새 스키마 정상 생성, morning markdown 5
  기존 섹션 + 보강 후보 섹션 동시 노출

_shared/bin/update_artifacts.py 파일 자체는 career-os 범위 밖 (다른
워크스페이스 영향 회피, 별도 plan 대기).
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
| `career-os/data/generated-artifacts.json` | git rm |
| `career-os/data/runtime/topic-inventory.json` | e2e 재실행 결과 (gitignored — 커밋하지 않음) |
| `career-os/data/runtime/morning-topic-recommendation.md` | e2e 재실행 결과 (gitignored — 커밋하지 않음) |

## Blocked 조건

- phase-03 commit 없음 / 대상 파일 부재 → `PHASE_BLOCKED`
- branch ≠ main → `PHASE_BLOCKED`
- 활성 잔재 발견 / e2e 실패 → `PHASE_FAILED`
- commit 수 ≠ 1 → `PHASE_FAILED`

## 의도 메모

- `_shared/bin/update_artifacts.py` 폐기는 hand-off 비범위 — 다른 워크스페이스(현재 직접 사용 없음이지만 cross-check 별도 plan).
- `data/generated-artifacts.json`은 git-tracked → git rm 시 history 보존됨. 회수가 필요하면 git checkout으로 복원 가능.
- docs(adr/data-schema/flow/code-architecture/prd/AGENTS)에는 *history mention*(예: "ADR-033 / plan025 이후 제거")으로 잔재가 있지만 본 phase 검증 대상 아님 — 그 잔재는 의도된 history 보존.
- e2e 5 기존 섹션 보존 검증은 ADR-033 결과 단점 항목(영향 범위 큼) 완화용 regression test.
- OpenClaw wrapper 동기는 사용자 직접 처리 — Claude는 `~/.openclaw/**` 수정 금지.
