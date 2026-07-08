# Phase 07 — frontdoor 코드 제거 + 승격→등록 용어

**Model**: sonnet
**Status**: pending

## 목표

frontdoor-queue 코드를 제거하고 "승격(promote)"→"등록" 용어를 코드·산문 전반에서 정리 (decisions.md 용어표·M2=A 준수).

## 중요 지침

구현 phase다. docs·ADR을 수정하지 않는다. Phase 01 ADR·이동표를 벗어나면 PHASE_BLOCKED.
frontdoor는 application-agent flow 8+ 파일에 얽혀 있다 — 단순 파일 삭제가 아니라 호출 흐름을 끊어야 한다. 흐름 검증을 성공 기준으로 둔다.

## 작업

- git rm: `scripts/application-agent/frontdoor_queue_builder.ts`·`frontdoor_queue_io.ts`·`frontdoor_queue_schema.ts`·`promote_frontdoor_candidate.ts`.
- 호출부 정리: `apply_position_action_request`·`apply_priority_request`·`priority_recommendation`·`priority_view`·`run.ts`·`position_action_request_schema`·`priority_request_schema`·`priority_history` 등에서 frontdoor/promote 의존을 제거하고 "추천 → 선택 → positions-queue 등록" 흐름으로 정리.
- 용어 교체: 코드 식별자·주석·docs·SKILL 산문의 "승격/promote"를 "등록"으로 교체(frontdoor 대기열 폐기 맥락).

## 성공 기준

- frontdoor 코드 4파일이 git rm됐고, live scripts에 `frontdoor`·`promote_frontdoor` 참조 0(tasks/·frozen ADR 제외).
- live docs·SKILL·코드에 "승격/promote" 용어 잔존 0(등록으로 교체; tasks/·frozen ADR 제외).
- 변경 .ts 전부 `bun --check` 통과 + application-agent 진입점(run.ts)이 frontdoor 없이 크래시 없이 로드·기본 흐름 동작.

## 실패 조건

- frontdoor 제거 후 dangling import·미정의 참조로 `bun --check`가 깨지면 실패.
- application-agent 기본 흐름이 frontdoor 부재로 깨지면 실패.
