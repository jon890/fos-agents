# Phase 03. 읽을거리 관리 CLI의 로컬 명령과 API 명령을 구분한다

**Execution profile**: standard

## 목표

`manage_reading_sources.ts`의 help와 template는 API 환경값 없이 동작하고, API를 읽거나 쓰는 명령은 환경값을 요구한다.

## 컨텍스트

현재 CLI는 명령을 분기하기 전에 `createStudyLibraryClient()`를 호출한다.
`list`, `add`, `update`, `disable`, `enable`은 Backend를 쓰는 명령이다.
plan129는 다섯 API 명령만 남기면서 옛 help와 template를 의도적으로 제거했다.
이번 후속 요청은 help와 template를 로컬 명령으로 다시 추가해 그 결정을 이 두 명령에 한해 대체한다.
template는 옛 config 파일 형식 대신 현재 Backend에 보낼 `StudyLibrarySourcePutPayload` 형식을 출력한다.
`list`의 응답 검증과 API 오류는 `career-os/scripts/study-topic-recommender/study-library/client.test.ts`가 검사한다.

## 작업 항목

1. 인자 없음, `help`, `--help`, `-h`는 사용법을 출력하고 성공한다. 이 분기에서는 API client를 생성하거나 네트워크를 부르지 않는다.
2. `template`는 `add`와 같은 `--key`, `--title`, `--category`, `--adapter`, URL과 `--note`를 받아 JSON 초안을 출력한다. 출력은 `{ sourceKey, payload }`이며 `payload`에는 `title`, `category`, `adapter`, `url`, `feedUrl`, `enabled: true`, `note`, `expectedVersion: 0`을 넣는다. `sourceKey`는 API 경로 값이고 엄격한 Backend body에 섞지 않는다. 필수값 누락과 잘못된 소스 값은 `studyLibrarySourcePutPayloadSchema`로 거부하고, API client를 생성하거나 네트워크를 부르지 않는다.
3. 기존 다섯 API 명령은 현재 저장 계약과 `--note` 요구를 유지한다. Backend 연결 값은 해당 명령에 진입할 때만 요구한다.
4. 변경한 명령을 `career-os/.claude/skills/study-topic-recommender/references/source-management.md`에 적고, `career-os/docs/code-architecture.md`의 진입점 표와 환경값 조건을 새 명령 경계에 맞춘다.
5. `cli-contract.test.ts`에서 `list`의 옛 로컬 필터 단언을 제거한다. 옛 template 호출에는 `--note`를 추가하고 `{ sourceKey, payload }` 전체 값을 단언한다. API 목록 검증을 맡는 `study-library/client.test.ts`를 확인하고, `manage_reading_sources.test.ts`에 로컬 명령 무환경 성공, 잘못된 template 실패와 다섯 API 명령의 환경값 실패를 검사한다.

## 범위와 검증

수정 파일은 `career-os/scripts/study-topic-recommender/manage_reading_sources.ts`, 같은 디렉터리의 `manage_reading_sources.test.ts`, `career-os/scripts/lib/cli-contract.test.ts`, `career-os/.claude/skills/study-topic-recommender/references/source-management.md`, `career-os/docs/code-architecture.md`다.
`config/external-reading-sources.ts`와 `career-os/state/`는 읽거나 고치지 않는다.
저장소 루트에서 다음 명령을 실행한다. 전체 CLI 계약 검사는 phase 04에서 실행한다.

```bash
export PATH="$HOME/.bun/bin:$PATH"
bun test career-os/scripts/lib/cli-contract.test.ts -t '읽을거리 관리'
bun test career-os/scripts/study-topic-recommender/manage_reading_sources.test.ts career-os/scripts/study-topic-recommender/study-library/client.test.ts
bun test ./career-os/.claude/skills/
bunx tsc --noEmit
python3 "$HOME/.codex/skills/.system/skill-creator/scripts/quick_validate.py" career-os/.claude/skills/study-topic-recommender
"$HOME/.claude/skills/korean-check/scripts/check.sh" career-os/.claude/skills/study-topic-recommender/references/source-management.md career-os/docs/code-architecture.md
```
