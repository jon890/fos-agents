# TOOLS.md — career-os 작업 메모

## 현재 MVP 기준

- 저장소: https://github.com/jon890/fos-study
- 브랜치: `main`
- 선호 동기화 경로: `~/ai-nodes/career-os/sources/fos-study`
- 분석 대상은 markdown 파일로 제한한다.
- `.claude/**`는 무시한다.
- 집중 영역은 Java backend 면접 준비다.
- 회사 타깃은 `config/mvp-target.json`을 단일 출처로 본다.
- 사용자가 스스로 약하다고 보는 영역은 DB다.
- `GITHUB_TOKEN` 같은 작업별 비밀 값은 `config/.env`를 사용한다.

## Agent Skill 호출

- agent skill은 이 워크스페이스 root에서 실행한다.
- 오래 걸리는 skill 호출은 백그라운드 실행을 우선한다.
- 워크플로는 `/<skill> ...` 형태의 skill 호출 의도로 표현한다.
- Claude CLI 호환 실행 명령은 한 실행 경로일 뿐이고, 워크플로 계약으로 쓰지 않는다.
- 지원서, 이메일, 공개 게시물, 외부 메시지는 에이전트나 permission mode로 사용자 승인을 우회하지 않는다.
