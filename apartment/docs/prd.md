# PRD — apartment

apartment 워크스페이스의 **제품 범위·MVP 기능 명세**. 현재 active 워크플로의 단일 출처. 새 기능을 추가하거나 우선순위를 정할 때 이 문서가 기준.

런타임 상태(어느 명령이 최근에 잘 도는지, 무엇이 멈췄는지)는 여기에 박지 않는다 — `logs/task-runs.jsonl`이 단일 출처이고 `skills/workspace-audit`가 그때그때 보고한다.

## 1. 목적

부동산 시장 리포트 + 인테리어 레퍼런스 자동화. 단일 사용자(=본인)의 매일 재실행 가능한 로컬 워크플로로 묶는다.

## 2. 현재 MVP 타깃

| 항목 | 값 |
|---|---|
| 단지명 | 엘지원앙아파트 (LG원앙) |
| 주소 | 경기 구리시 수택동 854-2 / 체육관로 54 |
| 포커스 평형 | 59A (전용 59㎡) |
| Naver Land | https://new.land.naver.com/complexes/1649?tab=detail&rf=Y |
| Hogangnono | https://hogangnono.com/apt/5V184 |
| KB Land | https://kbland.kr/se/c/2906 |
| 인테리어 타깃 | 구리럭키아파트 5동 1004호 |

**59A alias 매칭 정책 (3단계)**:
- exact: `59A`, `59-A`, `59 A`, 전용 59㎡, pyeongs 프로필 직접 매칭
- unverified: `59형`, `전용59`, `59㎡` 키워드 매칭 (타입 불확실 명기)
- non-match: 단지 전체 평균, 다른 평형 데이터 — 59A로 표기 금지

## 3. 사용자

본인 1인. 매일 아침 시장 리포트 + 인테리어 레퍼런스.

## 4. 기능 목록

| 번호 | 명령 | 산출물 | 빈도 |
|---|---|---|---|
| 1 | `apartment-daily-report` (native skill, `scripts/apartment-daily-report/run_report.sh`) | `data/YYYY-MM-DD/{report.md, raw-search.json, summary.json, claude.result.json}` + Discord 완료 알림 | 매일 08:00 cron |
| 2 | `apartment-interior-reference-digest` (native skill, `scripts/apartment-interior-reference-digest/run_with_claude.sh`) | `data/interior-reference-digest/YYYY-MM-DD/report.md` + stdout Discord 요약 (3 결정 질문) | 매일 09:00 cron |

**native skill 등록 상태**:
- `apartment-daily-report`: 등록 (`claude -p "/apartment-daily-report"` 또는 `bash apartment/scripts/apartment-daily-report/run_report.sh`)
- `apartment-interior-reference-digest`: 등록 (`claude -p "/apartment-interior-reference-digest"` 또는 `bash apartment/scripts/apartment-interior-reference-digest/run_with_claude.sh`)

광역 매수 탐색(Guri buy-search)은 섹션 6 운영 정책 참조.

## 5. 산출물 경로 정책

| 경로 | 용도 |
|---|---|
| `data/YYYY-MM-DD/` | daily-report 산출물 (날짜별 1회 멱등) |
| `data/interior-reference-digest/YYYY-MM-DD/` | 인테리어 디제스트 산출물 |
| `data/YYYY-MM-DD-HHMM-guri-buy-search/` | Guri 광역 매수 탐색 산출물 |
| `logs/task-runs.jsonl` | 모든 run 메타데이터 (cost_usd / model / tokens) |
| `data/audit/YYYY-MM-DD.md` | 워크스페이스 감사 노트 |

ai-nodes ADR-004 docs vs data 분리 원칙 정합: `docs/`는 결정·정책, `data/`는 산출물·런타임 상태.

## 6. 운영 정책 — Guri buy-search

경기 구리시 전체를 대상으로 하는 광역 매물 탐색 워크플로.

### 6-1. 입지 우선

일상 인프라, 대중교통/버스 접근성, 상업/의료/학교 편의성, 보행 동선을 가격 정렬보다 앞에 놓는다. 경사 심한 단지 / 도보 마찰이 큰 단지는 가격·면적 매력을 감점 처리한다.

### 6-2. 후보 단지 포함

| 단지명 | 특이사항 | Naver complexNo |
|---|---|---|
| LG원앙/엘지원앙 | 전용 49/52 포함 | 1649 |
| 대림한숲 | 전용 51 포함 | — |
| 구리럭키/럭키아파트 | 직링크 `https://new.land.naver.com/complexes/24858?articleNo=<no>` | 24858 |
| 인창1단지주공 | 명시 complexNo 직접 조회 | 1659 |
| 인창2단지주공 | 명시 complexNo 직접 조회 | 1660 |
| 인창4단지주공 | 명시 complexNo 직접 조회 | 1661 |
| 인창6단지주공 | 명시 complexNo 직접 조회 | 1662 |

단지 메타데이터 단일 출처: `config/guri-buy-complexes.json`.

### 6-3. 후보 제외 정책

| 단지명 | complexNo | 제외 사유 |
|---|---|---|
| 쌍용 | 1648 | 500세대 이하 (`selectionRules.minHouseholdsForRecommendation = 501`) |
| 우림 | 1650 | 500세대 이하 |
| 수택주공 | 8575 | 언덕 지형 — 도보 접근 비평탄 확인 (현장 방문 2026년) |

비평탄/언덕 단지는 경미한 감점이 아닌 **제외 후보**로 처리한다.

### 6-4. 입주 가능성 필터

실거주 + 주담대 가능 매물만 우선. 다음 조건은 제외 또는 심각 감점:
- 세안고, 전세안고, 전세승계, 월세승계, 갭투자
- 임차인 거주, 갱신권 행사 중
- 2027 후반~2028 이후 입주 예정

`articlePrice.allWarrantPrice > 0` 이면 전세 끼고 매매로 필터. 입주 조건 데이터가 없으면 "입주 조건 전화 확인 대상"으로 표기 — 입주 가능 단정 금지.

선호: 주인거주, 입주가능, 즉시입주, 공실 인도 가능, 근단기 입주협의.

### 6-5. 통근 시간 가산

NHN 판교 사옥 (`경기 성남시 분당구 대왕판교로645번길 16`) 차량 통근 시간을 랭킹 인자로 포함. 라이브 교통 데이터 우선, 없으면 추정 명기 — 검증 없이 단정 금지. 다른 조건이 유사할 때 판교 통근이 현저히 불리한 단지는 감점.

### 6-6. Discord 출력 포맷

- 매물 약 30개 직접 출력 (사용자 가장 실행력 있는 포맷)
- 그룹:
  - 1~10: 우선 전화해볼 후보
  - 11~20: 괜찮은 보조 후보
  - 21~30: 조건 맞으면 확인할 후보
- 매물 라인: 단지명, 가격, 전용면적/타입, 층+방향, Naver 직링크
- 랭킹 근거: 입지 우선 + 예산 6.5억 전후 + 층/방향 + 저층/언덕 감점

### 6-7. user-facing 노출 정책

Discord/블로그 출력에 내부 수집 경로, raw report 경로, raw JSON 경로 미포함. raw Naver 검증 라벨(OWNER/DOC/NDOC/NONE)을 사용자 노출 금지 — 내부 신뢰 신호로만 사용.

### 6-8. 알림 패턴

`scripts/apartment-daily-report/notify_discord.sh` 직접 호출:
- 시작 알림
- 완료 알림 (소요 시간 포함)
- 실패 알림

별도 start-notice cron 의존 금지. ai-nodes 표준 알림 패턴.

## 7. 비기능 요구사항

- **재실행 가능성**: 같은 날 같은 명령을 여러 번 돌려도 정합성 깨지지 않음 (날짜별 멱등).
- **불확실성 명시**: 추정치는 추정 명기. 검증된 사실과 추론 구분.
- **알림**: 시작/완료/실패 Discord 3단계 (ai-nodes 표준).
- **격리**: 다른 워크스페이스(career-os, stock-investment, travel)와 자산 교차 참조 없음.
- **비밀**: `.env` (워크스페이스 root, ai-nodes ADR-004). `NAVER_COOKIE`, `NAVER_BEARER` (선택), `DISCORD_WEBHOOK_URL`. 템플릿: `.env.example`.

## 8. 의도적으로 안 하는 것

- focus-unit(59A) 위장: 단지 전체 값을 59A 확인인 것처럼 표기 금지
- 수집하지 않은 데이터를 신뢰로 표기: raw fetched data는 "미검증"으로 처리
- chat-only 요약: 산출물은 항상 파일로 기록
- 검증 안 된 입주 가능 단정: 입주 조건 미확인 매물을 입주 가능으로 표기 금지
- 매물 가격 발명: 수집 실패 시 가격 추정·대입 금지

## 9. 성공 기준

- 매일 3 source (Naver + Hogangnono + KB) 교차검증 가능
- Guri buy-search: 섹션 6 정책 충족 + 30개 매물 Discord 출력
- 인테리어 디제스트: 3 결정 질문 + 7일 중복 제거
- `logs/task-runs.jsonl` cost_usd 추적
- source 수집 실패 시 raw 결과 보존

## 10. 미연결 / 보류 항목

- **Naver 수집 후속** — NID_SES 만료 감지/알림, Bearer JWT 자동 추출 PoC, 국토부 실거래가 등 추가 source 검토 (ADR-001 후속)
- **smoke-test 확장** — `scripts/run_smoke_test.sh`를 routine health check로 성장 (현재: 수집기/정규화기 단순 헬스 체크)
- **env defaults 이전** — 환경변수 기본값을 명시 config 파일로 이전 (별도 코드 정리 백로그, `jon890/fos-claw#3`)
