# AGENTS.md — stock-investment 워크스페이스

`~/ai-nodes` 아래 독립 작업 워크스페이스. 모든 에이전트(Claude / Codex / Gemini 등)를 위한 정식 가이드 진입점. `CLAUDE.md`는 이 파일의 심볼릭 링크.

상세 결정·스키마·흐름은 `docs/` 5문서에 분리. 이 파일은 진입점·운영 원칙만 담는다.

## 1. 5문서 라우팅

| 문서 | 무엇이 들어 있는지 | 언제 보는지 |
|---|---|---|
| `docs/prd.md` | 제품 범위·MVP 타깃·기능 표·미연결 항목 | 새 기능 추가 / 우선순위 결정 |
| `docs/data-schema.md` | config (6 json) / data / logs / .env 스키마 | 데이터 파일 변경 / 새 config 도입 |
| `docs/flow.md` | 3 skill 데이터 흐름 (수집→분석→파일·표준 출력) | 흐름 추가 / 디버깅 |
| `docs/code-architecture.md` | 디렉터리 트리·skill 표준·외부 의존 | 코드 구조 변경 / 새 스킬 추가 |
| `docs/adr.md` | stock-investment 한정 ADR 누적 (현재 ADR-001~003). 모노레포 레벨: `../docs/adr.md` | 결정의 *왜* |

## 2. tasks/ 영역

planning + plan-and-build 스킬로 운영. 형태: `tasks/plan{N}-<slug>/`.
실행 중인 plan만 두며 완료하거나 폐기한 plan은 Git 이력으로 보존한다.

## 3. 목적

주식·암호화폐 모닝 브리핑 + 일일 분석 자동화 (단일 사용자, 매일 재실행 가능).

## 4. 현재 타깃

CRCL (Circle) + BTC + GOOGL/GOOG + QQQ + AI 반도체/인프라.
상세는 `docs/prd.md` 2번·4번.

## 4-1. 진실 출처

각 자산이 *어디서 정의되고 어디로 발행되는지* 단일 출처:

- **종목·테마 정의**: `config/watchlist.json` (CRCL/BTC/GOOGL/QQQ 등 기본 watch) + `config/catalysts.json` (테마별 catalyst 이벤트) + `config/theme-reports.json` (Core+Theme 구조 메타데이터).
- **현안 토픽 큐**: `config/current-issues.json` — issue-analysis skill이 토픽 단위로 분석.
- **수집 소스**: `config/sources.json` — morning-brief가 뉴스·가격 fetch.
- **daily-note 후보 풀**: `config/daily-stock-universe.json` — daily-stock-analysis-note skill이 매일 1 종목 선택.
- **종목 선택 이력**: `data/daily-notes/history.json` — rotation 패널티 적용 (같은 종목 연속 선택 방지).
- **투자 가설 누적**: `data/thesis-tracker/<ticker>.json` — 종목별 시계열 thesis 추적.
- **발행 준비 산출물**: `stock-investment/data/publish/` — 블로그 글 초안, 발행 요청 메타데이터, 싱크 확인 대기 상태를 이 워크스페이스 안에만 보관한다.
- **외부 발행 대상**: 다른 워크스페이스나 외부 git 저장소를 이 프로필에서 직접 수정하지 않는다. `fos-study` 반영은 별도 승인된 발행 프로필·Jenkins·수동 작업으로 넘긴다.
- **비밀 정보**: `.env` (워크스페이스 root, gitignore) 또는 실행 환경의 secret 저장소를 사용한다. 비밀값은 채팅·문서·로그에 쓰지 않는다.

회사명·티커·테마를 어떤 markdown에도 박지 않는다 — config json 한 곳만 수정해서 전환.

## 4-2. 투자 컨텍스트

- **관찰·분석 한정**: 실시간 거래 자동화 / 매수·매도 의사결정 자동화 *금지*. 본 워크스페이스는 *시장 관찰 + 정보 정리 + 학습 자산 생성*만 책임.
- **재무 자문 아님**: 모든 산출물은 *개인 학습용*. blog 발행물에도 명시.
- **테마 단위 추적**: 종목 개별보다 *테마 (AI 반도체 / 인프라 / 금융 서비스 / 암호화폐 등)* 단위로 catalyst·뉴스 묶음.
- **검증된 사실·해석 분리**: 가격·뉴스 timestamp는 *수집 raw* 보존 + Claude 해석은 *별도 섹션*.
- **불확실성 명시**: 추측·예측은 *추측이라 명시*. 사실로 위장 금지.

## 4-3. fos-study 블로그 발행 의미

사용자가 `블로그 글 발행`, `블로그 글로 만들어줘`, `fos-study에 게시해줘`처럼 말하면, stock-investment 맥락에서는 이 프로필이 `stock-investment/data/publish/` 아래에 `[초안]` 마크다운과 발행 요청 메타데이터를 만든다는 뜻으로 이해한다.
`career-os/sources/fos-study` 같은 다른 워크스페이스나 외부 git 저장소는 이 프로필에서 직접 수정하지 않는다.

- 이미 다룬 종목의 최신 이슈는 새 일일 종목 노트로 중복 생성하지 않는다.
- 이런 경우 `YYYY-MM-DD-<ticker>.md`가 아니라 `YYYY-MM-DD-<topic>.md` 형태의 후속 이슈 분석 초안으로 처리한다.
- 모든 글은 투자 권유가 아니라 개인 공부용 관찰/분석 노트로 쓴다.
- 실제 `fos-study` 반영, commit/push, Jenkins 싱크, 공개 블로그 URL 확인은 별도 승인된 발행 프로필·Jenkins·수동 작업에서 수행한다.
- 이 프로필은 외부 반영 결과를 사용자가 제공하거나 읽기 권한이 명확할 때만 확인한다.

## 5. 워크플로 진입점

4 skill — ADR-006/013 분리 패턴 (`scripts/<name>/` + `.claude/skills/<name>/` 정본 + `.codex/skills/<name>/` 노출, plan002 적용).

| skill | 권장 시점 | 호출 방식 | 산출물 |
|---|---|---|---|
| `stock-investing-morning-brief` | 매일 08:00 Asia/Seoul | agent skill 또는 thin wrapper | 일일 브리핑 파일과 stdout 요약 |
| `stock-youtube-learning-digest` | 매일 08:20 Asia/Seoul | 후보 감지 script와 agent skill | 신규 영상 학습 요약 |
| `daily-stock-analysis-note` | 매일 09:00 Asia/Seoul | agent skill 또는 thin wrapper | 워크스페이스 내부 분석 노트와 stdout 요약 |
| `current-issue-analysis` | 사용자 수동 호출 | 자연어 또는 슬래시 | 현안 분석 파일과 stdout 요약 |

```bash
# 운영 호환 skill 진입점 (.claude/skills/ 자동 로드)
claude -p "/stock-investing-morning-brief"
claude -p "/current-issue-analysis <issue-key>"
claude -p "/daily-stock-analysis-note"

# 또는 thin wrapper 직접 호출 (cron payload 동일 경로)
bash $HOME/ai-nodes/stock-investment/scripts/stock-investing-morning-brief/run_with_claude.sh
bash $HOME/ai-nodes/stock-investment/scripts/current-issue-analysis/run_with_claude.sh <issue-key>
bash $HOME/ai-nodes/stock-investment/scripts/daily-stock-analysis-note/run_with_claude.sh
```

cron payload 갱신 이력:
- plan002 phase-01: `skills/<name>/scripts/` → `scripts/<name>/` 갱신 완료 (2026-05-20).
- ADR-003 native 전환: `run_*.sh` → `run_with_claude.sh` 갱신 예정 (plan006).

## 6. 외부 의존성

- `.claude/skills/` — agent skill 정본.
- `.codex/skills/` — Codex 노출용 심볼릭 링크.
- `claude` CLI — 운영 호환 skill 직접 호출 (`claude -p "/<skill>"`).
- `python3` — 수집기 스크립트 (collect_*.py). yfinance, requests 등.
- `uv` — YouTube 자막 추출 의존성 `youtube-transcript-api`를 `uv run --with`로 임시 실행.
- `stock-investment/data/publish` — 블로그 발행 준비 초안과 메타데이터를 워크스페이스 내부에 보관한다. 외부 `fos-study` 반영은 이 프로필에서 직접 수행하지 않는다.

상세는 `docs/code-architecture.md` 외부 의존성 섹션.

## 7. 운영 원칙

- 실시간 거래 / 실 자동화 금지 — 모니터링·브리핑 자동화 한정.
- 광범위 풀-리포 분석 금지 — config json 명시 큐 한정.
- 재무 자문 아님 — 불확실성 명시.
- 수집 데이터·해석 분리 — config / data / docs 책임 분리.
- 모닝 요약은 오늘의 결론, 근거, 주요 위험, 확인할 다음 이벤트를 우선한다.
  상세 자산은 `data/YYYY-MM-DD/`에 둔다.
- 영구 자산은 워크스페이스 내부에 둔다.

## 8. 보안 경계

이 프로필의 기본 쓰기 범위는 `stock-investment/` 워크스페이스 내부로 제한한다.

- 허용: `stock-investment/AGENTS.md`, `docs/`, `config/`, `scripts/`, `.claude/skills/`, `.codex/skills/`, `data/`, `logs/`, `tasks/`.
- 금지: `../career-os`, `../apartment`, `../travel`, `../health-care`, `../ji-yoon-blog`, `career-os/sources/fos-study`, 다른 git 저장소, Hermes 다른 프로필 디렉터리 직접 수정.
- 예외: 사용자가 해당 턴에서 파일 경로와 목적을 명시하고 승인한 경우에만 단발성으로 수행한다.
  예외 작업 전에는 대상 파일, 변경 이유, 공개/비밀 영향, 되돌릴 방법을 먼저 보고한다.
- 비밀값은 Hermes secrets 또는 워크스페이스 `.env`에만 둔다.
  토큰·쿠키·세션·비밀번호 값은 채팅, 문서, 로그, git diff에 쓰지 않는다.
- 파일 도구가 보호 파일 수정을 거부하면 terminal/Python/shell로 우회하지 않는다.
- 다른 워크스페이스의 현재 상태 확인이 꼭 필요하면 읽기 범위와 이유를 먼저 밝히고, 쓰기는 하지 않는다.

## 9. 규칙

- 재실행 가능 + 날짜 단위 멱등.
- 불확실성 명시 — 검증된 사실과 해석 분리.
- 새 결정은 `docs/adr.md` 누적 (개별 ADR 파일 신설 금지, ai-nodes ADR-018).
- 비밀 정보는 실행 환경의 secret 저장소 또는 `.env`에 둔다. `.env.example` template을 참고한다.

## 10. fos-brain 연동

이 워크스페이스 agents의 brain 읽기/쓰기 규약.
단일 정책은 ai-nodes 루트 `AGENTS.md` 13번 + ADR-009(구조) / ADR-010(쓰기 안전·프라이버시).

- 접근: thin caller — brain-search(읽기) / brain-add(쓰기). brain 로직 재구현 금지.
- cron 무인 실행: brain-search 읽기만. brain-add 적재는 discord 대화 세션에서 사람 검토 후.
- 산출물 네임스페이스 라우팅:
  - 투자·재무·포트폴리오 데이터 → private.
