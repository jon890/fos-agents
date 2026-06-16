## ADR-061 — 면접 준비 dashboard는 skill request gateway로 실행을 분리한다

- Status: Accepted
- Date: 2026-06-07

### 맥락

면접 준비 hub가 필요하지만 dashboard가 `claude -p`를 직접 실행하거나 career-os writable mount를 가지면 read-only 경계가 깨진다.
또한 skill request result와 audit log에 처리 결과를 크게 저장하면 private 면접 문서와 command stdout이 dashboard persistence로 새어 나갈 수 있다.
이미 `interview-prep-analyzer`, `interview-asset-writer`, `study-pack-writer` native skill이 존재하므로 새 generator를 만드는 것보다 dashboard에서 요청을 만들고 안전한 processor가 기존 skill을 호출하는 편이 낫다.

### 결정

- dashboard는 career-os 자산을 read-only projection으로 보여준다.
  상태, 파일 경로, 짧은 요약, 다음 요청 후보만 표시한다.
- dashboard는 skill을 직접 실행하지 않고 request queue만 만든다.
  processor가 pending request를 읽고 allowlist와 stale guard를 확인한 뒤 career-os writable checkout에서 native skill을 호출한다.
  이유: read-only 경계를 유지하면서 기존 native skill 자산을 재사용해 새 자동화 표면을 줄일 수 있다.
- allowlist는 기존 native skill 3개(`interview-prep-analyzer`, `interview-asset-writer`, `study-pack-writer`)로 제한한다.
- `study-pack-writer` 요청은 공개 가능한 순수 기술 주제일 때만 허용하고, fos-study commit/push는 사용자 명시 승인 뒤에만 수행한다.
- 면접 대화 답변 전문과 상세 피드백은 DB에 저장하되, private 문서 본문과 command stdout 전체는 audit log·Discord·fos-study로 복사하지 않는다.
- 외부 제출, 공개 발행, 로그인, 업로드, candidate-profile 자동 수정은 금지한다.

거절한 대안:

- dashboard가 직접 `claude -p` 실행: read-only 경계를 깨고 private 자료가 dashboard persistence로 유출될 위험이 있다.

### 결과

- dashboard는 면접 준비 hub로 쓰이지만 career-os 실행 권한을 직접 갖지 않는다.
- request row와 audit log는 운영 상태를 남기되 private 자료 본문을 저장하지 않는다.
- docs-first 결정과 implementation 실행을 분리해 구현 중 정책 오차(drift)를 줄인다.
