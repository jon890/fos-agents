# Phase 04. 아침 읽을거리 CLI의 현재 경로 오류를 검사한다

**Execution profile**: standard

## 목표

추천 실행 경로가 없으면 네트워크 요청 전에 사용법 오류로 끝난다는 계약을 현재 인자로 검사한다.

## 컨텍스트

`career-os/scripts/lib/cli-contract.test.ts`의 경로 검사에는 제거된 `--library`가 남아 있다.
`career-os/scripts/study-topic-recommender/morning_reading_cli.test.ts`는 그 옵션을 사용법 오류로 다룬다.

## 작업 항목

1. `cli-contract.test.ts`에서 아침 읽을거리 경로 검사 인자의 `--library`를 제거한다.
2. `morning_reading_cli.ts`와 `build_morning_reading.ts`를 현재 인자로 각각 실행해 경로 오류가 네트워크보다 먼저 발생하는지 확인하고, 실제 메시지를 정확히 단언한다.
3. 저장소 루트에서 `PATH="$HOME/.bun/bin:$PATH" bun test career-os/scripts`를 실행해 실패 0건, 기존 skip 1건을 확인한다. `PATH="$HOME/.bun/bin:$PATH" bunx tsc --noEmit`도 실행한다.

## 전체 완료 표시

전체 검증이 통과하면 `career-os/tasks/plan130-hermes-skill-paths/index.json`의 `status`를 `completed`, `current_phase`를 `4`로 바꾼다.
수정 뒤 JSON 형식을 읽고 두 필드의 값을 확인한다.

## 범위와 검증

수정 파일은 `career-os/scripts/lib/cli-contract.test.ts`와 `career-os/tasks/plan130-hermes-skill-paths/index.json`이다.
프로덕션 CLI와 Backend, 운영 상태는 바꾸지 않는다.
