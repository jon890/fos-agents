## ADR-073 — daily study 추천은 Discord 버튼으로 초안 생성을 요청할 수 있다

- Status: Accepted
- Date: 2026-06-09

### 맥락

daily study cron 메시지는 이제 실행 로그가 아니라 오늘 공부할 주제 3개와 추천 이유만 보여준다.
사용자는 대화를 추가로 입력하지 않아도 추천 topic을 study-pack 초안 생성으로 이어 가고 싶어 한다.
다만 공개 최종화, `[초안]` 제거, fos-study publish는 명시적 확인이 필요한 별도 단계다.

### 결정

- `_shared/lib/notify_discord.ts`는 OpenClaw shared `presentation` payload를 전달할 수 있도록 `--presentation <json>`을 지원한다.
- daily study cron은 추천 3개를 짧게 렌더링하고 Discord 버튼을 함께 보낸다.
- 버튼은 `1번 초안 생성`, `2번 초안 생성`, `3번 초안 생성`, `오늘은 넘김`으로 둔다.
- 버튼 callback 매핑은 `data/runtime/study-topic-actions/YYYY-MM-DD.json`과 `latest.json`에 저장한다.
- `career.study-pack.create:*`는 study-pack 초안 생성 요청이다.
  공개 최종화나 `[초안]` 제거가 아니다.
- `career.study-pack.skip:*`는 그날 추천을 넘긴 기록이다.
  해당 topic을 영구 제외하지 않는다.
- Discord component 유효시간은 24시간으로 설정한다.

### 결과

- daily 추천 메시지는 짧게 유지하면서도 바로 다음 action으로 연결된다.
- 공개 발행 경계는 유지된다.
- callback은 runtime snapshot을 통해 날짜와 topic-key를 검증할 수 있다.
