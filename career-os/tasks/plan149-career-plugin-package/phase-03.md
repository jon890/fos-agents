# Phase 03. resume-preparer 저장소 사본을 지우고 문서와 plugin 판을 정리한다

**Execution profile**: standard

## 목표

`resume-preparer` 가 의존하던 `application-package-writer` 가 plugin 으로 옮겨졌으므로 `career-os/.claude/skills/resume-preparer/` 사본을 지우고, 사본을 가리키던 테스트와 문서를 plugin 기준으로 맞춘다. plugin 판을 올리고 번들을 다시 만든다.

**범위 외**: `position-recommender`, `study-topic-recommender` 저장소 사본(홈서버 예약 실행이 쓴다). 개인 로고의 git 이력 처리.

## 컨텍스트

- 사본을 지우는 조건은 `career-os/docs/adr/ADR-139-plugin-의-대화용-스킬과-claude-code-전용-스킬을-디렉터리로-나눈다.md` 의 「저장소 사본은 그 스킬을 쓰는 실행 환경이 모두 plugin 으로 옮긴 뒤 지운다」 다. `resume-preparer` 는 홈서버 예약 실행이 쓰지 않는다. 사본을 링크하거나 import 하던 `application-package-writer` 는 phase 01, 02 에서 옮겨졌다.
- `career-os/plugin/skills/resume-preparer/references/` 의 일곱 파일이 이미 있다. 저장소 사본 `career-os/.claude/skills/resume-preparer/references/` 의 일곱 파일과 `candidate-context.md` 만 내용이 다를 수 있으므로 지우기 전에 `diff -r` 로 차이를 확인한다. plugin 쪽이 새 것이어야 한다. 저장소 쪽에만 있는 내용이 있으면 plugin 쪽으로 옮기고 사실을 보고한다.
- `career-os/plugin/scripts/local-skills.test.ts` 의 `resume-preparer` 용 `describe` 에 「저장소 사본을 지울 때 이 단언도 함께 지운다」 주석이 붙은 바이트 비교 테스트가 있다. 사본과 함께 지운다. `position-recommender` 용 같은 테스트는 사본이 남으므로 그대로 둔다.
- `career-os/scripts/study-topic-recommender/skill_doc.test.ts` 의 「비공개 작업본 동기화 절의 첫 문장에서 공부 추천을 제외한다」 테스트는 `career-os/docs/flow.md` 의 그 절에서 `` `application-package-writer` `` 로 시작하는 줄을 찾는다. 이 계획의 문서 갱신이 그 줄을 `plugin 의 ` 로 시작하게 바꿔 두었다. 테스트가 그 줄을 찾도록 시작 문자열을 `plugin 의 \`application-package-writer\`` 로 고친다.
- 저장소에 남는 스킬은 `position-recommender` 와 `study-topic-recommender` 둘이다. `bun test ./career-os/.claude/skills` 를 단독으로 실행하면 그 아래에 테스트 파일이 없어 종료 코드 1 이다. 다른 경로와 함께 실행하면 통과한다. `career-os/scripts/` 와 `career-os/plugin/` 이 함께 있는 명령으로 검증한다.
- 개인 정보와 실행 환경 식별자를 저장소와 PR 에 쓰지 않는다. 테스트와 문서의 예시 값은 지어낸 값만 쓴다.
- bun 은 PATH 에 없을 수 있다. `export PATH="$HOME/.bun/bin:$PATH"` 를 먼저 실행한다.

**근거 문서**: `career-os/docs/code-architecture.md`, `career-os/docs/flow.md`, `career-os/docs/data-schema.md`, `career-os/docs/prd.md` 의 「application-package-writer」, `career-os/docs/adr/ADR-137-스킬과-mcp를-plugin-하나로-묶고-세-단계로-옮긴다.md`.

## 의도 메모

- ADR 을 새로 쓰지 않는다. 옮기는 방식은 ADR-137, 138, 139 가 이미 정했고 이 변경은 그 결정의 실행이다.
- `resume-preparer` evals 는 plugin 스킬로 옮겨 보존한다. 지우면 스킬을 고칠 때 돌릴 입력이 사라진다.

## 작업 항목

### 1. 저장소 사본을 정리한다

- `career-os/.claude/skills/resume-preparer/evals/evals.json` 을 `git mv` 로 `career-os/plugin/skills/resume-preparer/evals/evals.json` 으로 옮긴다. 문자열에 `/Users/` 나 저장소 경로가 있으면 지어낸 값으로 바꾼다.
- 위 「컨텍스트」 대로 references 차이를 확인한 뒤 `git rm -r career-os/.claude/skills/resume-preparer` 로 남은 파일(`SKILL.md`, `references/`)을 지운다.
- `career-os/plugin/scripts/local-skills.test.ts` 에서 `resume-preparer` 용 바이트 비교 테스트(「기준 문서 다섯이 저장소 사본과 바이트 단위로 같다」)를 지운다. `resume-preparer` 의 `evals/evals.json` 이 올바른 JSON 이고 `/Users/` 를 담지 않는다는 단언을 더한다.
- `career-os/scripts/resume-preparer/layout.test.ts` 의 `OLD_SKILL_DIR` 단언은 사본이 없어도 통과하지만, 더는 쓸모 없는 「옛 스킬」 확인이다. `OLD_SKILL_DIR` 을 쓰는 두 테스트(`옛 스킬 scripts 디렉터리가 남아 있지 않다`, `저장소 스킬에 templates 디렉터리가 남아 있지 않다`)를 「저장소에 resume-preparer 스킬 디렉터리가 없다」 하나로 합친다. 템플릿 세 파일이 실행 코드 옆에 있다는 테스트는 유지한다.
- 위 「컨텍스트」 대로 `career-os/scripts/study-topic-recommender/skill_doc.test.ts` 를 고친다.
- `career-os/.claude/build-with-teams-overlay.md` 의 「스킬 변경의 검증 명령은 `bun test ./career-os/.claude/skills/`다」 를 「저장소에 남은 스킬은 `bun test ./career-os/scripts` 가, plugin 스킬은 `bun test ./career-os/plugin` 이 검증한다」 로 고친다. 저장소 스킬 디렉터리에 테스트가 없어 그 명령 단독은 실패하기 때문이다.

### 2. 문서를 현재 상태와 맞춘다

이 계획의 문서 갱신은 이미 `career-os/docs/flow.md`, `code-architecture.md`, `data-schema.md`, `career-os/README.md` 에 들어 있다. 구현이 그 문서와 다른 곳이 있으면 같은 커밋에서 문서를 고친다. 아래를 확인한다.

- `grep -rn "\.claude/skills/application-package-writer\|\.claude/skills/resume-preparer\|저장소 사본" career-os --include=*.md --include=*.ts -r --exclude-dir=node_modules --exclude-dir=sources --exclude-dir=tasks` 에서 `resume-preparer` 와 `application-package-writer` 를 가리키는 남은 곳을 plugin 경로로 고친다. ADR 본문(`career-os/docs/adr/`)은 결정 당시의 기록이므로 고치지 않는다.
- `career-os/docs/code-architecture.md` 의 「plugin 구조」 트리와 「로컬 실행기」 표, 「커넥터 설치 계약」의 저장소 사본 목록이 현재 구현과 같은지 확인한다.
- `career-os/docs/prd.md` 의 `application-package-writer` 절과 `career-os/AGENTS.md` 의 안내가 plugin 스킬과 어긋나지 않는지 확인한다. 어긋나면 고친다.
- `career-os/docs/flow.md` 의 「application-package-writer」 절 12번까지의 흐름이 plugin 스킬 본문의 8단계 흐름과 같은지 확인한다.

### 3. plugin 판을 올리고 번들을 다시 만든다

- `career-os/plugin/.claude-plugin/plugin.json` 과 `career-os/plugin/package.json` 의 `version` 을 `0.6.0` 에서 `0.7.0` 으로 올린다. `plugin/scripts/` 의 테스트가 두 버전의 일치를 확인하는지 `grep -rn "version" career-os/plugin/scripts/*.test.ts` 로 확인하고 맞춘다.
- `plugin.json` 의 `description` 이 이 스킬을 포함하도록 고친다. Claude Code 에서 하는 일 목록에 지원 판단과 지원 패키지 검토 화면을 더한다.
- `bun run --cwd career-os/plugin build` 로 번들을 다시 만든다. phase 01 이후 실행기 코드가 더 바뀌지 않았으면 `dist/` 는 바뀌지 않는다.
- `claude plugin validate career-os/plugin` 이 통과하는지 확인한다.

## 검증

저장소 루트에서 실행한다.

```bash
export PATH="$HOME/.bun/bin:$PATH" && cd career-os/plugin && bun install && bun run build && cd ../.. && git status --short -- career-os/plugin/dist
export PATH="$HOME/.bun/bin:$PATH" && bunx tsc --noEmit
export PATH="$HOME/.bun/bin:$PATH" && bun test ./career-os/scripts ./career-os/plugin ./career-os/.claude/skills
claude plugin validate career-os/plugin
test ! -e career-os/.claude/skills/resume-preparer && test ! -e career-os/.claude/skills/application-package-writer
! git grep -n "\.claude/skills/application-package-writer\|\.claude/skills/resume-preparer" -- career-os ':!career-os/docs/adr' ':!career-os/tasks' ':!career-os/sources' ':!*.test.ts'
```

기대값: 첫 줄의 `git status --short` 출력이 비어 있다(번들이 이미 최신이다). 나머지는 종료 코드 0 이다. 테스트 통과 수치와 `claude plugin validate` 출력을 보고에 남긴다.

## 변경 파일

| 파일 | 변경 |
| --- | --- |
| `career-os/.claude/skills/resume-preparer/SKILL.md` | 삭제 |
| `career-os/.claude/skills/resume-preparer/references/**` | 삭제 |
| `career-os/.claude/skills/resume-preparer/evals/evals.json` | 삭제 |
| `career-os/plugin/skills/resume-preparer/evals/evals.json` | 신규 |
| `career-os/plugin/scripts/local-skills.test.ts` | 수정 |
| `career-os/scripts/resume-preparer/layout.test.ts` | 수정 |
| `career-os/scripts/study-topic-recommender/skill_doc.test.ts` | 수정 |
| `.claude/build-with-teams-overlay.md` | 수정 |
| `career-os/plugin/.claude-plugin/plugin.json` | 수정 |
| `career-os/plugin/package.json` | 수정 |
