# Phase 04. 기존 이력 이관과 스킬 진입점을 정리한다

**Execution profile**: standard

## 목표

기존 파일 이력과 Pages 노출 이력을 학습자료 API dry-run으로 검증하고, 스킬이 파일모드와 library 모드를 명확히 나누어 실행하게 한다.

**범위 외**: fos-blog 관리자 UI commit 구현, 실제 운영 DB commit, 공개 Pages 게시 실행, 기존 Pages 리포트 삭제.

## 컨텍스트

기준은 저장소 루트의 AGENTS.md와 career-os/AGENTS.md다.
기존 스킬 계약은 `career-os/.claude/skills/study-topic-recommender/SKILL.md`와 `references/execution.md`가 소유한다.
기존 파일 이력은 `career-os/state/morning-study-history.json`이며 파일모드에서만 읽고 쓴다.
연동모드의 가져오기는 API `imports/dry-run`만 서비스 인증으로 실행하고, commit은 본인 관리자 UI에서 수행한다.
일반 library 수집·추천 실행은 `skill begin`에 의존하지 않는다.
하지만 실제 legacy `state/morning-study-history.json`을 import preview 입력으로 읽을 때는 private 작업본 동기화가 필요하므로 `skill begin study-topic-recommender` 뒤에 실행하고, 산출물 보존이 끝나면 `skill finish study-topic-recommender`를 수행한다.
테스트는 fixture history와 fixture pages manifest만 사용하며 begin/finish를 요구하지 않는다.

기존 파일 이력과 Pages에 이미 노출된 추천은 보존한다.
같은 contentKey가 여러 과거 리포트에 반복되어도 이관 payload에는 각 추천 기록을 남기며, 앞으로의 중복 추천 판단에는 하나의 자료 키로 사용한다.
없는 summary, reason, careerValue는 `null`로 보존하고 추정하지 않는다.

**근거 문서**: repo root 기준 `career-os/docs/flow.md`, `career-os/docs/data-schema.md`, `career-os/docs/code-architecture.md`. career-os cwd 검증 기준 `docs/flow.md`, `docs/data-schema.md`, `docs/code-architecture.md`

## 의도 메모

파일모드를 삭제하면 운영 전환 전에 되돌릴 경로가 사라진다.
반대로 library 모드에서 파일 fallback이나 dual-write를 허용하면 추천 이력이 둘로 갈라진다.
두 모드는 CLI 플래그와 스킬 문서에서 명확히 분리한다.

## 작업 항목

### 1. career-os/scripts/study-topic-recommender/study-library/imports.ts 기존 이력 dry-run payload를 만든다

`state/morning-study-history.json`을 읽어 API `imports/dry-run` payload로 변환한다.
Pages 이력 입력은 `--pages-manifest <path>`로 받은 JSON 파일을 사용한다.
Pages 파일은 기존 승인된 URL에서 에이전트가 준비한다.
Pages manifest는 `schemaVersion: 1`과 `reports` 배열을 가진다.
`reports[]`는 API `ImportReport` 규격의 `reportId`, `generatedAt`, `topics` 구조를 재사용하고, envelope 필드 `provenance`를 추가로 가진다.
`provenance.sourcePageUrl`은 확인한 Pages HTTPS URL이며 필수다.
`provenance.localHtmlPath`는 선택값이고, 에이전트가 승인된 URL에서 받아 둔 HTML 파일 경로다.
API에 보낼 때는 `provenance`를 제거한다.

변환 규칙은 다음과 같다.

- 기존 `reports[].reportId`와 `entries[].reportId`를 유지한다.
- `recommendedAt`은 `generatedAt`으로 보낸다.
- `studyTopicKey`는 `topicKey`, `studyTopic`은 `title`로 보낸다.
- `careerQuestion`이 없으면 `null`
- 기존 이력에 없는 `summary`, `reason`, `careerValue`는 `null`
- 자료의 `canonicalUrl`, `contentKey`, `sourceKey`, `category`, `title`은 확인된 값만 사용

sourceKey 또는 canonicalUrl이 없으면 해당 항목은 추정하지 않고 변환 오류 목록에 남긴다.
CLI는 `--import-preview --history-file <path> --pages-manifest <path> --output <path>`를 받는다.
`--output`에는 본인 관리자 UI가 바로 받을 raw `{importKey,reports}` JSON만 저장한다.
dry-run 응답의 `previewHash`, `historyVersion`, `counts`, `warnings`는 `<output>.preview.json`에 저장한다.
변환 오류는 `<output>.errors.json`에 저장하고, 오류가 있으면 payload를 만들거나 API dry-run을 호출하지 않는다.
`importKey`는 `import:` 뒤에 canonical JSON reports의 UTF-8 SHA-256 hex를 붙인다.
canonical JSON은 객체 키를 재귀적으로 사전순 정렬하고 배열 순서는 보존한 뒤 공백 없이 직렬화한다.
같은 reports 입력은 같은 importKey를 만들고, null 보존값을 포함해 reports가 바뀌면 다른 importKey를 만든다.

### 2. career-os/.claude/skills/study-topic-recommender/references/execution.md 실행 계약을 분리한다

파일모드 절은 기존 `skill begin`, `--history-file`, `--commit-history`, `skill finish` 흐름을 유지한다.
새 library 모드 절에는 다음 명령을 추가한다.

```bash
# cwd: 저장소 루트
bun career-os/scripts/study-topic-recommender/build_morning_reading.ts --run-dir <RUN_DIR> --library --collect-only --mode recent
bun career-os/scripts/study-topic-recommender/build_morning_reading.ts --run-dir <RUN_DIR> --library --collect-only --mode archive --source-key kurly-tech --max-items 48
bun career-os/scripts/study-topic-recommender/build_morning_reading.ts --run-dir <RUN_DIR> --library --prepare-candidates --limit 100
bun career-os/scripts/study-topic-recommender/build_morning_reading.ts --run-dir <RUN_DIR> --library --reading-selection <RUN_DIR>/reading-selection.json --candidate-pool <RUN_DIR>/state/reading-candidates.json
bun career-os/scripts/study-topic-recommender/validate_outputs.ts --run-dir <RUN_DIR>
bun career-os/scripts/study-topic-recommender/build_morning_reading.ts --run-dir <RUN_DIR> --library --commit-recommendation --report <RUN_DIR>/state/morning-reading.json
bun career-os/scripts/study-topic-recommender/build_morning_reading.ts --run-dir <RUN_DIR> --library --record-publication --report-id morning-YYYY-MM-DD --channel cloudflare-pages --external-id morning-YYYY-MM-DD --published-at 2026-09-07T00:00:00.000Z --url https://example.com/morning-YYYY-MM-DD
bun career-os/scripts/study-topic-recommender/build_morning_reading.ts --run-dir <RUN_DIR> --library --import-preview --history-file career-os/state/morning-study-history.json --pages-manifest <PAGES_MANIFEST_JSON> --output <RUN_DIR>/study-library-import-preview.json
```

일반 연동모드는 `skill begin`과 legacy `state/morning-study-history.json`에 의존하지 않는다고 적는다.
실제 legacy state를 읽는 `--import-preview`만 기존 파일 동기화 계약에 따라 begin/finish 예외를 둔다고 적는다.
API 실패 때 파일 fallback과 dual-write를 하지 않는다고 적는다.
추천 결과는 HTML만 사용자용으로 만들고 Markdown은 만들지 않는다고 적는다.
추천·수집 실행의 `--render-only`, `--commit-history`, `--history-file`은 `--library`와 함께 쓰면 거절한다고 적는다.
`--import-preview`는 legacy 파일을 읽어야 하므로 `--history-file`을 예외로 받는다고 적는다.

### 3. career-os/.claude/skills/study-topic-recommender/SKILL.md 모드 선택을 안내한다

기본은 파일모드이고, 누적 학습자료 API를 사용할 때만 `--library`를 명시한다고 설명한다.
브라우저 관리자 세션 복제 금지, 서비스 Bearer 인증, 가져오기 dry-run과 UI commit 분리를 추가한다.
기존 추천 판단 기준과 모델 역할은 유지한다.

### 4. career-os/scripts/study-topic-recommender/study-library/imports.test.ts 이관 CLI 테스트를 추가한다

다음을 검증한다.

- 파일 이력에서 import dry-run payload를 만들 때 없는 summary, reason, careerValue를 `null`로 둔다.
- sourceKey 또는 canonicalUrl이 없으면 추정값을 만들지 않고 변환 오류로 처리한다.
- Pages manifest schemaVersion 1, reports 배열과 provenance를 검증하고 API payload에서 provenance를 제거한다.
- dry-run은 API 응답의 previewHash와 counts를 `<output>.preview.json`에 저장한다.
- `--import-preview`는 `--output`에 본인 관리자 UI에 올릴 raw `{importKey,reports}` JSON payload만 남긴다.
- 변환 오류가 있으면 `<output>.errors.json`을 만들고 payload 생성과 API 요청을 중단한다.
- importKey가 `import:` 접두사와 canonical JSON reports SHA-256으로 만들어진다.
- 같은 reports 입력은 같은 importKey를 만들고, null 보존값을 포함해 reports가 바뀌면 다른 importKey를 만든다.
- import commit 요청 함수나 CLI 플래그가 career-os에 생기지 않는다.
- Pages manifest 입력은 파일 경로를 받으며 기존 승인된 URL에서 준비한 파일을 사용할 수 있다.
- 실제 legacy state 경로를 입력할 때는 begin/finish가 실행 문서에 예외로 설명되어 있다.
- fixture history 입력 테스트는 begin/finish를 요구하지 않는다.
- 마지막으로 `tasks/plan115-study-library-integration/index.json`의 `status`를 `completed`로 바꾸는 것은 모든 phase 검증을 통과한 뒤 수행한다.

### 5. career-os/.claude/skills/study-topic-recommender quick_validate 테스트를 실행한다

스킬 문서 변경 뒤 설치된 skill-creator의 quick_validate.py를 실행한다.
문서 문구를 테스트로 그대로 따라 쓰는 테스트는 만들지 않는다.
CLI mock 테스트와 skill quick_validate로 실행 계약을 검증한다.

## 검증

```bash
# cwd: 저장소 루트
bun test career-os/scripts/study-topic-recommender/study-library/imports.test.ts career-os/scripts/study-topic-recommender/persistence/history.test.ts
python3 ~/.codex/skills/.system/skill-creator/scripts/quick_validate.py career-os/.claude/skills/study-topic-recommender
~/.claude/scripts/korean-style-check.sh career-os/.claude/skills/study-topic-recommender/SKILL.md
~/.claude/scripts/korean-style-check.sh career-os/.claude/skills/study-topic-recommender/references/execution.md
python3 ~/.claude/scripts/check-readability.py career-os/.claude/skills/study-topic-recommender/SKILL.md
python3 ~/.claude/scripts/check-readability.py career-os/.claude/skills/study-topic-recommender/references/execution.md
bun career-os/scripts/study-topic-recommender/manage_reading_sources.ts validate
bunx tsc -p tsconfig.json
git diff --check
```

- import와 기존 history 테스트: 종료 코드 0
- skill quick_validate: 종료 코드 0
- 읽을거리 소스 설정 검증: 종료 코드 0
- TypeScript 검사: 종료 코드 0
- git diff 공백 검사: 종료 코드 0

## Critical Files

| 파일 | 변경 |
| --- | --- |
| career-os/scripts/study-topic-recommender/study-library/imports.ts | 신규 |
| career-os/scripts/study-topic-recommender/study-library/imports.test.ts | 신규 |
| career-os/.claude/skills/study-topic-recommender/SKILL.md | 수정 |
| career-os/.claude/skills/study-topic-recommender/references/execution.md | 수정 |
| career-os/tasks/plan115-study-library-integration/index.json | 완료 시 수정 |
