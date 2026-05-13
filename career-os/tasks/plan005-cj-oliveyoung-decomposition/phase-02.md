# Phase 2 — knowledge-gap-analyzer skill 신설 + dispatcher baseline/daily/smoke case path 갱신

## 목표

`cj-oliveyoung-java-backend-prep/scripts/` 안의 **baseline / daily / smoke** 갭 분석 자산을 `skills/knowledge-gap-analyzer/`로 격리. dispatcher(`command-router/scripts/run_now.sh`)의 baseline / daily / smoke case path를 새 위치로 갱신.

## 의존성 / 가정

- phase-01 완료 — dispatcher 본체는 이미 `command-router/scripts/run_now.sh`에 있고 외부 caller도 모두 새 path를 가리킨다.
- working tree clean.
- `cj-oliveyoung-java-backend-prep/scripts/run_now.sh`는 더 이상 존재하지 않는다(phase-01에서 이동). 따라서 본 phase의 dispatcher path 갱신은 `command-router/scripts/run_now.sh` 안에서 수행.

## 작업

### 1. 새 skill 디렉터리 + SKILL.md

```
career-os/skills/knowledge-gap-analyzer/
├── SKILL.md
├── references/
└── scripts/
```

`SKILL.md`:
- `name: knowledge-gap-analyzer`
- `description`: "후보자의 코드/문서 갭을 분석. baseline(전체 큐레이션 set, ADR-003)·daily(토픽 집중, ADR-001)·smoke(최소 점검) 세 가지 모드. dispatcher의 `baseline` / `daily` / `smoke` 명령이 이 skill의 runner를 호출."
- 산출물: `data/reports/{baseline,daily}/YYYY-MM-DD/report.md` + `data/study-progress.json` 자동 갱신.
- 관련 ADR: 001 / 002 / 003 / 014 / 017.

### 2. 자산 이동 (git mv)

| 출처 | 목적지 |
|---|---|
| `cj-oliveyoung-java-backend-prep/scripts/run_baseline.sh` | `knowledge-gap-analyzer/scripts/run_baseline.sh` |
| `cj-oliveyoung-java-backend-prep/scripts/run_daily.sh` | `knowledge-gap-analyzer/scripts/run_daily.sh` |
| `cj-oliveyoung-java-backend-prep/scripts/run_smoke_test.sh` | `knowledge-gap-analyzer/scripts/run_smoke_test.sh` |
| `cj-oliveyoung-java-backend-prep/scripts/build_target_file_list.py` | `knowledge-gap-analyzer/scripts/build_target_file_list.py` |
| `cj-oliveyoung-java-backend-prep/scripts/select_topic.py` | `knowledge-gap-analyzer/scripts/select_topic.py` |
| `cj-oliveyoung-java-backend-prep/scripts/update_study_progress.py` | `knowledge-gap-analyzer/scripts/update_study_progress.py` |
| `cj-oliveyoung-java-backend-prep/references/baseline-prompt.md` | `knowledge-gap-analyzer/references/baseline-prompt.md` |
| `cj-oliveyoung-java-backend-prep/references/daily-prompt.md` | `knowledge-gap-analyzer/references/daily-prompt.md` |

### 3. 이동 스크립트 내부 path 갱신

이동 후 각 스크립트의 `skills/cj-oliveyoung-java-backend-prep/...` 자체 참조를 `skills/knowledge-gap-analyzer/...`로 일괄 치환:

- `run_baseline.sh`: `PROMPT_FILE` 라인.
- `run_daily.sh`: `PROMPT_FILE`, `TARGET_BUILDER`, `TOPIC_SELECTOR`, `update_study_progress.py` 호출 라인.
- `run_smoke_test.sh`: `PROMPT_FILE` 라인.

Python helper들은 self-path 참조 없는지 grep으로 확인. 있다면 갱신.

### 4. dispatcher case path 갱신

`command-router/scripts/run_now.sh`의 세 case의 runner 경로 변경:

- `baseline)` → `$TASK_ROOT/skills/knowledge-gap-analyzer/scripts/run_baseline.sh`
- `daily)` → `$TASK_ROOT/skills/knowledge-gap-analyzer/scripts/run_daily.sh`
- `smoke)` → `$TASK_ROOT/skills/knowledge-gap-analyzer/scripts/run_smoke_test.sh`

## 검증 명령

```bash
# 1. 새 skill 구조
test -f career-os/skills/knowledge-gap-analyzer/SKILL.md
test -f career-os/skills/knowledge-gap-analyzer/scripts/run_baseline.sh
test -f career-os/skills/knowledge-gap-analyzer/scripts/run_daily.sh
test -f career-os/skills/knowledge-gap-analyzer/scripts/run_smoke_test.sh
test -f career-os/skills/knowledge-gap-analyzer/scripts/build_target_file_list.py
test -f career-os/skills/knowledge-gap-analyzer/scripts/select_topic.py
test -f career-os/skills/knowledge-gap-analyzer/scripts/update_study_progress.py
test -f career-os/skills/knowledge-gap-analyzer/references/baseline-prompt.md
test -f career-os/skills/knowledge-gap-analyzer/references/daily-prompt.md

# 2. 이전 위치 git에서 제거
[ -z "$(git ls-files career-os/skills/cj-oliveyoung-java-backend-prep/scripts/run_baseline.sh)" ]
[ -z "$(git ls-files career-os/skills/cj-oliveyoung-java-backend-prep/scripts/run_daily.sh)" ]
[ -z "$(git ls-files career-os/skills/cj-oliveyoung-java-backend-prep/scripts/run_smoke_test.sh)" ]
[ -z "$(git ls-files career-os/skills/cj-oliveyoung-java-backend-prep/scripts/build_target_file_list.py)" ]
[ -z "$(git ls-files career-os/skills/cj-oliveyoung-java-backend-prep/scripts/select_topic.py)" ]
[ -z "$(git ls-files career-os/skills/cj-oliveyoung-java-backend-prep/scripts/update_study_progress.py)" ]
[ -z "$(git ls-files career-os/skills/cj-oliveyoung-java-backend-prep/references/baseline-prompt.md)" ]
[ -z "$(git ls-files career-os/skills/cj-oliveyoung-java-backend-prep/references/daily-prompt.md)" ]

# 3. syntax
bash -n career-os/skills/knowledge-gap-analyzer/scripts/run_baseline.sh
bash -n career-os/skills/knowledge-gap-analyzer/scripts/run_daily.sh
bash -n career-os/skills/knowledge-gap-analyzer/scripts/run_smoke_test.sh
python3 -m py_compile career-os/skills/knowledge-gap-analyzer/scripts/build_target_file_list.py
python3 -m py_compile career-os/skills/knowledge-gap-analyzer/scripts/select_topic.py
python3 -m py_compile career-os/skills/knowledge-gap-analyzer/scripts/update_study_progress.py

# 4. 새 스크립트에 cj-oliveyoung 잔재 없음
[ "$(grep -l 'cj-oliveyoung-java-backend-prep' career-os/skills/knowledge-gap-analyzer/scripts/*.sh career-os/skills/knowledge-gap-analyzer/scripts/*.py | wc -l)" = "0" ]

# 5. dispatcher case 갱신 확인
grep -q 'skills/knowledge-gap-analyzer/scripts/run_baseline.sh' career-os/skills/command-router/scripts/run_now.sh
grep -q 'skills/knowledge-gap-analyzer/scripts/run_daily.sh' career-os/skills/command-router/scripts/run_now.sh
grep -q 'skills/knowledge-gap-analyzer/scripts/run_smoke_test.sh' career-os/skills/command-router/scripts/run_now.sh
bash -n career-os/skills/command-router/scripts/run_now.sh
```

검증 실패 시 `echo 'PHASE_FAILED: <식>' && exit 1`.

## 커밋

```
refactor(career-os): baseline/daily/smoke를 knowledge-gap-analyzer skill로 분리

- skills/knowledge-gap-analyzer/ 신설 (SKILL.md + scripts/ + references/)
- 6개 스크립트 + 2개 references를 git mv로 이전
- 이동 스크립트 내부 self-path를 knowledge-gap-analyzer로 갱신
- command-router의 baseline/daily/smoke case path 갱신
- ADR-017 분해의 두 번째 단계
```

## 범위 외

- `cj-oliveyoung-java-backend-prep/` 폴더 자체 제거(phase-07).
- 다른 dispatcher case path 갱신은 각자의 phase에서.
- 외부 caller path 갱신은 phase-01에서 이미 완료.
