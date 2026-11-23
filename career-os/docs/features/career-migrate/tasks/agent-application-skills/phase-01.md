# Phase 01. 지원 준비 실행기가 실행 공간의 작업 폴더를 기본으로 쓰고, Chrome 이 없으면 HTML 만 내며, 결과 사본을 `reports/` 에 만든다

**Execution profile**: standard

## 목표

`workspace`, `resume` 실행기가 공고·공부·면접 실행기와 같은 작업 폴더 기본값(`/workspace/career`)을 쓰고, `resume export` 가 Chrome 을 찾지 못하면 실패하지 않고 HTML 만 만든다. 새 명령 `package report` 가 지원 폴더의 결과 파일을 작업 폴더 `reports/` 에 날짜가 든 이름으로 복사하고 「내 파일」 에 넣을 경로를 알린다.

**범위 외**: 작업본 동기화 삭제와 `workspace begin|finish` 제거(phase 04), 스킬 본문(phase 02).

## 컨텍스트

- `career-os/scripts/plugin-local/workspace.ts` 의 `resolvePluginWorkspace(environment, home)` 는 `CAREER_WORKSPACE_ROOT` 가 없으면 `<home>/.fos-career/workspace` 를 쓴다. 공고·공부·면접 실행기는 `career-os/scripts/lib/career-store/database.ts` 의 `resolveCareerStoreRoot`(없으면 `DEFAULT_CAREER_WORKSPACE_ROOT = "/workspace/career"`)를 쓴다. 같은 번들에서 기본값이 둘이면 지원 폴더와 SQLite 가 다른 자리에 생긴다.
- `main.ts` 의 `runResume` 이 `resolvePluginWorkspace(process.env, os.homedir())` 로 `--logo-dir`, `--state-dir` 기본값을 붙인다.
- `career-os/scripts/resume-preparer/export_resume.ts` 는 `resolveChromeBin()` 이 Chrome 을 찾지 못하면 종료 코드 2 로 끝난다. HTML 은 `writeHtml`, PDF 는 `renderPdf` 가 만든다.

**요구사항**: REQ8(스펙 DECISION12, 설계 DECISION5, DECISION6)

**근거 문서**: `career-os/docs/adr/ADR-146-커리어-표-데이터는-에이전트-작업-폴더의-sqlite-가-갖는다.md`

## 의도 메모

- 실행 공간 이미지에 Chrome 을 넣지 않는다(스펙 DECISION12). 있으면 지금과 똑같이 PDF 까지 만든다.
- `--chrome-bin` 이나 `CHROME_BIN` 으로 준 경로가 없는 파일이면 지금처럼 HTML 을 쓴 뒤 PDF 단계에서 1 로 끝난다(`career-os/plugin/scripts/local-bundle.test.ts` 의 「resume export 는 --logo-dir 가 없으면 작업본의 로고를 붙인다」 가 이 동작을 쓴다). 사용자가 고른 도구가 틀린 것은 조용히 넘기지 않는다.
- 「내 파일」 에 넣을 사본을 에이전트가 직접 복사하게 두지 않는다. 공고 추천에서 에이전트가 넣기를 건너뛴 적이 있어 `finalize` 가 `리포트 사본:`, `다음 단계:` 줄로 알리게 했다(`career-os/plugin/agent-skills/position-recommender/SKILL.md` 의 「결과와 공개 경계」). 같은 줄을 낸다.
- HTML 만 냈을 때의 종료 코드는 0 이다. 스킬이 stdout 의 `PDF 도구 없음` 줄로 구분한다.

## 작업 항목

### 1. `career-os/scripts/plugin-local/workspace.ts`

`resolvePluginWorkspace(environment)` 가 `resolveCareerStoreRoot(environment)` 로 root 를 정한다. `home` 인자를 지우고 `main.ts` 와 `runPluginWorkspace` 의 호출을 맞춘다. 원격 모드와 `begin`, `finish` 는 이 phase 에서 그대로 둔다.

### 2. `career-os/scripts/resume-preparer/export_resume.ts`

- `resolveChromeBin()` 이 후보 경로에서 찾지 못하면 빈 문자열을 돌려준다(종료하지 않는다). `--chrome-bin` 이나 `CHROME_BIN` 값이 있으면 그 값을 그대로 쓴다(지금 동작).
- `main()`: `chromeBin` 이 비었으면 HTML 을 쓴 뒤 `HTML 이력서: <경로>`, `PDF 도구 없음: Chrome 을 찾지 못해 PDF 를 만들지 않았습니다. HTML 을 전달하세요.`, `외부 제출 자동화: 실행하지 않음` 을 내고 0 으로 끝난다. PDF 는 만들지 않는다. 앞 실행이 남긴 PDF 가 있으면 지금 HTML 과 내용이 달라 지우고 `이전 PDF 삭제:` 줄로 알린다.
- 도움말의 `--chrome-bin` 설명에 「찾지 못하면 HTML 만 만든다」 를 더한다.

### 3. `career-os/scripts/application-package/cli.ts` 의 `package report`

`package report <application-directory> <file>` 를 더한다. 새 파일 `report_copy.ts` 의 `copyReport({ root, applicationDirectory, file, now })` 가 한다.

- `<file>` 은 지원 폴더 안의 `.html` 이나 `.pdf` 여야 하고, 지원 폴더는 `<root>/applications/<회사>/<직무>` 여야 한다. 아니면 사용법 오류(2)다. 파일이 없으면 1 이다.
- 종류는 파일 이름으로 정한다: `application-package.html` → `application`, `resume.html`·`resume.pdf` → `resume`, `career-description.html`·`.pdf` → `career-description`, `resume-review.html` → `resume-review`. 그 밖의 이름은 거절한다.
- `<root>/reports/<서울 날짜>-<종류>-<회사>--<직무>.<확장자>` 로 복사한다(같은 날 다시 만들면 덮어쓴다). 서울 날짜는 `career-os/scripts/lib/date-format.ts` 에 있는 함수를 쓰고, 없으면 `Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" })` 로 낸다.
- stdout 에 `리포트 사본: <경로>` 와 `다음 단계: 이 파일을 file_space_put 으로 「내 파일」 에 넣는다` 두 줄을 낸다.
- `root` 는 `resolveCareerStoreRoot(environment)` 다. `PACKAGE_USAGE` 에 줄을 더한다.

### 4. 테스트

- `export_resume.test.ts`: `resolveChromeBin(candidates)` 가 후보 목록을 인자로 받게 하고, 있는 파일이 없으면 빈 문자열을 돌려주는지 본다. 개발 기기에는 Chrome 이 있으므로 `--html-only` 옵션(Chrome 을 찾지 않고 HTML 만 만든다)을 더해, 별도 프로세스로 돌렸을 때 HTML 이 생기고 PDF 가 없으며 stdout 에 `PDF 도구 없음` 이 있고 0 으로 끝나는지 본다. Chrome 을 찾지 못한 경우와 `--html-only` 는 같은 갈래를 탄다.
- `workspace.test.ts`: 설정이 없으면 root 가 `/workspace/career`, 근거 위치가 `/workspace/career/evidence` 다. `resolvePluginWorkspace` 와 `runPluginWorkspace` 에 넘기던 `home` 인자(`"/home/example"`)를 모든 호출에서 지운다.
- `career-os/scripts/application-package/cli.test.ts`: `package report` 의 정상 사례와 거절 사례(위 작업 항목).
- `career-os/scripts/plugin-local/main.test.ts`: `package` 설명 문구가 바뀌면 맞춘다.
- `career-os/plugin/scripts/local-bundle.test.ts`: 「cwd 의 .env 는 작업본 위치와 모드를 바꾸지 않는다」 의 기대 root 를 `/workspace/career` 로, `resume export 는 --logo-dir 가 없으면 작업본의 로고를 붙인다` 는 `CAREER_WORKSPACE_ROOT` 를 임시 폴더로 주게 고친다. 「resume export 는 Chrome 없이 HTML 만 낸다」 를 더한다(`--html-only`).
- `cd career-os/plugin && bun run build` 로 번들을 다시 만든다.

## 검증

```bash
bun test ./career-os/scripts/resume-preparer ./career-os/scripts/application-package ./career-os/scripts/plugin-local ./career-os/plugin
bunx tsc --noEmit -p .
```

## 변경 파일

| 파일 | 변경 |
|---|---|
| `career-os/scripts/plugin-local/workspace.ts` | 수정 |
| `career-os/scripts/plugin-local/workspace.test.ts` | 수정 |
| `career-os/scripts/plugin-local/main.ts` | 수정 |
| `career-os/scripts/resume-preparer/export_resume.ts` | 수정 |
| `career-os/scripts/resume-preparer/export_resume.test.ts` | 수정 |
| `career-os/scripts/application-package/cli.ts` | 수정 |
| `career-os/scripts/application-package/cli.test.ts` | 수정 |
| `career-os/scripts/application-package/report_copy.ts` | 신규 |
| `career-os/scripts/plugin-local/main.test.ts` | 수정 |
| `career-os/plugin/scripts/local-bundle.test.ts` | 수정 |
| `career-os/plugin/dist/career-local.js` | 수정 (빌드) |
