## ADR-058 — data cleanup은 private boundary와 retention을 먼저 고정한다

- Status: Accepted
- Date: 2026-06-07

### 맥락

plan056 phase-01 inventory에서 현재 checkout의 실제 `data/` 파일은 `data/runtime/live-position-postings.plan048-final.md`와 `data/runtime/live-position-postings.plan048-smoke.md` 두 tracked runtime exception뿐이었다.
하지만 docs에는 이미 `data/applications/`, `data/reports/`, `data/runtime/`, `data/source/`가 여러 흐름의 책임 위치로 쓰이고 있고, 당시 phase 계획은 `data/private/`까지 boundary로 다뤘다.
[[ADR-062]] 이후 회사·포지션별 작업 홈은 루트 `private/` 아래로 이동했다.

지원 준비, 면접 준비, 후보자 맥락, 회사별 전략이 섞이는 data 파일은 공개 가능성을 추정하기 어렵다.
오래된 파일을 바로 삭제하면 검증 evidence, task history, coffeechat deprecation 이력, plan048 snapshot 같은 맥락이 사라질 수 있다.
따라서 cleanup은 파일 이동이나 삭제보다 경계와 보존 원칙을 먼저 고정해야 한다.

### 결정

- `data/` 아래 파일은 private by default로 본다.
  공개 가능성은 별도 review와 사용자 승인으로만 승격한다.
- `data/applications/`는 공고별 지원 원장, 맞춤 지원 패키지, resume draft, cover letter, review의 private home이다.
- `data/private/`는 private-only 보관과 archive home으로 둔다.
  이 항목은 [[ADR-062]] 이후 루트 `private/` 정책으로 대체됐다.
- `data/source/`는 외부 source text와 notes의 입력 위치다.
  외부 공개 페이지에서 왔더라도 특정 지원, 면접, 회사 전략과 연결되면 private by default로 다룬다.
- `data/reports/`는 generated report 위치다.
  최근 운영 판단, task/ADR 근거, application/interview prep 참조가 있는 report는 보존한다.
  참조가 없고 새 report나 docs 결정으로 대체된 report는 retention 검토 후 archive 후보로 둔다.
- `data/runtime/`은 최신 projection, cache, lock, eval result 같은 가변 상태 위치다.
  장기 근거가 필요한 runtime 파일은 report, task evidence, private archive 중 하나로 승격 여부를 별도 결정한다.
- plan048의 두 tracked runtime file은 named exception으로만 다룬다.
  일반 runtime 추적 규칙으로 확장하지 않는다.
- coffeechat 자동화 tombstone은 이번 결정에서 삭제하지 않는다.
  후속 phase에서 active caller 부재, history 가치, archive 필요성을 확인한 뒤 tombstone/archive/retention 중 하나로 결정한다.

거절한 대안:

- 오래된 `data/` 파일을 바로 삭제하기.
  history와 검증 evidence를 잃을 수 있고, private data 경계를 확정하지 못한다.
- 모든 generated report를 영구 보존하기.
  runtime/report가 operational cache처럼 누적되어 active 판단과 history가 흐려진다.
- `data/source/`를 공개 source라는 이유로 public-safe로 보기.
  수집 원문이 지원/면접 맥락과 결합되는 순간 private 분석 입력이 된다.
- tracked runtime exception을 일반 정책으로 인정하기.
  `data/runtime/`의 가변 상태 원칙과 충돌한다.

### 결과

- cleanup phase는 삭제 중심이 아니라 archive, tombstone, retention 중심으로 진행된다.
- `data/applications`, private archive, `data/source`, `data/reports`, `data/runtime`의 책임이 분리된다.
- future worker는 private 원문을 task/docs에 복사하지 않고 path와 classification만 다룬다.
- phase-03 이후 runtime exception이나 coffeechat tombstone을 정리할 때 이 ADR을 기준으로 named decision을 남긴다.

### 적용

- `tasks/plan056-data-boundary-and-legacy-cleanup/` — 구현 계획.
- `docs/data-schema.md` — data boundary와 보존 원칙의 단일 출처.
- `docs/code-architecture.md` — 디렉터리 책임.
- `docs/flow.md` — cleanup/retention 흐름.
