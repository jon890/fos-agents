# Common Pitfalls Index

plan-and-build task와 phase 작성 중 반복된 실패 패턴의 라우터다.

## 사용 순서

1. 이 파일에서 현재 작업과 맞는 trigger를 찾는다.
2. 해당 pattern file만 읽고 self-check를 적용한다.
3. 어떤 항목이 필요한지 모호하면 category 디렉터리 전체를 확인한다.
4. 새 사고 타입을 추가할 때는 `history.md`에 실제 발생 사례를 1줄로 남긴다.

## 축적 기준

새 pattern은 아래 네 기준을 모두 통과할 때만 추가한다.

- 반복 가능성이 있다.
- 실패 비용이 크거나 review에서 자주 반복된다.
- 일반 도구나 lint가 자동으로 잡기 어렵다.
- 한 plan에만 묶이지 않고 다른 작업에도 일반화된다.

## 빠른 라우터

| ID | Category | Trigger | File | 핵심 self-check |
|---|---|---|---|---|
| 1-1 | plan | 파일 수, 줄 수, 감소량, 개수 | [1-1-metric-guessing.md](plan/1-1-metric-guessing.md) | 수치 옆 실측 명령 동반 |
| 1-2 | plan | 성공 기준, 검증 기준, 동작 확인 | [1-2-vague-success-criteria.md](plan/1-2-vague-success-criteria.md) | exit code로 판정 가능한 명령 사용 |
| 1-3 | plan | phase 분리, 이전 phase, context | [1-3-phase-context-assumption.md](plan/1-3-phase-context-assumption.md) | 각 phase가 독립 실행 가능 |
| 1-4 | plan | 범위 외, 검증 충돌, phase 경계 | [1-4-scope-validation-conflict.md](plan/1-4-scope-validation-conflict.md) | 범위 외 항목이 검증 조건에 등장하지 않음 |
| 1-5 | plan | ADR, 결정, trade-off, supersede | [1-5-adr-single-responsibility.md](plan/1-5-adr-single-responsibility.md) | 독립 결정은 ADR 분리 |
| 2-1 | workspace | 다른 워크스페이스, cross-workspace | [2-1-cross-workspace-assets.md](workspace/2-1-cross-workspace-assets.md) | path가 현재 workspace, `_shared`, `.claude/skills` 범위 |
| 2-2 | workspace | 새 config, 스키마 누락 | [2-2-config-schema.md](workspace/2-2-config-schema.md) | 새 config와 data-schema 갱신 동반 |
| 3-1 | docs-data | docs 아래 데이터, json, csv | [3-1-data-under-docs.md](docs-data/3-1-data-under-docs.md) | 데이터는 `<workspace>/data/` |
| 3-2 | docs-data | ADR 저장 위치, 개별 ADR, append | [3-2-adr-storage-mix.md](docs-data/3-2-adr-storage-mix.md) | workspace별 ADR 방식 준수 |
| 3-3 | docs-data | phase에서 docs 수정, docs-first | [3-3-docs-in-phase.md](docs-data/3-3-docs-in-phase.md) | docs 변경은 task 실행 전 별도 commit |
| 4-1 | runner | runner 직접 호출, dispatcher 우회 | [4-1-dispatcher-bypass.md](runner/4-1-dispatcher-bypass.md) | `run_now.sh <command>` 경유 |
| 4-2 | runner | usage, cost, claude output | [4-2-usage-persistence.md](runner/4-2-usage-persistence.md) | `claude_persist_usage` 호출 보장 |
| 4-3 | runner | Discord, webhook, curl | [4-3-direct-webhook.md](runner/4-3-direct-webhook.md) | 알림 helper 경유 |
| 5-1 | git | force push, no-verify, hooks | [5-1-force-push-hooks-skip.md](git/5-1-force-push-hooks-skip.md) | 위험 플래그 0건 |
| 5-2 | git | 여러 commit, 무관 변경 | [5-2-unrelated-commits.md](git/5-2-unrelated-commits.md) | commit별 단일 관심사 |
| 5-3 | git | fos-study, 외부 저장소 | [5-3-fos-study-direct-commit.md](git/5-3-fos-study-direct-commit.md) | 검증된 runner 경유 |
| 5-4 | git | 병렬 task, main worktree | [5-4-parallel-main-worktree.md](git/5-4-parallel-main-worktree.md) | active task가 2개 이상이면 worktree |
| 5-5 | git | dirty file, stage 범위 | [5-5-unrelated-dirty-stage.md](git/5-5-unrelated-dirty-stage.md) | staged files가 intended files만 |
| 6-1 | harness | PHASE_FAILED, PHASE_BLOCKED, exit code | [6-1-marker-with-zero-exit.md](harness/6-1-marker-with-zero-exit.md) | marker 직후 non-zero exit |
| 6-2 | harness | trailing working tree, commitSha | [6-2-trailing-working-tree.md](harness/6-2-trailing-working-tree.md) | 마지막 phase 후 clean 확인 |
| 6-3 | harness | JSON newline | [6-3-json-trailing-newline.md](harness/6-3-json-trailing-newline.md) | JSON write에 trailing newline |
| 6-4 | harness | 검증 미실행, success 추정 | [6-4-unrun-verification.md](harness/6-4-unrun-verification.md) | raw value stdout 출력 후 비교 |
| 6-5 | harness | 제거, 삭제, additive | [6-5-destructive-to-additive.md](harness/6-5-destructive-to-additive.md) | 반증 grep으로 잔재 0건 확인 |
| 6-6 | harness | Write 위장, prose-only | [6-6-write-disguised-as-prose.md](harness/6-6-write-disguised-as-prose.md) | draft 파일과 commit 개수 self-check |
| 6-7 | harness | SKILL.md 재작성, references audit | [6-7-references-audit.md](harness/6-7-references-audit.md) | references 옛 subprocess 키워드 grep |
| 6-8 | harness | cwd, workspace path | [6-8-cwd-workspace-mismatch.md](harness/6-8-cwd-workspace-mismatch.md) | 첫 bash에서 repo root로 이동 |
| 6-9 | harness | sigil, section mark, tilde | [6-9-sigil-self-positive.md](harness/6-9-sigil-self-positive.md) | literal 대신 Unicode 이름과 escape 변수 사용 |
