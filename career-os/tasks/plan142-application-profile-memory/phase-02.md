# Phase 02. 스킬과 career-os 문서의 brain 조회 안내를 CLI 로 바꾼다

**Execution profile**: standard

## 목표

`application-package-writer` 와 career-os 지침이 지원서 공통 프로필을 `brain-search` 대신 `read_application_profile.ts` 로 읽게 하고, 새 사실은 fos-assistant 웹 화면에서 고치라고 안내하게 한다.
career-os 에서 private brain 을 가리키는 마지막 자리를 없애려는 것이다.

**범위 외**: CLI 구현은 Phase 01 에서 끝났다. `career-os/docs/` 와 ADR 은 계획 커밋에서 이미 바뀌었다. `career-os/sources/`, `career-os/docs/adr/`, `career-os/tasks/` 아래의 옛 서술은 고치지 않는다.

## 컨텍스트

**근거 문서**: `career-os/docs/flow.md` 의 「지원서 공통 프로필」 절, `career-os/docs/code-architecture.md` 의 「지원서 공통 프로필」 절과 「application-package-writer」 절, `career-os/docs/adr/ADR-136-지원서-공통-프로필은-fos-assistant-memory에서-서비스-토큰으로-읽는다.md`

- 결정: `career-os/docs/adr/ADR-136-지원서-공통-프로필은-fos-assistant-memory에서-서비스-토큰으로-읽는다.md`
- 흐름, 실패 갈래와 스킬이 할 일: `career-os/docs/flow.md` 의 「지원서 공통 프로필」 절.
- CLI 와 환경 변수: `career-os/docs/code-architecture.md` 의 「지원서 공통 프로필」 절. `profileSource` 값은 같은 문서 「application-package-writer」 의 `application-form.json` 설명이 정한다.
- 스킬이 부를 명령(저장소 루트에서):

  ```bash
  bun --env-file=career-os/.env career-os/scripts/application-profile/read_application_profile.ts get --out "${TMPDIR:-/tmp}/career-application-profile.md"
  ```

  표준 출력은 `collection`, `documentKey`, `revision`, `updatedAt`, `tokenExpiresAt`, `out` 이다. 스킬은 `out` 파일을 읽어 쓴 뒤 `rm` 으로 지운다.
- Phase 01 이 만든 상수: `career-os/scripts/application-profile/contracts.ts` 의 `APPLICATION_PROFILE_SOURCE` (`"fos-assistant-memory:identity/career-application-profile"`).

## 의도 메모

- 스킬 문서에 fos-assistant 의 주소, 토큰, 개인 값 예시를 쓰지 않는다.
- 공통 프로필 사실을 career-os 가 저장하는 명령을 안내하지 않는다. 서비스 토큰은 읽기 전용이다.
- `application_form_schema.ts` 는 옛 값 `private-brain:career-application-profile` 을 읽기 전용으로 받는다. 이미 만든 `application-form.json` 을 다시 검증하면 깨지기 때문이다. 새 스냅샷은 `APPLICATION_PROFILE_SOURCE` 로 쓴다.
- 경계 테스트는 「brain 조회를 공통 프로필에만 쓴다」 에서 「career-os 스킬과 `AGENTS.md` 에 brain 조회가 없다」 로 강해진다.

## 작업 항목

### 1. `career-os/.claude/skills/application-package-writer/SKILL.md`

- 「근거 원본 최신화 확인」 절의 `private brain 은 지원서 공통 프로필에만 쓰며 \`brain-search\` 로 조회한다.` 를 아래 두 줄로 바꾼다.

  ````markdown
  지원서 공통 프로필은 fos-assistant Memory 에 있고 저장소 루트에서 아래 명령으로 읽는다.

  ```bash
  bun --env-file=career-os/.env career-os/scripts/application-profile/read_application_profile.ts get --out "${TMPDIR:-/tmp}/career-application-profile.md"
  ```

  읽은 파일은 쓰고 나서 `rm` 으로 지운다. 실패별 다음 행동은 [`flow.md`의 「지원서 공통 프로필」](../../../docs/flow.md#지원서-공통-프로필)이 소유한다.
  ````

- 단계 6 의 `private brain 에서 확인한 공통 프로필의 현재 값, 회사별 입력 선택, 첨부 파일,` 을 `fos-assistant Memory 에서 읽은 공통 프로필의 현재 값, 회사별 입력 선택, 첨부 파일,` 로 바꾼다.
- 같은 단계 6 의 그 문단에서 `…한 번의 제출 스냅샷으로 묶는다.` 바로 뒤에(`최종 제출 버튼은 …` 앞에) `공통 프로필에 없거나 틀린 값은 career-os 가 고치지 않는다. 사용자에게 fos-assistant 웹 화면에서 고치라고 알리고, 고친 뒤 다시 읽는다.` 를 더한다.

### 2. `career-os/.claude/skills/application-package-writer/references/evidence-source-freshness.md`

- 「대상 셋」 표의 마지막 행을 `| 지원서 공통 프로필 | \`read_application_profile.ts get --out\` 으로 fos-assistant Memory 에서 읽는다 | 뒤처질 사본이 없다. 아래 절이 설명한다 |` 로 바꾼다.
- 절 제목 `## private brain 을 경로로 확인하지 않는 이유` 를 `## 지원서 공통 프로필을 경로로 확인하지 않는 이유` 로 바꾼다.
- 그 절 첫 문단을 아래로 바꾼다. ADR-102 와 「interview-practice」 를 가리키던 세 줄은 지운다.

  ```markdown
  지원서 공통 프로필은 파일을 여는 곳이 아니라 `read_application_profile.ts` 로 fos-assistant Memory 에 묻는 곳이다.
  [ADR-136](../../../../docs/adr/ADR-136-지원서-공통-프로필은-fos-assistant-memory에서-서비스-토큰으로-읽는다.md)이 그렇게 정한다.
  검사기가 공통 프로필 저장소의 경로를 요구하면 조회 방식이 바뀔 때마다 검사기도 함께 고쳐야 한다.
  ```

- 「뒤처질 사본이 없다는 것이 더 큰 이유다」 문단의 `공통 프로필은 물을 때마다 현재 상태를 조회하므로` 는 그대로 둔다.
- `확인한 공통 프로필 사실은 승인을 받아 brain 에 환원하고, 후보자 맥락 문서 사실은 …` 줄을 두 줄로 나눈다.

  ```markdown
  공통 프로필에 없거나 틀린 사실은 career-os 가 고치지 않는다. 사용자에게 fos-assistant 웹 화면에서 고치라고 알린다.
  후보자 맥락 문서 사실은 변경 전후를 보여 주고 승인받은 뒤 `manage_candidate_context.ts put` 으로 저장한다.
  ```

### 3. `career-os/.claude/skills/application-package-writer/scripts/check_evidence_sources.ts`

- 머리 주석의 `` `brain-search` 로 그때그때 조회하는 지원서 공통 프로필에는 뒤처질 사본이 없다. `` 를 `` `read_application_profile.ts` 로 그때그때 읽는 지원서 공통 프로필에는 뒤처질 사본이 없다. `` 로 바꾼다.
- `EVIDENCE_SOURCES` 주석의 세 줄(`지원서 공통 프로필(private brain)도 여기 없다. …` 부터 `실행 스크립트가 brain 을 직접 조회하지 않는다고 정한다.` 까지)을 `지원서 공통 프로필도 여기 없다. fos-assistant Memory 에서 CLI 로 읽는 것이며 경로로 여는 것이 아니다(ADR-136).` 한 줄로 바꾼다.
- 코드 동작은 바꾸지 않는다.

### 4. `career-os/.claude/skills/application-package-writer/scripts/check_evidence_sources.test.ts`

- 「private brain 의 경로를 요구하지 않는다」 테스트의 주석을 `ADR-136 이 공통 프로필을 fos-assistant Memory 에서 CLI 로 읽는다고 정한다. 경로를 요구하면 조회 방식과 검사기가 묶인다.` 로 바꾼다.
- 테스트 이름을 `"지원서 공통 프로필의 경로를 요구하지 않는다"` 로 바꾼다.
- 단언 `expect(paths.some((path) => path.includes("brain"))).toBe(false);` 는 그대로 둔다.
- `expect(reference).toContain("private brain 을 경로로 확인하지 않는 이유");` 를 `expect(reference).toContain("지원서 공통 프로필을 경로로 확인하지 않는 이유");` 로 바꾼다.

### 5. `career-os/.claude/skills/application-package-writer/scripts/application_form_schema.ts`

- `import { APPLICATION_PROFILE_SOURCE } from "../../../../scripts/application-profile/contracts.ts";` 를 더한다.
- 상수 `LEGACY_PROFILE_SOURCE = "private-brain:career-application-profile"` 을 두고 그 위에 `이전에 만든 스냅샷을 다시 검증할 수 있게 받는다. 새로 쓰지 않는다.` 주석을 단다.
- `profileSource: z.literal("private-brain:career-application-profile"),` 를 `profileSource: z.enum([APPLICATION_PROFILE_SOURCE, LEGACY_PROFILE_SOURCE]),` 로 바꾼다.

### 6. `render_application_package.test.ts` 와 `validate_application_package.test.ts`

경로는 `career-os/.claude/skills/application-package-writer/scripts/` 아래다.

- 두 파일의 `profileSource: "private-brain:career-application-profile",` 를 `profileSource: "fos-assistant-memory:identity/career-application-profile",` 로 바꾼다.
- `validate_application_package.test.ts` 에 테스트 둘을 더한다. 기존 `form(answer)` 와 `write` helper 를 쓴다.
  - 옛 값 `private-brain:career-application-profile` 을 담은 폼은 형식 오류(`형식이 올바르지 않습니다`)가 없다.
  - `profileSource` 가 `"unknown-source"` 인 폼은 `evidence/application-form.json 형식이 올바르지 않습니다` 오류가 난다.
  - 두 테스트의 이름에 `private-brain` 문자열을 넣지 않는다. 옛 값 문자열은 fixture 값 한 곳에만 둔다. 검증 절의 `git grep` 기대값이 그 파일에서 한 줄이다.
  - `form` 이 `profileSource` 를 바꿀 수 없으면 두 번째 인자 `profileSource = "fos-assistant-memory:identity/career-application-profile"` 를 더한다.

### 7. `career-os/scripts/candidate-context/skill_boundary.test.ts`

- `candidateContextSkills` 배열에 `"application-package-writer"` 를 더한다. 그러면 그 스킬도 `brain-search`, `brain-add`, `private brain` 을 담지 않는지 본다.
- 「application-package-writer 는 brain-search 를 공통 프로필 조회에만 쓴다」 테스트를 지운다.
- 「career-os/AGENTS.md 는 brain-search 를 조회 표의 공통 프로필 줄에만 둔다」 테스트를 아래로 바꾼다.
  - 이름 `"career-os/AGENTS.md 는 공통 프로필을 read_application_profile.ts 로 읽게 한다"`.
  - `AGENTS.md` 본문에 `removedTerms` 의 셋이 모두 없다.
  - `career-application-profile` 을 담은 줄이 4 줄 이상이고, 그 줄이 모두 `|` 로 시작하며 `read_application_profile.ts` 를 담는다.
- `removedTerms` 는 그대로 둔다.
- 새 테스트 `"application-package-writer 는 공통 프로필을 CLI 로 읽게 한다"` 를 더한다. `application-package-writer/SKILL.md` 본문이 `bun --env-file=career-os/.env career-os/scripts/application-profile/read_application_profile.ts get --out` 을 담는다.

### 8. `career-os/AGENTS.md`

- 「후보자에게 묻기 전에 기록을 조회한다」 표의 `brain-search` 네 행의 오른쪽 칸을 `` `read_application_profile.ts get --out` 의 `career-application-profile` `` 로 바꾼다. 표의 열 정렬은 맞춘다.
- `새로 확인한 공통 프로필 사실은 사용자 승인을 받아 brain에 환원한다.` 를 `공통 프로필에 없거나 틀린 사실은 career-os 가 고치지 않는다. 사용자에게 fos-assistant 웹 화면에서 고치라고 알린다.` 로 바꾼다.
- 「프로젝트 근거는 …」 절 자리 표의 `| private brain | 지원서 공통 프로필(신원, 연락처, 정확한 재직 기간) |` 행을 `| fos-assistant Memory 의 \`identity\` 문서 | 지원서 공통 프로필(신원, 연락처, 정확한 재직 기간). \`read_application_profile.ts get --out\` 으로 읽는다 |` 로 바꾼다.

### 9. `career-os/README.md`

`연락처와 신원을 담은 지원서 공통 프로필만 private brain 에 있다.` 를 `연락처와 신원을 담은 지원서 공통 프로필은 fos-assistant Memory 에 있고 서비스 토큰으로 읽기만 한다. 연결값 \`FOS_ASSISTANT_URL\`, \`FOS_ASSISTANT_SERVICE_TOKEN\` 을 \`.env\` 에 둔다.` 로 바꾼다.

## 검증

저장소 루트에서 실행한다.

```bash
bunx tsc --noEmit
bun test ./career-os/scripts/candidate-context/skill_boundary.test.ts ./career-os/.claude/skills/application-package-writer/scripts/check_evidence_sources.test.ts ./career-os/.claude/skills/application-package-writer/scripts/validate_application_package.test.ts ./career-os/.claude/skills/application-package-writer/scripts/render_application_package.test.ts
bun test ./career-os/scripts ./career-os/.claude/skills
! git grep -n -i "brain-search\|private brain" -- career-os ':!career-os/sources' ':!career-os/docs/adr' ':!career-os/tasks' ':!career-os/scripts/candidate-context/skill_boundary.test.ts' ':!career-os/scripts/study-topic-recommender/skill_doc.test.ts' ':!career-os/.claude/skills/application-package-writer/scripts/*.test.ts'
git grep -n "private-brain" -- career-os ':!career-os/sources' ':!career-os/docs/adr' ':!career-os/tasks'
```

- 앞의 넷은 종료 코드 0 이다. 네 번째는 금지 문자열을 단언하는 두 테스트 파일과 이 phase 가 고치는 스킬 테스트를 뺀 나머지에 `brain-search` 와 `private brain` 이 없음을 본다.
- 다섯 번째의 출력은 세 줄이다. `application_form_schema.ts` 의 `LEGACY_PROFILE_SOURCE`, `validate_application_package.test.ts` 의 옛 값 테스트, `docs/code-architecture.md` 의 옛 값 설명이다.
- `bun test` 출력에 `skill_boundary.test.ts`, `check_evidence_sources.test.ts`, `validate_application_package.test.ts`, `render_application_package.test.ts` 가 나오고 실패가 0 이다.

## 변경 파일

| 파일 | 변경 |
|---|---|
| `career-os/.claude/skills/application-package-writer/SKILL.md` | 수정 |
| `career-os/.claude/skills/application-package-writer/references/evidence-source-freshness.md` | 수정 |
| `career-os/.claude/skills/application-package-writer/scripts/check_evidence_sources.ts` | 수정 |
| `career-os/.claude/skills/application-package-writer/scripts/check_evidence_sources.test.ts` | 수정 |
| `career-os/.claude/skills/application-package-writer/scripts/application_form_schema.ts` | 수정 |
| `career-os/.claude/skills/application-package-writer/scripts/render_application_package.test.ts` | 수정 |
| `career-os/.claude/skills/application-package-writer/scripts/validate_application_package.test.ts` | 수정 |
| `career-os/scripts/candidate-context/skill_boundary.test.ts` | 수정 |
| `career-os/AGENTS.md` | 수정 |
| `career-os/README.md` | 수정 |
