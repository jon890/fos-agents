---
name: report-publisher
description: 공개 가능한 HTML 리포트를 검사하고 Cloudflare Pages에 게시해 검증된 링크를 반환한다. 사용자가 "리포트 게시해줘", "HTML을 올려줘", "Cloudflare Pages 링크 만들어줘", "report publish"처럼 로컬 HTML 산출물의 외부 게시나 공유 URL 생성을 요청할 때 사용한다.
---

# 리포트 게시

사용자가 명시한 HTML 산출물만 Cloudflare Pages 미리보기 분기에 게시한다.
파일 전송은 `scripts/publish_report.py`가 고정된 Wrangler 버전으로 처리한다.

## 실행 흐름

1. 게시 대상 HTML을 브라우저로 렌더해 사용자에게 미리보기를 제공한다.
   Browser 도구가 있으면 로컬 파일이나 임시 HTTP 주소를 연다.
   Browser 도구가 없으면 저장소 루트에서 아래 서버를 실행한 뒤 해당 주소를 연다.

```bash
python3 -m http.server 8768
```

2. 아래 준비 검사를 실행하고 JSON 결과를 읽는다.

```bash
python3 .agents/skills/report-publisher/scripts/publish_report.py prepare \
  --source <HTML_FILE_OR_DIRECTORY> \
  --slug <PUBLIC_SLUG> \
  --project-name fos-reports
```

3. 검사 결과의 파일 수, 크기, 경고를 사용자에게 알린다.
4. 사용자가 현재 요청에서 게시를 명시했다면 아래 명령을 실행한다.

```bash
python3 .agents/skills/report-publisher/scripts/publish_report.py publish \
  --source <HTML_FILE_OR_DIRECTORY> \
  --slug <PUBLIC_SLUG> \
  --project-name fos-reports \
  --confirm-public
```

5. 반환된 `public_url`을 브라우저로 열어 HTTP 성공, 문서 제목과 주요 본문을 확인한다.
6. `branch_url`이 반환되면 같은 내용을 가리키는지 추가로 검증한다.
7. 검증된 `branch_url`을 안정적인 사용자용 주소로 우선 전달한다.
   `branch_url`이 없거나 검증에 실패한 경우에만 검증된 `public_url`을 전달한다.

## 입력 규칙

- 단일 HTML 파일은 HTTPS URL, 문서 내부 앵커, 전화·메일 링크만 참조해야 한다.
- 로컬 CSS, JavaScript, 이미지가 있으면 `index.html`을 포함한 디렉터리를 입력한다.
- 게시 대상은 현재 저장소 또는 시스템 임시 디렉터리 안에 둔다.
- 실행별 산출물은 시스템 임시 디렉터리에서 직접 게시하고 검증 뒤 정리한다.
- `slug`는 영문 소문자, 숫자, 하이픈만 사용한다.
- `slug`는 **28자 이내로 짓는다.**
  Cloudflare Pages가 분기 별칭 서브도메인을 28자로 잘라내기 때문이다.
  더 길면 `branch_url` 검증이 항상 실패해 안정 주소를 못 주고,
  앞 28자가 같은 두 리포트는 같은 별칭을 공유해 서로를 덮어쓴다.
  예: `freelance-2026-08-05`(20자)는 되고 `freelance-opportunity-2026-08-05`(32자)는 막힌다.
- production branch인 `main`은 `slug`로 사용할 수 없다.
- 같은 `slug`를 다시 게시하면 검증된 `branch_url`을 안정적인 사용자용 주소로 우선 전달한다.
- `public_url`은 배포별 검증 증거와 `branch_url` 실패 시 대체 주소로 사용한다.
- Cloudflare가 분기 별칭을 제공하고 실제 검증까지 통과한 경우에만
  같은 `slug`의 안정적인 주소로 `branch_url`을 사용한다.
- 서로 다른 리포트는 서로 다른 `slug`를 사용한다.

## 공개 경계

- 저장소 루트나 워크스페이스 전체를 게시하지 않는다.
- `.env`, 숨김 파일, 심볼릭 링크, 비밀 키, 로컬 절대 경로가 발견되면 중단한다.
- 평문 HTTP, `javascript:` URL, HTML을 담은 `data:` URL이 발견되면 중단한다.
- 자동 검사는 공개 안전성을 보장하지 않는다.
  사용자가 볼 미리보기와 게시 파일 목록을 함께 점검한다.
- Pages 미리보기 주소도 공개 주소로 취급한다.
- 삭제, 롤백, 사용자 정의 도메인 변경은 이 스킬의 범위가 아니다.

## 인증과 관리

처음 한 번은 `npx wrangler@4.115.0 login`으로 Cloudflare OAuth를 승인한다.
자동 실행 환경은 `Cloudflare Pages: Edit`로 제한한 API 토큰을 사용한다.
Pages 프로젝트는 production branch를 `main`으로 지정해 먼저 생성한다.

```bash
npx wrangler@4.115.0 pages project create fos-reports \
  --production-branch main
```

Cloudflare API MCP가 연결돼 있으면 프로젝트 조회와 배포 상태 확인에 사용한다.
파일 업로드는 MCP가 아니라 이 스킬의 Wrangler 실행 경로를 유지한다.
