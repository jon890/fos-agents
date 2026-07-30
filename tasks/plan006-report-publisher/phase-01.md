# Phase 01 — report-publisher skill 구현과 시험 배포

**Execution profile**: standard
**Status**: completed

---

## 목표

공개 가능한 HTML 산출물만 Cloudflare Pages 미리보기 분기에 게시하고,
검증된 주소를 반환하는 공용 skill을 만든다.

**범위 외**:

- 저장소 전체 게시
- Pages 프로젝트나 배포 삭제
- 사용자 정의 도메인 연결
- 비공개 접근 제어

## 사전 작업 디렉터리

```bash
# cwd: ai-nodes 저장소 루트
cd "$(git rev-parse --show-toplevel)"
pwd
```

## 작업 항목

### 공용 skill 생성

`.agents/skills/report-publisher/`에 한국어 `SKILL.md`와 실행 스크립트를 만든다.
별도의 심볼릭 링크는 만들지 않는다.

### 게시 준비와 검증 구현

Python 표준 라이브러리만 사용해 게시 대상 복사와 민감 정보 검사를 구현한다.
저장소 루트, 숨김 파일, 심볼릭 링크, 비밀 키, 로컬 절대 경로는 차단한다.

### Wrangler 게시 구현

`Wrangler 4.115.0`으로 Pages 미리보기 분기에 게시한다.
성공하면 검증된 배포 URL을 JSON으로 반환한다.
분기 별칭은 실제 HTTP 검증을 통과한 경우에만 함께 반환한다.

### 시험 배포와 검증

군산·대전 여행 HTML을 준비 검사한 뒤 `fos-reports`에 게시한다.
실제 주소의 HTTP 상태와 문서 제목을 확인한다.

## 검증

```bash
# cwd: ai-nodes 저장소 루트
cd "$(git rev-parse --show-toplevel)"
python3 /Users/nhn/.codex/skills/.system/skill-creator/scripts/quick_validate.py \
  .agents/skills/report-publisher
python3 .agents/skills/report-publisher/scripts/publish_report.py prepare \
  --source travel/trips/gunsan-daejeon-2026-08/output/gunsan-daejeon-summer-trip-report.html \
  --slug travel-gunsan-daejeon-2026-08
git diff --check -- \
  .agents/skills/report-publisher \
  docs/code-architecture.md \
  docs/adr \
  tasks/plan006-report-publisher
```

검증이 모두 통과하면 `index.json`과 이 파일의 상태를 `completed`로 바꾼다.

## 완료 근거

- 단위 테스트 13개가 통과했다.
- skill 구조 검사가 통과했다.
- 군산·대전 여행 HTML의 준비 검사가 통과했다.
- Cloudflare Pages 배포 주소가 HTTP 200과 예상 문서 제목을 반환했다.
- 실제 브라우저에서 지도, 일정, 후기 본문이 렌더되고 JavaScript 오류가 없었다.

## 막힘 조건

- Cloudflare 로그인이 없으면 로컬 구현과 준비 검증을 완료한 뒤 인증 단계만 보고한다.
- Pages 쓰기 권한이 없으면 `PHASE_BLOCKED: Cloudflare Pages 쓰기 권한 없음`으로 종료한다.
