# Phase 5 — study-pack-batch skill 신설 + dispatcher bootcamp-batch 새 case

## 목표

`run_cj_foodville_bootcamp.sh`(부트캠프 토픽 일괄 study-pack 생성기, 회사명 박힘)를 `skills/study-pack-batch/scripts/run_bootcamp_batch.sh`로 이전하면서 회사명 제거. dispatcher에 새 case `bootcamp-batch` 추가.

ADR-017로 결정된 WIP 3개 wire-up의 첫 case(나머지 둘은 phase-03에서 `live-coding-dispatch`, phase-06에서 `auto-question-bank`).

## 의존성 / 가정

- phase-01~04 완료. dispatcher는 `command-router/scripts/run_now.sh`에 있고 study-pack-writer는 기존 위치 유지.
- plan002 phase-04 완료로 `config/topics.json`에 `bootcamp` namespace가 존재(plan002 phase-04에서 통합). 본 phase는 그 스키마를 그대로 사용.
- working tree clean.

## 작업

### 1. 새 skill + SKILL.md

```
career-os/skills/study-pack-batch/
├── SKILL.md
└── scripts/
```

`SKILL.md`:
- `name: study-pack-batch`
- `description`: "특정 도메인의 부트캠프 모드로 study-pack 일괄 생성. `config/topics.json`의 `bootcamp` namespace에 정의된 토픽 큐에서 dailyRecommendCount만큼 추천하고 dailyGenerateCount만큼 study-pack-writer로 위임. dispatcher의 `bootcamp-batch` 명령이 이 skill의 runner를 호출."
- 산출물: `data/runtime/bootcamp-summary.md` (오늘의 추천+생성 요약) + `data/reports/daily/YYYY-MM-DD/bootcamp/` (날짜별 사본) + 위임 study-pack의 fos-study commit·push.
- 관련 ADR: 011 / 014 / 016 / 017.

### 2. 자산 이동 (git mv) + 이름 변경

| 출처 | 목적지 |
|---|---|
| `cj-oliveyoung-java-backend-prep/scripts/run_cj_foodville_bootcamp.sh` | `study-pack-batch/scripts/run_bootcamp_batch.sh` |

부트캠프 자산은 이 스크립트 1개뿐. study-pack-writer의 `resolve_study_pack_topic.py` / `run_study_pack.sh`를 호출자로 사용(이미 존재, 변경 없음).

### 3. 이동 스크립트 내부 path/이름 갱신

`run_bootcamp_batch.sh`(이동 후):

- `SUMMARY="$TASK_ROOT/data/runtime/cj-foodville-bootcamp-summary.md"` → `$TASK_ROOT/data/runtime/bootcamp-summary.md`. (회사명 제거.)
- `OUTDIR="$TASK_ROOT/data/reports/daily/${REPORT_DATE:-$(date +%F)}/cj-foodville-bootcamp"` → `$TASK_ROOT/data/reports/daily/${REPORT_DATE:-$(date +%F)}/bootcamp`. (회사명 제거.)
- `RESOLVER="$TASK_ROOT/skills/study-pack-writer/scripts/resolve_study_pack_topic.py"` / `RUNNER="$TASK_ROOT/skills/study-pack-writer/scripts/run_study_pack.sh"`: 변경 없음.
- 헤더 문자열 `"# 오늘의 CJ푸드빌 지원 대비 학습 추천"` → 회사 중립 문자열. config의 `bootcamp` namespace에서 `displayTitle` 또는 비슷한 키를 읽어 사람용 헤더로 사용하는 패턴이 plan002 phase-04에서 마련되어 있으면 그것을 사용. 없다면 하드코딩 대신 `"# 오늘의 부트캠프 추천 (${TASK_ROOT##*/})"` 같이 도메인-중립적으로 표현.

### 4. dispatcher 새 case

`command-router/scripts/run_now.sh`에 추가:

```
bootcamp-batch)
  run_tracked "career-os:bootcamp-batch" "부트캠프 일괄 study-pack" \
    "$TASK_ROOT/skills/study-pack-batch/scripts/run_bootcamp_batch.sh"
  ;;
```

usage 라인에 `bootcamp-batch` 추가.

## 검증 명령

```bash
# 1. 새 skill 구조
test -f career-os/skills/study-pack-batch/SKILL.md
test -f career-os/skills/study-pack-batch/scripts/run_bootcamp_batch.sh

# 2. 이전 위치 git에서 제거
[ -z "$(git ls-files career-os/skills/cj-oliveyoung-java-backend-prep/scripts/run_cj_foodville_bootcamp.sh)" ]

# 3. syntax
bash -n career-os/skills/study-pack-batch/scripts/run_bootcamp_batch.sh

# 4. 회사명 제거 확인 (스크립트 + 경로 + 사람용 메시지)
[ "$(grep -ci 'foodville\|cj-foodville\|cj푸드빌\|CJ푸드빌' career-os/skills/study-pack-batch/scripts/run_bootcamp_batch.sh)" = "0" ]
[ "$(grep -c 'cj-oliveyoung-java-backend-prep' career-os/skills/study-pack-batch/scripts/run_bootcamp_batch.sh)" = "0" ]

# 5. dispatcher 갱신
grep -q '^  bootcamp-batch)' career-os/skills/command-router/scripts/run_now.sh
grep -q 'skills/study-pack-batch/scripts/run_bootcamp_batch.sh' career-os/skills/command-router/scripts/run_now.sh
grep -q 'bootcamp-batch' career-os/skills/command-router/scripts/run_now.sh  # usage 라인 포함
bash -n career-os/skills/command-router/scripts/run_now.sh
```

검증 실패 시 `echo 'PHASE_FAILED: <식>' && exit 1`.

## 커밋

```
feat(career-os): study-pack-batch skill 신설 + dispatcher bootcamp-batch case

- skills/study-pack-batch/ 신설
- run_cj_foodville_bootcamp.sh → run_bootcamp_batch.sh로 이전(회사명 제거)
- 내부 산출물 경로·헤더 문자열도 회사명 중립화
- dispatcher 새 case bootcamp-batch 추가
- ADR-017 분해의 다섯 번째 단계 (WIP wire-up 1/3)
```

## 범위 외

- 다른 WIP 2개(live-coding-dispatch, auto-question-bank)는 phase-03 / phase-06.
- `config/topics.json`의 bootcamp namespace 데이터 변경은 plan002 phase-04 책임.
- `data/runtime/cj-foodville-bootcamp-summary.md` 같은 옛 산출물 파일이 working tree에 남아 있다면 본 phase에서 만지지 않는다(phase-07 cleanup).
