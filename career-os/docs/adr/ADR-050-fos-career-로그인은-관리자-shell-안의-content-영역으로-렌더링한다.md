## ADR-050 — fos-career 로그인은 관리자 shell 안의 content 영역으로 렌더링한다

- Status: Accepted
- Date: 2026-06-06

### 맥락

`plan039-fos-career-dashboard`의 MVP 로그인 화면은 기능 우선으로 만들었고, 이후 임시 스타일 보강이 독립형 중앙 로그인 화면으로 적용됐다.
사용자는 로그인도 관리자 화면의 head와 내비게이션 맥락이 살아 있는 상태에서 내부 content 영역에 표시되길 원했다.

### 결정

- fos-career 로그인 화면은 독립 랜딩처럼 보이지 않게 한다.
- 인증 전에도 관리자 shell의 head/nav 계열 시각 구조는 유지한다.
- 실제 데이터 메뉴는 인증 전 접근 가능한 것처럼 보이지 않도록 disabled 또는 제한 상태로 표시한다.
- 로그인 폼은 shell 내부 content 영역에 배치한다.
- 이번 결정은 UI shell과 로그인 렌더링만 다룬다. 인증 정책, 세션 만료 정책, agent 실행 권한은 변경하지 않는다.

### 결과

- 사용자가 로그인 전후에 같은 제품 안에 있다는 맥락을 유지한다.
- dashboard와 auth 화면의 시각 언어가 맞춰진다.
- 후속 dashboard write action이나 agent backend action gate를 붙일 때 auth shell 경계가 더 명확해진다.

### 적용

- `tasks/plan043-fos-career-auth-shell-login/`
- `~/services/fos-career/app/(auth)/login/page.tsx`
- 필요 시 `~/services/fos-career/app/dashboard/layout.tsx`의 shell 패턴을 재사용한다.
