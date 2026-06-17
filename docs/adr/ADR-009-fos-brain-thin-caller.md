## ADR-009 — fos-brain 외부 연동: thin caller + 외부 배치 + 워크스페이스 공유 의존성

- Status: Accepted
- Date: 2026-05-28

### 맥락

사용자가 개인 지식 기반 fos-brain(`github.com/jon890/fos-brain`)을 Karpathy 스타일 LLM wiki로 구축했다.
brain은 자체 완결 시스템이다.

- 세 네임스페이스 — public / private / work.
- `raw/`(원본) + `wiki/`(컴파일) 모델.
- 자체 skill 3개 — brain-add / brain-search / brain-lint (repo `skills/`에 체크인).
- qmd 검색 + Quartz UI.

ai-nodes 5개 워크스페이스 agents가 작업 중 brain을 읽고(컨텍스트 활용) 쓰는(학습 적재) 양방향 연동을 원한다.
ai-nodes는 openclaw(discord + cron) 경유로 이 Linux 머신에서 실행된다.
brain은 ai-nodes와 별개 repo이며, 지금까지 워크스페이스는 서로 격리(ADR-001 계열)되어 외부 공유 자산을 두지 않았다.

### 결정

- **thin caller** — ai-nodes는 brain 로직을 재구현하지 않고 brain 자체 skill(brain-search / brain-add)을 호출만 한다. brain의 스키마·백링크·INDEX·네임스페이스 규칙은 brain repo가 단일 소스.
- **외부 배치** — brain은 ai-nodes 밖 `~/personal/fos-brain`에 둔다. ai-nodes 안에 클론을 중첩하지 않는다.
- **워크스페이스 공유 의존성(격리 의도적 예외)** — 5개 워크스페이스 전부가 동일 외부 brain을 읽고 쓸 수 있다. 워크스페이스 격리(서로의 자산 비참조) 원칙의 *의도된 예외* — brain은 워크스페이스가 아니라 `_shared/`의 외부판에 해당하는 공유 자원.
- **접근 경로 = 전역 skill** — brain repo의 `skills/brain-*`를 `~/.claude/skills/`에 symlink한다. openclaw가 띄우는 `claude -p` 세션이 전역 skill로 발견.

전제조건 (brain repo 소관, ai-nodes 범위 밖):

- brain skill 본문의 대상 경로가 `/Users/nhn/personal/fos-brain`(Mac)로 하드코딩되어 있다.
- Linux 무인 실행이 가능하려면 `~/personal/fos-brain`로 통일해야 한다.
- ai-nodes는 brain repo를 편집하지 않으므로 이 수정은 사용자가 brain repo에서 처리.

거절한 대안:

- ai-nodes 자체 brain-bridge skill로 brain 파일 직접 read/write — brain 로직(백링크·Sources·INDEX·라우팅) 중복 + drift 위험.
- brain을 ai-nodes 안에 클론(`career-os/sources/fos-study` 패턴) — fos-study는 단방향 읽기 소스라 맞지만, brain은 read+write + private/work 네임스페이스(gitignore)라 ai-nodes git 중첩 시 비공개 유출·push 사이클 충돌.
- qmd / MCP 별도 인터페이스 — brain repo에 MCP 서버 코드가 없어 선행 구축 비용.

### 결과

- ai-nodes는 brain의 *호출자*로만 동작 — brain 진화가 자동 반영, drift 없음.
- 워크스페이스 격리의 명시적 예외가 ADR로 가시화 — 다음 audit이 "고아 외부 의존성"으로 오판하지 않음.
- brain skill 미설치 머신에서는 연동이 동작하지 않음 — 전제조건(클론 + symlink + 경로 통일)이 충족돼야 함.
- 쓰기 방향의 안전·프라이버시 정책은 ADR-010이 책임.

### 적용

- 단일 소스 정책: `ai-nodes/AGENTS.md` 13번 "fos-brain 외부 연동" 섹션.
- 워크스페이스 AGENTS.md는 본 ADR + ADR-010 역참조 + 자기 산출물 라우팅만 명시(거울 구조).
- 전제조건 체크리스트(클론·symlink·경로 통일·openclaw wrapper 동기화)는 사용자 수동 1회.
- `ai-nodes/tasks/plan003-fos-brain-integration` phase 참조.

---
