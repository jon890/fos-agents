# Phase 2 — build_prompt.ts caller 4개 갱신

**Model**: sonnet
**Status**: pending

---

## 목표

phase-01에서 `_shared/lib/build_prompt.ts` → `career-os/scripts/_lib/build_prompt.ts`로 이동했으므로, 옛 경로를 호출하던 4개 shell runner를 새 경로로 일괄 갱신.

**범위 외**: study_pack_publish / fos_study_git caller (phase-03), 통합 smoke (phase-04).

## 관련 docs

- `docs/adr.md` ai-nodes ADR-001 — 위치 분리 결정 출처.
- phase-01 commit — 새 위치 확립.

## 사전 검증

```bash
cd /home/bifos/ai-nodes

# 1-A. 새 위치 헬퍼 존재
test -f career-os/scripts/_lib/build_prompt.ts || { echo "PHASE_BLOCKED: phase-01 미완 — 새 위치 헬퍼 부재"; exit 2; }

# 1-B. 옛 위치 헬퍼 없음
test ! -e _shared/lib/build_prompt.ts || { echo "PHASE_BLOCKED: phase-01 미완 — 옛 위치 잔존"; exit 2; }

echo "사전 검증 OK"
```

## 갱신 대상 caller (실측 기반 — phase 작성 시점 grep)

| caller | 옛 호출 패턴 | 새 호출 패턴 |
|---|---|---|
| `career-os/scripts/knowledge-gap-analyzer/run_baseline.sh` | `_shared/lib/build_prompt.ts` | `career-os/scripts/_lib/build_prompt.ts` |
| `career-os/scripts/knowledge-gap-analyzer/run_daily.sh` | (동일) | (동일) |
| `career-os/scripts/knowledge-gap-analyzer/run_smoke_test.sh` | (동일) | (동일) |
| `career-os/scripts/cj-foodville-coffeechat-prep/run_foodville_coffeechat_prep.sh` | (동일) | (동일) |

phase 실행 Claude는 다음 grep으로 실측 재확인:

```bash
cd /home/bifos/ai-nodes
echo "=== build_prompt 호출 caller (현재 상태) ==="
grep -rln "build_prompt\.ts" career-os/scripts/ 2>/dev/null
```

기대값 4건. 4건이 아니면 `PHASE_FAILED: caller 수 mismatch (expected 4, got N)` + `exit 1`.

## 작업 항목

### 1. 각 caller에서 경로 치환

shell runner마다 `bun ... _shared/lib/build_prompt.ts ...` → `bun ... career-os/scripts/_lib/build_prompt.ts ...` 또는 변수화돼 있으면 변수 정의를 갱신.

phase 실행 Claude는 각 파일을 Read한 뒤 정확한 위치(절대 경로 vs `$HOME/ai-nodes` 변수 vs 상대 경로)를 보고 Edit. 패턴:

- `"$HOME/ai-nodes/_shared/lib/build_prompt.ts"` → `"$HOME/ai-nodes/career-os/scripts/_lib/build_prompt.ts"`
- `_shared/lib/build_prompt.ts` (상대) → `career-os/scripts/_lib/build_prompt.ts`
- 변수 정의 (`BUILD_PROMPT=...`) → 변수값만 갱신

### 2. bash 문법 + 호출 잔재 검증

```bash
cd /home/bifos/ai-nodes

# 1. 4 caller bash syntax
for f in career-os/scripts/knowledge-gap-analyzer/run_baseline.sh \
         career-os/scripts/knowledge-gap-analyzer/run_daily.sh \
         career-os/scripts/knowledge-gap-analyzer/run_smoke_test.sh \
         career-os/scripts/cj-foodville-coffeechat-prep/run_foodville_coffeechat_prep.sh; do
  bash -n "$f" || { echo "PHASE_FAILED: $f bash syntax"; exit 1; }
done
echo "[1] 4 caller bash syntax OK"

# 2. 옛 _shared/lib/build_prompt 잔재 0건
HITS=$(grep -lE '_shared/lib/build_prompt|@shared/lib/build_prompt' career-os/scripts/ -r 2>/dev/null)
[ -z "$HITS" ] || { echo "PHASE_FAILED: 옛 build_prompt 호출 잔재"; echo "$HITS"; exit 1; }
echo "[2] 옛 경로 잔재 0건 OK"

# 3. 새 경로 호출 4건
COUNT=$(grep -lE 'career-os/scripts/_lib/build_prompt' career-os/scripts/ -r 2>/dev/null | wc -l)
[ "$COUNT" -eq 4 ] || { echo "PHASE_FAILED: 새 경로 호출 수 $COUNT (expected 4)"; exit 1; }
echo "[3] 새 경로 호출 4건 OK"
```

## Critical Files

| 파일 | 변경 |
|---|---|
| `career-os/scripts/knowledge-gap-analyzer/run_baseline.sh` | build_prompt 경로 |
| `career-os/scripts/knowledge-gap-analyzer/run_daily.sh` | (동일) |
| `career-os/scripts/knowledge-gap-analyzer/run_smoke_test.sh` | (동일) |
| `career-os/scripts/cj-foodville-coffeechat-prep/run_foodville_coffeechat_prep.sh` | (동일) |

다른 파일은 손대지 않는다. study_pack_publish / fos_study_git caller는 phase-03.

## 커밋

```bash
cd /home/bifos/ai-nodes
git add career-os/scripts/knowledge-gap-analyzer/ career-os/scripts/cj-foodville-coffeechat-prep/
git commit -m "refactor(career-os): build_prompt.ts caller 4개 새 경로 갱신 (plan010-2 phase-02)

ai-nodes ADR-001 적용. phase-01에서 _shared/lib → career-os/scripts/_lib/로
이동한 build_prompt.ts의 caller 4개를 새 경로로 갱신.

- run_baseline.sh / run_daily.sh / run_smoke_test.sh (knowledge-gap-analyzer)
- run_foodville_coffeechat_prep.sh (cj-foodville-coffeechat-prep)

검증: 4 caller bash -n + 옛 경로 잔재 0건 + 새 경로 호출 4건."
```

push는 phase-04.

## 검증

```bash
cd /home/bifos/ai-nodes

# 1. 옛 경로 호출 0건 (전체 career-os/scripts/)
HITS=$(grep -rln "_shared/lib/build_prompt\|@shared/lib/build_prompt" career-os/scripts/ 2>/dev/null)
[ -z "$HITS" ] || { echo "PHASE_FAILED: 옛 build_prompt 호출 잔재"; echo "$HITS"; exit 1; }

# 2. 4 caller 모두 새 경로 호출
for f in career-os/scripts/knowledge-gap-analyzer/run_baseline.sh \
         career-os/scripts/knowledge-gap-analyzer/run_daily.sh \
         career-os/scripts/knowledge-gap-analyzer/run_smoke_test.sh \
         career-os/scripts/cj-foodville-coffeechat-prep/run_foodville_coffeechat_prep.sh; do
  grep -q "career-os/scripts/_lib/build_prompt" "$f" \
    || { echo "PHASE_FAILED: $f 에 새 경로 build_prompt 호출 누락"; exit 1; }
done

# 3. bash syntax
for f in career-os/scripts/knowledge-gap-analyzer/run_baseline.sh \
         career-os/scripts/knowledge-gap-analyzer/run_daily.sh \
         career-os/scripts/knowledge-gap-analyzer/run_smoke_test.sh \
         career-os/scripts/cj-foodville-coffeechat-prep/run_foodville_coffeechat_prep.sh; do
  bash -n "$f" || { echo "PHASE_FAILED: $f bash syntax"; exit 1; }
done

echo "phase-02 검증 통과"
```

## Blocked 조건

**중요 — exit code 명시**: 아래 어느 마커든 출력만 하지 말고 반드시 `sys.exit(1)` / `exit 1` 또는 `exit 2`. 본문의 모든 검증 bash 블록은 반드시 Bash 도구로 직접 실행.

- 새 위치 헬퍼 부재 → `PHASE_BLOCKED: phase-01 미완` + `exit 2`
- caller 수 mismatch → `PHASE_FAILED: caller 수` + `exit 1`
- 옛 경로 잔재 → `PHASE_FAILED: 잔재 호출` + `exit 1`
- bash syntax 실패 → `PHASE_FAILED: $f syntax` + `exit 1`

## 의도 메모

- caller 4개는 모두 shell이라 grep + sed 또는 Edit으로 패턴 치환 단순.
- 변수화된 caller (BUILD_PROMPT=...) 발견 시 변수 정의 줄만 갱신해도 OK.
- 절대 경로 (`$HOME/ai-nodes/...`) 패턴 일관 유지.
