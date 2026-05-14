# Phase 4 — 통합 smoke + 잔재 grep + push + trailing cleanup

**Model**: sonnet
**Status**: pending

---

## 목표

phase-01/02/03 산출물 통합 검증. ai-nodes ADR-001 위반(`_shared/lib`에 워크스페이스 한정 헬퍼) 0건 확인. tsc + bash + dispatcher smoke 통과 + index.json status=completed + push + trailing cleanup.

**범위 외**: apartment 마이그레이션, plan011/012 영역.

## 관련 docs

- `docs/adr.md` ai-nodes ADR-001 — 본 plan 결정 출처.
- `career-os/tasks/plan010-2-helpers-relocate/index.json` — status 마킹 대상.

## 작업 항목

### 1. 잔재 grep — ADR-001 정책 위반 0건

```bash
cd /home/bifos/ai-nodes

# 1-1. _shared/lib에 3개 mv 대상 헬퍼 부재
for f in build_prompt study_pack_publish fos_study_git; do
  test ! -e "_shared/lib/${f}.ts" \
    || { echo "PHASE_FAILED: _shared/lib/${f}.ts 잔존 (ADR-001 위반)"; exit 1; }
done
echo "[1-1] _shared/lib에 mv 대상 헬퍼 부재 OK"

# 1-2. career-os/scripts/_lib에 3개 헬퍼 모두 존재 + 실행 권한
for f in career-os/scripts/_lib/{build_prompt,study_pack_publish,fos_study_git}.ts; do
  test -f "$f" || { echo "PHASE_FAILED: $f 부재"; exit 1; }
  test -x "$f" || { echo "PHASE_FAILED: $f 실행 권한 없음"; exit 1; }
  head -1 "$f" | grep -qF '#!/usr/bin/env bun' \
    || { echo "PHASE_FAILED: $f shebang"; exit 1; }
done
echo "[1-2] career-os/scripts/_lib 3 헬퍼 OK"

# 1-3. caller 옛 경로 호출 잔재 0건 (careers/scripts/ + _shared/ 전역)
for h in build_prompt study_pack_publish fos_study_git; do
  HITS=$(grep -rln "_shared/lib/${h}\|@shared/lib/${h}" career-os/scripts/ _shared/ skills/plan-and-build/ 2>/dev/null)
  if [ -n "$HITS" ]; then
    echo "PHASE_FAILED: 옛 ${h} 호출 잔재"
    echo "$HITS"
    exit 1
  fi
done
echo "[1-3] caller 옛 경로 잔재 0건 OK"

# 1-4. caller 새 경로 호출 수 — build_prompt 4, study_pack_publish >=4, fos_study_git 3
BP=$(grep -rln "career-os/scripts/_lib/build_prompt" career-os/scripts/ 2>/dev/null | wc -l)
SPP=$(grep -rln "career-os/scripts/_lib/study_pack_publish" career-os/scripts/ 2>/dev/null | wc -l)
FSG=$(grep -rln "career-os/scripts/_lib/fos_study_git" career-os/scripts/ 2>/dev/null | wc -l)
echo "build_prompt: $BP / study_pack_publish: $SPP / fos_study_git: $FSG"
[ "$BP" -eq 4 ] || { echo "PHASE_FAILED: build_prompt caller $BP (expected 4)"; exit 1; }
[ "$SPP" -ge 4 ] || { echo "PHASE_FAILED: study_pack_publish caller $SPP (expected >=4)"; exit 1; }
[ "$FSG" -eq 3 ] || { echo "PHASE_FAILED: fos_study_git caller $FSG (expected 3)"; exit 1; }
echo "[1-4] caller 새 경로 호출 수 OK"
```

### 2. 문법 검증

```bash
cd /home/bifos/ai-nodes

# 2-1. tsc 전체
bunx tsc --noEmit 2>&1 | tee /tmp/plan010-2-phase04-tsc.log
[ "${PIPESTATUS[0]}" -eq 0 ] || { echo "PHASE_FAILED: tsc"; cat /tmp/plan010-2-phase04-tsc.log; exit 1; }
echo "[2-1] tsc OK"

# 2-2. 갱신된 caller 12개 bash -n (build_prompt 4 + study_pack_publish 5 + fos_study_git 3)
for f in $(grep -rln "career-os/scripts/_lib/" career-os/scripts/ 2>/dev/null | grep '\.sh$' | sort -u); do
  bash -n "$f" || { echo "PHASE_FAILED: $f bash syntax"; exit 1; }
done
echo "[2-2] caller bash syntax OK"

# 2-3. dispatcher smoke (run_now.sh)
bash -n career-os/scripts/command-router/run_now.sh \
  || { echo "PHASE_FAILED: dispatcher bash syntax"; exit 1; }
bash career-os/scripts/command-router/run_now.sh 2>&1 | grep -q "usage" \
  || { echo "PHASE_FAILED: dispatcher usage 메시지 없음"; exit 1; }
echo "[2-3] dispatcher smoke OK"
```

### 3. tsconfig 갱신 확인

```bash
cd /home/bifos/ai-nodes
python3 -c "
import json
t = json.load(open('tsconfig.json'))
ps = t['compilerOptions']['paths']
assert '@career-os/_lib/*' in ps, 'path alias 누락'
includes = t.get('include', [])
assert any('career-os/scripts' in i for i in includes), 'include 미확장'
print('tsconfig OK')
" || { echo "PHASE_FAILED: tsconfig"; exit 1; }
```

### 4. index.json status=completed 마킹

```bash
cd /home/bifos/ai-nodes
python3 - <<'PY'
import json
from pathlib import Path
p = Path("career-os/tasks/plan010-2-helpers-relocate/index.json")
data = json.loads(p.read_text(encoding="utf-8"))
data["status"] = "completed"
data["current_phase"] = 4
for phase in data["phases"]:
    phase["status"] = "completed"
p.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
print("[index.json] marked completed")
PY
```

### 5. 최종 commit + push

```bash
cd /home/bifos/ai-nodes
git add career-os/tasks/plan010-2-helpers-relocate/index.json
git commit -m "task(career-os): plan010-2-helpers-relocate 완료 마킹"
git push origin main
```

push 실패 시 `PHASE_FAILED: push (<stderr>)` + `exit 1`.

### 6. trailing cleanup — run-phases.py 후처리

```bash
cd /home/bifos/ai-nodes
if [ -n "$(git status --porcelain career-os/tasks/plan010-2-helpers-relocate/index.json)" ]; then
  python3 -c "
from pathlib import Path
p = Path('career-os/tasks/plan010-2-helpers-relocate/index.json')
text = p.read_text(encoding='utf-8')
if not text.endswith('\n'):
    p.write_text(text + '\n', encoding='utf-8')
"
  git add career-os/tasks/plan010-2-helpers-relocate/index.json
  git commit -m "task(career-os): plan010-2 index.json commitSha 후기록 + EOL 보정"
  git push origin main
fi

[ -z "$(git status --porcelain career-os/tasks/plan010-2-helpers-relocate/)" ] \
  || { echo "PHASE_FAILED: trailing 후에도 잔재"; git status --porcelain; exit 1; }
```

## Critical Files

| 파일 | 변경 |
|---|---|
| `career-os/tasks/plan010-2-helpers-relocate/index.json` | status 마킹 (in-place) |

다른 파일은 phase-01/02/03이 commit. trailing cleanup에서만 index.json 추가.

## Blocked 조건

**중요 — exit code 명시**: 아래 어느 마커든 출력만 하지 말고 반드시 `exit 1` / `exit 2`. 본문의 모든 검증 bash 블록은 반드시 Bash 도구로 직접 실행 (prose로 마커만 출력하면 success로 잘못 처리 — plan001/plan004 사례).

- 잔재 검증 1-1~1-4 중 하나 실패 → `PHASE_FAILED: 잔재 <항목>` + `exit 1`
- tsc 실패 → `PHASE_FAILED: tsc` + `exit 1`
- caller bash syntax 실패 → `PHASE_FAILED: syntax (<file>)` + `exit 1`
- dispatcher smoke 실패 → `PHASE_FAILED: dispatcher` + `exit 1`
- push 실패 → `PHASE_FAILED: push (<stderr>)` + `exit 1`
- trailing cleanup 후에도 plan010-2 경로 dirty → `PHASE_FAILED: trailing 미완` + `exit 1`
- phase-01/02/03 commit 부재 → `PHASE_BLOCKED: 선행 phase 미완` + `exit 2`

## 의도 메모

- 통합 smoke는 ADR-001 정책 *위반 0건* 강제 (destructive 검증). additive 갱신만으로 통과 못 함 (common-pitfalls 6-5).
- caller 12개 모두 shell이라 syntax 검증 일괄 가능.
- dispatcher smoke는 실제 명령 실행 아니라 usage 메시지 출력만 확인 — 부수효과 없음.
- trailing cleanup은 plan001~010에서 매번 발생한 패턴 (common-pitfalls 6-2). 본 phase가 자체 처리.
