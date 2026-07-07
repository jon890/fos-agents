## ADR-106 — topic-file-map 폐기 + 참조 doc 정리

- Status: Accepted
- Date: 2026-07-07

### 맥락

`config/topic-file-map.json`은 daily report용 토픽 → fos-study 파일 목록 수동 매핑이다(ADR-001).

어떤 SKILL·스크립트도 이 파일을 읽지 않는다.
`grep -rn topic-file-map scripts/ .claude/` 결과가 0건이다.
소비자였던 interview-prep-analyzer는 이미 폐기됐고(ADR-027), daily 파일 선택은 fos-study inventory 스캔으로 이동했다(ADR-033).

단순 삭제로 끝나지 않는다.
아래 활성 문서가 이 파일을 참조하므로, 삭제하면 깨진 참조가 남는다.

- `docs/data-schema.md`
- `docs/code-architecture.md`
- `docs/adr/ADR-016`
- `docs/adr/ADR-001`
- `tasks/plan017-interview-prep-analyzer-native`

### 결정

`config/topic-file-map.json`을 삭제하고, 활성 참조 문서를 함께 정리한다.

- 파일을 삭제한다. 어떤 코드도 읽지 않는 고아 config다.
- daily 토픽 → 파일 선택 정본은 fos-study inventory 스캔이다(ADR-033).
  수동 매핑을 되살리지 않는다.
- 정리 범위는 위 다섯 참조로 고정한다.
  - `data-schema.md`·`code-architecture.md`에서 topic-file-map 스키마·트리 항목을 제거한다.
  - `ADR-016`·`ADR-001`의 topic-file-map 언급은 폐기 사실을 반영하되 결정 history 자체는 지운다.
  - `plan017` task 참조는 완료된 실행 이력이므로 본문을 고치지 않는다.
- 폐기 스키마는 `data-schema.md`에 남기지 않는다(ADR-098).
  폐기 이유와 history의 단일 출처는 본 ADR이다.
- 이미 완료된 다른 plan(plan002·plan019·plan028·plan068)의 task 본문은 history이므로 정리 대상에서 제외한다.

### 결과

- 읽는 코드가 없는 고아 config가 사라진다.
- daily 파일 선택의 단일 정본이 fos-study inventory로 선명해진다.
- 폐기 항목 스키마가 data-schema에서 빠져 문서 노이즈가 줄어든다.

### 적용

- 구현은 plan092 Phase 05로 옮긴다.
- `config/topic-file-map.json`을 삭제한다.
- `data-schema.md`·`code-architecture.md`에서 topic-file-map 스키마·트리 항목과 정리 후보 문구를 제거한다.
- `ADR-016`·`ADR-001`의 언급을 폐기 반영으로 정리한다.
- 삭제 후 `grep -rn topic-file-map docs/ config/`가 활성 참조 0건인지 검증한다(완료된 plan task 제외).
- 폐기 항목 스키마 위임 원칙은 [[ADR-098]]을 따른다.
