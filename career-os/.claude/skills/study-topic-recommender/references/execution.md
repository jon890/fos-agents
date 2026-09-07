# 추천 실행 계약

이 문서는 현재 CLI의 인자와 파일 형식을 설명한다.
추천 기준은 [스킬 본문](../SKILL.md)을 따른다.

명령의 `<ROOT>`는 Git 저장소 루트, `<RUN_DIR>`는 실행별 시스템 임시 디렉터리다.
`CAREER_OS_ROOT`는 임시 실행 경로이며 영구 이력 경로로 사용하지 않는다.

## 준비와 수집

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
