# Phase 05. cron 스킬 문서의 파일 경로를 저장소 루트 기준으로 고정한다

**Execution profile**: standard

## 목표

Hermes가 스킬 문서의 상대 경로를 다른 디렉터리로 추측하지 않도록 두 추천 스킬의 파일 참조를 저장소 루트 기준 전체 경로로 적는다.

## 컨텍스트

수동 cron에서 모델이 참고 문서를 스킬 설치 디렉터리 아래로 추측해 읽지 못했다.
phase 01은 `references/…`를 스킬 폴더 기준으로 해석하도록 안내했지만, 이 단계는 그 대응 규칙을 대체한다.
`fos-home-infra`가 별도 작업으로 cron 작업 디렉터리를 저장소 루트로 바꾼다.
이 저장소에서는 현재 디렉터리가 다르면 `git rev-parse`로 루트에 이동하도록 문서에 적는다.

## 작업 항목

1. `career-os/.claude/skills/position-recommender/`와 `career-os/.claude/skills/study-topic-recommender/`의 여섯 Markdown 파일에서 실제 파일과 디렉터리를 가리키는 링크와 경로를 저장소 루트 기준 전체 경로로 바꾼다. `../SKILL.md`, `references/*.md`, `docs/flow.md`, `sources/fos-study/` 같은 상대 경로는 남기지 않는다. `sources/fos-study/`는 `career-os/sources/fos-study/`로 적는다. `.agents/skills/report-publisher`는 고치지 않는다.
2. 두 `SKILL.md`의 「경로」 절에서 대응 규칙을 지운다. 공통으로 「이 문서의 경로와 명령은 모두 저장소 루트 기준이다」와 현재 디렉터리가 다르면 `cd "$(git rev-parse --show-toplevel)"`로 이동한다는 문장을 넣는다. 공부 추천에는 `career-workspace` 동기화 금지를 유지한다.
3. 기존 두 `skill_doc.test.ts`의 상대 링크 기대값을 현재 전체 경로로 고친다. 경로만 별도로 검사하던 중복 단언은 하나의 공통 검사로 옮기고, 그 밖의 문서 계약 테스트는 유지한다.
4. 새 `career-os/scripts/lib/skill_doc_paths.test.ts`에서 두 스킬의 모든 Markdown 파일을 검사한다. Markdown 링크 대상과 백틱 안에서 `career-os/` 또는 `.agents/`로 시작하는 경로를 추출해 저장소 루트에서 존재하는지 확인한다. 상대 링크 대상 `references/`, `../`, `docs/`, `sources/`는 실패시킨다. `<…>` 자리표시자와 실행 중 생성되는 `<RUN_DIR>` 경로는 존재 검사에서 제외한다. `career-os/.env`와 별도 동기 저장소 `career-os/sources/fos-study/`는 정확한 루트 경로 문자열을 검사하되 존재 여부는 명시적인 예외 목록으로 건너뛴다. 존재하지 않는 정적 파일 참조를 넣으면 실패하는 테스트도 둔다.

## 범위와 검증

수정 파일은 두 스킬의 여섯 Markdown 파일, `career-os/scripts/position-recommender/skill_doc.test.ts`, `career-os/scripts/study-topic-recommender/skill_doc.test.ts`, 새 공통 테스트와 `career-os/tasks/plan130-hermes-skill-paths/index.json`이다.
`career-os/state/`, `config/external-reading-sources.ts`, 다른 스킬은 읽거나 고치지 않는다.
저장소 루트에서 다음을 확인한다.

```bash
export PATH="$HOME/.bun/bin:$PATH"
bun test career-os/scripts/lib/skill_doc_paths.test.ts career-os/scripts/position-recommender/skill_doc.test.ts career-os/scripts/study-topic-recommender/skill_doc.test.ts
bun test career-os/scripts
bun test ./career-os/.claude/skills/
bunx tsc --noEmit
python3 "$HOME/.codex/skills/.system/skill-creator/scripts/quick_validate.py" career-os/.claude/skills/position-recommender
python3 "$HOME/.codex/skills/.system/skill-creator/scripts/quick_validate.py" career-os/.claude/skills/study-topic-recommender
"$HOME/.claude/skills/korean-check/scripts/check.sh" career-os/.claude/skills/position-recommender/SKILL.md career-os/.claude/skills/study-topic-recommender/SKILL.md career-os/.claude/skills/position-recommender/references/judgment.md career-os/.claude/skills/position-recommender/references/failures.md career-os/.claude/skills/study-topic-recommender/references/execution.md career-os/.claude/skills/study-topic-recommender/references/source-management.md
```

테스트가 모두 통과하면 `index.json`의 `status`를 `completed`, `current_phase`를 `5`로 바꾸고 JSON 값을 확인한다.
