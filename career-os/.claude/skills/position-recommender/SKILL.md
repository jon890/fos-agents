---
name: position-recommender
description: 후보자 프로필과 현재 열린 외부 채용공고를 비교해 지원할 포지션을 추천하고 HTML 리포트를 만드는 career-os 스킬. "지원할 포지션 추천", "갈 만한 회사 찾아줘", "최신 백엔드 공고 분석", "이직 후보 추천"처럼 실제 공고 탐색과 지원 우선순위가 필요할 때 사용한다.
---

# 포지션 추천

외부 소스에서 현재 열린 공고를 먼저 수집한다.
고정 관심 키워드로 후보를 만들지 않고, 후보자 프로필과 전체 후보풀을 모델이 비교해 추천한다.

## 입력

항상 다음 파일을 읽는다.

- `config/candidate-profile.md`
- `config/position-filters.json`
- `state/company-cooldown.json`
- `references/position-decision-criteria.md`

다음 파일은 필요한 경우에만 읽는다.

- `config/verified-company-research-targets.json`
  - 등록 소스 밖의 회사를 추가 탐색할 때 읽는다.
- 최근 포지션 추천 결과
  - 같은 공고가 반복되는 이유를 확인할 때 읽는다.

세부 근거가 필요하면 프로필에서 연결한 최신 경력 자료와 업무 기록을 읽는다.
일반적인 포지션 추천에서는 읽지 않는다.

## 실행

### 1. 외부 공고 수집

```bash
bun scripts/position-recommender/collect_live_postings.ts \
  --output state/posting-candidates.json
```

`state/posting-candidates.json`이 추천 입력의 기준 데이터다.

다음을 확인한다.

- `collectedAt`이 이번 실행 시각이다.
- `candidates`가 비어 있지 않다.
- 추천에 사용할 소스의 진단 상태가 `failed`가 아니다.
- 후보는 개별 공고 URL을 가진 `active` 또는 `open` 상태다.
- 마감일이 지난 공고는 공통 생명주기 검사에서 제외됐다.

수집에 실패하면 이전 후보풀을 자동으로 재사용하지 않는다.
사용자가 기존 후보 사용을 명시한 경우에만 수집 시각과 한계를 알리고 계속한다.

### 2. 모델 선별

모델은 후보풀 전체와 후보자 프로필을 비교한다.
수집 코드의 배열 순서나 소스 순서를 추천 순위로 사용하지 않는다.
닫힘 여부와 마감일은 모델이 다시 판단하지 않는다.

다음 축을 함께 판단한다.

- 명시된 지원 자격과 후보자 근거
- 역할에서 얻을 기술적 성장
- 회사와 사업의 이직 가치
- 경력 수준과 고용 형태
- 현재 약점으로 준비 가능한 범위
- 지원 이력과 일시적인 쿨다운

공고의 담당 업무는 미래 업무 범위다.
담당 업무를 모두 이미 해봤어야 하는 필수조건처럼 채점하지 않는다.

추천 결과는 `scripts/position-recommender/recommendation_schema.ts`의 `schemaVersion: 3`에 맞춘다.
강력 추천과 도전 추천의 각 항목에는 후보풀의 `candidateId`를 그대로 넣는다.

값을 확인할 수 없으면 임의의 기본값을 만들지 않는다.
필수 설명 필드에는 `확인 필요` 또는 `정보 없음`처럼 불확실성을 드러낸다.

### 3. 결과 검증

```bash
bun scripts/position-recommender/validate_recommendation.ts \
  --input reports/daily/YYYY-MM-DD/position-recommendation/recommendation.json \
  --candidates state/posting-candidates.json
```

검증기는 다음 오류를 막는다.

- 후보풀에 없는 공고 추천
- 같은 후보의 중복 추천
- 후보 ID와 다른 회사명, 공고명, URL, 소스 사용
- 다른 수집 실행의 후보풀 혼용

검증이 실패하면 JSON을 고친 뒤 다시 실행한다.

### 4. 리포트 생성

```bash
bun scripts/position-recommender/render_recommendation.ts \
  --input reports/daily/YYYY-MM-DD/position-recommendation/recommendation.json \
  --format md \
  --output reports/daily/YYYY-MM-DD/position-recommendation/report.md

bun scripts/position-recommender/render_candidate_preview.ts \
  --input reports/daily/YYYY-MM-DD/position-recommendation/recommendation.json \
  --candidates state/posting-candidates.json \
  --limit all \
  --output reports/downloads/position-recommendation-YYYY-MM-DD.html
```

HTML에는 다음 내용을 담는다.

- 결론과 다음 행동
- 강력 추천과 도전 추천
- 추천 이유와 준비할 점
- 수집된 전체 후보
- 각 공고의 개별 링크
- 수집 시각과 실행 ID

개인 이력의 상세 내용이나 비공개 지원 전략은 외부 공유용 HTML에 넣지 않는다.

### 5. Cloudflare Pages 게시

사용자가 포지션 추천을 요청하면 HTML을 `report-publisher`로 게시해 바로 열 수 있는 링크를 제공한다.
포지션 추천 스킬이 Cloudflare 명령을 직접 실행하지 않는다.

`report-publisher`에 다음 값을 전달한다.

- 게시 대상: `reports/downloads/position-recommendation-YYYY-MM-DD.html`
- 공개 이름: `position-YYYY-MM-DD`
- Pages 프로젝트: `fos-reports`

게시 전에 다음 내용을 공개 HTML에서 다시 확인한다.

- 개인 이력의 상세 내용이 없다.
- 비공개 지원 전략과 탈락 이력이 없다.
- 로컬 절대 경로와 내부 파일 경로가 없다.
- 공고 URL은 공개된 HTTPS 개별 공고 링크다.

`report-publisher`의 준비 검사, Cloudflare Pages 업로드, 공개 URL 검증을 모두 따른다.
최종 응답에는 검증된 공개 URL과 핵심 추천 결과를 함께 전달한다.

## 완료 조건

- 새 외부 후보풀이 생성됐다.
- 모든 추천 공고가 후보 ID로 연결됐다.
- 후보풀 대조 검증이 통과했다.
- Markdown과 HTML이 같은 추천 JSON에서 생성됐다.
- HTML의 모든 공고 링크가 개별 공고 URL이다.
- 확인하지 못한 값을 사실처럼 채우지 않았다.
- `report-publisher`가 Cloudflare Pages 공개 URL을 검증했다.

## 관련 파일

- `scripts/position-recommender/live-postings/adapters/`
  - 소스별 수집 어댑터
- `scripts/position-recommender/live-postings/contracts.ts`
  - 외부 공고와 후보풀의 Zod 스키마
- `scripts/position-recommender/recommendation_schema.ts`
  - 추천 결과의 Zod 스키마
- `scripts/position-recommender/validate_recommendation.ts`
  - 후보 ID와 공고 원문 대조
- `references/position-decision-criteria.md`
  - 모델의 판단 기준
