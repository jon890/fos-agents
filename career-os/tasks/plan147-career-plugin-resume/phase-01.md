# Phase 01. resume-preparer 실행 코드와 템플릿을 scripts/resume-preparer 로 옮긴다

**Execution profile**: standard

## 목표

`career-os/.claude/skills/resume-preparer/scripts/` 의 코드와 테스트, `templates/` 의 HTML·CSS 셋을 `career-os/scripts/resume-preparer/` 로 옮긴다.
저장소 사본 스킬과 Phase 02 의 plugin 로컬 실행기가 같은 원본을 쓰게 하려는 것이다. 이 phase 는 동작을 바꾸지 않는다.

**범위 외**: 텍스트 import, 로고 위치 변경, 실행기 연결은 Phase 02 다. plugin 스킬은 Phase 03 이다. `templates/logos/` 는 이 phase 에서 옮기지 않는다. `application-package-writer` 는 import 경로 한 줄 말고 고치지 않는다.

## 컨텍스트

- 옮길 스크립트는 상대 경로로 `../../../../scripts/lib/cli.ts`, `../../../../scripts/lib/test-timeouts.ts`(`export_resume.test.ts`), `../../application-package-writer/scripts/package_contract.ts`(`validate_submission_bundle.ts`)를 import 한다
- `career-os/.claude/skills/application-package-writer/scripts/render_application_package.ts` 7번째 줄이 `../../resume-preparer/scripts/validate_submission_bundle.ts` 를 import 한다
- `export_resume.ts` 는 `SKILL_ROOT = resolve(import.meta.dir, '..')` 아래 `templates/` 에서 `resume.css`, `resume.html`, `resume-page.html` 을, `templates/logos/` 에서 로고를 찾는다(`TEMPLATE_DIR`, `DEFAULT_DESIGN_PATH`, `DOCUMENT_TEMPLATE_PATH`, `PAGE_TEMPLATE_PATH`, `LOGO_DIR`)
- 저장소 사본 `career-os/.claude/skills/resume-preparer/SKILL.md` 67, 68, 81, 93, 94, 100번째 줄이 `bun career-os/.claude/skills/resume-preparer/scripts/<이름>.ts` 로 부른다. 그 밖에 이 경로를 가리키는 곳은 위 apw import 와 `career-os/docs/code-architecture.md` 다(docs 는 계획 단계에서 고쳤다)
- 루트 `tsconfig.json` 의 `include` 는 `career-os/scripts/**/*.ts` 와 `career-os/.claude/skills/**/scripts/**/*.ts` 를 모두 담는다

**근거 문서**: `career-os/docs/code-architecture.md` 의 「실행 코드를 두 자리 중 어디에 두나」 절과 「resume-preparer」 절

## 의도 메모

- `git mv` 로 옮겨 이력을 잇는다
- `scripts/resume-preparer/validate_submission_bundle.ts` 가 `.claude/skills/application-package-writer/scripts/package_contract.ts` 를 import 하는 역방향 의존은 `application-package-writer` 를 plugin 으로 옮길 때 정리한다. 상수 하나뿐이다
- 이 phase 는 경로만 바꾼다. 로고는 아직 옛 자리에서 읽는다

## 작업 항목

### 1. 이동

```bash
# cwd: 저장소 루트
git mv career-os/.claude/skills/resume-preparer/scripts career-os/scripts/resume-preparer
mkdir -p career-os/scripts/resume-preparer/templates
git mv career-os/.claude/skills/resume-preparer/templates/resume.html career-os/.claude/skills/resume-preparer/templates/resume-page.html career-os/.claude/skills/resume-preparer/templates/resume.css career-os/scripts/resume-preparer/templates/
```

### 2. import 경로

- 옮긴 파일의 `../../../../scripts/lib/` 를 `../lib/` 로, `verified-claims/` 아래 파일이 같은 패턴을 쓰면 `../../lib/` 로 바꾼다
- `validate_submission_bundle.ts` 의 `../../application-package-writer/scripts/package_contract.ts` 를 `../../.claude/skills/application-package-writer/scripts/package_contract.ts` 로
- `render_application_package.ts` 의 import 를 `../../../../scripts/resume-preparer/validate_submission_bundle.ts` 로

### 3. `export_resume.ts` 의 템플릿 경로

- `TEMPLATE_DIR` 을 `join(import.meta.dir, 'templates')` 로 바꾼다. `SKILL_ROOT` 는 지운다
- `LOGO_DIR` 은 옛 자리 `resolve(import.meta.dir, '../../.claude/skills/resume-preparer/templates/logos')` 로 둔다. Phase 02 가 바꾼다
- 도움말의 `bun career-os/.claude/skills/resume-preparer/scripts/export_resume.ts` 와 `resume-preparer/templates/resume.css` 를 새 경로로 바꾼다

### 4. 저장소 사본 `SKILL.md`

- 여섯 명령의 경로를 `bun career-os/scripts/resume-preparer/<이름>.ts` 로 바꾼다
- 7단계의 `scripts/build_submission_bundle.ts`, `scripts/validate_submission_bundle.ts` 를 `career-os/scripts/resume-preparer/` 아래 경로로 바꾼다

### 5. 테스트

- 옮긴 테스트가 템플릿이나 스킬 디렉터리를 상대 경로로 찾으면 새 자리에 맞춘다. 단언 내용은 바꾸지 않는다
- 새 테스트 `career-os/scripts/resume-preparer/layout.test.ts`: `career-os/.claude/skills/resume-preparer/scripts` 가 없고, `export_resume.ts` 의 `TEMPLATE_DIR` 아래 세 템플릿 파일이 있으며, `LOGO_DIR` 의 `index.json` 이 있다

## 검증

```bash
# cwd: 저장소 루트
export PATH="$HOME/.bun/bin:$PATH"
bun install --frozen-lockfile
bun test ./career-os/scripts/resume-preparer/layout.test.ts ./career-os/scripts/resume-preparer
bun test ./career-os/scripts ./career-os/.claude/skills ./career-os/plugin
bunx tsc --noEmit
! git grep -n "resume-preparer/scripts" -- career-os ':!career-os/tasks' ':!career-os/scripts/resume-preparer/layout.test.ts'
```

기대값: 모두 종료 코드 0. 마지막 줄은 아무것도 찍지 않는다.

## 변경 파일

| 파일 | 변경 |
|---|---|
| `career-os/scripts/resume-preparer/layout.test.ts` | 신규 |
| `career-os/.claude/skills/application-package-writer/scripts/render_application_package.ts` | 수정 |
| `career-os/.claude/skills/resume-preparer/SKILL.md` | 수정 |
| `career-os/scripts/resume-preparer/artifact_identity.ts` | 신규 |
| `career-os/.claude/skills/resume-preparer/scripts/artifact_identity.ts` | 삭제 |
| `career-os/scripts/resume-preparer/assess_claim_reuse.ts` | 신규 |
| `career-os/.claude/skills/resume-preparer/scripts/assess_claim_reuse.ts` | 삭제 |
| `career-os/scripts/resume-preparer/build_submission_bundle.test.ts` | 신규 |
| `career-os/.claude/skills/resume-preparer/scripts/build_submission_bundle.test.ts` | 삭제 |
| `career-os/scripts/resume-preparer/build_submission_bundle.ts` | 신규 |
| `career-os/.claude/skills/resume-preparer/scripts/build_submission_bundle.ts` | 삭제 |
| `career-os/scripts/resume-preparer/check_resume_html.test.ts` | 신규 |
| `career-os/.claude/skills/resume-preparer/scripts/check_resume_html.test.ts` | 삭제 |
| `career-os/scripts/resume-preparer/check_resume_html.ts` | 신규 |
| `career-os/.claude/skills/resume-preparer/scripts/check_resume_html.ts` | 삭제 |
| `career-os/scripts/resume-preparer/claim_ledger_schema.ts` | 신규 |
| `career-os/.claude/skills/resume-preparer/scripts/claim_ledger_schema.ts` | 삭제 |
| `career-os/scripts/resume-preparer/evidence_locator.ts` | 신규 |
| `career-os/.claude/skills/resume-preparer/scripts/evidence_locator.ts` | 삭제 |
| `career-os/scripts/resume-preparer/export_resume.test.ts` | 신규 |
| `career-os/.claude/skills/resume-preparer/scripts/export_resume.test.ts` | 삭제 |
| `career-os/scripts/resume-preparer/export_resume.ts` | 신규 |
| `career-os/.claude/skills/resume-preparer/scripts/export_resume.ts` | 삭제 |
| `career-os/scripts/resume-preparer/promote_verified_claims.ts` | 신규 |
| `career-os/.claude/skills/resume-preparer/scripts/promote_verified_claims.ts` | 삭제 |
| `career-os/scripts/resume-preparer/resume_html_contract.ts` | 신규 |
| `career-os/.claude/skills/resume-preparer/scripts/resume_html_contract.ts` | 삭제 |
| `career-os/scripts/resume-preparer/resume_submission_contract.ts` | 신규 |
| `career-os/.claude/skills/resume-preparer/scripts/resume_submission_contract.ts` | 삭제 |
| `career-os/scripts/resume-preparer/search_verified_claims.ts` | 신규 |
| `career-os/.claude/skills/resume-preparer/scripts/search_verified_claims.ts` | 삭제 |
| `career-os/scripts/resume-preparer/submission_manifest.ts` | 신규 |
| `career-os/.claude/skills/resume-preparer/scripts/submission_manifest.ts` | 삭제 |
| `career-os/scripts/resume-preparer/validate_claim_ledger.test.ts` | 신규 |
| `career-os/.claude/skills/resume-preparer/scripts/validate_claim_ledger.test.ts` | 삭제 |
| `career-os/scripts/resume-preparer/validate_claim_ledger.ts` | 신규 |
| `career-os/.claude/skills/resume-preparer/scripts/validate_claim_ledger.ts` | 삭제 |
| `career-os/scripts/resume-preparer/validate_submission_bundle.test.ts` | 신규 |
| `career-os/.claude/skills/resume-preparer/scripts/validate_submission_bundle.test.ts` | 삭제 |
| `career-os/scripts/resume-preparer/validate_submission_bundle.ts` | 신규 |
| `career-os/.claude/skills/resume-preparer/scripts/validate_submission_bundle.ts` | 삭제 |
| `career-os/scripts/resume-preparer/verified-claims/evidence.ts` | 신규 |
| `career-os/.claude/skills/resume-preparer/scripts/verified-claims/evidence.ts` | 삭제 |
| `career-os/scripts/resume-preparer/verified-claims/identity.ts` | 신규 |
| `career-os/.claude/skills/resume-preparer/scripts/verified-claims/identity.ts` | 삭제 |
| `career-os/scripts/resume-preparer/verified-claims/schema.ts` | 신규 |
| `career-os/.claude/skills/resume-preparer/scripts/verified-claims/schema.ts` | 삭제 |
| `career-os/scripts/resume-preparer/verified-claims/service.ts` | 신규 |
| `career-os/.claude/skills/resume-preparer/scripts/verified-claims/service.ts` | 삭제 |
| `career-os/scripts/resume-preparer/verified-claims/store.test.ts` | 신규 |
| `career-os/.claude/skills/resume-preparer/scripts/verified-claims/store.test.ts` | 삭제 |
| `career-os/scripts/resume-preparer/verified-claims/store.ts` | 신규 |
| `career-os/.claude/skills/resume-preparer/scripts/verified-claims/store.ts` | 삭제 |
| `career-os/scripts/resume-preparer/verified_claims.test.ts` | 신규 |
| `career-os/.claude/skills/resume-preparer/scripts/verified_claims.test.ts` | 삭제 |
| `career-os/scripts/resume-preparer/templates/resume-page.html` | 신규 |
| `career-os/.claude/skills/resume-preparer/templates/resume-page.html` | 삭제 |
| `career-os/scripts/resume-preparer/templates/resume.css` | 신규 |
| `career-os/.claude/skills/resume-preparer/templates/resume.css` | 삭제 |
| `career-os/scripts/resume-preparer/templates/resume.html` | 신규 |
| `career-os/.claude/skills/resume-preparer/templates/resume.html` | 삭제 |
