# Phase 07 — ledger → positions-queue 코드 rename

**Model**: sonnet
**Status**: pending

## 목표

`ledger` 코드 심볼·파일명을 `positions-queue`로 rename (decisions.md 용어표·M2=A 준수).

## 중요 지침

구현 phase다. docs·ADR을 수정하지 않는다. Phase 01 ADR·이동표를 벗어나면 PHASE_BLOCKED.
tracked 코드 파일이므로 **git mv로 이력 보존**한다.
**이 phase는 Phase 06(frontdoor 제거) 뒤에 온다** — frontdoor 파일이 이미 제거됐으므로 `./ledger_io`·`./ledger_schema`를 import하던 frontdoor 잔존이 없어 rename 시 dangling import가 생기지 않는다.

## 작업

- git mv: `scripts/application-agent/ledger_io.ts`→`positions_queue_io.ts`, `ledger_schema.ts`→`positions_queue_schema.ts`.
- 심볼 rename: `Ledger*`·`DEFAULT_LEDGER_PATH`·`ledgerPath` 등 식별자를 `positionsQueue`/`PositionsQueue` 계열로 일관 rename. 경로 문자열 default는 Phase 02에서 정한 `state/positions-queue.jsonl` 사용.
- import 참조 갱신: `ledger_io`/`ledger_schema`를 import하는 **잔존 tracked .ts 전부**(actions·apply_position_action_request·apply_priority_request·ingest_position_report·policy·priority_recommendation·priority_view·progress_notifier·run·skill_executor·agent_decision_schema 등)의 import 경로·심볼 갱신. (frontdoor 파일은 Phase 06에서 이미 제거됨)
- run.ts의 `--ledger` CLI 옵션·help 문구를 새 용어로 갱신(호환 필요 시 결정은 Phase 01 ADR 따름).

## 성공 기준

- `ledger_io.ts`·`ledger_schema.ts`가 `positions_queue_*`로 git mv됐다(이력 보존).
- live scripts에 `ledger` 코드 식별자(`ledger_io`·`ledger_schema`·`Ledger`·`DEFAULT_LEDGER_PATH`) 참조 0(tasks/·frozen ADR 제외).
- 변경 .ts 전부 `bun --check` 통과 + application-agent `run.ts --help` 등 진입점이 크래시 없이 로드된다.

## 실패 조건

- import·심볼 rename 누락으로 `bun --check`가 깨지면 실패.
- 코드 파일을 git mv 없이 옮겨 이력이 끊기면 실패.
