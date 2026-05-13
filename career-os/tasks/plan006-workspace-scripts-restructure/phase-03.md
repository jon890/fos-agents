# Phase 3 — 기존 7 skill scripts/ 이동 + dispatcher 나머지 case + cross-skill path

## 목표

plan005 분해 대상에 포함되지 않았던 기존 7 skill(`study-pack-writer` / `study-pack-maintainer` / `experience-question-bank-writer` / `interview-master-writer` / `position-recommender` / `cj-foodville-coffeechat-prep` / `fos-study-pack`)의 `skills/<name>/scripts/` 전체를 `scripts/<name>/`로 이동. dispatcher 나머지 7개 case 갱신 + cross-skill path 갱신.

## 의존성 / 가정

- phase-01 + phase-02 완료. dispatcher는 `scripts/command-router/run_now.sh`에 있고 신설 4 skill은 `scripts/<name>/`에 이동된 상태.
- working tree clean.

## 작업

### 1. 7개 skill scripts/ 일괄 이동 (git mv)

각 skill에 대해:

```bash
mkdir -p career-os/scripts/<skill-name>
git mv career-os/skills/<skill-name>/scripts/* career-os/scripts/<skill-name>/
```

이동 대상 7 skill (실제 파일 목록은 phase 실행 시 `git ls-files career-os/skills/<skill>/scripts/`로 확인 — Python `__pycache__` 등 비-tracked는 제외):

- **study-pack-writer**: `run_study_pack.sh`, `extract_and_validate_study_pack.py`, `resolve_study_pack_topic.py` 등.
- **study-pack-maintainer**: `run_maintainer.sh`, `resolve_maintainer_topic.py`.
- **experience-question-bank-writer**: `run_question_bank.sh`, `run_question_bank_auto.sh`, `render_question_bank.py`, `resolve_question_bank_topic.py`.
- **interview-master-writer**: `run_master.sh`, `resolve_master_topic.py`.
- **position-recommender**: `run_position_recommendation.sh`, `extract_position_report.py`, `collect_live_postings.py`(deferred), `publish_job_analysis.sh`(deferred).
- **cj-foodville-coffeechat-prep**: `run_foodville_coffeechat_prep.sh`, `collect_foodville_sites.py`.
- **fos-study-pack**: `run_from_request.sh`(deferred — dispatcher 미연결).

references는 그대로 `skills/<name>/references/`에 유지.

### 2. 이동 스크립트 내부 self-path / cross-skill path 갱신

각 스크립트의 path 참조 일괄 점검·갱신:

- **Self-path**: 자기 skill scripts 내 cross-script(`SCRIPT_DIR`, `RUNNER`, `RESOLVER` 같은 변수) → `scripts/<self-skill>/...`
- **command-router 참조**: phase-01 결과 `scripts/command-router/notify_discord.sh` / `scripts/command-router/run_now.sh`.
- **cross-skill**: 예를 들어 `run_bootcamp_batch.sh`(study-pack-batch, phase-02 이동됨)가 `RESOLVER="$TASK_ROOT/skills/study-pack-writer/scripts/resolve_study_pack_topic.py"`를 가리키고 있다면, 본 phase에서 study-pack-writer 이동 후 `$TASK_ROOT/scripts/study-pack-writer/resolve_study_pack_topic.py`로 갱신.
- **dispatcher 안의 resolver 호출**: `command-router/run_now.sh`의 study-pack / question-bank / master / maintain-study-pack 분기 안에서 `$TASK_ROOT/skills/<skill>/scripts/resolve_*.py`를 호출하는 라인들. 본 phase에서 모두 `scripts/<skill>/resolve_*.py`로 갱신.
- **experience-question-bank-writer**의 `run_question_bank_auto.sh`: phase-01에서 이미 command-router의 새 경로(`scripts/command-router/...`)를 가리키도록 갱신됐는지 확인. 누락 시 본 phase에서 추가.

스캔 명령(작업 시작 전):

```bash
grep -rln 'skills/study-pack-writer/scripts\|skills/study-pack-maintainer/scripts\|skills/experience-question-bank-writer/scripts\|skills/interview-master-writer/scripts\|skills/position-recommender/scripts\|skills/cj-foodville-coffeechat-prep/scripts\|skills/fos-study-pack/scripts' career-os/ \
  --include='*.sh' --include='*.py' \
  | grep -v 'tasks/' | grep -v 'docs/'
```

결과의 모든 파일을 갱신.

### 3. dispatcher 나머지 7 case path 갱신

`scripts/command-router/run_now.sh`:

- `study-pack)` 안의 resolver / runner 경로:
  - `RESOLVER="$TASK_ROOT/scripts/study-pack-writer/resolve_study_pack_topic.py"`
  - `run_tracked ... "$TASK_ROOT/scripts/study-pack-writer/run_study_pack.sh"`
  - maintainer 분기: `RESOLVER="$TASK_ROOT/scripts/study-pack-maintainer/resolve_maintainer_topic.py"` / `run_tracked ... "$TASK_ROOT/scripts/study-pack-maintainer/run_maintainer.sh"`
- `maintain-study-pack)` → `$TASK_ROOT/scripts/study-pack-maintainer/run_maintainer.sh` + resolver path
- `question-bank)` → resolver + `$TASK_ROOT/scripts/experience-question-bank-writer/run_question_bank.sh`
- `master)` → resolver + `$TASK_ROOT/scripts/interview-master-writer/run_master.sh`
- `recommend-positions)` → `$TASK_ROOT/scripts/position-recommender/run_position_recommendation.sh`
- `foodville-coffeechat)` → `$TASK_ROOT/scripts/cj-foodville-coffeechat-prep/run_foodville_coffeechat_prep.sh`
- `auto-question-bank)` → `$TASK_ROOT/scripts/experience-question-bank-writer/run_question_bank_auto.sh`

## 검증 명령

```bash
# 1. 새 위치 존재 (대표 파일만)
for skill in study-pack-writer study-pack-maintainer experience-question-bank-writer interview-master-writer position-recommender cj-foodville-coffeechat-prep fos-study-pack; do
  test -d career-os/scripts/$skill || { echo "PHASE_FAILED: scripts/$skill 없음"; exit 1; }
done

test -f career-os/scripts/study-pack-writer/run_study_pack.sh
test -f career-os/scripts/study-pack-maintainer/run_maintainer.sh
test -f career-os/scripts/experience-question-bank-writer/run_question_bank.sh
test -f career-os/scripts/experience-question-bank-writer/run_question_bank_auto.sh
test -f career-os/scripts/interview-master-writer/run_master.sh
test -f career-os/scripts/position-recommender/run_position_recommendation.sh
test -f career-os/scripts/cj-foodville-coffeechat-prep/run_foodville_coffeechat_prep.sh
test -f career-os/scripts/fos-study-pack/run_from_request.sh

# 2. 이전 위치 git에서 제거
for skill in study-pack-writer study-pack-maintainer experience-question-bank-writer interview-master-writer position-recommender cj-foodville-coffeechat-prep fos-study-pack; do
  if [ -n "$(git ls-files career-os/skills/$skill/scripts/)" ]; then
    echo "PHASE_FAILED: career-os/skills/$skill/scripts/ 잔재"
    exit 1
  fi
done

# 3. syntax 전체 통과
for f in career-os/scripts/*/*.sh; do
  bash -n "$f" || { echo "PHASE_FAILED: $f"; exit 1; }
done
for f in career-os/scripts/*/*.py; do
  python3 -m py_compile "$f" || { echo "PHASE_FAILED: $f"; exit 1; }
done

# 4. 모든 scripts/* 내부에 skills/<name>/scripts/ 잔재 없음
[ "$(grep -rln 'skills/[a-z-]*/scripts/' career-os/scripts/ | wc -l)" = "0" ]

# 5. dispatcher 14 case 모두 새 경로 가리킴
for skill in command-router knowledge-gap-analyzer study-topic-recommender topic-pool-replenisher study-pack-batch study-pack-writer study-pack-maintainer experience-question-bank-writer interview-master-writer position-recommender cj-foodville-coffeechat-prep; do
  grep -q "scripts/$skill/" career-os/scripts/command-router/run_now.sh \
    || { echo "PHASE_FAILED: dispatcher에 scripts/$skill/ 경로 없음"; exit 1; }
done

bash -n career-os/scripts/command-router/run_now.sh

# 6. 워크스페이스 코드 전체에 skills/<name>/scripts/ 잔재 없음 (docs / tasks / AGENTS / CLAUDE 제외)
HITS=$(grep -rln 'skills/[a-z-]*/scripts/' career-os/ \
  --include='*.sh' --include='*.py' \
  | grep -v 'tasks/' | grep -v 'docs/')
if [ -n "$HITS" ]; then
  echo "PHASE_FAILED: skills/<name>/scripts/ 잔재"
  echo "$HITS"
  exit 1
fi
```

검증 실패 시 `echo 'PHASE_FAILED: <식>' && exit 1`.

## 커밋

```
refactor(career-os): 기존 7 skill scripts/ → workspace scripts/<name>/ 이동

- study-pack-writer / study-pack-maintainer / experience-question-bank-writer / interview-master-writer / position-recommender / cj-foodville-coffeechat-prep / fos-study-pack
- 각 skill self-path + cross-skill path 일괄 갱신
- dispatcher 7 case (study-pack / maintain-study-pack / question-bank / master / recommend-positions / foodville-coffeechat / auto-question-bank) path 갱신
- ADR-019 적용의 세 번째 단계
```

## 범위 외

- 빈 `skills/<name>/scripts/` 디렉터리 정리(phase-04).
- SKILL.md 안의 안내 path 갱신(phase-04).
- references는 그대로 `skills/<name>/references/`에 유지.
- ai-nodes/CLAUDE.md path는 docs commit에서 이미 처리됨.
