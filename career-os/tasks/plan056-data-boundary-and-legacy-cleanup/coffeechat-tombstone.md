# plan056 phase-04 coffeechat tombstone 결정

날짜: 2026-06-07
Worktree: `/home/bifos/ai-nodes-worktrees/plan056-complete`

## 범위

이 phase는 coffeechat reference와 tombstone 파일을 검토했다.
`.claude/skills/interview-coffeechat-prep` 또는 `scripts/interview-coffeechat-prep`를 수정하거나 삭제하지 않았다.

## reference 분류

active replacement path:

- `AGENTS.md`는 `/interview-prep-analyzer`를 현재 interview prep entrypoint로 적고 있다.
- `docs/flow.md`는 first-round, final-round, offer-chat을 `interview-prep-analyzer`로 라우팅한다.
- `.claude/skills/interview-prep-analyzer/SKILL.md`는 coffeechat 요청을 표준 양식으로 가정하지 않고, 회사, 참석자, 목적 context가 빠졌는지 확인하도록 명시한다.
- `scripts/interview-prep-analyzer/collect_interview_sites.ts`는 coffeechat을 지원 mode에서 제외한다.

tombstone reference:

- `.claude/skills/interview-coffeechat-prep/SKILL.md`
- `scripts/interview-coffeechat-prep/collect_company_sites.ts`
- `docs/flow.md`의 deprecated entrypoint note.
- `docs/code-architecture.md`의 deprecated tombstone tree note.

historical/archive reference:

- `docs/adr.md` ADR-029, ADR-034, and ADR-048.
- `tasks/plan021-*`, `tasks/plan028-*`, and `tasks/plan041-*`.
- 오래된 coffeechat runner 또는 skill을 history로 언급하는 task 파일.

compatibility-only config reference:

- `config/mvp-target.json` keeps `primary.interview.coffeechat` as `null`.
- `scripts/interview-prep-analyzer/mvp_target_schema.ts`는 compatibility를 위해 nullable `coffeechat`을 허용한다.

`/interview-coffeechat-prep`를 live automation path로 호출하는 active caller는 찾지 못했다.

## tombstone 상태

skill tombstone:

- 경로: `.claude/skills/interview-coffeechat-prep/SKILL.md`
- 상태: 명시적 deprecated tombstone.
- 동작: 이 entrypoint에서 coffeechat strategy report를 생성하지 말라고 agent에 안내한다.
- 대체 경로: first-round, final-round, offer-stage preparation은 `/interview-prep-analyzer`를 사용한다.

script tombstone:

- 경로: `scripts/interview-coffeechat-prep/collect_company_sites.ts`
- 상태: 명시적 deprecated compatibility tombstone.
- 동작: deprecation guidance를 출력하고 exit code `1`로 종료한다.
- 대체 경로: `scripts/interview-prep-analyzer/collect_interview_sites.ts --mode <first-round|final-round|offer-chat>`.

## plan041 metadata 확인

`tasks/plan041-interview-coffeechat-deprecation/index.json` is completed.
index 안의 phase 5개도 모두 completed다.

하지만 phase body header는 아직 pending이라고 적혀 있다.

- `phase-01.md`: pending
- `phase-02.md`: pending
- `phase-03.md`: pending
- `phase-04.md`: pending
- `phase-05.md`: pending

이는 metadata/body mismatch다.
index summary와 현재 active docs가 completed deprecation을 반영하므로 plan041 실패를 의미하지는 않는다.
다만 future audit이 phase body를 직접 읽을 수 있으므로 기록해둔다.

권장 처리:

- 이 phase에서는 plan041을 수정하지 않는다.
- 나중에 metadata hygiene cleanup에서 `**Status**` header만 completed로 바꾼다.
- 나머지 phase body text는 historical execution contract로 그대로 둔다.

## 결정

권장 결정은 coffeechat tombstone 2개를 한 release cycle 더 유지하는 것이다.

이유:

- tombstone은 deprecated automation이 실수로 되살아나는 것을 막는다.
- 아직 old path를 찾는 agent 또는 script에 명확한 대체 안내를 남긴다.
- active behavior는 이미 reusable interview preparation을 `interview-prep-analyzer`로 라우팅한다.
- 지금 tombstone을 제거하면 historical reference가 조용히 실패하거나 해석하기 어려워진다.

아래 zero-caller check를 다시 통과한 뒤 제거를 검토할 수 있다.

- active docs가 `/interview-coffeechat-prep`를 홍보하지 않는다.
- runner가 `scripts/interview-coffeechat-prep/collect_company_sites.ts`를 호출하지 않는다.
- `mvp-target.json`이 non-null coffeechat block을 다시 도입하지 않는다.
- `interview-prep-analyzer`가 first-round, final-round, offer-chat prep을 계속 담당한다.

## ADR-only 전환 선택지

다음 cleanup window에서 제거가 승인되면 비파괴 전환을 사용한다.

1. skill tombstone과 script tombstone을 task-local evidence 또는 `data/private/archive/plan041/`로 옮긴다.
2. `docs/code-architecture.md`와 `docs/flow.md`가 ADR-048만 가리키도록 갱신한다.
3. ADR-048을 coffeechat automation retired 이유의 단일 출처로 둔다.
4. active replacement guidance가 여전히 `interview-prep-analyzer`를 언급하는지 확인한다.

deprecation message를 검색 가능한 곳에 먼저 보존하지 않고 tombstone을 삭제하지 않는다.

## rollback

tombstone 제거 뒤 hidden caller가 깨지면 tombstone 파일이 있던 마지막 commit에서 파일을 복원한다.
coffeechat automation behavior는 복원하지 않는다.

rollback 대상은 deprecation guard뿐이다.

- `.claude/skills/interview-coffeechat-prep/SKILL.md`
- `scripts/interview-coffeechat-prep/collect_company_sites.ts`

그다음 caller를 `interview-prep-analyzer`로 라우팅하거나, coffeechat-specific automation assumption이 남아 있으면 blocked로 표시한다.
