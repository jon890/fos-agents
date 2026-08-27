# apartment

`apartment/`는 아파트 시세 조사와 인테리어 리모델링 의사결정을 관리하는 워크스페이스다.
수집 결과는 참고 자료이며, 가격·매물 수·입주 가능성은 소스에서 확인된 범위 안에서만 쓴다.

## 주요 기능

| 기능 | 설명 | 주요 산출물 |
|---|---|---|
| `apartment-daily-report` | Naver Land, Hogangnono, KB Land 데이터를 수집·정규화해 일일 리포트를 만든다. | `data/YYYY-MM-DD/{raw-search.json, summary.json, report.md}` |
| `apartment-interior-reference-digest` | 오늘의집, 블로그, 업체 포트폴리오를 조사해 인테리어 레퍼런스와 결정 질문을 정리한다. | `data/interior-reference-digest/YYYY-MM-DD/report.md` |
| 인테리어 의사결정 뷰 | 결정 원본 문서를 바탕으로 사람이 보기 쉬운 HTML을 만든다. | `data/interior-reference-digest/YYYY-MM-DD/decision-view.html` |

## 설정

실제 비밀 값은 `apartment/.env`에 둔다.
템플릿은 [`apartment/.env.example`](.env.example)을 따른다.

| 변수 | 필수 | 용도 |
|---|---|---|
| `NAVER_COOKIE` | 권장 | Naver Land API 접근용 로그인 쿠키 |
| `NAVER_BEARER` | 선택 | Bearer JWT 수동 주입 fallback |

타깃 단지와 평형 메타데이터는 [`config/focus-unit.json`](config/focus-unit.json)이 단일 출처다.
Guri 광역 탐색 후보와 제외 기준은 [`config/guri-buy-complexes.json`](config/guri-buy-complexes.json)을 따른다.
인테리어 검색 설정은 [`config/interior-reference-digest.json`](config/interior-reference-digest.json)을 따른다.

## 실행

`/apartment-daily-report` 또는 `/apartment-interior-reference-digest` 스킬을 호출한다.
수집기와 정규화기만 확인할 때는 아래 smoke test를 사용한다.

```bash
bash apartment/scripts/apartment-daily-report/run_smoke_test.sh
```

## 검증

일일 리포트 수집 계층을 바꿨다면 먼저 smoke test를 실행한다.

```bash
bash apartment/scripts/apartment-daily-report/run_smoke_test.sh
```

TypeScript 파일을 바꿨다면 루트에서 `bunx tsc --noEmit`을 실행한다.
문서만 바꿨다면 `rg`와 `find`로 문서에 적은 경로가 실제로 존재하는지 확인한다.

## 문서

| 문서 | 책임 |
|---|---|
| [`docs/prd.md`](docs/prd.md) | 제품 범위와 성공 기준 |
| [`docs/flow.md`](docs/flow.md) | 실행 흐름 |
| [`docs/data-schema.md`](docs/data-schema.md) | config와 산출물 스키마 |
| [`docs/code-architecture.md`](docs/code-architecture.md) | 디렉터리와 코드 책임 |
| [`docs/interior/`](docs/interior/) | 인테리어 결정 원본 |
| [`docs/adr/INDEX.md`](docs/adr/INDEX.md) | apartment 한정 기술 결정 |
