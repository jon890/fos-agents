# AGENTS.md — travel 워크스페이스

`~/ai-nodes/travel`는 여행 계획·의사결정·예약 정보를 trip별로 누적 관리하는 독립 워크스페이스. 모든 에이전트(Claude / Codex / Gemini 등)를 위한 정식 가이드 진입점. `CLAUDE.md`는 이 파일의 심볼릭 링크.

상세 결정·스키마·흐름은 `docs/` 5문서에 분리. 이 파일은 진입점·운영 원칙만 담는다.

## 1. 5문서 라우팅

| 문서 | 무엇이 들어 있는지 | 언제 보는지 |
|---|---|---|
| `docs/prd.md` | 제품 범위·기능 (자동화 0, 문서 중심)·미연결 항목 | 새 기능 추가 / 우선순위 |
| `docs/data-schema.md` | trips/\<trip-id\>/{docs, data, memory, output} 스키마 | 새 trip 추가 / 자료 정리 |
| `docs/flow.md` | 사용자 대화 흐름 (자동화 부재 명시) | 새 trip 시작 / 흐름 검토 |
| `docs/code-architecture.md` | 디렉터리 트리 + 의도된 비대칭 (ADR-001) | 구조 변경 |
| `docs/adr.md` | travel 한정 ADR 누적 (현재 ADR-001) — 모노레포 레벨: `../docs/adr.md` | 결정의 *왜* |

## 2. tasks/ 영역

planning + plan-and-build 스킬로 운영. 형태: `tasks/plan{N}-<slug>/`.
완료된 plan도 history 보존 — 삭제하지 않는다.

## 3. 목적

trip별 의사결정 + 일정 + 예약 정보를 단일 출처로 누적. 단일 사용자 (본인), 자동화 부재, 순수 문서 워크스페이스.

## 4. trip-instance 구조

```
trips/<trip-id>/
├── docs/                # 의사결정·일정·개요 (트립 메인)
│   ├── trip-overview.md     # 예약·고정 정보 (항공/숙소/교통/보험)
│   ├── itinerary.md         # Day별 일정
│   ├── decision-log.md      # 결정 누적
│   └── food-shopping-prep.md  # (선택) trip별 특화 문서
├── data/                # 예약 산출물 + 보조 데이터 (CSV / PDF 등)
├── memory/              # 세션 기록 (날짜별 .md)
└── output/              # 생성 산출물 (PNG / route schematic 등)
```

trip-id 명명 규칙: `<도시-slug>-<YYYY-MM>` (예: `osaka-2026-05`).
워크스페이스 root `docs/index.md`에 모든 trip 인덱스 유지.

## 5. 워크플로 진입점

자동화 0 — runner / cron / native skill 없음. 워크플로 = 사용자 대화 + Claude 보조 문서 작성:

```bash
# 새 trip 시작
mkdir -p travel/trips/<도시-slug>-<YYYY-MM>/{docs,data,memory,output}
# Claude 대화로 trip-overview.md / itinerary.md / decision-log.md 누적

# trip 인덱스 갱신
# travel/docs/index.md 안 trip 목록 추가
```

특정 trip 자동화가 필요해지면 `scripts/` + `.claude/skills/` 도입 — ADR-003~로 별도 결정 (ADR-001 의도된 비대칭 supersede).

## 6. 외부 의존성

- `claude` CLI — 대화 + 문서 작성 보조 (유일 의존성).
- 다른 의존 0 — Python / Bun / agent-browser / `_shared/` 모두 미사용.
- `.env` (workspace root, gitignore) — `DISCORD_CHANNEL_ID` (trip 활성 cron 또는 수동 호출 시 사용, plan002 ADR-002 도입). 예약 정보 본문은 *문서*로 보관 (환경 변수 아님).

상세는 `docs/code-architecture.md` 외부 의존성 섹션.

## 7. 운영 원칙

- 자동 예약 / 가격 수집 자동화 / 외부 API 호출 *금지* — 사용자 의도에 따른 *수동 trip 관리*.
- trip별 폴더 격리 — 한 trip의 변경이 다른 trip에 영향 0.
- 결정 시점마다 `docs/decision-log.md`에 라인 append.
- 출발 전·후 review — 사용자 요청 시 Claude 보조.
- 예약 정보 외부 노출 금지 — 공개 블로그 / 외부 git push 안 함.
- 영구 자산은 워크스페이스 내부 (`~/.openclaw/workspace` 사용 안 함).

## 8. 규칙

- 다른 워크스페이스 (apartment, career-os, stock-investment, health-care) 격리 — 교차 참조 금지.
- 새 결정은 `docs/adr.md` 누적 (개별 ADR 파일 신설 금지, ai-nodes ADR-018).
- 새 trip 추가 시 — `trips/<trip-id>/` 구조 따라 mkdir + `docs/index.md` 인덱스 갱신.
- 의도된 비대칭 (scripts/.claude/skills/ 부재) — ADR-001 참조. 자동화 도입 시 별도 plan + ADR.

## 9. fos-brain 연동

이 워크스페이스 agents의 brain 읽기/쓰기 규약.
단일 정책은 ai-nodes 루트 `AGENTS.md` 13번 + ADR-009(구조) / ADR-010(쓰기 안전·프라이버시).

- 접근: thin caller — brain-search(읽기) / brain-add(쓰기). brain 로직 재구현 금지.
- cron 무인 실행: brain-search 읽기만. brain-add 적재는 discord 대화 세션에서 사람 검토 후.
- 산출물 네임스페이스 라우팅:
  - 여행 노트·일정·예약 정보 → private (게시 적정성 확인된 여행기는 public opt-in).
