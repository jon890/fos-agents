# ADR — ai-nodes 모노레포

ai-nodes 모노레포 레벨에서 모든 워크스페이스에 영향을 주는 결정을 기록한다.
워크스페이스 한정 결정은 각 워크스페이스의 ADR 문서를 따른다.

새 모노레포 결정은 새 `ADR-NNN-slug.md` 파일로 만들고 이 INDEX에 한 줄을 추가한다.
ADR은 결정의 이유와 대안 기각만 담고, 현행 구조 설명은 `docs/code-architecture.md`를 따른다.

## Quick Index

| ADR | 제목 | Status | 파일 |
|---|---|---|---|
| ADR-019 | 외부 agent runtime 종속성을 제거한다 | Accepted | [ADR-019-runtime-framework-independence.md](ADR-019-runtime-framework-independence.md) |
| ADR-020 | 공개 HTML 리포트는 Cloudflare Pages 직접 업로드로 게시한다 | Accepted | [ADR-020-cloudflare-pages-report-publishing.md](ADR-020-cloudflare-pages-report-publishing.md) |
| ADR-021 | 결정론적 처리와 agent 해석을 분리한다 | Accepted | [ADR-021-deterministic-agent-boundary.md](ADR-021-deterministic-agent-boundary.md) |
| ADR-022 | 외부 데이터는 경계에서 스키마로 검증한다 | Accepted | [ADR-022-external-data-schema-validation.md](ADR-022-external-data-schema-validation.md) |
