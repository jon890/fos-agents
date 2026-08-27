# apartment 코드 아키텍처

이 문서는 apartment 워크스페이스의 현재 디렉터리와 코드 책임을 설명한다.

## 디렉터리

```text
apartment/
├── AGENTS.md
├── README.md
├── CLAUDE.md -> AGENTS.md
├── .env.example
├── config/
│   ├── README.md
│   ├── focus-unit.json
│   ├── guri-buy-complexes.json
│   ├── interior-reference-digest.json
│   └── lucky-24-floorplan.json
├── docs/
│   ├── prd.md
│   ├── data-schema.md
│   ├── flow.md
│   ├── code-architecture.md
│   ├── adr/
│   │   ├── INDEX.md
│   │   └── ADR-NNN-slug.md
│   └── interior/
├── scripts/
│   ├── _lib/
│   │   └── load_target_meta.ts
│   ├── apartment-daily-report/
│   │   ├── run_smoke_test.sh
│   │   ├── collect_sources.ts
│   │   ├── collect_naver_api.ts
│   │   ├── naver_api_schemas.ts
│   │   ├── collect_hogangnono.ts
│   │   ├── collect_kbland.ts
│   │   └── normalize_results.ts
└── .claude/
    └── skills/
        ├── apartment-daily-report/
        └── apartment-interior-reference-digest/
```

`data/`와 실제 `.env`는 실행 산출물과 비밀 값 영역이다.

## 코드 책임

| 경로 | 책임 |
|---|---|
| `scripts/_lib/load_target_meta.ts` | `focus-unit.json`을 읽어 타깃 메타데이터를 제공한다. |
| `scripts/apartment-daily-report/collect_sources.ts` | 세 수집기를 호출해 `raw-search.json`을 만든다. |
| `scripts/apartment-daily-report/collect_naver_api.ts` | Naver Land API 수집과 인증 상태를 처리한다. |
| `scripts/apartment-daily-report/collect_hogangnono.ts` | Hogangnono 데이터를 수집한다. |
| `scripts/apartment-daily-report/collect_kbland.ts` | KB Land 데이터를 수집한다. |
| `scripts/apartment-daily-report/normalize_results.ts` | raw 결과를 `summary.json` 구조로 정규화한다. |
| `scripts/apartment-daily-report/run_smoke_test.sh` | 수집기와 정규화기 빠른 검증을 실행한다. |
| `.claude/skills/*/SKILL.md` | agent가 수행할 workflow 계약을 담는다. |

## 실행 계약

스킬은 로컬 파일과 실행한 수집기의 종료 코드로 결과를 검증한다.
외부 전달 채널과 자동 실행 시점은 저장소 밖에서 정한다.

## 의존성

| 의존성 | 용도 |
|---|---|
| Bun runtime | TypeScript 수집기와 정규화기 실행 |
| zod | 외부 응답과 정규화 결과 스키마 검증 |
| agent-browser | Naver Land 인증 토큰 fallback 수집 |
| agent 실행 환경 | `.claude/skills` workflow 수행 |

## 언어

| 언어 | 현재 역할 |
|---|---|
| TypeScript | 수집, 정규화, config 로딩 |
| Shell | smoke test |
| Python | smoke test의 JSON shape 확인용 짧은 검증 코드 |
