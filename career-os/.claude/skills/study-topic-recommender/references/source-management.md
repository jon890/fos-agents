# 추천 읽을거리 소스 관리

외부 읽을거리 설정은 `config/external-reading-sources.json` 한 파일에서 관리한다.
JSON을 직접 편집하기보다 관리 명령을 우선 사용한다.

## 구조

- `categories`
  - 카테고리 표시 이름과 하루 추천 수를 관리한다.
- `sources`
  - 모든 읽을거리 소스를 같은 구조로 관리한다.
- `category`
  - `techBlog`, `ai`, `geek` 중 하나다.
- `enabled`
  - `false`면 삭제하지 않고 추천에서 제외한다.
- `priority`
  - 같은 카테고리에서 값이 작은 소스를 먼저 검토한다.
- `feedUrl`
  - RSS 또는 Atom 피드가 있을 때 사용한다.
- `filterKeywords`
  - 피드 글 제목에서 우선할 키워드다.

## 조회와 검증

```bash
bun scripts/study-topic-recommender/manage_reading_sources.ts validate
bun scripts/study-topic-recommender/manage_reading_sources.ts list
bun scripts/study-topic-recommender/manage_reading_sources.ts list --category techBlog
bun scripts/study-topic-recommender/manage_reading_sources.ts list --include-disabled
```

## 소스 추가

```bash
bun scripts/study-topic-recommender/manage_reading_sources.ts add \
  --category techBlog \
  --key example-engineering \
  --title "Example Engineering 최신 백엔드 글" \
  --source "Example Engineering" \
  --url "https://example.com/engineering" \
  --feed-url "https://example.com/engineering/feed.xml" \
  --minutes 25 \
  --priority 20 \
  --tag backend \
  --keyword kafka \
  --keyword spring \
  --why "실제 운영 사례를 면접 답변에 연결하기 좋다"
```

`--tag`, `--keyword`, `--why`는 여러 번 지정할 수 있다.
URL과 피드 URL은 HTTPS만 허용한다.

## 활성 상태와 우선순위

```bash
bun scripts/study-topic-recommender/manage_reading_sources.ts disable <key>
bun scripts/study-topic-recommender/manage_reading_sources.ts enable <key>
bun scripts/study-topic-recommender/manage_reading_sources.ts set-priority <key> <숫자>
bun scripts/study-topic-recommender/manage_reading_sources.ts set-slots <카테고리> <숫자>
```

소스를 당장 추천하지 않으려면 삭제보다 `disable`을 사용한다.
하루에 보여줄 카테고리별 항목 수는 `set-slots`로 바꾼다.

## 소스 현황 리포트

현재 활성 소스와 원문 추적성 신뢰도를 확인한다.

```bash
bun scripts/study-topic-recommender/render_source_catalog.ts
```

결과는 `reports/downloads/study-reading-sources-YYYY-MM-DD.html`에 생성된다.
네트워크 확인 없이 설정만 렌더링하려면 `--offline`을 붙인다.
수정 후 `validate`를 실행한다.
