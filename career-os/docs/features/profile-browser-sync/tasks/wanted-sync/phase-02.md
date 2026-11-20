# Phase 02. 원티드 칸 모델과 탭 안 스크립트

**Execution profile**: standard

## 목표

원티드 응답을 칸 목록으로 바꾸는 순수 로직, 도구 인자 검사, 원티드 탭 안에서 돌릴 스크립트를 만든다. 아직 도구로 등록하지 않는다.

**범위 외**: 도구 흐름과 등록(phase 3), 문서와 ADR(phase 4).

## 컨텍스트

**요구사항**: REQ3, REQ9

**근거 문서**: `career-os/docs/features/profile-browser-sync/spec.md`, `career-os/docs/features/profile-browser-sync/design.md` 의 「칸 id」, 「도구」

- 원티드 화면 지식의 원본은 `career-os/plugin/skills/sync-profile/references/wanted.md` 와 같은 폴더 `scripts/wanted_set_field.sh`, `wanted_set_period.sh`, `wanted_list_fields.sh` 다. 탭 안 스크립트는 이 셋을 JS 함수 글로 옮긴다.
- 이력서 API: 원티드 탭 안에서 `fetch("/api/chaos/resumes/v2/" + encodeURIComponent(key), {headers: {accept: "application/json"}})`. 응답 최상위에 `resume`(소개 `about`), `careers[].projects[]`(`title`, `description`), `skills`, `links` 가 있다. AI 활용 경험은 `/api/chaos/resumes/v1/<key>/ai-competencies` 의 `data` 다.
- 편집 화면 주소는 `https://www.wanted.co.kr/cv/<resumeKey>`, 목록 화면은 `https://www.wanted.co.kr/cv/list` 다.

## 의도 메모

- 화면 칸은 순번으로 찾지 않는다. 설계 「칸 id」 의 규칙대로 서버의 지금 제목과 같은 제목 칸이 화면에 하나인 프로젝트 상자를 찾고, 본문과 기간 단추는 그 상자 안에서만 찾는다. `title`, `description` 키는 성과 항목에도 쓰인다.
- 넣을 값은 `JSON.stringify` 로 스크립트에 끼워 넣는다. 셸을 거치지 않으므로 base64 는 필요 없다.
- DOM 라이브러리를 새로 들이지 않는다. 스크립트는 컴파일과 표지 글만 테스트하고 화면 조작은 실제 계정 확인에서 본다(설계 「검증 전략」).

## 작업 항목

### 1. `career-os/plugin/src/wanted/fields.ts` 신규

- `normalizeText(v)`(CRLF→LF, 앞뒤 공백 제거), `normalizeMonth(v)`(`"2026.1"`, `"2026.01"`, `"2026-01"` → `"2026-01"`, 그 밖은 `null`), `fingerprint(v)`(정규화 값 SHA-256 앞 16자리 16진수, `node:crypto`).
- `type WantedField = {field: string; label: string; value: string; fingerprint: string}`.
- `fieldsFromResume(api, periods)`: `about` 과 프로젝트 칸 넷. `periods` 는 화면에서 읽은 `[{c, p, start, end}]` 이고 상자를 못 찾은 프로젝트는 `null` 이다. 그 프로젝트의 기간 칸은 목록에서 빼고 `unreadable` 배열에 그 칸의 `label` 을 넣는다(읽지 못한 기간을 빈 값으로 보이지 않는다). 반환은 `{fields, unreadable}`. 회사 이름은 `careers[c]` 의 회사 이름 칸 후보(`company_name`, `company.name`)에서 읽고, 없으면 「경력 c+1」. `label` 은 「<회사> / <프로젝트 제목 또는 빈 항목> / 본문」 꼴.
- `outOfScopeFromResume(api, ai)`: `{skills: string[], links: string[], aiCompetencies: string[]}`. 모양을 모르는 항목은 건너뛴다.
- `parseField(field)`: `about` 또는 `project:<c>:<p>:<title|description|start|end>` 를 객체로, 그 밖은 `null`.
- zod `getWantedResumeSchema = z.strictObject({resumeKey: z.string().trim().min(1).max(200).optional()})`.
- zod `updateWantedResumeSchema`: `resumeKey`(1자 이상 200자 이하), `resumeTitle`(1자 이상 100자 이하), `changes` 1개 이상 30개 이하 `{field, label(1자 이상 200자 이하), before(^[0-9a-f]{16}$), value}`. `field` 는 `parseField` 가 받는 모양만, 기간 칸 `value` 는 `normalizeMonth` 가 받는 모양, 글 칸 `value` 는 정규화 뒤 비지 않은 글. `field` 중복 거절. `superRefine` 으로 인자 JSON 의 UTF-8 이 16,000바이트를 넘으면 실패.

### 2. `career-os/plugin/src/wanted/page.ts` 신규

모두 `Runtime.evaluate` 로 돌릴 식(글)을 돌려주는 함수다. 결과는 고정 표지 글이나 JSON 글이다.
- `pageStateScript()`: 주소와 화면으로 `EDIT`, `LIST`, `LOGIN`, `OTHER`. 주소가 `/cv/` 아래가 아니고 로그인·회원 화면(주소에 `login`, `signin`, `id.wanted`)이면 `LOGIN`.
- `listResumesScript()`: 목록 화면의 이력서 항목(`[class*=ResumeItem_ResumeItem__title__]` 의 항목)에서 `{resumeKey, title, updatedAt}` 배열. 키는 항목 링크의 `/cv/<key>` 에서 읽고, 없으면 그 항목을 건너뛴다.
- `readResumeScript(key)`: 두 API 를 읽어 `{status: "OK", resume, ai}` 또는 401·403 이면 `{status: "LOGIN"}`, 404 면 `{status: "NOT_FOUND"}`.
- `readPeriodsScript(titles)`: 프로젝트 제목 배열을 받아, 제목마다 위 규칙의 상자를 찾아 기간 단추 둘의 글(`YYYY.MM` 또는 `YYYY.MM` 표시 없음)을 돌려준다. 상자를 못 찾은 제목은 `null`.
- `fieldValueScript(target)`: `target` 은 `{kind: "about"}` 또는 `{kind: "title" | "description" | "start" | "end", projectTitle}`. 찾은 칸의 지금 값, 못 찾거나 여럿이면 `NO_ELEMENT` / `AMBIGUOUS`.
- `setTextScript(target, value)`: `wanted_set_field.sh` 와 같은 순서(`execCommand('insertText')` 뒤 `__reactProps` 의 `onBlur`). 결과 `OK` 또는 `NO_ELEMENT`, `AMBIGUOUS`, `TOO_LONG`, `INSERT_FAIL`, `NO_PROPS`.
- `setPeriodSteps(projectTitle, which, year, month)`: `wanted_set_period.sh` 의 열기, 연도, 월, 확인 네 단계 식과 단계 사이의 대기 조건 식 배열.

### 3. 테스트

- `career-os/plugin/src/wanted/fields.test.ts`: 정규화와 지문(같은 값 같은 지문, CRLF 와 LF 같은 지문), 칸 목록(회사 이름 없을 때 「경력 1」), 범위 밖 정리, 인자 검사(범위 밖 `field` 인 `skills`, 중복 `field`, 16,000바이트 초과, 기간 모양 `2026/01` 거절, 빈 글 거절).
- `career-os/plugin/src/wanted/page.test.ts`: 각 식이 `new Function("return " + expr)` 으로 컴파일되고, 따옴표·백슬래시·줄바꿈·`</script>` 가 든 값이 식 안에 그대로 보존된다(식을 컴파일해 값을 꺼내는 작은 대역으로 확인).

## 검증

```bash
cd career-os/plugin && bun run typecheck
cd career-os/plugin && bun test src/wanted/fields.test.ts src/wanted/page.test.ts
cd career-os/plugin && bun test
```

## 변경 파일

| 파일 | 변경 |
|---|---|
| `career-os/plugin/src/wanted/fields.ts` | 신규 |
| `career-os/plugin/src/wanted/page.ts` | 신규 |
| `career-os/plugin/src/wanted/fields.test.ts` | 신규 |
| `career-os/plugin/src/wanted/page.test.ts` | 신규 |
