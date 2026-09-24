---
name: position-recommender
description: 열려 있는 채용공고를 모아 후보자가 해온 일과 선호에 얼마나 맞는지 판단하고, 재사용 가능한 공고 분석과 대기·수집 경고를 담은 리포트를 만든다. "지원할 포지션 추천", "갈 만한 회사 찾아줘", "최신 백엔드 공고 분석", "이직 후보 추천"처럼 실제 공고 탐색과 지원 판단이 필요할 때 사용한다.
---

# position-recommender

## 목표

**지금 열린 공고 가운데 지원할 가치가 있는 것을 고르고, 그 회사가 어떤 곳인지 세 축으로 판정한다.**

- 공고의 역할이 후보자가 해온 일과 맞는가
- 그 회사에서 기술적으로 성장할 수 있는가
- 그 팀이 커지고 있는가
- 보상과 복지가 지금보다 나은가

회사의 세 축을 하나의 점수로 합치지 않는다.
공개 근거가 없는 축은 지어내지 않고 `unknown`, 즉 「근거 없음」으로 남긴다.
아직 분석하지 않은 공고도 억지로 순위를 매기지 않고 분석 대기로 남긴다.

## 판단 근거

회사 판정과 공고 점수는 [판정 기준](references/judgment.md)을 따른다.
처리할 수 없는 항목은 [실패 처리](references/failures.md)의 코드와 행동을 따른다.

공고를 분석할 때는 `brain-search`로 현재 역할 기준과 이직 우선순위를 확인한다.
구체적인 프로젝트 근거는 읽기 전용인 `sources/fos-study/task/`에서 확인한다.
큐에 든 공고만 분석하며, 닫힘 여부와 개인 제외 조건은 모델이 추측하지 않는다.

## 실행

명령은 저장소 루트에서 실행한다.
`CAREER_RECOMMENDATION_API_URL`과 token 설정이 필요하며, Backend 장애가 발생하면 파일 이력으로 전환하지 않고 중단한다.

| 명령 | 하는 일 | 다음 판단 |
| --- | --- | --- |
| `collect` | 열린 공고를 모으고 다음 큐를 만든다 | 회사 판정 또는 공고 분석 |
| `commit-company-tiers` | 회사 판정을 반영하고 공고 분석 큐를 만든다 | 공고 분석 |
| `commit-analyses` | 공고 분석을 반영한다 | 남은 분석 또는 최종화 |
| `finalize` | 추천 JSON과 검증된 HTML을 만든다 | 결과 전달 |

```bash
bun career-os/scripts/position-recommender/position_run.ts collect
bun career-os/scripts/position-recommender/position_run.ts commit-company-tiers --run <RUN_DIR>
bun career-os/scripts/position-recommender/position_run.ts commit-analyses --run <RUN_DIR>
bun career-os/scripts/position-recommender/position_run.ts finalize --run <RUN_DIR>
```

`collect`를 `--run` 없이 실행하면 stdout 첫 줄이 `<RUN_DIR>`이다.
이 값을 이후 명령에 그대로 넘긴다.
각 명령의 stdout이 다음에 읽을 큐, 모델이 결과를 쓸 경로와 다음 명령을 알린다.
반영 결과가 `partial`이면 stdout에 나온 남은 항목만 다시 판단해 같은 명령을 실행한다.

회사 판정 큐가 있으면 `<RUN_DIR>/company-evidence.json`에 저장된 근거만 읽고 판정한다.
큐의 회사마다 `<RUN_DIR>/company-tier-updates.json`에 결과를 한 건씩 쓴다.
각 결과의 `signals`에는 세 축을 한 번씩 넣고, 등급을 매긴 축에는 해당 근거의 `id`를 `evidenceIds`로 연결한다.
`evidence`에는 실제 사용한 근거의 `id`, URL, 제목과 확인 날짜를 원본 그대로 옮긴다.
근거가 없는 축은 `level: "unknown"`, `evidenceIds: []`로 남긴다.
판단을 유보한 이유와 반대 근거는 `assessment`에 적고, 공개 `reason`은 확인된 사실만 200자 안에 쓴다.
입력 파일의 실행 ID는 회사 판정 큐와 같아야 한다.

## 결과와 공개 경계

HTML은 추천, 분석한 활성 공고 순위, 회사별 세 축, 분석 대기와 수집 경고를 구분한다.
회사 판정의 공개 근거는 HTTPS URL과 확인 시각을 가져야 한다.
사용자가 공유 링크를 요청했을 때만 `report-publisher`로 게시한다.

공개 HTML과 최종 답변에는 다음 내용을 넣지 않는다.

- 후보자 기준과 개인 판단 근거
- 비공개 회사 제외 사유와 현재 보상
- 원본 오류 문구와 모델 응답 전문
- 회사 판정의 `assessment`
- 내부 경로, 환경 식별자와 token

브라우저에서 데스크톱과 모바일 배치, 가로 넘침과 주요 링크를 확인한다.
검증과 전달이 끝나면 `<RUN_DIR>`을 삭제한다.

## 최종 답변

cron 실행과 수동 실행에 같은 형식을 적용한다.
로컬 HTML 또는 검증된 공개 링크와 함께 다음 내용을 전달한다.

- 이번 실행 분석, 재사용, 분석 대기와 분석하지 못한 공고 건수
- 개인 제외 건수
- 회사 tier 출처별 건수와 회사 tier 평가 실패 건수
- 축별 「근거 없음」 회사 수(`unknownCompanyCounts`)
- 회사별 성장 범위, 팀 성장, 보상과 복지 판정과 각 근거
- 최종화 명령이 출력한 `collectionWarnings`의 각 줄
- 바로 검토할 공고와 다음 지원 행동

`collectionWarnings`는 문구를 새로 쓰지 않고 그대로 옮긴다.
배열이 비어 있으면 수집 경고 줄을 만들지 않는다.
