# Phase 02. 이력서 템플릿을 번들에 넣고 로고를 작업본으로 빼고 실행기 resume 을 연다

**Execution profile**: deep

## 목표

`career-os/plugin/dist/career-local.js` 에 실행기 `resume` 을 더해 이력서 HTML·PDF 변환, 주장 원장 검증, 검증 완료 주장, 제출 묶음 CLI 여덟을 저장소 없이 돌린다.
템플릿은 텍스트 import 로 번들에 넣고, 개인 경력을 드러내는 로고는 저장소에서 지우고 작업본 `library/resume-logos/` 에서 읽는다.

**범위 외**: plugin 스킬과 버전은 Phase 03 이다. 이력서 렌더링 규칙, 주장 판정 규칙, 제출 묶음 규칙은 바꾸지 않는다. `application-package-writer` 의 스크립트는 실행기로 열지 않는다.

## 컨텍스트

- Phase 01 이 코드를 `career-os/scripts/resume-preparer/` 로, 템플릿 셋을 `career-os/scripts/resume-preparer/templates/` 로 옮겼다. 로고는 아직 `career-os/.claude/skills/resume-preparer/templates/logos/`(`index.json`, `README.md`, 이미지 셋)에 있고 `export_resume.ts` 의 `LOGO_DIR` 이 그곳을 가리킨다
- `export_resume.ts` 는 `TEMPLATE_DIR`, `DEFAULT_DESIGN_PATH`, `DOCUMENT_TEMPLATE_PATH`, `PAGE_TEMPLATE_PATH` 로 템플릿을 `readFileSync` 로 읽고, `inlineOrganizationLogos(html)` 이 `LOGO_DIR/index.json` 의 `map` 으로 로고를 붙인다. `index.json` 이 없으면 로고 없이 렌더한다. `function main(): void` 는 export 돼 있지 않고 맨 아래 `if (import.meta.main) main();` 이 부른다. `--design <path>` 는 사용자가 준 CSS 파일 경로라 파일 읽기로 남는다
- CLI 진입점 일곱의 모양
  - `check_resume_html.ts`, `validate_claim_ledger.ts`, `build_submission_bundle.ts`, `validate_submission_bundle.ts`: `if (import.meta.main) { await runCli(...) }`
  - `assess_claim_reuse.ts`, `search_verified_claims.ts`, `promote_verified_claims.ts`: 맨 위에서 바로 `await runCli(...)`. import 하는 순간 실행되므로 번들에 그대로 넣을 수 없다
  - `runCli(spec, handler)` 는 `career-os/scripts/lib/cli.ts` 에 있고 `process.argv.slice(2)` 를 읽은 뒤 `process.exit` 으로 끝난다
- 세 검증 완료 주장 CLI 는 `--state-dir` 를 받는다. 없으면 `verified-claims/store.ts` 의 `defaultStateDir(process.cwd())`, 곧 `<cwd>/career-os/state/verified-claims` 다. 근거 경로는 `process.cwd()` 기준으로 정규화한다(`verified-claims/evidence.ts` 의 `repositoryPath`)
- 텍스트 import 와 타입: `career-os/scripts/lib/text-asset.ts` 의 `textAsset(value, name)` 과 `career-os/scripts/lib/text-assets.d.ts` 의 `*.css` 선언을 쓴다. `career-os/scripts/position-recommender/render/assets.ts` 가 선례다
- 로컬 실행기: `career-os/scripts/plugin-local/executors.ts` 의 `PLUGIN_LOCAL_EXECUTORS`, `main.ts` 의 `descriptions` 와 실행기 처리, `workspace.ts` 의 `resolvePluginWorkspace(environment, home)`(`{ root, mode, evidenceDir }`). 실행기에 넘기기 전에 `process.argv` 를 `[argv0, argv1, ...rest]` 로 바꾼다
- PDF 는 시스템 Chrome(`--chrome-bin`, `CHROME_BIN`)과 `pdfunite`(`PDFUNITE_BIN`)로 만든다. 기존 테스트는 `--chrome-bin /not-used` 처럼 실제 바이너리 없이 돈다
- 같은 프로세스의 `Bun.build` 는 다른 테스트와 모듈 해석을 공유해 실패한 적이 있다. 번들을 만드는 테스트는 별도 프로세스에서 빌드한다. 테스트 실행은 `bun --no-env-file` 이다

**근거 문서**: `career-os/docs/code-architecture.md` 의 「resume-preparer」 절과 「로컬 실행기」 절,
`career-os/docs/data-schema.md` 의 「`state/verified-claims/`」 절과 「`library/resume-logos/`」 절,
`career-os/docs/flow.md` 의 「Claude Code 에서 이력서 준비」 절,
`career-os/docs/adr/ADR-138-plugin-로컬-실행기는-scripts-원본을-번들해-부르고-작업본-위치는-설정으로-받는다.md`

## 의도 메모

- 로고는 개인 경력 식별 정보라 저장소와 번들에 두지 않는다(ADR-138). 저장소 사본 스킬도 작업본의 로고를 읽게 된다. 지금 쓰는 로고를 작업본으로 옮기는 일은 원격 검증 목록에 둔다
- 기본 로고 디렉터리는 `CAREER_WORKSPACE_ROOT`(없으면 `career-os`) 아래 `library/resume-logos/` 다. 저장소 CLI 의 작업본 root 기본값과 같은 규칙이다
- 실행기는 상태 디렉터리와 로고 디렉터리를 사용자가 주지 않았을 때만 작업본 기준으로 채운다. 사용자가 준 값을 덮어쓰지 않는다
- 근거 경로 기준(cwd)은 바꾸지 않는다. 저장소에서 쓰던 주장 원장이 그대로 읽힌다

## 작업 항목

### 1. `career-os/scripts/resume-preparer/export_resume.ts` 수정

- 템플릿 셋을 텍스트 import 와 `textAsset` 으로 읽는다. `DEFAULT_DESIGN_CSS`, `DOCUMENT_TEMPLATE`, `PAGE_TEMPLATE` 문자열 상수로 export 하고 `TEMPLATE_DIR`, `DEFAULT_DESIGN_PATH`, `DOCUMENT_TEMPLATE_PATH`, `PAGE_TEMPLATE_PATH`, `LOGO_DIR` 은 지운다. 이 이름을 쓰던 테스트와 코드를 맞춘다
- `--design` 이 없으면 `DEFAULT_DESIGN_CSS` 를, 있으면 지금처럼 파일을 읽는다
- `--logo-dir <path>` 옵션을 더한다. 기본값은 `resolve(process.env.CAREER_WORKSPACE_ROOT?.trim() || "career-os", "library/resume-logos")` 다
- `inlineOrganizationLogos(html: string, logoDir: string)` 로 디렉터리를 인자로 받는다
- `renderHtml(resumeMarkdown, designSource, designPath = '', accent = '', logoDir?: string)` 로 마지막 인자를 더한다. `logoDir` 가 없으면 로고 없이 렌더한다. 기존 테스트의 위치 인자 호출은 그대로 통과한다. `main` 은 `opts.logoDir` 를 넘긴다
- `function main` 을 `export` 한다. 도움말에 `--logo-dir` 를 더하고 로고 위치를 새 기본값으로 적는다

### 2. CLI 진입점 일곱

- 각 파일의 `runCli(...)` 호출을 `export async function main(): Promise<never> { return runCli(...); }` 로 감싸고 맨 아래에 `if (import.meta.main) await main();` 를 둔다. 인자, 출력, 종료 코드는 바꾸지 않는다

### 3. 로고 삭제

```bash
# cwd: 저장소 루트
git rm -r career-os/.claude/skills/resume-preparer/templates/logos
```

- 저장소 사본 `career-os/.claude/skills/resume-preparer/references/resume-design.md` 의 자산 표와 로고 추가 안내를 바꾼다. 템플릿 셋은 `scripts/resume-preparer/templates/` 에, 로고는 작업본 `library/resume-logos/` 에 있고 형식은 `docs/data-schema.md` 의 「`library/resume-logos/`」 절을 따른다고 적는다

### 4. 실행기 `resume`

- `executors.ts` 목록 끝에 `"resume"` 을 더하고 `main.ts` 의 `descriptions` 에 한 줄 설명을 더한다
- 하위 명령과 원본: `export` → `export_resume.ts`, `check-html` → `check_resume_html.ts`, `validate-ledger` → `validate_claim_ledger.ts`, `assess-reuse` → `assess_claim_reuse.ts`, `search-claims` → `search_verified_claims.ts`, `promote-claims` → `promote_verified_claims.ts`, `build-bundle` → `build_submission_bundle.ts`, `validate-bundle` → `validate_submission_bundle.ts`. 이 표를 `main.ts` 안의 상수 하나로 둔다
- 하위 명령이 없거나 모르면 하위 명령 목록을 stderr 에 쓰고 2
- 실행: `process.argv` 를 `[argv0, argv1, ...하위 명령 뒤 인자]` 로 바꾼 뒤 원본의 `main()` 을 부른다
  - `assess-reuse`, `search-claims`, `promote-claims` 에 `--state-dir` 가 없으면 `--state-dir <root>/state/verified-claims` 를 붙인다
  - `export` 에 `--logo-dir` 가 없으면 `--logo-dir <root>/library/resume-logos` 를 붙인다
  - `<root>` 는 `resolvePluginWorkspace(process.env, os.homedir()).root` 다

### 5. 번들 재생성

`bun run --cwd career-os/plugin build` 로 `dist/career-local.js` 를 다시 만든다. `dist/career-mcp.js` 는 바뀌지 않아야 한다.

### 6. 테스트

- `career-os/scripts/resume-preparer/export_resume.test.ts` 수정
  - 임시 디렉터리에 1×1 PNG 와 `{ "map": { "예시회사": "example.png" } }` 의 `index.json` 을 두고 `inlineOrganizationLogos("<h3>예시회사 백엔드</h3>", <그 디렉터리>)` 가 `data:image/png;base64,` 를 담는다
  - 실패 쪽: `index.json` 이 없는 디렉터리면 입력을 그대로 돌려준다
  - `export_resume.ts` 소스에 `readFileSync(join(TEMPLATE_DIR` 같은 템플릿 경로 읽기와 `import.meta.dir` 가 없다
  - 템플릿 번들 확인: `assets.test.ts` 와 같은 방식으로, `DOCUMENT_TEMPLATE`, `PAGE_TEMPLATE`, `DEFAULT_DESIGN_CSS` 의 길이를 출력하는 임시 진입점을 별도 프로세스에서 번들해 다른 cwd 에서 `bun --no-env-file` 로 실행하면 템플릿 파일의 길이와 같다
- `career-os/scripts/resume-preparer/layout.test.ts` 수정: `LOGO_DIR` 단언을 지우고 `career-os/.claude/skills/resume-preparer/templates` 가 없다는 단언으로 바꾼다
- `career-os/scripts/plugin-local/main.test.ts` 수정: `help` 에 `resume` 이 있다. `runPluginLocal(["resume"])`, `runPluginLocal(["resume", "nope"])` 이 2 다. help 테스트 이름의 실행기 수를 맞춘다
- `career-os/plugin/scripts/local-bundle.test.ts` 수정
  - 상태 디렉터리 주입: `<CAREER_WORKSPACE_ROOT>/state/verified-claims/other/<이름>.json` 에 스키마(`verified-claims/schema.ts`)에 맞는 주장 하나를, `<cwd>/career-os/state/verified-claims/other/<이름>.json` 에 다른 `claimKey` 의 주장 하나를 둔다. 번들의 `resume search-claims <두 주장에 공통인 검색어>` 결과에 앞의 `claimKey` 만 나오고 뒤의 것은 나오지 않는다
  - 로고 주입: `<root>/library/resume-logos/` 에 `index.json` 과 1×1 PNG 를, 임시 지원 디렉터리의 `evidence/resume-draft.md` 에 그 이름으로 시작하는 `###` 제목을 둔다. `resume export --application-dir <지원 디렉터리> --chrome-bin /not-used` 는 PDF 단계에서 1 로 끝나도 그 앞에서 쓴 `review/resume.html` 이 `data:image/png;base64,` 를 담는다

## 검증

```bash
# cwd: 저장소 루트
export PATH="$HOME/.bun/bin:$PATH"
bun install --frozen-lockfile
bun install --frozen-lockfile --cwd career-os/plugin
bun run --cwd career-os/plugin build
bun test ./career-os/scripts/resume-preparer/export_resume.test.ts ./career-os/scripts/resume-preparer/layout.test.ts ./career-os/scripts/plugin-local/main.test.ts ./career-os/plugin/scripts/local-bundle.test.ts
bun test ./career-os/scripts ./career-os/plugin ./career-os/.claude/skills
bun run --cwd career-os/plugin typecheck
bunx tsc --noEmit
test ! -e career-os/.claude/skills/resume-preparer/templates/logos
```

기대값: 모두 종료 코드 0.

## 변경 파일

| 파일 | 변경 |
|---|---|
| `career-os/scripts/resume-preparer/export_resume.ts` | 수정 |
| `career-os/scripts/resume-preparer/export_resume.test.ts` | 수정 |
| `career-os/scripts/resume-preparer/layout.test.ts` | 수정 |
| `career-os/scripts/resume-preparer/check_resume_html.ts` | 수정 |
| `career-os/scripts/resume-preparer/validate_claim_ledger.ts` | 수정 |
| `career-os/scripts/resume-preparer/assess_claim_reuse.ts` | 수정 |
| `career-os/scripts/resume-preparer/search_verified_claims.ts` | 수정 |
| `career-os/scripts/resume-preparer/promote_verified_claims.ts` | 수정 |
| `career-os/scripts/resume-preparer/build_submission_bundle.ts` | 수정 |
| `career-os/scripts/resume-preparer/validate_submission_bundle.ts` | 수정 |
| `career-os/scripts/plugin-local/executors.ts` | 수정 |
| `career-os/scripts/plugin-local/main.ts` | 수정 |
| `career-os/scripts/plugin-local/main.test.ts` | 수정 |
| `career-os/plugin/scripts/local-bundle.test.ts` | 수정 |
| `career-os/plugin/dist/career-local.js` | 수정 |
| `career-os/.claude/skills/resume-preparer/references/resume-design.md` | 수정 |
| `career-os/.claude/skills/resume-preparer/templates/logos/README.md` | 삭제 |
| `career-os/.claude/skills/resume-preparer/templates/logos/index.json` | 삭제 |
| `career-os/.claude/skills/resume-preparer/templates/logos/nhn.png` | 삭제 |
| `career-os/.claude/skills/resume-preparer/templates/logos/the-future-company.png` | 삭제 |
| `career-os/.claude/skills/resume-preparer/templates/logos/chonnam-national-university.png` | 삭제 |
