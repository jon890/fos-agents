# Phase 02 스킬 경로 갱신과 영구 reports 경계 제거 검증

**Execution profile**: standard

---

## 목표

`study-topic-recommender` 스킬이 평면 임시 산출물 경로를 사용하게 하고 저장소의 영구 `reports/` 계약이 다시 생기지 않도록 검증한다.

**범위 외**: 기존 `career-os/data/reports` 파일 삭제, 홈서버 release 변경, Cloudflare Pages 실제 게시와 다른 워크스페이스의 `reports/` 정책 변경은 수행하지 않는다.

---

## 작업 항목 (4)

### 1. 스킬 출력 경로 갱신

`study-topic-recommender/SKILL.md`의 게시 대상과 검증 경로를 `<RUN_DIR>/morning-reading-YYYY-MM-DD.html`과 `<RUN_DIR>/morning-reading.md`로 바꾼다.
기존 시스템 임시 경로 생성, 공개 검증과 게시 뒤 삭제 절차는 유지한다.

### 2. 스킬 검증

관리 원본 `career-os/.claude/skills/study-topic-recommender`를 `quick_validate.py`로 검사한다.
`.codex/skills` 링크가 같은 관리 원본을 가리키는지도 확인한다.

### 3. 영구 경로 잔재 검사

career-os의 활성 코드, 스킬, README와 책임 문서에서 영구 `reports/` 저장 계약이 남지 않았는지 검색한다.
리포트라는 사용자 산출물 개념과 시스템 임시 경로 설명은 유지한다.

### 4. 빈 로컬 디렉터리 정리

`career-os/reports`와 `career-os/data/runtime/data/reports`가 비어 있을 때만 `rmdir`로 제거한다.
파일이 있으면 삭제하지 않고 경로와 파일 수만 결과에 남긴다.
`career-os/data/reports`는 기존 자료 분류 전까지 보존한다.

## Critical Files

| 파일 | 변경 |
| --- | --- |
| `career-os/.claude/skills/study-topic-recommender/SKILL.md` | 평면 임시 산출물 경로 반영 |
| `career-os/README.md` | 영구 reports 경계 제거 확인 |
| `career-os/docs/code-architecture.md` | 임시 산출물 책임 확인 |
| `career-os/docs/data-schema.md` | 임시 산출물 보존 계약 확인 |

## 검증

```bash
# cwd: fos-agents root
python3 ~/.codex/skills/.system/skill-creator/scripts/quick_validate.py career-os/.claude/skills/study-topic-recommender
bun test ./career-os/scripts/study-topic-recommender
bunx tsc --noEmit --pretty false
git diff --check
```

문서 검사기는 변경한 Markdown 파일을 대상으로 모두 통과해야 한다.

```bash
# cwd: fos-agents root
~/.claude/scripts/korean-style-check.sh career-os/.claude/skills/study-topic-recommender/SKILL.md career-os/README.md career-os/docs/code-architecture.md career-os/docs/data-schema.md
python3 ~/.claude/scripts/check-readability.py career-os/.claude/skills/study-topic-recommender/SKILL.md career-os/README.md career-os/docs/code-architecture.md career-os/docs/data-schema.md
```

`career-os/tasks/plan109-career-ephemeral-reports/index.json`의 `status`를 `completed`, `current_phases`를 `2`로 갱신한다.

## 의도 메모 (왜)

- 사용자가 보는 리포트 개념과 저장소의 영구 `reports/` 디렉터리는 다른 책임이다.
- 다른 워크스페이스의 ignore 정책과 기존 개인 자료는 이 PR에서 바꾸지 않는다.
- 빈 디렉터리만 제거해 사용자 파일을 자동 삭제하지 않는다.

## Blocked 조건

- 기존 `career-os/reports` 또는 `career-os/data/runtime/data/reports`에 파일이 있으면 자동 삭제하지 않고 `PHASE_BLOCKED: 영구 reports 파일 발견`으로 끝낸다.
