# 추천 실행 계약

이 문서는 현재 CLI의 인자와 실행 순서를 설명한다.
추천 기준은 대화용 `study-topic-recommender` 스킬의 「2. 고르기」 를 따른다.

명령의 `<CAREER_LOCAL>` 은 `SKILL.md` 가 알려 준 실행기 명령이고, `<RUN_DIR>`는 실행별 시스템 임시 디렉터리다.

**`<RUN_DIR>` 이름은 `study-topic-recommender.`로 시작해야 한다.**
런타임이 그 접두사를 확인하고, 아니면 종료 코드 2로 거절한다.

```bash
mktemp -d "${TMPDIR:-/tmp}/study-topic-recommender.XXXXXX"
```

## 실행

소스, 수집 자료, 추천 이력과 제외 판정은 커리어 Backend가 관리한다.
`CAREER_BACKEND_URL`과 `CAREER_BACKEND_TOKEN` 은 셸 환경 변수에서 읽는다.
둘 중 하나라도 없으면 명령은 종료 코드 1로 멈춘다.

실행 전에 연결을 확인한다. 연결값, 인증, `learning-interests` 문서를 차례로 보고 무엇이 빠졌는지 알린다.
토큰과 주소 값은 출력하지 않는다.

```bash
<CAREER_LOCAL> study --doctor
```

| 실패한 `checks[].name` | 조치 |
| --- | --- |
| `connection` | 셸 환경에 연결값을 채워 달라고 사용자에게 요청한다 |
| `auth` | 토큰이 거절됐거나 Backend 에 닿지 않는다. 값과 네트워크 경로를 사용자에게 확인한다 |
| `learning-interests` | 문서를 저장해야 추천할 수 있다. 「관심사 변경」 절의 `save_context_document` 를 안내한다 |

`<RUN_DIR>`는 시스템 임시 디렉터리 아래의 실행별 경로이며 이름이 `study-topic-recommender.`로 시작해야 한다.
전체 하위 동작과 값 옵션은 `--help` 또는 `-h`로 확인한다.

```bash
<CAREER_LOCAL> study --help
```

```bash
<CAREER_LOCAL> study \
  --run-dir <RUN_DIR> --collect-only --mode recent
<CAREER_LOCAL> study \
  --run-dir <RUN_DIR> --prepare-candidates --limit 100
```

`--prepare-candidates`는 후보 API의 `recentStudyTopicKeys`, `candidateContextVersion`, `learningInterests`를 후보풀 옆 메타데이터에 함께 저장한다.
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
<CAREER_LOCAL> study \
  --run-dir <RUN_DIR> \
  --candidate-pool <RUN_DIR>/state/reading-candidates.json \
  --reading-selection <RUN_DIR>/reading-selection.json
```

선택 단계는 `<RUN_DIR>/state/morning-reading.json` 과
`<RUN_DIR>/state/recommendation-request.json` 을 함께 만든다.
두 파일을 같은 `state/` 디렉터리에 보존한 뒤 아래 검증과 추천 저장 명령을 실행한다.
저장 요청 파일은 리포트의 `reportId`, `generatedAt`, 후보 조회의
`candidateContextVersion`, 고르지 않은 후보의 `rejections` 를 담는다.
파일이 없거나 리포트와 값이 다르면 API 에 요청하지 않고 멈춘다.

```bash
<CAREER_LOCAL> study-validate --run-dir <RUN_DIR>
<CAREER_LOCAL> study \
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

공유 링크를 요청받았으면 `SKILL.md` 의 4번을 먼저 한다.
외부 게시가 성공하면 아래 명령으로 publications 기록만 추가한다.

```bash
<CAREER_LOCAL> study \
  --run-dir <RUN_DIR> --record-publication \
  --report-id morning-YYYY-MM-DD --channel cloudflare-pages \
  --external-id morning-YYYY-MM-DD --published-at 2026-09-07T00:00:00.000Z \
  --url https://example.com/morning-YYYY-MM-DD
```

검증과 결과 전달이 끝나고 보존할 파일을 확인한 뒤 실행 디렉터리를 정리한다.
`--cleanup`은 시스템 임시 디렉터리의 직접 자식만 지우며 중첩 경로와 symlink를 거절한다.
도움말과 정리 명령에는 Backend 설정이 필요하지 않다.

```bash
<CAREER_LOCAL> study --cleanup --run-dir <RUN_DIR>
```

## 관심사 변경

관심사가 바뀌면 `learning-interests` 문서를 고쳐 저장한다.
저장하면 기준 버전이 바뀌어 이전 제외 판정이 다시 후보로 나온다.
`get_context_document` 로 `learning-interests` 를 읽고, 고친 본문을 `save_context_document` 로 저장한다.
`expectedVersion` 에는 읽은 문서의 `version` 을 넣고, 문서가 아직 없으면 `0` 을 넣는다.
