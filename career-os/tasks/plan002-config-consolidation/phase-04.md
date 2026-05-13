# Phase 04 — baseline-core-files.txt → JSON 전환

**Model**: sonnet
**Status**: pending

---

## 목표

`config/baseline-core-files.txt`(6줄짜리 path 리스트)를 `config/baseline-core-files.json`으로 전환. config/ 안의 형식 일관성(JSON 통일) + per-file 메타데이터 가능성 확보.

**범위 외**: 다른 config 통합(phase-02/03), position 자산 이동(phase-05), 옛 파일 삭제(phase-05).

---

## 관련 docs

- `career-os/docs/data-schema.md` — "통합 config 스키마 (plan002 이후)"의 `baseline-core-files.json` 명세.
- `career-os/docs/adr.md` — ADR-003 (baseline core set의 *왜*), ADR-016 (JSON 통일 결정).

## 마이그레이션 매핑

원본 6줄(개별 줄당 하나의 fos-study 상대 경로) → JSON `files[]` 배열. 각 항목은 `{"path": "..."}`. note 필드는 옵션이라 비워둘 수 있음.

새 `config/baseline-core-files.json`:

```json
{
  "_meta": {
    "purpose": "baseline 분석 대상 큐레이션된 core 파일 (ADR-003, ADR-016)",
    "schema_version": "1"
  },
  "files": [
    {"path": "interview/kakao-healthcare-carechat-ai-agent.md"},
    {"path": "resume/2603_김병태_이력서_v4.md"}
  ]
}
```

(실제 원본 모든 줄을 그대로 옮긴다 — 6줄 → 6 entries.)

## 작업 항목

### 1. 마이그레이션 실행

```bash
cd /home/bifos/ai-nodes
python3 - <<'PY'
import json
from pathlib import Path

src = Path("career-os/config/baseline-core-files.txt")
if not src.exists():
    raise SystemExit("PHASE_BLOCKED: baseline-core-files.txt 누락")

lines = [l.strip() for l in src.read_text(encoding="utf-8").splitlines() if l.strip() and not l.lstrip().startswith("#")]
out = {
    "_meta": {
        "purpose": "baseline 분석 대상 큐레이션된 core 파일 (ADR-003, ADR-016)",
        "schema_version": "1",
    },
    "files": [{"path": p} for p in lines],
}

dst = Path("career-os/config/baseline-core-files.json")
dst.write_text(json.dumps(out, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
print(f"wrote {dst} ({len(out['files'])} entries)")
PY
```

옛 txt 파일은 phase-05까지 보존.

### 2. `run_baseline.sh` 갱신

현재 `baseline-core-files.txt`를 한 줄씩 읽어 target list 생성하는 부분이 있다. grep으로 위치 찾고:

```bash
cd /home/bifos/ai-nodes
grep -n "baseline-core-files" career-os/skills/cj-oliveyoung-java-backend-prep/scripts/run_baseline.sh
```

txt를 그대로 읽던 부분(예: `cat $CORE_FILES`, `while read line; do ...`)을 JSON 파싱으로 교체:

```bash
# Before
cat "$TASK_ROOT/config/baseline-core-files.txt" > "$TARGET_LIST"

# After
python3 -c "
import json, sys
data = json.load(open('$TASK_ROOT/config/baseline-core-files.json'))
print('\n'.join(f['path'] for f in data['files']))
" > "$TARGET_LIST"
```

또는 jq가 있으면 `jq -r '.files[].path' $TASK_ROOT/config/baseline-core-files.json > $TARGET_LIST`.

### 3. `build_target_file_list.py` 갱신 (해당 시)

이 스크립트가 baseline-core-files를 직접 읽는지 확인:

```bash
grep -n "baseline-core-files\|core_files" career-os/skills/cj-oliveyoung-java-backend-prep/scripts/build_target_file_list.py
```

- 직접 읽으면: txt → json 파싱으로 교체 (위와 동일 패턴).
- run_baseline.sh가 target-files.txt를 미리 만들어주고 build_target_file_list.py는 그것만 보는 패턴이면 build_target_file_list.py는 손대지 않음.

### 4. 다른 참조 확인

```bash
cd /home/bifos/ai-nodes
grep -rln "baseline-core-files\.txt" career-os/skills/ 2>/dev/null | grep -v sources/fos-study
```

위 결과에서 등장하는 모든 곳을 `baseline-core-files.json`으로 갱신.

## Critical Files

| 파일 | 변경 |
|---|---|
| `career-os/config/baseline-core-files.json` | 신규 |
| `career-os/skills/cj-oliveyoung-java-backend-prep/scripts/run_baseline.sh` | txt 읽기 → JSON 파싱 |
| `career-os/skills/cj-oliveyoung-java-backend-prep/scripts/build_target_file_list.py` | (해당 시) 동일 패턴 |

옛 `baseline-core-files.txt`는 phase-05 cleanup.

## 검증

```bash
cd /home/bifos/ai-nodes

# 1. JSON valid + 원본 6줄 모두 보존
python3 - <<'PY'
import json
data = json.load(open("career-os/config/baseline-core-files.json"))
old_count = sum(1 for l in open("career-os/config/baseline-core-files.txt") if l.strip() and not l.lstrip().startswith("#"))
new_count = len(data["files"])
assert old_count == new_count, f"파일 수 불일치: txt={old_count}, json={new_count}"
print(f"baseline-core-files.json OK — {new_count} entries (txt와 동일)")
PY

# 2. 옛 txt가 코드에서 더 이상 참조되지 않음
count=$(grep -rln "baseline-core-files\.txt" career-os/skills/ 2>/dev/null | grep -v sources/fos-study | wc -l)
echo "old txt code refs: $count"
# 기대: 0

# 3. run_baseline.sh 문법
bash -n career-os/skills/cj-oliveyoung-java-backend-prep/scripts/run_baseline.sh

# 4. build_target_file_list.py 문법 (수정했으면)
python3 -m py_compile career-os/skills/cj-oliveyoung-java-backend-prep/scripts/build_target_file_list.py

# 5. baseline target list 생성 smoke — run_baseline.sh의 target list 생성 부분만 실행 가능하면 시도
# 어렵다면 skip 가능. 다만 옛 + 새 결과의 target list가 같아야 함.
```

검증 1~4 통과해야 success. 5는 best-effort.

## 커밋

```
refactor(career-os): baseline-core-files.txt → JSON 전환

ADR-016. config/ 안 형식 일관성 (JSON 통일). per-file 메타데이터(향후 priority/note) 가능. run_baseline.sh / build_target_file_list.py(해당 시) 새 파일 읽기로 갱신. 옛 txt는 phase-05에서 삭제.
```

push는 phase-05에서.

## Blocked 조건

**중요 — exit code 명시**: 아래 어느 마커든 출력만 하지 말고 반드시 `sys.exit(1)` (FAILED) 또는 `sys.exit(2)` (BLOCKED) — shell에서는 `exit 1` / `exit 2` — 비-0 exit code로 종료한다. 마커만 출력하고 정상 종료하면 `run-phases.py`가 success로 잘못 처리한다 (plan001-adr-cleanup 1차 실행 사례).

- 원본 txt 누락 → `PHASE_BLOCKED: baseline-core-files.txt 누락` + `exit 2`
- 파일 수 mismatch (txt vs json) → `PHASE_FAILED: 마이그레이션 누락` + `exit 1`
- 옛 txt 코드 참조 잔존 → `PHASE_FAILED: caller 잔존` + `exit 1`
- 문법 실패 → `PHASE_FAILED: syntax error` + `exit 1`
