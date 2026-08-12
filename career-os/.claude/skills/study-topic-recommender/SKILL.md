---
name: study-topic-recommender
description: 등록된 회사 기술 블로그와 GeekNews·개발 동향 소스에서 최신 글을 수집하고, 아침에 읽을 자료를 선별해 Markdown과 공개 가능한 HTML 리포트로 만드는 career-os 스킬. "오늘 뭐 읽을까", "오늘 공부할 글 추천", "아침 읽을거리", "기술 블로그 추천", "학습 주제 추천", `/study-topic-recommender`처럼 외부 기술 자료 추천이 필요할 때 사용한다. 사용자가 공유 URL이나 외부 게시를 요청하면 report-publisher로 게시한다.
---

# 아침 읽을거리 추천

등록된 외부 소스에서 글을 수집하고 현재 모델이 읽을 자료를 고른다.
내부 후보나 새 학습 주제를 생성하지 않는다.

## 입력

- `config/external-reading-sources.ts`
  - 수집할 발행처와 카테고리별 추천 수를 관리한다.
- `sources/fos-study/**/*.md`
  - 실제로 발행한 학습 문서와 최근 학습 방향을 확인한다.
- `state/morning-reading-history.jsonl`
  - 최근 추천 URL을 확인한다.

소스를 추가하거나 점검할 때만
[`references/source-management.md`](references/source-management.md)를 읽는다.

## 실행

### 1. 외부 글 수집

모든 활성 소스에서 글을 결정적으로 수집한다.

```bash
bun --env-file=.env \
  scripts/study-topic-recommender/build_morning_reading.ts \
  --collect-only
```

`state/reading-candidates.json`에는 외부 소스에서 수집한 글만 들어가야 한다.
고정 키워드나 숫자형 소스 우선순위로 항목을 제거하지 않는다.

### 2. 글 선별

`state/reading-candidates.json`의 전체 목록을 읽는다.
`sources/fos-study`의 파일 목록과 최근 변경 문서를 확인해 현재 학습 흐름을 파악한다.

```bash
rg --files sources/fos-study -g '*.md'
git -C sources/fos-study log -n 20 --name-only --format= -- '*.md'
```
카테고리별로 다음 순서로 고른다.

1. 최근 추천 여부, 발행 시각, 출처를 보고 검토할 글을 좁힌다.
2. 공개 원문을 열어 제목과 실제 내용이 일치하는지 확인한다.
3. 구현 세부, 운영 경험, 최근 `fos-study` 학습 흐름과의 연결성을 판단한다.
4. 서로 다른 출처에서 카테고리별 `slots` 수만큼 고른다.

AI 관련 글도 별도 분류하지 않는다.
회사 기술 블로그나 개발 동향에 포함된 다른 글과 같은 기준으로 판단한다.

선택 결과를 `/tmp/study-reading-selection.json`에 쓴다.

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
    "geek": []
  }
}
```

요약과 추천 이유는 원문 근거가 있어야 한다.
학습 시간, 난이도, 경험 수준을 추정해서 추가하지 않는다.

### 3. 리포트 생성

검증된 선택 파일로 추천 정본과 표시 산출물을 만든다.

```bash
bun --env-file=.env \
  scripts/study-topic-recommender/build_morning_reading.ts \
  --candidate-pool state/reading-candidates.json \
  --reading-selection /tmp/study-reading-selection.json
```

다음 파일을 생성한다.

- `state/morning-reading.json`
- `state/reading-candidates.json`
- `state/morning-reading-history.jsonl`
- `reports/morning-reading.md`
- `reports/downloads/morning-reading-YYYY-MM-DD.html`

표시 파일만 다시 만들 때는 다음 명령을 사용한다.

```bash
bun scripts/study-topic-recommender/build_morning_reading.ts --render-only
```

### 4. 검증

```bash
bun scripts/study-topic-recommender/validate_outputs.ts
bun scripts/study-topic-recommender/manage_reading_sources.ts validate
```

검증이 실패하면 성공으로 보고하지 않는다.
수집에 실패한 소스는 `collectionLog`와 최종 응답에 표시한다.

## 외부 게시

사용자가 공유 URL이나 외부 게시를 요청한 경우에만 `report-publisher`를 사용한다.
게시 대상은 `reports/downloads/morning-reading-YYYY-MM-DD.html` 단일 파일이다.

HTML에는 공개 URL, 공개 글 제목, 공개 가능한 요약과 추천 이유만 포함한다.
후보자 프로필, 회사별 지원 전략, 로컬 절대 경로, 내부 상태 원문은 포함하지 않는다.
