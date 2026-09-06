# Phase 03 검토 화면을 탭으로 바꾸고 템플릿을 분리한다

**Execution profile**: deep

---

## 목표

`application-package.html`을 네 탭으로 나누고, HTML 골격과 CSS를 렌더러 스크립트에서 템플릿 파일로 분리한다.
화면 구조를 바꿀 때 렌더 로직을 읽지 않아도 되게 하는 것이 목적이다.

**범위 외**: 산출물 경로와 섹션 계약은 phase 01과 02가 이미 바꿨다.

---

## 컨텍스트

`career-os/.claude/skills/application-package-writer/scripts/render_application_package.ts`는 663줄이며 CSS와 HTML 골격이 문자열로 들어 있다.
지금 화면은 상태 배지와 결론을 상단에 두고, 승부처·지원동기·보완할 공백·다음 행동을 카드로 펼친 뒤 나머지를 접이식으로 둔다.
`PRIMARY_SECTION_TITLES` 상수가 그 네 카드를 정한다.

다음 함수는 그대로 재사용한다. 새로 만들지 않는다.

- `splitSections`, `renderMarkdown`, `inlineMarkdown`, 표 렌더링 부분
- `statusFrom`, `documentTitle`, `slug`, `escapeHtml`
- `applicationFormDrawer`, `renderInterviewQuestions`

`posting.md`는 지금 렌더러가 읽지 않는다. 이번에 읽어 탭 하나로 만든다.

**근거 문서**: `career-os/docs/data-schema.md`의 「지원 패키지」 안 「검토 화면」, `career-os/docs/flow.md`의 「지원 준비와 검증」 8번과 9번, `career-os/docs/adr/ADR-109-지원-산출물을-역할별-디렉터리로-나눈다.md`

---

## 의도 메모

- 공고 원문을 `application-package.md`로 흡수하는 안을 기각했다. 원문은 외부에서 받은 사실이고 패키지는 우리 판단이라, 섞으면 공고를 다시 받았을 때 무엇이 바뀌었는지 비교할 수 없다.
- 탭 전환에 외부 라이브러리를 쓰지 않는다. 이 화면은 로컬 파일로 열리며 지금도 외부 의존이 없다.
- 상태 배지, 결론과 제출 PDF는 탭 밖에 둔다. 어느 탭을 보고 있든 준비 상태와 제출 파일이 보여야 한다.

---

## 작업 항목

### 1. `career-os/.claude/skills/application-package-writer/templates/application-package.css`를 새로 만든다

`render_application_package.ts` 안의 CSS 문자열을 그대로 옮긴다.
탭에 필요한 규칙을 더한다. 선택된 탭의 패널만 보이고 나머지는 숨긴다.
인쇄할 때는 모든 패널을 펼치고 탭 버튼을 숨긴다.

### 2. `career-os/.claude/skills/application-package-writer/templates/application-package.html`을 새로 만든다

문서 골격을 담고 렌더러가 채울 자리를 치환 이름으로 둔다.
치환 이름은 `{{NAME}}` 형식이며 다음 여덟을 둔다.

- `{{TITLE}}`: 문서 제목
- `{{STYLE}}`: 1번 CSS 파일의 내용
- `{{STATUS_BADGES}}`: 준비 상태, 근거 안전성과 사람 확인 배지
- `{{CONCLUSION}}`: 결론 본문
- `{{PRIMARY_FILES}}`: 제출 PDF 링크와 조건부 지원서 입력값 서랍
- `{{TAB_BUTTONS}}`: 탭 버튼 묶음
- `{{TAB_PANELS}}`: 탭 패널 묶음
- `{{GENERATED_AT}}`: 생성 시각

치환 이름이 템플릿에 없거나 렌더러가 채우지 않으면 화면 일부가 비어 나온다.
렌더러는 채우지 못한 치환 이름이 남으면 오류를 낸다.

### 3. `career-os/.claude/skills/application-package-writer/scripts/render_application_package.ts`에서 템플릿을 읽어 채운다

`import.meta.dir`을 기준으로 `../templates/`의 두 파일을 읽는다.
CSS를 `{{STYLE}}`에 넣어 HTML 한 파일로 완결되게 한다.
치환을 마친 뒤 `{{`가 남아 있으면 남은 이름을 담은 오류를 낸다.

`PRIMARY_SECTION_TITLES`를 탭 구성으로 대체한다.

| 탭 | 담는 것 |
| --- | --- |
| 공고 적합도 | `## 공고 항목별 적합도`와 `## 공개 자료로 확인한 팀과 인접 사례` |
| 지원 전략 | `## 요구사항과 근거`, `## 이 포지션에서의 승부처`, `## 지원동기`, `## 입사 후 기여 시나리오`, `## 보완할 공백`, `## 회사 문화와의 연결`, `## 면접에서 검증받을 내용`, `## 다음 행동` |
| 공고 원문 | `evidence/posting.md` 전체 |
| 상세 자료 | 이력서 원문, 포지션별 면접 질문, 후보자 인터뷰 기록과 개별 PDF 링크 |

`## 결론`, `## 제출 준비 상태`와 `## 사용자 확인 필요`는 탭 밖 상단에 둔다.
위 표에 없는 섹션이 문서에 있으면 `지원 전략` 탭 끝에 붙인다. 화면에서 사라지지 않게 한다.

탭 전환은 `<input type="radio" name="tab">`과 `:checked` 형제 선택자로 구현한다.
첫 탭이 기본 선택이다.
`evidence/posting.md`가 없으면 `공고 원문` 탭과 버튼을 만들지 않는다.

함수 시그니처에 `postingMarkdown?: string`을 더한다.
호출부가 `evidence/posting.md`를 읽어 넘긴다.

### 4. `career-os/applications/tossplace/server-developer-ai-platform/application-package.html`을 새 화면으로 다시 만든다

phase 01의 「skill이 실행하는 명령」으로 최신 판을 받은 뒤 렌더러를 실행해 화면을 다시 만든다.
탭 넷이 나오고 치환 이름이 남지 않는지 아래 「검증」의 명령으로 확인한다.

### 5. `career-os/.claude/skills/application-package-writer/SKILL.md`에서 화면 서술을 바꾼다

「사용자에게 주는 결과」 절의 첫 영역과 접이식 서술을 탭 구성으로 바꾼다.
탭 목록과 각 탭이 담는 것은 `career-os/docs/data-schema.md`의 「검토 화면」이 소유하므로 여기서는 그 절을 가리키고 중복해 적지 않는다.

### 6. `career-os/docs/code-architecture.md`에서 템플릿 디렉터리를 확인한다

phase 01에서 `.claude/skills/application-package-writer/templates/` 행을 이미 더했다.
실제 파일 이름과 그 행의 설명이 맞는지 확인하고 어긋나면 고친다.

### 7. `career-os/.claude/skills/application-package-writer/scripts/render_application_package.test.ts`에서 이 phase를 검증한다

다음 다섯을 확인한다.

- 정상: 네 탭 버튼과 네 패널이 모두 나오고 첫 탭이 선택돼 있다.
- 정상: `## 공고 항목별 적합도`의 표가 `공고 적합도` 패널 안에 있다.
- 정상: 결론과 상태 배지가 어느 패널에도 속하지 않고 상단에 있다.
- 빈 상태: `postingMarkdown`을 넘기지 않으면 `공고 원문` 탭 버튼과 패널이 없고 나머지 세 탭은 그대로다.
- 실패: 템플릿에 채우지 못한 치환 이름이 남으면 그 이름을 담은 오류를 낸다.

표에 없는 섹션이 `지원 전략` 패널 끝에 붙는지도 확인한다.

모든 검증이 통과하면 `career-os/tasks/plan112-application-output-layers/index.json`의 `status`를 `completed`로, `current_phase`를 `3`으로 바꾼다.

---

## 검증

저장소 루트에서 실행한다.

```bash
# cwd: 저장소 루트 (fos-agents)
bun test ./career-os/.claude/skills/
bunx tsc --noEmit
```

두 명령이 모두 종료 코드 0이어야 한다.

토스플레이스 화면을 다시 만들고 결과를 확인한다.

```bash
# cwd: 저장소 루트 (fos-agents)
bun career-os/.claude/skills/application-package-writer/scripts/render_application_package.ts \
  career-os/applications/tossplace/server-developer-ai-platform
```

만들어진 HTML에 탭 넷이 있는지 확인한다.

```bash
# cwd: 저장소 루트 (fos-agents)
grep -c 'type="radio" name="tab"' \
  career-os/applications/tossplace/server-developer-ai-platform/application-package.html
```

`4`가 나와야 한다.

치환 이름이 남아 있지 않아야 한다.

```bash
# cwd: 저장소 루트 (fos-agents)
grep -c '{{' career-os/applications/tossplace/server-developer-ai-platform/application-package.html
```

`0`이 나와야 한다.

공고 원문이 화면에 들어갔는지 확인한다.

```bash
# cwd: 저장소 루트 (fos-agents)
grep -c "Proactive한 매장 관리 경험" \
  career-os/applications/tossplace/server-developer-ai-platform/application-package.html
```

`1` 이상이어야 한다.

`career-os/applications`는 홈서버와 동기화되는 비공개 작업본이다.
`career-os/docs/flow.md`의 「skill이 실행하는 명령」을 `SKILL_NAME=application-package-writer`로 실행해 최신 판을 받고, 작업을 마친 뒤 같은 이름으로 완료 단계를 실행한다.

---

## Critical Files

| 파일 | 변경 |
|---|---|
| `career-os/.claude/skills/application-package-writer/templates/application-package.html` | 신규 |
| `career-os/.claude/skills/application-package-writer/templates/application-package.css` | 신규 |
| `career-os/.claude/skills/application-package-writer/scripts/render_application_package.ts` | 수정 |
| `career-os/.claude/skills/application-package-writer/scripts/render_application_package.test.ts` | 수정 |
| `career-os/.claude/skills/application-package-writer/SKILL.md` | 수정 |
| `career-os/docs/code-architecture.md` | 확인 |
