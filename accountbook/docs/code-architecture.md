# Code Architecture: accountbook

## 디렉터리

```text
accountbook/
├── AGENTS.md
├── README.md
├── .env.example
├── docs/
├── scripts/accountbook-screenshot-import/
├── .claude/skills/accountbook-screenshot-import/
├── .codex/skills/accountbook-screenshot-import
└── private/
```

| 경로 | 책임 |
|---|---|
| `.claude/skills/accountbook-screenshot-import/` | agent workflow 정본 |
| `.codex/skills/accountbook-screenshot-import` | Codex가 정본 skill을 찾는 링크 |
| `scripts/accountbook-screenshot-import/` | 스키마 검증, 승인 표시와 API 등록 |
| `docs/` | 제품, 흐름, 저장 계약과 기술 결정 |
| `private/` | 이미지, 거래 후보, 인증과 전송 상태 |

## 처리 경계

vision 지원 agent는 화면 문맥을 읽고 `extracted.json`을 만든다.
화면 전체와 거래 행을 여러 번 확인할 수 있지만 최종 등록 가능 여부를 판정하지 않는다.

TypeScript script는 다음 책임을 가진다.

- 입력 스키마와 날짜를 검증한다.
- 금액을 원 단위 양의 정수로 정규화한다.
- 날짜별 수입·지출 합계를 계산해 화면 요약과 비교한다.
- batch와 후보 식별자를 만든다.
- 사용자 승인과 전송 상태를 기록한다.
- 기존 accountbook API를 호출하고 부분 성공을 복구한다.

agent의 추출 결과가 상태 변경에 쓰이기 전에 결정적 검증을 거치므로 루트 [ADR-021](../../docs/adr/ADR-021-deterministic-agent-boundary.md)을 따른다.

## 외부 의존

- vision 입력을 지원하는 agent runtime
- TypeScript를 직접 실행할 수 있는 Bun 또는 Node.js 22.18 이상
- 기존 루트 의존성인 `zod`와 `dotenv`
- fos-accountbook-backend의 인증, 카테고리, 수입과 지출 REST API

특정 agent CLI, 스케줄러와 메시지 채널에 의존하지 않는다.
실행 runtime 선택은 루트 [ADR-019](../../docs/adr/ADR-019-runtime-framework-independence.md)를 따른다.

## 확장 기준

새 화면 종류는 같은 validator 입력 스키마를 생성하는 별도 skill 또는 추출 reference로 추가한다.
OCR 모델, queue와 LangGraph는 실제 실패 복구 요구가 현재 상태 파일과 선형 workflow를 넘어설 때 검토한다.
