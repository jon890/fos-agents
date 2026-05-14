---
name: study-pack-writer
description: "면접 준비·기술 블로그 겸용 재사용 가능 학습팩 마크다운을 fos-study 저장소에 생성·게시한다. 토픽이 매일 바뀌며 [초안] 라벨·실무 예제·실습 연습·면접 연결 구조가 포함된 독립 문서 한 건을 원할 때 사용. git commit/push 자동 수행. '/study-pack ...', 'study pack 만들어줘', '~에 대한 스터디팩 만들어줘', 'fos-study에 정리해줘' 같은 자연어 요청도 처리. 자연어 요청은 내부에서 topic key로 변환 후 동일 흐름."
---

# Study Pack Writer

토픽 기반 학습 팩을 생성하여 `fos-study`에 직접 게시한다. 면접 준비 + 기술 블로그 겸용 전체 독립 문서.

## 호출 방법

```bash
career-os/scripts/command-router/run_now.sh study-pack <topic>
```

`<topic>`은 `config/topics.json`의 study-pack namespace 키 (예: `explain-plan`, `cache-aside`).

실행 파일: `career-os/scripts/study-pack-writer/`(ADR-019).

## 입력

- `config/topics.json` (study-pack namespace) — `domain`, `outputPath`, `promptAppend` 필드
- `references/study-pack-prompt.md` — 공통 프롬프트 템플릿
- `references/topic-profiles.md` — 토픽별 도메인 확장 참고

새 토픽 추가: `config/topics.json`에 `domain` · `outputPath` · `promptAppend` 항목 추가.

## 산출물

- `sources/fos-study/...` — `[초안]` 접두어로 게시 + git commit + push
- `data/reports/` — 실행 로그·중간 산출물
- `data/generated-artifacts.json` — kind=`study-pack` upsert (push 성공 시)

문서 포함 항목: 토픽 중요성, 핵심 개념, 실무 사용, 면접 연결, 로컬 실습, 예제(SQL/코드/커맨드), bad vs improved, 체크리스트. push 실패 시 명시적으로 오류 출력.

커밋 메시지 예: `docs(mysql): add draft explain-plan study pack`.

## 관련 ADR

ADR-005: 산출물 경로 컨벤션.
ADR-011: study-pack-writer 분리 근거.
ADR-014: 비용 측정 정책.
