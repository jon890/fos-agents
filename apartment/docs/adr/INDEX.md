# ADR — apartment

apartment에만 적용되는 기술 결정을 기록한다.
공통 결정은 [루트 ADR INDEX](../../../docs/adr/INDEX.md)를 따른다.

| ADR | 제목 | Status | 파일 |
|---|---|---|---|
| ADR-001 | Naver Land API 수집 경계 | Accepted | [ADR-001-naver-land-api-boundary.md](ADR-001-naver-land-api-boundary.md) |
| ADR-002 | 타깃 메타 단일 출처 | Accepted | [ADR-002-focus-unit-source.md](ADR-002-focus-unit-source.md) |
| ADR-003 | 수집과 정규화에 TypeScript와 Bun 사용 | Accepted | [ADR-003-typescript-bun-collection.md](ADR-003-typescript-bun-collection.md) |
| ADR-005 | 외부 HTTP 요청은 Bun fetch 사용 | Accepted | [ADR-005-bun-fetch.md](ADR-005-bun-fetch.md) |
| ADR-006 | collector는 module import로 조합 | Accepted | [ADR-006-collector-module-composition.md](ADR-006-collector-module-composition.md) |
| ADR-011 | 인테리어 결정은 Markdown 정본과 HTML 표시본으로 분리 | Accepted | [ADR-011-interior-markdown-html-view.md](ADR-011-interior-markdown-html-view.md) |

공통 데이터 처리 경계는 [루트 ADR-021](../../../docs/adr/ADR-021-deterministic-agent-boundary.md)과 [ADR-022](../../../docs/adr/ADR-022-external-data-schema-validation.md)를 따른다.
