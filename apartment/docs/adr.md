# ADR — apartment

apartment 워크스페이스의 아키텍처 결정을 시간순으로 누적 기록한다. 새 결정은 가장 아래에 추가한다.

형식: `## ADR-N — 제목` + status / date 라인 + **맥락 / 결정 / 결과** 3섹션. 폐기·supersede는 status 라인에 명기.

모노레포 레벨 ADR (워크스페이스 간 공통 정책): [../../docs/adr.md](../../docs/adr.md).

---

## Quick Index

| ADR | 제목 | Status | 한 줄 요약 |
|---|---|---|---|
| ADR-001 | Naver Land 쿠키+Bearer API 통합 | Accepted | SPA 우회 포기, API 3 endpoint + 쿠키 수동갱신 + Bearer 자동추출 |
| ADR-002 | 타깃 메타 단일 출처 (focus-unit.json) | Accepted | shell 하드코딩 폐기, focus-unit.json 단일 출처, complexLocation 키 신설, 부재 시 FAIL |
| ADR-003 | apartment TypeScript 도입 + `scripts/_lib/` 위치 | Accepted | apartment 첫 ts 파일, 워크스페이스 레벨 공용 헬퍼 디렉터리 (career-os ADR-031 반대 패턴) |
| ADR-004 | skills/ 폐기 + .claude/skills/ 본체화 (career-os 패턴 포팅) | Accepted | ai-nodes ADR-006 첫 적용. apartment/scripts/<name>/ + apartment/.claude/skills/<name>/ 분리. interior-reference-digest 동시 native 등록 (plan007) |
| ADR-005 | 외부 HTTP fetch 인터페이스: Bun.fetch | Accepted | Bun runtime 기본 fetch API. 외부 의존성 추가 0. plan003~006 공통 |
| ADR-006 | Python collector 오케스트레이션: import 통합 | Accepted | collect_sources.ts가 ts collector를 import. subprocess 패턴 폐기 (단 미마이그 collector는 Bun.spawn(python3) 임시). idiomatic ts + 타입 안전 |
| ADR-007 | 외부 API 응답 스키마 검증: zod 도입 | Accepted | mvp_target_schema.ts 패턴 동일. passthrough() 적극 사용. drift 조기 차단 |
| ADR-008 | 주간 호가 트렌드 추적 폐기 (build_weekly_listing_trend) | Accepted | dead code (호출자 0) + PIL 외부 의존 동시 제거. plan006 TS 마이그 대신 자산 폐기. 가시화 필요 시 별도 plan |

---

## ADR-001 — Naver Land 쿠키+Bearer API 통합

**Status**: Accepted
**Date**: 2026-04-24

### 맥락

apartment 일일 리포트는 Naver Land 데이터를 주요 축으로 삼아 왔으나, 2026-04 기준 다음 경로는 모두 차단됐다:

- `new.land.naver.com/complexes/{id}?*` SSR 페이지: `/404` 리다이렉트
- `fin.land.naver.com/complexes/{id}`: 지도 레이어 진입 후 약 5초 뒤 `financial.pstatic.net/404.html` 강제 이탈
- SPA UI / 검색 textbox 제출 / 지도 상호작용: 모두 `/404`
- DevTools 오픈 감지 — 수동 디버깅도 제약

그러나 추가 probe로 API 채널은 조건부로 열려 있음을 확인:

| 엔드포인트 | 인증 | 결과 |
|---|---|---|
| `/api/complexes/overview/{id}` | 쿠키만 | HTTP 200 (단지 개요) |
| `/api/complexes/{id}/prices?tradeType=A1|B1&year=5&type=summary` | 쿠키 + Bearer | HTTP 200 (한국부동산원 공식 시세) |
| `/api/articles/complex/{id}?tradeType=A1|B1` | 쿠키 + Bearer | HTTP 200 (매물 호가 전체 리스트) |
| `/api/search?keyword=...` | (미확인) | HTTP 429 지속 |

인증 구조:
- 쿠키: `NID_AUT`, `NID_SES` 등 로그인 세션. 수주~수개월 유효. 브라우저 로그아웃 안 하면 유지.
- Bearer: SPA 페이지 로드 시 내부 발급하는 JWT. payload `{"id":"REALESTATE","iat":...,"exp":...}` — `exp-iat=3h`. 매 수집 실행마다 자동 재발급 가능.

### 결정

1. Naver SPA 우회(헤드리스 렌더링)는 완전히 포기한다. 단지 직링크, 검색 submit, 지도 인터랙션은 시도하지 않는다.
2. API 3개(`overview`, `prices`, `articles`)만 정식 수집 대상으로 삼는다. 나머지 엔드포인트(search, map, SSR 페이지)는 건드리지 않는다.
3. 쿠키는 사용자 수동 갱신한다. NID_SES 만료 시(실측 수주~수개월) `.env`의 `NAVER_COOKIE=...` 복사/붙여넣기.
4. Bearer JWT는 agent-browser로 자동 추출한다. 매 수집 실행마다 쿠키 주입된 agent-browser 세션에서 `new.land.naver.com/`을 로드해 SPA 발급 토큰을 가로챈다. 실패 시 `NAVER_BEARER` 환경변수로 수동 주입 fallback.
5. 호출 정책: 요청 간 2초 sleep, 429 시 지수 백오프 (2→4→8s, 3회), 실패 지속 시 마지막 성공 스냅샷 fallback + Discord 알림.

**거절한 대안**:
- Puppeteer/Playwright: `/404` 차단 + DevTools 감지로 불가
- 비공식 unofficial API 직 호출: 인증 우회 불가

### 결과

- 리포트가 공식 시세(한국부동산원) + 매물 호가 전체 + 단지 개요 3축으로 확장됨.
- 59A 타입 매칭을 `pyeongs` 프로필로 정확히 수행 가능.
- 사용자 개입 비용: NID_SES 만료 시 쿠키 수동 갱신 (복사/붙여넣기, 기술 지식 불요).
- `.env`에 `NAVER_COOKIE`가 없으면 Naver 수집 비활성화. Hogangnono + KB만으로 리포트 완성되는 폴백 경로 유지.
- 리스크: `new.land.naver.com/api/*`는 비공식 API (SLA 없음). 엔드포인트/인증 구조 변경 시 수집기 수정 필요.

**적용**: `apartment/scripts/apartment-daily-report/collect_naver_api.ts` (3 API endpoint + 인증, plan003 TS 마이그), `apartment/.env` (NAVER_COOKIE, NAVER_BEARER), 진단 세션 상세(2026-04-24)는 git history.

---

## ADR-002 — 타깃 메타는 config json 단일 출처 (focus-unit.json)

**Status**: Accepted
**Date**: 2026-05-19

### 맥락

`apartment/scripts/apartment-daily-report/run_report.sh:21-25`에 5개 env default(`TARGET_NAME`, `TARGET_ALIAS`, `TARGET_LOCATION`, `TARGET_UNIT_LABEL`, `TARGET_UNIT_EXCLUSIVE_AREA_M2`)가 shell 코드에 하드코딩됨. 동시에 `apartment/config/focus-unit.json`이 같은 정보 4 키(`complexName`, `complexAlias`, `primaryFocusUnit.label`, `primaryFocusUnit.exclusiveAreaM2`)를 중복 보유. 새 타깃 단지 추가 또는 focus unit 변경 시 두 곳을 동기화해야 하는 부담. shell default와 json이 어긋날 때 어느 쪽이 정답인지도 모호.

### 결정

1. 타깃 메타 단일 출처는 `apartment/config/focus-unit.json`. shell 하드코딩 default 폐기.
2. `complexLocation` 키 신설 — 기존 4 키 + 1. 위치는 `primaryFocusUnit` 다음, `notes` 직전.
3. focus-unit.json 부재 또는 필수 키 누락 시 FAIL (exit 1) + Discord 실패 알림. 단일 출처 원칙상 하드코딩 fallback 미수용.
4. env override 우선순위 유지. `TARGET_NAME=... bash run_report.sh` 임시 단지 테스트 가능 — json은 *default* 출처, 운영 override는 별개 차원.

**거절한 대안**:
- 양쪽 동기화 자동화 — 두 출처 유지 부담이 계속 누적, 일회성 해결 아님.
- shell 하드코딩 유지 + json 폐기 — 새 단지 추가 시 shell 수정 필요, 운영 비용 큼.
- focus-unit.json은 metadata only + shell이 source — config 본분(설정 단일 출처) 역전.

### 결과

- 새 타깃 단지 추가 시 focus-unit.json만 수정. shell 미수정.
- focus-unit.json이 apartment 타깃 메타 단일 진실원으로 정착.
- 임시 단지 테스트는 env override로 그대로 가능 — 단일 출처와 운영 유연성 양립.

**적용**: `apartment/config/focus-unit.json` (complexLocation 키 추가), `apartment/scripts/apartment-daily-report/run_report.sh:21-25` (env default 폐기 + json read). JSON 읽기 헬퍼 구현 언어 결정은 ADR-003.

---

## ADR-003 — apartment TypeScript 도입 + `scripts/_lib/` 위치

**Status**: Accepted
**Date**: 2026-05-19

### 맥락

apartment 현재 언어 분포: Shell 5 + Python 6 + TypeScript 0. ai-nodes 차원 Bun runtime + `_shared/lib/notify_discord.ts` 등 ts 인프라 존재하지만 apartment 미도입.

ADR-002에서 focus-unit.json 읽기 헬퍼 도입 시점에 언어 선택 결정점 — 본 결정은 단일 헬퍼를 넘어 apartment 워크스페이스의 **언어 표준 변경** 시작점. 사용자는 python 가독성 제약 표명, ts 선호 명시. career-os는 ADR-020에서 TypeScript 표준 격상한 선례.

### 결정

1. apartment에 TypeScript 도입 시작. 첫 ts 파일은 ADR-002 적용 헬퍼 (`load_target_meta.ts`).
2. ts 헬퍼 위치는 `apartment/scripts/_lib/` — **워크스페이스 레벨 공용** 디렉터리. 다중 skill·collector가 공유 가능하도록.
3. career-os가 plan023(ADR-031)에서 폐기한 `_lib/` 패턴과 반대 — apartment 도메인은 단일 skill 다중 collect 구조라 워크스페이스 레벨 공용이 정합. 워크스페이스 격리 원칙(ai-nodes ADR-001)상 의도적 비대칭.
4. Bun runtime 의존성 활성화 (이미 ai-nodes root 차원 설치, `@types/bun` 보유).

**거절한 대안**:
- python3 인라인 heredoc — 사용자 가독성 제약. 또한 apartment ts 도입 시점을 계속 미루는 셈.
- jq — 시스템 의존성 추가 비용 > 효익 (Bun 이미 있음).
- skill 디렉터리 안 ts (`apartment/scripts/apartment-daily-report/`) — apartment 다중 collect가 공유 가능성 있어 워크스페이스 레벨이 더 정합.

### 결과

- apartment 두 번째 언어 (TS). Python·Shell과 공존, 점진 마이그.
- 후속 ts 마이그 plan 시리즈 (계획, 각각 별도 plan + ADR):
  - plan003: `collect_sources.py` + `collect_naver_api.py` 마이그.
  - plan004: `collect_hogangnono.py` + `collect_kb.py` 마이그.
  - plan005: `normalize_results.py` 마이그.
  - ~~plan006: `build_weekly_listing_trend.py` 마이그~~ — ADR-008로 폐기 (dead code + PIL 의존 제거).
- 각 후속 plan은 외부 fetch 인터페이스(fetch / Bun.fetch / axios) 결정 등 새 ADR 필요.

**적용**: `apartment/scripts/_lib/` (신설 디렉터리), `apartment/scripts/_lib/load_target_meta.ts` (첫 ts 파일).

---

## ADR-004 — skills/ 폐기 + .claude/skills/ 본체화 (career-os 패턴 포팅)

**Status**: Accepted
**Date**: 2026-05-19

### 맥락

plan001/002 마이그 후 apartment 구조는 ai-nodes ADR-004 통합 표준 (`skills/<name>/{SKILL.md, references/, scripts/}`).
career-os ADR-019는 의도된 비대칭 (분리 패턴).
두 패턴 공존 → 새 워크스페이스 추가 시 청사진 모호.
또한 apartment-interior-reference-digest는 `.claude/skills/` 미등록 (native 호출 불가).

### 결정

apartment도 career-os 분리 패턴 포팅:

- `apartment/skills/<name>/` 폐기.
- `apartment/scripts/<name>/` — 실행 파일 (runner / collectors / normalizer / TS 헬퍼).
- `apartment/.claude/skills/<name>/{SKILL.md, references/}` — 컨텍스트 자산 본체.
- apartment-interior-reference-digest 동시 native 등록 (두 skill 모두 `claude -p "/<name>"` 호출).
- runner SKILL_ROOT 정정 — 자기 위치 기준 `WS_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"`.

거절한 대안:

- `.claude/skills/<name>/` 단일 통합 (scripts 포함) — apartment 한정 새 비대칭, 또 다른 세 번째 패턴.
- 통합 표준 유지 — 사용자 의도 (skills/ 폐기) 반대.

### 결과

- ai-nodes ADR-006의 첫 적용 사례 (분리가 표준).
- apartment + career-os 같은 분리 패턴 수렴.
- workspace-structure.md 청사진 + 매트릭스 + 의도된 비대칭 표 갱신.
- 영향 파일: `apartment/skills/` 전수 이동 + 5문서 + AGENTS 본문 path 갱신.

**적용**: plan007 (skills-folder-retirement). `apartment/scripts/<name>/` + `apartment/.claude/skills/<name>/`.

---

## ADR-005 — 외부 HTTP fetch 인터페이스: Bun.fetch

**Status**: Accepted
**Date**: 2026-05-19

### 맥락

ADR-003 (apartment TypeScript 도입) 후 plan003 시점에 Python collector → TS 마이그 시작. Python `requests` 라이브러리를 대체할 외부 HTTP fetch 인터페이스 선택 필요.

### 결정

외부 HTTP fetch = `Bun.fetch`. Bun runtime 기본 제공 표준 fetch API.

**거절한 대안**:

- `axios` — interceptor / retry / timeout 등 logic 풍부하나 외부 의존성 추가. Bun.fetch + 명시적 retry 로직으로 충분.
- `node-fetch` — Node 18+ 내장 fetch 이전 호환성 패키지. Bun 환경에서 Bun.fetch가 정합.

### 결과

- 외부 의존성 추가 0 — plan002 ADR-003 Bun 환경 활성화 이미.
- 표준 fetch API 호환 — `await res.json()`, `Response.text()` 등 표준 인터페이스.
- 명시적 retry 로직 직접 작성 (ADR-001 호출 정책 — 2초 sleep + 2/4/8 백오프).

**적용**: plan003~006 collector 마이그 공통. `apartment/scripts/apartment-daily-report/collect_*.ts` 본문.

---

## ADR-006 — Python collector 오케스트레이션: import 통합 (subprocess 폐기)

**Status**: Accepted
**Date**: 2026-05-19

### 맥락

`collect_sources.py`가 Naver / Hogangnono / KB 3 source를 `subprocess.run(['python3', script, url])`로 호출하는 오케스트레이터. plan003 이후 collector가 점진 TS 마이그 — 오케스트레이션 패턴 결정 필요.

### 결정

오케스트레이션 = `import` 통합. `collect_sources.ts`가 ts collector를 `import { runX } from './collect_x'`로 직접 호출. subprocess 오버헤드 제거.

미마이그 collector (plan003 시점 hogangnono / kb는 Python) 는 `Bun.spawn(['python3', ...])`으로 임시 호출. plan004 마이그 완료 시 모두 import 통합.

**거절한 대안**:

- subprocess 패턴 유지 (`Bun.spawn(['bun', 'run', collect_naver_api.ts])`) — Python 패턴 직역. ts 도입 의의 (타입 안전 + idiomatic) 무력화.

### 결과

- idiomatic TypeScript — 모듈 import 표준 패턴.
- 타입 안전 — collector 반환 타입 (`SourceResult`) 컴파일 시 검증.
- subprocess fork 오버헤드 제거.
- plan004까지 hogangnono / kb는 Bun.spawn(python3) 하이브리드 — 점진 마이그.

**적용**: plan003 phase-02 `collect_sources.ts`. plan004 hogangnono / kb 마이그 후 모두 import.

---

## ADR-007 — 외부 API 응답 스키마 검증: zod 도입

**Status**: Accepted
**Date**: 2026-05-19

### 맥락

apartment collector가 외부 API (Naver / Hogangnono / KB) 응답을 JSON parse + 후속 처리. 응답 schema는 *비공식 API* (ADR-001) — drift 위험.

### 결정

응답 스키마 검증 = zod. plan002 `mvp_target_schema.ts` 패턴 동일 — 워크스페이스 zod 사용 정착.

미상 필드는 `passthrough()` 또는 `catchall(z.unknown())` 적극 사용 — 응답 schema 변경에 robust.

**거절한 대안**:

- raw `await res.json()` 직역 파싱 — schema drift 조기 발견 불가.

### 결과

- 응답 schema 변경 시 zod parse 시 *PHASE_FAILED* 즉시 발견.
- 타입 안전 — `z.infer<typeof Schema>` 로 ts 타입 자동 생성.
- plan002 mvp_target_schema 패턴 일관성 유지.
- 외부 의존성 추가 0 (zod는 plan002 ADR-003 root package.json 의존성 이미).

**적용**: plan003 phase-01 `naver_api_schemas.ts` (Naver 3 endpoint 스키마). plan004~005 hogangnono / kb / normalize 스키마 후속 (각 collector inline zod).

---

## ADR-008 — 주간 호가 트렌드 추적 폐기 (build_weekly_listing_trend)

**Status**: Accepted (supersedes ADR-003 본문의 plan006 마이그 계획)
**Date**: 2026-05-19

### 맥락

`apartment/scripts/apartment-daily-report/build_weekly_listing_trend.py` (403줄)은 Naver 호가 7일/30일 트렌드 JSON + Markdown + PNG 차트 생성. ADR-003 본문에 plan006 마이그 대상으로 명시.

plan006 검토 중 발견:

- 호출자 0 — `run_report.sh` / `run_smoke_test.sh` / `run_guri_buy_search.sh` / `apartment-interior-reference-digest` / config / cron 어디서도 호출되지 않음. 수동 호출 또는 과거 사용 잔존.
- PIL (Pillow) 외부 pip 의존 — ai-nodes 모노레포 `CLAUDE.md` "apartment Python — 기본 stdlib만 사용 (외부 pip 의존 없음)" 진술과 충돌.
- TS 마이그 시 image library 결정점 — `@napi-rs/canvas` 등 신규 의존성 추가 필요.

dead code + 의존성 충돌 + TS 마이그 비용 = 효익 부재.

### 결정

자산 자체 폐기. `build_weekly_listing_trend.py` git rm. PIL 의존성 동시 제거. ADR-003 본문의 plan006 마이그 계획 supersede.

**거절한 대안**:

- MD only TS 마이그 — 호출자 0 상태에서 신설 비용 효익 없음. 차트 가시화 필요성 명확하지 않음.
- 자동화 wire-up + TS 마이그 — 사용자 의도 부재. 가시화 자동 통합 결정 우선 필요.
- `@napi-rs/canvas` 도입 + 완전 TS 마이그 — 외부 의존성 추가 비용 > 효익.

### 결과

- apartment Python collector 0 (`extract_claude_result.py`만 잔존 — `_shared/bin/`에 위치한 ai-nodes 공용 헬퍼라 별도 정책).
- PIL 외부 의존 제거 → ai-nodes `CLAUDE.md` "stdlib only" 진술 정합화.
- 가시화 필요 시 별도 plan에서 재도입 — 사용자 호출 의도 확립 + 자동화 wire-up 결정 동시에 검토.

**적용**: `apartment/scripts/apartment-daily-report/build_weekly_listing_trend.py` git rm (plan006). `apartment/docs/code-architecture.md` 언어 통계 갱신.

---

## ADR-009 — Discord 알림을 `_shared/lib/notify_discord.ts`로 통합 (셸 notifier 폐기)

**Status**: Accepted
**Date**: 2026-05-23

### 맥락

apartment는 `scripts/apartment-daily-report/notify_discord.sh` (message) + `notify_discord_media.sh` (media) 두 셸 스크립트로 Discord 알림. 둘 다 `openclaw message send`를 직접 래핑 — ai-nodes 공용 `_shared/lib/notify_discord.ts` (ADR-021, openclaw subprocess + `--media` + 10s 타임아웃)와 기능 중복.

발견:

- `notify_discord.ts`가 message + media를 모두 커버 — 셸 두 변종이 정본의 부분집합.
- `notify_discord_media.sh`는 **호출자 0** — 어느 runner·cron도 부르지 않는 dead code.
- `notify_discord.sh`는 `run_report.sh`의 `notify_safe` 래퍼에서만 사용.
- 셸은 채널 ID 하드코딩 fallback(`1496746450468733038`) 보유 / ts는 `DISCORD_CHANNEL_ID` env 필수. apartment `.env`에 동일 값이 이미 존재하고 `run_report.sh`가 `set -a`로 export → 마이그레이션 안전.
- 셸은 타임아웃 없음 / ts는 10s 타임아웃 — openclaw 매달림 방어 우위.
- 같은 셸 패턴이 stock-investment에도 중복 존재 — 모노레포 전반 drift 신호 (단 워크스페이스 격리 원칙상 별건).

### 결정

apartment Discord 알림을 `_shared/lib/notify_discord.ts` 단일 정본으로 통합.

1. `run_report.sh`의 `NOTIFIER`를 `$HOME/ai-nodes/_shared/lib/notify_discord.ts`로 교체, `notify_safe`가 `bun run`으로 호출 (`extract_claude_result.ts` 호출 패턴과 동일).
2. `notify_discord.sh` + `notify_discord_media.sh` git rm.
3. flow / code-architecture / prd 문서 동기화 — flow 4번에 webhook+curl로 잘못 기록돼 있던 알림 흐름도 실제 openclaw 방식으로 정정.

**거절한 대안**:

- 셸 유지 — 정본과 기능 중복 + 타임아웃 부재 + drift 지속.
- apartment + stock-investment 동시 통합 — 워크스페이스 격리 원칙(ai-nodes ADR-001)상 별건. stock 통합은 별도 결정으로 분리.
- media 변종만 삭제(부분 정리) — 중복의 근본 원인(정본 미사용)을 남김.

### 결과

- apartment Discord 알림이 ai-nodes 공용 정본 단일 출처로 정착. Shell 5 → 3.
- `_shared/lib/notify_discord.ts` 상태 미사용 → 사용 중 (ADR-003 본문의 "apartment 미도입" 상태 supersede).
- 타임아웃 보강으로 알림 단계 견고성 상승.

**적용**: `apartment/scripts/apartment-daily-report/run_report.sh` (NOTIFIER + notify_safe), `notify_discord.sh` / `notify_discord_media.sh` git rm, `apartment/docs/{flow,code-architecture,prd}.md` 동기화.

---

## ADR-010 — `run_digest.sh` scaffold 폐기 (native skill 정본 단일화)

**Status**: Accepted
**Date**: 2026-05-23

### 맥락

apartment-interior-reference-digest는 두 가지 진입점이 공존:

- `run_with_claude.sh` — `claude -p "/apartment-interior-reference-digest"`로 native skill을 exec하는 운영 진입점.
- `run_digest.sh` — `request.md` + `report.md` placeholder를 생성하는 thin shell scaffold (53줄). native skill 이전 시대 (`plan009` 이전)의 프롬프트 화석.

운영 cron(`apartment:today-interior-recommendations`, 매일 09:00 KST, enabled) payload를 `~/.openclaw/cron/jobs.json`에서 확인:

- cron payload는 `run_with_claude.sh`만 호출 — `run_digest.sh` 언급 0.
- `run_with_claude.sh`는 `exec claude -p "/apartment-interior-reference-digest"` — `run_digest.sh` 호출 안 함.
- SKILL.md / references / 시스템 crontab — `run_digest.sh` 단계 지시 없음.
- repo 내 모든 참조는 docs(scaffold 서술) + tasks/ history뿐.

즉 `run_digest.sh`는 **운영 경로가 완전히 우회하는 orphan scaffold**. 게다가 `run_digest.sh` 내부 heredoc(`request.md` 9개 행동 규칙)의 노하우는 plan009에서 native skill을 만들 때 이미 SKILL.md로 흡수·확장된 상태 — SKILL.md가 오히려 상위집합(field-checklist·contractor-brief·decision-summary 동기화, 법적/구조적 주제 전문가 확인, 같은 날 재실행 강제 생성 룰, `<https://...>` 링크 감싸기, 마크다운 테이블 금지 등 추가). dead scaffold를 두 번째 정본처럼 두면 SKILL.md와 drift 위험.

### 결정

`run_digest.sh` scaffold 폐기. native skill SKILL.md를 인테리어 워크플로 단일 정본으로 확정.

1. `apartment/scripts/apartment-interior-reference-digest/run_digest.sh` git rm.
2. `apartment/docs/flow.md` 3-2 (request scaffold 흐름) 섹션 + 6번 직접 호출 진입점에서 `run_digest.sh` 줄 제거. 3번 도입부 scaffold 서술 → native skill 직접 호출 서술로 정리.
3. `apartment/docs/code-architecture.md` 트리에서 `run_digest.sh` 줄 → `run_with_claude.sh` 줄로 교체 (운영 진입점 명시).
4. `ai-nodes/AGENTS.md` (root) 인테리어 진입점 서술에서 scaffold 언급 제거.

**거절한 대안**:

- run_digest.sh 유지 — 운영 경로 우회 + SKILL.md와 잠재 drift + 노하우 이미 SKILL.md superset에 흡수됨.
- 삭제 전 SKILL.md 보강 — 노하우 대조 결과 9개 행동 규칙 전부 SKILL.md에 이미 있음. 추가 보강 불필요.
- scaffold만 유지하고 docs 정리 — 정합성 일부만 해소. dead code 정리의 효익 절반.

### 결과

- apartment-interior-reference-digest workflow 정본이 SKILL.md 단일 출처로 정착 (ADR-006 분리 표준 정합화).
- apartment Shell 3 → 2 (notify ADR-009 + run_digest ADR-010 누적 효과).
- 옛 plan009 이전 시대 흔적 정리 완료.

**적용**: `apartment/scripts/apartment-interior-reference-digest/run_digest.sh` git rm, `apartment/docs/{flow,code-architecture}.md` + `ai-nodes/AGENTS.md` 동기화.
