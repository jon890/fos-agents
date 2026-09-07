# 추천 실행 계약

이 문서는 현재 CLI의 인자와 파일 형식을 설명한다.
추천 기준은 [스킬 본문](../SKILL.md)을 따른다.

명령의 `<ROOT>`는 Git 저장소 루트, `<RUN_DIR>`는 실행별 시스템 임시 디렉터리다.
`CAREER_OS_ROOT`는 임시 실행 경로이며 영구 이력 경로로 사용하지 않는다.

## 파일모드

파일모드는 `state/morning-study-history.json`을 추천 이력으로 사용한다.
추천 생성 전에는 기존 파일 작업본을 준비하고, 검증된 결과를 이 파일에 반영한 뒤 작업본을 정리한다.

최신 비공개 작업본을 준비한다. 실패하면 새 추천 생성을 중단한다.

```bash
bun <ROOT>/career-os/scripts/career-workspace/cli.ts skill begin study-topic-recommender --json
```

임시 실행 경로에서 모든 활성 소스의 후보를 수집한다.

```bash
CAREER_OS_ROOT=<RUN_DIR> bun --env-file=<ROOT>/career-os/.env \
  <ROOT>/career-os/scripts/study-topic-recommender/build_morning_reading.ts \
  --history-file <ROOT>/career-os/state/morning-study-history.json --collect-only
```

후보풀은 `<RUN_DIR>/state/reading-candidates.json`이다.
`collectionLog`는 소스별 수집 상태와 수, `previouslyRecommended`는 이전 추천 여부,
`recentStudyTopicKeys`는 직전 리포트의 주제다.

## 모델 선택과 출력

선택 파일은 후보풀의 ID를 참조한다.
`careerValue`는 `current-work`, `target-role`, `engineering-judgment`, `product-business` 중 하나다.
`topicKey`는 같은 개념에 계속 사용하는 kebab-case 식별자다.

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
  }]
}
```

추천할 자료가 없으면 `{"topics": []}`를 사용한다.

```bash
CAREER_OS_ROOT=<RUN_DIR> bun --env-file=<ROOT>/career-os/.env \
  <ROOT>/career-os/scripts/study-topic-recommender/build_morning_reading.ts \
  --history-file <ROOT>/career-os/state/morning-study-history.json \
  --candidate-pool <RUN_DIR>/state/reading-candidates.json \
  --reading-selection <RUN_DIR>/reading-selection.json
```

출력은 `<RUN_DIR>/state/morning-reading.json`과 `<RUN_DIR>/morning-reading-YYYY-MM-DD.html`이다.

```bash
CAREER_OS_ROOT=<RUN_DIR> bun <ROOT>/career-os/scripts/study-topic-recommender/validate_outputs.ts
bun <ROOT>/career-os/scripts/study-topic-recommender/manage_reading_sources.ts validate
```

## 이력 반영과 전달

출력 검증과 내용·렌더링 검토를 마친 뒤 다음 두 명령을 순서대로 실행한다.

```bash
CAREER_OS_ROOT=<RUN_DIR> bun <ROOT>/career-os/scripts/study-topic-recommender/build_morning_reading.ts \
  --history-file <ROOT>/career-os/state/morning-study-history.json --commit-history
bun <ROOT>/career-os/scripts/career-workspace/cli.ts skill finish study-topic-recommender --json
```

같은 날짜의 리포트, 같은 `contentKey`와 직전 리포트의 같은 `topicKey`는 재반영할 수 없다.
실패하면 로컬 이력과 복구에 필요한 임시 리포트를 보존한다.

외부 공유를 요청받으면 `report-publisher`에 HTML을 전달한다.
Pages 프로젝트는 `fos-reports`, 공개 이름은 `morning-YYYY-MM-DD`다.

## Library 모드

library 모드는 누적 학습자료 API를 사용한다.
일반 수집과 추천 실행은 `skill begin`과 legacy `state/morning-study-history.json`에 의존하지 않는다.
API 실패 때 파일모드로 대신 쓰거나 API와 파일 이력을 동시에 쓰지 않는다.
추천 결과는 사용자용 HTML만 만들고 Markdown 리포트는 만들지 않는다.

`--library`에서는 `--render-only`, `--commit-history`, `--history-file`을 함께 쓰면 거절한다.
다만 `--import-preview`는 legacy 파일을 읽어야 하므로 `--history-file`을 예외로 받는다.

```bash
# cwd: 저장소 루트
bun career-os/scripts/study-topic-recommender/build_morning_reading.ts --run-dir <RUN_DIR> --library --collect-only --mode recent
bun career-os/scripts/study-topic-recommender/build_morning_reading.ts --run-dir <RUN_DIR> --library --collect-only --mode archive --source-key kurly-tech --max-items 48
bun career-os/scripts/study-topic-recommender/build_morning_reading.ts --run-dir <RUN_DIR> --library --prepare-candidates --limit 100
bun career-os/scripts/study-topic-recommender/build_morning_reading.ts --run-dir <RUN_DIR> --library --reading-selection <RUN_DIR>/reading-selection.json --candidate-pool <RUN_DIR>/state/reading-candidates.json
bun career-os/scripts/study-topic-recommender/validate_outputs.ts --run-dir <RUN_DIR>
bun career-os/scripts/study-topic-recommender/build_morning_reading.ts --run-dir <RUN_DIR> --library --commit-recommendation --report <RUN_DIR>/state/morning-reading.json
bun career-os/scripts/study-topic-recommender/build_morning_reading.ts --run-dir <RUN_DIR> --library --record-publication --report-id morning-YYYY-MM-DD --channel cloudflare-pages --external-id morning-YYYY-MM-DD --published-at 2026-09-07T00:00:00.000Z --url https://example.com/morning-YYYY-MM-DD
```

수집과 추천 저장은 서비스 Bearer 인증을 사용한다.
관리자 브라우저 세션을 복제하지 않는다.
가져오기 commit은 본인 관리자 UI에서 수행한다.

## 기존 이력 가져오기

기존 파일 이력과 Pages 노출 이력은 API `imports/dry-run`으로만 검증한다.
Pages 이력은 에이전트가 승인된 Pages URL에서 준비한 manifest 파일을 `--pages-manifest`로 전달한다.
manifest는 `schemaVersion: 1`과 `reports` 배열을 가지며, 각 report의 `provenance.sourcePageUrl`에는 확인한 Pages HTTPS URL을 넣는다.
API payload에는 `provenance`를 보내지 않는다.

실제 legacy `state/morning-study-history.json`을 읽어 import preview를 만들 때만 기존 파일 동기화 계약을 따른다.
아래 명령 전에는 `skill begin study-topic-recommender`를 실행하고, 산출물 보존이 끝나면 `skill finish study-topic-recommender`를 실행한다.
fixture history와 fixture pages manifest를 쓰는 테스트는 begin과 finish를 요구하지 않는다.

```bash
# cwd: 저장소 루트
bun career-os/scripts/career-workspace/cli.ts skill begin study-topic-recommender --json
bun career-os/scripts/study-topic-recommender/build_morning_reading.ts --run-dir <RUN_DIR> --library --import-preview --history-file career-os/state/morning-study-history.json --pages-manifest <PAGES_MANIFEST_JSON> --output <RUN_DIR>/study-library-import-preview.json
bun career-os/scripts/career-workspace/cli.ts skill finish study-topic-recommender --json
```

`--output`에는 본인 관리자 UI가 받을 raw `{importKey,reports}` JSON만 저장한다.
dry-run 응답의 `previewHash`, `historyVersion`, `counts`, `warnings`는 `<output>.preview.json`에 저장한다.
변환 오류는 `<output>.errors.json`에 저장한다.
변환 오류가 있으면 raw payload를 만들지 않고 API도 호출하지 않는다.
