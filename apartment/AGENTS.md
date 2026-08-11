# AGENTS.md — apartment 워크스페이스

`apartment/`는 아파트 시세 조사와 인테리어 의사결정 리포트를 다루는 독립 워크스페이스다.
상세 구조와 흐름은 `docs/` 책임 문서를 따른다.

## 문서 라우팅

| 문서 | 책임 |
|---|---|
| [`README.md`](README.md) | 처음 사용하는 사람을 위한 범위, 설정, 검증 |
| [`docs/prd.md`](docs/prd.md) | 제품 범위, 기능, 성공 기준 |
| [`docs/data-schema.md`](docs/data-schema.md) | config, data, 산출물 스키마 |
| [`docs/flow.md`](docs/flow.md) | 실행 흐름과 산출물 생성 순서 |
| [`docs/code-architecture.md`](docs/code-architecture.md) | 현재 디렉터리와 코드 책임 |
| [`docs/adr/INDEX.md`](docs/adr/INDEX.md) | apartment 한정 기술 결정 |

모노레포 공통 결정은 [`../docs/adr/INDEX.md`](../docs/adr/INDEX.md)를 따른다.

## 작업 경계

- 다른 워크스페이스의 데이터와 helper를 직접 참조하지 않는다.
- 비밀 값은 `apartment/.env`에 둔다.
- `config/`에는 사람이 관리하는 설정과 공개 가능한 메타데이터만 둔다.
- 실행 산출물과 수집 원본은 `data/`에 둔다.
- 인테리어 결정 원본은 `docs/interior/*.md`에 둔다.
- 인테리어 표시용 HTML은 `data/interior-reference-digest/YYYY-MM-DD/`에 생성한다.

## 진입점

```bash
bash apartment/scripts/apartment-daily-report/run_with_claude.sh
bash apartment/scripts/apartment-interior-reference-digest/run_with_claude.sh "오늘의 인테리어 추천"
bash apartment/scripts/apartment-daily-report/run_smoke_test.sh
```

agent skill로 위임할 때는 아래 의도 표현을 사용한다.
실행 환경이 실제 CLI 호출 방식을 결정한다.

- `/apartment-daily-report`
- `/apartment-interior-reference-digest`

## 운영 원칙

- 실제 수집 결과가 없는 가격과 매물 수를 만들지 않는다.
- 59A로 확인되지 않은 단지 전체 평균이나 다른 평형 값을 59A로 표기하지 않는다.
- raw 데이터는 미검증 입력으로 보고, 검증된 사실과 추론을 구분한다.
- 입주 가능 여부, 전세 승계, 실거주 가능성은 근거 없이 단정하지 않는다.
- 사용자가 외부 게시나 공유 URL 생성을 명시하면 루트 `report-publisher`로 공개 범위와 배포 결과를 검증한다.
