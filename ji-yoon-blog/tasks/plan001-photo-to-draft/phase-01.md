# Phase 01 홈서버 사진 저장소 접근

**Execution profile**: deep

---

## 목표

홈서버에서 실행되는 명령으로 `ji-yoon-blog` bucket의 사진 폴더를 만들고 조회하고 전송한다.
S3 credential은 홈서버 밖으로 나가지 않는다.

**범위 외**: 맥북에서 부르는 쪽, 촬영시각 정렬, 초안 작성, 네이버 조작은 다음 phase가 맡는다.
SeaweedFS 배포와 bucket 생성, credential 발급은 이미 끝났으므로 하지 않는다.

---

## 이미 준비된 것

다음은 홈서버에 이미 있다. 다시 만들지 않는다.

| 항목 | 값 |
| --- | --- |
| bucket | `ji-yoon-blog` |
| 권한 | `Read`, `Write`, `List` |
| 환경 파일 | `~/apps/ji-yoon-blog/config/host.env` (mode 600) |
| 저장소 클론 | `~/fos-agents`. `git pull`이 곧 배포이며 별도 설치가 없다 |

환경 파일에는 `JI_YOON_BLOG_S3_ENDPOINT`, `JI_YOON_BLOG_S3_BUCKET`,
`JI_YOON_BLOG_S3_ACCESS_KEY`, `JI_YOON_BLOG_S3_SECRET_KEY`, `JI_YOON_BLOG_PHOTO_PREFIX`가 있다.

## 환경 사실

- S3 API는 홈서버 `127.0.0.1:8333`에만 열려 있다. 외부에서 닿지 않는다.
- SeaweedFS는 가상 호스트 방식 주소를 쓰지 않는다. `<endpoint>/<bucket>/<key>` 경로 방식으로 보낸다.
- 홈서버 `python3`은 3.12이고 외부 라이브러리를 새로 넣지 않는다.
- `Write` 권한은 PUT과 DELETE를 함께 포함한다. 삭제 요청은 HTTP 204로 성공한다.
  둘을 갈라 줄 수 없으므로 삭제 경계를 코드에 둔다.

---

## 작업 항목 (4)

### 1. S3 접근 계층을 워크스페이스 scripts로 옮긴다

`ji-yoon-blog/.claude/skills/naver-blog-draft/scripts/seaweed_s3.py`를
`ji-yoon-blog/scripts/seaweed_s3.py`로 옮긴다.

옮긴 뒤 다음을 고친다.

- `presign` 메서드와 `presign` 하위 명령을 제거한다.
  아이폰은 S3에 직접 붙지 않고 Admin UI로 올리므로 서명된 주소가 쓰이지 않는다.
- 환경 파일 경로를 `~/apps/ji-yoon-blog/config/host.env`로 읽는다.
  워크스페이스 `.env`를 먼저 보고 없으면 그 경로를 보는 순서로 둔다.
- 이미 환경에 있는 `JI_YOON_BLOG_S3_` 값이 파일 값보다 우선한다.

`load_env`가 파일을 찾지 못하고 환경 변수도 없으면 어느 항목이 비었는지 이름으로 알린다.

### 2. 사진 저장소 명령

`ji-yoon-blog/scripts/photo_store.py`를 만든다.
`seaweed_s3.py`를 가져다 쓰고 다음 하위 명령을 갖는다.

| 명령 | 인자 | 출력 |
| --- | --- | --- |
| `folders` | 없음 | 폴더마다 접두사, 사진 장수, 합계 크기를 담은 JSON 배열 |
| `create` | 폴더 이름 | 만든 접두사 한 줄 |
| `list` | 폴더 이름 | 객체마다 키, 크기, 수정 시각을 담은 JSON 배열 |
| `fetch` | 폴더 이름 | 사진을 담은 tar 를 표준 출력으로 |

`create`는 `<접두사>/<폴더>/.keep`에 크기 0 객체를 쓴다.
S3에는 폴더가 없고 키 접두사만 있어서, 이 객체가 없으면 사진을 올리기 전의 폴더가
Admin UI 파일 목록에 보이지 않는다.

`folders`와 `list`는 이미지 확장자만 사진으로 센다.
`.keep`과 그 밖의 파일은 장수에서 뺀다.
확장자 목록은 `.jpg`, `.jpeg`, `.png`, `.heic`, `.heif`, `.webp`다.

`fetch`는 객체를 받아 tar 로 묶어 표준 출력에 흘린다.
tar 안의 이름은 원본 파일명만 쓰고 접두사 경로를 넣지 않는다.
`.keep`은 tar 에 넣지 않는다.

삭제 하위 명령을 만들지 않는다.
`Write` 권한으로 삭제가 되지만 이 명령에는 그 경로를 두지 않는다.

### 3. 연결과 권한 확인 명령

`ji-yoon-blog/scripts/verify_photo_store.py`를 만든다.
전용 시험 접두사에서 다음을 확인하고 시험 객체를 남기지 않는다.

1. 자기 bucket 에 쓴 객체를 다시 받은 byte 의 SHA-256 이 같다.
2. 익명 요청이 거부된다.
3. 같은 credential 로 `career-os` bucket 에 쓰거나 읽을 수 없다.
4. `Write` 권한이 삭제까지 포함한다. 이것은 막을 수 없는 사실이라 통과 조건으로 둔다.
5. 시험 객체가 더는 존재하지 않는다.

출력과 오류에 access key 와 secret key 를 넣지 않는다.
확인이 실패하면 0 이 아닌 코드로 끝낸다.

### 4. 설정 예시 갱신

`ji-yoon-blog/.env.example`을 고친다.

맥북이 읽는 값과 홈서버가 읽는 값을 갈라 적는다.
맥북에는 SSH 접속 정보만 두고 S3 값을 두지 않는다.
S3 값이 홈서버의 어느 파일에 있는지 주석으로 가리킨다.

---

## Critical Files

| 파일 | 변경 |
| --- | --- |
| `ji-yoon-blog/scripts/seaweed_s3.py` | 스킬에서 옮기고 서명 발급 제거 |
| `ji-yoon-blog/scripts/photo_store.py` | 폴더와 사진 조회, 전송 |
| `ji-yoon-blog/scripts/verify_photo_store.py` | 연결과 권한 경계 확인 |
| `ji-yoon-blog/.claude/skills/naver-blog-draft/scripts/seaweed_s3.py` | 삭제 |
| `ji-yoon-blog/.claude/skills/naver-blog-draft/scripts/make_upload_page.py` | 삭제 |
| `ji-yoon-blog/.env.example` | 맥북과 홈서버 값 분리 |

---

## 검증

홈서버에서 실행한다.
SSH 접속 정보는 `ji-yoon-blog/.env`에서 읽는다.

```bash
# cwd: fos-agents root
python3 -c "import ast,sys; [ast.parse(open(f).read()) for f in sys.argv[1:]]" \
  ji-yoon-blog/scripts/seaweed_s3.py \
  ji-yoon-blog/scripts/photo_store.py \
  ji-yoon-blog/scripts/verify_photo_store.py
git diff --check
```

홈서버에서 이어 확인한다.

```bash
# cwd: 홈서버의 ~/fos-agents
git pull
python3 ji-yoon-blog/scripts/verify_photo_store.py
python3 ji-yoon-blog/scripts/photo_store.py create 9999-99-99-검증
python3 ji-yoon-blog/scripts/photo_store.py folders
python3 ji-yoon-blog/scripts/photo_store.py list 9999-99-99-검증
```

`folders`가 검증 폴더를 사진 0장으로 보여야 한다.
확인이 끝나면 그 폴더를 Admin UI 에서 지운다.
이 명령에는 삭제 경로가 없다.

`career-os` bucket 의 객체를 만들거나 지우지 않는다.

---

## 의도 메모

- S3 접근을 스킬 안이 아니라 워크스페이스 `scripts/`에 둔다.
  홈서버가 `git pull` 로 받는 자리이고, 스킬은 맥북에서만 돌기 때문이다.
- 맥북 코드가 이 모듈을 부를 수 있게 두면 credential 이 맥북으로 내려와야 한다.
  경계를 디렉터리로 표시한다.
- `.keep` 은 Admin UI 에 폴더를 보이게 하는 유일한 수단이다.
  S3 에 폴더 개념이 없어서, 이것 없이는 사진을 올리기 전 폴더로 들어갈 방법이 없다.

---

## Blocked 조건

- 홈서버 `~/apps/ji-yoon-blog/config/host.env` 가 없거나 값이 비어 있으면
  `PHASE_BLOCKED: 홈서버 환경 파일 미비` 로 끝낸다. 새로 발급하지 않는다.
- `verify_photo_store.py` 의 격리 확인이 실패하면
  `PHASE_BLOCKED: bucket 격리 미충족` 으로 끝낸다. 권한을 넓혀 통과시키지 않는다.
