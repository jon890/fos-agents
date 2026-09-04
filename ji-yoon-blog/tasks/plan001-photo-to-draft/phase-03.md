# Phase 03 스킬 절차와 네이버 임시저장

**Execution profile**: deep

---

## 목표

사진에서 초안까지의 절차를 스킬 본문에 확정하고, 네이버 글쓰기에 넣어 임시저장한다.
발행하지 않는다.

**범위 외**: S3 접근과 사진 전달은 앞 두 phase 가 소유한다.
페르소나와 카테고리 판단 기준을 이 phase 에서 다시 정하지 않는다.

**전제**: phase 02 가 만든 `photos.py` 와 고친 `photo_set.py` 가 있어야 한다.

---

## 환경 사실

- 네이버 로그인은 전용 브라우저 프로필에 한 번 해 두고 그 세션을 재사용한다.
- 브라우저 조작은 `~/.claude/scripts/browser-driver` 로 한다.
  브라우저 도구를 직접 부르면 실패해도 종료 코드가 0 이라 오류가 드러나지 않는다.
  명령 목록은 `browser-driver help` 가 소유하므로 첫 명령 전에 읽는다.
- 세션 없이 글쓰기 주소를 열면 네이버 로그인 화면으로 넘어간다.
- 아이폰이 여는 Admin UI 에는 자체 로그인이 없다.
  Cloudflare Access 가 유일한 보호막이고, 지난 사람은 다른 bucket 의 파일도 보고 지울 수 있다.

---

## 작업 항목 (4)

### 1. 스킬 본문에서 없어진 절차를 고친다

`ji-yoon-blog/.claude/skills/naver-blog-draft/SKILL.md` 를 고친다.

지금 본문은 서명된 업로드 주소를 만들어 아이폰에 주는 절차를 담고 있다.
그 경로는 S3 가 외부에 열려 있지 않아 동작하지 않는다.

다음으로 바꾼다.

- 준비 단계의 확인 명령을 `photos.py folders` 로 바꾼다.
- 사진 올릴 자리 만들기를 `photos.py new <장소>` 로 바꾼다.
  출력된 주소를 지융에게 주고, 아이폰에서 열어 올리게 한다.
- 사진 읽기를 `photos.py pull` 로 바꾼다.
- 서명 주소의 만료와 자리 개수 이야기를 지운다. Admin UI 업로드에는 그런 제약이 없다.

미리보기와 초안 형식 절은 그대로 둔다.
초안 블록 계약은 `ji-yoon-blog/docs/data-schema.md` 가 소유하므로 본문에서 되풀이하지 않고 가리킨다.

### 2. 아이폰 안내를 Admin UI 기준으로 다시 쓴다

`ji-yoon-blog/.claude/skills/naver-blog-draft/references/iphone-upload.md` 를 고친다.

담을 것은 다음이다.

- 왜 Admin UI 를 쓰는지. 아이폰 단축어가 S3 서명을 만들지 못하고 S3 가 외부에 열려 있지 않다.
- Cloudflare Access 로그인을 한 번 하면 쿠키가 남는다.
- 파일 화면에서 여러 장을 한 번에 고를 수 있다.
- 파일 이름은 아이폰이 준 원본 이름 그대로 저장되고, 순서는 촬영시각이 정한다.
- HEIC 이 그대로 올라가면 촬영시각을 읽지 못해 이름 순서가 된다.
- Access 를 지나면 다른 bucket 의 파일도 보인다. 사진 폴더만 다룬다.

서명 주소와 자리 개수 이야기를 지운다.

### 3. 네이버 임시저장 절차

`SKILL.md` 의 임시저장 절을 실행 가능한 단계로 채운다.

넣는 순서는 제목, 본문, 사진, 태그다.
본문은 `draft.json` 의 블록 순서를 따르고, `text` 블록의 `lines` 를 줄 단위로 넣는다.
줄을 한 문장으로 합치지 않는다. 지융의 글은 문단의 절반이 문장 중간에서 끊긴다.

사진은 `pull` 이 번호를 붙인 로컬 파일을 편집기에 올린다.
사진과 본문의 순서는 `blocks` 배열이 정한다.

멈출 조건과 그때 쓸 표현은 `ji-yoon-blog/docs/flow.md` 의 상태 표시 표가 소유한다.
본문에는 그 문서를 가리키고 표를 복제하지 않는다.

끝나면 편집기 상태를 읽어 제목과 본문이 실제로 들어갔는지 확인한다.
확인한 것만 완료라고 말한다.

### 4. 미리보기 생성기 점검

`ji-yoon-blog/.claude/skills/naver-blog-draft/scripts/build_preview.py` 는 고칠 것이 없는지 확인한다.

`pull` 이 사진 이름을 `001-` 형태로 바꾸므로 초안의 `path` 가 그 이름을 가리켜야 한다.
사진을 찾지 못하면 그 자리를 표시하고 0 이 아닌 코드로 끝나는 동작을 유지한다.

---

## Critical Files

| 파일 | 변경 |
| --- | --- |
| `ji-yoon-blog/.claude/skills/naver-blog-draft/SKILL.md` | 업로드와 사진 읽기 절차, 임시저장 단계 |
| `ji-yoon-blog/.claude/skills/naver-blog-draft/references/iphone-upload.md` | Admin UI 기준으로 다시 쓴다 |
| `ji-yoon-blog/.claude/skills/naver-blog-draft/scripts/build_preview.py` | 점검. 필요하면 경로 처리만 |

---

## 검증

```bash
# cwd: fos-agents root
~/.claude/scripts/korean-style-check.sh \
  ji-yoon-blog/.claude/skills/naver-blog-draft/SKILL.md \
  ji-yoon-blog/.claude/skills/naver-blog-draft/references/iphone-upload.md
python3 ~/.claude/scripts/check-readability.py \
  ji-yoon-blog/.claude/skills/naver-blog-draft/SKILL.md \
  ji-yoon-blog/.claude/skills/naver-blog-draft/references/iphone-upload.md
grep -rn "make_upload_page\|presign\|서명한 업로드" ji-yoon-blog/.claude/skills/ \
  && exit 1 || echo "없어진 경로 언급 없음"
git diff --check
```

스킬 검증기가 있으면 함께 돌린다.

```bash
# cwd: fos-agents root
python3 ~/.claude/plugins/cache/claude-plugins-official/skill-creator/*/skills/skill-creator/scripts/quick_validate.py \
  ji-yoon-blog/.claude/skills/naver-blog-draft
```

실제 흐름은 사진 두 장으로 끝까지 확인한다.

1. `photos.py new 검증` 으로 폴더를 만든다.
2. 아이폰이나 브라우저에서 사진 두 장을 올린다.
3. `photos.py pull` 로 받는다.
4. 초안을 만들고 미리보기를 연다.
5. 네이버에 임시저장하고 편집기에서 제목과 본문, 사진을 확인한다.
6. 임시저장한 글을 지운다. 확인용 폴더도 Admin UI 에서 지운다.

발행 버튼을 누르지 않는다.

모든 검증이 통과하면 `ji-yoon-blog/tasks/plan001-photo-to-draft/index.json` 의
`status` 를 `completed`, `current_phases` 를 `3` 으로 바꾼다.

---

## 의도 메모

- 상태 표시 표와 초안 블록 계약을 `docs/` 가 소유하고 스킬은 가리킨다.
  두 곳에 두면 한쪽만 고쳐져 갈라진다.
- 임시저장까지만 하는 이유는 글이 지융의 이름으로 공개되기 때문이다.
  마지막 판단을 사람이 한다.
- `text` 블록의 줄을 합치지 않는 것이 문체의 핵심이다.
  전수조사에서 문단의 49.3% 만 종결어미로 끝났고 나머지는 문장 중간에서 끊겼다.

---

## Blocked 조건

- 네이버 전용 브라우저 프로필에 세션이 없으면
  `PHASE_BLOCKED: 네이버 로그인 필요` 로 끝낸다. 계정 정보를 요청하지 않는다.
- 보안 확인이나 캡차가 나오면
  `PHASE_BLOCKED: 네이버 보안 확인` 으로 끝낸다. 우회하지 않는다.
- `photos.py pull` 이 사진을 가져오지 못하면
  `PHASE_BLOCKED: phase 02 산출물 미반영` 으로 끝낸다.
