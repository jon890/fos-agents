# Phase 6 — experience-question-bank-writer에 auto-question-bank 흡수 + dispatcher 새 case

## 목표

WIP였던 `run_morning_question_bank.sh`(기본 경험 question-bank topic 자동 재생성 wrapper)를 기능적 자매 skill `skills/experience-question-bank-writer/`에 흡수. 시점명 morning 제거 → `run_question_bank_auto.sh`. dispatcher에 새 case `auto-question-bank` 추가.

ADR-017로 결정된 WIP 3개 wire-up의 마지막.

## 의존성 / 가정

- phase-01~05 완료. dispatcher / question-bank case 자체는 phase-01에서 외부 caller 갱신 완료. experience-question-bank-writer skill은 기존 위치 그대로(이 plan에서 분해 대상 아님 — 흡수만).
- working tree clean.

## 작업

### 1. 자산 이동 (git mv) + 이름 변경

| 출처 | 목적지 |
|---|---|
| `cj-oliveyoung-java-backend-prep/scripts/run_morning_question_bank.sh` | `experience-question-bank-writer/scripts/run_question_bank_auto.sh` |

### 2. 이동 스크립트 내부 path 갱신

`run_question_bank_auto.sh` 안:

- `NOTIFY_SCRIPT="$TASK_ROOT/skills/cj-oliveyoung-java-backend-prep/scripts/notify_discord.sh"` → `$TASK_ROOT/skills/command-router/scripts/notify_discord.sh`.
- `bash "$TASK_ROOT/skills/cj-oliveyoung-java-backend-prep/scripts/run_now.sh" question-bank "$TOPIC"` → `bash "$TASK_ROOT/skills/command-router/scripts/run_now.sh" question-bank "$TOPIC"`.
- 사람용 메시지 `[시작] / [완료] / [실패] ${TOPIC} 면접 질문팩 ...`는 그대로 유지(시점이 아닌 기능 진행 알림).

### 3. experience-question-bank-writer SKILL.md 갱신

해당 SKILL.md에 새 스크립트 등재. 기존 entry point `run_question_bank.sh`와 새 wrapper `run_question_bank_auto.sh`의 차이 한 줄 설명:
- `run_question_bank.sh` — dispatcher의 `question-bank <topic>` case에서 직접 호출. resolver로 topic 파라미터 받음.
- `run_question_bank_auto.sh` — dispatcher의 `auto-question-bank` case에서 호출. 기본 topic(`experience-qbank-ai-service-team` 또는 `QUESTION_BANK_TOPIC_OVERRIDE`)을 dispatcher question-bank case에 위임하는 알림 wrapper.

### 4. dispatcher 새 case

`command-router/scripts/run_now.sh`에 추가:

```
auto-question-bank)
  run_tracked "career-os:auto-question-bank" "auto question-bank refresh" \
    "$TASK_ROOT/skills/experience-question-bank-writer/scripts/run_question_bank_auto.sh"
  ;;
```

usage 라인에 `auto-question-bank` 추가.

`run_question_bank_auto.sh`가 `run_tracked` 안에서 다시 `bash run_now.sh question-bank ...`를 부르는 구조: 이 재진입은 의도된 행위(wrapper가 question-bank의 알림·publish 로직을 그대로 활용). `run_tracked`의 중첩 호출이 `track_task.sh` 메트릭에 중복 row를 만들지 점검:
- 바깥 호출: `career-os:auto-question-bank` 이름
- 안쪽 호출: `career-os:question-bank:$TOPIC` 이름
별도 task_name으로 기록되므로 중복 row가 아닌 부모-자식 의도된 두 entry. 본 phase에서는 그 상태를 유지(설계상 의도, 별도 ADR로 정리할 일 아님).

## 검증 명령

```bash
# 1. 새 위치 존재
test -f career-os/skills/experience-question-bank-writer/scripts/run_question_bank_auto.sh

# 2. 이전 위치 git에서 제거
[ -z "$(git ls-files career-os/skills/cj-oliveyoung-java-backend-prep/scripts/run_morning_question_bank.sh)" ]

# 3. syntax
bash -n career-os/skills/experience-question-bank-writer/scripts/run_question_bank_auto.sh

# 4. 내부 path가 command-router 직접 참조
grep -q 'skills/command-router/scripts/notify_discord.sh' career-os/skills/experience-question-bank-writer/scripts/run_question_bank_auto.sh
grep -q 'skills/command-router/scripts/run_now.sh' career-os/skills/experience-question-bank-writer/scripts/run_question_bank_auto.sh
[ "$(grep -c 'cj-oliveyoung-java-backend-prep' career-os/skills/experience-question-bank-writer/scripts/run_question_bank_auto.sh)" = "0" ]

# 5. dispatcher 갱신
grep -q '^  auto-question-bank)' career-os/skills/command-router/scripts/run_now.sh
grep -q 'skills/experience-question-bank-writer/scripts/run_question_bank_auto.sh' career-os/skills/command-router/scripts/run_now.sh
grep -q 'auto-question-bank' career-os/skills/command-router/scripts/run_now.sh  # usage 라인 포함
bash -n career-os/skills/command-router/scripts/run_now.sh

# 6. SKILL.md에 새 스크립트 등재
grep -q 'run_question_bank_auto.sh' career-os/skills/experience-question-bank-writer/SKILL.md
```

검증 실패 시 `echo 'PHASE_FAILED: <식>' && exit 1`.

## 커밋

```
feat(career-os): experience-question-bank-writer에 auto-question-bank 흡수

- run_morning_question_bank.sh → experience-question-bank-writer/scripts/run_question_bank_auto.sh로 이전
- 시점명 morning 제거, 기능명 강조
- 내부 NOTIFY_SCRIPT / run_now.sh 참조를 command-router로 갱신
- experience-question-bank-writer/SKILL.md에 새 스크립트 등재
- dispatcher 새 case auto-question-bank 추가
- ADR-017 분해의 여섯 번째 단계 (WIP wire-up 3/3)
```

## 범위 외

- experience-question-bank-writer skill 자체 분해/이름 변경(본 plan 대상 아님).
- 사용자 노트·잠금 파일명 변경 X.
