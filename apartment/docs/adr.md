# ADR — apartment

apartment 워크스페이스의 아키텍처 결정을 시간순으로 누적 기록한다. 새 결정은 가장 아래에 추가한다.

형식: `## ADR-N — 제목` + status / date 라인 + **맥락 / 결정 / 결과** 3섹션. 폐기·supersede는 status 라인에 명기.

모노레포 레벨 ADR (워크스페이스 간 공통 정책): [../../docs/adr.md](../../docs/adr.md).

---

## Quick Index

| ADR | 제목 | Status | 한 줄 요약 |
|---|---|---|---|
| ADR-001 | Naver Land 쿠키+Bearer API 통합 | Accepted | SPA 우회 포기, API 3 endpoint + 쿠키 수동갱신 + Bearer 자동추출 |

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

**적용**: `apartment/skills/apartment-daily-report/scripts/collect_naver_api.py` (3 API endpoint + 인증 + 폴백), `apartment/.env` (NAVER_COOKIE, NAVER_BEARER), 진단 세션 상세(2026-04-24)는 git history.
