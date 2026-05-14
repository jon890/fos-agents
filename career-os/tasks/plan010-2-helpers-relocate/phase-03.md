# Phase 3 — study_pack_publish + fos_study_git caller 8개 일괄 갱신

**Model**: sonnet
**Status**: pending

---

## 목표

phase-01 mv 결과를 caller에 전파. `_shared/lib/study_pack_publish.ts` + `_shared/lib/fos_study_git.ts` 호출 8개(study_pack_publish 5 + fos_study_git 3)를 새 경로 `career-os/scripts/_lib/`로 일괄 갱신.

**범위 외**: build_prompt caller (phase-02), 통합 smoke (phase-04).

## 관련 docs

- `docs/adr.md` ai-nodes ADR-001 — 본 plan 결정 출처.
- phase-01 commit — mv 결과.

## 사전 검증

```bash
cd /home/bifos/ai-nodes

for f in study_pack_publish fos_study_git; do
  test -f "career-os/scripts/_lib/${f}.ts" \
    || { echo "PHASE_BLOCKED: 새 위치 ${f}.ts 부재 — phase-01 미완"; exit 2; }
  test ! -e "_shared/lib/${f}.ts" \
    || { echo "PHASE_BLOCKED: 옛 위치 ${f}.ts 잔존 — phase-01 미완"; exit 2; }
done

echo "사전 검증 OK"
```

## 갱신 대상 caller (실측 기반 — phase 작성 시점 grep)

### `study_pack_publish.ts` 호출 5개

| caller |
|---|
| `career-os/scripts/study-pack-writer/run_study_pack.sh` |
| `career-os/scripts/study-pack-maintainer/run_maintainer.sh` |
| `career-os/scripts/fos-study-pack/run_from_request.sh` |
| `career-os/scripts/study-topic-recommender/run_live_coding_dispatch.sh` |
| `career-os/scripts/study-pack-batch/run_bootcamp_batch.sh` |

### `fos_study_git.ts` 호출 3개

| caller |
|---|
| `career-os/scripts/interview-master-writer/run_master.sh` |
| `career-os/scripts/experience-question-bank-writer/run_question_bank.sh` |
| `career-os/scripts/position-recommender/publish_job_analysis.sh` |

총 8개 — 단 `fos-study-pack` 폴더는 plan012가 흡수하므로 plan012 실행 결과에 따라 위치가 바뀔 수 있다. **실측을 먼저 돌려서 현재 상태 확인**.

```bash
cd /home/bifos/ai-nodes
echo "=== study_pack_publish 호출 (현재 상태) ==="
grep -rln "study_pack_publish\.ts" career-os/scripts/ 2>/dev/null | sort -u

echo "=== fos_study_git 호출 (현재 상태) ==="
grep -rln "fos_study_git\.ts" career-os/scripts/ 2>/dev/null | sort -u
```

기대값: study_pack_publish 5개 (또는 plan012 후 4개), fos_study_git 3개.

## 작업 항목

### 1. 각 caller에서 옛 경로 → 새 경로 치환

shell runner의 `_shared/lib/study_pack_publish.ts` 또는 `_shared/lib/fos_study_git.ts` 호출을 `career-os/scripts/_lib/`로 교체. 패턴(phase-02 동일):

- `"$HOME/ai-nodes/_shared/lib/study_pack_publish.ts"` → `"$HOME/ai-nodes/career-os/scripts/_lib/study_pack_publish.ts"`
- `_shared/lib/fos_study_git.ts` (상대) → `career-os/scripts/_lib/fos_study_git.ts`
- 변수 정의 발견 시 변수값만 갱신

### 2. study_pack_publish.ts → fos_study_git.ts 내부 호출 (헬퍼 간 의존)

phase-01에서 헬퍼끼리 절대 import는 정리됐지만, study_pack_publish가 `bun run "../fos_study_git.ts"` 식으로 *subprocess*로 부르는 경우 — phase-01에서 같이 mv됐으니 자동으로 같은 디렉터리 안. 별도 갱신 불필요. 단 검증으로 확인:

```bash
cd /home/bifos/ai-nodes
# study_pack_publish 가 fos_study_git을 같은 디렉터리에서 import/호출하는지
if grep -q "fos_study_git" career-os/scripts/_lib/study_pack_publish.ts; then
  # 절대 _shared 경로 잔재 없어야 (phase-01 검증과 중복이지만 안전)
  grep -E "_shared/lib/fos_study_git|@shared/lib/fos_study_git" career-os/scripts/_lib/study_pack_publish.ts \
    && { echo "PHASE_FAILED: study_pack_publish가 옛 _shared/lib/fos_study_git 참조"; exit 1; }
fi
echo "헬퍼 간 의존 OK"
```

### 3. 통합 grep 검증

```bash
cd /home/bifos/ai-nodes

# 1. 옛 경로 호출 0건 (study_pack_publish + fos_study_git 모두)
for h in study_pack_publish fos_study_git; do
  HITS=$(grep -lE "_shared/lib/${h}|@shared/lib/${h}" career-os/scripts/ -r 2>/dev/null)
  if [ -n "$HITS" ]; then
    echo "PHASE_FAILED: 옛 ${h} 호출 잔재"
    echo "$HITS"
    exit 1
  fi
done
echo "[1] 옛 경로 잔재 0건 OK"

# 2. 새 경로 호출 — study_pack_publish 4~5건, fos_study_git 3건
SPP_COUNT=$(grep -lE 'career-os/scripts/_lib/study_pack_publish' career-os/scripts/ -r 2>/dev/null | wc -l)
FSG_COUNT=$(grep -lE 'career-os/scripts/_lib/fos_study_git' career-os/scripts/ -r 2>/dev/null | wc -l)
echo "study_pack_publish caller: $SPP_COUNT, fos_study_git caller: $FSG_COUNT"

# plan012 실행 결과에 따라 study_pack_publish는 4 또는 5
[ "$SPP_COUNT" -ge 4 ] || { echo "PHASE_FAILED: study_pack_publish caller $SPP_COUNT (expected >=4)"; exit 1; }
[ "$FSG_COUNT" -eq 3 ] || { echo "PHASE_FAILED: fos_study_git caller $FSG_COUNT (expected 3)"; exit 1; }
echo "[2] 새 경로 호출 OK"

# 3. 갱신된 caller bash syntax
for f in $(grep -rln "career-os/scripts/_lib/study_pack_publish\|career-os/scripts/_lib/fos_study_git" career-os/scripts/ 2>/dev/null); do
  bash -n "$f" || { echo "PHASE_FAILED: $f bash syntax"; exit 1; }
done
echo "[3] bash syntax OK"
```

## Critical Files

| 파일 | 변경 |
|---|---|
| `career-os/scripts/study-pack-writer/run_study_pack.sh` | study_pack_publish 경로 |
| `career-os/scripts/study-pack-maintainer/run_maintainer.sh` | 동일 |
| `career-os/scripts/fos-study-pack/run_from_request.sh` (plan012 결과에 따라 위치 다를 수 있음) | 동일 |
| `career-os/scripts/study-topic-recommender/run_live_coding_dispatch.sh` | 동일 |
| `career-os/scripts/study-pack-batch/run_bootcamp_batch.sh` | 동일 |
| `career-os/scripts/interview-master-writer/run_master.sh` | fos_study_git 경로 |
| `career-os/scripts/experience-question-bank-writer/run_question_bank.sh` | 동일 |
| `career-os/scripts/position-recommender/publish_job_analysis.sh` | 동일 |

build_prompt caller는 phase-02. 통합 smoke는 phase-04.

## 커밋

```bash
cd /home/bifos/ai-nodes
git add career-os/scripts/
git commit -m "refactor(career-os): study_pack_publish + fos_study_git caller 8개 새 경로 갱신 (plan010-2 phase-03)

ai-nodes ADR-001 적용. phase-01에서 _shared/lib → career-os/scripts/_lib/로
이동한 study_pack_publish.ts + fos_study_git.ts의 caller 8개를 새 경로로
일괄 갱신.

study_pack_publish caller (5):
- run_study_pack / run_maintainer / run_from_request /
  run_live_coding_dispatch / run_bootcamp_batch

fos_study_git caller (3):
- run_master / run_question_bank / publish_job_analysis

검증: 옛 경로 잔재 0건 + 새 경로 호출 수 일치 + bash -n."
```

push는 phase-04.

## 검증

```bash
cd /home/bifos/ai-nodes

# 1. 옛 경로 잔재 0건
for h in study_pack_publish fos_study_git; do
  HITS=$(grep -rln "_shared/lib/${h}\|@shared/lib/${h}" career-os/scripts/ 2>/dev/null)
  [ -z "$HITS" ] || { echo "PHASE_FAILED: 옛 ${h} 잔재"; echo "$HITS"; exit 1; }
done

# 2. 새 경로 호출 수
SPP=$(grep -rln "career-os/scripts/_lib/study_pack_publish" career-os/scripts/ 2>/dev/null | wc -l)
FSG=$(grep -rln "career-os/scripts/_lib/fos_study_git" career-os/scripts/ 2>/dev/null | wc -l)
[ "$SPP" -ge 4 ] || { echo "PHASE_FAILED: study_pack_publish caller $SPP"; exit 1; }
[ "$FSG" -eq 3 ] || { echo "PHASE_FAILED: fos_study_git caller $FSG"; exit 1; }

# 3. 갱신된 caller bash syntax 일괄
for f in $(grep -rln "career-os/scripts/_lib/study_pack_publish\|career-os/scripts/_lib/fos_study_git" career-os/scripts/ 2>/dev/null); do
  bash -n "$f" || { echo "PHASE_FAILED: $f bash syntax"; exit 1; }
done

echo "phase-03 검증 통과"
```

## Blocked 조건

**중요 — exit code 명시**: 아래 어느 마커든 출력만 하지 말고 반드시 `exit 1` / `exit 2`. 본문의 모든 검증 bash 블록은 반드시 Bash 도구로 직접 실행.

- 새 위치 헬퍼 부재 → `PHASE_BLOCKED: phase-01 미완` + `exit 2`
- 옛 경로 잔재 → `PHASE_FAILED: 잔재` + `exit 1`
- caller 수 mismatch → `PHASE_FAILED: caller 수` + `exit 1`
- bash syntax 실패 → `PHASE_FAILED: $f syntax` + `exit 1`

## 의도 메모

- plan012가 fos-study-pack 흡수 시 `run_from_request.sh` 위치가 바뀔 수 있어 caller 수 *범위*로 검증 (>=4).
- 헬퍼 간 의존(study_pack_publish → fos_study_git)은 phase-01에서 같이 mv돼 별도 갱신 불필요.
- 8개 caller 모두 shell이라 grep + Edit 단순 작업.
