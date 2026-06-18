# build-with-teams reference: 사전 검증 + worktree 격리 실행

실행 전 3중 검증 절차, worktree 기반 격리 실행, 오타 worktree 정리, 선행 push 체크.

## 사전 검증 (실행 전 필수)

plan 인자를 받으면 **가장 먼저** 3중 검증. 하나라도 걸리면 사용자에게 알리고 **실행 차단** (사용자 확인 없이 강행 금지):

1. **main 의 index.json status**: `tasks/{plan}/index.json` 의 `status` 확인

   ```bash
   test -f tasks/{plan}/index.json || echo "TASK_MISSING"
   jq -r .status tasks/{plan}/index.json 2>/dev/null
   ```

   - `TASK_MISSING` → **차단 전 원격 작업 브랜치 자동 스캔 필수** (아래 1-A). main 에 task 파일이 없어도 작업 브랜치에는 있는 정상 상태일 가능성 높음.
   - `completed` → 추가 검증 필요 (PR 미머지 상태에서 `completed` 가 main 에 들어간 사고 가능성. 2·3번 결과로 판정)
   - `pending` / `in_progress` → 다음 검증으로

   **1-A. 원격 작업 브랜치 자동 스캔 (필수 — main 에 task 부재 시)**:

   `TASK_MISSING` 인 경우 곧바로 `/planning` 으로 분기하기 전에 원격 작업 브랜치 후보를 탐색한다.
   task 파일은 작업 브랜치에 먼저 생성되고 PR 머지 전까지 main 에 없는 게 정상.

   외부 업무 매핑(dooray 등)이 있는 워크스페이스는 그 브랜치 패턴으로 원격 스캔한다.
   패턴·식별자는 `variants/<workspace>.md` 가 정의한다.
   GitHub PR 기반 워크스페이스는 `feat/{plan}`/`<type>/{plan}` 원격 브랜치를 스캔한다.

   ```bash
   git fetch origin --quiet
   # variants/<workspace>.md 가 정의한 브랜치 패턴으로 스캔
   # 예: GitHub PR 기반 워크스페이스의 경우
   for ref in $(git ls-remote --heads origin 'feat/*' | awk '{print $2}' | sed 's#refs/heads/##'); do
     git ls-tree -d origin/$ref tasks/{plan}/ >/dev/null 2>&1 && echo "FOUND $ref"
   done
   ```

   - **정확히 1개 매칭**: 옵션 A (기존 브랜치 이어쓰기) 로 자동 전환 — 사용자 confirm. worktree 는 그 브랜치 체크아웃.
   - **0개 매칭**: 진짜 task 없음 — `/planning` 으로 설계 단계 안내.
   - **2개 이상 매칭**: 사용자에게 후보 목록 제시 + 선택 받기.

2. **원격 `feat/{plan}` 브랜치 존재**: 이미 작업 중이거나 PR 미머지 상태

   ```bash
   git ls-remote --heads origin "feat/{plan}" | grep -q . && echo FOUND || echo NONE
   ```

   `FOUND` → 차단 (사용자 확인 후 이어쓸지/새로 시작할지 결정).

3. **해당 plan 제목을 포함한 오픈 PR**: 작업 완료 후 머지 대기 중
   ```bash
   gh pr list --state open --search "{plan}" --json number,title,headRefName
   ```
   결과 있음 → 차단.

세 검증 모두 통과해야 신규 실행. 특히 PR 머지 전 단계에서 main의 index.json은 여전히 `pending`이므로 1번만 보면 재실행 사고를 놓친다. 2·3번이 커버.

### `completed` 마킹 ↔ 머지 commit 정합 검증 (역방향)

1번 검증에서 `status` 가 `completed` 인데 실제 머지 commit 이 `origin/main` 에 없으면 **마킹 사고** (commit 만 됐고 PR 머지 전인데 status 가 잘못 갱신된 케이스).
신규 실행 차단 전 한 번 더 확인:

```bash
git fetch origin
# task 번호 또는 task name 으로 머지 commit 검색
git log origin/main --oneline --grep "{NNN}\|{task-name}" | head -3
```

부재면 사용자에게 알리고 두 선택:

- status 를 `pending` 으로 되돌리고 신규 실행 (마킹 사고 정정)
- 머지 대기 중이면 옵션 A (이어서 작업) 흐름으로 전환

**Why**: completed 가 main 에 들어갔어도 PR 머지 전이면 작업 실제 결과물은 origin/main 에 없다. 1번만 보면 _"완료된 task"_ 로 오인해서 재실행 시도 — fos-blog plan006/007 사고 패턴.

### task 단독 PR 이 이미 열려있는 경우 — 옵션 A (이어서 작업) 권장 흐름

위 2번 (FOUND) + 3번 (OPEN PR) 이 동시에 걸리고, 해당 PR 이 task 파일만 (코드 변경 0개) 머지 대기 중이라면 **옵션 A (이어서 작업)** 로 전환한다.
이는 차단이 아니라 **그 PR 을 그대로 결과물 통합 PR 로 사용**하는 흐름이다 (사후 정리 사고 회피).

**판정 기준** — `gh pr view <N> --json files,additions,deletions` 결과:

- `files` 가 `tasks/{plan}/...` 만 포함 + 코드 (`src/...`) 변경 0
- `state` = OPEN
  → 옵션 A 자동 권장 (사용자 confirm)

**옵션 A 흐름**:

1. **새 브랜치 만들지 말 것** — 기존 브랜치 그대로 사용
2. worktree 체크아웃: `git worktree add .claude/worktrees/{plan} feat/{plan}` (`-b` 없음 → 기존 브랜치 사용)
3. phase 실행 → 결과물 commit → **같은 브랜치**에 push (PR 에 commits 추가됨)

### 옵션 A base 신선도 점검 (필수 — plan032 회고)

옵션 A 는 origin/main 기반 신규 분기가 아니라 **오래된 작업 브랜치를 그대로 이어쓴다**.
그 브랜치의 base 가 origin/main 보다 크게 뒤처져 있으면 PR 머지 충돌 + **신규 CI 단계(신규 lint/CI 도구) 미적용** 위험이 있다.
실측 회고: origin/main 보다 30 commit 뒤처진 브랜치를 이어쓰다가 그 사이 도입된 신규 lint/CI 도구 설정이 worktree 에 없어 PR 직전 origin/main merge 로 해소한 사례가 있다.

worktree 생성 직후 base 신선도를 확인한다:

```bash
# cwd: worktree
git fetch origin --quiet
echo "main 이 앞선 commit: $(git rev-list --count HEAD..origin/main)"
```

- **0~소수**: 그대로 진행.
- **수십 commit 뒤처짐 + 그 사이 신규 CI(신규 lint/CI 도구) 도입**: PR 직전 worktree 에서 `git merge --no-ff origin/main` → 충돌 해소 → **신규 CI 도구를 로컬 설치 후 통과 확인** → 전체 테스트 재실행. merge commit 도 같은 PR 에 포함한다.
  - rebase 금지 (force push 필요 → 프로젝트 force push 금지 정책 위반). merge 로 처리.
  - base 최신화는 PR 모양·충돌 해소에 영향이 크므로 사용자에게 방식을 confirm 받는다.

## worktree 기반 격리 실행 (필수)

작업 간 충돌을 방지하기 위해 반드시 **git worktree** 사용. worktree는 프로젝트 내부 `.claude/worktrees/` 하위에 생성 (프로젝트 부모 디렉터리 오염 방지).

**전제**: `.gitignore`에 `.claude/worktrees/`가 등록되어 있어야 한다.

### 오타 worktree 잔재 자동 정리 (pre-flight + post-flight 모두 필수)

worktree 생성 직전과 정리 직후 두 시점에 모두 아래 명령으로 `.claude` 외 `.cla*` 디렉터리를 탐지.
명백한 오타 변형 (`.claire-worktrees`, `.calude-*`, `.claud-*`) 은 사용자 동의 없이 즉시 `rm -rf` + 1줄 보고.
단 `.claude-` 로 시작하는 (의도된 다른 디렉터리) 가 있다면 사용자에게 먼저 확인.

```bash
# cwd: <repo root>
STRAY=$(find . -maxdepth 1 -type d -name '.cla*' ! -name '.claude' 2>/dev/null)
if [ -n "$STRAY" ]; then
  echo "⚠️ 오타 worktree 디렉터리 잔재 발견 — 자동 제거:"
  echo "$STRAY"
  echo "$STRAY" | xargs -I{} rm -rf {}
fi
```

**Why**: 오타 디렉터리 (예: `.claire-worktrees/plan011-...`) 가 빌드 / 테스트 / 타입 검사 도구 (eslint / tsc / vitest) 의 file scan 에 잡혀 사고 유발. 다음 plan 시작 시점에 자동 정리되도록 점검화.

### 필수 선행 체크 — 로컬 main이 origin에 푸시되었는가?

worktree 는 `origin/main` 에서 분기되므로 **로컬 main 에만 있고 푸시 안 된 커밋은 worktree 에 반영되지 않는다**.
critic 이 "task 파일 없음" 으로 오판하거나 executor 가 구버전 환경에서 실행하는 사고 방지.

```bash
# cwd: <repo root>
git fetch origin
git log --oneline origin/main..main   # 결과가 있으면 로컬 main이 앞서 있음 → 푸시 필요
```

결과가 비어 있지 않으면 `git push origin main` 먼저 수행.

```bash
# cwd: <repo root>
git fetch origin
mkdir -p .claude/worktrees
git worktree add .claude/worktrees/{plan이름} -b feat/{plan이름} origin/main
```

worktree 직후 setup 명령은 `variants/<workspace>.md` 가 정의한다(의존성 설치·코드 생성 등).

**worktree 정리**: 9단계 마지막 스텝에서 수행.

```bash
# cwd: 무관 (절대경로). team-lead 가 main 워킹 디렉터리에서 실행 권장
git -C /<repo-root> worktree remove .claude/worktrees/{plan이름}
```

- 제거 실패 시 (worktree 안에 uncommitted 변경 잔존) → `git -C ... worktree remove --force` 전에 잔존 변경 grep 으로 확인 + 사용자에게 보고. force 직권 금지.
- worktree 안 setup 산출물(`.venv/`·`node_modules/` 등, 수백 MB)도 함께 제거되어 디스크 회수.
- 메인 워킹 디렉터리 브랜치 원복 (worktree 생성 직전 `main` 으로 일시 전환했던) 은 **사용자 판단** — team-lead 가 자동 전환 금지.

이렇게 하면 여러 plan을 **동시 병렬 실행**해도 서로 간섭하지 않는다.
