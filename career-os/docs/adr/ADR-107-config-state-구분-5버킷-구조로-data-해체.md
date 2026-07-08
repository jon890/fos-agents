## ADR-107 — config/state 구분 기준을 세우고 data/를 5버킷 top-level 구조로 해체한다

- Status: Accepted
- Date: 2026-07-08

### 맥락

career-os는 자산을 `config/`(사람이 큐레이션)와 `data/`(생성물·runtime)로만 나눴다.
`data/` 아래에 지원 원장, 생성 리포트, runtime 캐시, 수집 노트가 성격 구분 없이 섞여 있다.
경로가 SKILL·scripts·docs·ADR·.gitignore 수십 곳에 박혀 있어, 무엇이 사용자 의도이고 무엇이 시스템 산물인지 경로만으로 판단하기 어렵다.

또한 "누가 타이핑했나"로는 config와 나머지를 가를 수 없다.
career-os에서는 config 값도 대부분 사용자와 LLM 대화로 작성되기 때문이다.
가르는 기준은 타이핑 주체가 아니라 "이 파일이 바뀌는 트리거가 무엇인가"여야 한다.

### 결정

파일을 바꾸는 트리거로 config와 state를 가르고, top-level을 5개 버킷으로 재편한다.

config와 state 구분 기준:

- config — 바뀌는 계기가 사용자의 의도·결정이다.
  드물게 변경하고, 사람이 검토·승인하며, 프롬프트 주입 대상이다. (소스코드·설정에 해당)
- state — 바뀌는 계기가 시스템 실행·이벤트다.
  자주 자동으로 갱신하고, 매번 검토하지 않으며, 프롬프트에 통째로 주입하지 않는다. (DB row·로그에 해당)

top-level 5버킷:

| 버킷 | 성격 | 대표 내용 |
|---|---|---|
| `config/` | 사용자 의도·정책·사실 | candidate-profile 계열, position-collection, verified-company, external-reading-sources, study-preferences, study-pack-topics, topic-profiles, question-bank-topics, live-coding-seed 계열, baseline-core-files, resume-design, candidate-config |
| `state/` | 시스템 실행·이벤트 산물 | positions-queue.jsonl, study-progress, drill-progress, mvp-target, topic-inventory 계열, study-pack-candidates, drill-log 계열, company-cooldown, 수집 노트, eval 산물 |
| `applications/` | 지원 건별 작업 문서 | `<company>/<role>/{posting,fit-analysis,application-package,resume-draft,cover-letter,submission-checklist,review}.md` |
| `reports/` | 사람이 읽는 생성물 | daily·baseline·job-fit·stage-prep 리포트, morning-topic-recommendation, `reports/latest/`(옛 mirror), `reports/downloads/` |
| `cache/` | 재생성 가능한 캐시·transient | live-position-postings snapshot, feed-cache, locks, normalized, deferred 임시 컨테이너 |

`data/`는 이 버킷들로 해체하고 top-level 이름으로 두지 않는다.
파일별 전수 이동표는 plan093 `tasks/plan093-config-state-restructure/decisions.md`가 정본이다.

### 거절한 대안

- config/data 2분류 유지 — 생성 리포트·runtime·지원 원장이 한 `data/`에 섞여, 성격을 경로로 드러내지 못하고 gitignore·retention 정책을 파일마다 예외 처리해야 한다.
- 타이핑 주체로 config를 가르기 — config 값도 LLM 대화로 작성되므로 기준이 서지 않는다.

### 결과

- 경로 이름만으로 자산 성격(사용자 의도 / 시스템 산물 / 지원 문서 / 사람용 리포트 / 캐시)을 판단한다.
- gitignore·retention 정책을 버킷 단위로 일관되게 적용한다.
- 단점 — 경로가 박힌 SKILL·scripts·docs·.gitignore 수십 곳을 함께 갱신해야 하고, 갱신을 놓치면 깨진 참조가 남는다(plan092에서 겪음). 파괴적 이동 전에 본 ADR과 전수 이동표로 결정을 먼저 고정한다.

### runtime 실데이터 마이그레이션은 별도 후속

이 결정은 경로 규약(convention)과 git 추적 자산만 바꾼다.
`.gitignore`의 `**/data/`로 `data/` 전체가 untracked runtime이고, 실파일은 worktree가 아니라 main 워킹 디렉터리에만 있다.

- 하는 것 — 신규 ADR·live docs 갱신, `.gitignore` 재작성, tracked `config/*.json`의 `state/` 이동과 cooldown 분리, SKILL·scripts·docs의 경로·용어 참조 갱신.
- 하지 않는 것 — `data/**` untracked 실파일의 물리 이동, 마이그레이션 스크립트 실행.
- 옛 실데이터는 사용자가 이후 직접 이전하거나 다음 실행에서 새 경로로 재생성한다.
- 구현 phase의 검증은 `bun --check` + 스크립트의 새 경로 부재 graceful 처리 + 옛 경로 참조 0 grep으로 갈음한다. 실런타임 데이터 검증은 이 plan 밖이다.

### 적용

- `docs/data-schema.md`·`docs/code-architecture.md`·`docs/flow.md`의 디렉터리 책임·경로를 5버킷 구조로 갱신한다.
- `config/*.json` 중 study-progress·drill-progress·mvp-target·study-pack-candidates를 `state/`로 옮기고(ADR-105·ADR-002 연장), 이동표에 tracked/untracked를 확정한다.
- `.gitignore`의 `**/data/` 경계를 `state/`·`reports/`·`cache/`·`applications/`로 재작성한다(구현은 Phase 05).
