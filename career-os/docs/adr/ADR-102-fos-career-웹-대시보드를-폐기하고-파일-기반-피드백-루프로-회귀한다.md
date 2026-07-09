## ADR-102 — fos-career 웹 대시보드를 폐기하고 파일 기반 피드백 루프로 회귀한다

Status: Accepted
Date: 2026-07-03

## Context

`fos-career` 웹 대시보드는 공고, 지원 후보, 면접 준비, request queue, outbox worker를 한 화면에 모으려는 방향이었다.
하지만 별도 웹 제품과 MySQL 상태 정본은 현재 career-os의 실제 가치인 반복 피드백 루프보다 무거워졌다.

최근 CJ Foodville Digital Channel Backend 지원은 2차 면접 진행 후 불합격으로 종료됐다.
피드백은 기술적 자질은 충분하나 지원동기가 명확히 받아들여지지 않았다는 평가였다.
따라서 다음 루프의 강화 대상은 단순 기술 보강만이 아니라 회사 선택 이유, 지원동기, 커리어 정합 설명까지 포함해야 한다.

## Decision

`fos-career` 웹 대시보드와 MySQL DB를 현재 career-os 아키텍처에서 폐기한다.
현재 정본은 career-os 파일과 skill 산출물로 둔다.

정본 경로:

- `data/runtime/application-agent/frontdoor-queue.jsonl`
- `data/applications/ledger.jsonl`
- `data/applications/_priority-history.jsonl`
- `data/reports/daily/YYYY-MM-DD/position-recommendation/recommendation.json`
- `private/<company>/<position>/`
- `config/mvp-target.json`

`config/mvp-target.json`은 active target이 없으면 `primary: null`을 허용한다.
종료된 타깃은 `history[]`에 `outcome`과 피드백 요약을 남긴다.

## Consequences

- 별도 dashboard DB, request queue, outbox worker를 새 정본으로 두지 않는다.
- current docs와 schema에서 `fos-career` 세부 스키마는 tombstone으로 줄인다.
- 과거 ADR과 task 기록은 history로 보존한다.
- 새 실행 루프는 `position-recommender -> job-fit-analyzer -> study-pack/application package -> interview-stage/drill -> feedback 기록 -> 다시 position-recommender`를 기본으로 한다.
- 다음 지원 준비에서는 지원동기와 회사 선택 이유를 reviewer와 면접 준비의 1급 점검 축으로 둔다.

## Supersedes

- ADR-046
- ADR-049
- ADR-050
- ADR-053
- ADR-054
- ADR-060
- ADR-061
- ADR-064
- ADR-065
- ADR-068
- ADR-078
- ADR-081
- ADR-082
- ADR-083
- ADR-084
