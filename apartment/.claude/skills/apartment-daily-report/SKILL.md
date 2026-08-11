---
name: apartment-daily-report
description: 아파트 매물 일일 시세 리포트를 생성하는 apartment 워크스페이스 skill. "일일 리포트 실행해줘", "오늘 아파트 시세 확인해줘", "매물 현황 수집해줘", "아파트 보고서 돌려줘", `/apartment-daily-report`, cron 08:00 Asia/Seoul처럼 타깃 단지의 네이버부동산·호갱노노·KB랜드 수집, 정규화, report.md 합성이 필요할 때 사용. 가격·수량을 발명하지 않고 검증된 사실과 추론을 구분한다.
---

# Apartment Daily Report

수집 → 정규화 → 합성 3단계 자동화 파이프라인.
소스별 데이터 품질이 부분적이므로 결과는 신중한 참고 자료로 취급한다 — 완벽한 시장 정보 피드가 아니다.

## 호출 후 입력 해석

- 날짜 인자가 없으면 오늘 날짜(`YYYY-MM-DD`)를 사용한다.
- 타깃 단지는 `apartment/config/` 또는 `.env`에서 읽는다.
- cron 진입이면 마지막 출력에 생성 결과, 핵심 시장 신호, 수집 제한을 남긴다.

## 범위

타깃 단지:

- 단지명: 엘지원앙아파트 (LG원앙)
- 위치: 경기 구리시 수택동 854-2 / 체육관로 54
- 산출물 루트: `apartment/data/YYYY-MM-DD/`

타깃 변경 시 `apartment/config/` 또는 `.env`에서 읽는다 — 이 SKILL.md에 단지명을 hard-code하지 않는다.

## 워크플로

현재 에이전트가 직접 수행하는 5단계 파이프라인.
산출물 경로: `data/YYYY-MM-DD/{raw-search.json, summary.json, report.md}`.
작업 디렉터리는 `apartment/`다.

### 1단계: 타깃 메타 로드

```bash
bun scripts/_lib/load_target_meta.ts config/focus-unit.json
```

단지 메타(단지 ID, 포커스 유닛, 복합 위치)를 확보한다.
부재 시 FAIL — 타깃 메타 없이는 수집을 시작하지 않는다 (ADR-002).

### 2단계: 수집

```bash
bun scripts/apartment-daily-report/collect_sources.ts <raw-search.json 경로>
```

네이버부동산 API 3 endpoint (쿠키+Bearer, ADR-001) + 호갱노노 + KB랜드를 수집해 `raw-search.json`을 생성한다.

네이버 정적 수집 결과가 `status: not_found` 또는 `error`이면 `references/naver-browser-prompt.md` 지침으로 agent-browser fallback을 실행한다.

### 3단계: 정규화

```bash
bun scripts/apartment-daily-report/normalize_results.ts <raw-search.json 경로> <summary.json 경로>
```

소스별 원시 데이터를 정규화 구조체 `summary.json`으로 변환한다.

### 4단계: 합성 — report.md 직접 Write

`summary.json`을 읽은 뒤 현재 에이전트가 `data/YYYY-MM-DD/report.md`를 **직접 작성**한다.
외부 subprocess로 자신을 재호출하지 않는다 (ADR-010 폐기 패턴).

리포트는 다음 7개 섹션을 포함한 스캔 가능한 마크다운으로 작성한다:

1. **단지 개요**
2. **면적별 최근 실거래 요약**
3. **현재 매물 호가 요약**
4. **입지·상승 잠재력 메모**
5. **서울역 출퇴근 관점 메모**
6. **소스 비교 요약** (네이버부동산 / 호갱노노 / KB랜드)
7. **참고 및 불확실성**

작성 규칙:

- 없는 값은 발명하지 않는다.
- 정보가 불완전하면 그 사실을 명시한다.
- 각 섹션은 확인된 사실, 해석, 불확실성을 구분해 실용적으로 쓴다.
- 채팅 호환성을 위해 마크다운 표 대신 불릿 리스트를 사용한다.
- 도움이 되는 경우 소스 URL을 언급한다.
- "입지·상승 잠재력 메모"에서는 입력에 있는 검증된 사실(역 접근성, 주변 상업지구, 최근 가격 동향, 매물 압박 등)만 근거로 삼은 신중한 정성 판단을 제시한다.
  근거가 약하면 판단이 제한적임을 명시한다.
- "서울역 출퇴근 관점 메모"에서는 실질적인 통근 불편함을 우선 기술한다.
  예상 철도 축·환승 부담·서울역 통근 유불리를 설명한다.
  정확한 이동 시간이 검증되지 않았으면 숫자를 쓰지 않고 방향성만 서술한다.
- 검증된 사실과 해석을 분리한다. 추론이면 추론임을 명시한다.

`claude.result.json` / `report.fallback.md`는 생성하지 않는다 (ADR-010 폐기).

### 5단계: 외부 전달

리포트 경로와 공개 가능한 짧은 요약을 표준 출력으로 반환한다.
외부 전달은 저장소 밖 호출자가 처리한다.

## 경계

**해야 할 것:**

- 소스 수집 실패 시 실패 사실을 명시적으로 기록한다
- 검증된 사실과 추론을 항상 구분한다
- 동일 날짜 재실행이 같은 결과를 내도록 멱등 유지

**하지 말아야 할 것:**

- 가격·수량이 없으면 발명하지 않는다 — 소스 실패 시 raw 보존
- 불확실성 섹션을 생략하지 않는다
- 저장소 밖 스케줄러와 전달 설정을 직접 수정하지 않는다
- 타깃 단지명을 이 SKILL.md 또는 스크립트에 hard-code하지 않는다

## 파일 및 의존성

| 항목 | 경로 | 용도 |
|---|---|---|
| 메인 러너 | `scripts/apartment-daily-report/run_with_claude.sh` | thin wrapper — native skill 호출과 결과 반환 |
| 스모크 테스트 | `scripts/apartment-daily-report/run_smoke_test.sh` | 빠른 동작 확인 |
| 타깃 메타 로더 | `scripts/_lib/load_target_meta.ts` | focus-unit.json → 단지 메타 (ADR-002) |
| 수집기 | `scripts/apartment-daily-report/collect_sources.ts` | 소스별 원시 데이터 → raw-search.json |
| 정규화기 | `scripts/apartment-daily-report/normalize_results.ts` | 원시 데이터 → summary.json |
| Naver browser 프롬프트 | `references/naver-browser-prompt.md` | browser fallback 수집 지침 |

## 아키텍처

정식 구현체는 `apartment/`에 둔다.
저장소 밖 스케줄러와 전달 채널은 이 skill의 실행 계약이 아니다.
