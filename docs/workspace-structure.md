# 워크스페이스 표준 구조

ai-nodes 모노레포의 모든 워크스페이스가 따르는 표준 디렉터리 청사진. 결정 근거는 `ai-nodes/docs/adr.md` ADR-004, ADR-006.

새 워크스페이스를 추가할 때 이 문서가 단일 진입점이다.

---

## 1. 워크스페이스 정의

`~/ai-nodes`는 단일 프로젝트가 아닌 **멀티 워크스페이스 컨테이너**다.
각 최상위 디렉터리는 독립 작업 영역으로 자체 skills · data · logs · config · docs를 가진다.
워크스페이스는 서로 격리되며 다른 워크스페이스의 자산을 교차 참조하지 않는다.

현재 워크스페이스 6개:

| 워크스페이스 | 가이드 | 특이사항 |
|---|---|---|
| `apartment/` | `apartment/AGENTS.md` | 네이버 부동산 API + agent-browser |
| `career-os/` | `career-os/AGENTS.md` | scripts/ + .claude/skills/ 분리 (ADR-019 → ADR-006 표준 격상) |
| `stock-investment/` | `stock-investment/AGENTS.md` | 일일 모닝 브리핑 |
| `cooking/` | `cooking/AGENTS.md` | 요리 재료 조사, 재료 비교, 영상 수집, 장보기 리스트 |
| `travel/` | `travel/AGENTS.md` | trips/<trip-id>/ 단위, 의도된 비대칭 (ADR-001) — scripts/.claude/skills/config 부재 (.env는 ADR-002로 도입) |
| `health-care/` | `health-care/AGENTS.md` | 무릎 재활 daily 체크인 (knee-patellar-instability) |

---

## 2. 표준 디렉터리 트리

```
<workspace>/
├── AGENTS.md                     # 에이전트 가이드 본체
├── CLAUDE.md -> AGENTS.md        # Claude Code 자동 로드용 심링크
├── .env                          # secrets (gitignored)
├── .env.example                  # secrets 템플릿 (git tracked)
├── config/                       # 큐레이션된 설정 파일
│   └── *.json
├── docs/                         # 5문서 + 워크스페이스 ADR
│   ├── prd.md
│   ├── data-schema.md
│   ├── flow.md
│   ├── code-architecture.md
│   └── adr.md
├── scripts/                      # 실행 파일 분리 (ADR-006: 분리 표준)
│   └── <skill-name>/             # skill별 runner / 헬퍼
├── .claude/
│   └── skills/
│       └── <skill-name>/
│           ├── SKILL.md          # Claude Code 자동 로드 진입점 (본체)
│           └── references/       # 참조 문서 (컨텍스트 자산)
├── tasks/                        # plan 영구 저장소
│   └── plan{N}-<kebab-slug>/
│       ├── index.json
│       ├── phase-01.md
│       └── phase-NN.md
├── data/                         # 자동 생성 산출물 (gitignored)
│   └── YYYY-MM-DD/
└── logs/                         # 실행 로그 (gitignored)
    ├── task-runs.jsonl
    └── token-usage.jsonl
```

---

## 3. AGENTS.md / CLAUDE.md 심링크 명세

Claude Code는 프로젝트 루트의 `CLAUDE.md`를 자동으로 컨텍스트에 로드한다.
ai-nodes 워크스페이스의 정식 가이드 파일 이름은 `AGENTS.md`이므로, `CLAUDE.md`는 심링크로 두 이름을 연결한다.

```bash
cd <workspace>
ln -s AGENTS.md CLAUDE.md
```

- `AGENTS.md` — 에이전트 가이드 본체. 유일한 편집 대상.
- `CLAUDE.md` — `AGENTS.md`를 가리키는 심링크. Claude Code 자동 로드 목적.

두 파일을 따로 유지하면 drift 발생. 심링크가 유일한 허용 패턴.

---

## 4. docs/ 5문서 컨벤션

워크스페이스 docs/는 5문서 + adr.md로 구성된다. 개별 ADR 파일 신설 금지 — adr.md 단일 누적 (career-os ADR-018, ai-nodes ADR-004).

| 번호 | 문서 | 책임 |
|---|---|---|
| 1 | `prd.md` | 제품 범위 / MVP 타깃 / 기능 표 / 운영 정책 / 성공 기준 / 미연결 항목 |
| 2 | `data-schema.md` | config / data / logs / .env 스키마 |
| 3 | `flow.md` | 명령별 데이터 흐름 (입력 → runner → 산출물) |
| 4 | `code-architecture.md` | 디렉터리 트리 / skill 표준 / 외부 의존성 / Runner 패턴 |
| 5 | `adr.md` | 워크스페이스 한정 ADR 누적. 형식: `## ADR-N — 제목` + Status/Date + 맥락/결정/결과/적용 |

모노레포 공통 결정 (모든 워크스페이스에 영향)은 `ai-nodes/docs/adr.md`에 격상. 워크스페이스 한정 결정만 `<workspace>/docs/adr.md`에.

**형식 정책**: 5문서 본문 작성 시 `ai-nodes/docs/docs-style.md` 형식 정책 준수 (ADR-005). 6 패턴 + 한자어 회피 표 + 거울 구조 원칙.

---

## 5. tasks/plan{N}-<slug>/ 컨벤션

- 번호는 워크스페이스별 독립 namespace. apartment plan001과 career-os plan001은 무관.
- slug는 kebab-case, 간략한 영문 또는 한글 음절 (예: `plan001-docs-and-workspace-standard`).
- 각 plan 디렉터리 안: `index.json` (계획 메타 + status) + `phase-NN.md` (각 phase 명세).
- 완료된 plan도 history 보존 목적으로 삭제하지 않는다.
- draft/ 서브디렉터리 옵션: Write 도구로 draft 파일 먼저 작성 → Read draft → Write target 패턴 (common-pitfalls 6-6 방어).

`skills/planning`은 비대화형 생성기가 아니라 Codex와 사용자가 계획을 합의하기 위한 구조로 사용한다.

공통 운영 원칙:

- planning은 대화형으로 진행한다. 목표, 범위, 열린 결정, 추천 기본값, phase를 사용자가 확인한 뒤 task 파일로 고정한다.
- `claude -p "/planning ..."` 비대화형 planning은 기본 사용하지 않는다.
- Claude 비대화형 실행은 합의된 task/phase 구현에 사용한다.
- Codex는 Claude 구현 결과를 review하고, 검증 후 의도한 변경만 commit/push한다.

구현 자동화가 필요하면 `skills/plan-and-build`가 `run-phases.py`로 phase를 실행할 수 있다.

---

## 6. skills/ 컨벤션

분리 구조 표준 (ADR-006):

```
scripts/<skill-name>/             # 실행 파일 — runner / 헬퍼
.claude/skills/<skill-name>/
├── SKILL.md          # 스킬 명세 본체 (Claude Code native skill 자동 로드)
└── references/       # 참조 문서 (컨텍스트 자산)
```

`.claude/skills/<skill-name>/SKILL.md`를 Claude Code가 자동으로 로드한다 (ai-nodes ADR-002). 실행 파일(`scripts/`)과 컨텍스트 자산(`.claude/skills/`)을 분리해 불필요한 코드 로드를 방지한다.

신규 skill 추가 시:
1. `scripts/<name>/` 실행 파일 배치
2. `.claude/skills/<name>/SKILL.md` 작성 (본체)
3. `.claude/skills/<name>/references/` 참조 문서 배치 (있는 경우)

native skill 진입점: `claude -p "/<skill-name> <args>"`

---

## 7. .env 비밀 정보

- `.env` — 워크스페이스 root에 위치. gitignored. 워크스페이스별 격리 (ai-nodes ADR-004, career-os ADR-021).
- `.env.example` — 키 목록 + placeholder 값. git tracked. 새 secret 추가 시 반드시 동기.
- ai-nodes 루트 `.env` 생성 금지 — 워크스페이스 격리 위반.
- caller는 `bun --env-file=<ws>/.env` 패턴으로 명시적 전달. 라이브러리는 .env 위치 추정 안 함.

공통 key 패턴:
```
DISCORD_CHANNEL_ID=
GITHUB_TOKEN=
GITHUB_REPO_OWNER=
GITHUB_REPO_NAME=
```

---

## 8. 의도된 비대칭 (예외)

모든 워크스페이스가 표준 구조를 따르되, 워크스페이스별 ADR로 결정된 예외가 있다. 예외는 "표준 이탈"이 아니라 "결정된 비대칭"이다.

career-os ADR-019의 scripts/ 분리 패턴은 ADR-006으로 표준 격상되어 현재 의도된 비대칭 없음.

| 워크스페이스 | 비대칭 내용 | 근거 |
|---|---|---|
| apartment | 없음 (ADR-006 분리 표준 적용, plan007) | — |
| career-os | 없음 (ADR-019 → ADR-006 격상) | — |
| stock-investment | 적용 완료 (plan001~004) | 본 표준 적용 시리즈 마지막 plan004로 decisions/ 폐기 + 매트릭스 갱신 |
| travel | scripts/.claude/skills/config 부재 (의도된 비대칭, plan001 ADR-001) — .env는 plan002 ADR-002로 도입 | travel/docs/adr.md ADR-001 + ADR-002 |
| health-care | 없음 (ADR-006 분리 표준 적용, plan002) | — |

새 예외 추가 시: 워크스페이스 `docs/adr.md`에 결정 기록 → 본 표 갱신.

---

## 9. 현재 워크스페이스 준수도 매트릭스

2026-05-19 기준. O = 준수, X = 미준수, ? = 미확인.

| 항목 | apartment | career-os | stock-investment | cooking | travel | health-care |
|---|---|---|---|---|---|---|
| AGENTS.md 존재 | O | O | O | O | O | O |
| CLAUDE.md 심링크 | O | O | O (plan001) | O | O (plan001) | O |
| docs/ 5문서 | O | O | O (plan001) | O | O (plan001) | O (plan002) |
| tasks/plan{N}/ 영역 | O | O | O (plan001~004) | O | O (plan001) | O (plan001~002) |
| skills/ 분리 표준 (ADR-006) | 적용 (plan007) | 적용 (ADR-019 → ADR-006 격상) | 적용 (plan002) | 적용 | N/A (ADR-001 비대칭) | 적용 (plan002) |
| .claude/skills/ native 등록 | O | O | O (plan002) | O | N/A (ADR-001 비대칭) | O |
| .env (workspace root) | O | O | O | 필요 시 생성 (.env.example 있음) | O (plan002 ADR-002) | O (plan002) |
| data/ vs docs/ 분리 | O | O | O | O | O (trips/<trip-id>/data + docs) | O |

stock-investment plan001~004 + health-care plan002 + travel plan001~002 시리즈로 5 워크스페이스 모두 표준 적용 완료. travel은 ADR-001 의도된 비대칭 — scripts/.claude/skills/config 부재 (자동화 0 + workspace-level skill 0). .env는 plan002 ADR-002로 도입.

---

## 10. 새 워크스페이스 추가 체크리스트

```bash
WS=<workspace-name>
mkdir -p ~/ai-nodes/$WS/{docs,config,skills,tasks,data,logs}
mkdir -p ~/ai-nodes/$WS/.claude/skills
```

체크리스트:

- [ ] `$WS/AGENTS.md` 작성 (목적 + 5문서 라우팅 + 진입점 + 운영 원칙)
- [ ] `$WS/CLAUDE.md` 심링크: `ln -s AGENTS.md CLAUDE.md`
- [ ] `$WS/docs/{prd,data-schema,flow,code-architecture,adr}.md` placeholder 작성 (4번 컨벤션 참조)
- [ ] `$WS/config/` 최소 1개 config JSON + gitignore 설정
- [ ] `$WS/.env.example` 키 목록 작성 + `.env` gitignored 확인
- [ ] `$WS/.gitignore` data/ + logs/ + .env 포함 확인
- [ ] 첫 plan 생성: `tasks/plan001-<slug>/` (5문서 본문 작성 + ADR-001 자리)
- [ ] ai-nodes/AGENTS.md 워크스페이스 표 + 진입점 섹션 갱신

---

## 11. 참조

- `ai-nodes/docs/adr.md` ADR-004 — 본 표준의 결정 근거
- `skills/planning/SKILL.md` — 8단계 워크플로 + 5문서 공통 작성 원칙
- `skills/plan-and-build/` — 자동 phase 실행 + common-pitfalls 축적
- `skills/workspace-audit/SKILL.md` — 워크스페이스 건전성 감사 (준수도 매트릭스 업데이트 진입점)
- `skills/docs-check/SKILL.md` — 5문서 + ADR 건전성 감사
