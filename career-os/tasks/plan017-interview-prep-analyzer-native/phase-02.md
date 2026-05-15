# Phase 2 — topics.json → 3 json 분리 적용 + 5 read 위치 path 갱신

**Model**: sonnet
**Status**: pending

---

## 목표

phase-01 draft의 `split_topics_config.ts`를 실행해 `config/topics.json` (62KB) → 3 json (`study-pack-topics.json` + `study-pack-candidates.json` + `question-bank-topics.json`)으로 분리. topics.json read하는 5 위치를 새 path로 갱신. namespace 데이터 동등성 검증.

**범위 외**: interview-prep-analyzer 적용 (phase-03), docs 갱신 (phase-04).

## 관련 docs

- phase-01 commit — draft 2개 작성 완료
- `career-os/config/topics.json` — 분리 대상 (Read 전 baseline 캡처)
- `skills/plan-and-build/references/common-pitfalls.md` 6-6

## 사전 검증

```bash
cd /home/bifos/ai-nodes

# 1-A. phase-01 commit 존재
git log -1 --format='%s' | grep -q "plan017 phase-01" \
  || { echo "PHASE_BLOCKED: phase-01 commit 없음"; exit 2; }

# 1-B. draft + topics.json 존재
DRAFT=career-os/tasks/plan017-interview-prep-analyzer-native/draft
test -f "$DRAFT/split_topics_config.ts" \
  || { echo "PHASE_BLOCKED: split ts draft 부재"; exit 2; }
test -f career-os/config/topics.json \
  || { echo "PHASE_BLOCKED: topics.json 부재 — 이미 분리됨 의심"; exit 2; }

echo "사전 검증 OK"
```

## 작업 항목

### 1. baseline 캡처 (검증 비교용)

```bash
cd /home/bifos/ai-nodes
cp career-os/config/topics.json /tmp/plan017-topics-baseline.json
python3 -c "
import json
with open('/tmp/plan017-topics-baseline.json') as f:
    d = json.load(f)
print(f'baseline: study-pack={len(d[\"study-pack\"])} study-pack-candidates={len(d[\"study-pack-candidates\"])} question-bank={len(d[\"question-bank\"])}')
"
echo "[1] baseline 캡처 OK"
```

### 2. split_topics_config.ts dry-run + 실행

```bash
cd /home/bifos/ai-nodes
DRAFT=career-os/tasks/plan017-interview-prep-analyzer-native/draft

# 2-A. dry-run
bun "$DRAFT/split_topics_config.ts" --dry-run 2>&1 | tee /tmp/plan017-split-dryrun.log
grep -q "study-pack-topics\|study-pack-candidates\|question-bank-topics" /tmp/plan017-split-dryrun.log \
  || { echo "PHASE_FAILED: dry-run 출력에 3 namespace 부재"; exit 1; }

# 2-B. 실제 실행
bun "$DRAFT/split_topics_config.ts" 2>&1 | tee /tmp/plan017-split.log
[ "${PIPESTATUS[0]}" -eq 0 ] || { echo "PHASE_FAILED: split 실행"; exit 1; }

# 2-C. 3 json 생성 확인
for f in study-pack-topics study-pack-candidates question-bank-topics; do
  test -f "career-os/config/$f.json" \
    || { echo "PHASE_FAILED: career-os/config/$f.json 미생성"; exit 1; }
done

echo "[2] split 실행 OK"
```

### 3. 동등성 검증 (baseline ↔ 3 json 합본)

```bash
cd /home/bifos/ai-nodes
python3 - <<'PY'
import json, sys
with open('/tmp/plan017-topics-baseline.json') as f: baseline = json.load(f)

result = {}
for ns_key, file in [('study-pack', 'study-pack-topics'),
                      ('study-pack-candidates', 'study-pack-candidates'),
                      ('question-bank', 'question-bank-topics')]:
    with open(f'career-os/config/{file}.json') as f:
        d = json.load(f)
    # _meta 제외, ns_key 추출
    inner = d.get(ns_key) or {k:v for k,v in d.items() if k != '_meta'}
    result[ns_key] = inner

# 비교
diff = 0
for ns in ['study-pack', 'study-pack-candidates', 'question-bank']:
    bl = baseline.get(ns, {})
    rs = result.get(ns, {})
    if json.dumps(bl, sort_keys=True, ensure_ascii=False) != json.dumps(rs, sort_keys=True, ensure_ascii=False):
        diff += 1
        bl_keys = set(bl.keys()) if isinstance(bl, dict) else set()
        rs_keys = set(rs.keys()) if isinstance(rs, dict) else set()
        print(f'DIFF {ns}: missing={bl_keys - rs_keys} added={rs_keys - bl_keys}', file=sys.stderr)
if diff > 0:
    print(f"PHASE_FAILED: 동등성 위반 ({diff} namespace diff)")
    sys.exit(1)
print(f"[3] 동등성 검증 OK")
PY
```

### 4. 5 read 위치 path 갱신

대상 (각 파일에서 `config/topics.json` 참조 → 적절한 신 path로):

| 파일 | namespace | 새 path |
|---|---|---|
| `career-os/.claude/skills/study-pack-writer/SKILL.md` | study-pack | `config/study-pack-topics.json` |
| `career-os/.claude/skills/interview-asset-writer/SKILL.md` | question-bank | `config/question-bank-topics.json` |
| `career-os/.claude/skills/study-topic-recommender/SKILL.md` | study-pack + candidates | `config/study-pack-topics.json` + `config/study-pack-candidates.json` |
| `career-os/scripts/study-topic-recommender/refresh_topic_inventory.ts` | study-pack + candidates | 동일 |
| `_shared/types/index.ts` | 모든 namespace | 타입 정의 갱신 |

**주의**: plan016이 별도 세션에서 실행 중일 수 있음 — `refresh_topic_inventory.ts` 갱신 전 *해당 파일 commit 상태 확인* (plan016 phase-02에서 ts 마이그 완료된 경우만 본 갱신 적용 가능).

```bash
cd /home/bifos/ai-nodes
# Edit 도구로 각 파일에서 "config/topics.json" → 적절한 신 path 변경
# (각 파일별 정확한 Edit 호출은 phase 실행 시 Claude가 처리)

# 검증
HITS_REMAINING=$(grep -rln "config/topics\.json" career-os/.claude/skills/ career-os/scripts/ _shared/ 2>/dev/null | grep -v "career-os/tasks/" | wc -l)
[ "$HITS_REMAINING" = "0" ] \
  || { echo "PHASE_FAILED: config/topics.json 잔재 $HITS_REMAINING"; \
       grep -rln "config/topics\.json" career-os/.claude/skills/ career-os/scripts/ _shared/ 2>/dev/null | grep -v "career-os/tasks/"; exit 1; }
echo "[4] 5 read 위치 갱신 OK"
```

### 5. topics.json 폐기

```bash
cd /home/bifos/ai-nodes
git rm career-os/config/topics.json
test ! -f career-os/config/topics.json || { echo "PHASE_FAILED: topics.json 잔존"; exit 1; }
echo "[5] topics.json 폐기 OK"
```

### 6. tsc 검증

```bash
cd /home/bifos/ai-nodes
bunx tsc --noEmit 2>&1 | tee /tmp/plan017-phase02-tsc.log
[ "${PIPESTATUS[0]}" -eq 0 ] || { echo "PHASE_FAILED: tsc"; cat /tmp/plan017-phase02-tsc.log; exit 1; }
echo "[6] tsc OK"
```

### 7. 커밋 + commit 개수 강제

```bash
cd /home/bifos/ai-nodes
HEAD_BEFORE=$(git rev-parse HEAD)

git add career-os/config/ \
        career-os/.claude/skills/ \
        career-os/scripts/ \
        _shared/

git commit -m "$(cat <<'COMMIT_EOF'
refactor(career-os): topics.json (62KB) → 3 json namespace 분리 (plan017 phase-02)

ADR-027 적용. plan002 통합 (ADR-008/016 추정)을 부분 번복 — namespace별
사용 skill 1-2개로 분리되어 *단일 책임* 회복.

- config/topics.json → 폐기
- config/study-pack-topics.json 신규 (55 키 / 25.6KB) — study-pack-writer
  + study-topic-recommender Read
- config/study-pack-candidates.json 신규 (2 키 / 26.2KB) — study-topic-recommender Read
- config/question-bank-topics.json 신규 (2 키 / 1.8KB) — interview-asset-writer Read

5 read 위치 path 갱신:
- .claude/skills/study-pack-writer/SKILL.md
- .claude/skills/interview-asset-writer/SKILL.md
- .claude/skills/study-topic-recommender/SKILL.md
- scripts/study-topic-recommender/refresh_topic_inventory.ts
- _shared/types/index.ts

검증:
- baseline vs 3 json 합본: 키 동등성 0 diff (study-pack / candidates / question-bank)
- tsc 통과
- config/topics.json 잔재 0
COMMIT_EOF
)" || { echo "PHASE_FAILED: commit"; exit 1; }

HEAD_AFTER=$(git rev-parse HEAD)
COMMITS=$(git rev-list "$HEAD_BEFORE..$HEAD_AFTER" --count)
[ "$COMMITS" = "1" ] \
  || { echo "PHASE_FAILED: 본 phase commit 수 $COMMITS (expected 1)"; exit 1; }
echo "[7] commit 1 OK"
```

push는 phase-05.

## Critical Files

| 파일 | 변경 |
|---|---|
| `career-os/config/topics.json` | git rm |
| `career-os/config/{study-pack-topics,study-pack-candidates,question-bank-topics}.json` | 신규 |
| `career-os/.claude/skills/study-pack-writer/SKILL.md` | path 갱신 |
| `career-os/.claude/skills/interview-asset-writer/SKILL.md` | path 갱신 |
| `career-os/.claude/skills/study-topic-recommender/SKILL.md` | path 갱신 |
| `career-os/scripts/study-topic-recommender/refresh_topic_inventory.ts` | path 갱신 |
| `_shared/types/index.ts` | 타입 갱신 |

## Blocked 조건

- phase-01 commit 없음 → `PHASE_BLOCKED` + `exit 2`
- draft 또는 topics.json 부재 → `PHASE_BLOCKED` + `exit 2`
- dry-run 출력 검증 실패 → `PHASE_FAILED` + `exit 1`
- 동등성 0 diff 위반 → `PHASE_FAILED` + `exit 1`
- 5 read 위치 갱신 후 잔재 ≥1 → `PHASE_FAILED` + `exit 1`
- tsc 실패 → `PHASE_FAILED` + `exit 1`
- commit 수 ≠ 1 → `PHASE_FAILED: commit 위장 의심` + `exit 1`

## 의도 메모

- *동등성 0 diff*가 핵심 검증 — namespace별 키 + 본문 모두 byte-equivalent.
- plan016 ts 마이그가 본 phase 전에 완료돼야 `refresh_topic_inventory.ts` 갱신 가능. plan016이 별도 세션 진행 중이면 *해당 ts 파일 존재 확인 후* 처리.
- `_shared/types/index.ts`는 topics namespace 타입 정의 갱신만 — 큰 영향 없음.
