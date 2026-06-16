## ADR-055 — background worktree는 완료 시 명시적으로 정리한다

- Status: Accepted
- Date: 2026-06-07

### 맥락

긴 구현 phase와 병렬 작업을 main worktree에서 분리하기 위해 별도 git worktree를 사용한다.
이 방식은 unrelated dirty state를 피하는 데 유용하지만, 완료된 worktree 디렉터리가 남으면 현재 active 작업과 과거 작업의 경계가 흐려진다.

### 결정

- background worker가 별도 worktree를 만들었다면 완료/중단 보고 전에 worktree cleanup을 완료 조건으로 다룬다.
- 제거 전 `git -C <worktree> status --short`로 남은 변경이 없는지 확인한다.
- clean worktree는 `git worktree remove <worktree>`로 명시적으로 제거한다.
- dirty worktree는 제거하지 않고 남은 변경과 경로를 보고한다.
- worktree 디렉터리 제거와 branch 삭제는 분리한다.
  branch는 review, 비교, 복구에 필요할 수 있으므로 기본적으로 삭제하지 않는다.

### 결과

- main workspace 주변에 오래된 `ai-nodes-worktrees/*` 디렉터리가 누적되지 않는다.
- 완료 보고에는 worktree/branch 사용 여부와 cleanup 결과가 포함된다.
- branch 보존과 디렉터리 정리를 분리해 복구 가능성을 유지한다.
