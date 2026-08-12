---
name: study-topic-recommender
description: 백엔드 면접 준비를 위한 아침 학습 주제를 추천하고, RSS 기반 읽을거리 수집, 후보 풀 보충, 기존 문서 보강 판단, 라이브 코딩 주제 선택을 처리하는 career-os 스킬. "오늘 뭐 공부할까", "오늘 학습 추천", "토픽 풀 갱신", "추천 갱신", "학습 주제 추천", "라이브 코딩 1개 골라줘", `/study-topic-recommender`처럼 매일 공부할 주제나 읽을거리 추천이 필요할 때 사용한다. 공개 가능한 HTML 리포트를 함께 만들며, 사용자가 공유 URL이나 외부 게시를 요청하면 report-publisher로 게시한다.
---

# 매일 학습 주제 추천

백엔드 면접 준비에 필요한 학습 주제와 기술 읽을거리를 한 번에 추천한다.
후보 보충, 추천, 기존 문서 보강 판단을 단일 흐름으로 처리한다.

## 요청 해석

- 일반 추천 요청이면 오늘의 학습 주제와 읽을거리를 생성한다.
- 후보 풀 갱신 요청이면 RSS와 현재 학습 상태를 반영해 후보를 보충한다.
- 라이브 코딩 요청이면 연습 문제 후보를 하나 고른다.
- 실제 학습 문서 작성은 `study-pack-writer`에 맡긴다.
- 후보 승격과 설정 변경은 사용자 확인 없이 자동 적용하지 않는다.
- 외부 게시 요청이 있으면 HTML 생성 후 `report-publisher`를 사용한다.

## 입력

다음 파일과 명령 출력을 직접 읽는다.

1. `career-os/sources/fos-study/**/*.md`
   - 학습 문서 목록의 단일 출처다.
   - `.git/**`, `.claude/**`, `private/**`는 제외한다.
2. `career-os/config/study-pack-topics.json`
   - 사람이 선택한 우선 후보와 예비 후보를 담는다.
3. `career-os/state/study-pack-candidates.json`
   - 자동 생성한 후보와 예비 후보를 담는다.
4. `career-os/config/external-reading-sources.json`
   - 기술 블로그, AI, 개발 동향 읽을거리와 RSS 설정을 담는다.
5. `career-os/config/live-coding-seed-pool.json`
   - 우선 라이브 코딩 문제 목록이다.
6. `career-os/config/live-coding-seed-candidates.json`
   - 예비 라이브 코딩 문제 목록이다.
7. `career-os/state/study-progress.json`
   - 이미 공부한 주제와 보강 영역을 담는다.
8. `career-os/config/study-preferences.json`
   - 사용자의 관심 축과 추천 원칙을 담는다.
9. `career-os/state/topic-inventory-history.jsonl`
   - 최근 추천 이력과 반복 방지 계산에 사용한다.

`sources/fos-study/` 실제 파일 트리를 학습 산출물의 단일 출처로 사용한다.
일부 설정 파일이 없거나 JSON 해석에 실패해도 실제 파일 목록과 결정론적 예비 후보로 추천을 계속한다.

## 추천 원칙

TypeScript 목록 생성기는 후보와 다양성 안전장치를 제공한다.
최종 추천과 설명은 현재 에이전트가 다음 기준으로 다듬는다.

- 이미 공부했거나 학습 문서가 존재하는 주제를 반복하지 않는다.
- 현재 목표, 면접 일정, 1차 면접 준비도를 반영한다.
- `study-preferences.json`의 관심 축을 반영한다.
- 오래된 약점 가정에 매이지 않는다.
- 일반적인 DB 튜닝은 오늘의 맥락에 실제로 도움이 될 때만 추천한다.
- 더 적합한 주제가 있으면 고정 후보를 단순 순환하지 않는다.
- 여러 회사의 기술 블로그와 GeekNews 계열 읽을거리를 먼저 제시한다.
- 에이전트가 제안한 백엔드 공부 후보는 외부 읽을거리와 분리한다.

## 실행 흐름

### 1. 승격 후보 확인

`state/topic-inventory-history.jsonl`의 최근 이력을 읽는다.
`study-pack-candidates` 후보의 `promotionTarget.outputPath`에 해당하는 문서가 `sources/fos-study/`에 생겼으면 승격 후보로 본다.

승격 후보가 있으면 다음 설정 정리를 사용자에게 권한다.
자동 수정하지 않고 다음 단계로 계속 진행한다.

- `config/study-pack-topics.json`
- `state/study-pack-candidates.json`

### 2. 외부 소스 우선 추천 생성

먼저 모든 활성 소스의 후보를 결정적으로 수집한다.

```bash
bun --env-file=.env \
  scripts/study-topic-recommender/refresh_topic_inventory.ts \
  --collect-only
```

`state/reading-candidates.json`의 전체 후보를 읽고 다음 순서로 판단한다.

1. 제목, 출처, 발행 시각, 최근 추천 여부를 보고 카테고리별 후보를 좁힌다.
2. 좁힌 후보의 공개 원문을 열어 실제 내용과 현재성을 확인한다.
3. 현재 학습 취향과 최근 이력을 반영해 추천을 고른다.
4. 선택 결과를 `/tmp/study-reading-selection.json`에 쓴다.

선택 파일은 다음 계약을 따른다.

```json
{
  "selections": {
    "techBlog": [
      {
        "candidateId": "후보 풀의 ID",
        "summary": "글의 핵심 요약",
        "reason": "오늘 읽을 이유"
      }
    ],
    "ai": [],
    "geek": []
  }
}
```

각 배열은 카테고리의 `slots` 수와 일치해야 한다.
한 카테고리 안에서는 서로 다른 출처를 고른다.

그다음 검증된 모델 선택으로 전체 추천을 생성한다.

```bash
bun --env-file=.env \
  scripts/study-topic-recommender/refresh_topic_inventory.ts \
  --candidate-pool state/reading-candidates.json \
  --reading-selection /tmp/study-reading-selection.json
```

주요 계산 규칙은 다음과 같다.

- 하루 단위로 아침 읽을거리를 구성한다.
- 등록된 활성 외부 소스를 모두 수집한다.
- 고정 키워드와 숫자형 소스 우선순위는 사용하지 않는다.
- 행사 일정처럼 명백한 저신호 항목만 결정적으로 제외한다.
- 주제 적합도와 추천 이유는 현재 모델이 전체 후보를 보고 판단한다.
- 외부 수집이 끝난 뒤 `fos-study`와 후보 풀을 스캔해 백엔드 공부 후보를 계산한다.
- 회사 기술 블로그, GeekNews와 개발 동향, AI 실전, 백엔드 공부 후보 순으로 구성한다.
- 각 항목에는 제목, 간단한 요약, 추천 이유를 표시한다.
- 백엔드 항목 수는 `study-preferences.json`의 `morning_report.backend_slots`를 따른다.
- 외부 읽을거리 수는 `external-reading-sources.json`의 카테고리별 `slots`를 따른다.
- 백엔드 주제는 최근 이력을 기준으로 반복을 줄인다.
- 외부 글의 최근 추천 여부는 모델 판단 입력으로 제공한다.
- RSS 캐시는 6시간 동안 재사용한다.

다음 산출물을 만든다.

- `state/topic-inventory.json`
  - 추천 계산과 중복 후보의 정본이다.
- `reports/morning-topic-recommendation.md`
  - 전체 추천을 담은 로컬 마크다운이다.
- `reports/downloads/morning-reading-YYYY-MM-DD.html`
  - 공개 가능한 추천만 담은 게시 준비용 HTML이다.
- `state/topic-inventory-history.jsonl`
  - 오늘 추천 이력을 한 줄 추가한다.
- `state/reading-candidates.json`
  - 모든 활성 소스에서 결정적으로 수집한 모델 입력 후보 풀이다.

### 3. 다음 실행을 위한 후보 풀 보충

오늘의 외부 읽을거리와 백엔드 후보를 만든 뒤 후보 풀 상태를 확인한다.
다음 조건 중 하나라도 맞으면 이후 실행을 위해 후보를 보충한다.

- 활성 자동 후보가 5개 이하다.
- 최근 7회 추천에서 같은 분야나 분류가 지나치게 반복됐다.
- 요청에 새로운 관심사, 지원 맥락, 면접 맥락이 포함됐다.
- 기존 학습 문서와 활성 후보가 많이 겹친다.

같은 날짜에 자동 보충 결과가 이미 있으면 반복해서 보충하지 않는다.
`state/study-topic-candidate-refresh.json`의 `generatedAt`이 오늘이면 이 단계를 건너뛴다.
사용자가 새 관심사를 함께 준 요청에는 이 제한을 적용하지 않는다.

보충이 필요하면 다음 순서로 처리한다.

1. 학습 취향, 학습 상태, 최근 추천 이력을 읽는다.
2. 신규 후보 10~20개를 `/tmp/study-topic-candidate-proposals.json`에 쓴다.
3. 다음 명령을 실행한다.

```bash
bun --env-file=.env \
  scripts/study-topic-recommender/refresh_candidate_pool.ts \
  --proposals /tmp/study-topic-candidate-proposals.json \
  --trigger-kind recommendation-needs-refresh \
  --trigger-reason "<보충 이유>" \
  [--context "<공개 가능한 관심사 요약>"]
```

`--context`에는 회사명, 비공개 답변, 개인 이력 원문을 넣지 않는다.
보충 실패는 이미 만든 오늘의 리포트에 영향을 주지 않는다.

### 4. 중복 후보 의미 검토

`state/topic-inventory.json`의 `excluded.possibleDuplicates`를 확인한다.
후보 문서 경로와 기존 문서의 첫 30줄까지만 읽고 다음 값 중 하나로 분류한다.

- `new`: 의미가 다른 새 주제다.
- `update-existing`: 같은 핵심 주제이므로 기존 문서를 보강한다.
- `skip`: 추천에서 제외한다.
- `needs-user-confirmation`: 경계가 모호해 사용자 판단이 필요하다.

판정 결과는 `claudeDuplicateReview`에 기록한다.

```json
{
  "status": "ok",
  "reviewedAt": "ISO-8601 시각",
  "items": [
    {
      "key": "후보 키",
      "candidatePath": "후보 경로",
      "matchedPath": "기존 경로",
      "decision": "update-existing",
      "reason": "판정 이유"
    }
  ]
}
```

중복 후보가 있는데 `status`가 `skipped`라고 해서 그대로 믿지 않는다.
현재 에이전트가 모든 후보를 직접 검토한 뒤 `status`를 `ok`로 바꾼다.

검토 자체가 실패하면 다음 상태를 기록하고 추천 흐름은 계속한다.

```json
{
  "status": "failed",
  "reviewedAt": "ISO-8601 시각",
  "items": []
}
```

중복 후보가 없으면 `skipped` 상태를 유지한다.

### 5. 표시 산출물 재생성

중복 검토 결과를 기록한 뒤 일반 추천 명령을 다시 실행하지 않는다.
일반 실행은 방금 기록한 검토 결과를 덮어쓴다.

다음 명령으로 마크다운과 HTML만 다시 만든다.

```bash
bun --env-file=.env \
  scripts/study-topic-recommender/refresh_topic_inventory.ts --render-only
```

### 6. 최종 추천 정리

다음 파일을 읽고 사용자에게 보여줄 추천을 간결하게 정리한다.

- `state/topic-inventory.json`
- `reports/morning-topic-recommendation.md`
- `state/study-progress.json`
- `config/study-preferences.json`

최종 응답에는 다음 내용을 담는다.

- 카테고리별 오늘의 읽을거리
- 각 항목의 제목, 짧은 요약, 추천 이유
- 이미 공부했거나 최근 반복돼 제외한 축
- 후보 풀과 다양성 상태
- 마크다운과 HTML 산출물 경로

전체 마크다운을 채팅에 그대로 붙이지 않는다.

### 7. HTML 게시

HTML에는 공개 가능한 학습 주제, 추천 이유, HTTPS 읽을거리 링크만 포함한다.
후보자 프로필, 회사별 지원 전략, 로컬 절대 경로, 내부 상태 원문은 포함하지 않는다.

사용자가 공유 URL 또는 외부 게시를 요청하면 루트의 `report-publisher` 스킬을 읽고 그대로 따른다.

- 스킬 경로: `../.agents/skills/report-publisher/SKILL.md`
- 게시 대상: `reports/downloads/morning-reading-YYYY-MM-DD.html` 단일 파일
- 게시 이름: `morning-reading-YYYY-MM-DD`
- 워크스페이스나 `reports/` 전체를 게시하지 않는다.
- 게시 전 로컬 렌더링과 공개 범위 검사를 수행한다.
- 게시 후 배포 주소의 HTTP 상태, 제목, 주요 본문을 확인한다.

사용자가 게시를 요청하지 않았으면 HTML까지만 만들고 외부 전송은 하지 않는다.

### 8. 라이브 코딩 주제 선택

요청에 라이브 코딩이 포함되면 다음 순서로 처리한다.

1. `pools.remainingLiveCodingSeeds`를 확인한다.
2. 비어 있으면 `pools.remainingLiveCodingCandidateSeeds`를 확인한다.
3. 가장 우선도가 높은 후보 하나의 제목, `slug`, 난이도, 출력 경로를 안내한다.
4. 사용자가 선택하면 `/study-pack-writer <seed-slug>` 실행을 안내한다.

## 자체 점검

실행 후 다음 검증을 반드시 수행한다.

```bash
bun scripts/study-topic-recommender/validate_outputs.ts
bun scripts/study-topic-recommender/manage_reading_sources.ts validate
```

실패하면 원인을 진단하고 사용자에게 알린다.
검증 없이 성공했다고 보고하지 않는다.

## 실패 처리

| 상황 | 처리 |
|---|---|
| RSS 수집 실패 | 유효한 캐시가 있으면 사용하고, 없으면 해당 항목만 제외한다. |
| `bun` 미설치 | 설치 방법을 안내하고 중단한다. |
| 추천 스크립트 실패 | 표준 오류를 확인하고 원인을 보고한다. |
| `topic-inventory.json` 미생성 | 원인을 진단하고 성공으로 처리하지 않는다. |
| 후보 풀 고갈 | 목록은 기록하고 후보 보충이 필요하다고 안내한다. |
| 라이브 코딩 후보 없음 | 라이브 코딩 단계만 건너뛰고 후보 갱신 필요를 알린다. |
| 추천 이력 없음 | 첫 실행으로 보고 빈 이력으로 계속한다. |
| 중복 검토 실패 | 실패 상태를 기록하고 표시 산출물에 경고를 포함한다. |
| HTML 공개 검사 실패 | 게시하지 않고 노출 항목을 제거한 뒤 다시 검사한다. |
| Cloudflare Pages 게시 실패 | 로컬 HTML은 유지하고 게시 오류를 그대로 보고한다. |

## 소스 관리

읽을거리 소스를 추가하거나 비활성화하거나 우선순위를 바꿀 때만
[`references/source-management.md`](references/source-management.md)를 읽고 관리 명령을 사용한다.

## 호출 예시

```bash
/study-topic-recommender
/study-topic-recommender 오늘 추천을 HTML로 게시해줘
/study-topic-recommender 라이브 코딩 1개 골라줘
```
