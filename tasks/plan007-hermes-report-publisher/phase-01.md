# Phase 01 — position-recommender 승인형 게시 위임 연결

**Execution profile**: standard
**Status**: pending

## 목표

`position-recommender`가 완성한 HTML을 현재 요청의 명시적 승인 뒤에만
저장소 전역 `/report-publisher`로 위임하도록 skill 계약을 확장한다.

## 범위

- `career-os/.claude/skills/position-recommender/SKILL.md`에 선택적 게시 분기를 추가한다.
- 상세 절차를 `references/report-publishing.md`로 분리한다.
- 추천 JSON 스키마, HTML 렌더러, 수집기, 예약 실행의 기본 동작은 바꾸지 않는다.
- Cloudflare 호출 코드를 `career-os/scripts/position-recommender/`에 추가하지 않는다.

## 사전 작업 디렉터리

```bash
# cwd: fos-agents 저장소 루트
cd "$(git rev-parse --show-toplevel)"
pwd
```

## 승인 분기

다음 조건을 모두 만족할 때만 `/report-publisher`를 위임한다.

- 현재 요청에 외부 게시 또는 Cloudflare Pages 업로드 의도가 명시돼 있다.
- 게시 대상이 `career-os/reports/downloads/` 아래의 이번 실행 HTML이다.
- 준비 검사와 사용자 미리보기가 공개 가능한 내용임을 확인했다.

예약 실행, 추천 JSON 요청, HTML 생성 요청만으로는 게시 승인을 추론하지 않는다.

## 결과 계약

게시 성공 시 검증된 `public_url`을 사용자 응답에 포함한다.
`branch_url`은 게시기가 HTTP 검증을 통과해 반환한 경우에만 함께 안내한다.
게시 실패 시 로컬 HTML 경로와 실패 사유를 반환하고 추천 산출물은 삭제하지 않는다.

## 검증

```bash
# cwd: fos-agents 저장소 루트
cd "$(git rev-parse --show-toplevel)"
rg -n "\/report-publisher|public_url|예약 실행" career-os/.claude/skills/position-recommender/SKILL.md career-os/.claude/skills/position-recommender/references/report-publishing.md
test -z "$(rg -l "wrangler|pages deploy" career-os/scripts/position-recommender || true)"
validator="${CODEX_HOME:-${HOME}/.codex}/skills/.system/skill-creator/scripts/quick_validate.py"
test -f "$validator"
python3 "$validator" career-os/.claude/skills/position-recommender
python3 -m unittest discover -s .agents/skills/report-publisher/scripts -p 'test_*.py'
git diff --check -- career-os/.claude/skills/position-recommender
```

모든 명령이 종료 코드 0을 반환해야 한다.

## 커밋

`feat(career-os): 추천 리포트의 승인형 공개 게시 연결`

## 실패 조건

- 기본 추천 실행이 공개 게시를 수행하도록 바뀌면 실패한다.
- 추천 JSON에 게시 주소 필드를 추가하거나 새 상태 파일을 만들면 범위 위반이다.
- position 스크립트가 Wrangler 또는 Cloudflare 인증을 직접 소유하면 실패한다.
