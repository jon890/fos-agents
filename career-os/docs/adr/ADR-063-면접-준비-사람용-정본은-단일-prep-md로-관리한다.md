## ADR-063 — 면접 준비 사람용 정본은 단일 prep.md로 관리한다

- Status: Accepted
- Date: 2026-06-08

### 맥락

ADR-062로 포지션별 준비 홈은 `private/<company>/<position>/` 아래로 정리됐지만, 면접 준비 내용은 여전히 여러 파일로 흩어질 수 있었다.
예상 질문 드릴, 면접 준비 리포트, 1차 면접 전략, 1차 면접 체크리스트, 10일 Java 준비 재료를 각각 별도 파일로 노출하면 dashboard와 사람이 읽는 흐름 모두 복잡해진다.

사용자는 면접 준비 화면에서 여러 마크다운을 찾아다니기보다, 지금 당장 읽고 답변 연습할 하나의 정제된 문서를 원한다.
답변 기록이나 피드백 로그처럼 기계가 누적해야 하는 데이터는 분리할 수 있지만, 사람이 보는 준비 자산은 한 파일로 합치는 편이 낫다.

### 결정

- 포지션별 면접 준비의 사람용 정본은 `private/<company-slug>/<position-slug>/interview/prep.md` 하나로 둔다.
- `prep.md`는 다음 내용을 섹션으로 포함한다.
  - 오늘의 면접 준비 요약
  - 예상 질문 드릴
  - 추천 시작 질문
  - 1차 면접 전략
  - 1차 면접 체크리스트
  - 단기 Java 준비 중 현재 면접에 필요한 항목
  - 이미 정리된 주제와 낮은 우선순위 주제
  - 다음 액션
- `interview/current-practice.md`, `interview/reports/YYYY-MM-DD.md`, `study/interview-prep-10-day-java-materials.md`, `data/prep/<prep_dir>/strategy.md`, `data/prep/<prep_dir>/checklist.md`는 dashboard의 사람이 보는 primary asset이 아니다.
  기존 내용은 `prep.md`로 정제·흡수하고, 대체 확인 후 legacy mirror 또는 reference로 정리한다.
- 답변 기록과 피드백 로그는 사람이 보는 정본이 아니라 누적 데이터이므로 계속 분리한다.
  기본 위치는 `interview/answers/*.jsonl`, `interview/feedback/*.md`다.
- 날짜별 snapshot은 기본 생성하지 않는다.
  추적이 필요할 때만 `interview/history/YYYY-MM-DD.md`를 선택적으로 만든다.
- dashboard는 면접 hub 상단에서 `prep.md`를 우선 보여주고, 예상 질문 드롭다운도 `prep.md`의 질문 섹션에서 파싱한다.
- 공개 가능한 공부팩은 계속 `sources/fos-study/`에 만들 수 있지만, `prep.md`의 개인 답변·지원 전략·회사별 민감 맥락을 그대로 복사하지 않고 public-safe로 재작성한다.

### 결과

- 면접 준비 자료가 사람이 읽는 한 문서로 정리된다.
- dashboard 카드와 markdown 링크가 줄어들어 현재 준비 흐름이 명확해진다.
- generator와 processor는 여러 산출물을 흩뿌리는 대신 `prep.md` 갱신을 중심으로 동작한다.
- 답변/피드백 로그는 유지되어 연습 이력과 사람용 준비 문서의 책임이 분리된다.

### 적용

- `private/cj-foodville/digital-channel-backend/interview/prep.md`
- `docs/data-schema.md`
- `docs/flow.md`
- `docs/code-architecture.md`
- `docs/prd.md`
- `tasks/plan061-private-position-home-unification/` — 후속 정리에서 supersede 또는 재작성
