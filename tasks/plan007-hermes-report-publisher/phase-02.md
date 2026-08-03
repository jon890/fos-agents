# Phase 02 — Hermes 외부 skill과 Cloudflare 비밀 변수 연결

**Execution profile**: standard
**Status**: pending

## 목표

홈서버 Hermes가 저장소의 `.agents/skills/report-publisher`를 발견하고,
비밀 저장소의 `CLOUDFLARE_API_TOKEN`을 게시 명령에만 전달하도록 구성한다.

## 전제 조건

- `fos-agents`의 홈서버 정본 경로를 `FOS_AGENTS_ROOT` 환경 변수로 설정했다.
- 사용자가 Cloudflare에서 해당 계정의 `Cloudflare Pages: Edit` 권한만 가진 토큰을 발급했다.
- 토큰 값은 채팅, 저장소, task 파일, 실행 로그에 붙이지 않는다.

## Hermes 설정

`~/.hermes/config.yaml`의 기존 값을 보존하면서 아래 항목을 병합한다.

```yaml
skills:
  external_dirs:
    - ${FOS_AGENTS_ROOT}/.agents/skills
terminal:
  env_passthrough:
    - CLOUDFLARE_API_TOKEN
```

다른 `external_dirs`와 `env_passthrough` 값이 있으면 제거하지 않는다.
저장소 경로는 `~/.hermes/.env`에 `FOS_AGENTS_ROOT` 이름으로 저장한다.
토큰 값은 같은 파일에 `CLOUDFLARE_API_TOKEN` 이름으로 저장하고 파일 권한을 `600`으로 둔다.

## 사전 작업 디렉터리

```bash
# cwd: fos-agents 저장소 루트
cd "$(git rev-parse --show-toplevel)"
pwd
```

## 발견과 인증 검증

홈서버 Hermes 터미널에서 아래 검증을 실행한다.

```bash
# cwd: 홈서버 fos-agents 저장소 루트
cd "$(git rev-parse --show-toplevel)"
test -f .agents/skills/report-publisher/SKILL.md
hermes skills list | rg -q "report-publisher"
test "$(stat -c '%a' ~/.hermes/.env)" = "600"
```

Hermes 세션에서 `/report-publisher`를 로드한 뒤 다음 인증 점검을 실행하게 한다.

```bash
# cwd: 홈서버 fos-agents 저장소 루트
cd "$(git rev-parse --show-toplevel)"
test -n "${CLOUDFLARE_API_TOKEN:-}"
python3 .agents/skills/report-publisher/scripts/publish_report.py check-auth \
  --project-name fos-reports
```

응답 JSON의 `status`가 `authenticated`이고 `pages_write`가 `true`여야 한다.

## 승인형 게시 검증

현재 요청에서 공개 승인을 받은 `career-os/reports/downloads/` HTML 한 건의
경로, 슬러그, 제목 패턴을 각각 `REPORT_SOURCE`, `REPORT_SLUG`, `REPORT_TITLE_PATTERN`으로 설정한다.
Hermes 세션에서 `/report-publisher`를 로드한 뒤 아래 명령을 실행하게 한다.

```bash
# cwd: 홈서버 fos-agents 저장소 루트
cd "$(git rev-parse --show-toplevel)"
test -n "${REPORT_SOURCE:-}"
test -n "${REPORT_SLUG:-}"
test -n "${REPORT_TITLE_PATTERN:-}"
python3 .agents/skills/report-publisher/scripts/publish_report.py prepare \
  --source "$REPORT_SOURCE" \
  --slug "$REPORT_SLUG" \
  --project-name fos-reports
publish_result="$(mktemp /tmp/plan007-hermes-publish.XXXXXX)"
python3 .agents/skills/report-publisher/scripts/publish_report.py publish \
  --source "$REPORT_SOURCE" \
  --slug "$REPORT_SLUG" \
  --project-name fos-reports \
  --confirm-public > "$publish_result"
public_url="$(jq -r '.public_url // empty' "$publish_result")"
test -n "$public_url"
curl --fail --silent --show-error "$public_url" | rg -q "$REPORT_TITLE_PATTERN"
```

모든 명령이 종료 코드 0을 반환해야 한다.

## 최종 검증

```bash
# cwd: fos-agents 저장소 루트
cd "$(git rev-parse --show-toplevel)"
python3 -m unittest discover -s .agents/skills/report-publisher/scripts -p 'test_*.py'
git diff --check
```

검증이 통과하면 `tasks/plan007-hermes-report-publisher/index.json`의
`status`와 두 phase 상태를 모두 `completed`로 바꾼다.

## 커밋

상태 파일이 바뀐 경우 `task(repo): plan007 Hermes 게시 연결 완료 기록`으로 커밋한다.

커밋 뒤 아래 명령이 종료 코드 0을 반환해야 한다.

```bash
# cwd: fos-agents 저장소 루트
cd "$(git rev-parse --show-toplevel)"
test -z "$(git status --short)"
```

## 막힘 조건

- 토큰이 없거나 Pages 쓰기 권한이 없으면
  `PHASE_BLOCKED: Hermes Cloudflare Pages 인증 없음`으로 종료한다.
- Hermes skill 목록에 `report-publisher`가 없으면
  `PHASE_BLOCKED: Hermes external_dirs 설정 불일치`로 종료한다.
- 승인된 공개 HTML이 없으면 외부 게시를 생략하고
  `PHASE_BLOCKED: 공개 게시 승인 대상 없음`으로 종료한다.
