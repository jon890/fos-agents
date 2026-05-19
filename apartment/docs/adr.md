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
| ADR-005 | Python collector TypeScript 마이그 인터페이스: Bun.fetch + zod + import 통합 | Accepted | 외부 HTTP fetch는 Bun runtime 기본 Bun.fetch. 응답은 zod 스키마 검증. 오케스트레이션은 import 통합 (subprocess 폐기). agent-browser CLI 호출은 Bun.spawn. plan003~006 공통 패턴 |

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

**적용**: `apartment/scripts/apartment-daily-report/collect_naver_api.py` (3 API endpoint + 인증 + 폴백), `apartment/.env` (NAVER_COOKIE, NAVER_BEARER), 진단 세션 상세(2026-04-24)는 git history.

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
  - plan006: `build_weekly_listing_trend.py` 마이그.
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

## ADR-005 — Python collector TypeScript 마이그 인터페이스: Bun.fetch + zod + import 통합

**Status**: Accepted
**Date**: 2026-05-19

### 맥락

ADR-003에서 apartment에 TypeScript 도입 결정 + Python→TS 마이그 plan003~006 시리즈 명시.
plan003 시점에 마이그 인터페이스 3가지 결정점:

1. 외부 HTTP fetch 인터페이스 — `Bun.fetch` / `axios` / `node-fetch` 중 선택.
2. collect_sources 오케스트레이션 — Python의 `subprocess.run` 패턴 유지 vs ts `import` 통합.
3. 외부 API 응답 스키마 검증 — zod 도입 vs `await res.json()` 장합 파싱.

각 결정이 plan003 첫 적용 후 plan004~006에서 반복 적용되므로 *공통 패턴 ADR*로 격상.

### 결정

1. **외부 HTTP fetch = `Bun.fetch`**. Bun runtime 기본 제공, 외부 의존성 추가 없음 (plan002 ADR-003 Bun 환경 활성화 이미). 표준 fetch API 호환.
2. **오케스트레이션 = `import` 통합**. `collect_sources.ts`가 `collect_naver_api.ts`를 `import` 호출 — idiomatic TypeScript + 타입 안전 + subprocess 오버헤드 제거. plan003 시점 plan004~006 미완료 단계에서는 Python collector를 `Bun.spawn`으로 임시 호출 (점진 마이그).
3. **응답 스키마 = zod**. plan002 `mvp_target_schema.ts` 패턴 동일. Naver API 3 endpoint (overview / prices / articles) 응답 스키마 정의. unknown 필드는 `catchall(z.unknown())` 또는 `passthrough()`로 흘려보냄.
4. **agent-browser CLI 호출 = `Bun.spawn`** (Naver Bearer JWT 자동 추출, ADR-001). 외부 binary 호출이라 fetch / import 무관.

**거절한 대안**:

- `axios` — interceptor / retry / timeout 등 logic 풍부하나 외부 의존성 추가. Bun.fetch + 명시적 retry 로직으로 충분.
- `node-fetch` — Node 18+ 내장 fetch 이전 호환성 패키지. Bun 환경에서는 Bun.fetch가 정합.
- `subprocess` 패턴 유지 (`Bun.spawn(['bun', 'run', collect_naver_api.ts])`) — Python 패턴 직역. ts 도입 의의 (타입 안전 + idiomatic) 무력화.
- zod 미적용 (raw `await res.json()`) — 응답 스키마 drift 조기 발견 불가. plan002에서 mvp-target.json 스키마 검증 패턴 정착 — 일관성 유지.

### 결과

- plan003 첫 적용 — `collect_naver_api.ts` (Bun.fetch + zod) + `collect_sources.ts` (import 통합).
- plan004~006 동일 패턴 — hogangnono / kb / normalize / weekly_trend 마이그도 Bun.fetch + zod + import.
- agent-browser CLI subprocess 호출은 그대로 유지 (Bun.spawn). 외부 binary 의존성 변경 없음.
- 응답 스키마 변경 시 zod schema가 PHASE_FAILED를 즉시 발견 — drift 조기 차단.

**적용**: plan003 phase-01 (`collect_naver_api.ts`) + phase-02 (`collect_sources.ts`).
Naver API 응답 zod 스키마는 `apartment/scripts/apartment-daily-report/naver_api_schemas.ts` (별도 파일).
