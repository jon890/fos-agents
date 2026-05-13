# Phase 2 — 신설 4 skill scripts/ 이동 + dispatcher case 갱신

## 목표

plan005에서 신설된 4개 도메인 skill(`knowledge-gap-analyzer` / `study-topic-recommender` / `topic-pool-replenisher` / `study-pack-batch`)의 `skills/<name>/scripts/` 전체를 `scripts/<name>/`로 이동. 이동한 스크립트 내부 self-path 갱신 + dispatcher의 관련 case path 7개 갱신.

## 의존성 / 가정

- phase-01 완료. dispatcher는 `scripts/command-router/run_now.sh`에 있음.
- working tree clean.

## 작업

### 1. 4개 skill scripts/ 일괄 이동 (git mv)

각 skill에 대해:

```bash
mkdir -p career-os/scripts/<skill-name>
git mv career-os/skills/<skill-name>/scripts/* career-os/scripts/<skill-name>/
```

이동 대상 4 skill — 파일 목록:

- **knowledge-gap-analyzer**: `run_baseline.sh`, `run_daily.sh`, `run_smoke_test.sh`, `build_target_file_list.py`, `select_topic.py`, `update_study_progress.py`
- **study-topic-recommender**: `run_topic_recommendation.sh`, `run_live_coding_dispatch.sh`, `refresh_topic_inventory.py`, `feed_discovery.py`
- **topic-pool-replenisher**: `run_topic_replenishment.sh`, `replenish_topic_reservoir.py`, `promote_candidate_topics.py`
- **study-pack-batch**: `run_bootcamp_batch.sh`

`__pycache__`는 따라가지 않음(gitignore). 이동 후 새 디렉터리에 다시 생성될 수 있음(검증 단계에서 무시).

### 2. 이동 스크립트 내부 self-path 갱신

각 스크립트 안의 `skills/<self-skill>/scripts/...` 자체 참조를 `scripts/<self-skill>/...`로 일괄 치환.

대표 자가-참조 위치:
- `run_baseline.sh`: `PROMPT_FILE` (references는 skills/ 측 유지, scripts/ 측이 아니라 변경 X) ← 단 self-skill scripts 영역 안의 cross-script 참조가 있으면 갱신.
- `run_daily.sh`: `TARGET_BUILDER` (build_target_file_list.py), `TOPIC_SELECTOR` (select_topic.py), `update_study_progress.py` 호출.
- `run_smoke_test.sh`: PROMPT_FILE — references 위치는 유지(skills/<name>/references/).
- `run_topic_recommendation.sh`: `SCRIPT_DIR` 변수.
- `run_live_coding_dispatch.sh`: command-router의 notify / run_now 참조 — phase-01에서 새 경로로 결정되어 있으니 그 경로 사용. NOTIFY_SCRIPT → `scripts/command-router/notify_discord.sh`. run_now exec → `scripts/command-router/run_now.sh`.
- `run_topic_replenishment.sh`: `SCRIPT` 변수(replenish_topic_reservoir.py).
- `replenish_topic_reservoir.py`: self-path(`scripts/topic-pool-replenisher/replenish_topic_reservoir.py`가 자기 참조), cross-skill(`scripts/study-topic-recommender/refresh_topic_inventory.py` 참조), references는 `skills/topic-pool-replenisher/references/topic-replenishment-prompt.md` 유지.
- `run_bootcamp_batch.sh`: cross-skill(study-pack-writer의 resolve / runner — phase-03에서 study-pack-writer 이동 후 path 갱신될 예정. 본 phase에서는 일시 `skills/study-pack-writer/scripts/...` 그대로 유지 — phase-03가 정합).

**중요**: phase-03에서 study-pack-writer가 이동하므로, run_bootcamp_batch.sh가 study-pack-writer 경로를 참조하는 경우 phase-03에서 함께 갱신. 본 phase에서는 자기 skill 내부 + command-router 참조만 갱신.

references 경로는 `skills/<name>/references/`에 유지(ADR-019에 명시). 이동 X.

### 3. dispatcher 7개 case path 갱신

`scripts/command-router/run_now.sh`:

- `baseline)` → `$TASK_ROOT/scripts/knowledge-gap-analyzer/run_baseline.sh`
- `daily)` → `$TASK_ROOT/scripts/knowledge-gap-analyzer/run_daily.sh`
- `smoke)` → `$TASK_ROOT/scripts/knowledge-gap-analyzer/run_smoke_test.sh`
- `recommend-topics)` → `$TASK_ROOT/scripts/study-topic-recommender/run_topic_recommendation.sh`
- `live-coding-dispatch)` → `$TASK_ROOT/scripts/study-topic-recommender/run_live_coding_dispatch.sh`
- `replenish-topics)` → `$TASK_ROOT/scripts/topic-pool-replenisher/run_topic_replenishment.sh`
- `bootcamp-batch)` → `$TASK_ROOT/scripts/study-pack-batch/run_bootcamp_batch.sh`
- `study-pack)` 안의 `CANDIDATE_PROMOTER` 라인 → `$TASK_ROOT/scripts/topic-pool-replenisher/promote_candidate_topics.py`

## 검증 명령

```bash
# 1. 신설 4 skill의 새 위치 존재
for skill in knowledge-gap-analyzer study-topic-recommender topic-pool-replenisher study-pack-batch; do
  test -d career-os/scripts/$skill || { echo "PHASE_FAILED: career-os/scripts/$skill 없음"; exit 1; }
done

test -f career-os/scripts/knowledge-gap-analyzer/run_baseline.sh
test -f career-os/scripts/knowledge-gap-analyzer/run_daily.sh
test -f career-os/scripts/knowledge-gap-analyzer/run_smoke_test.sh
test -f career-os/scripts/knowledge-gap-analyzer/build_target_file_list.py
test -f career-os/scripts/knowledge-gap-analyzer/select_topic.py
test -f career-os/scripts/knowledge-gap-analyzer/update_study_progress.py
test -f career-os/scripts/study-topic-recommender/run_topic_recommendation.sh
test -f career-os/scripts/study-topic-recommender/run_live_coding_dispatch.sh
test -f career-os/scripts/study-topic-recommender/refresh_topic_inventory.py
test -f career-os/scripts/study-topic-recommender/feed_discovery.py
test -f career-os/scripts/topic-pool-replenisher/run_topic_replenishment.sh
test -f career-os/scripts/topic-pool-replenisher/replenish_topic_reservoir.py
test -f career-os/scripts/topic-pool-replenisher/promote_candidate_topics.py
test -f career-os/scripts/study-pack-batch/run_bootcamp_batch.sh

# 2. 이전 위치 git에서 제거
for skill in knowledge-gap-analyzer study-topic-recommender topic-pool-replenisher study-pack-batch; do
  if [ -n "$(git ls-files career-os/skills/$skill/scripts/)" ]; then
    echo "PHASE_FAILED: career-os/skills/$skill/scripts/ 잔재"
    exit 1
  fi
done

# 3. syntax
for f in career-os/scripts/knowledge-gap-analyzer/*.sh \
         career-os/scripts/study-topic-recommender/*.sh \
         career-os/scripts/topic-pool-replenisher/*.sh \
         career-os/scripts/study-pack-batch/*.sh; do
  bash -n "$f" || { echo "PHASE_FAILED: $f"; exit 1; }
done
for f in career-os/scripts/knowledge-gap-analyzer/*.py \
         career-os/scripts/study-topic-recommender/*.py \
         career-os/scripts/topic-pool-replenisher/*.py; do
  python3 -m py_compile "$f" || { echo "PHASE_FAILED: $f"; exit 1; }
done

# 4. self-path 갱신 확인 — 이동된 4 skill scripts 안에 옛 경로 잔재 없음
[ "$(grep -rln 'skills/knowledge-gap-analyzer/scripts\|skills/study-topic-recommender/scripts\|skills/topic-pool-replenisher/scripts\|skills/study-pack-batch/scripts' career-os/scripts/ | wc -l)" = "0" ]

# 5. dispatcher 7 case 갱신
grep -q 'scripts/knowledge-gap-analyzer/run_baseline.sh' career-os/scripts/command-router/run_now.sh
grep -q 'scripts/knowledge-gap-analyzer/run_daily.sh' career-os/scripts/command-router/run_now.sh
grep -q 'scripts/knowledge-gap-analyzer/run_smoke_test.sh' career-os/scripts/command-router/run_now.sh
grep -q 'scripts/study-topic-recommender/run_topic_recommendation.sh' career-os/scripts/command-router/run_now.sh
grep -q 'scripts/study-topic-recommender/run_live_coding_dispatch.sh' career-os/scripts/command-router/run_now.sh
grep -q 'scripts/topic-pool-replenisher/run_topic_replenishment.sh' career-os/scripts/command-router/run_now.sh
grep -q 'scripts/study-pack-batch/run_bootcamp_batch.sh' career-os/scripts/command-router/run_now.sh
grep -q 'scripts/topic-pool-replenisher/promote_candidate_topics.py' career-os/scripts/command-router/run_now.sh
bash -n career-os/scripts/command-router/run_now.sh
```

검증 실패 시 `echo 'PHASE_FAILED: <식>' && exit 1`.

## 커밋

```
refactor(career-os): 신설 4 skill scripts/ → workspace scripts/<name>/ 이동

- knowledge-gap-analyzer / study-topic-recommender / topic-pool-replenisher / study-pack-batch
- 각 skill 내부 self-path 갱신
- dispatcher 7개 case + study-pack의 CANDIDATE_PROMOTER path 갱신
- ADR-019 적용의 두 번째 단계
```

## 범위 외

- 기존 6 skill(study-pack-writer 등) 이동(phase-03).
- study-pack-batch에서 study-pack-writer를 호출하는 cross-skill path(phase-03에서 study-pack-writer 이동 시 같이 갱신).
- 빈 `skills/<name>/scripts/` 디렉터리 정리(phase-04).
- SKILL.md 갱신(phase-04).
- references는 그대로 `skills/<name>/references/`에 유지.
