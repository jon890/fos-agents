# CLAUDE.md

이 파일은 이 저장소에서 작업할 때 Claude Code(claude.ai/code)에 제공할 가이드라인입니다.

## 저장소 구조

`~/ai-nodes`는 단일 프로젝트가 아닌 **멀티 워크스페이스 컨테이너**입니다. 최상위 디렉터리 각각은 자체 skills, data, logs, config를 갖는 **독립적인 작업 워크스페이스**입니다. 워크스페이스는 서로 격리되어야 하며, 다른 워크스페이스의 자산을 교차 참조하지 않습니다.

현재 워크스페이스:

- `apartment/` — 일일 아파트 시세 리포트 파이프라인 (타깃: 엘지원앙아파트 / LG원앙, 59A 타입). `apartment/AGENTS.md`, `apartment/TOOLS.md` 참조.
- `career-os/` — 면접/커리어 준비 자동화. 현재 액티브 타깃은 `career-os/config/mvp-target.json`이 단일 출처(과거 타깃 history도 같은 파일에 보존). 해당 서브트리 작업 시 `career-os/CLAUDE.md`가 이 파일을 오버라이드합니다.
- `_shared/` — 워크스페이스 공통 셸/파이썬 스크립트. 내용: `track_task.sh`(실행 트래커), `extract_claude_result.py`(Claude CLI JSON → 마크다운 리포트), `update_artifacts.py`(`data/generated-artifacts.json` upsert).
- `skills/` — 워크스페이스 공용 스킬. 현재 `agent-browser`만 존재하며, 로컬에 설치된 `agent-browser` CLI를 통한 브라우저 자동화입니다(Naver Land처럼 JS 렌더 의존도가 높은 페이지 수집에 사용). 스크립트성 공용 코드는 `_shared/bin/`에, 재사용 가능한 스킬 단위는 여기에 둡니다. Claude Code가 자동 로드하도록 스킬 단위 심링크를 둡니다: 저장소 전역 공용 스킬은 루트 `.claude/skills/<name>`, 워크스페이스 전용 스킬은 `<workspace>/.claude/skills/<name>`(예: `apartment/.claude/skills/apartment-daily-report`)에 위치합니다. 후자는 해당 워크스페이스에서 CC를 실행할 때만 자동 로드되어 격리 원칙을 유지합니다. `.gitignore`는 이 두 패턴만 예외 처리합니다.

모든 워크스페이스는 동일한 레이아웃을 따릅니다: `skills/`, `data/`, `logs/`, `config/`, 그리고 career-os의 경우 ADR을 위한 `docs/decisions/`.

## 실행 모델

모든 워크스페이스 실행은 `_shared/bin/track_task.sh`로 래핑되며, 이 스크립트는 다음을 수행합니다:

- 실행별 로그를 `<workspace>/logs/task-runs.jsonl`과 `token-usage.jsonl`에 기록
- 실행 전후 `openclaw status`를 캡처하여 모델/토큰/캐시 변화량(diff) 산출
- 실행 전후 파일 메트릭(`report.md`, `analysis-input.md`, `target-files.txt`) 스냅샷 저장
- 러너가 기록한 Claude CLI usage JSON을 `TRACK_TASK_CLAUDE_USAGE_FILE`을 통해 수집

워크스페이스 러너는 반드시 트래커를 통해 호출 가능해야 하며, 영속 산출물을 만들 때는 절대로 트래커를 우회하지 않습니다. `career-os`의 모든 `run_now.sh` 계열 진입점은 이미 트래커로 `exec`하며, `apartment/skills/apartment-daily-report/scripts/run_report.sh`는 `TRACK_TASK_WRAPPED`를 통해 자가 래핑합니다.

**외부 의존성**: `_shared/bin/track_task.sh`가 없으면 모든 워크스페이스 러너가 실패합니다. 이 스크립트는 load-bearing 요소로 취급하세요.

## 워크스페이스 진입점

### apartment

```bash
apartment/skills/apartment-daily-report/scripts/run_report.sh
```

산출물은 `apartment/data/YYYY-MM-DD/` 아래 `report.md`, `raw-search.json`, `summary.json`, `claude.result.json` 형태로 저장됩니다. 종합 단계는 `claude --permission-mode bypassPermissions --print --output-format json`을 사용하며, Claude가 타임아웃(90초)될 경우 대체 마크다운을 생성합니다.

### career-os

```bash
career-os/skills/cj-oliveyoung-java-backend-prep/scripts/run_now.sh baseline
career-os/skills/cj-oliveyoung-java-backend-prep/scripts/run_now.sh daily [topic]
career-os/skills/cj-oliveyoung-java-backend-prep/scripts/run_now.sh study-pack <topic>
career-os/skills/cj-oliveyoung-java-backend-prep/scripts/run_now.sh question-bank <topic>
career-os/skills/cj-oliveyoung-java-backend-prep/scripts/run_now.sh master [topic]
career-os/skills/cj-oliveyoung-java-backend-prep/scripts/run_now.sh smoke
```

`run_now.sh`가 유일한 디스패치 지점입니다. `career-os/config/*.json`에서 토픽 설정을 해석하고, 토픽별 리졸버(`resolve_study_pack_topic.py`, `resolve_question_bank_topic.py`, `resolve_master_topic.py`)가 `export KEY=value` 라인을 출력하면 이를 `eval`로 소비한 뒤, `track_task.sh`를 통해 해당 스킬 러너를 `exec`합니다. 토픽 키는 `career-os/config/{topic-file-map,study-pack-topics,experience-question-bank-topics,interview-master-topics}.json`에 정의되어 있습니다.

`study-pack`, `question-bank`, `master` 실행은 생성된 마크다운을 `career-os/sources/fos-study`에 커밋/푸시하고, `_shared/bin/update_artifacts.py`를 통해 `data/generated-artifacts.json`을 upsert합니다. 푸시 실패는 조용히 넘어가지 말고 반드시 표면화되어야 합니다.

서브 스킬은 `career-os/skills/` 아래에 있습니다: `cj-oliveyoung-java-backend-prep`(디스패처 + baseline/daily/smoke/morning-*), `study-pack-writer`(토픽 기반 마크다운), `experience-question-bank-writer`(JSON 스키마 검증 인터뷰 Q&A), `interview-master-writer`(크로스팀 시니어 백엔드 플레이북).

## Claude CLI 호출 패턴

워크스페이스마다 Claude CLI를 부르는 방식이 다릅니다. 혼용하지 말고 해당 워크스페이스의 기존 패턴을 따릅니다.

- **apartment**: `claude --permission-mode bypassPermissions --print --output-format json`으로 JSON 결과를 받고, 90초 타임아웃 시 대체 마크다운으로 폴백합니다. JSON은 `_shared/bin/extract_claude_result.py`가 `report.md`로 변환합니다.
- **career-os (study-pack / question-bank / master)**: stdout 캡처 방식(ADR-007). 러너가 Claude stdout을 그대로 받아 직접 마크다운 파일로 저장합니다. usage 메트릭은 `TRACK_TASK_CLAUDE_USAGE_FILE`에 기록되어 트래커가 읽어갑니다.

패턴을 바꾸려면 ADR로 결정 근거를 남긴 뒤 진행합니다.

## 작업 규칙

- `career-os/sources/fos-study`는 동기화된 외부 저장소입니다(`github.com/jon890/fos-study`, `main` 브랜치). 마크다운만 분석하고 `.claude/**`은 무시합니다. study-pack/question-bank 실행이 실제로 퍼블리싱 중이 아닌 한 편집 가능한 프로젝트 코드로 취급하지 마세요.
- 자동 생성 리포트는 `<workspace>/data/reports/`로 저장됩니다. 별도의 큐레이션 싱크는 없습니다 — ADR-004(폐기) 참조.
- `career-os`의 아키텍처 결정은 `career-os/docs/decisions/`에 ADR로 존재합니다. 워크플로 스크립트, 파일 선택 전략, 퍼블리싱 정책을 변경하기 전에 반드시 검토하세요.
- 워크플로는 재실행 가능하고 날짜별로 멱등해야 합니다. 실시간 수집 파이프라인보다 로컬 git-sync + 파일 읽기를 선호합니다.
- 리포트에서 불확실성은 명시적으로 드러냅니다(매물 수, 실거래 매칭 등). 추측으로 공백을 메우지 말고 공백 자체를 기록하세요.
- 비밀 정보는 저장소 루트가 아닌 `<workspace>/config/.env`에 저장합니다(예: `GITHUB_TOKEN`).
- career-os 비용 규율: 저장소 전체를 광범위하게 분석하지 않습니다. baseline은 `career-os/config/baseline-core-files.txt`의 큐레이션된 핵심 집합을 사용하고, daily 실행은 더 작게 유지합니다.

## 모호함 대응 규칙

요청을 받았을 때 혹은 진행 중 결정점에서 모호한 부분이 생기면 즉시 다음을 수행한다.

1. 모호함을 **1-10점**으로 평가한다 (1=완전히 명확, 10=완전히 미정).
2. 현재 모호함 점수와 사유를 한 줄로 사용자에게 보고한다.
3. **점수와 무관하게 항상 진행 계획을 먼저 알린다**. "이러이러하게 할 계획"이라고 1-2줄로 명시한 뒤 사용자의 stop 신호가 없으면 진행한다.
4. 점수가 **3 이상**이면 계획만 알리지 말고 진행 전에 `AskUserQuestion`으로 옵션을 제시해 사용자와 논의한다.

조용히 결정하고 진행하지 않는다. 작은 결정이라도 어떤 기본값을 골랐는지 보이게 한다. 목적은 "본인 의도와 어긋난 채 작업이 누적되는 것"을 막는 것이다. 진행 속도보다 정합성을 우선한다. 새 작업이 들어와도 동일하게 적용한다.

## 커밋 메시지 컨벤션

Conventional Commits 포맷을 따르되 subject와 본문은 한글로 작성합니다.

- 헤더: `<type>[(scope)]: <한글 subject>`
  - `type`은 영어 소문자로 유지 (릴리즈 자동화/CHANGELOG 도구 호환성): `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `style`, `perf`, `build`, `ci`
  - `scope`는 워크스페이스 또는 모듈명 (예: `apartment`, `career-os`, `CLAUDE`, `_shared`)
  - subject는 50자 내외, 마침표 생략
- 본문은 한 줄 띄우고 한글 서술. 변경 항목은 `-` 불릿으로 나열
- `Co-Authored-By:` 같은 트레일러는 영어 그대로

예:
- `docs(CLAUDE): 공용 skills/ 디렉터리와 Claude CLI 호출 패턴 문서화`
- `fix(apartment): Naver 브라우저 수집 실패 시 fallback 경로 보정`

이 규칙은 제정 이후 신규 커밋부터 적용하며, 기존 영어 커밋 히스토리는 소급 리라이트하지 않습니다.
