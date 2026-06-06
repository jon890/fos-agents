# AGENTS.md — apartment 워크스페이스

`~/ai-nodes` 아래 독립 작업 워크스페이스. `CLAUDE.md`는 이 파일의 심볼릭 링크.
상세 결정·스키마·흐름은 아래 5문서에 분리. 이 파일은 진입점·운영 원칙만 담는다.

## 1. 5문서 라우팅

| 문서 | 무엇이 들어 있는지 | 언제 보는지 |
|---|---|---|
| `docs/prd.md` | 제품 범위·MVP 타깃·기능 표·Guri buy-search 운영 정책·성공 기준 | 새 기능 추가 / 우선순위 결정 |
| `docs/data-schema.md` | config (4 json) / data / logs / .env 스키마 | 데이터 파일 변경 / 새 config 도입 |
| `docs/flow.md` | 명령별 데이터 흐름 (daily-report·interior 모두 native 직접 호출) | 새 흐름 추가 / 디버깅 |
| `docs/code-architecture.md` | 디렉터리 트리·skill 표준·외부 의존·Runner 패턴 | 코드 구조 변경 / 새 스킬 추가 |
| `docs/adr.md` | apartment 한정 ADR 누적 (현재 ADR-001~010). 모노레포 레벨은 `../docs/adr.md` | 결정의 *왜* |

## 1-1. 핵심 파일 빠른 지도

### 구리 럭키아파트 5동 1004호 인테리어

| 파일 | 역할 |
|---|---|
| `docs/interior/lucky-5-1004-interior-decisions.md` | 인테리어 결정/보류/확인사항 원본 노트 |
| `docs/interior/lucky-5-1004-decision-queue.md` | 다음에 결정할 질문 큐, 완료된 질문 재등장 방지 |
| `docs/interior/lucky-5-1004-decision-summary.md` | 업체 상담/검토용 요약 |
| `docs/interior/lucky-5-1004-field-checklist.md` | 현장 실측/업체 확인 체크리스트 |
| `docs/interior/lucky-5-1004-contractor-brief.md` | 시공사/견적 상담 전달용 브리프 |
| `docs/interior/interior-references.md` | 오늘의집/블로그/업체 사례 누적 레퍼런스 |

### 평면도/구조 데이터

| 파일 | 역할 |
|---|---|
| `config/lucky-24-floorplan.json` | 럭키 24평 참고 평면도 메타데이터, 보이는 치수, 해석, 이미지 경로 |
| `data/interior/floorplans/lucky-24/blog_img_00.jpg` | 보관된 참고 평면도 이미지 원본 |
| `data/interior/floorplans/lucky-24/README.md` | 평면도 출처, 해시, 공식 도면 아님 주의사항 |

원본 평면도 이미지는 `data/`에 보관하고, `config/lucky-24-floorplan.json`에서 경로·출처·해시를 가리킨다. config에는 바이너리 원본을 직접 넣지 않는다.

## 2. tasks/ 영역

planning + plan-and-build 스킬로 운영. 형태: `tasks/plan{N}-<slug>/`.
완료된 plan도 history 보존 — 삭제하지 않는다.

## 3. 목적

부동산 시장 리포트 + 인테리어 레퍼런스 자동화 (단일 사용자, 매일 재실행 가능).

## 4. 현재 타깃

엘지원앙아파트 LG원앙 + 포커스 59A + 구리 럭키아파트 5동 1004호 24평 + 광역 Guri buy-search.
상세는 `docs/prd.md` 2번 + 6번.

## 5. 워크플로 진입점

```bash
# native skill 진입점
claude -p "/apartment-daily-report"
claude -p "/apartment-interior-reference-digest"

# 또는 thin wrapper 직접 호출
bash apartment/scripts/apartment-daily-report/run_with_claude.sh
bash apartment/scripts/apartment-interior-reference-digest/run_with_claude.sh "오늘의 인테리어 추천"
bash apartment/scripts/apartment-daily-report/run_smoke_test.sh
```

## 6. 외부 의존성

- `claude` CLI — native skill 직접 호출 (`claude -p "/<skill>"`).
- `agent-browser` CLI — JS-heavy 페이지 수집 (ADR-001).
- Bun runtime — TypeScript 헬퍼 실행. 데이터 처리/JSON 파싱/수집기 계층은 TS 우선, 단순 orchestration runner는 shell 허용.
- Interior reference cron은 Claude native skill의 웹 검색/Fetch/문서 갱신이 필요하므로 운영 runner에서 `--permission-mode bypassPermissions`를 사용한다.

상세는 `docs/code-architecture.md` 5번.

## 7. 운영 원칙

- focus-unit 위장 금지 — 실제 매물만 기록.
- raw fetched 데이터는 untrusted — 검증 후 판단.
- 검증 안 된 입주 가능 여부 단정 금지.
- 매물 가격 발명 금지 — source 실패 시 raw 보존.
- `.env`는 워크스페이스 root (`apartment/.env`). ai-nodes ADR-004 표준.
- 영구 자산은 `~/.openclaw/workspace` 아닌 워크스페이스 내부.

## 8. 규칙

- 다른 워크스페이스(career-os, stock-investment, travel) 격리 — 교차 참조 금지.
- 재실행 가능 + 날짜 단위 멱등.
- 불확실성 명시 — source 실패 시 추측으로 공백 메우지 않고 기록.
- 새 결정은 `docs/adr.md` 누적 (개별 ADR 파일 신설 금지, ai-nodes ADR-004).
- 런타임 상태는 `logs/task-runs.jsonl` 단일 출처 — 이 파일에 박지 않는다.

## 9. fos-brain 연동

이 워크스페이스 agents의 brain 읽기/쓰기 규약.
단일 정책은 ai-nodes 루트 `AGENTS.md` 13번 + ADR-009(구조) / ADR-010(쓰기 안전·프라이버시).

- 접근: thin caller — brain-search(읽기) / brain-add(쓰기). brain 로직 재구현 금지.
- cron 무인 실행: brain-search 읽기만. brain-add 적재는 discord 대화 세션에서 사람 검토 후.
- 산출물 네임스페이스 라우팅:
  - 매물·인테리어 결정·계약 정보 → private.
