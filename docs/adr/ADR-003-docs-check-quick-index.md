## ADR-003 — docs-check skill 도입 + adr.md Quick Index + drift Status 컨벤션

- Status: Accepted
- Date: 2026-05-15

### 맥락
현재 ai-nodes ADR 28개 (career-os/docs/adr.md 26 + ai-nodes/docs/adr.md 2) 중 폐기 명시는 *1개*(career-os ADR-004)뿐. 실제 drift된 ADR 5+개 존재 — ADR-011 (자동 보충, plan015 폐기) / ADR-006 (study-pack 라우팅, plan013 native) / ADR-007 (Q&A workflow, plan015 통합) / ADR-016 (config 통합, plan017 부분 번복) / ADR-023 (본문 "사실상 무효화" 표기 정식화 안 됨). AI 에이전트가 adr.md 본문을 Read해도 *어떤 결정이 살아있고 어떤 게 죽었는지* 추론 불가 — 토큰 효율 + 결정 정확성 둘 다 손실.

또 career-os/docs/adr.md 637줄·26 ADR이라 AI 에이전트가 *특정 ADR 찾기* 비효율. 본문 전체 Read해야 함.

fos-blog repo의 `.claude/skills/docs-check` skill이 5축 검사 (Decay / Bloat / Clarity / Duplication / Self-Evidence)으로 docs 건전성 감사 — ai-nodes에도 차용 가능.

### 결정
세 묶음 변경:

1. **adr.md 상단 Quick Index 테이블 추가** (career-os/docs/adr.md + ai-nodes/docs/adr.md 둘 다):
   - 형식: `| ADR | 제목 | Status | 한 줄 요약 |`
   - Status 값: `Accepted` / `Superseded by ADR-N` / `Partially superseded by ADR-N` / `Deprecated (date, reason)`
   - AI 에이전트가 본문 Read 없이 *어떤 결정 있는지·살아있는지* 즉시 파악
2. **drift Status 일괄 갱신** — Quick Index 작성 중 28 ADR 전수 검토 + 본문 첫 줄 Status 라인 갱신
3. **ai-nodes 전역 docs-check skill 도입** — `~/ai-nodes/skills/docs-check/SKILL.md`. fos-blog 5축 차용 + ai-nodes 도메인 변형 (Drizzle schema → config json / page.tsx → dispatcher case / SKILL.md trigger pattern)

거절한 대안:
- career-os 한정 skill: 향후 다른 워크스페이스(apartment 등)에서 ADR 도입 시 복제 필요 — 전역이 자연.
- fos-blog skill 심링크: ai-nodes 도메인 차이로 변형 운영 어려움.
- Quick Index 자동 생성: skill로 자동화하면 *Quick Index ↔ 본문* drift 위험. 수동 작성 + 새 ADR 추가 시 갱신 의무가 더 안전.

### 결과
- AI 에이전트 ADR 탐색 효율 ↑ (본문 Read 없이 Quick Index만으로 결정 매핑).
- drift 추적 가능 — Status 라인이 살아있는지 즉시 확인.
- 새 ADR 추가 비용 +1: Quick Index 한 줄 갱신.
- skill 유지보수 비용 +1: ai-nodes 도메인 변형 검사 로직 업데이트.
- 단점: Quick Index 작성 후 본문과 drift 위험 — docs-check skill의 Decay 축이 이 drift도 탐지하도록 설계.

### 적용
- 본 plan018 task 본문 phase-01 ~ phase-04 참조.
- skill 위치: `~/ai-nodes/skills/docs-check/SKILL.md` (모노레포 전역).
- 적용 대상 ADR 파일: `career-os/docs/adr.md` (26) + `~/ai-nodes/docs/adr.md` (3, 본 ADR 포함).
- `common-pitfalls/harness/6-6-write-disguised-as-prose.md` 회피: skill SKILL.md draft 별도 파일 + Read draft → Write target.

---
