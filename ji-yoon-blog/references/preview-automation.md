# Naver Blog preview automation

This reference explains how to prepare or register a Naver Blog preview/draft.

## Important safety rule

Never ask the user to paste a Naver password, one-time code, recovery code, or cookie into chat. Use direct browser login or a dedicated local browser profile.

## Recommended login methods

### 1. Best: user logs in directly in the controlled browser

1. Open Naver Blog write page with browser automation.
2. If the login page appears, stop and ask the user to complete login directly in the browser UI.
3. After login completes, continue automation.
4. Save as draft or open preview only. Do not publish unless explicitly asked.

This avoids sharing credentials with the agent.

### 2. Persistent local browser profile

If Hermes/browser supports a persistent browser profile, configure one profile for Naver work and let the user log in once. Future sessions can reuse the login cookies.

Use only on a trusted machine. Do not export or paste cookies.

### 3. Manual copy-paste fallback

If browser automation is blocked, produce a `preview-package`:

- Recommended title.
- Body text.
- Photo slots.
- Tags.
- Short paste order.

The user copies it into Naver manually.

## Not recommended

- Sharing Naver ID/password in Discord or chat.
- Sharing session cookies.
- Automating CAPTCHA or bypassing security checks.
- Publishing without a final user confirmation.

## Browser automation procedure

1. Navigate to Naver Blog write page.
2. Detect state:
   - Login page: ask user to log in in browser.
   - Editor page: continue.
   - Bot/security challenge: stop and ask user to complete it manually.
3. Insert title.
4. Insert body in blocks. Use plain text first. Add images only if image files are available and the editor exposes upload controls.
5. Add tags if the editor has a tag field.
6. Click preview or save draft.
7. Verify by reading the editor state or preview title/body.

## Output status language

Be exact:

- `미리보기 초안 등록 완료` only if the editor/preview was actually created and verified.
- `로그인 필요로 중단` if login is required.
- `네이버 보안 확인으로 중단` if a challenge blocks automation.
- `수동 등록용 패키지 생성 완료` if only title/body/tags were prepared.

## Current known limit

Opening `https://blog.naver.com/PostWriteForm.naver?blogId=mywldbs` without an existing session redirects to Naver login. The agent can continue only after the user logs in directly in the browser/session.
