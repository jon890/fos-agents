## ADR-077 — position daily runner는 Claude 무출력 hang을 실패로 처리한다

- Status: Accepted
- Date: 2026-06-12

### 맥락

KakaoPay official source 확장 후 수집 snapshot은 정상 생성됐지만,
최종 LLM 추천 리포트 생성에서 Claude가 6분 넘게 무출력으로 실행되고 오늘 report/runtime을 갱신하지 않는 사례가 있었다.
기존 TS runner는 `spawnSync`와 `stdio: inherit`로 Claude 종료만 기다렸기 때문에 cron에서도 같은 상태로 오래 물릴 수 있었다.

### 결정

- runner가 Claude 호출을 직접 감시한다.
- Claude 호출은 `--output-format stream-json --include-partial-messages --verbose`를 사용해 진행 출력이 타이머를 갱신할 수 있게 한다.
- raw stream-json은 기본적으로 cron 로그에 흘리지 않고, 30초 간격 진행 표시만 남긴다.
  디버깅이 필요하면 `POSITION_RECOMMENDER_CLAUDE_LOG_STREAM=1`로 원문 stream을 출력한다.
- 기본 총 실행 제한은 `POSITION_RECOMMENDER_CLAUDE_TIMEOUT_MS=540000`이다.
- 기본 무출력 제한은 `POSITION_RECOMMENDER_CLAUDE_NO_OUTPUT_MS=240000`이다.
- stdout/stderr 출력이 있으면 무출력 타이머를 갱신한다.
- 제한을 넘기면 Claude에 `SIGTERM`을 보내고, 짧은 유예 후에도 종료되지 않으면 `SIGKILL`을 보낸다.
- Claude가 종료되더라도 오늘 날짜 report/runtime freshness 검증과 active/open direct posting 검증을 통과하지 못하면 실패로 처리한다.
- daily 기본 프롬프트는 SKILL.md와 수집 snapshot을 활용하는 압축 컨텍스트로 줄인다.

### 결과

- cron이 Claude 무출력 상태에서 무기한 대기하지 않는다.
- 실패 원인은 timeout, no-output, stale-output 중 어디인지 stderr에 남는다.
- 기본 추천 정책은 SKILL.md와 docs를 단일 출처로 유지하고, runner 인자에는 운영상 필요한 짧은 focus만 전달한다.
