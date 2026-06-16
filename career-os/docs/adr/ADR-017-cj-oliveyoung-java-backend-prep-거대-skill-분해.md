## ADR-017 — cj-oliveyoung-java-backend-prep 거대 skill 분해

- Status: Accepted
- Date: 2026-05-13

### 맥락
단일 dispatcher skill이 4개 도메인(라우팅·갭분석·추천·보충)을 혼재. WIP 3개 entrypoint가 1개월 넘게 dispatcher와 미연결. 폴더명에 폐기 회사명 박힘 → 새 기능 위치 매번 결정 필요 + 코드·문서 오염.

### 결정
- 기능·도메인 기준 5개 skill로 분해: command-router(디스패처), knowledge-gap-analyzer(갭분석), study-topic-recommender(추천), topic-pool-replenisher(보충), study-pack-batch(배치).
- WIP 3개(bootcamp-batch·live-coding-dispatch·auto-question-bank)를 dispatcher에 연결.
- morning-question-bank는 experience-question-bank-writer에 흡수.
- skills/<name>/scripts/ 구조 유지(실행 파일 이전은 [[ADR-019]]/plan006). cj-foodville-coffeechat-prep 회사명 제거는 별도 사이클.

거절 대안: core/dispatcher 같은 짧은 이름(의미 과집중), WIP를 별도 plan으로 미룸(회사명·미연결이 한 사이클에 사라져야 함).

### 결과
- 도메인별 책임이 폴더명으로 자명해짐. 폐기 회사명 잔재 제거.
- WIP 3개가 운영 가능 상태(기존 silently dormant). 폴더 수 7 → 11이나 응집도 상승으로 상쇄.

### 적용
- tasks/plan005-cj-oliveyoung-decomposition/ 참조.
- depends_on: plan002(config 통합), plan004(notify_discord.sh 합류 시점 조율).
