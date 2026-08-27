---
name: apartment-daily-report
description: apartment 설정에 등록된 단지와 면적의 실거래, 매물과 소스 상태를 수집해 일일 시세 리포트를 만든다. 오늘 아파트 시세, 매물 현황, 일일 부동산 리포트 요청에 사용한다. 수집되지 않은 가격과 수량은 만들지 않는다.
---

# 아파트 일일 시세 리포트

## 입력과 단일 출처

- 타깃 단지와 면적: `apartment/config/focus-unit.json`
- 선택 인증 값: `apartment/.env`
- 수집·산출물 구조: `apartment/docs/data-schema.md`, `apartment/docs/flow.md`
- 실행 날짜: 사용자가 지정하지 않으면 한국 시각의 오늘

단지명, 주소와 식별자를 스킬이나 스크립트에 복제하지 않는다.

## 실행

1. 타깃 설정을 검증한다.

```bash
bun apartment/scripts/_lib/load_target_meta.ts apartment/config/focus-unit.json
```

2. 실행 날짜의 `raw-search.json`을 만든다.

```bash
bun apartment/scripts/apartment-daily-report/collect_sources.ts <raw-search.json>
```

3. 정적 수집이 인증 실패나 접근 제한으로 끝난 소스만 `references/naver-browser-prompt.md`의 조건에 따라 브라우저로 보완한다. 정상 수집된 값을 브라우저 추정으로 덮어쓰지 않는다.
4. 공통 구조로 정규화한다.

```bash
bun apartment/scripts/apartment-daily-report/normalize_results.ts <raw-search.json> <summary.json>
```

5. `summary.json`에서 `report.md`를 작성하고 산출물 경로와 짧은 요약을 반환한다.

## 리포트 계약

리포트에는 타깃과 기준 시각, 면적별 실거래, 현재 매물, 입지와 상승·하락 요인, 불확실성, 소스 상태와 다음 확인 대상을 담는다.

- 타깃 면적으로 확인되지 않은 단지 평균이나 다른 면적을 타깃 값처럼 쓰지 않는다.
- 매매가와 전세가, 호가와 실거래가를 구분한다.
- 확인된 사실, 계산한 값과 해석을 구분한다.
- 소스가 비었거나 실패하면 0이나 추정값으로 채우지 않고 실패 상태와 영향을 적는다.
- 같은 날짜에 다시 실행하면 같은 원본과 설정에서 재현 가능한 산출물을 만든다.

## 검증과 경계

- 수집 계층 변경: `bash apartment/scripts/apartment-daily-report/run_smoke_test.sh`
- TypeScript 변경: `bunx tsc --noEmit`
- 리포트 변경: `raw-search.json`, `summary.json`과 보이는 수치 대조
- 외부 게시 요청: 공개 범위를 검사한 뒤 `report-publisher` 사용

입주 가능성, 전세 승계, 법적 상태와 투자 결과를 근거 없이 단정하지 않는다. 외부 스케줄러, 전달 채널, 매물 문의와 계약은 이 스킬이 변경하지 않는다.

## 참고 자료

- `references/naver-browser-prompt.md`
