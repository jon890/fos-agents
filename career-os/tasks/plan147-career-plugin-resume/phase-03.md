# Phase 03. Claude Code 전용 resume-preparer 스킬을 더하고 plugin 버전을 0.5.0 으로 올린다

**Execution profile**: standard

## 목표

`career-os/plugin/skills/resume-preparer/` 를 더해 Claude Code 에 plugin 만 설치한 곳에서도 이력서와 경력기술서를 작성하고 감사해 제출 묶음까지 만들게 한다.
작성과 감사 기준 문서는 저장소 사본과 같은 내용을 두고 어긋나지 않는다는 것을 테스트로 고정한다.

**범위 외**: 실행기 코드는 Phase 02 다. 저장소 사본 `career-os/.claude/skills/resume-preparer/` 는 `application-package-writer` 가 링크하고 부르므로 지우지 않는다(ADR-139). 지원 패키지 검사와 검토 화면은 plugin 에 넣지 않는다.

## 컨텍스트

- Claude Code 전용 스킬의 형식은 `career-os/plugin/skills/position-recommender/SKILL.md` 를 따른다. 본문 첫머리에 「Claude Code 에서만」, 실행기 명령 `bun --no-env-file "${CLAUDE_PLUGIN_ROOT}/dist/career-local.js"` 를 알려 주고 본문과 `references/` 에서 `<CAREER_LOCAL>` 로 적는다
- `career-os/plugin/scripts/local-skills.test.ts` 가 `plugin/skills/` 의 모든 디렉터리를 검사한다. 「Claude Code 전용 스킬이 셋 있다」 테스트가 디렉터리 목록을 정확히 비교한다. `position-recommender` 전용 `describe` 블록이 하위 명령, brain 문구 부재, references 바이트 동일을 단언한다
- 실행기 `resume` 의 하위 명령은 `export`, `check-html`, `validate-ledger`, `assess-reuse`, `search-claims`, `promote-claims`, `build-bundle`, `validate-bundle` 이다(`career-os/scripts/plugin-local/main.ts`). `export` 와 세 검증 완료 주장 명령은 로고와 상태 디렉터리를 작업본 기준으로 채운다
- `workspace begin resume-preparer --json` 과 `finish` 는 이미 받는다(`career-os/scripts/career-workspace/cli.ts` 의 `managedSkills`). `workspace paths --json` 이 `root` 와 `evidenceDir` 를 낸다
- 원본 `career-os/.claude/skills/resume-preparer/SKILL.md` 와 `references/` 일곱. 그 가운데 `candidate-context.md` 는 `manage_candidate_context.ts` 명령을, `resume-design.md` 는 저장소의 템플릿 위치를 적는다. 나머지 다섯(`claim-model.md`, `hard-review.md`, `resume-taste.md`, `resume-writing-style.md`, `scoring-rubric.md`)에는 저장소 경로가 없다
- 원본 1단계의 `../application-package-writer/references/evidence-source-freshness.md` 링크와 7단계의 `application-package-writer` 스크립트 둘은 plugin 에 없다
- 버전은 `career-os/plugin/package.json`, `.claude-plugin/plugin.json`, `src/server.ts` 의 `McpServer` 세 곳이고 지금 `0.4.0` 이다

**근거 문서**: `career-os/docs/flow.md` 의 「resume-preparer」 절과 「Claude Code 에서 이력서 준비」 절,
`career-os/docs/code-architecture.md` 의 「resume-preparer」 절,
`career-os/docs/adr/ADR-139-plugin-의-대화용-스킬과-claude-code-전용-스킬을-디렉터리로-나눈다.md`

## 의도 메모

- 기준 문서 다섯은 저장소 사본과 바이트 단위로 같게 복사하고 테스트로 묶는다. 사본을 지울 때 그 단언도 지운다
- 개인 맥락은 MCP 도구로 읽고 쓴다. 저장소 CLI 를 안내하지 않는다
- 저장소에만 있는 일은 「저장소 세션에서 한다」 고만 적고 경로를 쓰지 않는다

## 작업 항목

### 1. `career-os/plugin/skills/resume-preparer/SKILL.md` 신규

원본의 목표, 경계, 워크플로 일곱 단계, 완료 조건을 옮기고 아래만 바꾼다.

- 앞머리 `name: resume-preparer`. `description` 은 원본 문장에 「Claude Code 에서만 돈다」 를 더한다
- 본문 첫머리에 「실행 환경」 절: Claude Code 에서만, 실행기 명령과 `<CAREER_LOCAL>`, 셸 환경의 `CAREER_BACKEND_URL`, `CAREER_BACKEND_TOKEN`, PDF 에 쓰는 Chrome(`CHROME_BIN`)과 `pdfunite`(`PDFUNITE_BIN`)
- 1단계: `<CAREER_LOCAL> workspace begin resume-preparer --json`, 지원 디렉터리는 결과의 `root` 아래 `applications/<회사>/<직무>/`. 지원 판단이 없으면 저장소 세션의 `application-package-writer` 로 먼저 만든다고 안내한다. 근거 원본은 `<CAREER_LOCAL> workspace paths --json` 의 `evidenceDir` 이고 최신인지 확인한다
- 4~6단계 명령을 `<CAREER_LOCAL> resume <하위 명령>` 으로. 주장 원장의 근거 경로는 Claude Code 를 연 디렉터리 기준 상대 경로나 절대 경로로 쓴다고 적는다
- 7단계: `<CAREER_LOCAL> resume build-bundle <지원 디렉터리>`, `<CAREER_LOCAL> resume validate-bundle <지원 디렉터리>`. 지원 패키지 검사와 검토 화면은 저장소 세션에서 한다고 적는다. 끝에 `<CAREER_LOCAL> workspace finish resume-preparer --json`
- 「답변 연습은 `interview-practice` 로」 는 그대로 둔다. 같은 plugin 의 스킬이다

### 2. `career-os/plugin/skills/resume-preparer/references/` 신규

- `claim-model.md`, `hard-review.md`, `resume-taste.md`, `resume-writing-style.md`, `scoring-rubric.md` 를 원본에서 그대로 복사한다
- `candidate-context.md`: 원본을 옮기고 `manage_candidate_context.ts get --key <키>` 를 `get_context_document` 도구로, `put` 을 `save_context_document` 도구로 바꾼다. 저장 전 변경 전후를 보여 주고 승인받는 규칙은 그대로다
- `resume-design.md`: 원본을 옮기고 자산 표를 「템플릿 셋은 실행기에 번들돼 있다. 공고별 스타일은 `<CAREER_LOCAL> resume export --design <path>` 로 준다. 로고는 작업본 `library/resume-logos/` 의 `index.json` 과 이미지로 붙는다」 로 바꾼다

### 3. 버전 올리기

- 세 곳의 버전을 `0.5.0` 으로. `plugin.json` 의 `description` 끝 문장을 「Claude Code 에서는 공고 추천, 이력서 준비, 공고별 질문 연습, 읽을거리 수집과 리포트도 한다.」 로
- `bun run --cwd career-os/plugin build` 로 `dist/career-mcp.js` 를 다시 만든다. `dist/career-local.js` 는 바뀌지 않아야 한다

### 4. 테스트

- `career-os/plugin/scripts/local-skills.test.ts` 수정
  - 「셋 있다」 를 「넷 있다」 로 바꾸고 기대 목록에 `resume-preparer` 를 이름 순으로 더한다
  - `resume-preparer` 전용 `describe`: 본문에 `<CAREER_LOCAL> resume export`, `validate-ledger`, `assess-reuse`, `promote-claims`, `build-bundle`, `validate-bundle`, `workspace begin resume-preparer` 가 있다. 디렉터리의 모든 파일에 `brain-search`, `brain-add`, `private brain`, `manage_candidate_context.ts` 가 없다. 기준 문서 다섯이 저장소 사본과 바이트 단위로 같다(사본이 없으면 실패. 사본을 지울 때 이 단언도 지운다는 주석)

## 검증

```bash
# cwd: 저장소 루트
export PATH="$HOME/.bun/bin:$PATH"
bun install --frozen-lockfile
bun install --frozen-lockfile --cwd career-os/plugin
bun run --cwd career-os/plugin build
bun test ./career-os/plugin/scripts/local-skills.test.ts
bun test ./career-os/scripts ./career-os/plugin ./career-os/.claude/skills
bun run --cwd career-os/plugin typecheck
bunx tsc --noEmit
claude plugin validate career-os/plugin
```

기대값: 모두 종료 코드 0.

## 변경 파일

| 파일 | 변경 |
|---|---|
| `career-os/plugin/skills/resume-preparer/SKILL.md` | 신규 |
| `career-os/plugin/skills/resume-preparer/references/claim-model.md` | 신규 |
| `career-os/plugin/skills/resume-preparer/references/hard-review.md` | 신규 |
| `career-os/plugin/skills/resume-preparer/references/resume-taste.md` | 신규 |
| `career-os/plugin/skills/resume-preparer/references/resume-writing-style.md` | 신규 |
| `career-os/plugin/skills/resume-preparer/references/scoring-rubric.md` | 신규 |
| `career-os/plugin/skills/resume-preparer/references/candidate-context.md` | 신규 |
| `career-os/plugin/skills/resume-preparer/references/resume-design.md` | 신규 |
| `career-os/plugin/scripts/local-skills.test.ts` | 수정 |
| `career-os/plugin/package.json` | 수정 |
| `career-os/plugin/.claude-plugin/plugin.json` | 수정 |
| `career-os/plugin/src/server.ts` | 수정 |
| `career-os/plugin/dist/career-mcp.js` | 수정 |
