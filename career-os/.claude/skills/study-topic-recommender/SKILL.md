---
name: study-topic-recommender
description: 등록된 기술 블로그, 개발 동향, AI 자료와 YouTube 채널에서 이전 추천을 제외하고 현재 업무와 다음 커리어에 연결할 아침 공부 주제를 만드는 career-os 스킬. "오늘 뭐 읽을까", "오늘 공부할 글 추천", "아침 읽을거리", "기술 블로그 추천", "영상 추천", "학습 주제 추천", `/study-topic-recommender`처럼 외부 기술 자료 추천이 필요할 때 사용한다. 외부 게시는 사용자가 공유 링크를 요청했을 때만 수행한다.
---

# 아침 공부 주제 추천

등록된 외부 소스의 전체 후보, 누적 추천 이력과 현재 커리어 방향을 비교해 오늘 공부할 주제를 고른다.

## 입력

- `config/external-reading-sources.ts`: 발행처, 카테고리와 수집 방식
- `state/morning-study-history.json`: 이전에 추천한 글과 영상
- `sources/fos-study/**/*.md`: 실제 학습 문서와 최근 학습 방향
- `fos-brain`의 private 커리어 현황과 학습 관심사

소스를 추가하거나 점검할 때 [소스 관리](references/source-management.md)를 읽는다.

## 실행

### 1. 비공개 작업본 준비

저장소 루트에서 다음 명령을 실행한다.

```bash
bun "$(git rev-parse --show-toplevel)/career-os/scripts/career-workspace/cli.ts" \
  skill begin study-topic-recommender --json
```

준비가 실패하면 오래된 로컬 이력으로 추천을 계속하지 않는다.
원격 release와 로컬 파일이 보존됐다는 사실을 알리고 중단한다.

### 2. 임시 실행 경로 준비

```bash
mktemp -d "${TMPDIR:-/tmp}/study-topic-recommender.XXXXXX"
```

반환된 절대 경로를 `<RUN_DIR>`로 사용한다.
후보풀, 선택 JSON, 추천 데이터, Markdown과 HTML은 모두 `<RUN_DIR>`에 만든다.
영구 이력 경로는 `<REPO_ROOT>/career-os/state/morning-study-history.json`이다.

### 3. 외부 자료 수집

```bash
CAREER_OS_ROOT=<RUN_DIR> bun --env-file="$(git rev-parse --show-toplevel)/career-os/.env" \
  "$(git rev-parse --show-toplevel)/career-os/scripts/study-topic-recommender/build_morning_reading.ts" \
  --history-file "$(git rev-parse --show-toplevel)/career-os/state/morning-study-history.json" \
  --collect-only
```

`<RUN_DIR>/state/reading-candidates.json`에서 다음 조건을 확인한다.

- 모든 항목은 등록된 외부 소스에서 수집됐다.
- `collectionLog`에 소스별 상태와 후보 수가 기록됐다.
- `previouslyRecommended: true`인 자료는 선택하지 않는다.
- 피드가 제공하는 `excerpt`는 글이나 영상 내용을 판단하는 근거로 사용한다.

후보가 없거나 모두 이전 추천이면 빈 주제 결과를 만들 수 있다.
과거 자료를 다시 채우지 않는다.

### 4. 커리어 방향과 최근 학습 확인

`brain-search`로 private `career-status`, `career-position-preferences`, `learning-interests`를 확인한다.
`sources/fos-study`는 최근 학습 방향과 실제로 다룬 주제를 복원할 만큼만 읽는다.

```bash
rg --files "$(git rev-parse --show-toplevel)/career-os/sources/fos-study" -g '*.md'
git -C "$(git rev-parse --show-toplevel)/career-os/sources/fos-study" log --name-only --format= -- '*.md'
```

private 커리어 정보는 선별에만 사용하고 공개 리포트에 회사명, 지원 상태나 비공개 경험을 쓰지 않는다.

### 5. 공부 주제 선별

먼저 각 후보가 다음 중 하나에 구체적으로 연결되는지 확인한다.

- `current-work`: 현재 업무의 구현, 품질, 장애 복구나 운영 판단
- `target-role`: 목표 역할에서 요구하는 설계와 경험 확장
- `engineering-judgment`: 대안, 실패 조건과 결과가 있는 기술 판단
- `product-business`: 실제 제품, 조직, 사용자 가치나 수익화 판단

공식 자료나 최신 소식이라는 이유만으로 추천하지 않는다.
API 사용 순서만 나열한 문서, 기능 발표 요약, 전이할 판단이 없는 안전성·업계 소식, 입문 문법과 홍보성 영상은 제외한다.
비즈까페는 AI와 산업 변화가 제품·조직·사업 판단으로 이어질 때 선택한다.
조코딩과 양실장의 바이브코딩대학은 AI 제품 구현, 에이전트 운영, 업무 자동화와 실제 서비스·수익화 판단이 있을 때 선택한다.

통과한 자료를 외부 원문에서 도출한 공부 주제로 묶는다.
각 주제에는 사용자가 자신의 업무나 다음 역할에 적용해 볼 `careerQuestion`을 작성한다.
주제마다 영문 소문자와 숫자를 하이픈으로 연결한 안정적인 `topicKey`를 붙인다.
같은 개념은 실행 날짜가 달라도 같은 `topicKey`를 사용하며, 후보풀의 `recentStudyTopicKeys`에 있는 주제는 선택하지 않는다.
선택 결과는 `<RUN_DIR>/reading-selection.json`에 만든다.

```json
{
  "topics": [
    {
      "topicKey": "operable-ai-products",
      "title": "운영 가능한 AI 제품을 만드는 판단",
      "careerQuestion": "현재 서비스에서 자동화를 늘릴 때 어떤 실패를 먼저 막아야 하는가?",
      "items": [
        {
          "candidateId": "수집 결과의 ID",
          "summary": "원문에서 확인한 핵심 내용",
          "reason": "현재 업무나 다음 역할에서 이 자료를 볼 이유",
          "careerValue": "engineering-judgment"
        }
      ]
    }
  ]
}
```

추천할 자료가 없으면 `{"topics": []}`를 사용한다.
추천 개수를 채우기 위해 기준 미달 자료를 포함하지 않는다.

### 6. 임시 리포트 생성과 검증

```bash
CAREER_OS_ROOT=<RUN_DIR> bun --env-file="$(git rev-parse --show-toplevel)/career-os/.env" \
  "$(git rev-parse --show-toplevel)/career-os/scripts/study-topic-recommender/build_morning_reading.ts" \
  --history-file "$(git rev-parse --show-toplevel)/career-os/state/morning-study-history.json" \
  --candidate-pool <RUN_DIR>/state/reading-candidates.json \
  --reading-selection <RUN_DIR>/reading-selection.json
```

```bash
CAREER_OS_ROOT=<RUN_DIR> bun \
  "$(git rev-parse --show-toplevel)/career-os/scripts/study-topic-recommender/validate_outputs.ts"
bun "$(git rev-parse --show-toplevel)/career-os/scripts/study-topic-recommender/manage_reading_sources.ts" validate
```

게시 대상은 `<RUN_DIR>/morning-reading-YYYY-MM-DD.html`이다.
사람이 읽는 Markdown은 `<RUN_DIR>/morning-reading.md`에 만든다.
HTML은 공부 주제, 커리어 질문과 연결 자료를 같은 순서로 보여줘야 한다.

### 7. 누적 이력과 홈서버 release 반영

출력 검증이 통과한 뒤에만 다음 명령을 순서대로 실행한다.

```bash
CAREER_OS_ROOT=<RUN_DIR> bun \
  "$(git rev-parse --show-toplevel)/career-os/scripts/study-topic-recommender/build_morning_reading.ts" \
  --history-file "$(git rev-parse --show-toplevel)/career-os/state/morning-study-history.json" \
  --commit-history
```

```bash
bun "$(git rev-parse --show-toplevel)/career-os/scripts/career-workspace/cli.ts" \
  skill finish study-topic-recommender --json
```

이력 반영이나 release 발행이 실패하면 로컬 이력과 임시 리포트를 삭제하지 않는다.
같은 날짜의 리포트, 같은 `contentKey`나 직전 리포트와 같은 `topicKey`를 다시 반영하지 않는다.

### 8. 로컬 검토와 선택적 게시

생성한 HTML을 실제 브라우저에서 열어 주제 순서, 카드, 원문 링크와 모바일 배치를 확인한다.
사용자가 외부 공유 링크를 요청했을 때만 `report-publisher`로 게시하고 공개 URL을 검증한다.

- 게시 대상: `<RUN_DIR>/morning-reading-YYYY-MM-DD.html`
- 공개 이름: `morning-YYYY-MM-DD`
- Pages 프로젝트: `fos-reports`

### 9. 임시 파일 정리

로컬 렌더 또는 게시 검증과 홈서버 release 반영이 모두 끝난 뒤 `<RUN_DIR>`을 정리한다.
삭제 전 경로가 시스템 임시 디렉터리 아래에 있고 이름이 `study-topic-recommender`로 시작하는지 확인한다.

```bash
find "<RUN_DIR>" -type f -exec unlink {} \;
find "<RUN_DIR>" -depth -type d -exec rmdir {} \;
```

정리만 실패하면 검증된 추천과 게시 결과를 실패로 바꾸지 않는다.

## 완료 조건

- 홈서버 최신 이력을 준비하고 이전 추천과 같은 자료를 선택하지 않았다.
- 직전 리포트와 같은 공부 주제를 다시 선택하지 않았다.
- 추천 자료가 현재 업무, 목표 역할, 엔지니어링 판단 또는 제품·사업 관점에 연결된다.
- 자료가 공부 주제와 커리어 질문으로 묶였다.
- 리포트와 소스 설정 검증이 통과했다.
- 검증된 추천만 누적 이력과 홈서버 release에 반영됐다.
- 외부 게시를 요청한 경우에만 검증된 공개 URL을 제공했다.
- 임시 실행 경로 정리를 시도했고 실패한 경우 남은 경로를 알렸다.
