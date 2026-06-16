## ADR-089 — career-os ADR을 개별 파일로 관리한다

- Status: Accepted
- Date: 2026-06-16

### 맥락

ADR이 88개·3529줄 단일 adr.md로 누적됐다.
docs-check 감사 결과 세 가지 문제가 드러났다.

- 30줄 초과 Bloat가 59건(68%) — 구현 명세(파일 목록·단계)가 ADR에 섞여 "왜"가 묻힌다.
- AI 에이전트가 특정 결정을 참조할 때 단일 파일 전체를 로드해야 해 컨텍스트 효율이 낮다.
- 완료된 폐기 ADR이 시간순으로 쌓여 신호 대비 노이즈가 크다.

ADR-018은 "adr.md 단일 출처, 개별 ADR 파일 신설 금지"를 정했으나, 88개 규모에서 단일 파일의 읽기 효율 한계가 드러났다.

### 결정

- career-os ADR을 `docs/adr/ADR-NNN-slug.md` 개별 파일과 `docs/adr/INDEX.md` 조망으로 전환한다.
- ADR 간 cross-ref는 `[[ADR-NNN]]` wiki 링크로 표기한다(fos-brain 패턴과 일관).
- 기존 `docs/adr.md`는 제거하고, 5문서 라우팅(AGENTS.md·code-architecture.md)을 `docs/adr/INDEX.md`로 갱신한다.
- ADR-018의 "개별 ADR 파일 신설 금지"를 본 ADR로 supersede한다.
- 거절한 대안 — 단일 유지 + 슬림화만: Bloat는 줄지만 "필요한 ADR만 로드"가 안 돼 읽기 효율 한계가 남는다.
- 거절한 대안 — 모노레포 전체 즉시 전환: 범위가 과대하다. career-os에서 파일럿 검증 후 확산을 별도 판단한다.

### 결과

- AI 에이전트가 INDEX에서 번호→파일을 찾아 필요한 ADR만 로드한다.
- 모노레포 비대칭은 ai-nodes ADR-015로 파일럿 예외를 기록한다([[ADR-019]] scripts 분리 같은 의도된 비대칭).
- 단점 — 88+개 파일 관리와, 전역 스킬(planning·plan-and-build·docs-check)이 career-os `adr/` 디렉터리를 인지하도록 분기하는 비용이 든다.
