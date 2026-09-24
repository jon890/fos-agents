# 추천 실행 계약

이 문서는 현재 CLI의 인자와 실행 순서를 설명한다.
추천 기준은 [스킬 본문](../SKILL.md)을 따른다.

명령의 `<ROOT>`는 Git 저장소 루트, `<RUN_DIR>`는 실행별 시스템 임시 디렉터리다.
`CAREER_OS_ROOT`는 임시 실행 경로이며 영구 이력 경로로 사용하지 않는다.

**`<RUN_DIR>` 이름은 `study-topic-recommender.`로 시작해야 한다.**
런타임이 그 접두사를 확인하고, 아니면 종료 코드 2로 거절한다.

```bash
mktemp -d "${TMPDIR:-/tmp}/study-topic-recommender.XXXXXX"
```

## 실행

소스, 수집 자료, 추천 이력과 제외 판정은 추천 Backend가 관리한다.
`CAREER_RECOMMENDATION_API_URL`과 token을 `career-os/.env`에 두고 `--env-file`로 넘긴다.
둘 중 하나라도 없으면 명령은 종료 코드 1로 멈춘다.

실행 명령은 모두 저장소 루트에서 실행한다.
`<RUN_DIR>`는 시스템 임시 디렉터리 아래의 실행별 경로이며 이름이 `study-topic-recommender.`로 시작해야 한다.

```bash
# cwd: 저장소 루트
bun --env-file=career-os/.env \
  career-os/scripts/study-topic-recommender/build_morning_reading.ts \
  --run-dir <RUN_DIR> --collect-only --mode recent
bun --env-file=career-os/.env \
  career-os/scripts/study-topic-recommender/build_morning_reading.ts \
  --run-dir <RUN_DIR> --prepare-candidates --limit 100
```

`--prepare-candidates`는 후보 API의 `recentStudyTopicKeys`와 `candidateContextVersion`을 후보풀 옆 메타데이터에 함께 저장한다.
모델은 후보풀에서 선택한 자료와 선택하지 않은 모든 후보의 `rejections`를 `<RUN_DIR>/reading-selection.json`에 적는다.

```json
{
  "topics": [{
    "topicKey": "idempotent-message-processing",
    "title": "메시지가 중복 도착해도 데이터가 정확하도록 처리하기",
    "careerQuestion": "재시도가 발생해도 같은 주문을 한 번만 처리하려면 무엇을 보장해야 하는가?",
    "items": [{
      "candidateId": "수집 결과의 ID",
      "summary": "원문에서 확인한 문제와 해결 방법",
      "reason": "현재 업무나 다음 역할에서 이 자료를 볼 이유",
      "careerValue": "engineering-judgment"
    }]
  }],
  "rejections": [{
    "candidateId": "선택하지 않은 후보 ID",
    "reason": "한 줄 제외 이유"
  }]
}
```

추천할 자료가 없으면 `topics`에 빈 배열을 쓰고, 후보가 있었다면 `rejections`에는 각 후보의 이유를 남긴다.

```bash
bun --env-file=career-os/.env \
  career-os/scripts/study-topic-recommender/build_morning_reading.ts \
  --run-dir <RUN_DIR> \
  --candidate-pool <RUN_DIR>/state/reading-candidates.json \
  --reading-selection <RUN_DIR>/reading-selection.json
bun career-os/scripts/study-topic-recommender/validate_outputs.ts --run-dir <RUN_DIR>
bun --env-file=career-os/.env \
  career-os/scripts/study-topic-recommender/build_morning_reading.ts \
  --run-dir <RUN_DIR> --commit-recommendation \
  --report <RUN_DIR>/state/morning-reading.json
```

같은 날짜의 리포트, 같은 `contentKey`와 직전 리포트의 같은 `topicKey`는 다시 저장할 수 없다.
추천 저장은 후보를 읽을 때 받은 `candidateContextVersion`을 함께 보낸다.
그 사이 사람이 기준 버전을 올렸으면 서버가 `409`로 거부한다.

오류 응답은 `401`, `403`, `409`, `413`, `429`, `503`을 오류 코드와 requestId와 함께 출력한다.
token과 원문 payload는 출력하지 않는다.

수집과 추천 저장은 서비스 Bearer 인증을 사용한다.
관리자 브라우저 세션을 복제하지 않는다.

외부 게시가 성공하면 아래 명령으로 publications 기록만 추가한다.

```bash
# cwd: 저장소 루트
bun --env-file=career-os/.env \
  career-os/scripts/study-topic-recommender/build_morning_reading.ts \
  --run-dir <RUN_DIR> --record-publication \
  --report-id morning-YYYY-MM-DD --channel cloudflare-pages \
  --external-id morning-YYYY-MM-DD --published-at 2026-09-07T00:00:00.000Z \
  --url https://example.com/morning-YYYY-MM-DD
```

## 후보자 기준 변경

관심사가 바뀌면 새 `candidateContextVersion`을 정하고 다음 명령을 실행한다.
이전 기준의 제외 판정은 무효가 되어 후보가 다시 나온다.

```bash
bun --env-file=career-os/.env \
  career-os/scripts/study-topic-recommender/configure_study_recommendation.ts \
  --candidate-context-version <NEW_VERSION>
```

## 운영 이관

운영 이관은 운영 담당자가 dry-run으로 소스 건수, 리포트 3건, 자료 15건을 먼저 확인한 뒤 별도 승인된 작업에서 `--commit`으로 한 번 수행한다.
이관이 끝나면 후보 API에서 이력의 자료가 추천 후보로 다시 나오지 않는지 확인한다.

```bash
# cwd: 저장소 루트
bun --env-file=career-os/.env \
  career-os/scripts/study-topic-recommender/import_study_state.ts \
  --dry-run --history-file <LEGACY_HISTORY_JSON> --sources-file <SOURCES_CONFIG_TS>
```
