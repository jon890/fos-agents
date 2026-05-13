# Phase 4 — topic-pool-replenisher skill 신설 + replenish-topics case path 갱신

## 목표

topic candidate reservoir 보충(`replenish_topic_reservoir.py` + `promote_candidate_topics.py` + `topic-replenishment-prompt.md`)과 그 래퍼(`run_replenish_topic_reservoir.sh`)를 `skills/topic-pool-replenisher/`로 격리. dispatcher의 `replenish-topics` case path를 새 위치로 갱신.

## 의존성 / 가정

- phase-01~03 완료. `refresh_topic_inventory.py`는 `study-topic-recommender/scripts/`로 이동된 상태.
- working tree clean.

## 작업

### 1. 새 skill + SKILL.md

```
career-os/skills/topic-pool-replenisher/
├── SKILL.md
├── references/
└── scripts/
```

`SKILL.md`:
- `name: topic-pool-replenisher`
- `description`: "study-pack candidate reservoir 자동 보충 + primary auto-promotion(ADR-011). Claude subprocess를 직접 호출해 후보 토픽을 생성, 로컬 validator로 key/domain/tag/outputPath/prompt 검증 후 `config/topics.json`의 study-pack-candidates namespace에 append. 부족 시 candidate 일부를 primary로 promote."
- 산출물: `config/topics.json` 갱신 + `data/runtime/topic-replenishment.json` 실행 요약.
- 관련 ADR: 011 / 014 / 017.

### 2. 자산 이동 (git mv)

| 출처 | 목적지 |
|---|---|
| `cj-oliveyoung-java-backend-prep/scripts/replenish_topic_reservoir.py` | `topic-pool-replenisher/scripts/replenish_topic_reservoir.py` |
| `cj-oliveyoung-java-backend-prep/scripts/promote_candidate_topics.py` | `topic-pool-replenisher/scripts/promote_candidate_topics.py` |
| `cj-oliveyoung-java-backend-prep/scripts/run_replenish_topic_reservoir.sh` | `topic-pool-replenisher/scripts/run_topic_replenishment.sh` (이름 정리) |
| `cj-oliveyoung-java-backend-prep/references/topic-replenishment-prompt.md` | `topic-pool-replenisher/references/topic-replenishment-prompt.md` |

### 3. 이동 스크립트 내부 path 갱신

`replenish_topic_reservoir.py`는 두 군데에서 self-path를 참조한다(원본 line 108·344 부근):

- `TASK_ROOT / "skills" / "cj-oliveyoung-java-backend-prep" / "references" / "topic-replenishment-prompt.md"` → `TASK_ROOT / "skills" / "topic-pool-replenisher" / "references" / "topic-replenishment-prompt.md"`.
- `TASK_ROOT / "skills" / "cj-oliveyoung-java-backend-prep" / "scripts" / "refresh_topic_inventory.py"` → `TASK_ROOT / "skills" / "study-topic-recommender" / "scripts" / "refresh_topic_inventory.py"`. (`refresh_topic_inventory.py`는 phase-03에서 study-topic-recommender로 이동했음.)

`run_topic_replenishment.sh`:
- `SCRIPT="$TASK_ROOT/skills/cj-oliveyoung-java-backend-prep/scripts/replenish_topic_reservoir.py"` → `$TASK_ROOT/skills/topic-pool-replenisher/scripts/replenish_topic_reservoir.py`.

`promote_candidate_topics.py`: self-path 참조 grep으로 확인 → 있으면 갱신.

`promote_candidate_topics.py`를 호출하는 외부 코드(특히 `command-router/scripts/run_now.sh` 안의 `CANDIDATE_PROMOTER=...promote_candidate_topics.py` 라인)는 본 phase에서 같이 갱신 — 자기 case 영역 밖이지만 같은 파일이 이동했으니 dispatcher 안 참조 1개를 갱신.

### 4. dispatcher case path 갱신

`command-router/scripts/run_now.sh`:

- `replenish-topics)` case → `$TASK_ROOT/skills/topic-pool-replenisher/scripts/run_topic_replenishment.sh`.
- `study-pack)` case 안의 `CANDIDATE_PROMOTER="$TASK_ROOT/skills/cj-oliveyoung-java-backend-prep/scripts/promote_candidate_topics.py"` → `$TASK_ROOT/skills/topic-pool-replenisher/scripts/promote_candidate_topics.py`.

## 검증 명령

```bash
# 1. 새 skill 구조
test -f career-os/skills/topic-pool-replenisher/SKILL.md
test -f career-os/skills/topic-pool-replenisher/scripts/replenish_topic_reservoir.py
test -f career-os/skills/topic-pool-replenisher/scripts/promote_candidate_topics.py
test -f career-os/skills/topic-pool-replenisher/scripts/run_topic_replenishment.sh
test -f career-os/skills/topic-pool-replenisher/references/topic-replenishment-prompt.md

# 2. 이전 위치 git에서 제거
[ -z "$(git ls-files career-os/skills/cj-oliveyoung-java-backend-prep/scripts/replenish_topic_reservoir.py)" ]
[ -z "$(git ls-files career-os/skills/cj-oliveyoung-java-backend-prep/scripts/promote_candidate_topics.py)" ]
[ -z "$(git ls-files career-os/skills/cj-oliveyoung-java-backend-prep/scripts/run_replenish_topic_reservoir.sh)" ]
[ -z "$(git ls-files career-os/skills/cj-oliveyoung-java-backend-prep/references/topic-replenishment-prompt.md)" ]

# 3. syntax
bash -n career-os/skills/topic-pool-replenisher/scripts/run_topic_replenishment.sh
python3 -m py_compile career-os/skills/topic-pool-replenisher/scripts/replenish_topic_reservoir.py
python3 -m py_compile career-os/skills/topic-pool-replenisher/scripts/promote_candidate_topics.py

# 4. 새 skill에 cj-oliveyoung 잔재 없음
[ "$(grep -l 'cj-oliveyoung-java-backend-prep' career-os/skills/topic-pool-replenisher/scripts/*.sh career-os/skills/topic-pool-replenisher/scripts/*.py | wc -l)" = "0" ]

# 5. replenish_topic_reservoir.py가 새 위치의 refresh_topic_inventory.py를 가리킴
grep -q 'study-topic-recommender' career-os/skills/topic-pool-replenisher/scripts/replenish_topic_reservoir.py

# 6. dispatcher 갱신
grep -q 'skills/topic-pool-replenisher/scripts/run_topic_replenishment.sh' career-os/skills/command-router/scripts/run_now.sh
grep -q 'skills/topic-pool-replenisher/scripts/promote_candidate_topics.py' career-os/skills/command-router/scripts/run_now.sh
bash -n career-os/skills/command-router/scripts/run_now.sh
```

검증 실패 시 `echo 'PHASE_FAILED: <식>' && exit 1`.

## 커밋

```
refactor(career-os): topic 보충/promotion을 topic-pool-replenisher skill로 분리

- skills/topic-pool-replenisher/ 신설
- replenish_topic_reservoir.py / promote_candidate_topics.py / run_replenish_topic_reservoir.sh / topic-replenishment-prompt.md 이전
- run_topic_replenishment.sh로 이름 정리
- replenish_topic_reservoir.py의 self-path를 새 위치로, refresh_topic_inventory.py 참조를 study-topic-recommender 위치로 갱신
- dispatcher replenish-topics case + study-pack case의 CANDIDATE_PROMOTER path 갱신
- ADR-017 분해의 네 번째 단계
```

## 범위 외

- `config/topics.json`의 study-pack-candidates namespace 스키마(plan002에서 통합 완료).
- 사용자 노트·잠금 파일 이름 변경 X.
