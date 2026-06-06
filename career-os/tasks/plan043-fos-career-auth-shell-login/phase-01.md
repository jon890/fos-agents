# Phase 01 — 로그인 화면을 관리자 shell content 영역으로 재구성

**Model**: sonnet
**Status**: pending

---

## 목표

`~/services/fos-career`의 `/login` 화면을 독립형 중앙 로그인 페이지가 아니라 fos-career 관리자 shell의 head/nav 맥락 안에서 보이도록 수정한다.

**범위 외**:
- 인증/세션 정책 변경
- LLM provider 변경
- agent backend action 실행
- career-os docs 수정
- 새 dependency 추가

---

## 사전 cwd 설정

이 task는 career-os task 파일이지만 실제 구현 대상은 별도 서비스 repo인 `/home/bifos/services/fos-career`다. 첫 Bash에서 구현 repo로 이동한다.

```bash
cd /home/bifos/services/fos-career
pwd
```

---

## 관련 docs

구현 전에 반드시 읽는다.

- `/home/bifos/ai-nodes/career-os/docs/adr.md` — ADR-050
- `/home/bifos/ai-nodes/career-os/docs/code-architecture.md` — fos-career 웹 대시보드 / Auth shell 경계
- `/home/bifos/services/fos-career/AGENTS.md`
- `/home/bifos/services/fos-career/app/dashboard/layout.tsx`
- `/home/bifos/services/fos-career/app/(auth)/login/page.tsx`

---

## 작업 항목

### 1. 현재 로그인 구현 확인

`app/(auth)/login/page.tsx`가 현재 독립형 중앙 로그인 화면으로 구현되어 있다. 기존 로그인 동작은 유지한다.

유지할 것:
- `handleSubmit`
- `/api/auth/login` 호출
- 성공 시 `router.push('/dashboard')`
- loading / error state
- 한국어 label (`아이디`, `비밀번호`, `로그인`)

### 2. 관리자 shell 느낌을 로그인에 반영

로그인 화면은 아래 구조로 보이게 한다.

- 전체 화면 상단에 fos-career header/head 느낌 유지
- dashboard nav 항목은 인증 전이므로 disabled 또는 제한 상태로 표시
- 내부 content 영역 중앙에 로그인 폼 배치
- dashboard와 같은 zinc/blue 톤 사용
- 마케팅 카피, hero, 장식 배경 사용 금지
- 카드 안에 또 카드 넣는 중첩 카드 금지

권장 구조:

```text
body
  └─ shell container
     ├─ header/nav row
     │  ├─ fos-career
     │  └─ Positions / Applications / Chat (disabled or muted)
     └─ main content area
        └─ login form surface
```

### 3. 스타일 안정성 확인

- 모바일 폭에서 입력/버튼 텍스트가 넘치지 않아야 한다.
- disabled nav가 실제 링크처럼 오해되지 않게 한다.
- error message는 폼 내부에 작게 표시한다.
- CSS는 Tailwind class만 사용한다. 새 CSS 파일을 만들지 않는다.

### 4. 검증과 배포

아래 명령을 실행한다.

```bash
set -a
. /home/bifos/apps/fos-career/.env
set +a
npm run build
```

빌드 성공 후:

```bash
git status --short
git add app/'(auth)'/login/page.tsx
git commit -m "style: render login inside admin shell"
git push
cd /home/bifos/apps/fos-career
docker compose up -d --build
docker ps --filter name=fos-career --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
curl -I -sS --max-time 10 -H 'Host: career.fosworld.co.kr' http://127.0.0.1/login | sed -n '1,12p'
```

---

## 성공 기준

- `npm run build`가 exit 0.
- `app/(auth)/login/page.tsx`만 변경된다.
- `git status --short`가 commit/push 후 clean.
- `fos-career` container가 healthy.
- local NPM Host header 요청으로 `/login`이 200 OK.
- `/login` HTML에 Tailwind class 기반 shell/header/nav 구조가 반영되어 있다.

---

## PHASE_FAILED / PHASE_BLOCKED 조건

- build 실패 시 `PHASE_FAILED: npm run build failed`를 출력하고 exit 1.
- `app/(auth)/login/page.tsx` 외 파일 수정이 필요하면 `PHASE_BLOCKED: requires broader shell extraction`을 출력하고 exit 2.
- 인증 정책 변경이 필요하다고 판단되면 `PHASE_BLOCKED: auth policy change required`를 출력하고 exit 2.
