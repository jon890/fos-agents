# Phase 1 — command-router scripts/ 이동 + 외부 caller / SKILL.md 일괄 갱신

## 목표

dispatcher 본체(`run_now.sh` + `notify_discord.sh` + `setup_env.sh`)를 `skills/command-router/scripts/`에서 `scripts/command-router/`로 이동. 이전 위치를 가리키던 **모든 외부 caller**(다른 skill의 SKILL.md, fos-study-pack의 `run_from_request.sh`)를 새 경로로 일괄 갱신. command-router 자체의 SKILL.md도 새 위치 표기로.

ADR-019 5개 phase 중 첫 번째. dispatcher 자체의 내부 case path는 본 phase에서 건드리지 않음(다음 phase~03에서 각 case 도메인 처리 시 같이 갱신).

## 의존성 / 가정

- plan005-cj-oliveyoung-decomposition `status: completed`. 11개 skill 디렉터리 구조 확정.
- working tree clean (이전 plan의 trailing cleanup 완료).
- `career-os/scripts/` 디렉터리는 아직 존재하지 않음 — 본 phase가 처음 생성.

## 작업

### 1. 새 디렉터리 생성

```
career-os/scripts/
career-os/scripts/command-router/
```

`mkdir -p` 사용.

### 2. dispatcher 본체 자산 이동 (git mv)

| 출처 | 목적지 |
|---|---|
| `career-os/skills/command-router/scripts/run_now.sh` | `career-os/scripts/command-router/run_now.sh` |
| `career-os/skills/command-router/scripts/notify_discord.sh` | `career-os/scripts/command-router/notify_discord.sh` |
| `career-os/skills/command-router/scripts/setup_env.sh` | `career-os/scripts/command-router/setup_env.sh` |

이동 후 `skills/command-router/scripts/`는 빈 폴더 — 본 phase에서는 그대로 두고 phase-04에서 일괄 정리.

### 3. dispatcher 본체 자기 path 참조 갱신

`scripts/command-router/run_now.sh` 안에서:

- `NOTIFY_SCRIPT="$TASK_ROOT/skills/command-router/scripts/notify_discord.sh"` → `$TASK_ROOT/scripts/command-router/notify_discord.sh`.

case 내부 runner path는 본 phase에서 건드리지 않음(phase-02/03에서 각 skill 이동 시 같이 갱신).

### 4. 외부 caller 일괄 갱신

`skills/command-router/scripts/run_now.sh`를 `scripts/command-router/run_now.sh`로 치환. 스캔 명령:

```bash
grep -rln 'skills/command-router/scripts/run_now.sh' career-os/ \
  --include='*.md' --include='*.sh' --include='*.py' \
  | grep -v 'tasks/' | grep -v 'docs/' | grep -v 'AGENTS.md' | grep -v 'CLAUDE.md'
```

위 결과에 등장하는 **모든 파일**을 갱신 대상에 포함. plan005 phase-01에서 갱신한 7개 외부 caller(fos-study-pack/SKILL.md / run_from_request.sh / cj-foodville-coffeechat-prep/SKILL.md / study-pack-writer/SKILL.md / study-pack-maintainer/SKILL.md / interview-master-writer/SKILL.md / position-recommender/SKILL.md)가 후보. plan005~plan006 사이에 추가된 caller가 있을 수 있으니 스캔 결과를 진실 출처로 본다.

### 5. command-router SKILL.md 위치 안내 갱신

`career-os/skills/command-router/SKILL.md`의 본문 안에서 "scripts는 어디 있는가" 안내 라인이 있다면 새 위치(`scripts/command-router/`)로 갱신. 없으면 한 줄 추가 — "실행 파일은 `career-os/scripts/command-router/`(ADR-019)".

## 검증 명령

```bash
# 1. 새 위치 존재
test -f career-os/scripts/command-router/run_now.sh
test -f career-os/scripts/command-router/notify_discord.sh
test -f career-os/scripts/command-router/setup_env.sh

# 2. 이전 위치 git에서 제거
[ -z "$(git ls-files career-os/skills/command-router/scripts/run_now.sh)" ]
[ -z "$(git ls-files career-os/skills/command-router/scripts/notify_discord.sh)" ]
[ -z "$(git ls-files career-os/skills/command-router/scripts/setup_env.sh)" ]

# 3. syntax
bash -n career-os/scripts/command-router/run_now.sh
bash -n career-os/scripts/command-router/notify_discord.sh
bash -n career-os/scripts/command-router/setup_env.sh

# 4. dispatcher NOTIFY_SCRIPT 갱신
grep -q 'scripts/command-router/notify_discord.sh' career-os/scripts/command-router/run_now.sh

# 5. 외부 caller 잔재 0
[ "$(grep -rln 'skills/command-router/scripts/run_now.sh' career-os/ \
       --include='*.md' --include='*.sh' --include='*.py' \
     | grep -v 'tasks/' | grep -v 'docs/' | grep -v 'AGENTS.md' | grep -v 'CLAUDE.md' | wc -l)" = "0" ]

# 6. 변경된 caller syntax 보존
bash -n career-os/skills/fos-study-pack/scripts/run_from_request.sh
```

검증 실패 시 `echo 'PHASE_FAILED: <식>' && exit 1`.

## 커밋

```
refactor(career-os): dispatcher 본체를 scripts/command-router/로 이동 + 외부 caller 일괄 갱신

- skills/command-router/scripts/{run_now,notify_discord,setup_env}.sh → scripts/command-router/
- dispatcher 자기 NOTIFY_SCRIPT 경로를 새 위치로
- 외부 caller(다른 skill SKILL.md, run_from_request.sh 등) path 일괄 갱신
- dispatcher 내부 case path는 phase-02/03에서 각 skill 이동 시 갱신
- ADR-019 적용의 첫 단계
```

## 범위 외

- dispatcher 내부 case path 갱신(phase-02/03).
- 다른 skill의 scripts/ 이동(phase-02/03).
- 빈 `skills/command-router/scripts/` 디렉터리 정리(phase-04).
- ai-nodes/CLAUDE.md path 갱신은 planning 단계 docs commit에서 이미 처리됨.
