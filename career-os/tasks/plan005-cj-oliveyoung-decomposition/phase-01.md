# Phase 1 — command-router skill 신설 + 외부 caller path 일괄 갱신

## 목표

dispatcher 본체(`run_now.sh`)와 `notify_discord.sh` / `setup_env.sh`를 `skills/command-router/`로 이동. 이전 위치(`cj-oliveyoung-java-backend-prep/scripts/run_now.sh`)를 직접 참조하던 **모든 외부 caller**(다른 skill의 SKILL.md, fos-study-pack의 `run_from_request.sh`)를 새 path로 일괄 갱신.

이번 phase에서 dispatcher case 내부 path는 **갱신하지 않는다** — 각 case는 그 도메인 skill을 분리하는 phase(02~05) 또는 새 case 추가 phase(03/05/06)에서 자기 case path를 함께 갱신한다. 본 phase가 끝나면 dispatcher는 `command-router/scripts/run_now.sh`에 있고, 그 내부 case들은 여전히 `cj-oliveyoung-java-backend-prep/scripts/run_baseline.sh` 같은 옛 경로를 가리킨다. **이 시점에 실제 실행하면 dispatcher 자기 `NOTIFY_SCRIPT`는 새 위치를 가리키지만 11개 case runner는 옛 위치를 호출** — phase-02 시작 전까지의 의도된 중간 상태.

## 의존성 / 가정

- plan002-config-consolidation + plan004-shared-helpers-ts 모두 `status: completed`.
- working tree clean(main).
- `career-os/AGENTS.md`와 docs/는 planning 단계에서 이미 ADR-017을 반영해 갱신된 상태(본 plan 첫 커밋). phase에서는 코드 caller만 손댄다.

## 작업

### 1. 새 skill 디렉터리 + SKILL.md

```
career-os/skills/command-router/
├── SKILL.md
└── scripts/
```

`SKILL.md`:
- `name: command-router`
- `description`: "career-os의 14개 dispatch 명령 단일 진입점. `_shared/bin/track_task.sh`로 모든 runner 래핑, 자동 Discord 알림 + cost summary 부착. 직접 호출하지 말 것 — 일상 운영은 `run_now.sh <command>` 경유."
- `notify_discord.sh`와 `setup_env.sh`가 dispatcher와 한 폴더에 있는 이유: 셋 다 dispatcher 동작에 직결되는 부속 자산이라 응집도가 높음.
- 관련 ADR: 008(알림), 014(usage 전파), 017(분해).

### 2. 자산 이동 (git mv)

| 출처 | 목적지 |
|---|---|
| `cj-oliveyoung-java-backend-prep/scripts/run_now.sh` | `command-router/scripts/run_now.sh` |
| `cj-oliveyoung-java-backend-prep/scripts/notify_discord.sh` | `command-router/scripts/notify_discord.sh` |
| `cj-oliveyoung-java-backend-prep/scripts/setup_env.sh` | `command-router/scripts/setup_env.sh` |

### 3. dispatcher 본체 자기 path 참조 갱신

`command-router/scripts/run_now.sh` 안에서:

- `NOTIFY_SCRIPT="$TASK_ROOT/skills/cj-oliveyoung-java-backend-prep/scripts/notify_discord.sh"` → `$TASK_ROOT/skills/command-router/scripts/notify_discord.sh`.

case 내부의 runner path(`run_baseline.sh` 등)는 **건드리지 않는다** — phase-02~06 각각이 자기 case를 갱신.

### 4. 외부 caller 일괄 갱신

다음 파일들에서 `skills/cj-oliveyoung-java-backend-prep/scripts/run_now.sh`를 `skills/command-router/scripts/run_now.sh`로 치환. grep으로 잔재 0 확인.

- `career-os/skills/fos-study-pack/SKILL.md`
- `career-os/skills/fos-study-pack/scripts/run_from_request.sh`
- `career-os/skills/cj-foodville-coffeechat-prep/SKILL.md`
- `career-os/skills/study-pack-writer/SKILL.md`
- `career-os/skills/study-pack-maintainer/SKILL.md`
- `career-os/skills/interview-master-writer/SKILL.md`
- `career-os/skills/position-recommender/SKILL.md`

이동 작업 시작 전에 다음으로 누락 파일을 한 번 더 스캔(plan002 또는 다른 plan이 새 caller를 추가했을 가능성):

```bash
grep -rln 'skills/cj-oliveyoung-java-backend-prep/scripts/run_now.sh' career-os/ \
  --include='*.md' --include='*.sh' --include='*.py' \
  | grep -v 'tasks/' | grep -v 'docs/' | grep -v 'AGENTS.md' | grep -v 'CLAUDE.md'
```

위 결과에 등장하는 모든 파일을 갱신 대상에 포함.

### 5. 이전 위치의 cj-oliveyoung 폴더 SKILL.md 정리

`cj-oliveyoung-java-backend-prep/SKILL.md`는 본 plan005가 끝나면 폴더 자체가 사라진다(phase-07). 본 phase에서는 굳이 만지지 않는다 — phase-07에서 git rm으로 폴더 통째 제거.

## 검증 명령

```bash
# 1. 새 skill 구조
test -f career-os/skills/command-router/SKILL.md
test -f career-os/skills/command-router/scripts/run_now.sh
test -f career-os/skills/command-router/scripts/notify_discord.sh
test -f career-os/skills/command-router/scripts/setup_env.sh

# 2. 이전 위치 git에서 제거
[ -z "$(git ls-files career-os/skills/cj-oliveyoung-java-backend-prep/scripts/run_now.sh)" ]
[ -z "$(git ls-files career-os/skills/cj-oliveyoung-java-backend-prep/scripts/notify_discord.sh)" ]
[ -z "$(git ls-files career-os/skills/cj-oliveyoung-java-backend-prep/scripts/setup_env.sh)" ]

# 3. syntax
bash -n career-os/skills/command-router/scripts/run_now.sh
bash -n career-os/skills/command-router/scripts/notify_discord.sh
bash -n career-os/skills/command-router/scripts/setup_env.sh

# 4. dispatcher의 NOTIFY_SCRIPT 갱신됨
grep -q 'skills/command-router/scripts/notify_discord.sh' career-os/skills/command-router/scripts/run_now.sh

# 5. 외부 caller 모두 갱신됨 — 잔재 0
[ "$(grep -rln 'skills/cj-oliveyoung-java-backend-prep/scripts/run_now.sh' career-os/ \
       --include='*.md' --include='*.sh' --include='*.py' \
     | grep -v 'tasks/' | grep -v 'docs/' | grep -v 'AGENTS.md' | grep -v 'CLAUDE.md' | wc -l)" = "0" ]

# 6. 변경된 caller들 syntax 보존
bash -n career-os/skills/fos-study-pack/scripts/run_from_request.sh
```

검증 실패 시 `echo 'PHASE_FAILED: <식>' && exit 1`.

## 커밋

```
refactor(career-os): dispatcher를 command-router skill로 분리 + 외부 caller path 일괄 갱신

- skills/command-router/ 신설 (SKILL.md + run_now.sh + notify_discord.sh + setup_env.sh)
- dispatcher 자기 NOTIFY_SCRIPT 경로를 command-router로 갱신
- 외부 caller 7+ 파일의 dispatcher 경로 일괄 갱신
- dispatcher 내부 case path는 phase-02~06에서 각 도메인 skill 분리 시 갱신
- ADR-017 분해의 첫 단계
```

## 범위 외

- dispatcher 내부 11개 case의 runner path 갱신(각 phase에서 자기 도메인 처리).
- 새 case 3개(bootcamp-batch / live-coding-dispatch / auto-question-bank) 추가(phase-03/05/06).
- `cj-oliveyoung-java-backend-prep/` 폴더 자체 제거(phase-07).
- 도메인 helper py(`refresh_topic_inventory.py` 등)는 본 phase에서 손대지 않는다.
