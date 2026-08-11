# data-schema — travel

travel 워크스페이스의 **디렉터리 구조·파일 스키마 단일 출처**.
trip-instance 구조와 워크스페이스 root 구조를 정의한다.

런타임 trip 목록은 `docs/index.md`가 단일 출처.
파일 형식 변경 시 본 문서를 먼저 갱신하고 실 파일에 반영한다.

## 1. trip-instance 구조

trip 하나당 `trips/<trip-id>/` 하위에 4개 디렉터리를 만든다.

### 1-1. trip-id 명명 규칙

`<도시-slug>-<YYYY-MM>` 형식.

예시:
- `osaka-2026-05`
- `tokyo-2026-08`
- `paris-2026-12`

동일 도시·월에 두 trip이 겹칠 경우 suffix `-2`, `-3` 추가.

### 1-2. `trips/<trip-id>/docs/`

trip 관련 마크다운 문서 모음. 아래 파일이 기본 구성.

| 파일 | 내용 | 필수 여부 |
|---|---|---|
| `trip-overview.md` | 예약·고정 정보 (항공 / 숙소 / 교통 / 보험) | 필수 |
| `itinerary.md` | Day별 일정 (체크인 / 활동 / 식사 / 이동) | 필수 |
| `decision-log.md` | 결정 누적 (날짜별 또는 자유 형식) | 필수 |

trip 특성에 따라 추가 문서를 둘 수 있다.
추가 문서 예시:
- `food-shopping-prep.md` — 현지 장보기·식당 목록
- `packing-list.md` — 짐 목록
- `budget.md` — 예산 계획

### 1-3. `trips/<trip-id>/data/`

예약·보조 자료 보관.

파일 형식 예시:
- 항공 예약 확인서 PDF
- 숙소 바우처 PDF
- 보딩패스 PDF / 이미지
- 지도 캡처 이미지
- 일정표 CSV

명명 규칙 없음 — 파일 원본명 유지 권장.
하위 디렉터리는 분량이 많을 경우 자유롭게 추가.

### 1-4. `trips/<trip-id>/memory/`

세션 기록 보관.
Claude와 나눈 대화 중 기억해둘 내용을 날짜별 마크다운으로 저장한다.

명명 규칙: `YYYY-MM-DD.md` 또는 `YYYY-MM-DD-<주제>.md`.

### 1-5. `trips/<trip-id>/output/`

산출물 보관.

출력 예시:
- 출발 전 체크리스트 마크다운
- route schematic PNG
- Day별 요약 인쇄용 PDF

## 2. 워크스페이스 root 구조

`travel/` 하위 고정 구조.

| 경로 | 내용 | 변경 빈도 |
|---|---|---|
| `AGENTS.md` | 워크스페이스 가이드 (CLAUDE.md 심링크 대상) | 낮음 |
| `CLAUDE.md` | AGENTS.md 심링크 | 낮음 |
| `docs/index.md` | 전체 trip 목록 (동적 문서, 보존 대상) | trip 추가·완료 시 |
| `docs/prd.md` | 제품 범위·기능 명세 | 낮음 |
| `docs/data-schema.md` | 본 문서 | 낮음 |
| `docs/flow.md` | 사용자 대화 흐름 | 낮음 |
| `docs/code-architecture.md` | 디렉터리 트리·의존성 | 낮음 |
| `docs/adr.md` | 아키텍처 결정 누적 | 결정 발생 시 |
| `trips/<trip-id>/` | trip-instance (동적) | trip마다 |
| `data/audit/` | workspace-audit 결과 | audit 실행 시 |
| `memory/` | 워크스페이스 레벨 세션 기록 | 간헐적 |
| `logs/.usage-status` | openclaw 사용 메타 | 자동 갱신 |

## 3. 의도적으로 없는 항목

이하 항목은 자동화 부재로 인해 *의도적으로 존재하지 않는다* (ADR-001 참조).

| 항목 | 이유 |
|---|---|
| `config/` | runtime 설정 없음. 예약 정보는 문서에 보관 |
| `.env` | 비밀 정보 없음 |
| `scripts/` | runner·자동화 없음 |
| `.claude/skills/` | workspace-level skill 없음 |
| `logs/task-runs.jsonl` | Claude CLI 자동 호출 없음 → 비용 추적 불요 |

## 4. docs/index.md 형식

trip 인덱스의 권장 형식 (보존 대상 파일):

```markdown
# Travel Index

## Trips

| trip-id | 기간 | 목적지 | 상태 |
|---|---|---|---|
| osaka-2026-05 | 2026-05-13 ~ 2026-05-16 | 오사카 | 완료 |
```

상태 값: `계획 중` / `준비 중` / `완료` / `취소`.
