# Phase 01 — position daily runner workbench refresh 연결

**Model**: sonnet
**Status**: pending

---

## 목표

`position-recommender` daily runner가 최신 추천 리포트 생성 후 frontdoor queue와 priority snapshot까지 갱신하게 한다.
dashboard application workbench가 오래된 06-06 snapshot을 계속 보여주는 상태를 끊는다.

**범위 외**: 추천 알고리즘 변경, source adapter 추가, fos-career UI 변경, host-side processor wrapper 추가, docs/ADR 수정.

---

## 사전 cwd 설정

run-phases.py는 cwd=workspace로 phase를 실행한다.
본 phase는 ai-nodes 루트 기준 path를 사용하므로 첫 bash에서 cwd=ai-nodes 루트로 변경한다.

```bash
cd "$(git rev-parse --show-toplevel)"
pwd  # 기대: /home/bifos/ai-nodes
```

---

## 관련 docs

실행 전 반드시 읽는다.

- `career-os/docs/adr.md`의 ADR-078
- `career-os/docs/flow.md`의 position-recommender daily 흐름
- `career-os/docs/code-architecture.md`의 position-recommender와 application-agent 책임
- `career-os/docs/data-schema.md`의 frontdoor queue와 priority fields
- `career-os/tasks/plan050-position-priority-fit-workflow/index.json`

---

## 작업 항목

### 1. runner 갱신 지점 확인

`career-os/scripts/position-recommender/run_daily_with_claude.ts`에서 오늘 날짜 report/runtime freshness 검증이 끝난 뒤 Discord 알림 전에 실행되는 구간을 찾는다.
그 위치에 workbench refresh 단계를 추가한다.

### 2. frontdoor queue builder 호출

runner에서 `bun scripts/application-agent/frontdoor_queue_builder.ts --report data/runtime/position-recommendation.md --out data/runtime/application-agent/frontdoor-queue.jsonl`에 해당하는 호출을 실행한다.
기존 helper 패턴이 있으면 재사용한다.
child process 실패 시 runner도 실패해야 한다.

### 3. priority recommendation refresh 호출

frontdoor queue 갱신 성공 후 `bun scripts/application-agent/priority_recommendation.ts`를 실행한다.
이 스크립트는 user-confirmed priority를 보존하는 기존 로직을 사용해야 한다.
실패하면 runner도 실패해야 한다.

### 4. 검증용 dry-run 또는 env flag 검토

기존 runner에 dry-run 또는 notify dry-run 모드가 있으면 그 모드에서도 workbench refresh가 실행되는지 확인한다.
dry-run에서 실제 data 파일을 쓰면 안 된다는 기존 계약이 있으면 temp out path를 사용하도록 조정한다.
계약이 불명확하면 PHASE_BLOCKED로 보고한다.

### 5. 생성 queue sanity 확인

현재 `data/runtime/position-recommendation.md` 기준으로 queue builder를 temp 파일에 실행했을 때 06-12 추천 카드가 파싱되는지 확인한다.
실제 파일 갱신 검증은 runner smoke에서 수행한다.

### 6. phase commit

검증이 끝나면 career-os repo에서 의도한 변경만 stage한다.
commit 메시지는 `fix(career-os): position runner workbench snapshot 갱신 연결`을 사용한다.
unrelated apartment 변경은 stage하지 않는다.

---

## Critical Files

| 파일 | 변경 |
|---|---|
| `career-os/scripts/position-recommender/run_daily_with_claude.ts` | frontdoor/priority refresh 단계 추가 |
| `career-os/scripts/application-agent/frontdoor_queue_builder.ts` | 필요 시 CLI 계약 유지 보정 |
| `career-os/scripts/application-agent/priority_recommendation.ts` | 필요 시 CLI 계약 유지 보정 |

---

## 검증

보고 직전 반드시 아래 bash 블록을 실행하고 raw 값을 출력한다.

```bash
cd "$(git rev-parse --show-toplevel)"

bun --check career-os/scripts/position-recommender/run_daily_with_claude.ts
bun --check career-os/scripts/application-agent/frontdoor_queue_builder.ts
bun --check career-os/scripts/application-agent/priority_recommendation.ts

TMP_QUEUE=$(mktemp /tmp/plan070-frontdoor.XXXXXX.jsonl)
bun career-os/scripts/application-agent/frontdoor_queue_builder.ts \
  --report career-os/data/runtime/position-recommendation.md \
  --out "$TMP_QUEUE"
echo "[tmp queue count] $(wc -l <"$TMP_QUEUE")"
rg -n "쿠팡|카카오모빌리티|kakaopay|coupang" "$TMP_QUEUE"
rm -f "$TMP_QUEUE"

git -C career-os diff --check
git -C career-os status --short
```

가능하면 runner의 기존 dry-run 또는 validate mode도 실행한다.
모드가 없거나 실제 Discord 전송 위험이 있으면 실행하지 말고 이유를 보고한다.

---

## 성공 기준

- daily runner 성공 경로에 frontdoor queue refresh와 priority refresh가 포함된다.
- refresh 실패가 runner 실패로 전파된다.
- temp queue 검증에서 최신 추천 카드가 파싱된다.
- career-os 의도 변경이 한 커밋으로 저장된다.
- docs/ADR/정책 문서는 수정하지 않는다.

---

## PHASE_BLOCKED

다음 경우에는 반드시 Bash 도구로 직접 `echo 'PHASE_BLOCKED: ...' && exit 2`를 실행한다.

- runner의 dry-run 계약이 불명확해 실제 runtime 파일을 오염시킬 위험이 있다.
- frontdoor queue refresh와 priority refresh 순서를 docs/ADR 수정 없이 결정할 수 없다.
- protected status 또는 user-confirmed priority 보존 계약이 기존 코드에서 확인되지 않는다.

## PHASE_FAILED

다음 경우에는 반드시 Bash 도구로 직접 `echo 'PHASE_FAILED: ...' && exit 1`를 실행한다.

- refresh 실패가 runner 성공으로 숨는다.
- temp queue 검증에서 최신 추천 카드가 파싱되지 않는다.
- `bun --check` 또는 `git diff --check`가 실패한다.
- 의도한 career-os 변경을 커밋하지 않았다.
- docs/ADR/정책 문서를 수정했다.
