# Phase 02 — 통합 정적 검증 + status=completed + push

**Model**: haiku
**Status**: pending

---

## 목표

phase-01 산출물 통합 정적 검증 후 plan002 완료 처리 + origin/main push.

**범위 외**: run_report.sh full Claude 호출 검증 (비용 발생 — 다음 cron 또는 사용자 명시 호출에서 자연 검증).

---

## 본 phase 강제 주의문

- 본 phase 종료 시 commit 개수 self-check: 1 (index.json status=completed 만).
- `git push origin main`은 본 phase에서만 (마지막 phase 표준).

---

## 작업 항목

## 사전 cwd 설정 (run-phases.py hotfix)

run-phases.py는 cwd=apartment로 phase 실행. 본 phase는 ai-nodes 루트 기준 `apartment/...` path 다수 인용 — 첫 bash 호출에서 cwd=ai-nodes 루트로 변경 (Claude Code Bash 도구 cwd 보존).

```bash
cd "$(git rev-parse --show-toplevel)"
pwd  # 기대: /home/bifos/ai-nodes
```

---

### 1. 통합 정적 검증

```bash
# 1-1. focus-unit.json complexLocation 존재
python3 -c "
import json
d = json.load(open('apartment/config/focus-unit.json'))
assert 'complexLocation' in d, 'complexLocation 키 누락'
assert d['complexLocation'].startswith('경기 구리시'), f'unexpected: {d[\"complexLocation\"]}'
print('[complexLocation] OK')
"

# 1-2. ts 파일 존재 + 실행 가능
test -f apartment/scripts/_lib/load_target_meta.ts && echo "[ts file] OK" || { echo "PHASE_FAILED: ts 파일 부재"; exit 1; }
OUTPUT=$(bun run apartment/scripts/_lib/load_target_meta.ts apartment/config/focus-unit.json) || { echo "PHASE_FAILED: ts 실행 실패"; exit 1; }
echo "$OUTPUT" | grep -q "^TARGET_NAME=" || { echo "PHASE_FAILED: ts 출력 형식 이상 (TARGET_NAME 부재)"; echo "$OUTPUT"; exit 1; }
echo "$OUTPUT" | grep -q "^TARGET_LOCATION=" || { echo "PHASE_FAILED: ts 출력 형식 이상 (TARGET_LOCATION 부재)"; echo "$OUTPUT"; exit 1; }
LINE_COUNT=$(echo "$OUTPUT" | grep -c "^TARGET_")
[ "$LINE_COUNT" -eq 5 ] || { echo "PHASE_FAILED: ts 출력 5줄 기대, 실제 $LINE_COUNT 줄"; echo "$OUTPUT"; exit 1; }
echo "[ts run + 출력 형식] OK"

# 1-3. run_report.sh 옛 default 잔존 0
LEFT=$(grep -E '\$\{TARGET_[A-Z_]+:-' apartment/skills/apartment-daily-report/scripts/run_report.sh | wc -l)
[ "$LEFT" -eq 0 ] || { echo "PHASE_FAILED: 옛 TARGET_* default 잔존 $LEFT 건"; grep -nE '\$\{TARGET_[A-Z_]+:-' apartment/skills/apartment-daily-report/scripts/run_report.sh; exit 1; }
echo "[옛 TARGET_* default 잔존] 0 OK"

# 1-4. run_report.sh ts 호출 등록
grep -q "load_target_meta.ts" apartment/skills/apartment-daily-report/scripts/run_report.sh || { echo "PHASE_FAILED: ts 호출 누락"; exit 1; }
echo "[ts 호출 등록] OK"

# 1-5. shell syntax
bash -n apartment/skills/apartment-daily-report/scripts/run_report.sh && echo "[shell syntax] OK" || { echo "PHASE_FAILED: shell syntax 오류"; exit 1; }

# 1-6. ADR-002 + ADR-003 본문 docs 정합
grep -q "^## ADR-002 — 타깃 메타" apartment/docs/adr.md || { echo "PHASE_FAILED: ADR-002 본문 부재"; exit 1; }
grep -q "^## ADR-003 — apartment TypeScript" apartment/docs/adr.md || { echo "PHASE_FAILED: ADR-003 본문 부재"; exit 1; }
echo "[ADR-002 + ADR-003 본문] OK"

# 1-7. data-schema.md complexLocation 명세
grep -q "complexLocation" apartment/docs/data-schema.md || { echo "PHASE_FAILED: data-schema.md complexLocation 명세 부재"; exit 1; }
echo "[data-schema complexLocation] OK"

# 1-8. code-architecture.md scripts/_lib/ 트리 등록
grep -q "scripts/_lib/" apartment/docs/code-architecture.md || { echo "PHASE_FAILED: code-architecture.md scripts/_lib/ 트리 누락"; exit 1; }
grep -q "TypeScript | 1" apartment/docs/code-architecture.md || { echo "PHASE_FAILED: code-architecture.md 언어 분포 TS 1 미반영"; exit 1; }
echo "[code-architecture.md 트리 + 언어 분포] OK"
```

### 2. index.json status=completed

run-phases.py가 phase 종료 시 자동으로 처리하지만, 마지막 phase는 명시적으로 완료 표기.

`Edit` 도구로 `apartment/tasks/plan002-target-meta-ts/index.json` 갱신:
- `status`: `"running"` (또는 phase-01 종료 후 값) → `"completed"`
- `current_phase`: `2`
- `updated_at`: 현재 시각 (ISO 8601 UTC)

### 3. commit + push

```bash
git add apartment/tasks/plan002-target-meta-ts/index.json
git commit -m "$(cat <<'COMMIT_EOF'
task(apartment): plan002 index.json status=completed (phase-02)

plan002 단계 1~2 통과:
- phase-01: focus-unit.json complexLocation 추가 + load_target_meta.ts 신설 + run_report.sh ts eval 대체
- phase-02: 통합 정적 검증 (focus-unit.json 키 / ts 출력 / shell syntax / ADR-002/003 본문 / data-schema / code-architecture)

ADR-002 (focus-unit.json 단일 출처) + ADR-003 (apartment TypeScript 도입) 적용. apartment 첫 ts 파일 활성화 + Bun runtime 의존성 첫 사용.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
COMMIT_EOF
)"

COMMITS=$(git log --format='%H' HEAD~1..HEAD | wc -l)
echo "[commit count] $COMMITS"
[ "$COMMITS" -eq 1 ] || { echo "PHASE_FAILED: phase commit $COMMITS != 1"; exit 1; }

git push origin main || { echo "PHASE_FAILED: push 실패"; exit 1; }

echo "✓ Phase 02 검증 통과 + push 완료"
```

---

## 의도 메모

- 정적 검증만 — Claude full run 호출 비용 회피. run_report.sh의 collect/normalize/Claude 흐름은 다음 cron 또는 사용자 명시 호출에서 자연 검증.
- ts 출력 5 줄 검증 (`TARGET_NAME / TARGET_ALIAS / TARGET_LOCATION / TARGET_UNIT_LABEL / TARGET_UNIT_EXCLUSIVE_AREA_M2`) — 출력 형식 회귀 방어.
- code-architecture.md 언어 분포 표 `TypeScript | 1` 검증 — apartment 첫 ts 파일 등록 정합 확인.
