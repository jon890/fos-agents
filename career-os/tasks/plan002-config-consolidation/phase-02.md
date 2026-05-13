# Phase 02 — topics.json 통합 + resolver / caller 갱신

**Model**: sonnet
**Status**: pending

---

## 목표

career-os/config/의 5개 topic configs를 단일 `config/topics.json`으로 통합하고, 그 새 파일을 읽도록 4개 resolver와 8+ caller를 갱신한다. 본 plan에서 가장 큰 phase.

**범위 외**: sources.json 통합(phase-03), baseline-core-files.json(phase-04), position 자산 이동(phase-05), 옛 파일 삭제(phase-05).

---

## 관련 docs (실행 전 필수 읽기)

- `career-os/docs/data-schema.md` — phase-01에서 추가한 "통합 config 스키마 (plan002 이후)" 섹션. topics.json 정확한 스키마 명세.
- `career-os/docs/adr.md` — ADR-016 (phase-01에서 추가). 통합 결정의 *왜*.

## 마이그레이션 매핑

5개 파일 → 1개 파일. namespace = 새 파일의 최상위 키.

| 원본 파일 | namespace 키 |
|---|---|
| `career-os/config/study-pack-topics.json` | `study-pack` |
| `career-os/config/study-topic-candidates.json` | `study-pack-candidates` |
| `career-os/config/study-pack-maintainer-topics.json` | `study-pack-maintainer` |
| `career-os/config/experience-question-bank-topics.json` | `question-bank` |
| `career-os/config/interview-master-topics.json` | `master` |
| `career-os/config/cj-foodville-bootcamp-topics.json` | `bootcamp` |

새 `config/topics.json` 최상위:

```json
{
  "_meta": {
    "purpose": "career-os topic 메타데이터 단일 출처 (ADR-016)",
    "schema_version": "1",
    "namespaces": ["study-pack", "study-pack-candidates", "study-pack-maintainer", "question-bank", "master", "bootcamp"]
  },
  "study-pack": { /* study-pack-topics.json의 내용 그대로 */ },
  "study-pack-candidates": { /* study-topic-candidates.json 내용 */ },
  "study-pack-maintainer": { /* study-pack-maintainer-topics.json 내용 */ },
  "question-bank": { /* experience-question-bank-topics.json 내용 */ },
  "master": { /* interview-master-topics.json 내용 */ },
  "bootcamp": { /* cj-foodville-bootcamp-topics.json 내용 */ }
}
```

각 원본 파일이 이미 `{"topic-key": {...}, ...}` 형태면 그대로 namespace 값으로 복사. 원본이 `{"_meta": ..., "items": [...]}` 형태면 새 namespace 안에서 같은 구조 유지 (스키마 변형 금지 — 본 phase는 *위치 통합*만).

---

## 작업 항목

### 1. `config/topics.json` 마이그레이션 스크립트 실행

원본 5 파일을 읽고 새 파일을 작성하는 일회성 Python 스크립트:

```bash
cd /home/bifos/ai-nodes
python3 - <<'PY'
import json
from pathlib import Path

ws = Path("career-os")
mapping = {
    "study-pack":             ws / "config/study-pack-topics.json",
    "study-pack-candidates":  ws / "config/study-topic-candidates.json",
    "study-pack-maintainer":  ws / "config/study-pack-maintainer-topics.json",
    "question-bank":          ws / "config/experience-question-bank-topics.json",
    "master":                 ws / "config/interview-master-topics.json",
    "bootcamp":               ws / "config/cj-foodville-bootcamp-topics.json",
}

merged = {
    "_meta": {
        "purpose": "career-os topic 메타데이터 단일 출처 (ADR-016)",
        "schema_version": "1",
        "namespaces": list(mapping.keys()),
    },
}
for ns, src in mapping.items():
    if not src.exists():
        raise SystemExit(f"PHASE_FAILED: 원본 파일 누락 {src}")
    merged[ns] = json.loads(src.read_text(encoding="utf-8"))

out = ws / "config/topics.json"
out.write_text(json.dumps(merged, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
print(f"wrote {out} ({sum(1 for _ in out.read_text().splitlines())} lines)")
PY
```

원본 5 파일은 **이 phase에서 삭제하지 않는다** (phase-05의 cleanup에서 일괄). 새 파일을 만들고 caller만 새 파일을 읽도록 전환.

### 2. resolver 4개 갱신

각 resolver는 현재 `<config-path> <topic-key>` 인자를 받음. 새 시그니처도 동일하지만 *그 config가 통합 파일이라 namespace에서 자기 type을 찾아야* 한다.

각 resolver의 *자기 namespace*는 hardcoded:

| Resolver | hardcoded namespace |
|---|---|
| `career-os/skills/study-pack-writer/scripts/resolve_study_pack_topic.py` | `study-pack` |
| `career-os/skills/experience-question-bank-writer/scripts/resolve_question_bank_topic.py` | `question-bank` |
| `career-os/skills/interview-master-writer/scripts/resolve_master_topic.py` | `master` |
| `career-os/skills/study-pack-maintainer/scripts/resolve_maintainer_topic.py` | `study-pack-maintainer` |

각 resolver 변경 패턴:

```python
# Before
cfg = json.loads(Path(config_path).read_text(encoding="utf-8"))
if topic not in cfg:
    raise SystemExit(...)
entry = cfg[topic]

# After
cfg = json.loads(Path(config_path).read_text(encoding="utf-8"))
namespace = "study-pack"  # 각 resolver마다 hardcoded
ns_cfg = cfg.get(namespace, {})
if topic not in ns_cfg:
    raise SystemExit(...)
entry = ns_cfg[topic]
```

각 resolver 수정 시 *해당 파일만* 본다 — 다른 resolver는 phase 안에서 별도로 처리.

### 3. caller 갱신 (config 파일 경로 + 일부 inline 로직)

`run_now.sh`의 5개 case 분기에서 config 경로를 새 파일로 갱신:

| Case | 원래 (`TOPIC_CONFIG` 또는 유사) | 새 경로 |
|---|---|---|
| `study-pack` | `config/study-pack-topics.json`, `config/study-pack-maintainer-topics.json` | 둘 다 `config/topics.json` |
| `question-bank` | `config/experience-question-bank-topics.json` | `config/topics.json` |
| `master` | `config/interview-master-topics.json` | `config/topics.json` |
| `maintain-study-pack` | `config/study-pack-maintainer-topics.json` | `config/topics.json` |

`run_now.sh`의 inline Python heredoc (study-pack case의 maintainer-vs-writer 분기 판단부)에서도 옛 파일을 본다 — 그 heredoc도 새 namespace를 보도록 갱신.

`run_now.sh` study-pack case의 maintainer 분기 판단부 패턴:

```bash
# Before (현재 코드)
if [[ -z "${TOPIC_CONFIG_OVERRIDE:-}" && -f "$MAINTAINER_CONFIG" ]] && python3 - <<'PY' "$MAINTAINER_CONFIG" "$TOPIC"
import json, sys
from pathlib import Path
cfg = json.loads(Path(sys.argv[1]).read_text(encoding='utf-8'))
sys.exit(0 if sys.argv[2] in cfg else 1)
PY

# After (통합 topics.json에서 maintainer namespace만 확인)
if [[ -z "${TOPIC_CONFIG_OVERRIDE:-}" ]] && python3 - <<'PY' "$TASK_ROOT/config/topics.json" "$TOPIC"
import json, sys
from pathlib import Path
cfg = json.loads(Path(sys.argv[1]).read_text(encoding='utf-8'))
ns = cfg.get("study-pack-maintainer", {})
sys.exit(0 if sys.argv[2] in ns else 1)
PY
```

새 경로 후엔 `$MAINTAINER_CONFIG` 변수는 `$TASK_ROOT/config/topics.json`을 가리키도록 하고 inline Python만 namespace를 본다. `$PRIMARY_TOPIC_CONFIG`도 같은 방식.

다른 caller:
- `career-os/skills/fos-study-pack/scripts/run_from_request.sh` — study-pack-topics 읽음. 경로 + namespace 적용.
- `career-os/skills/fos-study-pack/scripts/resolve_freeform_study_pack.py` — study-pack-topics 읽음. 위와 동일.
- `career-os/skills/cj-oliveyoung-java-backend-prep/scripts/refresh_topic_inventory.py` — study-pack-topics + study-topic-candidates 읽음. 두 namespace 모두.
- `career-os/skills/cj-oliveyoung-java-backend-prep/scripts/replenish_topic_reservoir.py` — study-topic-candidates / study-pack-topics 읽음.
- `career-os/skills/cj-oliveyoung-java-backend-prep/scripts/promote_candidate_topics.py` — 동일.
- `career-os/skills/cj-oliveyoung-java-backend-prep/scripts/run_cj_foodville_bootcamp.sh` — cj-foodville-bootcamp-topics 읽음 (deferred WIP이지만 일관성 위해 갱신).

각 파일에서 옛 config 경로 grep으로 찾아 갱신:

```bash
# 그렙으로 옛 파일 참조 위치 모두 확인
cd /home/bifos/ai-nodes
for old in study-pack-topics study-topic-candidates study-pack-maintainer-topics experience-question-bank-topics interview-master-topics cj-foodville-bootcamp-topics; do
  echo "=== old: $old ==="
  grep -rln "$old\.json" career-os/skills/ career-os/AGENTS.md 2>/dev/null | grep -v sources/fos-study
done
```

위 결과의 각 파일에서 옛 경로를 `config/topics.json` + namespace 로직으로 교체.

### 4. AGENTS.md / docs 본문 안의 옛 파일명 직접 인용도 갱신

phase-01에서 docs를 갱신했지만, 각 docs/* 안에 옛 파일명이 prose로 등장하는 경우도 있다 (예: ADR-009의 본문). docs의 *재진술* 부분은 phase-01에서 다뤘으니, 본 phase는 docs 직접 수정 안 함 — 단 옛 파일명이 docs에 남아 잘못 안내하는지만 검증.

## Critical Files

| 파일 | 변경 |
|---|---|
| `career-os/config/topics.json` | 신규 (5 파일 통합) |
| `career-os/skills/study-pack-writer/scripts/resolve_study_pack_topic.py` | namespace 로직 추가 |
| `career-os/skills/experience-question-bank-writer/scripts/resolve_question_bank_topic.py` | 동일 |
| `career-os/skills/interview-master-writer/scripts/resolve_master_topic.py` | 동일 |
| `career-os/skills/study-pack-maintainer/scripts/resolve_maintainer_topic.py` | 동일 |
| `career-os/skills/cj-oliveyoung-java-backend-prep/scripts/run_now.sh` | 5 case의 config 경로 + inline namespace |
| `career-os/skills/cj-oliveyoung-java-backend-prep/scripts/refresh_topic_inventory.py` | 두 namespace 읽기 |
| `career-os/skills/cj-oliveyoung-java-backend-prep/scripts/replenish_topic_reservoir.py` | 동일 |
| `career-os/skills/cj-oliveyoung-java-backend-prep/scripts/promote_candidate_topics.py` | 동일 |
| `career-os/skills/cj-oliveyoung-java-backend-prep/scripts/run_cj_foodville_bootcamp.sh` | bootcamp namespace |
| `career-os/skills/fos-study-pack/scripts/run_from_request.sh` | study-pack namespace |
| `career-os/skills/fos-study-pack/scripts/resolve_freeform_study_pack.py` | 동일 |

**옛 5 파일은 phase-05 cleanup까지 보존.** 본 phase는 새 파일을 만들고 caller만 전환.

## 검증

```bash
cd /home/bifos/ai-nodes

# 1. config/topics.json 생성됐고 valid JSON + 6 namespace 모두 존재
python3 - <<'PY'
import json
data = json.load(open("career-os/config/topics.json"))
ns = data["_meta"]["namespaces"]
expected = {"study-pack","study-pack-candidates","study-pack-maintainer","question-bank","master","bootcamp"}
assert set(ns) == expected, f"namespaces mismatch: {set(ns)} vs {expected}"
for k in expected:
    assert k in data, f"missing namespace key: {k}"
    assert isinstance(data[k], (dict, list)), f"{k} not dict/list"
print(f"topics.json OK — 6 namespaces, total {sum(len(data[k]) for k in expected if isinstance(data[k], dict))} topics")
PY

# 2. 옛 5 파일 어디에서도 코드 / 스크립트에서 참조하지 않음 (docs는 OK)
echo "[old references in code]"
for old in study-pack-topics study-topic-candidates study-pack-maintainer-topics experience-question-bank-topics interview-master-topics cj-foodville-bootcamp-topics; do
  count=$(grep -rln "$old\.json" career-os/skills/ 2>/dev/null | grep -v sources/fos-study | wc -l)
  echo "  $old.json → $count code refs"
done
# 기대: 모두 0. 0이 아니면 누락된 caller 있음.

# 3. 새 topics.json은 코드에서 읽힘
count=$(grep -rln "topics.json" career-os/skills/ 2>/dev/null | grep -v sources/fos-study | wc -l)
echo "topics.json code refs: $count"
# 기대: 8 이상

# 4. 셸 / 파이썬 문법 검증
for f in career-os/skills/cj-oliveyoung-java-backend-prep/scripts/run_now.sh \
         career-os/skills/cj-oliveyoung-java-backend-prep/scripts/run_cj_foodville_bootcamp.sh \
         career-os/skills/fos-study-pack/scripts/run_from_request.sh; do
  bash -n "$f" || { echo "PHASE_FAILED: bash syntax $f"; exit 1; }
done
for f in career-os/skills/study-pack-writer/scripts/resolve_study_pack_topic.py \
         career-os/skills/experience-question-bank-writer/scripts/resolve_question_bank_topic.py \
         career-os/skills/interview-master-writer/scripts/resolve_master_topic.py \
         career-os/skills/study-pack-maintainer/scripts/resolve_maintainer_topic.py \
         career-os/skills/cj-oliveyoung-java-backend-prep/scripts/refresh_topic_inventory.py \
         career-os/skills/cj-oliveyoung-java-backend-prep/scripts/replenish_topic_reservoir.py \
         career-os/skills/cj-oliveyoung-java-backend-prep/scripts/promote_candidate_topics.py \
         career-os/skills/fos-study-pack/scripts/resolve_freeform_study_pack.py; do
  python3 -m py_compile "$f" || { echo "PHASE_FAILED: python syntax $f"; exit 1; }
done

# 5. resolver smoke — 임의 토픽 1개로 호출
cd career-os
TOPIC=$(python3 -c "import json; d=json.load(open('config/topics.json')); print(next(iter(d['study-pack'])))")
eval "$(python3 skills/study-pack-writer/scripts/resolve_study_pack_topic.py config/topics.json "$TOPIC")"
[[ -n "$STUDY_TOPIC" ]] || { echo "PHASE_FAILED: resolver smoke (study-pack: $TOPIC)"; exit 1; }
echo "resolver smoke OK: STUDY_TOPIC=$STUDY_TOPIC"
cd ..
```

위 5개 모두 통과해야 success.

## 커밋

```
refactor(career-os): topics.json 통합 (5 configs → 1) + resolver/caller 갱신

ADR-016. 5개 topic configs를 단일 config/topics.json + 6 namespace로 통합. 4 resolver는 자기 namespace를 hardcoded로 알고 새 파일에서 해당 namespace만 본다. run_now.sh + 8+ caller는 새 파일 경로로 전환. 옛 5 파일은 phase-05에서 일괄 삭제.
```

push는 phase-05에서.

## 의도 메모

- namespace 분리(`type-key` 평탄화 대신)는 key 충돌 방지 + 같은 type 내부에서 단순 dict 읽기 보장. resolver 로직 변화 최소.
- resolver 시그니처 그대로(`<config-path> <topic-key>`) 유지 — caller 영향이 *경로* 단일 변화로 축소.

## Blocked 조건

**중요 — exit code 명시**: 아래 어느 마커든 출력만 하지 말고 반드시 `sys.exit(1)` (FAILED) 또는 `sys.exit(2)` (BLOCKED) — shell에서는 `exit 1` / `exit 2` — 비-0 exit code로 종료한다. 마커만 출력하고 정상 종료하면 `run-phases.py`가 success로 잘못 처리한다 (plan001-adr-cleanup 1차 실행 사례).

- 원본 5 config 중 하나라도 누락 → `PHASE_BLOCKED: 원본 config 누락 (이름)` + `exit 2`
- 검증 1번에서 namespace 누락 → `PHASE_FAILED: namespace 누락` + `exit 1`
- 검증 2번 0이 아닌 게 있음 → `PHASE_FAILED: 옛 파일 코드 참조 잔존 (파일명·위치)` + `exit 1`
- 문법 검증 실패 → `PHASE_FAILED: syntax error (path)` + `exit 1`
