## ADR-084 — 수집 공고 lifecycle 검증과 자동 상태 전이는 fos-career DB 이벤트로 남긴다

- Status: Accepted
- Date: 2026-06-15

### 맥락

수집된 공고는 시간이 지나면 닫히거나 사라진다.
사람이 대시보드에서 명시적으로 닫거나, validator가 여러 수집 실행에서 보이지 않는 공고를 자동으로 닫아야 한다.
이미 닫힌 공고가 다시 수집되면 현재 수집 상태를 우선해 다시 열어야 한다.
상태 변경 이유와 이전 상태는 추적 가능해야 한다.

### 결정

- `collected_positions.postingStatus`를 공고 현재 상태 정본으로 직접 갱신한다. 별도 override table로 덮어쓰지 않는다.
- 상태 변경 이력은 전용 이벤트 테이블에 남기며, 수동/자동 구분과 before/after status, reason, source 정보를 포함한다.
- validator는 기본 dry-run으로 실행하고, 실제 상태 변경은 명시적 옵션을 붙였을 때만 수행한다.
- 자동 닫기는 여러 수집 실행에서 미등장 + source diagnostics가 정상 계열일 때만 수행한다.
  source 장애나 parser 변경 계열이면 자동 닫지 않고 skipped 이벤트만 남긴다.
- 한 번에 자동으로 닫는 공고 수에 상한을 두어 대량 오판을 방지한다.
- 이미 닫힌 공고가 다시 수집되면 새 snapshot 상태로 자동 복구하고 이벤트로 남긴다.

거절한 대안:

- 별도 override table로 상태 덮어쓰기: 현재 상태를 알려면 두 테이블을 조인해야 해서 조회가 복잡해진다.

### 결과

- 수동 상태 변경과 자동 상태 변경이 같은 이벤트 모델로 추적된다.
- validator는 기본적으로 안전한 dry-run으로 실행된다.
- source 장애를 closed로 오판하는 위험이 줄어든다.
- 단점: validator가 상태를 직접 변경하므로 검증 기준과 source diagnostics 품질이 중요해진다.
