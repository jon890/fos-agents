## ADR-058 — data cleanup은 private boundary와 retention을 먼저 고정한다

- Status: Accepted
- Date: 2026-06-07

### 맥락

[[ADR-062]] 이후 포지션별 작업 홈이 루트 `private/` 아래로 이동했다.
지원·면접·회사별 전략이 섞이는 `data/` 파일은 공개 가능성을 추정하기 어렵고,
오래된 파일을 바로 삭제하면 검증 evidence와 history 맥락을 잃는다.
따라서 cleanup은 삭제보다 경계와 보존 원칙을 먼저 고정해야 한다.

### 결정

- `data/` 아래 파일은 private by default로 본다. 공개 승격은 별도 review와 사용자 승인으로만 한다.
- 서브디렉토리 책임: `data/applications/`는 지원 원장·패키지·리뷰, `data/source/`는 외부 수집 텍스트, `data/reports/`는 생성 리포트, `data/runtime/`은 가변 상태다.
- cleanup은 삭제가 아니라 archive·tombstone·retention 원칙으로 진행한다.
- plan048 tracked runtime file 2개는 named exception으로만 다루고 일반 정책으로 확장하지 않는다.
- coffeechat tombstone은 후속 phase에서 active caller 부재와 history 가치를 확인한 뒤 결정한다.

거절한 대안:

- 오래된 파일을 바로 삭제하기: history와 검증 evidence를 잃고 private 경계를 확정하지 못한다.
- 모든 report를 영구 보존하기: runtime이 cache처럼 누적되어 active 판단이 흐려진다.
- `data/source/`를 public-safe로 보기: 지원/면접 맥락과 결합되면 private 분석 입력이 된다.
- tracked runtime exception을 일반 정책으로 인정하기: `data/runtime/` 가변 상태 원칙과 충돌한다.

### 결과

- cleanup은 archive·tombstone·retention 기반으로 진행되며 삭제 중심이 아니다.
- future worker는 private 원문을 task/docs에 복사하지 않고 path와 classification만 다룬다.
- 이후 정리 시 이 ADR을 기준으로 named decision을 남긴다.
