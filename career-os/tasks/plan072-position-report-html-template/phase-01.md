# Phase 01 — 현 HTML renderer와 daily 연결 감사

**Model**: sonnet
**Status**: pending

---

## 목표

현재 `position-recommender` daily runner가 Markdown, HTML, Discord 첨부를 어떻게 연결하는지 확인하고 plan072 구현 기준을 `artifacts/design-notes.md`에 고정한다.

**범위 외**: renderer 로직 변경, template 파일 도입, CSS 작성, daily runner 동작 변경, docs/ADR 수정.

---

## 사전 cwd 설정

run-phases.py는 cwd=workspace로 phase를 실행한다.
본 phase는 ai-nodes 루트 기준 path를 사용하므로 첫 bash에서 cwd=ai-nodes 루트로 변경한다.

```bash
cd "$(git rev-parse --show-toplevel)"
pwd  # 기대: ai-nodes repo root
```

---

## 관련 docs

실행 전 반드시 읽는다.

- `career-os/docs/adr.md`의 ADR-080
- `career-os/docs/flow.md`의 `/position-recommender` daily 흐름
- `career-os/docs/code-architecture.md`의 `scripts/position-recommender/` 책임
- `career-os/docs/data-schema.md`의 `data/runtime/position-recommendation.html`
- `career-os/tasks/plan072-position-report-html-template/index.json`

---

## 작업 항목

### 1. renderer와 runner 연결 확인

다음 파일을 읽고 현재 연결을 요약한다.

- `career-os/scripts/position-recommender/render_report_html.ts`
- `career-os/scripts/position-recommender/run_daily_with_claude.ts`
- `career-os/.claude/skills/position-recommender/SKILL.md`

확인할 항목:

- `report.md`와 `runtime markdown` 생성 뒤 HTML을 만드는 위치.
- `report.html`과 `runtime html` 출력 경로.
- Discord 알림이 HTML 파일을 `--media`로 첨부하는지.
- HTML 생성 실패가 runner 실패로 전파되는지.

### 2. Markdown 구조 샘플 감사

최근 position recommendation report를 찾아 섹션 구조를 확인한다.
실측 명령과 결과를 design notes에 남긴다.

권장 명령:

```bash
cd "$(git rev-parse --show-toplevel)"
find career-os/data/reports/daily -path '*/position-recommendation/report.md' -print | sort | tail -5
```

### 3. HTML 표시 요구 정리

`career-os/tasks/plan072-position-report-html-template/artifacts/design-notes.md`를 갱신한다.
다음 내용을 포함한다.

- 현재 흐름 요약.
- template placeholder 후보.
- 추천 티어 카드에서 보여줄 필드.
- source diagnostics를 접힘 영역으로 둘지 여부.
- 모바일/데스크톱에서 깨지기 쉬운 요소.
- phase 02와 phase 03에서 구현할 구체 범위.

### 4. docs freeze 확인

구현 phase에서 docs를 고치지 않아도 되는지 확인한다.
문서 결정이 부족하면 코드 수정 없이 `PHASE_BLOCKED`로 종료한다.

### 5. phase commit

검증이 끝나면 의도한 변경만 stage한다.
commit 메시지는 `docs(career-os): position HTML 리포트 감사 메모 추가`를 사용한다.

---

## Critical Files

| 파일 | 변경 |
|---|---|
| `career-os/tasks/plan072-position-report-html-template/artifacts/design-notes.md` | 현재 흐름 감사와 디자인 기준 기록 |

읽기 전용 확인 파일:

- `career-os/scripts/position-recommender/render_report_html.ts`
- `career-os/scripts/position-recommender/run_daily_with_claude.ts`
- `career-os/.claude/skills/position-recommender/SKILL.md`
- `career-os/data/reports/daily/*/position-recommendation/report.md`

---

## 검증

보고 직전 반드시 아래 bash 블록을 실행하고 raw 값을 출력한다.

```bash
cd "$(git rev-parse --show-toplevel)"

test -f career-os/tasks/plan072-position-report-html-template/artifacts/design-notes.md
rg -n "template|Discord|report.html|mobile|diagnostics" \
  career-os/tasks/plan072-position-report-html-template/artifacts/design-notes.md

git -C career-os diff --check
git -C career-os status --short
```

---

## 성공 기준

- 현재 HTML 생성 경로와 Discord 첨부 흐름이 design notes에 기록된다.
- 최근 Markdown report 구조 확인 결과가 실측 명령과 함께 남는다.
- phase 02와 phase 03의 구현 범위가 design notes에 충분히 구체화된다.
- renderer, runner, template 구현 코드는 변경하지 않는다.
- docs/ADR/정책 문서는 수정하지 않는다.

---

## PHASE_BLOCKED

다음 경우에는 반드시 Bash 도구로 직접 `echo 'PHASE_BLOCKED: ...' && exit 2`를 실행한다.

- ADR-080과 docs만으로 template 경로 또는 HTML 정본 경계를 결정할 수 없다.
- 최근 report 샘플이 없고 Markdown 구조를 안전하게 가정할 수 없다.
- runner가 HTML 첨부를 보내는지 확인할 수 없다.

## PHASE_FAILED

다음 경우에는 반드시 Bash 도구로 직접 `echo 'PHASE_FAILED: ...' && exit 1`를 실행한다.

- design notes를 쓰지 않고 성공 보고하려는 경우.
- 구현 코드나 docs/ADR을 수정한 경우.
- 검증 명령을 실행하지 못한 경우.

---

## common-pitfalls self-check

- [ ] 수치가 있으면 실측 명령을 함께 적었다.
- [ ] 성공 기준은 `test`, `rg`, `git diff --check`로 판정 가능하다.
- [ ] phase 단독 실행에 필요한 경로와 docs를 모두 적었다.
- [ ] 다른 워크스페이스 파일을 참조하지 않았다.
- [ ] docs/ADR 수정은 범위 밖으로 유지했다.
- [ ] 첫 bash 블록에서 ai-nodes 루트로 이동한다.
