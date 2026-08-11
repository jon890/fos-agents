## ADR-092 — 면접 준비 flow 재편: 핏 진단과 매일 답변 드릴 분리

- Status: Accepted
- Date: 2026-06-17

### 맥락

기존 면접 준비는 interview-prep-analyzer 한 스킬이 baseline/daily/stage 3모드로 처리했다.
운영해 보니 두 가지 문제가 드러났다.

- **모드 겹침**: baseline(전체 진단)과 daily(토픽 1개 진단)는 종류가 같고 범위만 다른데 별도 모드라 중복.
- **진단·약점 데이터 단절**: baseline은 *학습 노트*만 보고 약점을 추론하고, weak_spots 갱신은 daily(거의 안 돎) + candidate-baseline-suggester(수동, 거의 안 돎)에 의존해 정체됐다. 진단이 매번 같은 갭(JPA·Redis·Kafka)을 짚어도 weak_spots에 환류되지 않았다.

면접의 본질은 "말로 즉답"인데, 그걸 훈련·측정하는 경로가 없었다.

### 결정

면접/지원 준비를 **역할별 단일 책임 스킬**로 재편한다.

- **job-fit-analyzer** (interview-prep-analyzer 리네임): 타깃 직무 대비 핏·부족분을 *역할 단위*로 1회/주기 진단. daily 모드는 제거한다. 개별 공고 단위 fit은 application-package-writer가 담당(입자 분리).
- **tech-interview-drill / behavioral-interview-drill** (신규): 매일 면접 질문에 1문장으로 답하고 채점·약점 환류하는 드릴. 기술·인성은 *물어보는 관점이 달라* 별도 스킬로 두되, 공용 드릴 엔진(질문 선정 → 대화 답변 → 채점 → 기록 → 약점 환류 → 공부팩 위임)을 공유하고 질문 풀·채점 기준만 다르게 한다.
- **면접 단계 준비 스킬** (신규, stage 분리): 1차/최종/오퍼 단계별 실전 준비를 별도 스킬로 분리한다.
- **candidate-baseline-suggester 제거**: weak_spots는 드릴이 전담(간격 반복으로 성과·재출제·retire·신규를 자동 처리)하고, 프로필 갱신은 작업이 생길 때 사람이 대화로 직접 한다.

핵심 전환: **약점 진단의 근거를 정적 학습 노트에서 실제 답변 성능으로 옮긴다.** 드릴이 답변을 3단계(통과/얕음/틀림)로 채점해 weak_spots에 직접 환류하므로 루프가 자동으로 닫히고 학습이 복리로 쌓인다.

### 결과

- 매일 답변 연습 → 실약점 진단 → 보강 공부팩으로 이어지는 닫힌 루프가 생긴다.
- weak_spots가 실제 답변 데이터로 갱신돼 정체 문제가 해소된다.
- 각 스킬이 단일 책임을 가져 사용자는 상황에 맞는 스킬만 호출한다.
- question-bank-collector(질문 수집·누적)와 study-pack-writer(공부팩 생성)는 역할 그대로 재사용한다.

### 적용

- 드릴 상태는 [[ADR-105]]를 따른다.
- 공개 질문 자산은 [[ADR-097]]를 따른다.
- 드릴 공용 코드는 `scripts/interview-drill/`에 둔다.
