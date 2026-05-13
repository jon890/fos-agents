# Phase 3 — study-topic-recommender skill 신설 + recommend-topics 갱신 + live-coding-dispatch 새 case

## 목표

morning 추천 파이프라인(`refresh_topic_inventory.py` + `feed_discovery.py` + `run_morning_topic_recommendation.sh`)을 `skills/study-topic-recommender/`로 격리. WIP였던 `run_morning_live_coding.sh`를 같이 이전하면서 시점명·회사명을 제거(`run_live_coding_dispatch.sh`). dispatcher의 `recommend-topics` case path 갱신 + 새 case `live-coding-dispatch` 추가.

## 의존성 / 가정

- phase-01 + phase-02 완료. dispatcher는 `command-router/scripts/run_now.sh`에 있고 `notify_discord.sh`도 `command-router/scripts/`에 있다.
- working tree clean.

## 작업

### 1. 새 skill 디렉터리 + SKILL.md

```
career-os/skills/study-topic-recommender/
├── SKILL.md
└── scripts/
```

`SKILL.md`:
- `name: study-topic-recommender`
- `description`: "morning 학습 토픽 추천 파이프라인. inventory 갱신 + 점수(ADR-010) + mix target(ADR-012) + RSS/Atom feed discovery(ADR-013). live-coding seed pool에서 1개를 골라 study-pack-writer로 dispatch하는 wrapper도 포함. dispatcher의 `recommend-topics` / `live-coding-dispatch` 명령이 이 skill의 runner를 호출."
- 산출물: `data/runtime/topic-inventory.json` · `topic-inventory-history.jsonl` · `morning-topic-recommendation.md`. live-coding은 `data/runtime/live-coding-generated-topic.json`(임시) → 위임 study-pack 흐름.
- 관련 ADR: 009 / 010 / 012 / 013 / 017.

### 2. 자산 이동 (git mv)

| 출처 | 목적지 |
|---|---|
| `cj-oliveyoung-java-backend-prep/scripts/refresh_topic_inventory.py` | `study-topic-recommender/scripts/refresh_topic_inventory.py` |
| `cj-oliveyoung-java-backend-prep/scripts/feed_discovery.py` | `study-topic-recommender/scripts/feed_discovery.py` |
| `cj-oliveyoung-java-backend-prep/scripts/run_morning_topic_recommendation.sh` | `study-topic-recommender/scripts/run_topic_recommendation.sh` (시점명 morning 제거) |
| `cj-oliveyoung-java-backend-prep/scripts/run_morning_live_coding.sh` | `study-topic-recommender/scripts/run_live_coding_dispatch.sh` (시점명 morning 제거, 기능명 강조) |

`__pycache__`는 따라가지 않는다(gitignore 대상). 검증 단계에서는 source 파일만 본다.

### 3. 이동 스크립트 내부 path 갱신

- `run_topic_recommendation.sh`: `SCRIPT_DIR` 경로 → `study-topic-recommender/scripts`.
- `run_live_coding_dispatch.sh`:
  - `NOTIFY_SCRIPT` → `$TASK_ROOT/skills/command-router/scripts/notify_discord.sh`.
  - 마지막 `exec ... run_now.sh study-pack ...` → `$TASK_ROOT/skills/command-router/scripts/run_now.sh`.
  - 잠금 파일 경로 `$LOCK_DIR/morning-live-coding.lock`은 운영 잠금이므로 이름 유지(이름 변경 시 race 위험).
- `refresh_topic_inventory.py` / `feed_discovery.py`: 자기-path 또는 형제 스크립트 self-path 참조 grep으로 확인. `refresh_topic_inventory.py`가 형제 `feed_discovery.py`를 import한다면 모듈 import는 same-package이므로 변경 불필요. 단 파일 경로 문자열 참조가 있다면 갱신.

### 4. dispatcher path 변경

`command-router/scripts/run_now.sh`:

- `recommend-topics)` case의 runner → `$TASK_ROOT/skills/study-topic-recommender/scripts/run_topic_recommendation.sh`.
- 새 case `live-coding-dispatch)` 추가:
  ```
  live-coding-dispatch)
    run_tracked "career-os:live-coding-dispatch" "live-coding dispatch" \
      "$TASK_ROOT/skills/study-topic-recommender/scripts/run_live_coding_dispatch.sh"
    ;;
  ```
  usage 라인의 명령 목록에 `live-coding-dispatch` 추가.

## 검증 명령

```bash
# 1. 새 skill 구조
test -f career-os/skills/study-topic-recommender/SKILL.md
test -f career-os/skills/study-topic-recommender/scripts/refresh_topic_inventory.py
test -f career-os/skills/study-topic-recommender/scripts/feed_discovery.py
test -f career-os/skills/study-topic-recommender/scripts/run_topic_recommendation.sh
test -f career-os/skills/study-topic-recommender/scripts/run_live_coding_dispatch.sh

# 2. 이전 위치 git에서 제거
[ -z "$(git ls-files career-os/skills/cj-oliveyoung-java-backend-prep/scripts/refresh_topic_inventory.py)" ]
[ -z "$(git ls-files career-os/skills/cj-oliveyoung-java-backend-prep/scripts/feed_discovery.py)" ]
[ -z "$(git ls-files career-os/skills/cj-oliveyoung-java-backend-prep/scripts/run_morning_topic_recommendation.sh)" ]
[ -z "$(git ls-files career-os/skills/cj-oliveyoung-java-backend-prep/scripts/run_morning_live_coding.sh)" ]

# 3. syntax
bash -n career-os/skills/study-topic-recommender/scripts/run_topic_recommendation.sh
bash -n career-os/skills/study-topic-recommender/scripts/run_live_coding_dispatch.sh
python3 -m py_compile career-os/skills/study-topic-recommender/scripts/refresh_topic_inventory.py
python3 -m py_compile career-os/skills/study-topic-recommender/scripts/feed_discovery.py

# 4. 새 skill에 cj-oliveyoung 잔재 없음
[ "$(grep -l 'cj-oliveyoung-java-backend-prep' career-os/skills/study-topic-recommender/scripts/*.sh career-os/skills/study-topic-recommender/scripts/*.py | wc -l)" = "0" ]

# 5. dispatcher 갱신
grep -q 'skills/study-topic-recommender/scripts/run_topic_recommendation.sh' career-os/skills/command-router/scripts/run_now.sh
grep -q '^  live-coding-dispatch)' career-os/skills/command-router/scripts/run_now.sh
grep -q 'skills/study-topic-recommender/scripts/run_live_coding_dispatch.sh' career-os/skills/command-router/scripts/run_now.sh
bash -n career-os/skills/command-router/scripts/run_now.sh

# 6. live-coding dispatch가 command-router를 직접 가리킴
grep -q 'skills/command-router/scripts/notify_discord.sh' career-os/skills/study-topic-recommender/scripts/run_live_coding_dispatch.sh
grep -q 'skills/command-router/scripts/run_now.sh' career-os/skills/study-topic-recommender/scripts/run_live_coding_dispatch.sh
```

검증 실패 시 `echo 'PHASE_FAILED: <식>' && exit 1`.

## 커밋

```
feat(career-os): morning 추천을 study-topic-recommender skill로 분리 + live-coding-dispatch wire-up

- skills/study-topic-recommender/ 신설
- refresh_topic_inventory.py / feed_discovery.py / run_morning_topic_recommendation.sh / run_morning_live_coding.sh 이전
- 시점명 morning 제거: run_topic_recommendation.sh / run_live_coding_dispatch.sh로 리네임
- run_live_coding_dispatch.sh가 command-router의 notify·run_now를 직접 참조
- dispatcher recommend-topics case path 갱신
- dispatcher 새 case live-coding-dispatch 추가
- ADR-017 분해의 세 번째 단계
```

## 범위 외

- 잠금 파일 이름(`morning-live-coding.lock`) 변경 X.
- 사용자 노트 파일명(`morning-topic-recommendation.md`) 변경 X.
- 외부 caller path 갱신(phase-01에서 완료).
