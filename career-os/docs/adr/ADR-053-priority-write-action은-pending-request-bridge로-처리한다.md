## ADR-053 — priority write action은 pending request bridge로 처리한다

- Status: Accepted
- Date: 2026-06-07

### 맥락

fos-career는 career-os를 read-only mount로 읽도록 배포되어 있다.
dashboard container가 `frontdoor-queue.jsonl`이나 `ledger.jsonl`을 직접 쓰면 UI bug, auth bug, stale 화면 제출이 원장 오염으로 이어질 수 있다.
career-os에는 이미 `application-agent confirm-priority` 명령이 있어 원장 mutation을 담당하므로, 새 쓰기 경로는 이 명령을 우회하면 안 된다.

### 결정

- fos-career는 priority write action을 직접 적용하지 않고 MySQL pending queue에 저장한다.
- 요청 row에는 요청 당시 record snapshot을 저장한다.
  적용 runner는 현재 record와 snapshot을 비교해 stale request를 막는다.
- career-os 파일 mutation은 writable checkout에서 실행되는 controlled runner만 수행한다.
  runner는 기존 `application-agent confirm-priority` 명령을 사용한다.
- 되돌림은 JSONL rewrite가 아니라 새 user confirmation event로 처리한다.

거절한 대안:

- career-os HTTP API service: 인증, 네트워크 노출, long-running 운영 비용이 MVP보다 크다.
- dashboard container writable mount: read-only safety boundary를 깨며 실수의 영향 범위가 크다.
- fos-career direct JSONL writer: career-os schema validation과 priority history helper를 우회한다.
- LLM chat tool call mutation: 사용자 확인, idempotency, rollback 검증이 흐려진다.

### 결과

- fos-career는 UI와 요청 감사 이력을 맡고, career-os는 실제 원장 mutation을 계속 소유한다.
- read-only mount 배포 가정이 유지된다.
- pending queue로 인해 적용 전 검토, stale 감지, 실패 재시도, 취소가 가능하다.
- 단점: request 생성과 적용이 분리되어 즉시 반영 UI보다 한 단계 느리다.
