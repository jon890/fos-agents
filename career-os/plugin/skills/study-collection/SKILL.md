---
name: study-collection
description: 읽을거리를 수집하고 공부 추천 리포트를 HTML 로 만든다. "읽을거리 수집", "소스 추가", "소스 끄기", "공부 추천 리포트", "추천 HTML 공유" 같은 요청에 사용한다. HTML 없이 대화에서 자료를 고르는 일은 `study-topic-recommender` 가 맡는다.
---

# 공부 자료 수집과 리포트

이 스킬은 Claude Code 에서만 돈다.
셸이 없는 환경이면 할 수 없다고 알리고 끝낸다.

실행기 명령은 `bun --no-env-file "${CLAUDE_PLUGIN_ROOT}/dist/career-local.js"` 이다.
이 문서와 `references/` 에서는 그 명령을 `<CAREER_LOCAL>` 로 적는다.
데이터는 커리어 작업 폴더의 `state/career.sqlite` 에 있다. 작업 폴더는 `CAREER_WORKSPACE_ROOT` 이고 없으면 `/workspace/career` 다.
커리어 Backend 주소와 token 은 쓰지 않는다.
작업본 동기화는 하지 않는다. 소스, 수집 자료, 추천 이력은 이 저장소가 갖는다.
대화용 공부 추천 도구(`list_study_candidates`, `save_study_recommendation`)는 이 저장소를 읽지 않는다. 이 스킬로 수집한 자료의 추천 저장은 아래 실행기 명령으로만 한다.

## 1. 맥락 문서와 점검

실행기는 `learning-interests` 문서를 작업 폴더의 `context/` 에서만 읽는다.
`get_context_document` 로 `learning-interests` 를 읽어 본문을 고치지 않고 `<작업 폴더>/context/learning-interests.md` 에 쓴다.
문서가 없으면 실행기를 부르지 않는다. 사용자와 문서를 먼저 쓴 뒤 다시 하자고 안내하고 끝낸다.

그다음 `<CAREER_LOCAL> study --doctor` 를 실행한다.
실행기가 `CAREER_STORE_BUSY` 나 `CAREER_STORE_CORRUPT` 로 끝나면 이어 가지 않고 표준 오류 첫 줄을 최종 답변 첫 줄에 적는다.

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
기록 명령과 각 값의 형식은 `references/execution.md` 의 「실행」 절에서 `--record-publication` 명령을 읽는다.

`--record-publication` 을 실행할 때 `--run-dir` 이 없으면 실행기가 종료 코드 2 로 끝난다.
지난 추천과 기록한 게시 링크는 `<CAREER_LOCAL> study --list-recommendations` 로 본다.

## 5. 정리

공유를 마쳤거나 요청이 없으면 `<CAREER_LOCAL> study --cleanup --run-dir <RUN_DIR>` 를 실행한다.
