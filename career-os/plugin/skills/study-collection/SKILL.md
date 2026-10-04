---
name: study-collection
description: 읽을거리를 수집하고 공부 추천 리포트를 HTML 로 만든다. "읽을거리 수집", "소스 추가", "소스 끄기", "공부 추천 리포트", "추천 HTML 공유" 같은 요청에 사용한다. HTML 없이 대화에서 자료를 고르는 일은 `study-topic-recommender` 가 맡는다.
---

# 공부 자료 수집과 리포트

이 스킬은 Claude Code 에서만 돈다.
셸이 없는 환경이면 할 수 없다고 알리고 끝낸다.

실행기 명령은 `bun --no-env-file "${CLAUDE_PLUGIN_ROOT}/dist/career-local.js"` 이다.
이 문서와 `references/` 에서는 그 명령을 `<CAREER_LOCAL>` 로 적는다.
셸 환경에 `CAREER_BACKEND_URL`, `CAREER_BACKEND_TOKEN` 이 있어야 한다.
작업본 동기화는 하지 않는다. 추천 상태는 Backend 가 갖는다.

## 1. 점검

`<CAREER_LOCAL> study --doctor` 를 실행한다.

## 2. 수집과 리포트

수집, 후보 준비, 리포트, 추천 저장은 `references/execution.md` 를 읽고 따른다.
정리는 5번에서 한다.
자료를 고르는 기준은 대화용 `study-topic-recommender` 스킬의 「2. 고르기」 를 따른다.

## 3. 소스 관리

소스를 추가하거나 끄거나 바꿀 때는 `references/source-management.md` 를 읽는다.

## 4. 공유 링크

사용자가 요청했을 때만, 정리하기 전에 한다.
`<CAREER_LOCAL> study-validate --run-dir <RUN_DIR>` 와 직접 읽기로 HTML 에 개인 정보, 비공개 회사 맥락, 로컬 절대 경로가 없는지 확인한다.
통과하면 사용자가 가진 게시 수단으로 올린다.
게시한 URL 이 열리는지 확인한 뒤 기록한다.

```bash
<CAREER_LOCAL> study --record-publication --run-dir <RUN_DIR> --report-id ... --channel ... --external-id ... --published-at ... --url ...
```

`--run-dir` 이 없으면 실행기가 종료 코드 2 로 끝난다.

## 5. 정리

공유를 마쳤거나 요청이 없으면 `<CAREER_LOCAL> study --cleanup --run-dir <RUN_DIR>` 를 실행한다.
