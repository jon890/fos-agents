# Phase 01 - 세션 쿠키 Secure 정책 override 구현과 배포 검증

**Model**: codex
**Status**: completed

---

## 목표

`~/services/fos-career`의 로그인 API는 성공하지만 브라우저는 로그인 페이지에 남아 있다.
현재 테스트 경로가 HTTP인 상태에서 `NODE_ENV=production` 때문에 `Set-Cookie`에 `Secure`가 붙는다.
HTTP 브라우저와 `curl` cookie jar는 이 쿠키를 저장하지 않는다.
그래서 `/dashboard` 접근이 다시 `/login`으로 돌아간다.

이번 phase는 HTTPS가 안정화되기 전까지만 HTTP 테스트 로그인을 가능하게 하는 명시적 env override를 추가한다.

## 정책

- 기본값은 기존 보안 정책을 보존한다.
- `NODE_ENV=production`이면 `SESSION_COOKIE_SECURE`가 없을 때 `Secure=true`다.
- `SESSION_COOKIE_SECURE=false`가 명시된 경우에만 임시로 `Secure=false`를 허용한다.
- `SESSION_COOKIE_SECURE=true`가 명시되면 환경과 무관하게 `Secure=true`로 동작한다.
- override 값이 모호하면 실패하도록 하여 조용한 보안 약화를 피한다.
- Secure 정책은 코드 상수나 host 추론이 아니라 env 값으로만 제어한다.

## 롤백

HTTPS가 성공하면 `<home-server-app-env>`에서 `SESSION_COOKIE_SECURE=false`를 제거한다.
또는 `SESSION_COOKIE_SECURE=true`로 바꾼 뒤 컨테이너를 재배포한다.

## 범위

수정 대상:

- `fos-career/lib/db/session.ts`
- `fos-career/.env.example` config template
- `<home-server-app-env>`에 임시 override 추가

범위 외:

- 인증 구조 리팩터링
- middleware rewrite
- 로그인 UI 변경
- 세션 저장소 변경
- 비밀값 출력
- HTTPS 인증서 발급과 reverse proxy 구조 변경

## 작업 항목

1. 현재 `iron-session` 설정과 배포 env 흐름을 확인한다.
2. `SESSION_COOKIE_SECURE` 기반의 좁은 parser/helper를 추가한다.
3. 기존 패턴이 있으면 `.env.example` config template에 최소 env 예시를 추가한다.
4. 배포 `.env`에 `SESSION_COOKIE_SECURE=false`를 추가한다. 기존 비밀값은 출력하지 않는다.
5. build, compose deploy, HTTP Host header 기반 cookie jar 검증을 수행한다.
6. fos-career 변경만 commit/push한다.

## 검증

서비스 repo:

```bash
set -a
. <home-server-app-env>
set +a
npm run build
```

정책 grep:

```bash
rg -n "SESSION_COOKIE_SECURE|secure:" fos-career/lib/db/session.ts fos-career/.env.example
```

배포:

```bash
cd <home-server-app-dir>
docker compose up -d --build
docker ps --filter name=fos-career --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
```

HTTP 테스트:

```bash
curl -sS -D /tmp/fos-career-login.headers -o /dev/null \
  -H 'Host: career.fosworld.co.kr' \
  -H 'Content-Type: application/json' \
  -c /tmp/fos-career-cookies.txt \
  --data '{"username":"<redacted>","password":"<redacted>"}' \
  http://127.0.0.1:16000/api/auth/login

grep -i '^set-cookie:' /tmp/fos-career-login.headers | sed -E 's/(fos_career_session=)[^;]+/\1<redacted>/'

curl -sS -I -b /tmp/fos-career-cookies.txt \
  -H 'Host: career.fosworld.co.kr' \
  http://127.0.0.1:16000/dashboard
```

성공 기준:

- `npm run build` exit 0.
- `Set-Cookie`에는 session cookie가 있다.
- HTTP 테스트 override 상태에서는 `Set-Cookie`에 `Secure`가 없다.
- cookie jar를 사용한 `/dashboard` 요청이 `/login`으로 redirect되지 않는다.
- 컨테이너가 `healthy` 상태다.
- fos-career 변경은 작은 범위로 commit/push된다.
- career-os task 파일은 구현 commit에 섞지 않는다.

## PHASE_FAILED / PHASE_BLOCKED 조건

반드시 Bash 도구로 직접 실행하라.
prose만 출력하면 phase harness가 success로 잘못 처리할 수 있다.

- `npm run build` 실패 시 `PHASE_FAILED: npm run build failed`.
- 로그인 API가 DB/계정 문제로 실패해 cookie jar 검증을 못 하면 `PHASE_BLOCKED: login credentials or database unavailable`.
- `SESSION_COOKIE_SECURE=false` 외에 더 넓은 인증 변경이 필요하면 `PHASE_BLOCKED: broader auth change required`.
- 배포 `.env`를 출력해야만 진행할 수 있는 상황이면 `PHASE_BLOCKED: secret-safe env edit unavailable`.

## Self-check

- production default가 `Secure=true`인지 확인한다.
- `SESSION_COOKIE_SECURE=false`가 명시된 경우만 HTTP cookie 저장을 허용하는지 확인한다.
- 모호한 env 값이 조용히 `false`로 처리되지 않는지 확인한다.
- `git status --short`에서 의도한 fos-career 파일만 commit 대상인지 확인한다.
- `<home-server-app-env>` 내용은 출력하지 않는다.
