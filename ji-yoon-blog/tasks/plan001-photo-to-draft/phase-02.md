# Phase 02 맥북 사진 전달과 촬영시각 순서

**Execution profile**: deep

---

## 목표

맥북에서 SSH 로 홈서버 명령을 불러 폴더를 만들고 사진을 가져온다.
가져온 사진을 촬영시각 순서로 세워 번호를 붙인다.

**범위 외**: 초안 본문 작성과 네이버 조작은 phase 03 이 맡는다.
S3 에 직접 붙는 코드를 맥북에 두지 않는다.

**전제**: phase 01 이 만든 `ji-yoon-blog/scripts/photo_store.py` 가 홈서버에 있어야 한다.
없으면 base 를 확인하고 멈춘다.

---

## 환경 사실

- 홈서버로 가는 길은 SSH 하나뿐이다. S3 포트는 외부에 열려 있지 않다.
- 전송은 초당 11.3MB 로 실측됐다. 사진 264장이 약 70초다.
  축소판을 만들지 않고 원본을 한 번만 받는다.
- 아이폰 사파리는 사진을 고를 때 HEIC 을 JPEG 로 바꿔 보낸다.
  바뀌지 않고 올라가면 촬영시각을 읽지 못하므로 이름 순서로 되돌아가야 한다.
- 로컬 셸이 `zsh` 다. `zsh` 는 변수를 단어로 나누지 않으므로
  SSH 추가 인자를 문자열 하나로 넘기면 첫 인자에 전체가 붙어 접속이 실패한다.
  인자는 배열로 다루거나 명시적으로 분할한다.

---

## 작업 항목 (4)

### 1. 맥북 설정

`ji-yoon-blog/.env` 에서 읽을 값을 정한다.

| 이름 | 담는 것 |
| --- | --- |
| `JI_YOON_BLOG_SSH_TARGET` | 홈서버 SSH 대상 |
| `JI_YOON_BLOG_SSH_ARGS` | 포트와 키 파일 같은 추가 인자 |
| `JI_YOON_BLOG_REMOTE_ROOT` | 홈서버의 저장소 경로. 생략하면 `~/fos-agents` |
| `JI_YOON_BLOG_STORAGE_URL` | 아이폰이 여는 Admin UI 주소의 앞부분 |

`.env.example` 에 이 넷을 넣는다.
S3 값은 맥북 예시에 넣지 않는다.

### 2. 홈서버 명령 호출

`ji-yoon-blog/.claude/skills/naver-blog-draft/scripts/photos.py` 를 만든다.
SSH 로 `photo_store.py` 를 부르고 결과를 받는다.

| 명령 | 하는 일 |
| --- | --- |
| `folders` | 폴더와 사진 장수를 표로 보여준다 |
| `new <장소>` | 오늘 날짜로 폴더를 만들고 아이폰이 열 주소를 출력한다 |
| `pull <폴더> --out <디렉터리>` | tar 를 받아 풀고 촬영시각 순으로 번호를 붙인다 |

`new` 는 폴더 이름을 `<YYYY-MM-DD>-<장소>` 로 만든다.
날짜를 인자로 받는 선택 항목을 두어 지난 날짜로도 만들 수 있게 한다.

`new` 가 출력하는 주소는 Admin UI 의 파일 화면이 그 폴더를 열도록 만든다.
`JI_YOON_BLOG_STORAGE_URL` 뒤에 파일 화면 경로와 `path` 조회 인자를 붙이며,
`path` 값은 `/buckets/<bucket>/<접두사>/<폴더>` 를 URL 인코딩한 것이다.

`pull` 은 tar 를 표준 입력으로 받아 지정한 디렉터리에 푼다.
사진을 파일로 먼저 저장하지 않고 스트림으로 처리한다.

SSH 실패는 종료 코드로 판별해 멈춘다.
사진을 일부만 받은 상태로 성공이라고 말하지 않는다.

### 3. 촬영시각 정렬을 로컬 파일 기준으로 바꾼다

`ji-yoon-blog/.claude/skills/naver-blog-draft/scripts/photo_set.py` 를 고친다.

지금은 S3 에서 객체를 받아 촬영시각을 읽는다.
이제 입력이 로컬 디렉터리다.

- `seaweed_s3` 의존을 제거한다.
- 디렉터리를 받아 이미지 파일을 모으고 각 파일의 촬영시각을 읽는다.
- 촬영시각이 있으면 그것으로, 없으면 이름으로 순서를 세운다.
- 순서대로 `001-`, `002-` 접두사를 붙여 이름을 바꾼다.
- 촬영시각을 읽지 못한 사진이 있으면 몇 장인지 알린다.

JPEG 의 EXIF 를 직접 읽는 함수는 그대로 둔다.
작은 끝과 큰 끝 바이트 순서를 모두 다루는 코드가 이미 검증돼 있다.

### 4. 검증 갱신

`ji-yoon-blog/.claude/skills/naver-blog-draft/scripts/test_photo_set.py` 를 고친다.

가짜 S3 객체 대신 임시 디렉터리에 합성한 JPEG 를 두고 확인한다.
합성 함수는 그대로 쓴다.

확인할 것은 다음이다.

1. 작은 끝과 큰 끝 EXIF 에서 촬영시각을 읽는다.
2. EXIF 가 없는 JPEG 와 JPEG 가 아닌 파일에서 빈 값을 돌려준다.
3. 촬영시각이 뒤섞인 파일이 시각 순서로 번호를 받는다.
4. 촬영시각이 없으면 이름 순서로 번호를 받는다.
5. 이미지가 아닌 파일은 번호를 받지 않는다.

---

## Critical Files

| 파일 | 변경 |
| --- | --- |
| `ji-yoon-blog/.claude/skills/naver-blog-draft/scripts/photos.py` | SSH 로 홈서버 명령 호출 |
| `ji-yoon-blog/.claude/skills/naver-blog-draft/scripts/photo_set.py` | 입력을 로컬 디렉터리로 바꾼다 |
| `ji-yoon-blog/.claude/skills/naver-blog-draft/scripts/test_photo_set.py` | 디렉터리 기준 검증 |
| `ji-yoon-blog/.env.example` | 맥북이 읽을 넷 |

---

## 검증

```bash
# cwd: fos-agents root
python3 ji-yoon-blog/.claude/skills/naver-blog-draft/scripts/test_photo_set.py
python3 -c "import ast,sys; [ast.parse(open(f).read()) for f in sys.argv[1:]]" \
  ji-yoon-blog/.claude/skills/naver-blog-draft/scripts/photos.py \
  ji-yoon-blog/.claude/skills/naver-blog-draft/scripts/photo_set.py
grep -rn "seaweed_s3" ji-yoon-blog/.claude/skills/ && exit 1 || echo "맥북 코드에 S3 의존 없음"
git diff --check
```

실제 왕복도 확인한다.

```bash
# cwd: fos-agents root
python3 ji-yoon-blog/.claude/skills/naver-blog-draft/scripts/photos.py new 검증
python3 ji-yoon-blog/.claude/skills/naver-blog-draft/scripts/photos.py folders
```

`new` 가 출력한 주소를 브라우저에서 열어 그 폴더가 보이는지 확인한다.
사진 한 장을 올린 뒤 `pull` 로 받아 번호가 붙는지 확인한다.

확인용 폴더는 Admin UI 에서 지운다.

---

## 의도 메모

- 축소판을 만들지 않는 이유는 셋이다.
  최악이 70초이고, 네이버에 올릴 때 원본이 필요하며,
  축소판을 두면 같은 사진을 두 번 받거나 캐시를 관리해야 한다.
- `pull` 이 이름을 다시 붙이므로 같은 폴더를 다시 받으면 앞 사진의 번호도 바뀔 수 있다.
  초안이 사진 경로를 들고 있으므로 이어 올린 뒤에는 초안의 경로를 다시 맞춰야 한다.
- 맥북 코드에 `seaweed_s3` 의존이 없는지 검증에서 확인한다.
  의존이 생기면 credential 이 맥북으로 내려와야 하므로 경계가 무너진다.

---

## Blocked 조건

- 홈서버에 `ji-yoon-blog/scripts/photo_store.py` 가 없으면
  `PHASE_BLOCKED: phase 01 산출물 미반영` 으로 끝낸다.
- `ji-yoon-blog/.env` 에 SSH 값이 없으면
  `PHASE_BLOCKED: 맥북 SSH 설정 미비` 로 끝낸다. 다른 워크스페이스의 값을 가져다 쓰지 않는다.
