---
name: study-topic-recommender
description: 등록된 회사 기술 블로그, GeekNews, AI 공식 문서·연구와 YouTube 채널에서 최신 자료를 수집하고, 읽을 가치가 있는 자료를 모두 카드형 HTML 리포트로 만든 뒤 Cloudflare Pages에 게시하는 career-os 스킬. "오늘 뭐 읽을까", "오늘 공부할 글 추천", "아침 읽을거리", "기술 블로그 추천", "AI 연구 동향", "영상 추천", "학습 주제 추천", `/study-topic-recommender`처럼 외부 기술 자료 추천이 필요할 때 사용한다.
---

# 아침 읽을거리 추천

등록된 외부 소스의 전체 후보와 최근 학습 흐름을 비교해 오늘 읽거나 볼 자료를 고른다.

## 입력

- `config/external-reading-sources.ts`
  - 발행처와 카테고리
- `sources/fos-study/**/*.md`
  - 실제 학습 문서와 최근 학습 방향
- `fos-brain`의 비공개 학습 관심사
  - 사용자가 직접 밝힌 관심과 기술 친숙도

소스를 추가하거나 점검할 때
[`references/source-management.md`](references/source-management.md)를 읽는다.

## 실행

### 1. 임시 실행 경로 준비

```bash
mktemp -d "${TMPDIR:-/tmp}/study-topic-recommender.XXXXXX"
```

반환된 절대 경로를 `<RUN_DIR>`로 사용한다.
후보풀, 선택 JSON, 추천 데이터, Markdown과 HTML은 모두 `<RUN_DIR>`에 만든다.
기존 추천 이력을 활용할 때 `<RUN_DIR>/state/`에 복사한다.

TypeScript 실행기 `<TS_RUNTIME>`은 `bun`이 있으면 `bun`, 없으면 TypeScript를 직접 실행할 수 있는 Node.js 22.18 이상을 사용한다.
둘 다 사용할 수 없으면 실행을 중단하고 필요한 런타임을 알린다.

### 2. 외부 글 수집

```bash
CAREER_OS_ROOT=<RUN_DIR> <TS_RUNTIME> --env-file=.env \
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
`brain-search`로 현재 학습 관심사와 기술 친숙도를 조회한다.

```bash
rg --files sources/fos-study -g '*.md'
git -C sources/fos-study log -n 20 --name-only --format= -- '*.md'
```

카테고리별로 다음 순서로 고른다.

1. 최근 추천 여부, 발행 시각과 출처로 검토 범위를 좁힌다.
2. 공개 원문에서 제목과 실제 내용을 확인한다.
3. 구현 세부, 운영 경험과 현재 관심사의 연결성을 판단한다.
4. 읽을 가치가 있다고 판단한 후보를 모두 선택한다.

추천 개수 대신 각 카드의 제목, 요약과 추천 이유가 사용자의 선택을 돕는다.
품질을 낮추지 않는 범위에서 출처를 다양하게 구성한다.

`geek`에서는 최신 기술 소식뿐 아니라 좋은 엔지니어가 되는 데 필요한 글도 고른다.
적합한 후보가 있으면 다음 관점의 글을 추천에 포함한다.

- 역할과 책임의 변화
- 기술적 판단과 문제 해결 방식
- 협업, 멘토링과 리더십
- 커리어 성장과 생산성

`ai`는 OpenAI, Anthropic과 xAI의 공식 자료를 우선한다.
모델 발표에 한정하지 않고 다음 내용을 함께 판단한다.

- 에이전트와 하네스
- 도구 사용과 개발 워크플로
- 평가, 신뢰성, 안전성과 보안
- 추론, 서빙, 성능과 비용
- 문맥, 메모리와 검색
- API, SDK와 개발자 플랫폼
- 연구 논문과 시스템 카드

공식 페이지에서 수집한 전체 후보를 먼저 확인한 뒤 오늘 읽을 자료를 선별한다.
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
    "ai": [
      {
        "candidateId": "수집 결과의 AI 공식 자료 ID",
        "summary": "공식 원문에서 확인한 핵심 요약",
        "reason": "현재 학습 관심사와 연결되는 이유"
      }
    ],
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
CAREER_OS_ROOT=<RUN_DIR> <TS_RUNTIME> --env-file=.env \
  scripts/study-topic-recommender/build_morning_reading.ts \
  --candidate-pool <RUN_DIR>/state/reading-candidates.json \
  --reading-selection <RUN_DIR>/reading-selection.json
```

게시 대상은 `<RUN_DIR>/reports/downloads/morning-reading-YYYY-MM-DD.html`이다.

### 5. 검증

```bash
CAREER_OS_ROOT=<RUN_DIR> <TS_RUNTIME> \
  scripts/study-topic-recommender/validate_outputs.ts
<TS_RUNTIME> scripts/study-topic-recommender/manage_reading_sources.ts validate
```

`collectionLog`의 수집 상태를 최종 응답에 반영한다.
공개 HTML은 다음 내용으로 구성한다.

- 공개 글 제목과 HTTPS 원문 URL
- AI 공식 문서·연구 제목과 HTTPS 원문 URL
- 공개 영상 제목과 YouTube 원문 URL
- 공개 가능한 요약과 추천 이유
- 수집 시각과 소스별 수집 상태

### 6. Cloudflare Pages 게시

`report-publisher`로 아래 값을 준비, 게시하고 검증한다.

- 게시 대상: `<RUN_DIR>/reports/downloads/morning-reading-YYYY-MM-DD.html`
- 공개 이름: `morning-YYYY-MM-DD`
- Pages 프로젝트: `fos-reports`

검증된 `branch_url`이 있으면 안정적인 사용자용 주소로 우선 전달한다.
`branch_url`이 없거나 검증에 실패한 경우에만 검증된 `public_url`을 전달한다.
핵심 추천 결과는 최종 공개 리포트와 일치시킨다.

### 7. 임시 파일 정리

게시 검증 뒤 `<RUN_DIR>`의 파일과 빈 디렉터리를 순서대로 정리한다.
삭제 전 경로가 시스템 임시 디렉터리 아래에 있고 이름이 `study-topic-recommender`로 시작하는지 확인한다.
아래 두 명령은 각각 별도의 terminal 호출로 실행한다.
조건문, `rm`, `node -e`나 다른 명령과 한 호출에 합치지 않는다.

```bash
find "<RUN_DIR>" -type f -exec unlink {} \;
find "<RUN_DIR>" -depth -type d -exec rmdir {} \;
```

별도 미리보기 파일을 만들었다면 각 파일을 `unlink "<절대 경로>"` 한 호출로 정리한다.
리포트 게시와 공개 URL 검증이 끝난 뒤 정리만 실패하면 전체 작업을 실패로 바꾸지 않는다.
검증된 링크와 추천 결과를 전달하고 정리하지 못한 경로를 경고로 남긴다.

사용자가 로컬 사본을 요청하면 지정한 경로에 별도 파일을 만든다.

## 완료 조건

- 활성 외부 소스에서 새 후보풀이 생성됐다.
- 읽을 가치가 있다고 판단한 후보가 개수 제한 없이 추천에 포함됐다.
- AI 추천이 공식 원문을 근거로 모델·에이전트·하네스·연구 범위를 폭넓게 검토했다.
- 요약과 추천 이유가 확인한 원문을 반영한다.
- 리포트와 소스 설정 검증이 통과했다.
- `report-publisher`가 Cloudflare Pages 공개 URL을 검증했다.
- `<RUN_DIR>` 정리를 시도했고, 실패한 경우 게시 성공을 덮어쓰지 않는 경고로 기록했다.
