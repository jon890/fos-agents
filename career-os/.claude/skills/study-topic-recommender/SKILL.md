---
name: study-topic-recommender
description: 등록된 회사 기술 블로그, GeekNews·개발 동향과 YouTube 채널에서 최신 자료를 수집하고, 아침에 볼 자료를 선별해 임시 HTML 리포트로 만든 뒤 Cloudflare Pages에 게시하는 career-os 스킬. "오늘 뭐 읽을까", "오늘 공부할 글 추천", "아침 읽을거리", "기술 블로그 추천", "영상 추천", "학습 주제 추천", `/study-topic-recommender`처럼 외부 기술 자료 추천이 필요할 때 사용한다.
---

# 아침 읽을거리 추천

등록된 외부 소스의 전체 후보와 최근 학습 흐름을 비교해 오늘 읽거나 볼 자료를 고른다.

## 입력

- `config/external-reading-sources.ts`
  - 발행처와 카테고리별 추천 수
- `sources/fos-study/**/*.md`
  - 실제 학습 문서와 최근 학습 방향
- `state/morning-reading-history.jsonl`
  - 기존 추천 URL

소스를 추가하거나 점검할 때
[`references/source-management.md`](references/source-management.md)를 읽는다.

## 실행

### 1. 임시 실행 경로 준비

```bash
mktemp -d -t study-topic-recommender
```

반환된 절대 경로를 `<RUN_DIR>`로 사용한다.
후보풀, 선택 JSON, 추천 데이터, Markdown과 HTML은 모두 `<RUN_DIR>`에 만든다.
기존 추천 이력을 활용할 때 `<RUN_DIR>/state/`에 복사한다.

### 2. 외부 글 수집

```bash
CAREER_OS_ROOT=<RUN_DIR> bun --env-file=.env \
  scripts/study-topic-recommender/build_morning_reading.ts \
  --collect-only
```

`<RUN_DIR>/state/reading-candidates.json`에서 다음 조건을 확인한다.

- 모든 항목은 등록된 외부 소스에서 수집됐다.
- `candidates`가 1건 이상이다.
- `collectionLog`에 소스별 상태와 후보 수가 기록됐다.
- 피드가 제공하는 `excerpt`는 글이나 영상 내용을 판단하는 근거로 사용한다.

### 3. 글 선별

후보풀 전체와 최근 학습 문서를 읽는다.

```bash
rg --files sources/fos-study -g '*.md'
git -C sources/fos-study log -n 20 --name-only --format= -- '*.md'
```

카테고리별로 다음 순서로 고른다.

1. 최근 추천 여부, 발행 시각과 출처로 검토 범위를 좁힌다.
2. 공개 원문에서 제목과 실제 내용을 확인한다.
3. 구현 세부, 운영 경험과 최근 학습 흐름의 연결성을 판단한다.
4. 서로 다른 출처에서 카테고리별 `slots` 수만큼 고른다.

AI 관련 글도 출처의 다른 글과 같은 기준으로 판단한다.
선택 결과는 `<RUN_DIR>/reading-selection.json`에 만든다.

```json
{
  "selections": {
    "techBlog": [
      {
        "candidateId": "수집 결과의 ID",
        "summary": "원문에서 확인한 핵심 요약",
        "reason": "오늘 읽을 이유"
      }
    ],
    "geek": [],
    "video": [
      {
        "candidateId": "수집 결과의 영상 ID",
        "summary": "영상 설명과 공개 원문에서 확인한 핵심 요약",
        "reason": "오늘 볼 이유"
      }
    ]
  }
}
```

요약과 추천 이유는 공개 원문과 피드 설명을 근거로 작성한다.
영상은 채널 이름, 영상 제목, 공개 설명과 게시 시각을 함께 확인한다.

### 4. 임시 리포트 생성

```bash
CAREER_OS_ROOT=<RUN_DIR> bun --env-file=.env \
  scripts/study-topic-recommender/build_morning_reading.ts \
  --candidate-pool <RUN_DIR>/state/reading-candidates.json \
  --reading-selection <RUN_DIR>/reading-selection.json
```

게시 대상은 `<RUN_DIR>/reports/downloads/morning-reading-YYYY-MM-DD.html`이다.

### 5. 검증

```bash
CAREER_OS_ROOT=<RUN_DIR> bun \
  scripts/study-topic-recommender/validate_outputs.ts
bun scripts/study-topic-recommender/manage_reading_sources.ts validate
```

`collectionLog`의 수집 상태를 최종 응답에 반영한다.
공개 HTML은 다음 내용으로 구성한다.

- 공개 글 제목과 HTTPS 원문 URL
- 공개 영상 제목과 YouTube 원문 URL
- 공개 가능한 요약과 추천 이유
- 수집 시각과 소스별 수집 상태

### 6. Cloudflare Pages 게시

`report-publisher`로 아래 값을 준비, 게시하고 검증한다.

- 게시 대상: `<RUN_DIR>/reports/downloads/morning-reading-YYYY-MM-DD.html`
- 공개 이름: `morning-YYYY-MM-DD`
- Pages 프로젝트: `fos-reports`

검증된 `public_url`과 핵심 추천 결과를 최종 응답에 전달한다.
`branch_url` 검증 결과가 있으면 안정적인 주소로 함께 전달한다.

### 7. 임시 파일 정리

게시 검증 뒤 `<RUN_DIR>`의 파일과 빈 디렉터리를 순서대로 정리한다.
삭제 전 경로가 시스템 임시 디렉터리 아래에 있고 이름이 `study-topic-recommender`로 시작하는지 확인한다.

```bash
find "<RUN_DIR>" -type f -exec unlink {} \;
find "<RUN_DIR>" -depth -type d -exec rmdir {} \;
```

사용자가 로컬 사본을 요청하면 지정한 경로에 별도 파일을 만든다.

## 완료 조건

- 활성 외부 소스에서 새 후보풀이 생성됐다.
- 추천 수와 출처 다양성이 카테고리 설정과 일치한다.
- 요약과 추천 이유가 확인한 원문을 반영한다.
- 리포트와 소스 설정 검증이 통과했다.
- `report-publisher`가 Cloudflare Pages 공개 URL을 검증했다.
- `<RUN_DIR>` 제거가 성공했다.
