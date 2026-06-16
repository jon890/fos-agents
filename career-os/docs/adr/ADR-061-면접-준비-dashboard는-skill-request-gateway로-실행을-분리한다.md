## ADR-061 — 면접 준비 dashboard는 skill request gateway로 실행을 분리한다

- Status: Accepted
- Date: 2026-06-07

### 맥락

CJ푸드빌 2026-06-15 면접 준비는 기존 career-os 자산을 빠르게 확인하고 부족한 준비 자산을 즉시 만들 수 있어야 한다.
이미 `interview-prep-analyzer`, `interview-asset-writer`, `study-pack-writer` native skill이 있으므로 새 generator를 만드는 것보다 dashboard에서 요청을 만들고 안전한 processor가 기존 skill을 호출하는 편이 작다.

하지만 dashboard가 직접 `claude -p`를 실행하거나 career-os writable mount를 가지면 read-only 경계가 깨진다.
또 skill request result와 audit log에 처리 결과를 크게 저장하면 private 면접 문서와 command stdout이 dashboard persistence로 새어 나갈 수 있다.
면접 대화 답변과 피드백은 별도 private answer/session DB에 저장해 dashboard에서 조회하는 것이 맞다.

### 결정

- plan060을 CJ푸드빌 면접 skill request gateway로 연다.
- fos-career dashboard는 CJ푸드빌 2026-06-15 면접 준비 hub를 제공한다.
- hub는 career-os 자산을 read-only projection으로 보여준다.
  상태, 파일 경로, 짧은 요약, 다음 요청 후보만 표시한다.
- dashboard는 skill을 직접 실행하지 않고 request queue만 만든다.
- processor가 pending request를 읽고 allowlist와 stale guard를 확인한 뒤 career-os writable checkout에서 native skill을 호출한다.
- allowlist는 기존 skill 3개로 제한한다.
  - `interview-prep-analyzer`
  - `interview-asset-writer`
  - `study-pack-writer`
- 면접 대비 중 공부해야 할 주제가 생기면 dashboard에서 `study-pack-writer` 요청을 만들 수 있다.
  이 요청은 공개 가능한 순수 기술 주제일 때만 허용한다.
- `study-pack-writer` 요청은 `sources/fos-study/`에 `[초안]` 제목의 공부팩 초안을 생성한다.
  commit/push는 ADR-086에 따라 사용자 명시 승인 뒤에만 수행한다.
  승인된 push가 실패하면 요청 실패로 남긴다.
- dashboard는 예상 질문별 답변 텍스트 입력을 받고 private answer record를 만든다.
- answer record는 feedback request와 연결한다.
  processor는 관련 prep/report 경로와 답변을 바탕으로 강점, 리스크, 권장 수정 방향을 제공한다.
- 면접 대화 세션 UX는 다음 흐름으로 고정한다.
  - 질문 생성/선택
  - 답변 입력
  - 피드백
  - 꼬리질문
  - 답변
  - 최종 요약/보완 주제/study-pack 후보
- 면접 대화 답변 전문은 DB에 저장한다.
  사용자가 서버 파일을 찾지 않고 dashboard에서 바로 볼 수 있어야 한다.
- 상세 피드백도 DB에 저장한다.
  dashboard에서 바로 확인할 수 있어야 한다.
- 면접 대화 세션은 기본 5턴으로 시작한다.
  사용자가 원하면 자유형으로 연장할 수 있다.
- 피드백은 점수화한다.
  기본 기준은 기술 정확성, 경험 연결, 답변 구조, CJ푸드빌 맥락 반영이다.
- study-pack 생성 요청은 고정 추천 후보뿐 아니라 사용자 자연어 요청도 받는다.
  예: "어떤 스터디팩 만들어줘" 같은 입력을 public-safe topic으로 정규화한다.
- 사용자가 인터뷰 중 특정 주제를 정말 모르겠다고 느끼면 해당 turn에서 직접 `study_pack` request를 만들 수 있다.
- 2026-06-15 CJ푸드빌 면접 종료 후 해당 면접모드는 read-only/archive 상태로 전환한다.
  archive 상태에서는 새 질문, 새 답변, 새 feedback request를 만들지 않는다.
- 결과 저장은 상태, 파일 경로, 짧은 요약, 오류 요약으로 제한한다.
  이는 skill request result와 audit log의 저장 제한이다.
- private 문서 본문, 면접 답변 전문, 상세 피드백, command stdout 전체는 request result, audit log, Discord 알림, fos-study로 복사하지 않는다.
- 외부 제출, 공개 발행, 로그인, 업로드, candidate-profile 자동 수정은 금지한다.
- 구현 phase에서는 docs/ADR/정책 문서를 수정하지 않는다.
  계약이 부족하면 구현을 멈추고 `PHASE_BLOCKED`로 보고한다.

### 결과

- dashboard는 면접 준비 hub로 쓰이지만 career-os 실행 권한을 직접 갖지 않는다.
- 기존 native skill 자산을 재사용해 새 자동화 표면을 줄인다.
- request row와 audit log는 운영 상태를 남기되 private 자료 본문을 저장하지 않는다.
- docs-first 결정과 implementation 실행을 분리해 구현 중 정책 drift를 줄인다.

### 적용

- `tasks/plan060-interview-skill-request-gateway/` — 후속 구현 계획.
- `docs/prd.md`
- `docs/data-schema.md`
- `docs/flow.md`
- `docs/code-architecture.md`
