# Phase 05. 지원 패키지 스킬과 AGENTS.md 에서 brain 조회를 지원서 공통 프로필로 한정한다

**Execution profile**: standard

## 목표

`application-package-writer` 는 현재 지원 대상과 경력, 경험 경계를 후보자 맥락 문서에서 읽고, private brain 은 지원서 공통 프로필(연락처, 신원, 정확한 재직 기간)에만 쓴다.
`career-os/AGENTS.md` 의 「후보자에게 묻기 전에 private brain을 조회한다」 규칙을 후보자 맥락 문서 조회로 바꾼다.

**범위 외**: 공통 프로필 조회(`private-brain:career-application-profile`)와 `application-form.json` 형식은 바꾸지 않는다.

## 컨텍스트

고칠 자리다.

| 파일 | 줄 | 지금 |
| --- | --- | --- |
| `career-os/.claude/skills/application-package-writer/SKILL.md` | 32, 52, 58, 242 | `brain-search` 로 private brain 조회, 인자가 없으면 brain 의 현재 지원 대상 |
| `.../application-package-writer/references/fit-judgment.md` | 53 | 근거 순서 2번이 `brain-search` |
| `.../application-package-writer/references/evidence-source-freshness.md` | 29, 46~60 | private brain 행과 「private brain 을 경로로 확인하지 않는 이유」 절 |
| `.../application-package-writer/references/application-quality-rubric.md` | 28 | 「`brain`이나 경력기술서만 반복하지 않고」 |
| `.../application-package-writer/scripts/check_evidence_sources.ts` | 11, 41~43 | brain 에 관한 주석 |
| `.../application-package-writer/scripts/check_evidence_sources.test.ts` | 75~82 | 「private brain 의 경로를 요구하지 않는다」 테스트 |
| `career-os/AGENTS.md` | 「작업 경계」, 「후보자에게 묻기 전에 private brain을 조회한다」, 근거 자리 표 | brain 이 신원, 역할 선호, 경험 경계, 지원 이력을 소유한다고 적음 |

`.../` 는 `career-os/.claude/skills/` 다. `career-os/CLAUDE.md` 는 `AGENTS.md` 를 가리키는 symlink 라 `AGENTS.md` 만 고친다.

**근거 문서**: `career-os/docs/flow.md` 「application-package-writer」 절 1단계, `career-os/docs/data-schema.md` 「application-package-writer」 절, ADR-132

## 의도 메모

- 「묻기 전에 조회한다」 규칙의 목적(기록한 것을 다시 묻지 않기)은 유지하고 조회 대상만 바꾼다
- 조회 대상 표는 두 줄로 나눈다. 신원, 병역, 학력, 재직 기간은 brain 의 `career-application-profile`, 역할 선호, 경험 경계, 지원 상태는 후보자 맥락 문서 키다
- 확인한 사실의 환원은 「변경 전후를 보여 주고 승인받은 뒤 `manage_candidate_context.ts put`」 으로 바꾼다. 공통 프로필 사실은 여전히 brain 에 환원한다
- 스크립트가 brain 경로를 요구하지 않는다는 테스트의 목적은 유지한다. 공통 프로필이 여전히 brain 에 있다

## Blocked 조건

- `career-os/scripts/candidate-context/skill_boundary.test.ts` 가 없으면 `PHASE_BLOCKED: phase 04 전` 을 출력하고 종료한다

## 작업 항목

### 1. `career-os/.claude/skills/application-package-writer/` 수정

- `SKILL.md` 32행: 「private brain 은 지원서 공통 프로필에만 쓰고 `brain-search` 로 조회한다. 경력과 경험 경계는 `manage_candidate_context.ts get --key career-status` 로 읽는다.」
- `SKILL.md` 52, 58행: 인자가 없으면 `application-state` 문서에서 현재 지원 대상을 확인한다. 그 문서에 대상이 없거나 디렉터리가 둘 이상이면 묻는다
- `SKILL.md` 242행: 「private brain 에서 확인한 공통 프로필」 은 그대로 둔다
- `references/fit-judgment.md` 53행: `manage_candidate_context.ts get` 으로 `career-status` 와 `application-state` 를 읽는다고 바꾼다
- `references/evidence-source-freshness.md`: 29행 표에 후보자 맥락 문서 행을 더하고 private brain 행은 「지원서 공통 프로필」 로 한정한다. 46~60행 절의 제목은 두고, 60행 환원 문장을 공통 프로필과 후보자 맥락 문서로 나눈다. 59행 링크의 절 이름을 작업 항목 2 의 새 절 이름으로 맞춘다
- `references/application-quality-rubric.md` 28행: 「후보자 맥락 문서나 경력기술서만 반복하지 않고」
- `scripts/check_evidence_sources.ts` 주석: 조회는 공통 프로필에만 해당한다고 고친다. 동작은 바꾸지 않는다

### 2. `career-os/AGENTS.md` 수정

- 「작업 경계」: 「현재 지원 대상과 회사별 지원 판단은 후보자 맥락 문서 `application-state`, `position-preferences` 에서 관리한다.」, 「현재 경력, 역할 선호와 경험 경계는 후보자 맥락 문서 `career-status` 에서 확인한다.」
- 절 제목을 「후보자에게 묻기 전에 기록을 조회한다」 로 바꾼다. 첫 굵은 문장은 「본인에 관한 사실을 사용자에게 물으려는 순간, 문장을 내보내기 전에 아래 표의 자리를 조회한다.」
- 조회 표: 신원, 병역, 학력, 재직 기간은 `brain-search` 의 `career-application-profile`. 역할 선호와 경험 경계는 `manage_candidate_context.ts get --key career-status`. 지원 이력과 현재 대상은 `application-state`. 재지원 간격은 `position_exclusions`
- 「새로 확인한 사실은 사용자 승인을 받아 brain에 환원한다.」 를 공통 프로필은 brain, 나머지는 변경 전후 확인 뒤 `put` 으로 나눈다
- 근거 자리 표의 `private brain` 행을 「지원서 공통 프로필」 로 줄이고 「후보자 맥락 문서」 행을 더한다

### 3. 이 phase 를 검증하는 테스트

- `career-os/scripts/candidate-context/skill_boundary.test.ts` 수정. 검사 대상에 `application-package-writer` 를 더한다. 이 스킬에서는 `brain-search` 가 `career-application-profile` 또는 「공통 프로필」 과 같은 줄에만 나오는지 확인한다. `career-os/AGENTS.md` 에서 `brain-search` 가 조회 표의 공통 프로필 줄에만 있는지 확인한다
- `career-os/.claude/skills/application-package-writer/scripts/check_evidence_sources.test.ts` 는 절 제목을 유지하므로 그대로 통과해야 한다

## 검증

```bash
# cwd: 저장소 루트
PATH="$HOME/.bun/bin:$PATH" bun test career-os/scripts/candidate-context/skill_boundary.test.ts career-os/.claude/skills/application-package-writer/scripts/check_evidence_sources.test.ts
PATH="$HOME/.bun/bin:$PATH" bun test career-os/.claude/skills/application-package-writer/scripts
PATH="$HOME/.bun/bin:$PATH" bunx tsc --noEmit
bash ~/.claude/skills/korean-check/scripts/check.sh career-os/AGENTS.md career-os/.claude/skills/application-package-writer/SKILL.md career-os/.claude/skills/application-package-writer/references/evidence-source-freshness.md
```

모두 종료 코드 0 이어야 한다.

## 변경 파일

| 파일 | 변경 |
|---|---|
| `career-os/.claude/skills/application-package-writer/SKILL.md` | 수정 |
| `career-os/.claude/skills/application-package-writer/references/fit-judgment.md` | 수정 |
| `career-os/.claude/skills/application-package-writer/references/evidence-source-freshness.md` | 수정 |
| `career-os/.claude/skills/application-package-writer/references/application-quality-rubric.md` | 수정 |
| `career-os/.claude/skills/application-package-writer/scripts/check_evidence_sources.ts` | 수정 |
| `career-os/AGENTS.md` | 수정 |
| `career-os/scripts/candidate-context/skill_boundary.test.ts` | 수정 |
